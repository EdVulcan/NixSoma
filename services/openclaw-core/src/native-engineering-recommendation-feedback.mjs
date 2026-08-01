import { createHash } from "node:crypto";

import {
  validateNativeEngineeringRecommendationOutcomeReceipt,
} from "./native-engineering-recommendation-outcome-receipt.mjs";

export const NATIVE_ENGINEERING_RECOMMENDATION_FEEDBACK_REGISTRY =
  "openclaw-native-engineering-recommendation-feedback-v0";

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TERMINAL_OUTCOMES = new Set(["completed", "failed"]);
const FEEDBACK_RATINGS = new Set(["helpful", "not_helpful", "uncertain"]);

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function buildNativeEngineeringRecommendationFeedbackReceipt({
  taskId,
  recommendationOutcomeReceipt,
  rating,
  recordedAt = new Date().toISOString(),
} = {}) {
  const outcome = validateNativeEngineeringRecommendationOutcomeReceipt(
    recommendationOutcomeReceipt,
  );
  if (!outcome
    || !SAFE_ID.test(taskId ?? "")
    || outcome.downstreamTaskId !== taskId
    || !TERMINAL_OUTCOMES.has(outcome.terminalOutcome)
    || !FEEDBACK_RATINGS.has(rating)) {
    return null;
  }

  const receipt = {
    registry: NATIVE_ENGINEERING_RECOMMENDATION_FEEDBACK_REGISTRY,
    status: "operator_feedback_recorded",
    recordedAt,
    taskId,
    recommendationOutcomeReceiptHash: outcome.receiptHash,
    terminalOutcome: outcome.terminalOutcome,
    rating,
    feedbackBindingHash: sha256(JSON.stringify({
      taskId,
      recommendationOutcomeReceiptHash: outcome.receiptHash,
      terminalOutcome: outcome.terminalOutcome,
      rating,
    })),
    governance: {
      explicitOperatorFeedback: true,
      outcomeReceiptBound: true,
      causalAttribution: false,
      recommendationEffectivenessProven: false,
      changesRanking: false,
      changesPolicy: false,
      trainsProvider: false,
      createsTask: false,
      createsApproval: false,
      executesAction: false,
      callsProvider: false,
      networkEgress: false,
    },
  };

  return {
    ...receipt,
    receiptHash: sha256(JSON.stringify(receipt)),
  };
}

export function validateNativeEngineeringRecommendationFeedbackReceipt(value) {
  if (!value
    || value.registry !== NATIVE_ENGINEERING_RECOMMENDATION_FEEDBACK_REGISTRY
    || value.status !== "operator_feedback_recorded"
    || !SAFE_ID.test(value.taskId ?? "")
    || !SHA256.test(value.recommendationOutcomeReceiptHash ?? "")
    || !TERMINAL_OUTCOMES.has(value.terminalOutcome)
    || !FEEDBACK_RATINGS.has(value.rating)
    || !SHA256.test(value.feedbackBindingHash ?? "")
    || value.feedbackBindingHash !== sha256(JSON.stringify({
      taskId: value.taskId,
      recommendationOutcomeReceiptHash: value.recommendationOutcomeReceiptHash,
      terminalOutcome: value.terminalOutcome,
      rating: value.rating,
    }))
    || !SHA256.test(value.receiptHash ?? "")
    || value.governance?.explicitOperatorFeedback !== true
    || value.governance?.outcomeReceiptBound !== true
    || value.governance?.causalAttribution !== false
    || value.governance?.recommendationEffectivenessProven !== false
    || value.governance?.changesRanking !== false
    || value.governance?.changesPolicy !== false
    || value.governance?.trainsProvider !== false
    || value.governance?.createsTask !== false
    || value.governance?.createsApproval !== false
    || value.governance?.executesAction !== false
    || value.governance?.callsProvider !== false
    || value.governance?.networkEgress !== false) {
    return null;
  }

  const { receiptHash, ...receipt } = value;
  return sha256(JSON.stringify(receipt)) === receiptHash ? value : null;
}
