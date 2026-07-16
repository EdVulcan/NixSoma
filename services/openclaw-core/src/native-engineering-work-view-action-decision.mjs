export const NATIVE_ENGINEERING_WORK_VIEW_ACTION_DECISION_REGISTRY =
  "openclaw-native-engineering-work-view-action-decision-v0";

const ALLOWED_RECOVERY_ACTIONS = new Set([
  "prepare_work_view",
  "reveal_work_view",
]);

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function boundedCount(value, max) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, max) : 0;
}

function hasDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function compactTaskId(taskId) {
  return hasText(taskId) ? taskId.trim().slice(0, 200) : null;
}

function recommendationFor({ reason, recoveryAction }) {
  if (ALLOWED_RECOVERY_ACTIONS.has(recoveryAction)) {
    return {
      action: recoveryAction,
      existingObserverControlId: "engineering-context-packet-recovery-button",
      existingCapabilityId: "act.work_view.control",
    };
  }
  if (["work_view_task_not_bound", "work_view_binding_stale"].includes(reason)) {
    return {
      action: "bind_task_to_work_view",
      existingObserverControlId: "engineering-context-packet-bind-work-view-button",
      existingCapabilityId: "act.openclaw.engineering_context.work_view_bind",
    };
  }
  if (reason === "observation_not_requested" || reason === "observation_not_fresh") {
    return {
      action: "refresh_work_view_observation",
      existingObserverControlId: "engineering-context-packet-build-button",
      existingCapabilityId: "sense.openclaw.engineering_context.packet",
    };
  }
  return {
    action: "none",
    existingObserverControlId: null,
    existingCapabilityId: null,
  };
}

function decisionReason({ task, binding, authority, observation } = {}) {
  if (!task) return "task_selection_required";
  if (binding?.status === "work_view_state_unavailable") return "work_view_state_unavailable";
  if (binding?.status === "authority_not_ready") return "work_view_authority_not_ready";
  if (["stale_session_binding", "stale_work_view_binding"].includes(binding?.status)) {
    return "work_view_binding_stale";
  }
  if (binding?.status !== "bound") return "work_view_task_not_bound";
  if (authority?.identityStatus !== "authoritative"
    || authority?.actionAuthority !== "active"
    || authority?.leaseMatched !== true) {
    return "work_view_authority_not_ready";
  }
  if (!observation) return "observation_not_requested";
  if (observation.status !== "ready") return "observation_not_ready";
  if (observation.freshness !== "fresh") return "observation_not_fresh";

  const visualFrame = asObject(observation.visualFrame);
  const semanticTargets = asObject(observation.semanticTargets);
  if (visualFrame.available !== true
    || visualFrame.fresh !== true
    || !hasDigest(visualFrame.sha256)
    || boundedCount(visualFrame.sequence, 2 ** 31 - 1) < 1) {
    return "visual_frame_not_ready";
  }
  if (semanticTargets.available !== true || boundedCount(semanticTargets.itemCount, 64) < 1) {
    return "semantic_target_inventory_unavailable";
  }
  if (semanticTargets.truncated === true) return "semantic_target_inventory_incomplete";
  if (!hasDigest(semanticTargets.inventorySha256)
    || !hasDigest(semanticTargets.frameSha256)
    || boundedCount(semanticTargets.frameSequence, 2 ** 31 - 1) < 1
    || semanticTargets.frameSequence !== visualFrame.sequence
    || semanticTargets.frameSha256 !== visualFrame.sha256) {
    return "semantic_target_frame_mismatch";
  }
  return null;
}

export function buildNativeEngineeringWorkViewActionDecision({
  task = null,
  taskId = null,
  binding = null,
  authority = null,
  observation = null,
  recoveryAction = "none",
  now = () => new Date().toISOString(),
} = {}) {
  const reason = decisionReason({ task, binding, authority, observation });
  const readyForTargetSelection = reason === null;
  const selectedTaskId = compactTaskId(task?.id ?? taskId);
  const safeObservation = asObject(observation);
  const visualFrame = asObject(safeObservation.visualFrame);
  const semanticTargets = asObject(safeObservation.semanticTargets);
  const recommendation = recommendationFor({ reason, recoveryAction });

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_WORK_VIEW_ACTION_DECISION_REGISTRY,
    mode: "reviewed_trusted_work_view_semantic_action_readiness",
    generatedAt: now(),
    task: {
      id: selectedTaskId,
      status: task?.status ?? null,
      selected: Boolean(task),
    },
    decision: readyForTargetSelection ? "allow_target_selection" : "block",
    status: readyForTargetSelection ? "ready_for_target_selection" : "blocked",
    reason,
    readyForTargetSelection,
    actionFamily: "browser.semantic_target",
    allowedActionKinds: ["browser.semantic_click"],
    binding: {
      status: binding?.status ?? "unknown",
      sessionMatched: binding?.sessionMatched === true,
      workViewMatched: binding?.workViewMatched === true,
    },
    authority: {
      identityStatus: authority?.identityStatus ?? null,
      actionAuthority: authority?.actionAuthority ?? "inactive",
      leaseMatched: authority?.leaseMatched === true,
    },
    observation: {
      included: observation !== null,
      status: safeObservation.status ?? "missing",
      freshness: safeObservation.freshness ?? "missing",
      sequence: boundedCount(safeObservation.sequence, 2 ** 31 - 1),
      visualFrame: {
        available: visualFrame.available === true,
        fresh: visualFrame.fresh === true,
        sequence: boundedCount(visualFrame.sequence, 2 ** 31 - 1),
        digestPresent: hasDigest(visualFrame.sha256),
      },
      semanticTargets: {
        available: semanticTargets.available === true,
        itemCount: boundedCount(semanticTargets.itemCount, 64),
        truncated: semanticTargets.truncated === true,
        inventoryDigestPresent: hasDigest(semanticTargets.inventorySha256),
        frameSequence: boundedCount(semanticTargets.frameSequence, 2 ** 31 - 1),
        frameDigestPresent: hasDigest(semanticTargets.frameSha256),
        itemsExposed: false,
        selectorsExposed: false,
      },
    },
    recommendation: {
      ...recommendation,
      operatorReviewRequired: true,
      automaticSelection: false,
      automaticDispatch: false,
    },
    governance: {
      readOnly: true,
      consumesBoundedObservation: observation !== null,
      selectsTarget: false,
      dispatchesAction: false,
      mutatesTaskState: false,
      mutatesWorkViewState: false,
      createsTask: false,
      createsApproval: false,
      callsProvider: false,
      networkEgress: false,
      exposesSessionId: false,
      exposesLeaseId: false,
      exposesActiveUrl: false,
      exposesSemanticTargetItems: false,
      exposesSelectors: false,
    },
    deferredExecutionBoundaries: [
      "operator must select a target through the existing semantic action lane",
      "target selection must use a current frame-scoped inventory reference",
      "no automatic action dispatch, task creation, or approval creation",
      "no provider call, credential access, or external network egress",
    ],
  };
}
