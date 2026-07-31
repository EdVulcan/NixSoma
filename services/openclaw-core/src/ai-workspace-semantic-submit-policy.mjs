import {
  AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  parseAiWorkspaceSingleStepDecision,
} from "./ai-workspace-single-step-contract.mjs";

export const AI_WORKSPACE_SEMANTIC_SUBMIT_MODE = "semantic_submit";

const ALLOWED_ACTIONS = new Set(["no_op", "click_item"]);
const SUBMIT_LABEL_PATTERN = /^(submit|send|continue|confirm)(?:\b|\s|[:\-])/iu;

export function buildAiWorkspaceSemanticSubmitInstruction() {
  return [
    "Return only one JSON object with exactly actionId, itemOrdinal, inputText, reason, and confidence.",
    "actionId must be no_op or click_item.",
    "itemOrdinal must be null for no_op or the 1-based ordered semantic scene item number for click_item.",
    "inputText must always be null.",
    "Choose click_item only for one enabled button whose visible accessible name clearly begins with Submit, Send, Continue, or Confirm and advances the reviewed task objective after the bound verified type receipt.",
    "Choose no_op when no eligible submit button exists or the supplied bounded context does not justify one current action.",
    "Use only the supplied visible role, name, disabled, and bounds fields.",
    "The local runtime may execute at most one validated semantic click and will never repeat it automatically.",
    "Do not return type, scroll, keyboard, Enter, coordinates, selectors, target ids, URLs, commands, paths, credentials, caller prompts, or additional keys.",
  ].join(" ");
}

export function buildAiWorkspaceSemanticSubmitRequestedBehavior() {
  return {
    maximumActions: 1,
    allowedActions: ["no_op", "click_item"],
    semanticItemOrdinals: "one_based_ordered_items",
    eligibleTarget: {
      role: "button",
      accessibleNamePrefix: ["Submit", "Send", "Continue", "Confirm"],
    },
    priorVerifiedTypeReceiptRequired: true,
    automaticRepeat: false,
  };
}

export function parseAiWorkspaceSemanticSubmitDecision(input = {}) {
  const parsed = parseAiWorkspaceSingleStepDecision({
    ...input,
    contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  });
  if (!parsed.ok || ALLOWED_ACTIONS.has(parsed.decision?.actionId)) return parsed;
  return {
    ok: false,
    reason: "semantic_submit_action_not_allowed",
    decision: null,
    evidence: {
      ...parsed.evidence,
      status: "invalid_decision",
      valid: false,
      reason: "semantic_submit_action_not_allowed",
      actionId: null,
      itemOrdinal: null,
      inputEvidence: null,
    },
  };
}

export function isEligibleAiWorkspaceSemanticSubmitTarget(scene, itemOrdinal) {
  const item = Number.isInteger(itemOrdinal) ? scene?.items?.[itemOrdinal - 1] : null;
  if (!item
    || item.disabled === true
    || item.role !== "button"
    || typeof item.name !== "string") return false;
  return SUBMIT_LABEL_PATTERN.test(item.name.trim());
}
