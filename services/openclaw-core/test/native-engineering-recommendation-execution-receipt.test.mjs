import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeEngineeringRecommendationExecutionReceipt,
  validateNativeEngineeringRecommendationExecutionReceipt,
} from "../src/native-engineering-recommendation-execution-receipt.mjs";
import {
  recommendationApplicationReceipt,
  recommendationExecutionEvidence,
} from "./native-engineering-recommendation-receipt-fixture.mjs";

test("recommendation execution receipt binds one verified semantic click", () => {
  const receipt = buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt: recommendationApplicationReceipt(),
    ...recommendationExecutionEvidence(),
  });

  assert.equal(receipt.status, "verified_action_executed");
  assert.equal(receipt.downstreamTaskId, "semantic-task-7");
  assert.equal(receipt.action.requestedKind, "browser.semantic_click");
  assert.equal(receipt.evidence.itemOrdinal, 2);
  assert.equal(receipt.evidence.postActionVerified, true);
  assert.equal(receipt.governance.downstreamActionExecutionProven, true);
  assert.equal(receipt.governance.recommendationEffectivenessProven, false);
  assert.equal(receipt.governance.causalAttribution, false);
  assert.equal(validateNativeEngineeringRecommendationExecutionReceipt(receipt), receipt);
  assert.equal(JSON.stringify(receipt).includes("private-target-id"), false);
  assert.equal("targetId" in receipt.evidence, false);
  assert.equal("url" in receipt.evidence, false);
});

test("recommendation execution receipt rejects mismatched or unverified actions", () => {
  const applicationReceipt = recommendationApplicationReceipt();
  const evidence = recommendationExecutionEvidence();
  assert.equal(buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt,
    ...evidence,
    downstreamTaskId: "changed-task",
  }), null);
  assert.equal(buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt,
    ...evidence,
    actionResults: [
      ...evidence.actionResults,
      evidence.actionResults[0],
    ],
  }), null);
  assert.equal(buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt,
    ...evidence,
    actionResults: [{
      ...evidence.actionResults[0],
      mediation: {
        ...evidence.actionResults[0].mediation,
        semanticClick: {
          ...evidence.actionResults[0].mediation.semanticClick,
          postActionVerified: false,
        },
      },
    }],
  }), null);
});

test("recommendation execution receipt validation rejects tampering", () => {
  const receipt = buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt: recommendationApplicationReceipt(),
    ...recommendationExecutionEvidence(),
  });
  assert.equal(validateNativeEngineeringRecommendationExecutionReceipt({
    ...receipt,
    downstreamTaskId: "changed-task",
  }), null);
  assert.equal(validateNativeEngineeringRecommendationExecutionReceipt({
    ...receipt,
    governance: { ...receipt.governance, causalAttribution: true },
  }), null);
});
