import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiWorkspaceSemanticSubmitInstruction,
  buildAiWorkspaceSemanticSubmitRequestedBehavior,
  isEligibleAiWorkspaceSemanticSubmitTarget,
  parseAiWorkspaceSemanticSubmitDecision,
} from "../src/ai-workspace-semantic-submit-policy.mjs";

function response(actionId, itemOrdinal = null, inputText = null) {
  return JSON.stringify({
    actionId,
    itemOrdinal,
    inputText,
    reason: "The reviewed task and current scene justify this bounded choice.",
    confidence: 0.9,
  });
}

test("semantic submit policy reuses the single-step contract with click-only behavior", () => {
  const instruction = buildAiWorkspaceSemanticSubmitInstruction();
  const behavior = buildAiWorkspaceSemanticSubmitRequestedBehavior();

  assert.match(instruction, /no_op or click_item/u);
  assert.match(instruction, /Do not return type, scroll, keyboard, Enter/u);
  assert.deepEqual(behavior.allowedActions, ["no_op", "click_item"]);
  assert.equal(behavior.priorVerifiedTypeReceiptRequired, true);

  const click = parseAiWorkspaceSemanticSubmitDecision({
    assistantContent: response("click_item", 2),
    responseContentHash: "a".repeat(64),
  });
  assert.equal(click.ok, true);
  assert.equal(click.decision.actionId, "click_item");

  const type = parseAiWorkspaceSemanticSubmitDecision({
    assistantContent: response("type_item", 1, "forbidden"),
    responseContentHash: "b".repeat(64),
  });
  assert.equal(type.ok, false);
  assert.equal(type.reason, "semantic_submit_action_not_allowed");
});

test("semantic submit policy accepts only enabled submit-like buttons", () => {
  const scene = {
    items: [
      { role: "textbox", name: "Customer", disabled: false },
      { role: "button", name: "Submit order", disabled: false },
      { role: "button", name: "Cancel", disabled: false },
      { role: "button", name: "Confirm", disabled: true },
    ],
  };

  assert.equal(isEligibleAiWorkspaceSemanticSubmitTarget(scene, 2), true);
  assert.equal(isEligibleAiWorkspaceSemanticSubmitTarget(scene, 1), false);
  assert.equal(isEligibleAiWorkspaceSemanticSubmitTarget(scene, 3), false);
  assert.equal(isEligibleAiWorkspaceSemanticSubmitTarget(scene, 4), false);
});
