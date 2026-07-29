import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_OCR_TYPE_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrTypeInstruction,
  parseAiWorkspaceOcrTypeDecision,
} from "../src/ai-workspace-ocr-type-contract.mjs";

function parse(value) {
  return parseAiWorkspaceOcrTypeDecision({
    contract: AI_WORKSPACE_OCR_TYPE_RESPONSE_CONTRACT,
    assistantContent: JSON.stringify(value),
    responseContentHash: "a".repeat(64),
  });
}

test("OCR type contract accepts one bounded write-only value or no-op", () => {
  const typed = parse({
    actionId: "type_text",
    inputText: "NIXSOMA_7",
    reason: "The reviewed objective names this value.",
    confidence: 0.91,
  });
  assert.equal(typed.ok, true);
  assert.equal(typed.decision.inputText, "NIXSOMA_7");
  assert.deepEqual(typed.evidence.inputEvidence, {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 9,
    byteLength: 9,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  });
  assert.equal(JSON.stringify(typed.evidence).includes("NIXSOMA_7"), false);

  const noOp = parse({
    actionId: "no_op",
    inputText: null,
    reason: "No exact value is named.",
    confidence: 1,
  });
  assert.equal(noOp.ok, true);
  assert.equal(noOp.decision.inputText, null);
  assert.equal(noOp.evidence.inputEvidence.charCount, 0);
});

test("OCR type contract rejects extra authority and invalid input", () => {
  for (const value of [
    { actionId: "type_text", inputText: "ok", reason: "x", confidence: 1, repeat: 2 },
    { actionId: "type_text", inputText: "bad\nvalue", reason: "x", confidence: 1 },
    { actionId: "type_text", inputText: "x".repeat(33), reason: "x", confidence: 1 },
    { actionId: "type_text", inputText: "confirm!", reason: "x", confidence: 1 },
    { actionId: "no_op", inputText: "x", reason: "x", confidence: 1 },
    { actionId: "press_enter", inputText: null, reason: "x", confidence: 1 },
  ]) {
    const result = parse(value);
    assert.equal(result.ok, false);
    if (typeof value.inputText === "string" && value.inputText.length >= 3) {
      assert.equal(JSON.stringify(result.evidence).includes(value.inputText), false);
    }
  }
  const instruction = buildAiWorkspaceOcrTypeInstruction();
  assert.equal(instruction.includes('exact form Type exact text "VALUE" into the active surface'), true);
  assert.equal(instruction.includes("Do not send Enter, hotkeys, modifiers, repeated input"), true);
});
