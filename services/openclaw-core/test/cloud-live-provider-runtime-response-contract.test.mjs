import test from "node:test";
import assert from "node:assert/strict";

import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
  buildCloudLiveProviderEngineeringRecommendationInstruction,
  parseCloudLiveProviderEngineeringRecommendation,
} from "../src/cloud-live-provider-runtime-response-contract.mjs";

function recommendationPayload(overrides = {}) {
  return {
    actionId: "create_verification_task",
    reason: "The current todo points to a bounded verification step.",
    confidence: 0.91,
    requiresOperatorReview: true,
    ...overrides,
  };
}

test("recommendation instruction derives the existing allowlisted action ids", () => {
  const instruction = buildCloudLiveProviderEngineeringRecommendationInstruction();

  assert.match(instruction, /review_current_todo/);
  assert.match(instruction, /create_edit_proposal_task/);
  assert.match(instruction, /create_write_proposal_task/);
  assert.match(instruction, /create_verification_task/);
  assert.match(instruction, /requiresOperatorReview must be true/);
  assert.match(instruction, /Do not include commands, file paths, URLs, credentials/);
});

test("valid JSON recommendation resolves to an existing governed action", () => {
  const result = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload()),
    responseContentHash: "response-hash",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recommendation.registry, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY);
  assert.equal(result.recommendation.actionId, "create_verification_task");
  assert.equal(result.recommendation.existingObserverControlId, "engineering-verification-task-button");
  assert.equal(result.recommendation.requiresOperatorReview, true);
  assert.equal(result.recommendation.requiresApproval, true);
  assert.equal(result.evidence.reason, null);
  assert.equal(result.evidence.reasonIncluded, false);
  assert.equal(result.evidence.responseContentHash, "response-hash");
});

test("fenced JSON recommendation is accepted without persisting its reason", () => {
  const reason = "Review the existing verification control after the latest evidence.";
  const result = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: `\n\`\`\`json\n${JSON.stringify(recommendationPayload({ reason }))}\n\`\`\`\n`,
    responseContentHash: "fenced-response-hash",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recommendation.reason, reason);
  assert.equal(result.evidence.reasonIncluded, false);
  assert.doesNotMatch(JSON.stringify(result.evidence), /Review the existing verification control/);
});

test("unknown actions and automatic execution flags fail closed", () => {
  const unknownAction = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload({ actionId: "run_arbitrary_command" })),
    responseContentHash: "unknown-action-hash",
  });
  assert.equal(unknownAction.ok, false);
  assert.equal(unknownAction.reason, "provider_recommendation_action_not_allowed");
  assert.equal(unknownAction.evidence.actionId, null);

  const automaticExecution = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload({ executesAutomatically: true })),
    responseContentHash: "automatic-execution-hash",
  });
  assert.equal(automaticExecution.ok, false);
  assert.equal(automaticExecution.reason, "provider_recommendation_governance_contract_failed");
  assert.equal(automaticExecution.evidence.reasonIncluded, false);
});

test("unknown response keys and invalid field types fail closed", () => {
  const unknownKey = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload({ command: "npm test" })),
    responseContentHash: "unknown-key-hash",
  });
  assert.equal(unknownKey.ok, false);
  assert.equal(unknownKey.reason, "provider_recommendation_keys_not_allowed");

  const invalidConfidence = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload({ confidence: "high" })),
    responseContentHash: "invalid-confidence-hash",
  });
  assert.equal(invalidConfidence.ok, false);
  assert.equal(invalidConfidence.reason, "provider_recommendation_fields_invalid");

  const missingConfidence = parseCloudLiveProviderEngineeringRecommendation({
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    assistantContent: JSON.stringify(recommendationPayload({ confidence: undefined })),
    responseContentHash: "missing-confidence-hash",
  });
  assert.equal(missingConfidence.ok, false);
  assert.equal(missingConfidence.reason, "provider_recommendation_fields_invalid");
});

test("an explicitly unknown response contract fails closed", () => {
  const result = parseCloudLiveProviderEngineeringRecommendation({
    contract: "unrecognized_contract_v99",
    assistantContent: JSON.stringify(recommendationPayload()),
    responseContentHash: "unknown-contract-hash",
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_recommendation_contract_not_supported");
  assert.equal(result.evidence.reason, "contract_not_supported");
});
