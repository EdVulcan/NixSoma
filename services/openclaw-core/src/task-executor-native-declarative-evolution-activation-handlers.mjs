import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildCapabilityRequestBindingHash } from "./capability-runtime-approval-binding.mjs";
import {
  isNativeDeclarativeEvolutionActivationDecisionTask,
} from "./native-declarative-evolution-activation-decision.mjs";

const EXECUTION_REGISTRY = "openclaw-native-declarative-evolution-activation-decision-execution-v0";
const DECISION_CAPABILITY_ID = "act.openclaw.declarative_evolution.activation_decision";

function expectedBinding(task) {
  const decision = task?.nativeDeclarativeEvolution?.activationDecision ?? {};
  return {
    kind: "native_declarative_evolution_activation_decision",
    sourceStagingTaskId: decision.sourceStagingTaskId ?? null,
    candidateHash: decision.candidateHash ?? null,
    stagedFileHash: decision.stagedFileHash ?? null,
    evaluatedClosurePath: decision.evaluatedClosurePath ?? null,
    derivationPath: decision.derivationPath ?? null,
    narHash: decision.narHash ?? null,
    closureIntegrityReceiptHash: decision.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: decision.approvalRecordHash ?? null,
    hostHealthHash: decision.hostHealthHash ?? null,
    decision: decision.decision ?? null,
  };
}

function approvalMatchesDecision(task, approval) {
  const expected = expectedBinding(task);
  const actual = approval?.binding ?? null;
  if (Object.entries(expected).every(([key, value]) => actual?.[key] === value)) return true;

  const binding = approval?.binding;
  const step = (Array.isArray(task?.plan?.steps) ? task.plan.steps : [])
    .find((candidate) => candidate?.capabilityId === DECISION_CAPABILITY_ID
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
    && boundStep.capabilityId === DECISION_CAPABILITY_ID
    && boundStep.requestHash === requestHash) === true;
}

function compactExecution(execution) {
  return {
    status: execution?.status ?? null,
    decision: execution?.decision ?? null,
    activation: execution?.activation ?? null,
    sourceStagingTaskId: execution?.sourceStagingTaskId ?? null,
    candidateHash: execution?.candidateHash ?? null,
    stagedFileHash: execution?.stagedFileHash ?? null,
    evaluatedClosurePath: execution?.evaluatedClosurePath ?? null,
    derivationPath: execution?.derivationPath ?? null,
    narHash: execution?.narHash ?? null,
    closureIntegrityReceiptHash: execution?.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: execution?.approvalRecordHash ?? null,
    hostHealthHash: execution?.hostHealthHash ?? null,
    hostHealthStatus: execution?.hostHealthStatus ?? null,
    governance: execution?.governance ?? null,
  };
}

export function createNativeDeclarativeEvolutionActivationDecisionTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  publishEvent,
}) {
  const { approvals } = state;
  const {
    serialiseTask,
    isActiveTask,
    setTaskPhase,
    completeTask,
    failTask,
  } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy, isPolicyExecutionAllowed } = policyEvaluator;

  async function finishFailure(task, reason, details = {}) {
    const failedTask = failTask(task, reason, {
      executor: EXECUTION_REGISTRY,
      ...details,
    });
    await publishEvent(createEventName("task.failed"), {
      task: serialiseTask(failedTask),
      reason: details.reason ?? "activation_decision_failed",
      executor: EXECUTION_REGISTRY,
    });
    return {
      task: failedTask,
      blocked: false,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: details.policy ?? task.policy?.decision ?? null,
      approval: details.approval ?? null,
    };
  }

  async function executeNativeDeclarativeEvolutionActivationDecisionTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("Native declarative evolution activation decision task is not active.");
    }

    const policy = ensureTaskPolicy(task, { stage: "declarative_evolution.activation_decision.execute" });
    await publishEvent(createEventName("policy.evaluated"), {
      task: serialiseTask(task),
      policy: policy.decision,
    });
    if (policy.decision?.decision === "deny") {
      return finishFailure(task, "Policy denied declarative evolution activation decision.", {
        reason: "policy_denied",
        policy: policy.decision,
      });
    }

    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!approval || approval.status !== "approved") {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: EXECUTION_REGISTRY,
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          candidateHash: task.nativeDeclarativeEvolution?.activationDecision?.candidateHash ?? null,
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
        approval: approval ? serialiseApproval(approval) : null,
      };
    }

    const approvalEvidence = serialiseApproval(approval);
    if (!approvalMatchesDecision(task, approval)) {
      return finishFailure(task, "Approval binding does not match the activation decision evidence.", {
        reason: "approval_activation_binding_mismatch",
        approval: approvalEvidence,
        policy: policy.decision,
      });
    }
    if (!isPolicyExecutionAllowed(policy.decision)) {
      return finishFailure(task, `Policy blocked declarative evolution activation decision: ${policy.decision.reason}`, {
        reason: "policy_blocked",
        approval: approvalEvidence,
        policy: policy.decision,
      });
    }

    const decision = task.nativeDeclarativeEvolution?.activationDecision?.decision ?? null;
    const sourceStagingTaskId = task.nativeDeclarativeEvolution?.activationDecision?.sourceStagingTaskId ?? null;
    await setTaskPhase(task, "revalidating_health_and_candidate_binding", {
      status: "running",
      details: {
        executor: EXECUTION_REGISTRY,
        sourceStagingTaskId,
        candidateHash: task.nativeDeclarativeEvolution?.activationDecision?.candidateHash ?? null,
        hostHealthHash: task.nativeDeclarativeEvolution?.activationDecision?.hostHealthHash ?? null,
      },
    });

    const review = await planBuilder.buildNativeDeclarativeEvolutionActivationDecisionReview({
      taskId: sourceStagingTaskId,
    });
    if (review?.blocked === true) {
      return finishFailure(task, "Activation decision source is no longer eligible.", {
        reason: review.reason ?? "activation_source_blocked",
        review: {
          sourceStagingTaskId,
          healthGate: review.healthGate ?? null,
          candidateHash: review.candidate?.candidateHash ?? null,
        },
        approval: approvalEvidence,
        policy: policy.decision,
      });
    }

    const expected = expectedBinding(task);
    const observed = review?.binding ?? {};
    const bindingMatches = Object.entries(expected)
      .filter(([key]) => key !== "kind" && key !== "decision")
      .every(([key, value]) => observed[key] === value);
    if (!bindingMatches) {
      return finishFailure(task, "Candidate, staged file, evaluated closure, or host health changed after approval.", {
        reason: "activation_decision_binding_changed",
        expectedBinding: {
          sourceStagingTaskId: expected.sourceStagingTaskId,
          candidateHash: expected.candidateHash,
          stagedFileHash: expected.stagedFileHash,
          evaluatedClosurePath: expected.evaluatedClosurePath,
          derivationPath: expected.derivationPath,
          narHash: expected.narHash,
          closureIntegrityReceiptHash: expected.closureIntegrityReceiptHash,
          approvalRecordHash: expected.approvalRecordHash,
          hostHealthHash: expected.hostHealthHash,
        },
        observedBinding: {
          sourceStagingTaskId: observed.sourceStagingTaskId ?? null,
          candidateHash: observed.candidateHash ?? null,
          stagedFileHash: observed.stagedFileHash ?? null,
          evaluatedClosurePath: observed.evaluatedClosurePath ?? null,
          hostHealthHash: observed.hostHealthHash ?? null,
        },
        approval: approvalEvidence,
        policy: policy.decision,
      });
    }
    if (decision === "approve_activation_review" && review.activationReady !== true) {
      return finishFailure(task, "Current host health is no longer eligible for activation review.", {
        reason: "host_health_not_healthy",
        hostHealthStatus: review.hostHealth?.status ?? "unknown",
        approval: approvalEvidence,
        policy: policy.decision,
      });
    }

    await setTaskPhase(task, "recording_activation_decision", {
      status: "running",
      details: {
        executor: EXECUTION_REGISTRY,
        decision,
        sourceStagingTaskId,
        activationExecuted: false,
        generationSwitched: false,
        rollbackExecuted: false,
      },
    });
    const execution = compactExecution({
      status: "passed",
      decision,
      activation: decision === "approve_activation_review"
        ? "approved_for_future_activation"
        : "rejected",
      sourceStagingTaskId,
      candidateHash: expected.candidateHash,
      stagedFileHash: expected.stagedFileHash,
      evaluatedClosurePath: expected.evaluatedClosurePath,
      derivationPath: expected.derivationPath,
      narHash: expected.narHash,
      closureIntegrityReceiptHash: expected.closureIntegrityReceiptHash,
      approvalRecordHash: expected.approvalRecordHash,
      hostHealthHash: expected.hostHealthHash,
      hostHealthStatus: review.hostHealth?.status ?? null,
      governance: {
        decisionRecorded: true,
        writesManagedConfig: false,
        switchesGeneration: false,
        executesActivation: false,
        executesRollback: false,
        automaticActivation: false,
        automaticRollback: false,
        providerEgress: false,
        networkEgress: false,
      },
    });
    task.nativeDeclarativeEvolution.execution = execution;
    task.nativeDeclarativeEvolution.governance = {
      ...task.nativeDeclarativeEvolution.governance,
      executed: true,
      decisionRecorded: true,
      activationExecuted: false,
      hostHealthRevalidated: true,
    };
    const completedTask = completeTask(task, {
      executor: EXECUTION_REGISTRY,
      summary: `${decision === "approve_activation_review" ? "Approved" : "Rejected"} future activation review for managed Nix candidate ${expected.candidateHash}.`,
      decision,
      activationExecuted: false,
      generationSwitched: false,
      rollbackExecuted: false,
      execution,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: EXECUTION_REGISTRY,
      decision,
      candidateHash: expected.candidateHash,
      activationExecuted: false,
    });
    return {
      task: completedTask,
      blocked: false,
      actions: [],
      capabilityInvocations: [],
      verification: {
        ok: true,
        checks: ["health_gate_bound", "candidate_hash_bound", "staged_file_hash_bound", "closure_integrity_receipt_bound", "host_health_hash_bound", "activation_not_executed"],
        failedChecks: [],
      },
      policy: policy.decision,
      approval: approvalEvidence,
      activationDecision: execution,
    };
  }

  return [{
    name: "native-declarative-evolution-activation-decision",
    predicate: isNativeDeclarativeEvolutionActivationDecisionTask,
    execute: executeNativeDeclarativeEvolutionActivationDecisionTask,
  }];
}
