import { hostdRestartCapabilityForTarget } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import {
  FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY,
  hashFixedUnitIncidentRepairPromotionBinding,
  validateFixedUnitIncidentTriageTask,
} from "./fixed-unit-incident-triage.mjs";

export const FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY =
  "openclaw-fixed-unit-incident-approved-dispatch-v0";
export const FIXED_UNIT_INCIDENT_DISPATCH_INTERRUPTED_CODE =
  "automatic_repair_dispatch_interrupted";

function automaticPromotion(task) {
  const promotion = task?.systemdIncidentRepairPromotion;
  return promotion?.registry === FIXED_UNIT_INCIDENT_REPAIR_PROMOTION_REGISTRY
    && promotion?.mode === "automatic_approval_gated_repair_task_creation"
    && promotion?.trigger === "scheduler"
    ? promotion
    : null;
}

export function validateAutomaticFixedUnitRepairDispatchReservation(task, schedulerState = {}) {
  const promotion = automaticPromotion(task);
  if (!promotion) return { automatic: false, ok: true, reason: null };
  const unitState = schedulerState.units?.[promotion.targetUnit];
  if (task?.approval?.status !== "approved"
    || unitState?.repairDispatchTaskId !== task.id
    || unitState?.repairDispatchStatus !== "reserved"
    || unitState?.latestRepairTaskId !== task.id
    || unitState?.latestRepairApprovalId !== task.approval?.requestId
    || unitState?.latestTriageTaskId !== promotion.triageTaskId) {
    return { automatic: true, ok: false, reason: "automatic_repair_dispatch_not_reserved" };
  }
  return { automatic: true, ok: true, reason: null };
}

function blocked(code, details = {}) {
  return {
    registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
    eligible: true,
    dispatched: false,
    status: "blocked",
    code,
    ...details,
  };
}

function validateDispatch({ task, approval, tasks, approvals, schedulerState, realExecutionRegistry }) {
  const promotion = automaticPromotion(task);
  if (!promotion) return { eligible: false };
  if (task.type !== "systemd_next_repair_task" || task.status !== "queued") {
    return { eligible: true, code: "repair_task_not_queued" };
  }
  const storedApproval = approvals.get(task.approval?.requestId);
  if (!storedApproval
    || storedApproval !== approval
    || storedApproval.id !== task.approval?.requestId
    || storedApproval.taskId !== task.id
    || storedApproval.status !== "approved"
    || task.approval?.status !== "approved") {
    return { eligible: true, code: "repair_approval_not_current" };
  }
  const triageTask = tasks.get(promotion.triageTaskId);
  const triageValidation = validateFixedUnitIncidentTriageTask(triageTask, { tasks, schedulerState });
  if (!triageValidation.ok) {
    return { eligible: true, code: triageValidation.reason };
  }
  const capability = hostdRestartCapabilityForTarget(triageValidation.target.unit);
  const promotionBinding = {
    triageTaskId: triageTask.id,
    triageBindingHash: triageValidation.triage.binding.bindingHash,
    sourceTaskId: triageValidation.sourceTask.id,
    sourceFingerprint: triageValidation.observation.fingerprint,
    targetUnit: triageValidation.target.unit,
    capabilityId: capability?.capabilityId ?? null,
  };
  if (!capability
    || promotion.bindingHash !== hashFixedUnitIncidentRepairPromotionBinding(promotionBinding)
    || Object.entries(promotionBinding).some(([key, value]) => promotion[key] !== value)) {
    return { eligible: true, code: "repair_promotion_binding_invalid" };
  }
  const repair = task.systemdNextRepair;
  if (repair?.registry !== realExecutionRegistry
    || repair?.target?.unit !== capability.targetUnit
    || repair?.capability?.capabilityId !== capability.capabilityId
    || repair?.capability?.operation !== capability.operation
    || repair?.command?.command !== "systemctl"
    || repair?.command?.args?.[0] !== "restart"
    || repair?.command?.args?.[1] !== capability.targetUnit
    || repair?.execution?.realExecutionEnabled !== true
    || repair?.execution?.executed !== false
    || repair?.execution?.hostMutation !== false) {
    return { eligible: true, code: "repair_execution_binding_invalid" };
  }
  const unitState = schedulerState.units?.[capability.targetUnit];
  if (unitState?.latestRepairTaskId !== task.id
    || unitState.latestRepairApprovalId !== storedApproval.id
    || unitState.latestTriageTaskId !== triageTask.id) {
    return { eligible: true, code: "repair_scheduler_binding_invalid" };
  }
  if (unitState.repairDispatchStatus) {
    return { eligible: true, code: "repair_dispatch_already_recorded" };
  }
  return {
    eligible: true,
    task,
    approval: storedApproval,
    promotion,
    target: triageValidation.target,
    unitState,
  };
}

export function createFixedUnitIncidentApprovedDispatcher({
  tasks = new Map(),
  approvals = new Map(),
  schedulerState = {},
  realExecutionRegistry,
  executeTaskWithRecovery,
  failTask = (task, reason, details) => {
    task.status = "failed";
    task.outcome = { kind: "failed", summary: reason, details };
    return task;
  },
  persistState = () => {},
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const inFlightByTask = new Map();

  function failApprovedTask(task, code) {
    if (!["queued", "running", "paused"].includes(task?.status)
      || task?.approval?.status !== "approved") return;
    failTask(task, "Automatic fixed-unit repair dispatch failed closed.", {
      executor: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
      code,
      automaticRetry: false,
    });
  }

  async function performDispatch({ task, approval }) {
    const validation = validateDispatch({
      task,
      approval,
      tasks,
      approvals,
      schedulerState,
      realExecutionRegistry,
    });
    if (!validation.eligible) return null;
    if (validation.code) {
      failApprovedTask(task, validation.code);
      return blocked(validation.code, { taskId: task?.id ?? null });
    }

    const authorizedAt = now();
    const audit = await publishAuditEvent("systemd.fixed_unit_incident_repair_dispatch_authorized", {
      registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
      taskId: task.id,
      approvalId: approval.id,
      triageTaskId: validation.promotion.triageTaskId,
      sourceTaskId: validation.promotion.sourceTaskId,
      sourceFingerprint: validation.promotion.sourceFingerprint,
      targetUnit: validation.target.unit,
      capabilityId: validation.promotion.capabilityId,
      promotionBindingHash: validation.promotion.bindingHash,
      automaticRecovery: false,
    }).catch(() => null);
    if (audit?.ok !== true) {
      failApprovedTask(task, "repair_dispatch_audit_failed");
      return blocked("repair_dispatch_audit_failed", { taskId: task.id });
    }

    Object.assign(validation.unitState, {
      repairApprovalStatus: "approved",
      repairDispatchTaskId: task.id,
      repairDispatchStatus: "reserved",
      repairDispatchAt: authorizedAt,
      repairDispatchCompletedAt: null,
      repairDispatchOutcomeStatus: null,
      repairDispatchFailure: null,
    });
    persistState();

    try {
      const execution = await executeTaskWithRecovery(task, {
        autoRecover: false,
        maxRecoveryAttempts: 0,
      });
      const finalExecution = execution?.finalExecution ?? execution;
      if (finalExecution?.task?.id !== task.id
        || !["completed", "failed"].includes(finalExecution?.task?.status)) {
        throw new Error("automatic_dispatch_execution_contract_invalid");
      }
      const completedAt = now();
      Object.assign(validation.unitState, {
        repairDispatchStatus: "completed",
        repairDispatchCompletedAt: completedAt,
        repairDispatchOutcomeStatus: finalExecution.task.status,
        repairDispatchFailure: null,
      });
      persistState();
      const completionAudit = await publishAuditEvent("systemd.fixed_unit_incident_repair_dispatch_completed", {
        registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
        taskId: task.id,
        approvalId: approval.id,
        targetUnit: validation.target.unit,
        taskStatus: finalExecution.task.status,
        hostMutationAttempted: finalExecution.execution?.hostMutationAttempted === true,
        automaticRecovery: false,
      }).catch(() => null);
      return {
        registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
        eligible: true,
        dispatched: true,
        status: "completed",
        code: null,
        taskId: task.id,
        approvalId: approval.id,
        targetUnit: validation.target.unit,
        taskStatus: finalExecution.task.status,
        automaticRecovery: false,
        completionAuditRecorded: completionAudit?.ok === true,
      };
    } catch {
      Object.assign(validation.unitState, {
        repairDispatchStatus: "failed",
        repairDispatchCompletedAt: now(),
        repairDispatchOutcomeStatus: null,
        repairDispatchFailure: {
          code: "automatic_repair_dispatch_failed",
          at: now(),
        },
      });
      persistState();
      failApprovedTask(task, "automatic_repair_dispatch_failed");
      await publishAuditEvent("systemd.fixed_unit_incident_repair_dispatch_failed", {
        registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
        taskId: task.id,
        approvalId: approval.id,
        targetUnit: validation.target.unit,
        code: "automatic_repair_dispatch_failed",
        automaticRetry: false,
      }).catch(() => null);
      return blocked("automatic_repair_dispatch_failed", { taskId: task.id });
    }
  }

  return async function dispatchApprovedFixedUnitRepair(input = {}) {
    const taskId = typeof input.task?.id === "string" ? input.task.id : null;
    if (!taskId) return performDispatch(input);
    const existing = inFlightByTask.get(taskId);
    if (existing) return existing;
    const operation = performDispatch(input);
    inFlightByTask.set(taskId, operation);
    try {
      return await operation;
    } finally {
      if (inFlightByTask.get(taskId) === operation) inFlightByTask.delete(taskId);
    }
  };
}

export function reconcileFixedUnitIncidentDispatchesAtStartup({
  tasks = new Map(),
  schedulerState = {},
  failTask = () => {},
  persistState = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  const items = [];
  for (const [unit, unitState] of Object.entries(schedulerState.units ?? {})) {
    if (unitState?.repairDispatchStatus !== "reserved") continue;
    const task = tasks.get(unitState.repairDispatchTaskId) ?? null;
    if (task && ["completed", "failed"].includes(task.status)) {
      Object.assign(unitState, {
        repairDispatchStatus: "completed",
        repairDispatchCompletedAt: unitState.repairDispatchCompletedAt ?? now(),
        repairDispatchOutcomeStatus: task.status,
        repairDispatchFailure: null,
      });
      items.push({ unit, taskId: task.id, outcome: "terminal_state_reconciled" });
      continue;
    }
    if (task && ["queued", "running", "paused"].includes(task.status)) {
      failTask(task, "Automatic fixed-unit repair dispatch was interrupted by Core restart.", {
        executor: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
        code: FIXED_UNIT_INCIDENT_DISPATCH_INTERRUPTED_CODE,
        automaticReplay: false,
        recoveryAction: "observe_current_incident_and_create_new_repair_task",
      });
    }
    const interruptedAt = now();
    Object.assign(unitState, {
      repairDispatchStatus: "failed",
      repairDispatchCompletedAt: interruptedAt,
      repairDispatchOutcomeStatus: null,
      repairDispatchFailure: {
        code: FIXED_UNIT_INCIDENT_DISPATCH_INTERRUPTED_CODE,
        at: interruptedAt,
      },
    });
    items.push({
      unit,
      taskId: task?.id ?? unitState.repairDispatchTaskId ?? null,
      outcome: "interrupted_failed_closed",
    });
  }
  if (items.length > 0) persistState();
  return {
    registry: FIXED_UNIT_INCIDENT_APPROVED_DISPATCH_REGISTRY,
    reconciledCount: items.length,
    automaticReplay: false,
    items,
  };
}
