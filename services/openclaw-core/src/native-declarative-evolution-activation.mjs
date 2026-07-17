import { randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  HOSTD_ACTIVATION_MAX_AGE_MS,
  HOSTD_ACTIVATION_TARGET_PATH,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
} from "./native-declarative-evolution-activation-decision.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY = "openclaw-native-declarative-evolution-activation-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_CAPABILITY_ID = "act.openclaw.declarative_evolution.activation";
export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE = "native_declarative_evolution_activation";

const MAX_ID_CHARS = 160;

function normaliseId(value, label) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > MAX_ID_CHARS) throw new Error(`Declarative evolution activation requires ${label}.`);
  return id;
}

function findTask(tasks, id) {
  if (tasks instanceof Map) return tasks.get(id) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === id) ?? null;
  return null;
}

function compactDecisionTask(task) {
  const execution = task?.nativeDeclarativeEvolution?.execution ?? {};
  return {
    decisionTaskId: task?.id ?? null,
    status: task?.status ?? null,
    activation: execution.activation ?? null,
    sourceStagingTaskId: execution.sourceStagingTaskId ?? null,
    candidateHash: execution.candidateHash ?? null,
    stagedFileHash: execution.stagedFileHash ?? null,
    evaluatedClosurePath: execution.evaluatedClosurePath ?? null,
    derivationPath: execution.derivationPath ?? null,
    narHash: execution.narHash ?? null,
    closureIntegrityReceiptHash: execution.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: execution.approvalRecordHash ?? null,
    hostHealthHash: execution.hostHealthHash ?? null,
  };
}

function activationBinding({ decisionTask, stagingTask, review, activationDecisionTaskId, expiresAt }) {
  const execution = decisionTask.nativeDeclarativeEvolution.execution;
  return {
    kind: "native_declarative_evolution_activation",
    activationDecisionTaskId,
    sourceStagingTaskId: execution.sourceStagingTaskId,
    candidateHash: execution.candidateHash,
    stagedFileHash: execution.stagedFileHash,
    stagingPath: stagingTask.nativeDeclarativeEvolution?.execution?.staging?.path ?? null,
    evaluatedClosurePath: execution.evaluatedClosurePath,
    derivationPath: execution.derivationPath ?? null,
    narHash: execution.narHash ?? null,
    closureIntegrityReceiptHash: execution.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: execution.approvalRecordHash ?? null,
    hostHealthHash: execution.hostHealthHash,
    targetPath: review.candidate?.targetPath ?? HOSTD_ACTIVATION_TARGET_PATH,
    expiresAt,
  };
}

function bindingMatchesDecision({ decisionTask, stagingTask, review, activationDecisionTaskId, expiresAt }) {
  const binding = activationBinding({ decisionTask, stagingTask, review, activationDecisionTaskId, expiresAt });
  const execution = decisionTask.nativeDeclarativeEvolution?.execution ?? {};
  const observed = review.binding ?? {};
  return binding.activationDecisionTaskId === activationDecisionTaskId
    && binding.sourceStagingTaskId === observed.sourceStagingTaskId
    && binding.candidateHash === observed.candidateHash
    && binding.stagedFileHash === observed.stagedFileHash
    && binding.evaluatedClosurePath === observed.evaluatedClosurePath
    && binding.derivationPath === observed.derivationPath
    && binding.narHash === observed.narHash
    && binding.closureIntegrityReceiptHash === observed.closureIntegrityReceiptHash
    && binding.approvalRecordHash === observed.approvalRecordHash
    && binding.hostHealthHash === observed.hostHealthHash
    && execution.activation === "approved_for_future_activation"
    && binding.targetPath === HOSTD_ACTIVATION_TARGET_PATH
    && typeof binding.stagingPath === "string"
    && binding.stagingPath.length > 0;
}

function governance() {
  return {
    sourceDecisionBound: true,
    candidateHashBound: true,
    stagedFileHashBound: true,
    evaluatedClosureBound: true,
    closureIntegrityReceiptBound: true,
    currentApprovalRecordBound: true,
    preActivationHostHealthBound: true,
    activationOwner: "openclaw-hostd",
    healthOwner: "openclaw-system-sense",
    rollbackOwner: "deferred_manual_operator",
    writesManagedConfig: false,
    switchesGeneration: false,
    executesActivation: false,
    executesRollback: false,
    automaticActivation: false,
    automaticRollback: false,
    networkEgress: false,
    requiresExplicitApproval: true,
  };
}

export function isNativeDeclarativeEvolutionActivationTask(task) {
  return task?.type === NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE
    && task?.plan?.strategy === "native-declarative-evolution-activation-v0";
}

export function createNativeDeclarativeEvolutionActivationBuilders({
  tasks = new Map(),
  buildNativeDeclarativeEvolutionActivationDecisionReview,
  autonomyMode,
  evaluatePolicyIntent,
  createTask,
  createApprovalRequestForTask,
  supersedeOtherActiveTasks,
  reconcileRuntimeState,
  persistState,
  publishEvent,
  publishTaskApprovalIfPending,
  serialiseTask,
  serialisePlanForPublic,
  now = () => new Date().toISOString(),
} = {}) {
  async function buildNativeDeclarativeEvolutionActivationTaskDraft({ activationDecisionTaskId } = {}) {
    const decisionId = normaliseId(activationDecisionTaskId, "activationDecisionTaskId");
    const decisionTask = findTask(tasks, decisionId);
    if (!decisionTask || decisionTask.type !== NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE) {
      throw new Error("Declarative evolution activation requires a native activation-decision task.");
    }
    if (decisionTask.status !== "completed"
      || decisionTask.nativeDeclarativeEvolution?.execution?.activation !== "approved_for_future_activation") {
      throw new Error("Declarative evolution activation requires a completed approved activation decision.");
    }
    const sourceStagingTaskId = decisionTask.nativeDeclarativeEvolution.execution.sourceStagingTaskId;
    const stagingTask = findTask(tasks, sourceStagingTaskId);
    if (!stagingTask) throw new Error("Declarative evolution activation source staging task is missing.");
    if (typeof buildNativeDeclarativeEvolutionActivationDecisionReview !== "function") {
      throw new Error("Declarative evolution activation review builder is unavailable.");
    }
    const review = await buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId: sourceStagingTaskId });
    if (review?.blocked === true || review?.activationReady !== true) {
      throw new Error(`Declarative evolution activation is blocked: ${review?.reason ?? "host_health_not_healthy"}.`);
    }
    const timestamp = now();
    const expiresAt = new Date(Date.parse(timestamp) + HOSTD_ACTIVATION_MAX_AGE_MS).toISOString();
    if (!bindingMatchesDecision({ decisionTask, stagingTask, review, activationDecisionTaskId: decisionId, expiresAt })) {
      throw new Error("Declarative evolution activation decision binding changed before task creation.");
    }
    const binding = activationBinding({ decisionTask, stagingTask, review, activationDecisionTaskId: decisionId, expiresAt });
    const goal = `Activate approved OpenClaw managed Nix candidate ${binding.candidateHash}`;
    const policyRequest = {
      intent: "openclaw.declarative_evolution.activate",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      approved: false,
      activationDecisionTaskId: decisionId,
      sourceStagingTaskId: binding.sourceStagingTaskId,
      candidateHash: binding.candidateHash,
      stagedFileHash: binding.stagedFileHash,
      evaluatedClosurePath: binding.evaluatedClosurePath,
      hostHealthHash: binding.hostHealthHash,
      tags: [
        "declarative_evolution",
        "managed_config_activation",
        "fixed_hostd_owner",
        "post_activation_health_required",
        "explicit_approval_required",
        "rollback_manual_only",
      ],
    };
    const policyDecision = evaluatePolicyIntent({
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
      goal,
      policy: policyRequest,
    }, {
      stage: "declarative_evolution.activation.draft",
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
      goal,
    });
    const plan = {
      planId: `plan-${randomUUID()}`,
      strategy: "native-declarative-evolution-activation-v0",
      planner: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
      capabilityAware: true,
      status: "planned",
      goal,
      targetUrl: null,
      intent: policyRequest.intent,
      createdAt: timestamp,
      updatedAt: timestamp,
      activationDecision: compactDecisionTask(decisionTask),
      approvalBinding: binding,
      capabilitySummary: {
        total: 4,
        approvalGates: 1,
        ids: [
          "sense.openclaw.declarative_evolution.health_gate",
          "sense.system.vitals",
          "govern.policy.evaluate",
          NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_CAPABILITY_ID,
        ],
        byRisk: { medium: 2, high: 2 },
      },
      steps: [
        {
          id: "step-review-approved-activation-decision",
          kind: "openclaw.declarative_evolution.activation_decision_review",
          phase: "reviewing_approved_activation_decision",
          title: "Review the completed approved activation decision and bound candidate hashes",
          status: "pending",
          capabilityId: "sense.openclaw.declarative_evolution.health_gate",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: { activationDecisionTaskId: decisionId, sourceStagingTaskId: binding.sourceStagingTaskId },
        },
        {
          id: "step-review-pre-activation-health",
          kind: "openclaw.declarative_evolution.pre_activation_health_review",
          phase: "reviewing_pre_activation_health",
          title: "Recheck current host health before activation",
          status: "pending",
          capabilityId: "sense.system.vitals",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: { hostHealthHash: binding.hostHealthHash, status: review.hostHealth?.status ?? null },
        },
        {
          id: "step-approve-managed-config-activation",
          kind: "approval.gate",
          phase: "waiting_for_approval",
          title: "Wait for explicit approval bound to the decision, candidate, closure, and health hashes",
          status: "pending",
          capabilityId: "govern.policy.evaluate",
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: binding,
        },
        {
          id: "step-activate-managed-config",
          kind: "openclaw.declarative_evolution.activate_managed_config",
          phase: "activating_managed_config",
          title: "Install the bound candidate and activate through fixed hostd",
          status: "pending",
          capabilityId: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_CAPABILITY_ID,
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: binding,
        },
      ],
      governance: governance(),
    };
    return {
      ok: true,
      registry: `${NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY}-draft`,
      mode: "approval-gated-native-declarative-evolution-activation-draft",
      generatedAt: timestamp,
      activationDecision: compactDecisionTask(decisionTask),
      review: {
        sourceStagingTaskId: binding.sourceStagingTaskId,
        candidateHash: binding.candidateHash,
        stagedFileHash: binding.stagedFileHash,
        evaluatedClosurePath: binding.evaluatedClosurePath,
        hostHealth: review.hostHealth,
      },
      approvalBinding: binding,
      plan,
      policy: { request: policyRequest, decision: policyDecision },
      governance: { ...governance(), createsTask: false, createsApproval: false, canExecuteWithoutApproval: false },
      autonomyMode,
    };
  }

  async function createNativeDeclarativeEvolutionActivationTask({ activationDecisionTaskId, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Declarative evolution activation task creation requires confirm=true.");
    const draft = await buildNativeDeclarativeEvolutionActivationTaskDraft({ activationDecisionTaskId });
    const task = createTask({
      goal: draft.plan.goal,
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
      workViewStrategy: "native-declarative-evolution-activation",
      plan: draft.plan,
      policy: draft.policy.request,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    task.nativeDeclarativeEvolution = {
      registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-activation-task",
      activation: draft.approvalBinding,
      approvalBinding: draft.approvalBinding,
      execution: null,
      governance: draft.governance,
    };
    const approval = createApprovalRequestForTask(task, draft.policy.decision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();
    await publishEvent(createEventName("task.created"), {
      task: serialiseTask(task),
      planner: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
    });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), {
      task: serialiseTask(task),
      plan: serialisePlanForPublic(task.plan),
    });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));
    return {
      ok: true,
      registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-activation-task",
      generatedAt: now(),
      activationDecision: draft.activationDecision,
      review: draft.review,
      approvalBinding: draft.approvalBinding,
      task,
      approval,
      governance: { ...draft.governance, createsTask: true, createsApproval: true, executed: false },
      autonomyMode,
    };
  }

  return {
    buildNativeDeclarativeEvolutionActivationTaskDraft,
    createNativeDeclarativeEvolutionActivationTask,
  };
}
