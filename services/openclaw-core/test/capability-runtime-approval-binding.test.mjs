import test from "node:test";
import assert from "node:assert/strict";

import {
  abortCapabilityExecutionReservation,
  buildCapabilityApprovalBinding,
  commitCapabilityExecutionReservation,
  recoverCapabilityExecutionReservations,
  startCapabilityExecutionReservation,
  validateCapabilityExecutionApproval,
} from "../src/capability-runtime-approval-binding.mjs";

const capability = {
  id: "act.system.command.execute",
  intents: ["system.command.execute"],
  governance: "require_approval",
  requiresApproval: true,
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
        governance: "require_approval",
        requiresApproval: true,
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

test("an exact approved task step reserves, starts, commits, and cannot be replayed", () => {
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
  assert.equal(first.reservation.status, "reserved");
  assert.equal(first.reservation.stepId, "step-command-1");
  assert.equal(state.task.plan.steps[0].status, "reserved");
  assert.equal(persisted, 1);

  const replay = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "approval_step_already_consumed");

  const started = startCapabilityExecutionReservation({
    request: { ...request(), serverApproval: first },
    ...state,
    persistState: () => { persisted += 1; },
  });
  assert.equal(started.ok, true);
  assert.equal(started.reservation.status, "running");
  assert.equal(state.task.plan.steps[0].status, "running");

  const committed = commitCapabilityExecutionReservation({
    request: { ...request(), serverApproval: started },
    ...state,
    persistState: () => { persisted += 1; },
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.reservation.status, "committed");
  assert.equal(state.task.plan.steps[0].status, "completed");

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

test("aborting a reserved execution releases the step without changing its approval binding", () => {
  const state = createBoundState();
  const reserved = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    reserve: true,
    ...state,
  });
  const aborted = abortCapabilityExecutionReservation({
    request: { ...request(), serverApproval: reserved },
    ...state,
  });

  assert.equal(aborted.ok, true);
  assert.equal(aborted.reservation.status, "aborted");
  assert.equal(state.task.plan.steps[0].status, "pending");
  assert.equal(state.task.plan.steps[0].executionReservation, null);
  const retry = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    ...state,
  });
  assert.equal(retry.ok, true);
});

test("expired reservations are released before start and restart recovery fails running work closed", () => {
  const state = createBoundState();
  const reserved = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    reserve: true,
    now: () => "2026-07-08T00:00:00.000Z",
    reservationTtlMs: 10,
    ...state,
  });
  const expiredCheck = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    now: () => "2026-07-08T00:00:00.020Z",
    reservationTtlMs: 10,
    ...state,
  });
  assert.equal(expiredCheck.ok, true);
  assert.equal(state.task.plan.steps[0].status, "pending");

  const running = validateCapabilityExecutionApproval({
    capability,
    request: request(),
    reserve: true,
    now: () => "2026-07-08T00:00:00.000Z",
    ...state,
  });
  const started = startCapabilityExecutionReservation({
    request: { ...request(), serverApproval: running },
    now: () => "2026-07-08T00:00:00.001Z",
    ...state,
  });
  assert.equal(started.ok, true);
  const recovered = recoverCapabilityExecutionReservations({
    now: () => "2026-07-08T00:00:01.000Z",
    ...state,
  });
  assert.equal(recovered.length, 1);
  assert.equal(state.task.plan.steps[0].status, "failed");
  assert.equal(state.task.plan.steps[0].executionReceipt.status, "recovered_aborted");
  assert.equal(reserved.reservation.status, "reserved");
});
