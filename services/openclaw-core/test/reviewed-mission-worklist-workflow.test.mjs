import assert from "node:assert/strict";
import test from "node:test";

import { createReviewedMissionWorklist } from "../src/reviewed-mission-worklist.mjs";
import {
  buildReviewedWorkflowSelection,
  compactReviewedWorkflowOutcome,
} from "../src/reviewed-workflow-selection.mjs";

function createHarness() {
  let nextId = 0;
  let currentMs = Date.parse("2026-08-04T12:00:00.000Z");
  const records = new Map();
  const tasks = new Map();
  const calls = [];
  const now = () => new Date(currentMs).toISOString();
  const taskManager = {
    getTaskById: (id) => tasks.get(id) ?? null,
    getActiveTasks: () => [...tasks.values()].filter((task) => ["queued", "running", "paused"].includes(task.status)),
  };
  const reviewedTaskOwner = {
    async create(body, options) {
      calls.push({ action: "create", body, options });
      const task = {
        id: `task-${++nextId}`,
        status: "queued",
        reviewedWorkflowSelection: options.source.workflowSelection,
        createdAt: now(),
        updatedAt: now(),
        closedAt: null,
      };
      tasks.set(task.id, task);
      return { task };
    },
  };
  const selectionForTask = (task) => buildReviewedWorkflowSelection({
    workflowId: task.reviewedWorkflowSelection.workflowId,
    goal: task.goal,
  });
  const workflowRunner = {
    async run({ task, workflowSelection }) {
      calls.push({ action: "workflow", taskId: task.id, workflowId: workflowSelection.workflowId });
      task.status = "completed";
      task.closedAt = now();
      task.updatedAt = now();
      const outcome = compactReviewedWorkflowOutcome({
        selection: workflowSelection,
        response: {
          ok: true,
          invoked: true,
          blocked: false,
          invocation: { id: `invocation-${task.id}` },
          summary: {
            status: "completed",
            taskId: task.id,
            runCompletionAudit: true,
            workflowCompletionAudit: true,
            providerCallCount: 2,
            actionCount: 2,
            outcomeUnknown: false,
          },
        },
      });
      return { ok: true, ran: true, outcome, steps: [{ task: { id: task.id } }] };
    },
  };
  const persistState = () => {};
  persistState.flush = persistState;
  const owner = createReviewedMissionWorklist({
    records,
    persistState,
    taskManager,
    reviewedTaskOwner,
    workflowRunner,
    now,
    createId: () => `id-${++nextId}`,
  });
  return {
    owner,
    records,
    tasks,
    calls,
    mission: {
      id: "mission-1",
      status: "armed",
      epochsConsumed: 0,
      remainingEpochs: 1,
      childLeaseId: null,
    },
    now,
  };
}

test("worklist binds a fixed recipe and executes it through the existing workflow owner", async () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, {
    items: [{
      goal: "Inspect the reviewed form",
      targetUrl: "https://example.com/form",
      workflowId: "semantic_form_workflow",
    }],
    confirm: true,
  });
  assert.equal(bound.items[0].workflowId, "semantic_form_workflow");
  assert.match(bound.items[0].workflowSelectionHash, /^[a-f0-9]{64}$/u);
  const issued = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(issued.taskId, "task-3");
  assert.equal(harness.tasks.get("task-3").reviewedWorkflowSelection.workflowId, "semantic_form_workflow");
  const run = await harness.owner.runEpoch({ missionId: harness.mission.id });
  assert.equal(run.managed, true);
  assert.equal(run.result.ran, true);
  assert.equal(run.worklist.status, "active");
  assert.equal(run.worklist.items[0].workflowStatus, "awaiting_acceptance");
  assert.equal(run.worklist.items[0].status, "issued");
  assert.equal(run.worklist.items[0].workflowAcceptanceRequired, true);
  const observed = harness.owner.refreshForMission(harness.mission.id);
  assert.equal(observed.status, "active");
  assert.equal(observed.items[0].workflowStatus, "awaiting_acceptance");
  const pausedForAcceptance = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(pausedForAcceptance.reason, "workflow_acceptance_required");
  assert.equal(pausedForAcceptance.ready, false);
  const pending = run.worklist.items[0];
  const accepted = await harness.owner.acceptWorkflow(harness.mission.id, {
    confirm: true,
    itemId: pending.id,
    taskId: pending.issuedTaskId,
    workflowId: pending.workflowId,
    selectionHash: pending.workflowSelectionHash,
    outcomeHash: pending.workflowOutcomeHash,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.worklist.status, "completed");
  assert.equal(accepted.worklist.items[0].workflowStatus, "completed");
  assert.equal(accepted.worklist.items[0].status, "completed");
  assert.equal(accepted.worklist.items[0].workflowAcceptanceRequired, false);
  assert.match(accepted.acceptance.acceptanceHash, /^[a-f0-9]{64}$/u);
  await assert.rejects(
    () => harness.owner.acceptWorkflow(harness.mission.id, {
      confirm: true,
      itemId: pending.id,
      taskId: pending.issuedTaskId,
      workflowId: pending.workflowId,
      selectionHash: pending.workflowSelectionHash,
      outcomeHash: pending.workflowOutcomeHash,
    }),
    /active worklist/u,
  );
  assert.deepEqual(harness.calls.map((call) => call.action), ["create", "workflow"]);
});

test("omitting workflowId preserves generic execution when workflow support is installed", async () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, {
    items: [{ goal: "Inspect the legacy-compatible form", targetUrl: "https://example.com/legacy-compatible" }],
    confirm: true,
  });
  assert.equal(bound.items[0].workflowSelectionBound, false);
  assert.equal(bound.items[0].workflowStatus, "legacy");

  const issued = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(issued.issued, true);
  assert.equal(harness.tasks.get(issued.taskId).reviewedWorkflowSelection, undefined);

  Object.assign(harness.tasks.get(issued.taskId), {
    status: "completed",
    closedAt: harness.now(),
    updatedAt: harness.now(),
  });
  const completed = harness.owner.refreshForMission(harness.mission.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.items[0].workflowSelectionBound, false);
  assert.deepEqual(harness.calls.map((call) => call.action), ["create"]);
});

test("worklist rejects a recipe whose fixed goal contract does not match", () => {
  const harness = createHarness();
  assert.throws(
    () => harness.owner.bind(harness.mission, {
      items: [{
        goal: "Inspect the reviewed form",
        targetUrl: "https://example.com/form",
        workflowId: "native_intake_workflow",
      }],
      confirm: true,
    }),
    /fixed recipe compatible/u,
  );
});

test("workflow checkpoint is terminal on restart and cannot be replayed", async () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, {
    items: [{
      goal: "Inspect the reviewed form",
      targetUrl: "https://example.com/form",
      workflowId: "bounded_run",
    }],
    confirm: true,
  });
  await harness.owner.prepareEpoch(harness.mission);
  const raw = harness.records.get(bound.id);
  raw.status = "active";
  raw.items[0].workflowStatus = "running";
  raw.items[0].workflowCheckpointAt = harness.now();
  const [reconciled] = harness.owner.reconcileAtStartup();
  assert.equal(reconciled.status, "blocked");
  assert.equal(reconciled.blockedReason, "core_restart_during_workflow_execution");
  assert.equal(reconciled.items[0].terminalTaskStatus, "workflow_interrupted");
  assert.equal(harness.calls.filter((call) => call.action === "workflow").length, 0);
});

test("workflow acceptance checkpoint is terminal on restart and cannot be replayed", async () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, {
    items: [{
      goal: "Inspect the reviewed form",
      targetUrl: "https://example.com/form",
      workflowId: "bounded_run",
    }],
    confirm: true,
  });
  await harness.owner.prepareEpoch(harness.mission);
  const run = await harness.owner.runEpoch({ missionId: harness.mission.id });
  const raw = harness.records.get(bound.id);
  raw.items[0].workflowStatus = "accepting";
  raw.items[0].workflowCheckpointAt = harness.now();
  const observed = harness.owner.refreshForMission(harness.mission.id);
  assert.equal(observed.status, "active");
  assert.equal(observed.items[0].workflowStatus, "accepting");
  const [reconciled] = harness.owner.reconcileAtStartup();
  assert.equal(reconciled.status, "blocked");
  assert.equal(reconciled.blockedReason, "core_restart_during_workflow_acceptance");
  assert.equal(reconciled.items[0].terminalTaskStatus, "workflow_acceptance_interrupted");
  assert.equal(run.worklist.items[0].workflowStatus, "awaiting_acceptance");
});

test("completed selected workflow without an acceptance receipt fails closed", async () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, {
    items: [{
      goal: "Inspect the reviewed form",
      targetUrl: "https://example.com/form",
      workflowId: "bounded_run",
    }],
    confirm: true,
  });
  await harness.owner.prepareEpoch(harness.mission);
  await harness.owner.runEpoch({ missionId: harness.mission.id });
  const raw = harness.records.get(bound.id);
  raw.status = "completed";
  raw.items[0].status = "completed";
  raw.items[0].workflowStatus = "completed";
  raw.items[0].workflowAcceptance = null;
  const [reconciled] = harness.owner.reconcileAtStartup();
  assert.equal(reconciled.status, "blocked");
  assert.equal(reconciled.blockedReason, "workflow_acceptance_missing");
  assert.equal(reconciled.items[0].workflowStatus, "failed");
  assert.equal(harness.calls.filter((call) => call.action === "workflow").length, 1);
});

test("legacy persisted worklists stay generic after the first checkpoint", async () => {
  let nextId = 0;
  const records = new Map([[
    "worklist-legacy",
    {
      registry: "nixsoma-reviewed-finite-mission-worklist-v0",
      id: "worklist-legacy",
      missionId: "mission-legacy",
      status: "bound",
      items: [{
        id: "item-legacy",
        ordinal: 1,
        goal: "Inspect the legacy reviewed form",
        targetUrl: "https://example.com/legacy",
        blueprintHash: "a".repeat(64),
        status: "pending",
        issuedTaskId: null,
      }],
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    },
  ]]);
  const tasks = new Map();
  const calls = [];
  const taskManager = {
    getTaskById: (id) => tasks.get(id) ?? null,
    getActiveTasks: () => [...tasks.values()].filter((task) => ["queued", "running", "paused"].includes(task.status)),
  };
  const owner = createReviewedMissionWorklist({
    records,
    persistState: () => {},
    taskManager,
    reviewedTaskOwner: {
      async create(body, options) {
        calls.push({ action: "create", body, options });
        const task = { id: `legacy-task-${++nextId}`, status: "queued", updatedAt: "2026-08-04T12:01:00.000Z" };
        tasks.set(task.id, task);
        return { task };
      },
    },
    workflowRunner: {
      run: async () => {
        calls.push({ action: "workflow" });
        throw new Error("legacy item must not enter a selected workflow");
      },
    },
    now: () => "2026-08-04T12:01:00.000Z",
  });
  const mission = {
    id: "mission-legacy",
    status: "armed",
    epochsConsumed: 0,
    remainingEpochs: 1,
    childLeaseId: null,
  };

  const before = owner.listPublic()[0];
  assert.equal(before.items[0].workflowSelectionBound, false);
  assert.equal(before.items[0].workflowStatus, "legacy");

  const issued = await owner.prepareEpoch(mission);
  assert.equal(issued.issued, true);
  assert.equal(calls.map((call) => call.action).join(","), "create");

  tasks.get("legacy-task-1").status = "completed";
  const completed = owner.refreshForMission(mission.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.items[0].workflowSelectionBound, false);
  assert.equal(completed.items[0].workflowStatus, "legacy");
  assert.equal(calls.map((call) => call.action).join(","), "create");
});
