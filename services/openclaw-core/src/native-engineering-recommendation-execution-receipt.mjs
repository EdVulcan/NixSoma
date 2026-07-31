import { createHash } from "node:crypto";

import {
  validateNativeEngineeringRecommendationApplicationReceipt,
} from "./native-engineering-recommendation-application-receipt.mjs";
import {
  NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY,
} from "./native-engineering-work-view-semantic-action-handoff.mjs";

export const NATIVE_ENGINEERING_RECOMMENDATION_EXECUTION_RECEIPT_REGISTRY =
  "openclaw-native-engineering-recommendation-execution-receipt-v0";

const SEMANTIC_CLICK_DISPATCH_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-click-dispatch-v0";
const SEMANTIC_CLICK_RESOLUTION_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-click-resolution-v0";
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function validHandoff(handoff, downstreamTaskId) {
  const reference = handoff?.targetReference;
  const revalidation = handoff?.revalidation;
  return handoff?.registry === NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY
    && handoff.ok === true
    && handoff.status === "ready_for_dispatch"
    && handoff.task?.id === downstreamTaskId
    && handoff.actionKind === "browser.semantic_click"
    && reference?.operation === "click"
    && SHA256.test(reference.inventorySha256 ?? "")
    && SHA256.test(reference.frame?.sha256 ?? "")
    && Number.isInteger(reference.frame?.sequence)
    && reference.frame.sequence > 0
    && revalidation?.workViewAuthorityReady === true
    && revalidation?.workViewBindingReady === true
    && revalidation?.observationFresh === true
    && revalidation?.screenInventoryReady === true
    && revalidation?.screenVisualFrameReady === true
    && revalidation?.targetPresentInScreenInventory === true
    && revalidation?.screenInventoryMatchesReference === true
    && revalidation?.stateInventoryMatchesScreen === true
    && revalidation?.stateSemanticFrameMatchesReference === true
    && revalidation?.stateVisualFrameMatchesReference === true
    && revalidation?.screenSemanticFrameMatchesReference === true
    && revalidation?.screenVisualFrameMatchesReference === true
    && handoff.governance?.operatorReviewed === true
    && handoff.governance?.freshFrameRequired === true
    && handoff.governance?.frameScopedReferenceRequired === true
    && handoff.governance?.leaseRequired === true
    && handoff.governance?.automaticDispatch === false
    && handoff.governance?.providerCall === false;
}

function validAction(action) {
  const semanticClick = action?.mediation?.semanticClick;
  return SAFE_ID.test(action?.id ?? "")
    && action.kind === "mouse.click"
    && action.degraded === false
    && action.result === "executed-browser-runtime"
    && typeof action.executedAt === "string"
    && action.mediation?.registry === SEMANTIC_CLICK_DISPATCH_REGISTRY
    && action.mediation?.attempted === true
    && action.mediation?.accepted === true
    && action.mediation?.status === "executed"
    && action.mediation?.leaseMatched === true
    && action.mediation?.transport === "browser-runtime-direct"
    && semanticClick?.registry === SEMANTIC_CLICK_RESOLUTION_REGISTRY
    && SHA256.test(semanticClick.sceneContentHash ?? "")
    && Number.isInteger(semanticClick.itemOrdinal)
    && semanticClick.itemOrdinal > 0
    && Number.isInteger(semanticClick.itemCount)
    && semanticClick.itemCount >= semanticClick.itemOrdinal
    && semanticClick.browserMatched === true
    && semanticClick.frameMatched === true
    && semanticClick.sceneMatched === true
    && semanticClick.actionExecuted === true
    && semanticClick.postActionVerified === true
    && semanticClick.postFrameSequenceAdvanced === true;
}

function validVerification(verification) {
  return verification?.ok === true
    && verification.actionEvidence?.actionCount === 1
    && verification.actionEvidence?.degradedCount === 0
    && Array.isArray(verification.checks)
    && verification.checks.length > 0
    && verification.checks.every((check) => check?.passed === true)
    && Array.isArray(verification.failedChecks)
    && verification.failedChecks.length === 0;
}

export function buildNativeEngineeringRecommendationExecutionReceipt({
  applicationReceipt,
  downstreamTaskId,
  actionResults,
  semanticActionHandoff,
  verification,
  recordedAt = new Date().toISOString(),
} = {}) {
  const application = validateNativeEngineeringRecommendationApplicationReceipt(applicationReceipt);
  const action = Array.isArray(actionResults) && actionResults.length === 1
    ? actionResults[0]
    : null;
  if (!application
    || !SAFE_ID.test(downstreamTaskId ?? "")
    || application.downstreamTaskId !== downstreamTaskId
    || !validAction(action)
    || !validHandoff(semanticActionHandoff, downstreamTaskId)
    || !validVerification(verification)) {
    return null;
  }

  const semanticClick = action.mediation.semanticClick;
  const reference = semanticActionHandoff.targetReference;
  const evidenceBinding = {
    applicationReceiptHash: application.receiptHash,
    downstreamTaskId,
    actionId: action.id,
    sceneContentHash: semanticClick.sceneContentHash,
    itemOrdinal: semanticClick.itemOrdinal,
    itemCount: semanticClick.itemCount,
    frameSha256: reference.frame.sha256,
    frameSequence: reference.frame.sequence,
    inventorySha256: reference.inventorySha256,
    semanticActionHandoffHash: sha256(JSON.stringify(semanticActionHandoff)),
    verificationHash: sha256(JSON.stringify(verification)),
  };
  const receipt = {
    registry: NATIVE_ENGINEERING_RECOMMENDATION_EXECUTION_RECEIPT_REGISTRY,
    status: "verified_action_executed",
    recordedAt,
    providerTaskId: application.providerTaskId,
    downstreamTaskId,
    applicationReceiptHash: application.receiptHash,
    action: {
      actionId: action.id,
      requestedKind: "browser.semantic_click",
      runtimeKind: action.kind,
      result: action.result,
      executedAt: action.executedAt,
    },
    evidence: {
      semanticDispatchRegistry: action.mediation.registry,
      sceneContentHash: semanticClick.sceneContentHash,
      itemOrdinal: semanticClick.itemOrdinal,
      itemCount: semanticClick.itemCount,
      frameSha256: reference.frame.sha256,
      frameSequence: reference.frame.sequence,
      inventorySha256: reference.inventorySha256,
      semanticActionHandoffHash: evidenceBinding.semanticActionHandoffHash,
      verificationHash: evidenceBinding.verificationHash,
      executionBindingHash: sha256(JSON.stringify(evidenceBinding)),
      postActionVerified: true,
    },
    governance: {
      applicationProven: true,
      operatorReviewed: true,
      trustedHandoffProven: true,
      runtimeOwnerAccepted: true,
      downstreamActionExecutionProven: true,
      singleAction: true,
      recommendationEffectivenessProven: false,
      causalAttribution: false,
      changesRanking: false,
      changesPolicy: false,
      createsTask: false,
      createsApproval: false,
      executesAutomatically: false,
      callsProvider: false,
      targetIdentityPersisted: false,
      pageContentPersisted: false,
      providerContentPersisted: false,
    },
  };
  return { ...receipt, receiptHash: sha256(JSON.stringify(receipt)) };
}

export function validateNativeEngineeringRecommendationExecutionReceipt(value) {
  if (!value
    || value.registry !== NATIVE_ENGINEERING_RECOMMENDATION_EXECUTION_RECEIPT_REGISTRY
    || value.status !== "verified_action_executed"
    || !SAFE_ID.test(value.providerTaskId ?? "")
    || !SAFE_ID.test(value.downstreamTaskId ?? "")
    || !SHA256.test(value.applicationReceiptHash ?? "")
    || !SAFE_ID.test(value.action?.actionId ?? "")
    || value.action?.requestedKind !== "browser.semantic_click"
    || value.action?.runtimeKind !== "mouse.click"
    || value.action?.result !== "executed-browser-runtime"
    || value.evidence?.semanticDispatchRegistry !== SEMANTIC_CLICK_DISPATCH_REGISTRY
    || !SHA256.test(value.evidence?.sceneContentHash ?? "")
    || !Number.isInteger(value.evidence?.itemOrdinal)
    || value.evidence.itemOrdinal < 1
    || !Number.isInteger(value.evidence?.itemCount)
    || value.evidence.itemCount < value.evidence.itemOrdinal
    || !SHA256.test(value.evidence?.frameSha256 ?? "")
    || !Number.isInteger(value.evidence?.frameSequence)
    || value.evidence.frameSequence < 1
    || !SHA256.test(value.evidence?.inventorySha256 ?? "")
    || !SHA256.test(value.evidence?.semanticActionHandoffHash ?? "")
    || !SHA256.test(value.evidence?.verificationHash ?? "")
    || !SHA256.test(value.evidence?.executionBindingHash ?? "")
    || value.evidence?.postActionVerified !== true
    || value.governance?.applicationProven !== true
    || value.governance?.operatorReviewed !== true
    || value.governance?.trustedHandoffProven !== true
    || value.governance?.runtimeOwnerAccepted !== true
    || value.governance?.downstreamActionExecutionProven !== true
    || value.governance?.singleAction !== true
    || value.governance?.recommendationEffectivenessProven !== false
    || value.governance?.causalAttribution !== false
    || value.governance?.changesRanking !== false
    || value.governance?.changesPolicy !== false
    || value.governance?.createsTask !== false
    || value.governance?.createsApproval !== false
    || value.governance?.executesAutomatically !== false
    || value.governance?.callsProvider !== false
    || value.governance?.targetIdentityPersisted !== false
    || value.governance?.pageContentPersisted !== false
    || value.governance?.providerContentPersisted !== false
    || !SHA256.test(value.receiptHash ?? "")) {
    return null;
  }
  const { receiptHash, ...receipt } = value;
  return sha256(JSON.stringify(receipt)) === receiptHash ? value : null;
}
