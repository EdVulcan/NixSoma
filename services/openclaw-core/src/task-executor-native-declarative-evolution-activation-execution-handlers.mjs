import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildCapabilityRequestBindingHash } from "./capability-runtime-approval-binding.mjs";
import {
  validateManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  isNativeDeclarativeEvolutionActivationTask,
} from "./native-declarative-evolution-activation.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
} from "./native-declarative-evolution-activation-decision.mjs";

const EXECUTION_REGISTRY = "openclaw-native-declarative-evolution-activation-execution-v0";
const ACTIVATION_CAPABILITY_ID = "act.openclaw.declarative_evolution.activation";

function expectedBinding(task) {
  const binding = task?.nativeDeclarativeEvolution?.activation ?? {};
  return {
    kind: "native_declarative_evolution_activation",
    activationDecisionTaskId: binding.activationDecisionTaskId ?? null,
    sourceStagingTaskId: binding.sourceStagingTaskId ?? null,
    candidateHash: binding.candidateHash ?? null,
    stagedFileHash: binding.stagedFileHash ?? null,
    stagingPath: binding.stagingPath ?? null,
    evaluatedClosurePath: binding.evaluatedClosurePath ?? null,
    derivationPath: binding.derivationPath ?? null,
    narHash: binding.narHash ?? null,
    closureIntegrityReceiptHash: binding.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: binding.approvalRecordHash ?? null,
    hostHealthHash: binding.hostHealthHash ?? null,
    targetPath: binding.targetPath ?? null,
    expiresAt: binding.expiresAt ?? null,
  };
}

function approvalMatchesBinding(task, approval) {
  const expected = expectedBinding(task);
  if (Object.entries(expected).every(([key, value]) => approval?.binding?.[key] === value)) return true;

  const binding = approval?.binding;
  const step = (Array.isArray(task?.plan?.steps) ? task.plan.steps : [])
    .find((candidate) => candidate?.capabilityId === ACTIVATION_CAPABILITY_ID
      && (candidate.requiresApproval === true || candidate.governance === "require_approval"));
  if (binding?.registry !== "openclaw-capability-execution-approval-binding-v1"
    || binding.planId !== task?.plan?.planId
    || !step) {
    return false;
  }
  const requestHash = buildCapabilityRequestBindingHash({
    capabilityId: step.capabilityId,
    intent: step.intent ?? step.kind ?? null,
    params: step.params ?? {},
  });
  return binding.steps?.some((boundStep) => boundStep.stepId === step.id
    && boundStep.capabilityId === ACTIVATION_CAPABILITY_ID
    && boundStep.requestHash === requestHash) === true;
}

function reviewMatchesBinding(review, expected) {
  return review?.blocked !== true
    && review?.binding?.sourceStagingTaskId === expected.sourceStagingTaskId
    && review?.binding?.candidateHash === expected.candidateHash
    && review?.binding?.stagedFileHash === expected.stagedFileHash
    && review?.binding?.evaluatedClosurePath === expected.evaluatedClosurePath
    && review?.binding?.derivationPath === expected.derivationPath
    && review?.binding?.narHash === expected.narHash
    && review?.binding?.closureIntegrityReceiptHash === expected.closureIntegrityReceiptHash
    && review?.binding?.approvalRecordHash === expected.approvalRecordHash
    && review?.binding?.hostHealthHash === expected.hostHealthHash
    && review?.activationReady === true;
}

function compactHealth(health) {
  return {
    status: health?.status ?? null,
    observedAt: health?.observedAt ?? null,
    hostHealthHash: health?.hostHealthHash ?? null,
    serviceCount: health?.serviceCount ?? null,
    onlineServiceCount: health?.onlineServiceCount ?? null,
    degradedServiceCount: health?.degradedServiceCount ?? null,
    alertCount: health?.alertCount ?? null,
    networkOnline: health?.networkOnline ?? null,
  };
}

function compactReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return null;
  return {
    registry: receipt.registry ?? null,
    version: receipt.version ?? null,
    receiptId: receipt.receiptId ?? null,
    receiptHash: receipt.receiptHash ?? null,
    requestId: receipt.requestId ?? null,
    operation: receipt.operation ?? null,
    targetPath: receipt.targetPath ?? null,
    stagingPath: receipt.stagingPath ?? null,
    candidateHash: receipt.candidateHash ?? null,
    candidateBytes: receipt.candidateBytes ?? null,
    evaluatedClosurePath: receipt.evaluatedClosurePath ?? null,
    sourceStagingTaskId: receipt.sourceStagingTaskId ?? null,
    activationDecisionTaskId: receipt.activationDecisionTaskId ?? null,
    activationTaskId: receipt.activationTaskId ?? null,
    previousTargetHash: receipt.previousTargetHash ?? null,
    command: receipt.command ?? null,
    status: receipt.status ?? null,
    activationExecuted: receipt.activationExecuted === true,
    generationSwitched: receipt.generationSwitched === true,
    rollbackExecuted: receipt.rollbackExecuted === true,
    startedAt: receipt.startedAt ?? null,
    completedAt: receipt.completedAt ?? null,
    result: receipt.result ?? null,
    error: receipt.error ?? null,
  };
}

export function createNativeDeclarativeEvolutionActivationTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  hostdActivationClient,
  publishEvent,
}) {
  const { approvals, tasks, HOSTD_SOCKET_PATH } = state;
  const {
    serialiseTask,
    isActiveTask,
    setTaskPhase,
    completeTask,
    failTask,
    getTaskById,
  } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy, isPolicyExecutionAllowed } = policyEvaluator;

  function findTask(taskId) {
    return typeof getTaskById === "function"
      ? getTaskById(taskId)
      : tasks instanceof Map ? tasks.get(taskId) ?? null : null;
  }

  async function finishFailure(task, reason, details = {}) {
    const failedTask = failTask(task, reason, { executor: EXECUTION_REGISTRY, ...details });
    await publishEvent(createEventName("task.failed"), {
      task: serialiseTask(failedTask),
      reason,
      executor: EXECUTION_REGISTRY,
    });
    return {
      task: failedTask,
      blocked: false,
      reason,
      actions: [],
      capabilityInvocations: [],
      verification: { ok: false, checks: [], failedChecks: [{ name: reason }] },
      policy: details.policy ?? task.policy?.decision ?? null,
      approval: details.approval ?? null,
      executionReceipt: details.executionReceipt ?? null,
      postActivationHealth: details.postActivationHealth ?? null,
    };
  }

  async function executeNativeDeclarativeEvolutionActivationTask(task) {
    if (!isActiveTask(task)) throw new Error("Native declarative evolution activation task is not active.");
    const policy = ensureTaskPolicy(task, { stage: "declarative_evolution.activation.execute" });
    await publishEvent(createEventName("policy.evaluated"), {
      task: serialiseTask(task),
      policy: policy.decision,
    });
    if (policy.decision?.decision === "deny") {
      return finishFailure(task, "policy_denied", { policy: policy.decision });
    }

    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const approvalEvidence = approval ? serialiseApproval(approval) : null;
    if (!approval || approval.status !== "approved") {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: EXECUTION_REGISTRY,
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          candidateHash: task.nativeDeclarativeEvolution?.activation?.candidateHash ?? null,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
        approval: approvalEvidence,
      };
    }
    if (!approvalMatchesBinding(task, approval)) {
      return finishFailure(task, "activation_approval_binding_mismatch", {
        policy: policy.decision,
        approval: approvalEvidence,
      });
    }
    if (!isPolicyExecutionAllowed(policy.decision)) {
      return finishFailure(task, "policy_blocked", {
        policy: policy.decision,
        approval: approvalEvidence,
      });
    }

    const expected = expectedBinding(task);
    const decisionTask = findTask(expected.activationDecisionTaskId);
    if (!decisionTask
      || decisionTask.type !== NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE
      || decisionTask.status !== "completed"
      || decisionTask.nativeDeclarativeEvolution?.execution?.activation !== "approved_for_future_activation") {
      return finishFailure(task, "activation_decision_not_approved", {
        policy: policy.decision,
        approval: approvalEvidence,
      });
    }

    const review = await planBuilder.buildNativeDeclarativeEvolutionActivationDecisionReview({
      taskId: expected.sourceStagingTaskId,
    });
    if (!reviewMatchesBinding(review, expected)) {
      return finishFailure(task, "activation_binding_changed_before_hostd", {
        policy: policy.decision,
        approval: approvalEvidence,
        expectedBinding: expected,
        observedBinding: review?.binding ?? null,
      });
    }
    if (typeof hostdActivationClient !== "function" || typeof HOSTD_SOCKET_PATH !== "string" || !HOSTD_SOCKET_PATH) {
      return finishFailure(task, "hostd_activation_unconfigured", {
        policy: policy.decision,
        approval: approvalEvidence,
      });
    }

    await setTaskPhase(task, "activating_managed_config", {
      status: "running",
      details: {
        executor: EXECUTION_REGISTRY,
        activationDecisionTaskId: expected.activationDecisionTaskId,
        candidateHash: expected.candidateHash,
        evaluatedClosurePath: expected.evaluatedClosurePath,
        hostMutationAttempted: true,
        automaticRollback: false,
      },
    });

    let response;
    try {
      response = await hostdActivationClient({
        socketPath: HOSTD_SOCKET_PATH,
        stagingPath: expected.stagingPath,
        candidateHash: expected.candidateHash,
        evaluatedClosurePath: expected.evaluatedClosurePath,
        sourceStagingTaskId: expected.sourceStagingTaskId,
        activationDecisionTaskId: expected.activationDecisionTaskId,
        activationTaskId: task.id,
        expiresAt: expected.expiresAt,
      });
    } catch (error) {
      return finishFailure(task, "hostd_activation_request_failed", {
        policy: policy.decision,
        approval: approvalEvidence,
        error: error instanceof Error ? error.message : "Hostd activation request failed.",
      });
    }

    const receipt = response?.receipt;
    if (!validateManagedConfigActivationReceipt(receipt)
      || receipt.requestId !== response.requestId
      || receipt.activationTaskId !== task.id
      || receipt.candidateHash !== expected.candidateHash
      || receipt.evaluatedClosurePath !== expected.evaluatedClosurePath) {
      return finishFailure(task, "invalid_hostd_activation_receipt", {
        policy: policy.decision,
        approval: approvalEvidence,
        executionReceipt: compactReceipt(receipt),
      });
    }

    const postActivationHealth = typeof planBuilder.readNativeDeclarativeEvolutionHostHealth === "function"
      ? await planBuilder.readNativeDeclarativeEvolutionHostHealth()
      : null;
    const activationPassed = response.ok === true
      && receipt.status === "passed"
      && receipt.activationExecuted === true
      && receipt.generationSwitched === true;
    const healthPassed = postActivationHealth?.status === "healthy";
    const execution = {
      registry: EXECUTION_REGISTRY,
      status: activationPassed && healthPassed ? "passed" : "failed",
      activationExecuted: receipt.activationExecuted === true,
      generationSwitched: receipt.generationSwitched === true,
      activationDecisionTaskId: expected.activationDecisionTaskId,
      sourceStagingTaskId: expected.sourceStagingTaskId,
      candidateHash: expected.candidateHash,
      stagedFileHash: expected.stagedFileHash,
      evaluatedClosurePath: expected.evaluatedClosurePath,
      preActivationHostHealthHash: expected.hostHealthHash,
      postActivationHostHealthHash: postActivationHealth?.hostHealthHash ?? null,
      executionReceipt: compactReceipt(receipt),
      postActivationHealth: compactHealth(postActivationHealth),
      governance: {
        writesManagedConfig: true,
        switchesGeneration: receipt.generationSwitched === true,
        executesActivation: receipt.activationExecuted === true,
        executesRollback: false,
        automaticActivation: false,
        automaticRollback: false,
        healthOracle: "openclaw-system-sense",
      },
    };
    task.nativeDeclarativeEvolution.execution = execution;
    task.nativeDeclarativeEvolution.governance = {
      ...task.nativeDeclarativeEvolution.governance,
      executed: true,
      activationExecuted: execution.activationExecuted,
      generationSwitched: execution.generationSwitched,
      postActivationHealthBound: postActivationHealth !== null,
    };

    if (!activationPassed) {
      return finishFailure(task, "hostd_activation_failed", {
        policy: policy.decision,
        approval: approvalEvidence,
        executionReceipt: execution.executionReceipt,
        postActivationHealth: execution.postActivationHealth,
      });
    }
    if (!healthPassed) {
      return finishFailure(task, "post_activation_health_degraded", {
        policy: policy.decision,
        approval: approvalEvidence,
        executionReceipt: execution.executionReceipt,
        postActivationHealth: execution.postActivationHealth,
        recovery: "manual_operator_health_review_required_no_automatic_rollback",
      });
    }

    const completedTask = completeTask(task, {
      executor: EXECUTION_REGISTRY,
      summary: `Managed Nix candidate ${expected.candidateHash} was activated through fixed hostd and passed post-activation health review.`,
      activationExecuted: true,
      generationSwitched: true,
      rollbackExecuted: false,
      execution,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: EXECUTION_REGISTRY,
      candidateHash: expected.candidateHash,
      activationExecuted: true,
    });
    return {
      task: completedTask,
      blocked: false,
      reason: null,
      actions: [],
      capabilityInvocations: [],
      verification: {
        ok: true,
        checks: ["decision_approved", "candidate_binding", "closure_integrity_receipt_bound", "hostd_receipt", "generation_switched", "post_activation_health"],
        failedChecks: [],
      },
      policy: policy.decision,
      approval: approvalEvidence,
      executionReceipt: execution.executionReceipt,
      postActivationHealth: execution.postActivationHealth,
      activation: execution,
    };
  }

  return [{
    name: "native-declarative-evolution-activation",
    predicate: isNativeDeclarativeEvolutionActivationTask,
    execute: executeNativeDeclarativeEvolutionActivationTask,
  }];
}
