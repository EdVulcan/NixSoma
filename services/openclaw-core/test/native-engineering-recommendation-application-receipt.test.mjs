import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeEngineeringRecommendationApplicationReceipt,
  validateNativeEngineeringRecommendationApplicationReceipt,
} from "../src/native-engineering-recommendation-application-receipt.mjs";

function recommendationLink() {
  return {
    registry: "openclaw-native-engineering-recommendation-link-v0",
    mode: "reviewed-provider-recommendation-to-semantic-click-task",
    generatedAt: "2026-07-31T12:00:00.000Z",
    source: {
      taskId: "provider-task-42",
      taskType: "cloud_consciousness_live_provider_egress_execution_task",
      taskStatus: "completed",
      registry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
      contract: "engineering_recommendation_v0",
      responseContentHash: "a".repeat(64),
      evidence: "provider_execution_recommendation",
    },
    action: {
      actionId: "create_semantic_click_task",
      capabilityId: "plan.openclaw.browser.semantic_click_task",
      expectedObserverControlId: "create-semantic-click-task-button",
      requiresApproval: true,
    },
    governance: {
      operatorReviewRequired: true,
      targetSelectedFromCurrentWorkView: true,
      automaticTaskCreationAllowed: false,
      automaticApprovalAllowed: false,
      automaticExecutionAllowed: false,
      arbitraryEndpointAllowed: false,
      providerCallAllowed: false,
      credentialValueIncluded: false,
      pagePayloadIncluded: false,
    },
  };
}

test("application receipt binds explicit recommendation selection to one downstream governed task", () => {
  const receipt = buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: recommendationLink(),
    downstreamTaskId: "semantic-task-7",
    downstreamTaskType: "browser_task",
    appliedAt: "2026-07-31T12:01:00.000Z",
  });

  assert.equal(receipt.providerTaskId, "provider-task-42");
  assert.equal(receipt.downstreamTaskId, "semantic-task-7");
  assert.equal(receipt.responseContentHash, "a".repeat(64));
  assert.equal(receipt.governance.explicitOperatorSelection, true);
  assert.equal(receipt.governance.existingControlReused, true);
  assert.equal(receipt.governance.downstreamTaskBound, true);
  assert.equal(receipt.governance.downstreamExecutionProven, false);
  assert.equal(receipt.governance.downstreamOutcomeProven, false);
  assert.equal(receipt.governance.causalAttribution, false);
  assert.equal(receipt.governance.providerContentPersisted, false);
  assert.equal(validateNativeEngineeringRecommendationApplicationReceipt(receipt), receipt);
  assert.equal("reason" in receipt, false);
  assert.equal("recommendation" in receipt, false);
});

test("application receipt rejects a non-governed link or a non-browser downstream task", () => {
  assert.throws(() => buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: {
      ...recommendationLink(),
      governance: { ...recommendationLink().governance, automaticExecutionAllowed: true },
    },
    downstreamTaskId: "semantic-task-7",
    downstreamTaskType: "browser_task",
  }), /validated downstream semantic-click task/u);
  assert.throws(() => buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: recommendationLink(),
    downstreamTaskId: "semantic-task-7",
    downstreamTaskType: "system_task",
  }), /validated downstream semantic-click task/u);
});

test("application receipt validation rejects changed binding and governance claims", () => {
  const receipt = buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: recommendationLink(),
    downstreamTaskId: "semantic-task-7",
    downstreamTaskType: "browser_task",
  });
  assert.equal(validateNativeEngineeringRecommendationApplicationReceipt({
    ...receipt,
    downstreamTaskId: "changed-task",
  }), null);
  assert.equal(validateNativeEngineeringRecommendationApplicationReceipt({
    ...receipt,
    recommendationLinkHash: "b".repeat(64),
  }), null);
  assert.equal(validateNativeEngineeringRecommendationApplicationReceipt({
    ...receipt,
    governance: { ...receipt.governance, downstreamOutcomeProven: true },
  }), null);
});
