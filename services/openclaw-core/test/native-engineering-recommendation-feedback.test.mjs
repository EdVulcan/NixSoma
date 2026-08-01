import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeEngineeringRecommendationFeedbackReceipt,
  NATIVE_ENGINEERING_RECOMMENDATION_FEEDBACK_REGISTRY,
  validateNativeEngineeringRecommendationFeedbackReceipt,
} from "../src/native-engineering-recommendation-feedback.mjs";
import { buildNativeEngineeringRecommendationOutcomeReceipt } from "../src/native-engineering-recommendation-outcome-receipt.mjs";
import { recommendationApplicationReceipt } from "./native-engineering-recommendation-receipt-fixture.mjs";

function outcomeReceipt() {
  return buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: recommendationApplicationReceipt(),
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "completed",
    terminalPhase: "completed",
    observedAt: "2026-08-01T17:00:00.000Z",
  });
}

test("recommendation feedback binds one explicit rating to the terminal outcome receipt", () => {
  const receipt = buildNativeEngineeringRecommendationFeedbackReceipt({
    taskId: "semantic-task-7",
    recommendationOutcomeReceipt: outcomeReceipt(),
    rating: "helpful",
    recordedAt: "2026-08-01T17:01:00.000Z",
  });

  assert.equal(receipt.registry, NATIVE_ENGINEERING_RECOMMENDATION_FEEDBACK_REGISTRY);
  assert.equal(receipt.rating, "helpful");
  assert.equal(receipt.governance.explicitOperatorFeedback, true);
  assert.equal(receipt.governance.causalAttribution, false);
  assert.equal(receipt.governance.changesRanking, false);
  assert.equal(receipt.governance.changesPolicy, false);
  assert.equal(validateNativeEngineeringRecommendationFeedbackReceipt(receipt), receipt);
});

test("recommendation feedback rejects mismatched tasks, ratings, and tampering", () => {
  const outcome = outcomeReceipt();
  assert.equal(buildNativeEngineeringRecommendationFeedbackReceipt({
    taskId: "other-task",
    recommendationOutcomeReceipt: outcome,
    rating: "helpful",
  }), null);
  assert.equal(buildNativeEngineeringRecommendationFeedbackReceipt({
    taskId: "semantic-task-7",
    recommendationOutcomeReceipt: outcome,
    rating: "maybe",
  }), null);

  const receipt = buildNativeEngineeringRecommendationFeedbackReceipt({
    taskId: "semantic-task-7",
    recommendationOutcomeReceipt: outcome,
    rating: "uncertain",
  });
  assert.equal(validateNativeEngineeringRecommendationFeedbackReceipt({
    ...receipt,
    rating: "helpful",
  }), null);
});
