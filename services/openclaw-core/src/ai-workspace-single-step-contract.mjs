export const AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT =
  "ai_workspace_single_step_v0";
export const AI_WORKSPACE_SINGLE_STEP_DECISION_REGISTRY =
  "nixsoma-ai-workspace-single-step-decision-v0";

const ACTION_IDS = new Set(["no_op", "scroll_up", "scroll_down"]);
const RESPONSE_KEYS = new Set(["actionId", "reason", "confidence"]);
const MAX_RESPONSE_CHARS = 4_000;
const MAX_REASON_CHARS = 400;

function boundedText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function jsonText(value) {
  const text = boundedText(value, MAX_RESPONSE_CHARS);
  if (!text.startsWith("```")) return text;
  const lines = text.split("\n");
  if (lines.length < 3 || !lines.at(-1).trim().startsWith("```")) return text;
  return lines.slice(1, -1).join("\n").trim();
}

function invalid(reason, responseContentHash) {
  return {
    ok: false,
    reason,
    decision: null,
    evidence: {
      registry: AI_WORKSPACE_SINGLE_STEP_DECISION_REGISTRY,
      contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
      status: "invalid_decision",
      valid: false,
      reason,
      actionId: null,
      reasonIncluded: false,
      responseContentHash: responseContentHash ?? null,
    },
  };
}

export function buildAiWorkspaceSingleStepInstruction() {
  return [
    "Return only one JSON object with exactly actionId, reason, and confidence.",
    "actionId must be no_op, scroll_up, or scroll_down.",
    "Choose no_op unless the supplied bounded context reports one current active surface, a fresh frame, and active action authority.",
    "For this explicit one-step traversal, prefer scroll_down when all required context checks are true.",
    "The local runtime may execute at most one validated action and will never repeat it automatically.",
    "Do not use caller-supplied prompts or include commands, text input, coordinates, deltas, counts, URLs, file paths, credentials, or additional keys.",
  ].join(" ");
}

export function parseAiWorkspaceSingleStepDecision({
  contract,
  assistantContent,
  responseContentHash = null,
} = {}) {
  if (contract !== AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT) {
    return invalid("contract_not_supported", responseContentHash);
  }
  const text = jsonText(assistantContent);
  if (!text) return invalid("empty_response", responseContentHash);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid("invalid_json", responseContentHash);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return invalid("object_required", responseContentHash);
  }
  if (Object.keys(parsed).some((key) => !RESPONSE_KEYS.has(key))
    || Object.keys(parsed).length !== RESPONSE_KEYS.size) {
    return invalid("keys_not_allowed", responseContentHash);
  }

  const actionId = boundedText(parsed.actionId, 32);
  const reason = boundedText(parsed.reason, MAX_REASON_CHARS);
  const confidence = typeof parsed.confidence === "number"
    && Number.isFinite(parsed.confidence)
    && parsed.confidence >= 0
    && parsed.confidence <= 1
    ? parsed.confidence
    : null;
  if (!ACTION_IDS.has(actionId)) return invalid("action_not_allowed", responseContentHash);
  if (!reason || confidence === null) return invalid("fields_invalid", responseContentHash);

  const decision = {
    registry: AI_WORKSPACE_SINGLE_STEP_DECISION_REGISTRY,
    contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
    actionId,
    reason,
    confidence,
    maximumActions: actionId === "no_op" ? 0 : 1,
    automaticRepeat: false,
  };
  return {
    ok: true,
    decision,
    evidence: {
      registry: AI_WORKSPACE_SINGLE_STEP_DECISION_REGISTRY,
      contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
      status: "valid_decision",
      valid: true,
      reason: null,
      actionId,
      reasonIncluded: false,
      responseContentHash: responseContentHash ?? null,
    },
  };
}
