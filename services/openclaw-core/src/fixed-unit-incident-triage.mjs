import { createHash } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { hostdRestartCapabilityForTarget } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import { validateFixedUnitIncidentTask } from "./fixed-unit-incident-scheduler.mjs";

export const FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY =
  "openclaw-fixed-unit-incident-triage-v0";
export const FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE =
  "systemd_fixed_unit_incident_triage_task";
export const FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY =
  "openclaw-fixed-unit-incident-repair-promotion-v0";

function bindingHash(binding) {
  return `sha256:${createHash("sha256").update(JSON.stringify(binding)).digest("hex")}`;
}

export function hashFixedUnitIncidentRepairPromotionBinding(binding) {
  return bindingHash(binding);
}

function sourceTaskId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new Error("Fixed-unit incident triage requires a bounded sourceTaskId.");
  }
  return value.trim();
}

function findExistingTriage(tasks, sourceId, fingerprint) {
  return [...tasks.values()].find((task) => (
    task.type === FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE
    && task.status === "completed"
    && task.systemdIncidentTriage?.source?.taskId === sourceId
    && task.systemdIncidentTriage?.source?.fingerprint === fingerprint
  )) ?? null;
}

function assertCurrentSchedulerSource(schedulerState, sourceTask, observation, target) {
  const unitState = schedulerState.units?.[target.unit];
  if (unitState?.status !== "unhealthy"
    || unitState.fingerprint !== observation.fingerprint
    || unitState.latestTaskId !== sourceTask.id) {
    throw new Error("Fixed-unit incident triage requires the scheduler's current unhealthy fingerprint.");
  }
}

export function validateFixedUnitIncidentTriageTask(task, { tasks, schedulerState }) {
  const triage = task?.systemdIncidentTriage;
  if (task?.type !== FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE || task?.status !== "completed") {
    return { ok: false, reason: "source_not_completed_fixed_unit_triage" };
  }
  if (triage?.registry !== FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY
    || triage?.governance?.createsApproval !== false
    || triage?.governance?.executesRepair !== false
    || triage?.governance?.invokesHostd !== false
    || triage?.governance?.callsProvider !== false) {
    return { ok: false, reason: "source_triage_authority_invalid" };
  }
  const sourceTask = tasks.get(triage.source?.taskId);
  const sourceValidation = validateFixedUnitIncidentTask(sourceTask);
  if (!sourceValidation.ok) {
    return { ok: false, reason: sourceValidation.reason };
  }
  const { observation, target } = sourceValidation;
  if (triage.source?.fingerprint !== observation.fingerprint
    || triage.source?.observedAt !== observation.observedAt
    || triage.target?.unit !== target.unit
    || triage.target?.healthServiceKey !== target.healthServiceKey
    || triage.repairPlanningBoundary?.targetUnit !== target.unit
    || triage.repairPlanningBoundary?.createsTask !== false
    || triage.repairPlanningBoundary?.createsApproval !== false
    || triage.repairPlanningBoundary?.executesRepair !== false) {
    return { ok: false, reason: "source_triage_binding_invalid" };
  }
  const binding = {
    sourceTaskId: sourceTask.id,
    sourceFingerprint: observation.fingerprint,
    sourceObservedAt: observation.observedAt,
    targetUnit: target.unit,
    healthServiceKey: target.healthServiceKey,
    repairDraftRegistry: triage.repairPlanningBoundary.registry,
    repairSourceRegistry: triage.repairPlanningBoundary.sourceRegistry,
  };
  if (triage.binding?.bindingHash !== bindingHash(binding)
    || Object.entries(binding).some(([key, value]) => triage.binding?.[key] !== value)) {
    return { ok: false, reason: "source_triage_hash_mismatch" };
  }
  try {
    assertCurrentSchedulerSource(schedulerState, sourceTask, observation, target);
  } catch {
    return { ok: false, reason: "source_incident_not_current" };
  }
  return { ok: true, reason: null, triage, sourceTask, observation, target };
}

function findExistingRepairPromotion(tasks, triageTaskId, triageBindingHash) {
  return [...tasks.values()].find((task) => (
    task.type === "systemd_next_repair_task"
    && task.systemdIncidentRepairPromotion?.triageTaskId === triageTaskId
    && task.systemdIncidentRepairPromotion?.triageBindingHash === triageBindingHash
  )) ?? null;
}

export function createFixedUnitIncidentTriageBuilders({
  tasks = new Map(),
  schedulerState = {},
  buildSystemdRepairExecutionTaskDraft,
  createSystemdNextRepairTaskShell,
  approvals = new Map(),
  evaluatePolicyIntent,
  createTask,
  completeTask,
  persistState = () => {},
  publishEvent = async () => ({ ok: true }),
  serialiseTask = (task) => task,
  now = () => new Date().toISOString(),
} = {}) {
  const inFlightBySourceTask = new Map();
  const inFlightRepairPromotionByTriageTask = new Map();

  async function performFixedUnitIncidentTriage(sourceId, trigger) {
    const sourceTask = tasks.get(sourceId);
    const validation = validateFixedUnitIncidentTask(sourceTask);
    if (!validation.ok) {
      throw new Error(`Fixed-unit incident triage rejected source: ${validation.reason}.`);
    }
    const observation = validation.observation;
    assertCurrentSchedulerSource(schedulerState, sourceTask, observation, validation.target);

    const existing = findExistingTriage(tasks, sourceTask.id, observation.fingerprint);
    if (existing) {
      return {
        registry: FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY,
        mode: existing.systemdIncidentTriage?.mode ?? "local_triage",
        generatedAt: existing.systemdIncidentTriage?.createdAt ?? existing.createdAt ?? null,
        task: existing,
        triage: existing.systemdIncidentTriage,
        governance: {
          createdTask: false,
          reusedExistingTask: true,
          createsApproval: false,
          executesRepair: false,
          invokesHostd: false,
          callsProvider: false,
        },
      };
    }

    const repairDraft = await buildSystemdRepairExecutionTaskDraft({
      unit: validation.target.unit,
      execute: false,
    });
    if (repairDraft?.target?.unit !== validation.target.unit
      || repairDraft?.governance?.createsTask !== false
      || repairDraft?.governance?.createsApproval !== false
      || repairDraft?.governance?.hostMutation !== false) {
      throw new Error("Fixed-unit incident triage repair draft crossed the planning boundary.");
    }
    assertCurrentSchedulerSource(schedulerState, sourceTask, observation, validation.target);

    const createdAt = now();
    const automatic = trigger === "scheduler";
    const binding = {
      sourceTaskId: sourceTask.id,
      sourceFingerprint: observation.fingerprint,
      sourceObservedAt: observation.observedAt,
      targetUnit: validation.target.unit,
      healthServiceKey: validation.target.healthServiceKey,
      repairDraftRegistry: repairDraft.registry,
      repairSourceRegistry: repairDraft.sourceRegistry,
    };
    const triage = {
      registry: FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY,
      mode: automatic ? "automatic_local_plan" : "operator_reviewed_local_plan",
      trigger: automatic ? "scheduler" : "operator",
      createdAt,
      binding: {
        ...binding,
        bindingHash: bindingHash(binding),
      },
      source: {
        taskId: sourceTask.id,
        registry: observation.registry,
        fingerprint: observation.fingerprint,
        observedAt: observation.observedAt,
      },
      target: { ...validation.target },
      repairPlanningBoundary: {
        registry: repairDraft.registry,
        sourceRegistry: repairDraft.sourceRegistry,
        targetUnit: repairDraft.target.unit,
        policyDecision: repairDraft.draft?.policy?.decision?.decision ?? null,
        createsTask: false,
        createsApproval: false,
        executesRepair: false,
      },
      governance: {
        domain: "body_internal",
        risk: "low",
        approvalRequired: false,
        sourceCurrent: true,
        createsApproval: false,
        executesRepair: false,
        invokesHostd: false,
        callsProvider: false,
        activatesGeneration: false,
        rollsBackGeneration: false,
      },
    };

    const audit = await publishEvent("systemd.fixed_unit_incident_triage_recorded", {
      registry: triage.registry,
      trigger: triage.trigger,
      source: triage.source,
      target: triage.target,
      binding: triage.binding,
      governance: triage.governance,
    });
    if (audit?.ok !== true) {
      throw new Error("Fixed-unit incident triage audit failed before task creation.");
    }
    assertCurrentSchedulerSource(schedulerState, sourceTask, observation, validation.target);

    const policyRequest = {
      intent: "systemd_incident.triage",
      domain: "body_internal",
      risk: "low",
      approvalRequired: false,
    };
    const policyDecision = evaluatePolicyIntent({
      type: FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE,
      goal: `${automatic ? "Prepare" : "Review"} local repair planning for scheduled incident on ${validation.target.unit}`,
      policy: policyRequest,
    }, {
      stage: "fixed_unit_incident_triage.task",
      type: FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE,
    });
    const task = createTask({
      goal: `${automatic ? "Prepare" : "Review"} local repair planning for scheduled incident on ${validation.target.unit}`,
      type: FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE,
      workViewStrategy: "local-systemd-incident-triage",
      plan: {
        planner: "fixed-unit-incident-triage-v0",
        strategy: automatic
          ? "automatic-local-systemd-triage"
          : "operator-reviewed-local-systemd-triage",
        summary: `Bind scheduled incident evidence to the existing repair draft for ${validation.target.unit}; stop before repair promotion, approval, or execution.`,
        steps: [
          {
            id: "review-scheduled-incident",
            phase: "review_scheduled_incident",
            title: "Review the current scheduler incident fingerprint",
            status: "completed",
            requiresApproval: false,
          },
          {
            id: "review-repair-planning-boundary",
            phase: "review_repair_planning_boundary",
            title: "Review the existing fixed-unit repair draft boundary",
            status: "completed",
            requiresApproval: false,
          },
        ],
      },
      policy: policyRequest,
      systemdIncidentTriage: triage,
    }, { skipInitialPolicy: true });
    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    const completedTask = completeTask(task, {
      summary: `${automatic ? "Prepared" : "Reviewed"} local repair planning boundary for ${validation.target.unit}.`,
      systemdIncidentTriage: triage,
      createsApproval: false,
      executesRepair: false,
    });
    persistState();
    await publishEvent(createEventName("task.created"), {
      task: serialiseTask(completedTask),
      planner: "fixed-unit-incident-triage-v0",
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
    });

    return {
      registry: FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY,
      mode: automatic ? "automatic_local_triage" : "operator_reviewed_local_triage",
      generatedAt: createdAt,
      task: completedTask,
      triage,
      governance: {
        createdTask: true,
        reusedExistingTask: false,
        createsApproval: false,
        executesRepair: false,
        invokesHostd: false,
        callsProvider: false,
      },
    };
  }

  async function createFixedUnitIncidentTriageTask({ sourceTaskId: inputTaskId = null, confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Fixed-unit incident triage task creation requires confirm=true.");
    }
    const sourceId = sourceTaskId(inputTaskId);
    const existingOperation = inFlightBySourceTask.get(sourceId);
    if (existingOperation) return existingOperation;

    const operation = performFixedUnitIncidentTriage(sourceId, "operator");
    inFlightBySourceTask.set(sourceId, operation);
    try {
      return await operation;
    } finally {
      if (inFlightBySourceTask.get(sourceId) === operation) {
        inFlightBySourceTask.delete(sourceId);
      }
    }
  }

  async function createAutomaticFixedUnitIncidentTriageTask({ sourceTaskId: inputTaskId = null } = {}) {
    const sourceId = sourceTaskId(inputTaskId);
    const existingOperation = inFlightBySourceTask.get(sourceId);
    if (existingOperation) return existingOperation;

    const operation = performFixedUnitIncidentTriage(sourceId, "scheduler");
    inFlightBySourceTask.set(sourceId, operation);
    try {
      return await operation;
    } finally {
      if (inFlightBySourceTask.get(sourceId) === operation) {
        inFlightBySourceTask.delete(sourceId);
      }
    }
  }

  async function performFixedUnitIncidentRepairPromotion(triageTaskId, trigger) {
    const triageTask = tasks.get(triageTaskId);
    const validation = validateFixedUnitIncidentTriageTask(triageTask, { tasks, schedulerState });
    if (!validation.ok) {
      throw new Error(`Fixed-unit incident repair promotion rejected source: ${validation.reason}.`);
    }
    const existing = findExistingRepairPromotion(
      tasks,
      triageTask.id,
      validation.triage.binding.bindingHash,
    );
    if (existing) {
      return {
        registry: FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY,
        mode: existing.systemdIncidentRepairPromotion?.mode ?? "approval_gated_repair_promotion",
        generatedAt: existing.systemdIncidentRepairPromotion?.createdAt ?? existing.createdAt ?? null,
        task: existing,
        approval: approvals.get(existing.approval?.requestId) ?? null,
        promotion: existing.systemdIncidentRepairPromotion,
        governance: {
          createdTask: false,
          reusedExistingTask: true,
          createsApproval: true,
          executesRepair: false,
          invokesHostd: false,
          callsProvider: false,
        },
      };
    }

    const capability = hostdRestartCapabilityForTarget(validation.target.unit);
    if (!capability) {
      throw new Error("Fixed-unit incident repair promotion requires a hostd fixed target.");
    }
    const createdAt = now();
    const automatic = trigger === "scheduler";
    const promotionBinding = {
      triageTaskId: triageTask.id,
      triageBindingHash: validation.triage.binding.bindingHash,
      sourceTaskId: validation.sourceTask.id,
      sourceFingerprint: validation.observation.fingerprint,
      targetUnit: validation.target.unit,
      capabilityId: capability.capabilityId,
    };
    const promotion = {
      registry: FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY,
      mode: automatic
        ? "automatic_approval_gated_repair_task_creation"
        : "operator_reviewed_approval_gated_repair_task_creation",
      trigger: automatic ? "scheduler" : "operator",
      createdAt,
      ...promotionBinding,
      bindingHash: hashFixedUnitIncidentRepairPromotionBinding(promotionBinding),
      governance: {
        risk: "high",
        requiresApproval: true,
        createsTask: true,
        createsApproval: true,
        executesRepair: false,
        invokesHostd: false,
        callsProvider: false,
      },
    };
    const result = await createSystemdNextRepairTaskShell({
      confirm: true,
      execute: true,
      targetUnit: validation.target.unit,
      supersedeExistingTasks: !automatic,
      sourceIncidentRepairPromotion: promotion,
      validateBeforeCreate: async () => {
        const current = validateFixedUnitIncidentTriageTask(triageTask, { tasks, schedulerState });
        if (!current.ok) {
          throw new Error(`Fixed-unit incident repair promotion source changed before task creation: ${current.reason}.`);
        }
        const audit = await publishEvent("systemd.fixed_unit_incident_repair_promoted", {
          registry: promotion.registry,
          trigger: promotion.trigger,
          triageTaskId: promotion.triageTaskId,
          sourceTaskId: promotion.sourceTaskId,
          sourceFingerprint: promotion.sourceFingerprint,
          targetUnit: promotion.targetUnit,
          capabilityId: promotion.capabilityId,
          bindingHash: promotion.bindingHash,
          governance: promotion.governance,
        });
        if (audit?.ok !== true) {
          throw new Error("Fixed-unit incident repair promotion audit failed before task creation.");
        }
      },
    });
    if (result.task?.systemdNextRepair?.target?.unit !== validation.target.unit
      || result.task?.systemdIncidentRepairPromotion?.bindingHash !== promotion.bindingHash
      || result.approval?.status !== "pending"
      || result.governance?.executed !== false
      || result.governance?.hostMutation !== false) {
      throw new Error("Fixed-unit incident repair promotion crossed its task-creation boundary.");
    }
    return {
      registry: FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY,
      mode: automatic
        ? "automatic_approval_gated_repair_promotion"
        : "operator_reviewed_approval_gated_repair_promotion",
      generatedAt: createdAt,
      task: result.task,
      approval: result.approval,
      promotion,
      governance: {
        createdTask: true,
        reusedExistingTask: false,
        createsApproval: true,
        executesRepair: false,
        invokesHostd: false,
        callsProvider: false,
      },
    };
  }

  async function createFixedUnitIncidentRepairTask({ triageTaskId: inputTaskId = null, confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Fixed-unit incident repair promotion requires confirm=true.");
    }
    const taskId = sourceTaskId(inputTaskId);
    const existingOperation = inFlightRepairPromotionByTriageTask.get(taskId);
    if (existingOperation) return existingOperation;
    const operation = performFixedUnitIncidentRepairPromotion(taskId, "operator");
    inFlightRepairPromotionByTriageTask.set(taskId, operation);
    try {
      return await operation;
    } finally {
      if (inFlightRepairPromotionByTriageTask.get(taskId) === operation) {
        inFlightRepairPromotionByTriageTask.delete(taskId);
      }
    }
  }

  async function createAutomaticFixedUnitIncidentRepairTask({ triageTaskId: inputTaskId = null } = {}) {
    const taskId = sourceTaskId(inputTaskId);
    const existingOperation = inFlightRepairPromotionByTriageTask.get(taskId);
    if (existingOperation) return existingOperation;
    const operation = performFixedUnitIncidentRepairPromotion(taskId, "scheduler");
    inFlightRepairPromotionByTriageTask.set(taskId, operation);
    try {
      return await operation;
    } finally {
      if (inFlightRepairPromotionByTriageTask.get(taskId) === operation) {
        inFlightRepairPromotionByTriageTask.delete(taskId);
      }
    }
  }

  return {
    createFixedUnitIncidentTriageTask,
    createAutomaticFixedUnitIncidentTriageTask,
    createFixedUnitIncidentRepairTask,
    createAutomaticFixedUnitIncidentRepairTask,
  };
}
