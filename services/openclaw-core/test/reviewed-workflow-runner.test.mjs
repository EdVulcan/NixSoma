import assert from "node:assert/strict";
import test from "node:test";

import { createReviewedWorkflowRunner } from "../src/reviewed-workflow-runner.mjs";
import {
  buildReviewedWorkflowSelection,
  compactReviewedWorkflowOutcome,
} from "../src/reviewed-workflow-selection.mjs";

function createHarness({ invokeResponse = null, cleanup = { ok: true, workView: { visibility: "hidden" } } } = {}) {
  const selection = buildReviewedWorkflowSelection({ workflowId: "bounded_run", goal: "Inspect the form" });
  const task = {
    id: "task-1",
    status: "queued",
    reviewedWorkflowSelection: selection,
  };
  const calls = [];
  const auditEvents = [];
  const taskManager = {
    getTaskById: () => task,
    recordReviewedWorkflowOutcome(candidate, outcome) {
      calls.push({ action: "record_outcome", taskId: candidate.id, outcome });
      candidate.reviewedWorkflowOutcome = outcome;
    },
    completeTask(candidate, details) {
      calls.push({ action: "complete", taskId: candidate.id, details });
      candidate.status = "completed";
      return candidate;
    },
    failTask(candidate, reason, details) {
      calls.push({ action: "fail", taskId: candidate.id, reason, details });
      candidate.status = "failed";
      return candidate;
    },
  };
  const runner = createReviewedWorkflowRunner({
    prepareTask: async (candidate) => {
      calls.push({ action: "prepare", taskId: candidate.id });
      candidate.status = "running";
      return candidate;
    },
    invokeCapability: async (body) => {
      calls.push({ action: "invoke", body });
      return { response: invokeResponse };
    },
    hideWorkView: async (body) => {
      calls.push({ action: "hide", body });
      return cleanup;
    },
    taskManager,
    publishAuditEvent: async (name, payload) => {
      auditEvents.push({ name, payload });
      return { ok: true };
    },
    now: () => "2026-08-04T12:00:00.000Z",
  });
  return { runner, selection, task, calls, auditEvents };
}

function successfulResponse(selection) {
  return {
    ok: true,
    invoked: true,
    blocked: false,
    invocation: { id: "invocation-1" },
    summary: {
      ...compactReviewedWorkflowOutcome({
        selection,
        response: {
          ok: true,
          invoked: true,
          summary: {
            status: "completed",
            taskId: "task-1",
            runCompletionAudit: true,
            providerCallCount: 2,
            actionCount: 2,
            outcomeUnknown: false,
          },
        },
      }),
      status: "completed",
      taskId: "task-1",
      runCompletionAudit: true,
      outcomeUnknown: false,
    },
  };
}

test("runner prepares, invokes exactly the selected capability, cleans up, and completes the task", async () => {
  const harness = createHarness();
  const response = successfulResponse(harness.selection);
  harness.runner = createReviewedWorkflowRunner({
    prepareTask: async (task) => {
      harness.calls.push({ action: "prepare", taskId: task.id });
      task.status = "running";
      return task;
    },
    invokeCapability: async (body) => {
      harness.calls.push({ action: "invoke", body });
      return { response };
    },
    hideWorkView: async (body) => {
      harness.calls.push({ action: "hide", body });
      return { ok: true, workView: { visibility: "hidden" } };
    },
    taskManager: {
      getTaskById: () => harness.task,
      recordReviewedWorkflowOutcome: (task, outcome) => {
        harness.calls.push({ action: "record_outcome", taskId: task.id, outcome });
      },
      completeTask: (task) => {
        harness.calls.push({ action: "complete", taskId: task.id });
        task.status = "completed";
        return task;
      },
      failTask: (task, reason) => {
        harness.calls.push({ action: "fail", taskId: task.id, reason });
        task.status = "failed";
        return task;
      },
    },
    publishAuditEvent: async (name) => {
      harness.auditEvents.push(name);
      return { ok: true };
    },
  });
  const result = await harness.runner.run({
    task: harness.task,
    workflowSelection: harness.selection,
    missionId: "mission-1",
    worklistId: "worklist-1",
    itemId: "item-1",
  });
  assert.equal(result.ok, true);
  assert.equal(harness.task.status, "completed");
  assert.deepEqual(harness.calls.map((call) => call.action), [
    "prepare",
    "invoke",
    "hide",
    "record_outcome",
    "complete",
  ]);
  assert.deepEqual(harness.calls[1].body, {
    capabilityId: "act.ai.workspace.bounded_run",
    taskId: "task-1",
    params: { confirm: true },
  });
  assert.equal(harness.auditEvents.length, 2);
});

test("runner fails closed on cleanup uncertainty and does not retry the provider", async () => {
  const harness = createHarness({ cleanup: { ok: false } });
  const response = successfulResponse(harness.selection);
  harness.runner = createReviewedWorkflowRunner({
    prepareTask: async (task) => { task.status = "running"; return task; },
    invokeCapability: async () => ({ response }),
    hideWorkView: async () => ({ ok: false }),
    taskManager: {
      getTaskById: () => harness.task,
      recordReviewedWorkflowOutcome: () => assert.fail("outcome must not be recorded after uncertain cleanup"),
      completeTask: () => assert.fail("task must not complete after uncertain cleanup"),
      failTask: (task, reason) => { task.status = "failed"; harness.failure = reason; return task; },
    },
    publishAuditEvent: async () => ({ ok: true }),
  });
  const result = await harness.runner.run({ task: harness.task, workflowSelection: harness.selection });
  assert.equal(result.ok, false);
  assert.equal(harness.failure, "reviewed_workflow_cleanup_unknown");
  assert.equal(harness.task.status, "failed");
});
