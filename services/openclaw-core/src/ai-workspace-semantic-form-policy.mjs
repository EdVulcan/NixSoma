import {
  AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS,
  AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  parseAiWorkspaceSingleStepDecision,
} from "./ai-workspace-single-step-contract.mjs";

export const AI_WORKSPACE_SEMANTIC_FORM_TYPE_MODE = "semantic_form_type";

const ALLOWED_ACTIONS = new Set(["no_op", "type_item"]);

export function buildAiWorkspaceSemanticFormTypeInstruction() {
  return [
    "Return only one JSON object with exactly actionId, itemOrdinal, inputText, reason, and confidence.",
    "actionId must be no_op or type_item.",
    "Use type_item only when the reviewed task explicitly requires entering one bounded value into one enabled visible textbox before submitting the form.",
    "itemOrdinal must be null for no_op or the 1-based ordered semantic scene item number for type_item.",
    `inputText must be null for no_op or 1-${AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS} allowed characters for type_item.`,
    "Choose no_op when the current scene or task does not justify the exact input step.",
    "Use only the supplied visible role, name, disabled, and bounds fields.",
    "The local runtime may execute only one validated semantic type action for this step.",
    "Do not return click, scroll, Enter, hotkeys, coordinates, selectors, target ids, URLs, commands, paths, credentials, caller prompts, or additional keys.",
  ].join(" ");
}

export function buildAiWorkspaceSemanticFormTypeRequestedBehavior() {
  return {
    maximumActions: 1,
    allowedActions: ["no_op", "type_item"],
    semanticItemOrdinals: "one_based_ordered_items",
    semanticTypeInput: {
      maximumCharacters: AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS,
      writeOnlyExecutionPayload: true,
    },
    continuationRequiresVerifiedType: true,
    automaticRepeat: false,
  };
}

export function parseAiWorkspaceSemanticFormTypeDecision(input = {}) {
  const parsed = parseAiWorkspaceSingleStepDecision({
    ...input,
    contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  });
  if (!parsed.ok || ALLOWED_ACTIONS.has(parsed.decision?.actionId)) return parsed;
  return {
    ok: false,
    reason: "semantic_form_type_action_not_allowed",
    decision: null,
    evidence: {
      ...parsed.evidence,
      status: "invalid_decision",
      valid: false,
      reason: "semantic_form_type_action_not_allowed",
      actionId: null,
      itemOrdinal: null,
      inputEvidence: null,
    },
  };
}
