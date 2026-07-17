import { createHash } from "node:crypto";

export const SERVER_APPROVAL_CAPABILITY_IDS = new Set([
  "act.system.command.execute",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
  "act.filesystem.mkdir",
]);

const APPROVAL_BINDING_REGISTRY = "openclaw-capability-execution-approval-binding-v1";

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
    .filter((step) => SERVER_APPROVAL_CAPABILITY_IDS.has(step?.capabilityId))
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
    registry: APPROVAL_BINDING_REGISTRY,
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

export function validateCapabilityExecutionApproval({
  capability,
  request,
  tasks = new Map(),
  approvals = new Map(),
  persistState = () => {},
  reserve = false,
} = {}) {
  const required = SERVER_APPROVAL_CAPABILITY_IDS.has(capability?.id);
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
  if (currentStep.status === "running" || currentStep.status === "reserved") {
    return authorityResult({
      required,
      reason: "approval_step_already_consumed",
      task,
      approval,
      bindingHash: requestedHash,
    });
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

  const reservation = {
    stepId: currentStep.id,
    capabilityId: capability.id,
    requestHash: requestedHash,
  };
  if (reserve) {
    currentStep.status = "running";
    currentStep.executionReservation = reservation;
    if (task.plan) {
      task.plan.status = "running";
      task.plan.updatedAt = new Date().toISOString();
    }
    persistState();
  }

  return authorityResult({
    required,
    approved: true,
    task,
    approval,
    bindingHash: requestedHash,
    reservation,
  });
}
