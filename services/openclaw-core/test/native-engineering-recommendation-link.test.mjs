import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExperienceConsumptionCandidate,
  finaliseExperienceConsumptionReceipt,
} from "../src/native-engineering-experience-consumption-receipt.mjs";
import {
  ENGINEERING_RECOMMENDATION_CONTRACT,
  ENGINEERING_RECOMMENDATION_REGISTRY,
  ENGINEERING_SEMANTIC_CLICK_ACTION_ID,
  ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID,
  ENGINEERING_SEMANTIC_CLICK_CONTROL_ID,
  NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY,
  buildNativeEngineeringRecommendationLink,
} from "../src/native-engineering-recommendation-link.mjs";

function createConsumptionReceipt() {
  const candidate = buildExperienceConsumptionCandidate({
    experienceMemory: { records: [{ id: "experience-a" }] },
    executionTaskId: "provider-task-42",
    sourceTaskId: "engineering-task-1",
    contextContentHash: "b".repeat(64),
    responseContract: ENGINEERING_RECOMMENDATION_CONTRACT,
  });
  return finaliseExperienceConsumptionReceipt({
    candidate,
    providerResult: {
      ok: true,
      audit: {
        requestContentHash: "c".repeat(64),
        providerResponseCreated: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
      },
    },
    consumedAt: "2026-07-31T12:00:30.000Z",
  });
}

function createFixture({ includeConsumption = false } = {}) {
  const sourceTask = {
    id: "provider-task-42",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    status: "completed",
    cloudConsciousnessLiveProviderEgressExecution: {
      registry: "openclaw-cloud-consciousness-live-provider-live-execution-v0",
      responseContract: ENGINEERING_RECOMMENDATION_CONTRACT,
      recommendation: {
        registry: ENGINEERING_RECOMMENDATION_REGISTRY,
        contract: ENGINEERING_RECOMMENDATION_CONTRACT,
        valid: true,
        actionId: ENGINEERING_SEMANTIC_CLICK_ACTION_ID,
        responseContentHash: "a".repeat(64),
      },
      ...(includeConsumption
        ? { contextPacket: { experienceMemoryConsumptionReceipt: createConsumptionReceipt() } }
        : {}),
    },
  };
  const input = {
    sourceTaskId: sourceTask.id,
    sourceRegistry: ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: ENGINEERING_RECOMMENDATION_CONTRACT,
    actionId: ENGINEERING_SEMANTIC_CLICK_ACTION_ID,
    expectedObserverControlId: ENGINEERING_SEMANTIC_CLICK_CONTROL_ID,
    existingCapabilityId: ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID,
    requiresApproval: true,
    createsTaskAutomatically: false,
    createsApprovalAutomatically: false,
    executesAutomatically: false,
  };
  return { input, sourceTask, tasks: new Map([[sourceTask.id, sourceTask]]) };
}

test("recommendation link binds a reviewed semantic-click plan to a completed provider task", () => {
  const fixture = createFixture();
  const link = buildNativeEngineeringRecommendationLink({
    ...fixture,
    now: () => "2026-07-17T01:00:00.000Z",
  });

  assert.equal(link.registry, NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY);
  assert.equal(link.mode, "reviewed-provider-recommendation-to-semantic-click-task");
  assert.deepEqual(link.source, {
    taskId: "provider-task-42",
    taskType: "cloud_consciousness_live_provider_egress_execution_task",
    taskStatus: "completed",
    registry: ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: ENGINEERING_RECOMMENDATION_CONTRACT,
    responseContentHash: "a".repeat(64),
    evidence: "provider_execution_recommendation",
  });
  assert.deepEqual(link.action, {
    actionId: ENGINEERING_SEMANTIC_CLICK_ACTION_ID,
    capabilityId: ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID,
    expectedObserverControlId: ENGINEERING_SEMANTIC_CLICK_CONTROL_ID,
    requiresApproval: true,
  });
  assert.equal(link.governance.operatorReviewRequired, true);
  assert.equal(link.governance.targetSelectedFromCurrentWorkView, true);
  assert.equal(link.governance.automaticTaskCreationAllowed, false);
  assert.equal(link.governance.automaticExecutionAllowed, false);
  assert.equal(link.governance.providerCallAllowed, false);
  assert.equal(link.governance.credentialValueIncluded, false);
  assert.equal("reason" in link, false);
  assert.equal("prompt" in link, false);
});

test("recommendation link rejects a missing, unfinished, or mismatched provider source", () => {
  const fixture = createFixture();

  assert.throws(() => buildNativeEngineeringRecommendationLink({
    ...fixture,
    tasks: new Map(),
  }), /source task does not exist/u);

  assert.throws(() => buildNativeEngineeringRecommendationLink({
    ...fixture,
    tasks: new Map([[fixture.sourceTask.id, {
      ...fixture.sourceTask,
      status: "queued",
    }]]),
  }), /completed provider task/u);

  assert.throws(() => buildNativeEngineeringRecommendationLink({
    ...fixture,
    tasks: new Map([[fixture.sourceTask.id, {
      ...fixture.sourceTask,
      cloudConsciousnessLiveProviderEgressExecution: {
        ...fixture.sourceTask.cloudConsciousnessLiveProviderEgressExecution,
        recommendation: {
          ...fixture.sourceTask.cloudConsciousnessLiveProviderEgressExecution.recommendation,
          responseContentHash: null,
        },
      },
    }]]),
  }), /provider response hash evidence/u);

  assert.throws(() => buildNativeEngineeringRecommendationLink({
    ...fixture,
    tasks: new Map([[fixture.sourceTask.id, {
      ...fixture.sourceTask,
      cloudConsciousnessLiveProviderEgressExecution: {
        ...fixture.sourceTask.cloudConsciousnessLiveProviderEgressExecution,
        recommendation: { ...fixture.sourceTask.cloudConsciousnessLiveProviderEgressExecution.recommendation, actionId: "create_verification_task" },
      },
    }]]),
  }), /completed provider task/u);

  for (const field of [
    "sourceRegistry",
    "contract",
    "actionId",
    "expectedObserverControlId",
    "existingCapabilityId",
  ]) {
    assert.throws(() => buildNativeEngineeringRecommendationLink({
      ...fixture,
      input: { ...fixture.input, [field]: "mismatch" },
    }), /fixed semantic-click control/u);
  }
});

test("recommendation link carries only the validated recall-consumption receipt hash", () => {
  const fixture = createFixture({ includeConsumption: true });
  const link = buildNativeEngineeringRecommendationLink({ ...fixture });

  assert.equal(
    link.source.experienceMemoryConsumptionReceiptHash,
    fixture.sourceTask.cloudConsciousnessLiveProviderEgressExecution
      .contextPacket.experienceMemoryConsumptionReceipt.receiptHash,
  );
  assert.equal("recordIds" in link.source, false);
  assert.equal("contextPacket" in link.source, false);
});
