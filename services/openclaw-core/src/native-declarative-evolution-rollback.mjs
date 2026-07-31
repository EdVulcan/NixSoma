import { randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  HOSTD_ACTIVATION_MAX_AGE_MS,
  validateManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { HOSTD_ROLLBACK_TARGET_PATH } from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
} from "./native-declarative-evolution-activation.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY = "openclaw-native-declarative-evolution-rollback-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID = "act.openclaw.declarative_evolution.rollback";
export const NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE = "native_declarative_evolution_rollback";

function normaliseId(value, label) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 160) throw new Error(`Declarative evolution rollback requires ${label}.`);
  return id;
}

function findTask(tasks, id) {
  if (tasks instanceof Map) return tasks.get(id) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === id) ?? null;
  return null;
}

export function isRollbackEligibleNativeDeclarativeEvolutionActivationTask(task, receipt = task?.nativeDeclarativeEvolution?.execution?.executionReceipt) {
  const execution = task?.nativeDeclarativeEvolution?.execution;
  const healthyCompletion = task?.status === "completed"
    && execution?.status === "passed"
    && execution?.postActivationHealth?.status === "healthy";
  const degradedHealthFailure = task?.status === "failed"
    && execution?.status === "failed"
    && task?.outcome?.reason === "post_activation_health_degraded"
    && execution?.postActivationHealth?.status !== "healthy";
  return task?.type === NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE
    && (healthyCompletion || degradedHealthFailure);
}

function verifiedActivationReceipt(task) {
  const receipt = task?.nativeDeclarativeEvolution?.execution?.executionReceipt;
  if (!isRollbackEligibleNativeDeclarativeEvolutionActivationTask(task, receipt)
    || !validateManagedConfigActivationReceipt(receipt)
    || receipt.status !== "passed"
    || receipt.activationTaskId !== task.id
    || receipt.activationExecuted !== true
    || receipt.generationSwitched !== true
    || receipt.rollbackExecuted !== false) return null;
  return receipt;
}

function rollbackBinding({ activationTaskId, receipt, expiresAt }) {
  return {
    kind: "native_declarative_evolution_rollback",
    activationTaskId,
    activationReceiptHash: receipt.receiptHash,
    rollbackSnapshotId: receipt.rollbackSnapshotId,
    candidateHash: receipt.candidateHash,
    previousGenerationPath: receipt.previousGenerationPath,
    activatedGenerationPath: receipt.activatedGenerationPath,
    previousTargetPresent: receipt.previousTargetPresent,
    previousTargetHash: receipt.previousTargetHash,
    targetPath: receipt.targetPath,
    expiresAt,
  };
}

function governance() {
  return {
    activationReceiptBound: true,
    rollbackSnapshotBound: true,
    previousGenerationBound: true,
    previousManagedSourceBound: true,
    rollbackOwner: "openclaw-hostd",
    healthOwner: "openclaw-system-sense",
    writesManagedConfig: false,
    switchesGeneration: false,
    executesRollback: false,
    automaticRollback: false,
    arbitraryGeneration: false,
    arbitraryCommand: false,
    networkEgress: false,
    requiresExplicitApproval: true,
  };
}

export function isNativeDeclarativeEvolutionRollbackTask(task) {
  return task?.type === NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE
    && task?.plan?.strategy === "native-declarative-evolution-rollback-v0";
}

export function createNativeDeclarativeEvolutionRollbackBuilders({
  tasks = new Map(),
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
  async function buildNativeDeclarativeEvolutionRollbackTaskDraft({ activationTaskId } = {}) {
    const sourceId = normaliseId(activationTaskId, "activationTaskId");
    const activationTask = findTask(tasks, sourceId);
    const receipt = verifiedActivationReceipt(activationTask);
    if (!receipt) throw new Error("Declarative evolution rollback requires one verified switched activation receipt.");
    const timestamp = now();
    const expiresAt = new Date(Date.parse(timestamp) + HOSTD_ACTIVATION_MAX_AGE_MS).toISOString();
    const binding = rollbackBinding({ activationTaskId: sourceId, receipt, expiresAt });
    if (binding.targetPath !== HOSTD_ROLLBACK_TARGET_PATH) {
      throw new Error("Declarative evolution rollback activation receipt target is not fixed.");
    }
    const goal = `Rollback activation ${receipt.receiptHash} to its exact previous generation`;
    const policyRequest = {
      intent: "openclaw.declarative_evolution.rollback",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      approved: false,
      activationTaskId: sourceId,
      activationReceiptHash: receipt.receiptHash,
      rollbackSnapshotId: receipt.rollbackSnapshotId,
      tags: [
        "declarative_evolution",
        "managed_config_rollback",
        "fixed_hostd_owner",
        "exact_previous_generation",
        "post_rollback_health_required",
        "explicit_approval_required",
        "single_use_snapshot",
      ],
    };
    const policyDecision = evaluatePolicyIntent({
      type: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE,
      goal,
      policy: policyRequest,
    }, {
      stage: "declarative_evolution.rollback.draft",
      type: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE,
      goal,
    });
    const plan = {
      planId: `plan-${randomUUID()}`,
      strategy: "native-declarative-evolution-rollback-v0",
      planner: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY,
      capabilityAware: true,
      status: "planned",
      goal,
      targetUrl: null,
      intent: policyRequest.intent,
      createdAt: timestamp,
      updatedAt: timestamp,
      approvalBinding: binding,
      capabilitySummary: {
        total: 3,
        approvalGates: 1,
        ids: ["govern.policy.evaluate", NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID, "sense.system.vitals"],
        byRisk: { medium: 1, high: 2 },
      },
      steps: [
        {
          id: "step-review-activation-receipt",
          kind: "openclaw.declarative_evolution.activation_receipt_review",
          phase: "reviewing_activation_receipt",
          title: "Review the exact immutable activation receipt and previous-generation binding",
          status: "pending",
          capabilityId: "govern.policy.evaluate",
          risk: "high",
          governance: "audit_only",
          requiresApproval: false,
          params: binding,
        },
        {
          id: "step-rollback-managed-config",
          kind: "openclaw.declarative_evolution.rollback_managed_config",
          phase: "rolling_back_managed_config",
          title: "Restore the exact previous managed source and generation through fixed hostd",
          status: "pending",
          capabilityId: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_CAPABILITY_ID,
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: binding,
        },
        {
          id: "step-verify-post-rollback-health",
          kind: "openclaw.declarative_evolution.post_rollback_health",
          phase: "verifying_post_rollback_health",
          title: "Verify independent host health after rollback",
          status: "pending",
          capabilityId: "sense.system.vitals",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: { activationReceiptHash: receipt.receiptHash },
        },
      ],
      governance: governance(),
    };
    return {
      ok: true,
      registry: `${NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY}-draft`,
      mode: "approval-gated-native-declarative-evolution-rollback-draft",
      generatedAt: timestamp,
      activationReceipt: {
        receiptHash: receipt.receiptHash,
        activationTaskId: sourceId,
        candidateHash: receipt.candidateHash,
        previousGenerationPath: receipt.previousGenerationPath,
        activatedGenerationPath: receipt.activatedGenerationPath,
        previousTargetPresent: receipt.previousTargetPresent,
        previousTargetHash: receipt.previousTargetHash,
      },
      approvalBinding: binding,
      plan,
      policy: { request: policyRequest, decision: policyDecision },
      governance: { ...governance(), createsTask: false, createsApproval: false, canExecuteWithoutApproval: false },
      autonomyMode,
    };
  }

  async function createNativeDeclarativeEvolutionRollbackTask({ activationTaskId, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Declarative evolution rollback task creation requires confirm=true.");
    const draft = await buildNativeDeclarativeEvolutionRollbackTaskDraft({ activationTaskId });
    const task = createTask({
      goal: draft.plan.goal,
      type: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_TASK_TYPE,
      workViewStrategy: "native-declarative-evolution-rollback",
      plan: draft.plan,
      policy: draft.policy.request,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    task.nativeDeclarativeEvolution = {
      registry: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-rollback-task",
      rollback: draft.approvalBinding,
      approvalBinding: draft.approvalBinding,
      execution: null,
      governance: draft.governance,
    };
    const approval = createApprovalRequestForTask(task, draft.policy.decision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();
    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));
    return {
      ok: true,
      registry: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-rollback-task",
      generatedAt: now(),
      activationReceipt: draft.activationReceipt,
      approvalBinding: draft.approvalBinding,
      task,
      approval,
      governance: { ...draft.governance, createsTask: true, createsApproval: true, executed: false },
      autonomyMode,
    };
  }

  return {
    buildNativeDeclarativeEvolutionRollbackTaskDraft,
    createNativeDeclarativeEvolutionRollbackTask,
  };
}
