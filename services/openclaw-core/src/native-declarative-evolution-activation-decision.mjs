import { createHash, randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
} from "./native-declarative-evolution-task-builders.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY = "openclaw-native-declarative-evolution-activation-decision-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_CAPABILITY_ID = "act.openclaw.declarative_evolution.activation_decision";
export const NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE = "native_declarative_evolution_activation_decision";

const MAX_TASK_ID_CHARS = 160;
const MAX_SERVICE_STATES = 32;
const MAX_ALERT_CODES = 32;
const ACTIVATION_DECISIONS = new Set(["approve_activation_review", "reject_activation"]);

function normaliseTaskId(value) {
  const taskId = typeof value === "string" ? value.trim() : "";
  return taskId && taskId.length <= MAX_TASK_ID_CHARS ? taskId : null;
}

function normaliseDecision(value) {
  const decision = typeof value === "string" ? value.trim() : "";
  return ACTIVATION_DECISIONS.has(decision) ? decision : null;
}

function findTask(tasks, taskId) {
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === taskId) ?? null;
  return null;
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function blockedReview(sourceTaskId, reason) {
  return {
    ok: false,
    blocked: true,
    registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
    mode: "declarative-evolution-activation-decision-review",
    sourceTaskId,
    reason,
    governance: {
      readsHealthGate: false,
      readsHostHealth: false,
      createsTask: false,
      createsApproval: false,
      writesManagedConfig: false,
      switchesGeneration: false,
      executesActivation: false,
      executesRollback: false,
      automaticActivation: false,
      automaticRollback: false,
      networkEgress: false,
      candidateTextExposed: false,
    },
  };
}

function projectHostHealth(health, now) {
  const system = health?.system && typeof health.system === "object" ? health.system : null;
  const serviceEntries = Object.entries(system?.services ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_SERVICE_STATES);
  const serviceStates = serviceEntries.map(([name, service]) => ({
    name,
    ok: service?.ok === true,
    status: typeof service?.status === "string" ? service.status : null,
  }));
  const alertCodes = (Array.isArray(system?.alerts) ? system.alerts : [])
    .map((alert) => typeof alert?.code === "string" ? alert.code : "unknown")
    .slice(0, MAX_ALERT_CODES)
    .sort();
  const alertCount = Array.isArray(system?.alerts) ? system.alerts.length : 0;
  const onlineServiceCount = serviceStates.filter((service) => service.ok).length;
  const degradedServiceCount = serviceStates.length - onlineServiceCount;
  const networkOnline = system?.network?.online === true;
  const healthFingerprint = {
    healthOk: health?.ok === true,
    networkOnline,
    serviceStates,
    alertCodes,
    alertCount,
  };
  const status = health?.ok !== true || !system
    ? "unavailable"
    : serviceStates.length === 0
      ? "unknown"
      : alertCount === 0 && degradedServiceCount === 0
        ? "healthy"
        : "degraded";

  return {
    status,
    observedAt: system?.timestamp ?? now(),
    serviceCount: serviceStates.length,
    onlineServiceCount,
    degradedServiceCount,
    alertCount,
    networkOnline,
    hostHealthHash: sha256Json(healthFingerprint),
    source: {
      service: "openclaw-system-sense",
      endpoint: "/system/health",
      readOnly: true,
    },
  };
}

function compactHealthGate(gate) {
  return {
    registry: gate?.registry ?? null,
    taskId: gate?.taskId ?? null,
    assessment: gate?.assessment?.status ?? null,
    eligibleForActivationReview: gate?.assessment?.eligibleForActivationReview === true,
    candidateHash: gate?.candidate?.candidateHash ?? null,
    candidateBytes: gate?.candidate?.candidateBytes ?? null,
    stagedFileHash: gate?.staging?.fileHash ?? null,
    stagedFileBytes: gate?.staging?.fileBytes ?? null,
    evaluatedClosurePath: gate?.evaluatedClosure?.path ?? null,
    failedCheckCount: Array.isArray(gate?.failedChecks) ? gate.failedChecks.length : null,
  };
}

function compactReview(review) {
  return {
    registry: review?.registry ?? null,
    sourceTaskId: review?.sourceTaskId ?? null,
    candidate: review?.candidate ?? null,
    healthGate: review?.healthGate ?? null,
    hostHealth: review?.hostHealth ?? null,
    activationReady: review?.activationReady === true,
    reason: review?.reason ?? null,
    binding: review?.binding ?? null,
  };
}

export function isNativeDeclarativeEvolutionActivationDecisionTask(task) {
  return task?.type === NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE
    && task?.plan?.strategy === "native-declarative-evolution-activation-decision-v0";
}

export function createNativeDeclarativeEvolutionActivationDecisionBuilders({
  tasks = new Map(),
  buildNativeDeclarativeEvolutionHealthGate,
  fetchJson,
  systemSenseUrl,
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
  async function readHostHealth() {
    if (typeof fetchJson !== "function" || typeof systemSenseUrl !== "string" || !systemSenseUrl) {
      return projectHostHealth({ ok: false }, now);
    }
    try {
      return projectHostHealth(await fetchJson(`${systemSenseUrl}/system/health`), now);
    } catch {
      return projectHostHealth({ ok: false }, now);
    }
  }

  async function buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId } = {}) {
    const sourceTaskId = normaliseTaskId(taskId);
    if (!sourceTaskId) return blockedReview(null, "staging_task_id_required");

    const sourceTask = findTask(tasks, sourceTaskId);
    if (!sourceTask) return blockedReview(sourceTaskId, "staging_task_not_found");
    if (sourceTask.type !== NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE) {
      return blockedReview(sourceTaskId, "task_is_not_declarative_evolution_staging");
    }
    if (typeof buildNativeDeclarativeEvolutionHealthGate !== "function") {
      return blockedReview(sourceTaskId, "health_gate_builder_unavailable");
    }

    const healthGate = await buildNativeDeclarativeEvolutionHealthGate({ taskId: sourceTaskId });
    if (healthGate?.blocked === true || healthGate?.assessment?.eligibleForActivationReview !== true) {
      return {
        ...blockedReview(sourceTaskId, healthGate?.reason
          ?? healthGate?.next?.recommendedAction
          ?? "health_gate_not_eligible"),
        healthGate: compactHealthGate(healthGate),
      };
    }

    const hostHealth = await readHostHealth();
    const binding = {
      kind: "native_declarative_evolution_activation_decision",
      sourceStagingTaskId: sourceTaskId,
      candidateHash: healthGate.candidate?.candidateHash ?? null,
      stagedFileHash: healthGate.staging?.fileHash ?? null,
      evaluatedClosurePath: healthGate.evaluatedClosure?.path ?? null,
      hostHealthHash: hostHealth.hostHealthHash,
    };
    const activationReady = hostHealth.status === "healthy";
    return {
      ok: true,
      blocked: false,
      registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
      mode: "declarative-evolution-activation-decision-review",
      generatedAt: now(),
      sourceTaskId,
      candidate: {
        candidateHash: healthGate.candidate?.candidateHash ?? null,
        candidateBytes: healthGate.candidate?.candidateBytes ?? null,
        targetPath: healthGate.candidate?.targetPath ?? null,
      },
      healthGate: compactHealthGate(healthGate),
      hostHealth,
      activationReady,
      reason: activationReady ? null : "host_health_not_healthy",
      binding,
      governance: {
        readsHealthGate: true,
        readsHostHealth: true,
        createsTask: false,
        createsApproval: false,
        writesManagedConfig: false,
        switchesGeneration: false,
        executesActivation: false,
        executesRollback: false,
        automaticActivation: false,
        automaticRollback: false,
        networkEgress: false,
        candidateTextExposed: false,
      },
      next: {
        recommendedAction: activationReady
          ? "create_explicit_activation_decision_task"
          : "observe_or_recover_host_before_activation_decision",
        activation: "manual_only",
        rollback: "manual_only",
        hostHealthRequired: true,
      },
    };
  }

  async function buildNativeDeclarativeEvolutionActivationDecisionTaskDraft({ taskId, decision } = {}) {
    const sourceTaskId = normaliseTaskId(taskId);
    const normalisedDecision = normaliseDecision(decision);
    if (!sourceTaskId) throw new Error("Declarative evolution activation decision requires taskId.");
    if (!normalisedDecision) throw new Error("Declarative evolution activation decision is invalid.");

    const review = await buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId: sourceTaskId });
    if (review.blocked === true) {
      throw new Error(`Declarative evolution activation decision is blocked: ${review.reason}.`);
    }
    if (normalisedDecision === "approve_activation_review" && review.activationReady !== true) {
      throw new Error("Declarative evolution activation decision requires healthy host state.");
    }

    const goal = `${normalisedDecision === "approve_activation_review" ? "Approve" : "Reject"} future activation review for managed Nix candidate ${review.candidate.candidateHash}`;
    const policyRequest = {
      intent: "openclaw.declarative_evolution.activation_decision",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      approved: false,
      decision: normalisedDecision,
      sourceStagingTaskId: sourceTaskId,
      candidateHash: review.binding.candidateHash,
      stagedFileHash: review.binding.stagedFileHash,
      evaluatedClosurePath: review.binding.evaluatedClosurePath,
      hostHealthHash: review.binding.hostHealthHash,
      tags: [
        "declarative_evolution",
        "activation_decision",
        "host_health_bound",
        "explicit_approval_required",
        "activation_not_executed",
      ],
    };
    const policyDecision = evaluatePolicyIntent({
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
      goal,
      policy: policyRequest,
    }, {
      stage: "declarative_evolution.activation_decision.draft",
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
      goal,
    });
    const approvalBinding = {
      ...review.binding,
      decision: normalisedDecision,
    };
    const timestamp = now();
    const plan = {
      planId: `plan-${randomUUID()}`,
      strategy: "native-declarative-evolution-activation-decision-v0",
      planner: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
      capabilityAware: true,
      status: "planned",
      goal,
      targetUrl: null,
      intent: policyRequest.intent,
      createdAt: timestamp,
      updatedAt: timestamp,
      review: compactReview(review),
      approvalBinding,
      capabilitySummary: {
        total: 4,
        approvalGates: 1,
        ids: [
          "sense.openclaw.declarative_evolution.health_gate",
          "sense.system.vitals",
          "govern.policy.evaluate",
          NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_CAPABILITY_ID,
        ],
        byRisk: { medium: 2, high: 2 },
      },
      steps: [
        {
          id: "step-review-managed-nix-health-gate",
          kind: "openclaw.declarative_evolution.health_gate_review",
          phase: "reviewing_health_gate",
          title: "Review the completed candidate and read-only Nix health-gate binding",
          status: "pending",
          capabilityId: "sense.openclaw.declarative_evolution.health_gate",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: { taskId: sourceTaskId },
        },
        {
          id: "step-review-current-host-health",
          kind: "openclaw.declarative_evolution.host_health_review",
          phase: "reviewing_current_host_health",
          title: "Review the current read-only host health fingerprint before deciding",
          status: "pending",
          capabilityId: "sense.system.vitals",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: {
            hostHealthHash: review.binding.hostHealthHash,
            status: review.hostHealth.status,
            serviceCount: review.hostHealth.serviceCount,
            alertCount: review.hostHealth.alertCount,
          },
        },
        {
          id: "step-approve-activation-decision",
          kind: "approval.gate",
          phase: "waiting_for_approval",
          title: "Wait for explicit approval bound to candidate and host health hashes",
          status: "pending",
          capabilityId: "govern.policy.evaluate",
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: approvalBinding,
        },
        {
          id: "step-record-activation-decision",
          kind: "openclaw.declarative_evolution.activation_decision",
          phase: "recording_activation_decision",
          title: "Record the explicit decision without activating a system generation",
          status: "pending",
          capabilityId: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_CAPABILITY_ID,
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: {
            ...approvalBinding,
            writesManagedConfig: false,
            switchesGeneration: false,
            executesActivation: false,
            executesRollback: false,
          },
        },
      ],
    };

    return {
      ok: true,
      registry: `${NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY}-draft`,
      mode: "approval-gated-native-declarative-evolution-activation-decision-draft",
      generatedAt: timestamp,
      review: compactReview(review),
      approvalBinding,
      plan,
      policy: { request: policyRequest, decision: policyDecision },
      governance: {
        runtimeOwner: "openclaw_on_nixos",
        sourceHealthGateBound: true,
        candidateHashBound: true,
        hostHealthBound: true,
        readsHostHealth: true,
        createsTask: false,
        createsApproval: false,
        writesManagedConfig: false,
        switchesGeneration: false,
        executesActivation: false,
        executesRollback: false,
        automaticActivation: false,
        automaticRollback: false,
        providerEgress: false,
        networkEgress: false,
        requiresExplicitApproval: true,
      },
    };
  }

  async function createNativeDeclarativeEvolutionActivationDecisionTask({ taskId, decision, confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Declarative evolution activation decision task creation requires confirm=true.");
    }
    const draft = await buildNativeDeclarativeEvolutionActivationDecisionTaskDraft({ taskId, decision });
    const task = createTask({
      goal: draft.plan.goal,
      type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
      workViewStrategy: "native-declarative-evolution-activation-decision",
      plan: draft.plan,
      policy: draft.policy.request,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    task.nativeDeclarativeEvolution = {
      registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-activation-decision-task",
      activationDecision: {
        ...draft.approvalBinding,
        review: draft.review,
      },
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
      planner: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
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
      registry: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-activation-decision-task",
      generatedAt: now(),
      review: draft.review,
      approvalBinding: draft.approvalBinding,
      task,
      approval,
      governance: {
        ...draft.governance,
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        executed: false,
      },
      autonomyMode,
    };
  }

  return {
    buildNativeDeclarativeEvolutionActivationDecisionReview,
    buildNativeDeclarativeEvolutionActivationDecisionTaskDraft,
    createNativeDeclarativeEvolutionActivationDecisionTask,
    readHostHealth,
  };
}
