import assert from "node:assert/strict";
import test from "node:test";

import { createReviewedBrowserTaskOwner } from "../src/reviewed-browser-task-owner.mjs";

function createHarness() {
  const events = [];
  const inputs = [];
  const approvals = [];
  const taskManager = {
    createTask(input) {
      inputs.push(input);
      return { id: `task-${inputs.length}`, status: "queued", plan: { steps: [] } };
    },
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: () => {},
    serialiseTask: (task) => ({ ...task, public: true }),
  };
  const owner = createReviewedBrowserTaskOwner({
    taskManager,
    approvalEngine: {
      publishTaskApprovalIfPending: async (task) => { approvals.push(task.id); },
    },
    planBuilder: {
      serialisePlanForPublic: (plan) => ({ ...plan, public: true }),
    },
    publishEvent: async (type, payload) => { events.push({ type, payload }); },
  });
  return { owner, events, inputs, approvals };
}

test("reviewed task owner keeps direct reviewed creation on one event path", async () => {
  const harness = createHarness();
  const result = await harness.owner.create({
    goal: "Inspect the reviewed customer page",
    targetUrl: "https://example.com/customer",
    includePlan: true,
  });

  assert.equal(result.task.id, "task-1");
  assert.equal(result.publicTask.public, true);
  assert.equal(result.plan.public, true);
  assert.equal(result.review.governance.startsExecution, false);
  assert.deepEqual(harness.approvals, ["task-1"]);
  assert.deepEqual(harness.events.map((event) => event.type), ["task.created", "task.planned"]);
  assert.equal(harness.events[0].payload.reviewedSource, null);
});

test("reviewed task owner binds compact worklist provenance before creating a task", async () => {
  const harness = createHarness();
  const source = {
    registry: "nixsoma-reviewed-finite-mission-worklist-v0",
    worklistId: "worklist-1",
    missionId: "mission-1",
    itemId: "item-1",
    itemOrdinal: 1,
    blueprintHash: "a".repeat(64),
  };
  const result = await harness.owner.create({
    goal: "Inspect item one",
    targetUrl: "https://example.com/one",
    includePlan: true,
  }, { source });

  assert.deepEqual(result.reviewedSource, source);
  assert.deepEqual(harness.events.map((event) => event.payload.reviewedSource), [source, source]);
  assert.deepEqual(Object.keys(result.reviewedSource).sort(), [
    "blueprintHash",
    "itemId",
    "itemOrdinal",
    "missionId",
    "registry",
    "worklistId",
  ]);
});

test("reviewed task owner rejects invalid worklist provenance before task creation", async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.owner.create({
      goal: "Inspect invalid source",
      targetUrl: "https://example.com/invalid",
      includePlan: true,
    }, {
      source: {
        registry: "nixsoma-reviewed-finite-mission-worklist-v0",
        worklistId: "worklist-1",
        missionId: "mission-1",
        itemId: "item-1",
        itemOrdinal: 1,
        blueprintHash: "not-a-hash",
      },
    }),
    /source receipt is invalid/u,
  );
  assert.equal(harness.inputs.length, 0);
  assert.equal(harness.events.length, 0);
});
