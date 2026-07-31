import {
  buildNativeEngineeringRecommendationApplicationReceipt,
} from "../src/native-engineering-recommendation-application-receipt.mjs";
import {
  buildNativeEngineeringRecommendationExecutionReceipt,
} from "../src/native-engineering-recommendation-execution-receipt.mjs";

export function recommendationApplicationReceipt() {
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

export function recommendationExecutionEvidence({ downstreamTaskId = "semantic-task-7" } = {}) {
  const frameSha256 = "b".repeat(64);
  const inventorySha256 = "c".repeat(64);
  return {
    downstreamTaskId,
    actionResults: [{
      id: "semantic-click-action-9",
      kind: "mouse.click",
      degraded: false,
      result: "executed-browser-runtime",
      executedAt: "2026-07-31T12:01:30.000Z",
      mediation: {
        registry: "nixsoma-ai-browser-semantic-scene-click-dispatch-v0",
        attempted: true,
        accepted: true,
        status: "executed",
        leaseMatched: true,
        transport: "browser-runtime-direct",
        semanticClick: {
          registry: "nixsoma-ai-browser-semantic-scene-click-resolution-v0",
          sceneContentHash: "d".repeat(64),
          itemOrdinal: 2,
          itemCount: 5,
          browserMatched: true,
          frameMatched: true,
          sceneMatched: true,
          actionExecuted: true,
          postActionVerified: true,
          postFrameSequenceAdvanced: true,
          postFrameChanged: true,
        },
      },
    }],
    semanticActionHandoff: {
      ok: true,
      registry: "openclaw-native-engineering-work-view-semantic-action-handoff-v0",
      mode: "operator_reviewed_trusted_work_view_semantic_click_handoff",
      generatedAt: "2026-07-31T12:01:20.000Z",
      task: { id: downstreamTaskId, status: "running" },
      actionKind: "browser.semantic_click",
      status: "ready_for_dispatch",
      reason: null,
      targetReference: {
        operation: "click",
        targetId: "private-target-id",
        inventorySha256,
        frame: { sha256: frameSha256, sequence: 7 },
      },
      revalidation: {
        workViewAuthorityReady: true,
        workViewBindingReady: true,
        observationFresh: true,
        screenInventoryReady: true,
        screenVisualFrameReady: true,
        targetPresentInScreenInventory: true,
        screenInventoryMatchesReference: true,
        stateInventoryMatchesScreen: true,
        stateSemanticFrameMatchesReference: true,
        stateVisualFrameMatchesReference: true,
        screenSemanticFrameMatchesReference: true,
        screenVisualFrameMatchesReference: true,
      },
      governance: {
        operatorReviewed: true,
        freshFrameRequired: true,
        frameScopedReferenceRequired: true,
        leaseRequired: true,
        automaticDispatch: false,
        providerCall: false,
      },
    },
    verification: {
      ok: true,
      actionEvidence: { actionCount: 1, degradedCount: 0 },
      checks: [
        { name: "target_url", passed: true },
        { name: "screen_readiness", passed: true },
        { name: "actions_not_degraded", passed: true },
      ],
      failedChecks: [],
    },
    recordedAt: "2026-07-31T12:01:40.000Z",
  };
}

export function recommendationExecutionReceipt() {
  return buildNativeEngineeringRecommendationExecutionReceipt({
    applicationReceipt: recommendationApplicationReceipt(),
    ...recommendationExecutionEvidence(),
  });
}
