import {
  getNativeEngineeringPlanTodoActionById,
  listNativeEngineeringPlanTodoActions,
} from "./native-engineering-plan-todo-next-action.mjs";

export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT =
  "engineering_recommendation_v0";
export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0";

const MAX_RESPONSE_REASON_CHARS = 1_000;
const ALLOWED_RESPONSE_KEYS = new Set([
  "actionId",
  "reason",
  "confidence",
  "requiresOperatorReview",
  "createsTaskAutomatically",
  "createsApprovalAutomatically",
  "executesAutomatically",
]);

function boundedText(value, maxChars) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function responseJsonText(value) {
  const text = boundedText(value, 16_000);
  if (!text.startsWith("```")) return text;
  const lines = text.split("\n");
  if (lines.length < 3 || !lines.at(-1).trim().startsWith("```")) return text;
  return lines.slice(1, -1).join("\n").trim();
}

function invalidEvidence(reason, responseContentHash) {
  return {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    status: "invalid_recommendation",
    valid: false,
    reason,
    actionId: null,
    existingObserverControlId: null,
    existingCapabilityId: null,
    requiresOperatorReview: false,
    requiresApproval: false,
    reasonIncluded: false,
    responseContentHash: responseContentHash ?? null,
  };
}

export function buildCloudLiveProviderEngineeringRecommendationInstruction() {
  const actionIds = listNativeEngineeringPlanTodoActions()
    .map((action) => action.actionId)
    .join(", ");
  return [
    "Return only a JSON object with keys actionId, reason, confidence, and requiresOperatorReview.",
    `actionId must be one of: ${actionIds}.`,
    "requiresOperatorReview must be true; do not request automatic task creation, approval, or execution.",
    "Do not include commands, file paths, URLs, credentials, or provider payloads.",
  ].join(" ");
}

export function parseCloudLiveProviderEngineeringRecommendation({
  contract,
  assistantContent,
  responseContentHash = null,
} = {}) {
  if (contract === undefined || contract === null) {
    return { ok: true, recommendation: null, evidence: null };
  }
  if (contract !== CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT) {
    return {
      ok: false,
      reason: "provider_recommendation_contract_not_supported",
      recommendation: null,
      evidence: invalidEvidence("contract_not_supported", responseContentHash),
    };
  }

  const text = responseJsonText(assistantContent);
  if (!text) {
    return {
      ok: false,
      reason: "provider_recommendation_empty_response",
      recommendation: null,
      evidence: invalidEvidence("empty_response", responseContentHash),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reason: "provider_recommendation_invalid_json",
      recommendation: null,
      evidence: invalidEvidence("invalid_json", responseContentHash),
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "provider_recommendation_object_required",
      recommendation: null,
      evidence: invalidEvidence("object_required", responseContentHash),
    };
  }

  const unknownKeys = Object.keys(parsed).filter((key) => !ALLOWED_RESPONSE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      reason: "provider_recommendation_keys_not_allowed",
      recommendation: null,
      evidence: invalidEvidence("keys_not_allowed", responseContentHash),
    };
  }

  const actionId = boundedText(parsed.actionId, 80);
  const action = getNativeEngineeringPlanTodoActionById(actionId);
  const reason = boundedText(parsed.reason, MAX_RESPONSE_REASON_CHARS);
  const confidence = typeof parsed.confidence === "number"
    && Number.isFinite(parsed.confidence)
    && parsed.confidence >= 0
    && parsed.confidence <= 1
    ? parsed.confidence
    : null;
  if (!action) {
    return {
      ok: false,
      reason: "provider_recommendation_action_not_allowed",
      recommendation: null,
      evidence: invalidEvidence("action_not_allowed", responseContentHash),
    };
  }
  if (!reason || confidence === null) {
    return {
      ok: false,
      reason: "provider_recommendation_fields_invalid",
      recommendation: null,
      evidence: invalidEvidence("fields_invalid", responseContentHash),
    };
  }
  const automaticFlagKeys = [
    "createsTaskAutomatically",
    "createsApprovalAutomatically",
    "executesAutomatically",
  ];
  if (parsed.requiresOperatorReview !== true
    || automaticFlagKeys.some((key) => parsed[key] !== undefined && typeof parsed[key] !== "boolean")
    || automaticFlagKeys.some((key) => parsed[key] === true)) {
    return {
      ok: false,
      reason: "provider_recommendation_governance_contract_failed",
      recommendation: null,
      evidence: invalidEvidence("governance_contract_failed", responseContentHash),
    };
  }

  const recommendation = {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    actionId: action.actionId,
    label: action.label,
    reason,
    confidence,
    existingObserverControlId: action.existingObserverControlId,
    existingCapabilityId: action.existingCapabilityId,
    requiresOperatorReview: true,
    requiresApproval: action.requiresApproval === true,
    createsTaskAutomatically: false,
    createsApprovalAutomatically: false,
    executesAutomatically: false,
  };
  return {
    ok: true,
    recommendation,
    evidence: {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
      contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
      status: "valid_recommendation",
      valid: true,
      reason: null,
      actionId: recommendation.actionId,
      existingObserverControlId: recommendation.existingObserverControlId,
      existingCapabilityId: recommendation.existingCapabilityId,
      requiresOperatorReview: true,
      requiresApproval: recommendation.requiresApproval,
      reasonIncluded: false,
      responseContentHash: responseContentHash ?? null,
    },
  };
}
