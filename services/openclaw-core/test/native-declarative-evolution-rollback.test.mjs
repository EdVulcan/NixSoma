import test from "node:test";
import assert from "node:assert/strict";

import {
  HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  hashManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE } from "../src/native-declarative-evolution-activation.mjs";
import {
  createNativeDeclarativeEvolutionRollbackBuilders,
  NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE,
} from "../src/native-declarative-evolution-rollback.mjs";

const candidateHash = "a".repeat(64);
const previousGenerationPath = "/nix/store/old123-nixos-system-nixos-test";
const activatedGenerationPath = "/nix/store/new123-nixos-system-nixos-test";

function activationReceipt() {
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

function createHarness() {
  const receipt = activationReceipt();
  const activationTask = {
    id: "task-activation",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
    status: "completed",
    nativeDeclarativeEvolution: {
      execution: { status: "passed", executionReceipt: receipt, postActivationHealth: { status: "healthy" } },
    },
  };
  const tasks = new Map([[activationTask.id, activationTask]]);
  const events = [];
  const builders = createNativeDeclarativeEvolutionRollbackBuilders({
    tasks,
    autonomyMode: "guardian",
    evaluatePolicyIntent: () => ({ decision: "require_approval", approved: false }),
    createTask: (input) => {
      const task = { id: "task-rollback", status: "queued", ...input };
      tasks.set(task.id, task);
      return task;
    },
    createApprovalRequestForTask: (task) => {
      task.approval = { id: "approval-rollback", requestId: "approval-rollback", status: "pending", binding: task.nativeDeclarativeEvolution.approvalBinding };
      return task.approval;
    },
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: () => {},
    persistState: () => {},
    publishEvent: async (name, body) => events.push({ name, body }),
    publishTaskApprovalIfPending: async () => {},
    serialiseTask: (task) => task,
    serialisePlanForPublic: (plan) => plan,
    now: () => "2026-07-30T10:02:00.000Z",
  });
  return { builders, activationTask, receipt, events };
}

test("rollback task builder binds only one verified activation receipt and exact previous generation", async () => {
  const { builders, receipt, events } = createHarness();
  await assert.rejects(
    () => builders.createNativeDeclarativeEvolutionRollbackTask({ activationTaskId: "task-activation", confirm: false }),
    /requires confirm=true/,
  );
  const result = await builders.createNativeDeclarativeEvolutionRollbackTask({ activationTaskId: "task-activation", confirm: true });

  assert.equal(result.registry, NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY);
  assert.equal(result.task.type, NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE);
  assert.equal(result.approvalBinding.activationReceiptHash, receipt.receiptHash);
  assert.equal(result.approvalBinding.rollbackSnapshotId, "activation-request-1");
  assert.equal(result.approvalBinding.previousGenerationPath, previousGenerationPath);
  assert.equal(result.approvalBinding.activatedGenerationPath, activatedGenerationPath);
  assert.equal(result.governance.rollbackOwner, "openclaw-hostd");
  assert.equal(result.governance.automaticRollback, false);
  assert.equal(result.governance.arbitraryGeneration, false);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("rollback task builder accepts a switched activation that failed only post-activation health", async () => {
  const { builders, activationTask, receipt } = createHarness();
  activationTask.status = "failed";
  activationTask.outcome = { kind: "failed", reason: "post_activation_health_degraded" };
  activationTask.nativeDeclarativeEvolution.execution.status = "failed";
  activationTask.nativeDeclarativeEvolution.execution.postActivationHealth = { status: "degraded" };

  const draft = await builders.buildNativeDeclarativeEvolutionRollbackTaskDraft({ activationTaskId: activationTask.id });
  assert.equal(draft.approvalBinding.activationReceiptHash, receipt.receiptHash);
  assert.equal(draft.approvalBinding.previousGenerationPath, previousGenerationPath);
});

test("rollback task builder rejects changed or unrelated failed activation evidence", async () => {
  const { builders, activationTask } = createHarness();
  activationTask.nativeDeclarativeEvolution.execution.executionReceipt.receiptHash = "f".repeat(64);
  await assert.rejects(
    () => builders.buildNativeDeclarativeEvolutionRollbackTaskDraft({ activationTaskId: activationTask.id }),
    /verified switched activation receipt/,
  );

  const unrelatedFailure = createHarness();
  unrelatedFailure.activationTask.status = "failed";
  unrelatedFailure.activationTask.outcome = { kind: "failed", reason: "hostd_activation_failed" };
  unrelatedFailure.activationTask.nativeDeclarativeEvolution.execution.status = "failed";
  await assert.rejects(
    () => unrelatedFailure.builders.buildNativeDeclarativeEvolutionRollbackTaskDraft({ activationTaskId: unrelatedFailure.activationTask.id }),
    /verified switched activation receipt/,
  );
});
