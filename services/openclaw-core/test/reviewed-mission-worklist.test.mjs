import assert from "node:assert/strict";
import test from "node:test";

import { createReviewedMissionWorklist } from "../src/reviewed-mission-worklist.mjs";

function createHarness({ issueFails = false } = {}) {
  let currentMs = Date.parse("2026-08-02T12:00:00.000Z");
  let nextId = 0;
  let persistCount = 0;
  const records = new Map();
  const tasks = new Map();
  const issued = [];
  const now = () => new Date(currentMs).toISOString();
  const taskManager = {
    getTaskById: (id) => tasks.get(id) ?? null,
    getActiveTasks: () => [...tasks.values()].filter((task) => ["queued", "running", "paused"].includes(task.status)),
  };
  const reviewedTaskOwner = {
    async create(body, options) {
      issued.push({ body, options });
      if (issueFails) throw new Error("task owner unavailable");
      const task = {
        id: `task-${issued.length}`,
        status: "queued",
        createdAt: now(),
        updatedAt: now(),
        closedAt: null,
      };
      tasks.set(task.id, task);
      return { task };
    },
  };
  const persistState = () => { persistCount += 1; };
  persistState.flush = persistState;
  const owner = createReviewedMissionWorklist({
    records,
    persistState,
    taskManager,
    reviewedTaskOwner,
    now,
    createId: () => `reviewed-${++nextId}`,
  });
  const mission = {
    id: "mission-1",
    status: "armed",
    epochsConsumed: 0,
    remainingEpochs: 4,
    childLeaseId: null,
  };
  return {
    owner,
    records,
    tasks,
    issued,
    mission,
    persistCount: () => persistCount,
    advance(milliseconds) { currentMs += milliseconds; },
  };
}

const items = [
  { goal: "Inspect reviewed item one", targetUrl: "https://example.com/one" },
  { goal: "Inspect reviewed item two", targetUrl: "https://example.com/two" },
];

test("worklist binding stores a finite immutable review without creating tasks", () => {
  const harness = createHarness();
  const worklist = harness.owner.bind(harness.mission, { items, confirm: true });

  assert.equal(worklist.status, "bound");
  assert.equal(worklist.itemCount, 2);
  assert.equal(worklist.issuedCount, 0);
  assert.equal(worklist.governance.openEndedTaskCreation, false);
  assert.equal(harness.tasks.size, 0);
  assert.equal(harness.issued.length, 0);
  assert.ok(worklist.items.every((item) => /^[a-f0-9]{64}$/u.test(item.blueprintHash)));
  assert.throws(
    () => harness.owner.bind(harness.mission, { items, confirm: true }),
    /already bound/u,
  );
});

test("worklist checkpoints and issues exactly one reviewed item at each terminal boundary", async () => {
  const harness = createHarness();
  harness.owner.bind(harness.mission, { items, confirm: true });
  const persistedBeforeIssue = harness.persistCount();

  const first = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(first.ready, true);
  assert.equal(first.issued, true);
  assert.equal(first.taskId, "task-1");
  assert.ok(harness.persistCount() >= persistedBeforeIssue + 2, "issue checkpoint and task binding must both persist");
  assert.equal(harness.issued[0].body.includePlan, true);
  assert.equal(harness.issued[0].options.source.itemOrdinal, 1);

  const repeated = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(repeated.issued, false);
  assert.equal(repeated.taskId, "task-1");
  assert.equal(harness.issued.length, 1);

  Object.assign(harness.tasks.get("task-1"), {
    status: "completed",
    updatedAt: "2026-08-02T12:01:00.000Z",
    closedAt: "2026-08-02T12:01:00.000Z",
  });
  const second = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(second.issued, true);
  assert.equal(second.taskId, "task-2");
  assert.equal(second.worklist.completedCount, 1);
  assert.equal(harness.issued[1].options.source.itemOrdinal, 2);

  Object.assign(harness.tasks.get("task-2"), {
    status: "completed",
    updatedAt: "2026-08-02T12:02:00.000Z",
    closedAt: "2026-08-02T12:02:00.000Z",
  });
  const completed = harness.owner.refreshForMission(harness.mission.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedCount, 2);
  assert.equal(completed.progressPercent, 100);
});

test("worklist blocks on task failure, unrelated work, and issue failure without retry", async () => {
  const failedTaskHarness = createHarness();
  failedTaskHarness.owner.bind(failedTaskHarness.mission, { items, confirm: true });
  await failedTaskHarness.owner.prepareEpoch(failedTaskHarness.mission);
  failedTaskHarness.tasks.get("task-1").status = "failed";
  const failed = failedTaskHarness.owner.refreshForMission(failedTaskHarness.mission.id);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.blockedReason, "issued_task_failed");
  assert.equal(failed.issuedCount, 1);
  assert.equal(failedTaskHarness.issued.length, 1);

  const unrelatedHarness = createHarness();
  unrelatedHarness.owner.bind(unrelatedHarness.mission, { items, confirm: true });
  unrelatedHarness.tasks.set("unrelated-task", { id: "unrelated-task", status: "queued" });
  const unrelated = await unrelatedHarness.owner.prepareEpoch(unrelatedHarness.mission);
  assert.equal(unrelated.ready, false);
  assert.equal(unrelated.reason, "unrelated_active_task");
  assert.equal(unrelatedHarness.issued.length, 0);

  const issueFailureHarness = createHarness({ issueFails: true });
  issueFailureHarness.owner.bind(issueFailureHarness.mission, { items, confirm: true });
  const issueFailure = await issueFailureHarness.owner.prepareEpoch(issueFailureHarness.mission);
  assert.equal(issueFailure.ready, false);
  assert.equal(issueFailure.reason, "task_issue_failed");
  assert.equal(issueFailure.worklist.issuedCount, 0);
  assert.equal(issueFailureHarness.issued.length, 1);
  assert.equal((await issueFailureHarness.owner.prepareEpoch(issueFailureHarness.mission)).reason, "task_issue_failed");
  assert.equal(issueFailureHarness.issued.length, 1);
});

test("startup converts an interrupted issue checkpoint into a durable blocked state", () => {
  const harness = createHarness();
  const bound = harness.owner.bind(harness.mission, { items, confirm: true });
  const raw = harness.records.get(bound.id);
  raw.status = "active";
  raw.items[0].status = "issuing";
  raw.items[0].issueCheckpointAt = "2026-08-02T12:00:30.000Z";

  const [reconciled] = harness.owner.reconcileAtStartup();
  assert.equal(reconciled.status, "blocked");
  assert.equal(reconciled.blockedReason, "core_restart_during_task_issue");
  assert.equal(reconciled.items[0].status, "failed");
  assert.equal(reconciled.items[0].terminalTaskStatus, "issue_interrupted");
  assert.equal(reconciled.issuedCount, 0);
  assert.equal(harness.issued.length, 0);
});

test("operator cancellation closes a bound worklist without issuing its pending items", async () => {
  const harness = createHarness();
  harness.owner.bind(harness.mission, { items, confirm: true });
  const closed = harness.owner.closeForMission(harness.mission.id, "mission_cancelled");
  assert.equal(closed.status, "closed");
  assert.equal(closed.blockedReason, "mission_cancelled");

  const prepared = await harness.owner.prepareEpoch(harness.mission);
  assert.equal(prepared.ready, false);
  assert.equal(prepared.reason, "mission_cancelled");
  assert.equal(harness.issued.length, 0);

  const blockedHarness = createHarness({ issueFails: true });
  blockedHarness.owner.bind(blockedHarness.mission, { items, confirm: true });
  const blocked = await blockedHarness.owner.prepareEpoch(blockedHarness.mission);
  assert.equal(blocked.worklist.status, "blocked");
  const closedBlocked = blockedHarness.owner.closeForMission(blockedHarness.mission.id, "mission_cancelled");
  assert.equal(closedBlocked.status, "closed");
  assert.equal(closedBlocked.blockedReason, "mission_cancelled");
  assert.equal(closedBlocked.issuedCount, 0);

  const issuingHarness = createHarness();
  const issuingBound = issuingHarness.owner.bind(issuingHarness.mission, { items, confirm: true });
  const issuingRaw = issuingHarness.records.get(issuingBound.id);
  issuingRaw.status = "active";
  issuingRaw.items[0].status = "issuing";
  issuingRaw.items[0].issueCheckpointAt = "2026-08-02T12:00:30.000Z";
  const closedIssuing = issuingHarness.owner.closeForMission(issuingHarness.mission.id, "mission_cancelled");
  assert.equal(closedIssuing.status, "closed");
  assert.equal(closedIssuing.items[0].status, "failed");
  assert.equal(closedIssuing.items[0].terminalTaskStatus, "issue_interrupted");
  assert.equal(issuingHarness.owner.reconcileAtStartup()[0].status, "closed");
});
