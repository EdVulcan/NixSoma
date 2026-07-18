import test from "node:test";
import assert from "node:assert/strict";

import {
  abortCapabilityExecutionReservation,
  buildCapabilityApprovalBinding,
  buildCapabilityRequestBindingHash,
  commitCapabilityExecutionReservation,
  recoverCapabilityExecutionReservations,
  startCapabilityExecutionReservation,
  validateCapabilityExecutionApproval,
} from "../src/capability-runtime-approval-binding.mjs";
import {
  buildWorkspaceCommandAutonomousGrant,
} from "../src/workspace-command-autonomy.mjs";

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

test("a bounded sovereign validation grant authorizes the exact command without an approval record", () => {
  const params = {
    command: "npm",
    args: ["run", "typecheck"],
    cwd: "/repo",
    timeoutMs: 120000,
  };
  const task = {
    id: "task-autonomous-validation-1",
    type: "system_task",
    workViewStrategy: "workspace-command",
    policy: {
      decision: {
        decision: "audit_only",
        domain: "body_internal",
        risk: "low",
        autonomyMode: "sovereign_body",
        autonomous: true,
      },
      request: { requiresApproval: false },
    },
    plan: {
      planId: "plan-autonomous-validation-1",
      steps: [{
        id: "step-autonomous-validation-1",
        phase: "acting_on_target",
        status: "pending",
        capabilityId: capability.id,
        intent: "system.command.execute",
        params,
      }],
    },
  };
  const requestHash = buildCapabilityRequestBindingHash({
    capabilityId: capability.id,
    intent: "system.command.execute",
    params,
  });
  task.plan.steps[0].autonomousExecution = buildWorkspaceCommandAutonomousGrant({
    proposal: {
      workspaceId: "openclaw",
      workspacePath: "/repo",
      scriptName: "typecheck",
      category: "validation",
      packageManager: "npm",
      command: "npm",
      args: ["run", "typecheck"],
      cwd: "/repo",
      risk: "low",
      usesShell: false,
    },
    requestHash,
  });
  const state = {
    tasks: new Map([[task.id, task]]),
    approvals: new Map(),
  };
  const verificationTrigger = {
    registry: "openclaw-workspace-mutation-verification-trigger-v0",
    sourceTaskId: "source-mutation-task-1",
    mutationHash: "a".repeat(64),
  };
  task.verificationTrigger = verificationTrigger;
  task.plan.steps[0].autonomousExecution = buildWorkspaceCommandAutonomousGrant({
    proposal: {
      workspaceId: "openclaw",
      workspacePath: "/repo",
      scriptName: "typecheck",
      category: "validation",
      packageManager: "npm",
      command: "npm",
      args: ["run", "typecheck"],
      cwd: "/repo",
      risk: "low",
      usesShell: false,
    },
    requestHash,
    verificationTrigger,
  });

  const result = validateCapabilityExecutionApproval({
    capability,
    request: {
      taskId: task.id,
      stepId: task.plan.steps[0].id,
      intent: "system.command.execute",
      params,
      approved: false,
    },
    ...state,
  });

  assert.equal(result.ok, true);
  assert.equal(result.required, false);
  assert.equal(result.approved, true);
  assert.equal(result.bindingHash, requestHash);

  task.verificationTrigger = {
    ...verificationTrigger,
    mutationHash: "b".repeat(64),
  };
  const mismatch = validateCapabilityExecutionApproval({
    capability,
    request: {
      taskId: task.id,
      stepId: task.plan.steps[0].id,
      intent: "system.command.execute",
      params,
      approved: false,
    },
    ...state,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, "autonomous_execution_verification_trigger_mismatch");
});

test("a sovereign validation grant fails closed when command parameters change", () => {
  const params = {
    command: "npm",
    args: ["run", "typecheck"],
    cwd: "/repo",
    timeoutMs: 120000,
  };
  const task = {
    id: "task-autonomous-validation-2",
    type: "system_task",
    workViewStrategy: "workspace-command",
    policy: {
      request: { requiresApproval: false },
      decision: { decision: "audit_only", domain: "body_internal", risk: "low", autonomyMode: "sovereign_body", autonomous: true },
    },
    plan: {
      planId: "plan-autonomous-validation-2",
      steps: [{
        id: "step-autonomous-validation-2",
        phase: "acting_on_target",
        status: "pending",
        capabilityId: capability.id,
        intent: "system.command.execute",
        params,
        autonomousExecution: {
          registry: "openclaw-workspace-command-autonomous-execution-v0",
          mode: "sovereign_body_audit_only",
          owner: "workspace-command-task-v0",
          capabilityId: capability.id,
          requestHash: "bound-to-typecheck",
          workspaceId: "openclaw",
          workspacePath: "/repo",
          scriptName: "typecheck",
          packageManager: "npm",
          command: "npm",
          args: ["run", "typecheck"],
          cwd: "/repo",
          usesShell: false,
        },
      }],
    },
  };
  const result = validateCapabilityExecutionApproval({
    capability,
    request: {
      taskId: task.id,
      stepId: task.plan.steps[0].id,
      intent: "system.command.execute",
      params: { ...params, args: ["run", "lint"] },
      approved: false,
    },
    tasks: new Map([[task.id, task]]),
    approvals: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "autonomous_execution_request_mismatch");
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
