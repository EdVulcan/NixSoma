import { createHash } from "node:crypto";

import {
  ENGINEERING_RECOMMENDATION_CONTRACT,
  ENGINEERING_RECOMMENDATION_REGISTRY,
  ENGINEERING_SEMANTIC_CLICK_ACTION_ID,
  ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID,
  ENGINEERING_SEMANTIC_CLICK_CONTROL_ID,
  NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY,
} from "./native-engineering-recommendation-link.mjs";

export const NATIVE_ENGINEERING_RECOMMENDATION_APPLICATION_RECEIPT_REGISTRY =
  "openclaw-native-engineering-recommendation-application-receipt-v0";

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function validRecommendationLink(link) {
  const experienceMemoryConsumptionReceiptHash = link?.source?.experienceMemoryConsumptionReceiptHash;
  return link?.registry === NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY
    && link.mode === "reviewed-provider-recommendation-to-semantic-click-task"
    && SAFE_ID.test(link.source?.taskId ?? "")
    && link.source?.taskType === "cloud_consciousness_live_provider_egress_execution_task"
    && link.source?.taskStatus === "completed"
    && link.source?.registry === ENGINEERING_RECOMMENDATION_REGISTRY
    && link.source?.contract === ENGINEERING_RECOMMENDATION_CONTRACT
    && SHA256.test(link.source?.responseContentHash ?? "")
    && (experienceMemoryConsumptionReceiptHash === undefined
      || SHA256.test(experienceMemoryConsumptionReceiptHash))
    && link.source?.evidence === "provider_execution_recommendation"
    && link.action?.actionId === ENGINEERING_SEMANTIC_CLICK_ACTION_ID
    && link.action?.capabilityId === ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID
    && link.action?.expectedObserverControlId === ENGINEERING_SEMANTIC_CLICK_CONTROL_ID
    && link.action?.requiresApproval === true
    && link.governance?.operatorReviewRequired === true
    && link.governance?.targetSelectedFromCurrentWorkView === true
    && link.governance?.automaticTaskCreationAllowed === false
    && link.governance?.automaticApprovalAllowed === false
    && link.governance?.automaticExecutionAllowed === false
    && link.governance?.arbitraryEndpointAllowed === false
    && link.governance?.providerCallAllowed === false
    && link.governance?.credentialValueIncluded === false
    && link.governance?.pagePayloadIncluded === false;
}

export function buildNativeEngineeringRecommendationApplicationReceipt({
  recommendationLink,
  downstreamTaskId,
  downstreamTaskType,
  appliedAt = new Date().toISOString(),
} = {}) {
  if (!validRecommendationLink(recommendationLink)
    || !SAFE_ID.test(downstreamTaskId ?? "")
    || downstreamTaskType !== "browser_task") {
    throw new Error("Native engineering recommendation application requires a validated downstream semantic-click task.");
  }

  const experienceMemoryConsumptionReceiptHash =
    recommendationLink.source.experienceMemoryConsumptionReceiptHash;
  const downstreamAdvisoryApplicationProven = typeof experienceMemoryConsumptionReceiptHash === "string";
  const receipt = {
    registry: NATIVE_ENGINEERING_RECOMMENDATION_APPLICATION_RECEIPT_REGISTRY,
    status: "applied_through_governed_control",
    appliedAt,
    providerTaskId: recommendationLink.source.taskId,
    downstreamTaskId,
    recommendationRegistry: recommendationLink.source.registry,
    responseContentHash: recommendationLink.source.responseContentHash,
    actionId: recommendationLink.action.actionId,
    capabilityId: recommendationLink.action.capabilityId,
    observerControlId: recommendationLink.action.expectedObserverControlId,
    recommendationLinkHash: sha256(JSON.stringify(recommendationLink)),
    ...(downstreamAdvisoryApplicationProven
      ? { experienceMemoryConsumptionReceiptHash }
      : {}),
    governance: {
      explicitOperatorSelection: true,
      existingControlReused: true,
      downstreamTaskBound: true,
      downstreamAdvisoryApplicationProven,
      downstreamExecutionProven: false,
      downstreamOutcomeProven: false,
      causalAttribution: false,
      createsAdditionalTask: false,
      createsAdditionalApproval: false,
      executesAutomatically: false,
      providerContentPersisted: false,
    },
  };
  return {
    ...receipt,
    receiptHash: sha256(JSON.stringify(receipt)),
  };
}

export function validateNativeEngineeringRecommendationApplicationReceipt(value) {
  const experienceMemoryConsumptionReceiptHash = value?.experienceMemoryConsumptionReceiptHash;
  const downstreamAdvisoryApplicationProven = value?.governance?.downstreamAdvisoryApplicationProven ?? false;
  if (!value
    || value.registry !== NATIVE_ENGINEERING_RECOMMENDATION_APPLICATION_RECEIPT_REGISTRY
    || value.status !== "applied_through_governed_control"
    || !SAFE_ID.test(value.providerTaskId ?? "")
    || !SAFE_ID.test(value.downstreamTaskId ?? "")
    || value.recommendationRegistry !== ENGINEERING_RECOMMENDATION_REGISTRY
    || !SHA256.test(value.responseContentHash ?? "")
    || (experienceMemoryConsumptionReceiptHash !== undefined
      && !SHA256.test(experienceMemoryConsumptionReceiptHash))
    || value.actionId !== ENGINEERING_SEMANTIC_CLICK_ACTION_ID
    || value.capabilityId !== ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID
    || value.observerControlId !== ENGINEERING_SEMANTIC_CLICK_CONTROL_ID
    || !SHA256.test(value.recommendationLinkHash ?? "")
    || !SHA256.test(value.receiptHash ?? "")
    || value.governance?.explicitOperatorSelection !== true
    || value.governance?.existingControlReused !== true
    || value.governance?.downstreamTaskBound !== true
    || downstreamAdvisoryApplicationProven !== (experienceMemoryConsumptionReceiptHash !== undefined)
    || value.governance?.downstreamExecutionProven !== false
    || value.governance?.downstreamOutcomeProven !== false
    || value.governance?.causalAttribution !== false
    || value.governance?.createsAdditionalTask !== false
    || value.governance?.createsAdditionalApproval !== false
    || value.governance?.executesAutomatically !== false
    || value.governance?.providerContentPersisted !== false) {
    return null;
  }
  const { receiptHash, ...receipt } = value;
  return sha256(JSON.stringify(receipt)) === receiptHash ? value : null;
}
