import { buildNativeEngineeringWorkViewAssociation } from "./native-engineering-work-view-association.mjs";
import { materialiseBrowserTaskAction } from "./browser-task-action-contract.mjs";
import { invokeWorkViewAuthority } from "./work-view-authority-continuity.mjs";
import { normaliseWorkViewSemanticTargetReference } from "../../../packages/shared-utils/src/work-view-semantic-targets.mjs";

export const NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY =
  "openclaw-native-engineering-work-view-semantic-action-handoff-v0";

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function hasDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function boundedSequence(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function compactReference(reference) {
  if (!reference) return null;
  return {
    registry: reference.registry,
    operation: reference.operation,
    targetId: reference.targetId,
    inventorySha256: reference.inventorySha256,
    frame: reference.frame,
    selectorsExposed: false,
    arbitraryPageScript: false,
  };
}

function normaliseWorkViewStateResult(result) {
  if (result?.ok === false) {
    return { data: null, readStatus: "unavailable" };
  }
  if (result?.data && typeof result.data === "object") {
    return { data: result.data, readStatus: "available" };
  }
  return {
    data: result && typeof result === "object" ? result : null,
    readStatus: "available",
  };
}

function buildRevalidation({ association, reference, screen }) {
  const observation = asObject(association.observation);
  const stateVisualFrame = asObject(observation.visualFrame);
  const stateSemanticTargets = asObject(observation.semanticTargets);
  const visualFrame = asObject(screen.visualFrame);
  const semanticTargets = asObject(screen.semanticTargets);
  const targetPresent = Array.isArray(semanticTargets.items)
    && semanticTargets.items.some((target) => target?.targetId === reference?.targetId
      && target.visible === true
      && target.disabled !== true);
  const screenInventoryReady = semanticTargets.available === true
    && semanticTargets.truncated !== true
    && hasDigest(semanticTargets.inventorySha256)
    && hasDigest(semanticTargets.frame?.sha256)
    && boundedSequence(semanticTargets.frame?.sequence) !== null;
  const screenVisualReady = visualFrame.available === true
    && visualFrame.fresh === true
    && hasDigest(visualFrame.sha256)
    && boundedSequence(visualFrame.sequence) !== null;

  return {
    workViewAuthorityReady: association.semanticActionDecision.authority.actionAuthority === "active"
      && association.semanticActionDecision.authority.leaseMatched === true,
    workViewBindingReady: association.semanticActionDecision.binding.status === "bound",
    observationFresh: association.semanticActionDecision.observation.freshness === "fresh",
    screenInventoryReady,
    screenVisualFrameReady: screenVisualReady,
    targetPresentInScreenInventory: targetPresent,
    screenInventoryMatchesReference: semanticTargets.inventorySha256 === reference?.inventorySha256,
    stateInventoryMatchesScreen: stateSemanticTargets.inventorySha256 === semanticTargets.inventorySha256,
    stateSemanticFrameMatchesReference: stateSemanticTargets.frameSequence === reference?.frame?.sequence
      && stateSemanticTargets.frameSha256 === reference?.frame?.sha256,
    stateVisualFrameMatchesReference: stateVisualFrame.sequence === reference?.frame?.sequence
      && stateVisualFrame.sha256 === reference?.frame?.sha256,
    screenSemanticFrameMatchesReference: semanticTargets.frame?.sequence === reference?.frame?.sequence
      && semanticTargets.frame?.sha256 === reference?.frame?.sha256,
    screenVisualFrameMatchesReference: visualFrame.sequence === reference?.frame?.sequence
      && visualFrame.sha256 === reference?.frame?.sha256,
    visualGroundingRequired: screenVisualReady,
  };
}

export class NativeEngineeringSemanticActionHandoffBlockedError extends Error {
  constructor(handoff) {
    super(`Trusted semantic action handoff blocked: ${handoff.reason ?? "unknown"}`);
    this.name = "NativeEngineeringSemanticActionHandoffBlockedError";
    this.code = "native_engineering_semantic_action_handoff_blocked";
    this.handoff = handoff;
  }
}

export function buildNativeEngineeringWorkViewSemanticActionHandoff({
  task = null,
  action = null,
  workViewStateResult = null,
  screenResponse = null,
  now = () => new Date().toISOString(),
} = {}) {
  const { data: workViewState, readStatus } = normaliseWorkViewStateResult(workViewStateResult);
  const association = buildNativeEngineeringWorkViewAssociation({
    task,
    taskId: task?.id ?? null,
    workViewState,
    readStatus,
    includeWorkViewObservation: true,
    now,
  });
  const screen = asObject(screenResponse?.screen);
  const semanticTarget = normaliseWorkViewSemanticTargetReference(action?.params?.semanticTarget);
  const revalidation = buildRevalidation({
    association,
    reference: semanticTarget,
    screen,
  });
  const decision = association.semanticActionDecision;

  let reason = null;
  if (action?.kind !== "browser.semantic_click") {
    reason = "semantic_action_kind_not_allowed";
  } else if (!decision.readyForTargetSelection) {
    reason = decision.reason;
  } else if (!semanticTarget || semanticTarget.operation !== "click") {
    reason = "semantic_target_reference_invalid";
  } else if (!revalidation.screenInventoryReady || !revalidation.screenVisualFrameReady) {
    reason = "semantic_target_capture_not_ready";
  } else if (!revalidation.targetPresentInScreenInventory) {
    reason = "semantic_target_not_in_current_inventory";
  } else if (!revalidation.screenInventoryMatchesReference
    || !revalidation.screenSemanticFrameMatchesReference
    || !revalidation.screenVisualFrameMatchesReference) {
    reason = "semantic_target_capture_mismatch";
  }

  return {
    ok: reason === null,
    registry: NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY,
    mode: "operator_reviewed_trusted_work_view_semantic_click_handoff",
    generatedAt: now(),
    task: {
      id: typeof task?.id === "string" ? task.id.slice(0, 200) : null,
      status: task?.status ?? null,
    },
    actionKind: action?.kind ?? null,
    status: reason === null ? "ready_for_dispatch" : "blocked",
    reason,
    targetReference: compactReference(semanticTarget),
    decision: {
      status: decision.status,
      reason: decision.reason,
      readyForTargetSelection: decision.readyForTargetSelection,
      allowedActionKinds: ["browser.semantic_click"],
    },
    revalidation,
    governance: {
      operatorReviewed: true,
      freshFrameRequired: true,
      frameScopedReferenceRequired: true,
      leaseRequired: true,
      visualGroundingRequired: true,
      automaticSelection: false,
      automaticDispatch: false,
      pagePayloadExposed: false,
      selectorsExposed: false,
      inputValuesExposed: false,
      providerCall: false,
      networkEgress: false,
    },
  };
}

export function requireNativeEngineeringWorkViewSemanticActionHandoff(input) {
  const handoff = buildNativeEngineeringWorkViewSemanticActionHandoff(input);
  if (!handoff.ok) {
    throw new NativeEngineeringSemanticActionHandoffBlockedError(handoff);
  }
  return handoff;
}

export async function prepareNativeEngineeringWorkViewSemanticAction({
  action,
  task,
  screenResponse,
  readWorkViewState,
  sessionManagerUrl,
} = {}) {
  const dispatchedAction = materialiseBrowserTaskAction(action, screenResponse);
  if (action?.kind !== "browser.semantic_click") {
    return { action: dispatchedAction, handoff: null };
  }

  const workViewStateResult = await invokeWorkViewAuthority(
    "semantic_action_handoff",
    () => readWorkViewState({ sessionManagerUrl }),
  );
  const handoff = requireNativeEngineeringWorkViewSemanticActionHandoff({
    task,
    action: dispatchedAction,
    workViewStateResult,
    screenResponse,
  });
  return { action: dispatchedAction, handoff };
}
