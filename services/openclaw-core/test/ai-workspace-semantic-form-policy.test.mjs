import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiWorkspaceSemanticFormTypeInstruction,
  buildAiWorkspaceSemanticFormTypeRequestedBehavior,
  parseAiWorkspaceSemanticFormTypeDecision,
} from "../src/ai-workspace-semantic-form-policy.mjs";

function response(actionId, itemOrdinal = null, inputText = null) {
  return JSON.stringify({
    actionId,
    itemOrdinal,
    inputText,
    reason: "The reviewed form task and current textbox justify this bounded choice.",
    confidence: 0.9,
  });
}

test("semantic form type policy permits only one type or no-op decision", () => {
  const instruction = buildAiWorkspaceSemanticFormTypeInstruction();
  const behavior = buildAiWorkspaceSemanticFormTypeRequestedBehavior();

  assert.match(instruction, /no_op or type_item/u);
  assert.match(instruction, /Do not return click, scroll, Enter, hotkeys/u);
  assert.deepEqual(behavior.allowedActions, ["no_op", "type_item"]);
  assert.equal(behavior.continuationRequiresVerifiedType, true);

  const type = parseAiWorkspaceSemanticFormTypeDecision({
    assistantContent: response("type_item", 1, "bounded value"),
    responseContentHash: "a".repeat(64),
  });
  assert.equal(type.ok, true);
  assert.equal(type.decision.actionId, "type_item");

  const click = parseAiWorkspaceSemanticFormTypeDecision({
    assistantContent: response("click_item", 2),
    responseContentHash: "b".repeat(64),
  });
  assert.equal(click.ok, false);
  assert.equal(click.reason, "semantic_form_type_action_not_allowed");
});
