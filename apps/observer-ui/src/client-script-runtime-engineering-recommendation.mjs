export const observerClientRuntimeEngineeringRecommendationScript = `const ENGINEERING_RECOMMENDATION_CONTRACT = "engineering_recommendation_v0";
const ENGINEERING_RECOMMENDATION_REGISTRY = "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0";
let latestEngineeringRecommendation = null;
let latestEngineeringRecommendationSourceTaskId = null;

function engineeringRecommendationFromResult(result) {
  const candidates = [];
  const addCandidate = (recommendation, taskId) => {
    if (!recommendation) {
      return;
    }
    candidates.push({
      recommendation,
      sourceTaskId: typeof taskId === "string" && taskId.trim() ? taskId.trim() : null,
    });
  };
  if (result?.execution?.recommendation) {
    addCandidate(result.execution.recommendation, result.task?.id);
  }
  if (result?.recommendation) {
    addCandidate(result.recommendation, result.task?.id);
  }
  for (const step of result?.steps ?? []) {
    if (step?.execution?.recommendation) {
      addCandidate(step.execution.recommendation, step.task?.id);
    }
  }
  return candidates.at(-1) ?? null;
}

function validateEngineeringRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation)) {
    throw new Error("No transient AI engineering recommendation is available.");
  }
  if (recommendation.registry !== ENGINEERING_RECOMMENDATION_REGISTRY
    || recommendation.contract !== ENGINEERING_RECOMMENDATION_CONTRACT) {
    throw new Error("AI engineering recommendation contract is not supported.");
  }
  if (recommendation.requiresOperatorReview !== true) {
    throw new Error("AI engineering recommendation requires explicit operator review.");
  }
  const control = GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS[recommendation.actionId];
  if (!control) {
    throw new Error("AI engineering recommendation action is not allowlisted.");
  }
  if (recommendation.existingObserverControlId !== control.controlId) {
    throw new Error("AI engineering recommendation Observer control does not match the allowlist.");
  }
  if (recommendation.existingCapabilityId !== control.capabilityId) {
    throw new Error("AI engineering recommendation capability does not match the allowlist.");
  }
  if (recommendation.requiresApproval !== control.requiresApproval) {
    throw new Error("AI engineering recommendation approval contract does not match the allowlist.");
  }
  if (typeof recommendation.reason !== "string" || !recommendation.reason.trim()) {
    throw new Error("AI engineering recommendation reason is missing.");
  }
  if (typeof recommendation.confidence !== "number"
    || !Number.isFinite(recommendation.confidence)
    || recommendation.confidence < 0
    || recommendation.confidence > 1) {
    throw new Error("AI engineering recommendation confidence is invalid.");
  }
  if (recommendation.createsTaskAutomatically !== false
    || recommendation.createsApprovalAutomatically !== false
    || recommendation.executesAutomatically !== false) {
    throw new Error("AI engineering recommendation cannot request automatic control.");
  }
  return control;
}

function renderEngineeringRecommendationReadback(recommendation, { source = "operator" } = {}) {
  latestEngineeringRecommendation = null;
  latestEngineeringRecommendationSourceTaskId = null;
  if (!recommendation) {
    engineeringLoopStateRecommendation.textContent = "none";
    engineeringLoopStateRecommendationReview.textContent = "not available";
    engineeringLoopStateRecommendationControl.textContent = "none";
    engineeringLoopRecommendationUseButton.disabled = true;
    engineeringLoopRecommendationJson.textContent = "No transient AI engineering recommendation in the latest operator result.";
    return;
  }

  try {
    const recommendationValue = recommendation.recommendation;
    const control = validateEngineeringRecommendation(recommendationValue);
    latestEngineeringRecommendation = recommendationValue;
    latestEngineeringRecommendationSourceTaskId = recommendation.sourceTaskId;
    engineeringLoopStateRecommendation.textContent = recommendationValue.actionId;
    engineeringLoopStateRecommendationReview.textContent = "required";
    engineeringLoopStateRecommendationControl.textContent = control.controlId;
    engineeringLoopRecommendationUseButton.disabled = false;
    engineeringLoopRecommendationJson.textContent = JSON.stringify({
      registry: recommendationValue.registry,
      contract: recommendationValue.contract,
      status: "valid_transient_recommendation",
      source,
      actionId: recommendationValue.actionId,
      label: recommendationValue.label ?? null,
      confidence: recommendationValue.confidence,
      reason: recommendationValue.reason,
      sourceTaskId: recommendation.sourceTaskId,
      existingObserverControlId: recommendationValue.existingObserverControlId,
      existingCapabilityId: recommendationValue.existingCapabilityId ?? null,
      requiresOperatorReview: true,
      requiresApproval: recommendationValue.requiresApproval === true,
      createsTaskAutomatically: false,
      createsApprovalAutomatically: false,
      executesAutomatically: false,
    }, null, 2);
  } catch (error) {
    engineeringLoopStateRecommendation.textContent = "blocked";
    engineeringLoopStateRecommendationReview.textContent = "blocked";
    engineeringLoopStateRecommendationControl.textContent = "mismatch";
    engineeringLoopRecommendationUseButton.disabled = true;
    engineeringLoopRecommendationJson.textContent = JSON.stringify({
      status: "invalid_transient_recommendation",
      source,
      reason: formatError(error),
      boundary: "No Observer control was invoked.",
    }, null, 2);
  }
}

function renderEngineeringRecommendationFromOperatorResult(result) {
  renderEngineeringRecommendationReadback(engineeringRecommendationFromResult(result), {
    source: result?.steps ? "operator_loop" : "operator_step",
  });
}

function buildEngineeringRecommendationLinkInput(recommendation, control) {
  if (recommendation.actionId !== "create_semantic_click_task") {
    return null;
  }
  if (!latestEngineeringRecommendationSourceTaskId) {
    throw new Error("The semantic-click recommendation is missing its completed provider source task.");
  }
  return {
    sourceTaskId: latestEngineeringRecommendationSourceTaskId,
    sourceRegistry: recommendation.registry,
    contract: recommendation.contract,
    actionId: recommendation.actionId,
    expectedObserverControlId: control.controlId,
    existingCapabilityId: recommendation.existingCapabilityId,
    requiresApproval: recommendation.requiresApproval === true,
    createsTaskAutomatically: recommendation.createsTaskAutomatically === true,
    createsApprovalAutomatically: recommendation.createsApprovalAutomatically === true,
    executesAutomatically: recommendation.executesAutomatically === true,
  };
}

async function useEngineeringRecommendation() {
  const recommendation = latestEngineeringRecommendation;
  const control = validateEngineeringRecommendation(recommendation);
  await control.run(buildEngineeringRecommendationLinkInput(recommendation, control));
  engineeringLoopStateRecommendationReview.textContent = "operator selected";
  setControlMessage(
    "Used the AI recommendation through the existing "
      + control.controlId
      + " control; operator selection remains required and any control-specific approval or execution gate remains in place.",
  );
}

`;
