export const NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY =
  "openclaw-native-engineering-recommendation-link-v0";
export const ENGINEERING_RECOMMENDATION_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0";
export const ENGINEERING_RECOMMENDATION_CONTRACT = "engineering_recommendation_v0";
export const ENGINEERING_SEMANTIC_CLICK_ACTION_ID = "create_semantic_click_task";
export const ENGINEERING_SEMANTIC_CLICK_CONTROL_ID = "create-semantic-click-task-button";
export const ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID = "plan.openclaw.browser.semantic_click_task";

function boundedIdentifier(value, label, maxChars = 160) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Native engineering recommendation link requires ${label}.`);
  }
  return text.slice(0, maxChars);
}

function requireSourceTask(tasks, sourceTaskId) {
  const sourceTask = tasks?.get?.(sourceTaskId) ?? null;
  if (!sourceTask?.id) {
    throw new Error("Native engineering recommendation link source task does not exist.");
  }
  const providerExecution = sourceTask.cloudConsciousnessLiveProviderEgressExecution;
  const recommendation = providerExecution?.recommendation;
  if (sourceTask.status !== "completed"
    || sourceTask.type !== "cloud_consciousness_live_provider_egress_execution_task"
    || !providerExecution
    || providerExecution.responseContract !== ENGINEERING_RECOMMENDATION_CONTRACT
    || recommendation?.valid !== true
    || recommendation.registry !== ENGINEERING_RECOMMENDATION_REGISTRY
    || recommendation.contract !== ENGINEERING_RECOMMENDATION_CONTRACT
    || recommendation.actionId !== ENGINEERING_SEMANTIC_CLICK_ACTION_ID) {
    throw new Error("Native engineering recommendation link source task is not a completed provider task.");
  }
  return sourceTask;
}

export function buildNativeEngineeringRecommendationLink({
  input = null,
  tasks = new Map(),
  now = () => new Date().toISOString(),
} = {}) {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Native engineering recommendation link must be an object.");
  }

  const sourceTaskId = boundedIdentifier(input.sourceTaskId, "sourceTaskId");
  const sourceTask = requireSourceTask(tasks, sourceTaskId);
  const sourceRegistry = boundedIdentifier(input.sourceRegistry, "sourceRegistry", 120);
  const contract = boundedIdentifier(input.contract, "contract", 80);
  const actionId = boundedIdentifier(input.actionId, "actionId", 80);
  const expectedObserverControlId = boundedIdentifier(
    input.expectedObserverControlId,
    "expectedObserverControlId",
    120,
  );
  const existingCapabilityId = boundedIdentifier(input.existingCapabilityId, "existingCapabilityId", 160);

  if (sourceRegistry !== ENGINEERING_RECOMMENDATION_REGISTRY
    || contract !== ENGINEERING_RECOMMENDATION_CONTRACT
    || actionId !== ENGINEERING_SEMANTIC_CLICK_ACTION_ID
    || expectedObserverControlId !== ENGINEERING_SEMANTIC_CLICK_CONTROL_ID
    || existingCapabilityId !== ENGINEERING_SEMANTIC_CLICK_CAPABILITY_ID
    || input.requiresApproval !== true
    || input.createsTaskAutomatically !== false
    || input.createsApprovalAutomatically !== false
    || input.executesAutomatically !== false) {
    throw new Error("Native engineering recommendation link does not match the fixed semantic-click control.");
  }

  return {
    registry: NATIVE_ENGINEERING_RECOMMENDATION_LINK_REGISTRY,
    mode: "reviewed-provider-recommendation-to-semantic-click-task",
    generatedAt: now(),
    source: {
      taskId: sourceTaskId,
      taskType: sourceTask.type,
      taskStatus: sourceTask.status,
      registry: sourceRegistry,
      contract,
      evidence: "provider_execution_recommendation",
    },
    action: {
      actionId,
      capabilityId: existingCapabilityId,
      expectedObserverControlId,
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
