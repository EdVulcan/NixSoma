import test from "node:test";
import assert from "node:assert/strict";

import {
  HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  hashManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY,
  HOSTD_ROLLBACK_OPERATION,
  HOSTD_ROLLBACK_RECEIPT_REGISTRY,
  hashManagedConfigRollbackReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import { NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE } from "../src/native-declarative-evolution-activation.mjs";
import { NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE } from "../src/native-declarative-evolution-rollback.mjs";
import { createNativeDeclarativeEvolutionRollbackTaskHandlers } from "../src/task-executor-native-declarative-evolution-rollback-handlers.mjs";

const candidateHash = "a".repeat(64);
const previousGenerationPath = "/nix/store/old123-nixos-system-nixos-test";
const activatedGenerationPath = "/nix/store/new123-nixos-system-nixos-test";

function createActivationReceipt() {
  const receipt = {
    registry: HOSTD_ACTIVATION_RECEIPT_REGISTRY,
    version: 1,
    receiptId: "activation-receipt-1",
    requestId: "activation-request-1",
    operation: HOSTD_ACTIVATION_OPERATION,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
    candidateHash,
    candidateBytes: 64,
    evaluatedClosurePath: activatedGenerationPath,
    sourceStagingTaskId: "task-staging",
    activationTaskId: "task-activation",
    activationDecisionTaskId: "task-decision",
    rollbackSnapshotId: "activation-request-1",
    previousTargetPresent: false,
    previousTargetHash: null,
    previousGenerationPath,
    activatedGenerationPath,
    activatedProfilePath: activatedGenerationPath,
    helperEvidence: {
      registry: HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
      candidateHash,
      evaluatedClosurePath: activatedGenerationPath,
      rollbackSnapshotId: "activation-request-1",
      previousTargetPresent: false,
      previousTargetHash: null,
      generationBefore: previousGenerationPath,
      generationAfter: activatedGenerationPath,
      profileAfter: activatedGenerationPath,
      targetHashAfter: candidateHash,
      targetInstalled: true,
      rollbackExecuted: false,
    },
    command: null,
    status: "passed",
    activationExecuted: true,
    generationSwitched: true,
    rollbackExecuted: false,
    startedAt: "2026-07-30T10:00:00.000Z",
    completedAt: "2026-07-30T10:00:01.000Z",
    result: { exitCode: 0, stdout: "", stderr: "" },
    error: null,
  };
  return { ...receipt, receiptHash: hashManagedConfigActivationReceipt(receipt) };
}

function createRollbackReceipt({ taskId, activationReceipt }) {
  const receipt = {
    registry: HOSTD_ROLLBACK_RECEIPT_REGISTRY,
    version: 1,
    receiptId: "rollback-receipt-1",
    requestId: "rollback-request-1",
    operation: HOSTD_ROLLBACK_OPERATION,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    activationTaskId: "task-activation",
    rollbackTaskId: taskId,
    activationReceiptHash: activationReceipt.receiptHash,
    rollbackSnapshotId: "activation-request-1",
    candidateHash,
    previousGenerationPath,
    activatedGenerationPath,
    previousTargetPresent: false,
    previousTargetHash: null,
    helperEvidence: {
      registry: HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY,
      rollbackSnapshotId: "activation-request-1",
      candidateHash,
      generationBefore: activatedGenerationPath,
      profileBefore: activatedGenerationPath,
      generationAfter: previousGenerationPath,
      profileAfter: previousGenerationPath,
      targetHashBefore: candidateHash,
      previousTargetPresent: false,
      previousTargetHash: null,
      targetPresentAfter: false,
      targetHashAfter: null,
      rollbackExecuted: true,
      snapshotConsumed: true,
    },
    command: null,
    status: "passed",
    rollbackExecuted: true,
    generationRestored: true,
    snapshotConsumed: true,
    startedAt: "2026-07-30T10:03:00.000Z",
    completedAt: "2026-07-30T10:03:01.000Z",
    result: { exitCode: 0, stdout: "", stderr: "" },
    error: null,
  };
  return { ...receipt, receiptHash: hashManagedConfigRollbackReceipt(receipt) };
}

function createHarness({
  approved = true,
  tamperActivation = false,
  activationHealthDegraded = false,
  postRollbackHealth = { status: "healthy", hostHealthHash: "c".repeat(64) },
} = {}) {
  const activationReceipt = createActivationReceipt();
  const activationTask = {
    id: "task-activation",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
    status: activationHealthDegraded ? "failed" : "completed",
    outcome: activationHealthDegraded
      ? { kind: "failed", reason: "post_activation_health_degraded" }
      : null,
    nativeDeclarativeEvolution: {
      execution: {
        status: activationHealthDegraded ? "failed" : "passed",
        executionReceipt: activationReceipt,
        postActivationHealth: { status: activationHealthDegraded ? "degraded" : "healthy" },
      },
    },
  };
  const binding = {
    kind: "native_declarative_evolution_rollback",
    activationTaskId: activationTask.id,
    activationReceiptHash: activationReceipt.receiptHash,
    rollbackSnapshotId: activationReceipt.rollbackSnapshotId,
    candidateHash,
    previousGenerationPath,
    activatedGenerationPath,
    previousTargetPresent: false,
    previousTargetHash: null,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const task = {
    id: "task-rollback",
    type: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE,
    status: "queued",
    plan: { strategy: "native-declarative-evolution-rollback-v0" },
    policy: { decision: { decision: "require_approval", approved: true } },
    approval: { requestId: "approval-rollback", status: approved ? "approved" : "pending" },
    nativeDeclarativeEvolution: { rollback: binding, governance: {} },
  };
  const tasks = new Map([[activationTask.id, activationTask], [task.id, task]]);
  if (tamperActivation) activationReceipt.receiptHash = "f".repeat(64);
  const approvals = new Map([["approval-rollback", {
    id: "approval-rollback",
    status: approved ? "approved" : "pending",
    binding,
  }]]);
  const events = [];
  let hostdCalls = 0;
  const handlers = createNativeDeclarativeEvolutionRollbackTaskHandlers({
    state: { approvals, tasks, HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock" },
    taskManager: {
      serialiseTask: (value) => value,
      isActiveTask: () => true,
      getTaskById: (id) => tasks.get(id) ?? null,
      setTaskPhase: async (value, phase, options) => {
        value.status = options.status;
        value.executionPhase = phase;
        return value;
      },
      completeTask: (value, details) => {
        value.status = "completed";
        value.outcome = { kind: "completed", details };
        return value;
      },
      failTask: (value, reason, details) => {
        value.status = "failed";
        value.outcome = { kind: "failed", reason, details };
        return value;
      },
    },
    approvalEngine: { serialiseApproval: (value) => value },
    policyEvaluator: {
      ensureTaskPolicy: (value) => value.policy,
      isPolicyExecutionAllowed: () => true,
    },
    planBuilder: { readNativeDeclarativeEvolutionHostHealth: async () => postRollbackHealth },
    hostdRollbackClient: async (input) => {
      hostdCalls += 1;
      assert.equal(input.activationReceiptHash, binding.activationReceiptHash);
      assert.equal(input.previousGenerationPath, previousGenerationPath);
      return { ok: true, requestId: "rollback-request-1", receipt: createRollbackReceipt({ taskId: task.id, activationReceipt }) };
    },
    publishEvent: async (name, body) => events.push({ name, body }),
  });
  return { handlers, task, events, getHostdCalls: () => hostdCalls };
}

test("approved rollback executes one fixed hostd call and binds independent post-health", async () => {
  const harness = createHarness();
  const result = await harness.handlers[0].execute(harness.task);

  assert.equal(result.task.status, "completed");
  assert.equal(result.rollback.governance.executesRollback, true);
  assert.equal(result.rollback.rollbackReceipt.generationRestored, true);
  assert.equal(result.rollback.rollbackReceipt.snapshotConsumed, true);
  assert.equal(result.postRollbackHealth.status, "healthy");
  assert.equal(harness.getHostdCalls(), 1);
  assert.equal(harness.events.filter((event) => event.name === "task.completed").length, 1);
});

test("approved rollback recovers a switched activation that failed post-activation health", async () => {
  const harness = createHarness({ activationHealthDegraded: true });
  const result = await harness.handlers[0].execute(harness.task);

  assert.equal(result.task.status, "completed");
  assert.equal(result.rollback.rollbackReceipt.generationRestored, true);
  assert.equal(harness.getHostdCalls(), 1);
});

test("rollback does not call hostd without approval or after activation receipt changes", async () => {
  const pending = createHarness({ approved: false });
  const pendingResult = await pending.handlers[0].execute(pending.task);
  assert.equal(pendingResult.blocked, true);
  assert.equal(pending.getHostdCalls(), 0);

  const tampered = createHarness({ tamperActivation: true });
  const tamperedResult = await tampered.handlers[0].execute(tampered.task);
  assert.equal(tamperedResult.task.status, "failed");
  assert.equal(tamperedResult.reason, "activation_receipt_changed_before_rollback");
  assert.equal(tampered.getHostdCalls(), 0);
});

test("successful rollback with degraded independent health remains a failed task without retry", async () => {
  const harness = createHarness({ postRollbackHealth: { status: "degraded", hostHealthHash: "d".repeat(64) } });
  const result = await harness.handlers[0].execute(harness.task);
  assert.equal(result.task.status, "failed");
  assert.equal(result.reason, "post_rollback_health_degraded");
  assert.equal(result.rollbackReceipt.rollbackExecuted, true);
  assert.equal(harness.getHostdCalls(), 1);
});
