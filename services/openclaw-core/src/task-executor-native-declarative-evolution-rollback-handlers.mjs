import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildCapabilityRequestBindingHash } from "./capability-runtime-approval-binding.mjs";
import { validateManagedConfigActivationReceipt } from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { validateManagedConfigRollbackReceipt } from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
} from "./native-declarative-evolution-activation.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID,
  isRollbackEligibleNativeDeclarativeEvolutionActivationTask,
  isNativeDeclarativeEvolutionRollbackTask,
} from "./native-declarative-evolution-rollback.mjs";

const EXECUTION_REGISTRY = "openclaw-native-declarative-evolution-rollback-execution-v0";

function expectedBinding(task) {
  const binding = task?.nativeDeclarativeEvolution?.rollback ?? {};
  return {
    kind: "native_declarative_evolution_rollback",
    activationTaskId: binding.activationTaskId ?? null,
    activationReceiptHash: binding.activationReceiptHash ?? null,
    rollbackSnapshotId: binding.rollbackSnapshotId ?? null,
    candidateHash: binding.candidateHash ?? null,
    previousGenerationPath: binding.previousGenerationPath ?? null,
    activatedGenerationPath: binding.activatedGenerationPath ?? null,
    previousTargetPresent: binding.previousTargetPresent ?? null,
    previousTargetHash: binding.previousTargetHash ?? null,
    targetPath: binding.targetPath ?? null,
    expiresAt: binding.expiresAt ?? null,
  };
}

function approvalMatchesBinding(task, approval) {
  const expected = expectedBinding(task);
  if (Object.entries(expected).every(([key, value]) => approval?.binding?.[key] === value)) return true;
  const binding = approval?.binding;
  const step = (Array.isArray(task?.plan?.steps) ? task.plan.steps : [])
    .find((candidate) => candidate?.capabilityId === NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID
      && (candidate.requiresApproval === true || candidate.governance === "require_approval"));
  if (binding?.registry !== "openclaw-capability-execution-approval-binding-v1"
    || binding.planId !== task?.plan?.planId
    || !step) return false;
  const requestHash = buildCapabilityRequestBindingHash({
    capabilityId: step.capabilityId,
    intent: step.intent ?? step.kind ?? null,
    params: step.params ?? {},
  });
  return binding.steps?.some((boundStep) => boundStep.stepId === step.id
    && boundStep.capabilityId === NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID
    && boundStep.requestHash === requestHash) === true;
}

function receiptMatchesBinding(receipt, expected, activationTask) {
  return validateManagedConfigActivationReceipt(receipt)
    && receipt.status === "passed"
    && receipt.activationTaskId === expected.activationTaskId
    && receipt.activationTaskId === activationTask?.id
    && receipt.receiptHash === expected.activationReceiptHash
    && receipt.rollbackSnapshotId === expected.rollbackSnapshotId
    && receipt.candidateHash === expected.candidateHash
    && receipt.previousGenerationPath === expected.previousGenerationPath
    && receipt.activatedGenerationPath === expected.activatedGenerationPath
    && receipt.previousTargetPresent === expected.previousTargetPresent
    && receipt.previousTargetHash === expected.previousTargetHash
    && receipt.targetPath === expected.targetPath
    && receipt.rollbackExecuted === false;
}

function compactHealth(health) {
  return {
    registry: health?.registry ?? null,
    owner: health?.owner ?? null,
    status: health?.status ?? null,
    observedAt: health?.observedAt ?? null,
    hostHealthHash: health?.hostHealthHash ?? null,
    serviceCount: health?.serviceCount ?? null,
    onlineServiceCount: health?.onlineServiceCount ?? null,
    degradedServiceCount: health?.degradedServiceCount ?? null,
    alertCount: health?.alertCount ?? null,
    networkOnline: health?.networkOnline ?? null,
    failedChecks: Array.isArray(health?.failedChecks) ? health.failedChecks.slice(0, 16) : [],
    authority: health?.authority ?? null,
  };
}

export function createNativeDeclarativeEvolutionRollbackTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  hostdRollbackClient,
  publishEvent,
}) {
  const { approvals, tasks, HOSTD_SOCKET_PATH } = state;
  const { serialiseTask, isActiveTask, setTaskPhase, completeTask, failTask, getTaskById } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy, isPolicyExecutionAllowed } = policyEvaluator;

  const findTask = (taskId) => typeof getTaskById === "function"
    ? getTaskById(taskId)
    : tasks instanceof Map ? tasks.get(taskId) ?? null : null;

  async function finishFailure(task, reason, details = {}) {
    const failedTask = failTask(task, reason, { executor: EXECUTION_REGISTRY, ...details });
    await publishEvent(createEventName("task.failed"), { task: serialiseTask(failedTask), reason, executor: EXECUTION_REGISTRY });
    return {
      task: failedTask,
      blocked: false,
      reason,
      actions: [],
      capabilityInvocations: [],
      verification: { ok: false, checks: [], failedChecks: [{ name: reason }] },
      policy: details.policy ?? task.policy?.decision ?? null,
      approval: details.approval ?? null,
      rollbackReceipt: details.rollbackReceipt ?? null,
      postRollbackHealth: details.postRollbackHealth ?? null,
    };
  }

  async function executeNativeDeclarativeEvolutionRollbackTask(task) {
    if (!isActiveTask(task)) throw new Error("Native declarative evolution rollback task is not active.");
    const policy = ensureTaskPolicy(task, { stage: "declarative_evolution.rollback.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    if (policy.decision?.decision === "deny") return finishFailure(task, "policy_denied", { policy: policy.decision });

    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const approvalEvidence = approval ? serialiseApproval(approval) : null;
    if (!approval || approval.status !== "approved") {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: { executor: EXECUTION_REGISTRY, reason: "policy_requires_approval", approvalId: approval?.id ?? task.approval?.requestId ?? null },
      });
      await publishEvent(createEventName("task.blocked"), { task: serialiseTask(waitingTask), reason: "policy_requires_approval", executor: EXECUTION_REGISTRY });
      return { task: waitingTask, blocked: true, reason: "policy_requires_approval", actions: [], capabilityInvocations: [], verification: null, policy: policy.decision, approval: approvalEvidence };
    }
    if (!approvalMatchesBinding(task, approval)) {
      return finishFailure(task, "rollback_approval_binding_mismatch", { policy: policy.decision, approval: approvalEvidence });
    }
    if (!isPolicyExecutionAllowed(policy.decision)) {
      return finishFailure(task, "policy_blocked", { policy: policy.decision, approval: approvalEvidence });
    }

    const expected = expectedBinding(task);
    const activationTask = findTask(expected.activationTaskId);
    const activationReceipt = activationTask?.nativeDeclarativeEvolution?.execution?.executionReceipt;
    if (!isRollbackEligibleNativeDeclarativeEvolutionActivationTask(activationTask, activationReceipt)
      || activationTask.type !== NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE
      || !receiptMatchesBinding(activationReceipt, expected, activationTask)) {
      return finishFailure(task, "activation_receipt_changed_before_rollback", { policy: policy.decision, approval: approvalEvidence });
    }
    if (typeof hostdRollbackClient !== "function" || typeof HOSTD_SOCKET_PATH !== "string" || !HOSTD_SOCKET_PATH) {
      return finishFailure(task, "hostd_rollback_unconfigured", { policy: policy.decision, approval: approvalEvidence });
    }

    await setTaskPhase(task, "rolling_back_managed_config", {
      status: "running",
      details: {
        executor: EXECUTION_REGISTRY,
        activationTaskId: expected.activationTaskId,
        activationReceiptHash: expected.activationReceiptHash,
        hostMutationAttempted: true,
        automaticRollback: false,
      },
    });

    let response;
    try {
      response = await hostdRollbackClient({
        socketPath: HOSTD_SOCKET_PATH,
        activationTaskId: expected.activationTaskId,
        rollbackTaskId: task.id,
        activationReceiptHash: expected.activationReceiptHash,
        rollbackSnapshotId: expected.rollbackSnapshotId,
        candidateHash: expected.candidateHash,
        previousGenerationPath: expected.previousGenerationPath,
        activatedGenerationPath: expected.activatedGenerationPath,
        previousTargetPresent: expected.previousTargetPresent,
        previousTargetHash: expected.previousTargetHash,
        expiresAt: expected.expiresAt,
      });
    } catch (error) {
      return finishFailure(task, "hostd_rollback_request_failed", {
        policy: policy.decision,
        approval: approvalEvidence,
        error: error instanceof Error ? error.message : "Hostd rollback request failed.",
      });
    }

    const receipt = response?.receipt;
    if (!validateManagedConfigRollbackReceipt(receipt)
      || receipt.requestId !== response.requestId
      || receipt.rollbackTaskId !== task.id
      || receipt.activationTaskId !== expected.activationTaskId
      || receipt.activationReceiptHash !== expected.activationReceiptHash
      || receipt.rollbackSnapshotId !== expected.rollbackSnapshotId) {
      return finishFailure(task, "invalid_hostd_rollback_receipt", { policy: policy.decision, approval: approvalEvidence, rollbackReceipt: receipt ?? null });
    }

    const postRollbackHealth = typeof planBuilder.readNativeDeclarativeEvolutionHostHealth === "function"
      ? await planBuilder.readNativeDeclarativeEvolutionHostHealth()
      : null;
    const rollbackPassed = response.ok === true
      && receipt.status === "passed"
      && receipt.rollbackExecuted === true
      && receipt.generationRestored === true
      && receipt.snapshotConsumed === true;
    const healthPassed = postRollbackHealth?.status === "healthy";
    const execution = {
      registry: EXECUTION_REGISTRY,
      status: rollbackPassed && healthPassed ? "passed" : "failed",
      activationTaskId: expected.activationTaskId,
      activationReceiptHash: expected.activationReceiptHash,
      rollbackSnapshotId: expected.rollbackSnapshotId,
      candidateHash: expected.candidateHash,
      restoredGenerationPath: expected.previousGenerationPath,
      replacedGenerationPath: expected.activatedGenerationPath,
      previousTargetPresent: expected.previousTargetPresent,
      previousTargetHash: expected.previousTargetHash,
      rollbackReceipt: receipt,
      postRollbackHealth: compactHealth(postRollbackHealth),
      governance: {
        writesManagedConfig: true,
        switchesGeneration: receipt.generationRestored === true,
        executesRollback: receipt.rollbackExecuted === true,
        automaticRollback: false,
        arbitraryGeneration: false,
        arbitraryCommand: false,
        rollbackAuthority: "openclaw-hostd",
        healthOracle: postRollbackHealth?.registry ?? null,
        healthOracleOwner: postRollbackHealth?.owner ?? null,
      },
    };
    task.nativeDeclarativeEvolution.execution = execution;
    task.nativeDeclarativeEvolution.governance = {
      ...task.nativeDeclarativeEvolution.governance,
      executed: true,
      rollbackExecuted: execution.governance.executesRollback,
      generationRestored: receipt.generationRestored === true,
      snapshotConsumed: receipt.snapshotConsumed === true,
      postRollbackHealthBound: postRollbackHealth !== null,
    };
    if (!rollbackPassed) {
      return finishFailure(task, "hostd_rollback_failed", { policy: policy.decision, approval: approvalEvidence, rollbackReceipt: receipt, postRollbackHealth: execution.postRollbackHealth });
    }
    if (!healthPassed) {
      return finishFailure(task, "post_rollback_health_degraded", { policy: policy.decision, approval: approvalEvidence, rollbackReceipt: receipt, postRollbackHealth: execution.postRollbackHealth });
    }

    const completedTask = completeTask(task, {
      executor: EXECUTION_REGISTRY,
      summary: `Activation ${expected.activationReceiptHash} was rolled back to its exact previous generation and passed post-rollback health review.`,
      rollbackExecuted: true,
      generationRestored: true,
      execution,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: EXECUTION_REGISTRY,
      activationTaskId: expected.activationTaskId,
      activationReceiptHash: expected.activationReceiptHash,
      rollbackExecuted: true,
    });
    return {
      task: completedTask,
      blocked: false,
      reason: null,
      actions: [],
      capabilityInvocations: [],
      verification: {
        ok: true,
        checks: ["activation_receipt_bound", "step_approval_bound", "hostd_rollback_receipt", "generation_restored", "managed_source_restored", "snapshot_consumed", "post_rollback_health"],
        failedChecks: [],
      },
      policy: policy.decision,
      approval: approvalEvidence,
      rollbackReceipt: receipt,
      postRollbackHealth: execution.postRollbackHealth,
      rollback: execution,
    };
  }

  return [{
    name: "native-declarative-evolution-rollback",
    predicate: isNativeDeclarativeEvolutionRollbackTask,
    execute: executeNativeDeclarativeEvolutionRollbackTask,
  }];
}
