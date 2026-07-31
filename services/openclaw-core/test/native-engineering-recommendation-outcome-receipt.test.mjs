import assert from "node:assert/strict";
import test from "node:test";

import { buildNativeEngineeringRecommendationApplicationReceipt } from "../src/native-engineering-recommendation-application-receipt.mjs";
import {
  buildNativeEngineeringRecommendationOutcomeReceipt,
  validateNativeEngineeringRecommendationOutcomeReceipt,
} from "../src/native-engineering-recommendation-outcome-receipt.mjs";

function applicationReceipt() {
  return buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: {
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
    },
    downstreamTaskId: "semantic-task-7",
    downstreamTaskType: "browser_task",
    appliedAt: "2026-07-31T12:01:00.000Z",
  });
}

test("recommendation outcome receipt binds one exact completed downstream terminal state", () => {
  const application = applicationReceipt();
  const receipt = buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: application,
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "completed",
    terminalPhase: "completed",
    observedAt: "2026-07-31T12:02:00.000Z",
  });

  assert.equal(receipt.applicationReceiptHash, application.receiptHash);
  assert.equal(receipt.terminalOutcome, "completed");
  assert.equal(receipt.governance.downstreamTerminalOutcomeObserved, true);
  assert.equal(receipt.governance.downstreamActionExecutionProven, false);
  assert.equal(receipt.governance.recommendationEffectivenessProven, false);
  assert.equal(receipt.governance.causalAttribution, false);
  assert.equal(receipt.governance.changesRanking, false);
  assert.equal(receipt.governance.changesPolicy, false);
  assert.equal(receipt.governance.outcomeContentPersisted, false);
  assert.equal(validateNativeEngineeringRecommendationOutcomeReceipt(receipt), receipt);
  assert.equal("summary" in receipt, false);
  assert.equal("details" in receipt, false);
});

test("recommendation outcome receipt accepts bounded failure without treating it as causal evidence", () => {
  const receipt = buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: applicationReceipt(),
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "failed",
    terminalPhase: "verifying_result",
  });
  assert.equal(receipt.terminalOutcome, "failed");
  assert.equal(receipt.governance.recommendationEffectivenessProven, false);
  assert.equal(receipt.governance.causalAttribution, false);
});

test("recommendation outcome receipt rejects mismatched tasks, non-terminal states, and tampering", () => {
  const application = applicationReceipt();
  assert.equal(buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: application,
    downstreamTaskId: "changed-task",
    terminalOutcome: "completed",
    terminalPhase: "completed",
  }), null);
  assert.equal(buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: application,
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "running",
    terminalPhase: "acting_on_target",
  }), null);
  const receipt = buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: application,
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "completed",
    terminalPhase: "completed",
  });
  assert.equal(validateNativeEngineeringRecommendationOutcomeReceipt({
    ...receipt,
    terminalOutcome: "failed",
  }), null);
  assert.equal(validateNativeEngineeringRecommendationOutcomeReceipt({
    ...receipt,
    governance: { ...receipt.governance, recommendationEffectivenessProven: true },
  }), null);
});
