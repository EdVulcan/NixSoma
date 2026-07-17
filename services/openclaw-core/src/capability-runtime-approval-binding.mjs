import { createHash, randomUUID } from "node:crypto";

export const EXECUTION_RESERVATION_REGISTRY = "openclaw-capability-execution-reservation-v1";
export const DEFAULT_EXECUTION_RESERVATION_TTL_MS = 5 * 60 * 1000;

const APPROVAL_BINDING_REGISTRY = "openclaw-capability-execution-approval-binding-v1";
const ACTIVE_RESERVATION_STATUSES = new Set(["reserved", "running"]);

function canonicalise(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalise(value[key])]),
  );
}

function getById(collection, id) {
  if (!collection || typeof collection.get !== "function") {
    return null;
  }
  return collection.get(id) ?? null;
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : new Date().toISOString();
}

function resolveReservationTtl(value) {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXECUTION_RESERVATION_TTL_MS;
}

function isActiveReservation(reservation) {
  return ACTIVE_RESERVATION_STATUSES.has(reservation?.status);
}

function isReservationExpired(reservation, now) {
  if (!reservation?.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(reservation.expiresAt);
  const nowMs = Date.parse(now);
  return !Number.isNaN(expiresAt) && !Number.isNaN(nowMs) && expiresAt <= nowMs;
}

export function isCapabilityApprovalRequired(capability) {
  return capability?.requiresApproval === true || capability?.governance === "require_approval";
}

export function buildCapabilityRequestBindingHash({ capabilityId, intent, params } = {}) {
  const payload = canonicalise({
    capabilityId: typeof capabilityId === "string" ? capabilityId : null,
    intent: typeof intent === "string" ? intent : null,
    params: params && typeof params === "object" ? params : {},
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function stepBindingHash(capability, step) {
  return buildCapabilityRequestBindingHash({
    capabilityId: capability?.id ?? step?.capabilityId,
    intent: step.intent ?? step.kind ?? null,
    params: step.params ?? {},
  });
}

export function buildCapabilityApprovalBinding({ task } = {}) {
  const steps = (Array.isArray(task?.plan?.steps) ? task.plan.steps : [])
    .filter((step) => step?.requiresApproval === true || step?.governance === "require_approval")
    .map((step) => ({
      stepId: typeof step.id === "string" && step.id.trim() ? step.id : null,
      capabilityId: step.capabilityId,
      intent: step.intent ?? step.kind ?? null,
      requestHash: stepBindingHash({ id: step.capabilityId }, step),
    }))
    .filter((step) => step.stepId && step.capabilityId && step.requestHash);

  if (steps.length === 0) {
    return null;
  }

  return {
    registry: "openclaw-capability-execution-approval-binding-v1",
    planId: task.plan?.planId ?? null,
    steps,
  };
}

function authorityResult({ required, approved = false, reason = null, task = null, approval = null, bindingHash = null, reservation = null } = {}) {
  return {
    required,
    ok: required ? approved === true && reason === null : true,
    approved: approved === true,
    reason,
    taskId: task?.id ?? null,
    approvalId: approval?.id ?? null,
    bindingHash,
    reservation,
  };
}

function updatePlanAfterReservation(task, at) {
  if (task?.plan) {
    task.plan.status = "running";
    task.plan.updatedAt = at;
  }
  task.updatedAt = at;
}

function findReservationTarget({ tasks, reservation } = {}) {
  const task = getById(tasks, reservation?.taskId);
  const step = (Array.isArray(task?.plan?.steps) ? task.plan.steps : [])
    .find((candidate) => candidate?.id === reservation?.stepId);
  const current = step?.executionReservation;
  if (!task || !step || current?.registry !== EXECUTION_RESERVATION_REGISTRY
    || current.reservationId !== reservation?.reservationId
    || current.requestHash !== reservation?.requestHash
    || current.capabilityId !== reservation?.capabilityId) {
    return null;
  }
  return { task, step, reservation: current };
}

function buildExecutionReceipt(reservation, status, at, reason = null) {
  return {
    registry: EXECUTION_RESERVATION_REGISTRY,
    reservationId: reservation.reservationId,
    taskId: reservation.taskId,
    stepId: reservation.stepId,
    capabilityId: reservation.capabilityId,
    requestHash: reservation.requestHash,
    status,
    at,
    reason,
  };
}

function releaseExpiredReservation({ task, step, persistState, now, reason }) {
  const at = resolveNow(now);
  const reservation = step.executionReservation;
  step.executionReservation = null;
  step.status = "pending";
  step.executionReceipt = buildExecutionReceipt(reservation, "expired", at, reason);
  updatePlanAfterReservation(task, at);
  persistState();
}

function failExpiredRunningReservation({ task, step, persistState, now, reason }) {
  const at = resolveNow(now);
  const reservation = step.executionReservation;
  step.executionReservation = null;
  step.status = "failed";
  step.completedAt = at;
  step.executionReceipt = buildExecutionReceipt(reservation, "expired_running", at, reason);
  updatePlanAfterReservation(task, at);
  persistState();
}

export function validateCapabilityExecutionApproval({
  capability,
  request,
  tasks = new Map(),
  approvals = new Map(),
  persistState = () => {},
  reserve = false,
  createId = randomUUID,
  now = () => new Date().toISOString(),
  reservationTtlMs = DEFAULT_EXECUTION_RESERVATION_TTL_MS,
} = {}) {
  const required = isCapabilityApprovalRequired(capability);
  if (!required) {
    return authorityResult({ required, approved: request?.approved === true });
  }

  if (!request?.taskId) {
    return authorityResult({ required, reason: "approval_task_required" });
  }

  const task = getById(tasks, request.taskId);
  if (!task) {
    return authorityResult({ required, reason: "approval_task_not_found" });
  }

  const approvalId = task.approval?.requestId;
  const approval = getById(approvals, approvalId);
  if (!approval) {
    return authorityResult({ required, reason: "approval_reference_missing", task });
  }
  if (approval.taskId !== task.id) {
    return authorityResult({ required, reason: "approval_task_mismatch", task, approval });
  }
  if (approval.status !== "approved") {
    return authorityResult({ required, reason: "approval_not_granted", task, approval });
  }

  const binding = approval.binding;
  if (binding?.registry !== APPROVAL_BINDING_REGISTRY || !Array.isArray(binding.steps)) {
    return authorityResult({ required, reason: "approval_binding_missing", task, approval });
  }
  if (binding.planId && binding.planId !== task.plan?.planId) {
    return authorityResult({ required, reason: "approval_plan_mismatch", task, approval });
  }

  if (!request.stepId) {
    return authorityResult({ required, reason: "approval_step_required", task, approval });
  }

  const requestedHash = buildCapabilityRequestBindingHash({
    capabilityId: capability.id,
    intent: request.intent ?? capability.intents?.[0] ?? null,
    params: request.params ?? {},
  });
  const boundStep = binding.steps.find((step) => (
    step.stepId === request.stepId
    && step.capabilityId === capability.id
    && step.requestHash === requestedHash
  ));
  const currentStep = (Array.isArray(task.plan?.steps) ? task.plan.steps : [])
    .find((step) => step?.id === request.stepId);

  if (!boundStep || !currentStep || currentStep.phase !== "acting_on_target") {
    return authorityResult({
      required,
      reason: "approval_request_mismatch",
      task,
      approval,
      bindingHash: requestedHash,
    });
  }

  if (currentStep.status === "completed" || currentStep.status === "skipped") {
    return authorityResult({
      required,
      reason: "approval_step_completed",
      task,
      approval,
      bindingHash: requestedHash,
    });
  }
  if (currentStep.status === "failed") {
    return authorityResult({
      required,
      reason: "approval_step_failed",
      task,
      approval,
      bindingHash: requestedHash,
    });
  }
  if (currentStep.status === "running" || currentStep.status === "reserved") {
    if (isActiveReservation(currentStep.executionReservation)) {
      const at = resolveNow(now);
      if (isReservationExpired(currentStep.executionReservation, at)) {
        if (currentStep.executionReservation.status === "reserved") {
          releaseExpiredReservation({
            task,
            step: currentStep,
            persistState,
            now: at,
            reason: "execution_reservation_expired_before_start",
          });
        } else {
          failExpiredRunningReservation({
            task,
            step: currentStep,
            persistState,
            now: at,
            reason: "execution_reservation_expired_while_running",
          });
          return authorityResult({
            required,
            reason: "approval_reservation_expired",
            task,
            approval,
            bindingHash: requestedHash,
          });
        }
      } else {
        return authorityResult({
          required,
          reason: "approval_step_already_consumed",
          task,
          approval,
          bindingHash: requestedHash,
          reservation: currentStep.executionReservation,
        });
      }
    } else {
      return authorityResult({
        required,
        reason: "approval_step_already_consumed",
        task,
        approval,
        bindingHash: requestedHash,
      });
    }
  }
  if (stepBindingHash(capability, currentStep) !== requestedHash) {
    return authorityResult({
      required,
      reason: "approval_plan_step_changed",
      task,
      approval,
      bindingHash: requestedHash,
    });
  }

  const at = resolveNow(now);
  const reservation = {
    registry: EXECUTION_RESERVATION_REGISTRY,
    reservationId: createId(),
    taskId: task.id,
    stepId: currentStep.id,
    capabilityId: capability.id,
    requestHash: requestedHash,
    status: "reserved",
    reservedAt: at,
    startedAt: null,
    expiresAt: new Date(Date.parse(at) + resolveReservationTtl(reservationTtlMs)).toISOString(),
  };
  if (reserve) {
    currentStep.status = "reserved";
    currentStep.executionReservation = reservation;
    updatePlanAfterReservation(task, at);
    persistState();
  }

  return authorityResult({
    required,
    approved: true,
    task,
    approval,
    bindingHash: requestedHash,
    reservation: reserve ? reservation : null,
  });
}

export function startCapabilityExecutionReservation({
  request,
  tasks = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  const requested = request?.serverApproval?.reservation;
  const target = findReservationTarget({ tasks, reservation: requested });
  if (!target || target.reservation.status !== "reserved") {
    return authorityResult({ required: true, reason: "approval_reservation_missing", reservation: requested ?? null });
  }
  const at = resolveNow(now);
  if (isReservationExpired(target.reservation, at)) {
    releaseExpiredReservation({
      task: target.task,
      step: target.step,
      persistState,
      now: at,
      reason: "execution_reservation_expired_before_start",
    });
    return authorityResult({
      required: true,
      reason: "approval_reservation_expired",
      task: target.task,
      bindingHash: target.reservation.requestHash,
    });
  }
  target.reservation.status = "running";
  target.reservation.startedAt = at;
  target.step.status = "running";
  updatePlanAfterReservation(target.task, at);
  persistState();
  return authorityResult({
    required: true,
    approved: true,
    task: target.task,
    bindingHash: target.reservation.requestHash,
    reservation: target.reservation,
  });
}

export function commitCapabilityExecutionReservation({
  request,
  tasks = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  const requested = request?.serverApproval?.reservation;
  const target = findReservationTarget({ tasks, reservation: requested });
  if (!target || !ACTIVE_RESERVATION_STATUSES.has(target.reservation.status)) {
    return authorityResult({ required: true, reason: "approval_reservation_missing", reservation: requested ?? null });
  }
  const at = resolveNow(now);
  if (isReservationExpired(target.reservation, at)) {
    failExpiredRunningReservation({
      task: target.task,
      step: target.step,
      persistState,
      now: at,
      reason: "execution_reservation_expired_before_commit",
    });
    return authorityResult({
      required: true,
      reason: "approval_reservation_expired",
      task: target.task,
      bindingHash: target.reservation.requestHash,
    });
  }
  const receipt = buildExecutionReceipt(target.reservation, "committed", at);
  target.step.status = "completed";
  target.step.completedAt = at;
  target.step.executionReservation = null;
  target.step.executionReceipt = receipt;
  updatePlanAfterReservation(target.task, at);
  persistState();
  return authorityResult({
    required: true,
    approved: true,
    task: target.task,
    bindingHash: receipt.requestHash,
    reservation: receipt,
  });
}

export function abortCapabilityExecutionReservation({
  request,
  tasks = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
  reason = "capability_execution_failed",
} = {}) {
  const requested = request?.serverApproval?.reservation;
  const target = findReservationTarget({ tasks, reservation: requested });
  if (!target || !ACTIVE_RESERVATION_STATUSES.has(target.reservation.status)) {
    return authorityResult({ required: true, reason: "approval_reservation_missing", reservation: requested ?? null });
  }
  const at = resolveNow(now);
  const receipt = buildExecutionReceipt(target.reservation, "aborted", at, reason);
  target.step.status = "pending";
  target.step.executionReservation = null;
  target.step.executionReceipt = receipt;
  updatePlanAfterReservation(target.task, at);
  persistState();
  return authorityResult({
    required: true,
    approved: true,
    task: target.task,
    bindingHash: receipt.requestHash,
    reservation: receipt,
  });
}

export function recoverCapabilityExecutionReservations({
  tasks = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
  reason = "core_runtime_restart",
} = {}) {
  const at = resolveNow(now);
  const recovered = [];
  for (const task of tasks.values()) {
    for (const step of Array.isArray(task?.plan?.steps) ? task.plan.steps : []) {
      if (!isActiveReservation(step.executionReservation)) {
        continue;
      }
      const reservation = step.executionReservation;
      step.status = "failed";
      step.completedAt = at;
      step.executionReservation = null;
      step.executionReceipt = buildExecutionReceipt(reservation, "recovered_aborted", at, reason);
      recovered.push({
        taskId: task.id,
        stepId: step.id,
        reservationId: reservation.reservationId,
        capabilityId: reservation.capabilityId,
        requestHash: reservation.requestHash,
      });
    }
  }
  if (recovered.length > 0) {
    persistState();
  }
  return recovered;
}
