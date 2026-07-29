import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_OCR_FOCUS_TYPE_OBJECTIVE_PATTERN,
  AI_WORKSPACE_OCR_FOCUS_TYPE_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrFocusTypeInstruction,
  parseAiWorkspaceOcrFocusTypeDecision,
} from "../src/ai-workspace-ocr-focus-type-contract.mjs";

function parse(value) {
  return parseAiWorkspaceOcrFocusTypeDecision({
    contract: AI_WORKSPACE_OCR_FOCUS_TYPE_RESPONSE_CONTRACT,
    assistantContent: JSON.stringify(value),
    responseContentHash: "a".repeat(64),
  });
}

test("OCR focus type contract accepts one fixed focus-and-type decision or no-op", () => {
  const active = parse({
    actionId: "focus_and_type",
    itemOrdinal: 7,
    inputText: "NIXSOMA_7",
    reason: "The selected item contains the fixed target and the value is exact.",
    confidence: 0.93,
  });
  assert.equal(active.ok, true);
  assert.equal(active.decision.itemOrdinal, 7);
  assert.equal(active.decision.inputText, "NIXSOMA_7");
  assert.equal(active.decision.maximumActions, 2);
  assert.equal(active.evidence.inputEvidence.charCount, 9);
  assert.equal(JSON.stringify(active.evidence).includes("NIXSOMA_7"), false);

  const noOp = parse({
    actionId: "no_op",
    itemOrdinal: null,
    inputText: null,
    reason: "The target is unavailable.",
    confidence: 1,
  });
  assert.equal(noOp.ok, true);
  assert.equal(noOp.decision.itemOrdinal, null);
  assert.equal(noOp.decision.inputText, null);
});

test("OCR focus type contract rejects extra authority and malformed actions", () => {
  for (const value of [
    { actionId: "focus_and_type", itemOrdinal: 1, inputText: "ok", reason: "x", confidence: 1, repeat: 1 },
    { actionId: "focus_and_type", itemOrdinal: null, inputText: "ok", reason: "x", confidence: 1 },
    { actionId: "focus_and_type", itemOrdinal: 25, inputText: "ok", reason: "x", confidence: 1 },
    { actionId: "focus_and_type", itemOrdinal: 1, inputText: "bad\nvalue", reason: "x", confidence: 1 },
    { actionId: "focus_and_type", itemOrdinal: 1, inputText: "x".repeat(33), reason: "x", confidence: 1 },
    { actionId: "no_op", itemOrdinal: 1, inputText: null, reason: "x", confidence: 1 },
    { actionId: "no_op", itemOrdinal: null, inputText: "x", reason: "x", confidence: 1 },
    { actionId: "press_enter", itemOrdinal: null, inputText: null, reason: "x", confidence: 1 },
  ]) {
    const result = parse(value);
    assert.equal(result.ok, false);
    if (typeof value.inputText === "string" && value.inputText.length >= 3) {
      assert.equal(JSON.stringify(result.evidence).includes(value.inputText), false);
    }
  }
  const instruction = buildAiWorkspaceOcrFocusTypeInstruction();
  assert.equal(instruction.includes("itemOrdinal must select the one OCR item containing TARGET"), true);
  assert.equal(instruction.includes("press Enter, use hotkeys or modifiers, repeat, continue"), true);
});

test("OCR focus type objective grammar binds only one safe target and value", () => {
  const valid = AI_WORKSPACE_OCR_FOCUS_TYPE_OBJECTIVE_PATTERN.exec(
    'Focus the OCR item containing "Customername" and type exact text "ABCDEF" into the active surface',
  );
  assert.deepEqual(valid?.slice(1), ["Customername", "ABCDEF"]);
  for (const invalid of [
    'Focus the OCR item containing "Customername" and type exact text "ABCDEF" then press Enter',
    'Focus the OCR item containing "Customername" and type exact text "bad!" into the active surface',
    'Focus the OCR item containing "Customer{name" and type exact text "ABCDEF" into the active surface',
  ]) {
    assert.equal(AI_WORKSPACE_OCR_FOCUS_TYPE_OBJECTIVE_PATTERN.test(invalid), false);
  }
});
