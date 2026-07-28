import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  buildAiWorkspaceSingleStepInstruction,
  parseAiWorkspaceSingleStepDecision,
} from "../src/ai-workspace-single-step-contract.mjs";

test("AI workspace single-step instruction exposes only the fixed action set", () => {
  const instruction = buildAiWorkspaceSingleStepInstruction();

  assert.match(instruction, /no_op, scroll_up, scroll_down, or click_item/u);
  assert.match(instruction, /1-based ordered semantic scene item number/u);
  assert.equal(instruction.includes("keyboard.type"), false);
  assert.equal(instruction.includes("mouse.click"), false);
  assert.match(instruction, /semantic scene/u);
  assert.match(instruction, /role, name, disabled, and bounds/u);
  assert.match(instruction, /return commands/u);
  assert.match(instruction, /caller-supplied prompts/u);
});

test("AI workspace single-step parser accepts one bounded decision", () => {
  const result = parseAiWorkspaceSingleStepDecision({
    contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
    assistantContent: JSON.stringify({
      actionId: "scroll_down",
      itemOrdinal: null,
      reason: "One current active surface is ready.",
      confidence: 0.9,
    }),
    responseContentHash: "a".repeat(64),
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision.actionId, "scroll_down");
  assert.equal(result.decision.itemOrdinal, null);
  assert.equal(result.decision.maximumActions, 1);
  assert.equal(result.decision.automaticRepeat, false);
  assert.equal(result.evidence.reasonIncluded, false);
});

test("AI workspace single-step parser accepts one bounded scene item ordinal", () => {
  const result = parseAiWorkspaceSingleStepDecision({
    contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
    assistantContent: JSON.stringify({
      actionId: "click_item",
      itemOrdinal: 2,
      reason: "The visible enabled button advances the current task.",
      confidence: 0.8,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision.actionId, "click_item");
  assert.equal(result.decision.itemOrdinal, 2);
  assert.equal(result.decision.maximumActions, 1);
});

test("AI workspace single-step parser rejects widened or malformed decisions", () => {
  for (const assistantContent of [
    JSON.stringify({ actionId: "keyboard_type", itemOrdinal: null, reason: "x", confidence: 1 }),
    JSON.stringify({ actionId: "scroll_up", itemOrdinal: null, reason: "x", confidence: 1, count: 2 }),
    JSON.stringify({ actionId: "scroll_up", itemOrdinal: 1, reason: "x", confidence: 1 }),
    JSON.stringify({ actionId: "click_item", itemOrdinal: 13, reason: "x", confidence: 1 }),
    JSON.stringify({ actionId: "scroll_up", itemOrdinal: null, reason: "", confidence: 1 }),
    "not-json",
  ]) {
    const result = parseAiWorkspaceSingleStepDecision({
      contract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
      assistantContent,
    });
    assert.equal(result.ok, false);
  }
});
