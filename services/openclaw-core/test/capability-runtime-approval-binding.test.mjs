import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCapabilityApprovalBinding,
  validateCapabilityExecutionApproval,
} from "../src/capability-runtime-approval-binding.mjs";

const capability = {
  id: "act.system.command.execute",
  intents: ["system.command.execute"],
};

function createBoundState({ approvalStatus = "approved" } = {}) {
  const task = {
    id: "task-command-1",
    plan: {
      planId: "plan-command-1",
      steps: [{
        id: "step-command-1",
        phase: "acting_on_target",
        status: "pending",
        capabilityId: capability.id,
        intent: "system.command.execute",
        params: { command: "echo", args: ["approved"] },
      }],
    },
  };
  const approval = {
    id: "approval-command-1",
    taskId: task.id,
    status: approvalStatus,
    binding: buildCapabilityApprovalBinding({ task }),
  };
  task.approval = { requestId: approval.id, status: approval.status };
  return {
    task,
    approval,
    tasks: new Map([[task.id, task]]),
    approvals: new Map([[approval.id, approval]]),
  };
}

function request(overrides = {}) {
  return {
    taskId: "task-command-1",
    stepId: "step-command-1",
    intent: "system.command.execute",
    params: { command: "echo", args: ["approved"] },
    approved: true,
    ...overrides,
  };
}

test("approved flag alone cannot authorize a server capability", () => {
  const result = validateCapabilityExecutionApproval({
    capability,
    request: { approved: true, params: { command: "echo", args: ["arbitrary"] } },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "approval_task_required");
});

test("pending approval cannot authorize a capability step", () => {
  const state = createBoundState({ approvalStatus: "pending" });
  const result = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "approval_not_granted");
});

test("an approved task rejects changed capability parameters", () => {
  const state = createBoundState();
  const result = validateCapabilityExecutionApproval({
    capability,
    request: request({ params: { command: "echo", args: ["changed"] } }),
    ...state,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "approval_request_mismatch");
});

test("an exact approved task step is reserved once and cannot be replayed", () => {
  const state = createBoundState();
  let persisted = 0;
  const first = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    persistState: () => { persisted += 1; },
    reserve: true,
    ...state,
  });

  assert.equal(first.ok, true);
  assert.equal(first.approved, true);
  assert.equal(first.reservation.stepId, "step-command-1");
  assert.equal(state.task.plan.steps[0].status, "running");
  assert.equal(persisted, 1);

  const replay = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "approval_step_already_consumed");

  state.task.plan.steps[0].status = "completed";
  const completedReplay = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });
  assert.equal(completedReplay.ok, false);
  assert.equal(completedReplay.reason, "approval_step_completed");
});

test("approved binding rejects a plan step changed after approval", () => {
  const state = createBoundState();
  state.task.plan.steps[0].params.args = ["changed-after-approval"];
  const result = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "approval_plan_step_changed");
});
