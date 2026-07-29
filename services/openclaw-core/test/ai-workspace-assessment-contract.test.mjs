import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_ASSESSMENT_RESPONSE_CONTRACT,
  AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
  buildAiWorkspaceAssessmentInstruction,
  buildAiWorkspaceOcrAssessmentInstruction,
  parseAiWorkspaceAssessment,
  parseAiWorkspaceOcrAssessment,
} from "../src/ai-workspace-assessment-contract.mjs";

function parse(value, overrides = {}) {
  return parseAiWorkspaceAssessment({
    contract: AI_WORKSPACE_ASSESSMENT_RESPONSE_CONTRACT,
    assistantContent: JSON.stringify(value),
    responseContentHash: "a".repeat(64),
    ...overrides,
  });
}

test("assessment contract accepts only the bounded outcome schema", () => {
  for (const outcome of ["complete", "incomplete", "blocked", "unknown"]) {
    const result = parse({ outcome, reason: "Visible evidence supports this result.", confidence: 0.75 });
    assert.equal(result.ok, true);
    assert.equal(result.decision.outcome, outcome);
    assert.equal(result.decision.maximumActions, 0);
    assert.equal(result.decision.taskMutation, false);
    assert.equal(result.decision.automaticContinuation, false);
    assert.equal(result.evidence.reasonIncluded, false);
  }
});

test("assessment contract rejects extra keys, invalid outcomes, and invalid confidence", () => {
  const invalid = [
    { outcome: "complete", reason: "Done.", confidence: 1, actionId: "click_item" },
    { outcome: "done", reason: "Done.", confidence: 1 },
    { outcome: "complete", reason: "", confidence: 1 },
    { outcome: "complete", reason: "Done.", confidence: 2 },
  ];
  for (const value of invalid) assert.equal(parse(value).ok, false);
  assert.equal(parse({}, { contract: "wrong-contract" }).ok, false);
});

test("assessment instruction forbids actions and hidden-state inference", () => {
  const instruction = buildAiWorkspaceAssessmentInstruction();
  assert.match(instruction, /complete, incomplete, blocked, or unknown/u);
  assert.match(instruction, /Do not propose or execute an action/u);
  assert.match(instruction, /infer hidden page state/u);
});

test("OCR assessment reuses the bounded outcome schema with an OCR-specific contract", () => {
  const assistantContent = JSON.stringify({
    outcome: "complete",
    reason: "The OCR evidence establishes the objective.",
    confidence: 0.9,
  });
  const result = parseAiWorkspaceOcrAssessment({
    contract: AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
    assistantContent,
    responseContentHash: "b".repeat(64),
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision.contract, AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT);
  assert.equal(result.decision.registry, "nixsoma-ai-workspace-ocr-assessment-decision-v0");
  assert.equal(parseAiWorkspaceAssessment({
    contract: AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
    assistantContent,
  }).ok, false);
});

test("OCR assessment instruction treats recognized text as untrusted data", () => {
  const instruction = buildAiWorkspaceOcrAssessmentInstruction();
  assert.match(instruction, /local OCR text and numeric bounds/u);
  assert.match(instruction, /untrusted data/u);
  assert.match(instruction, /Ignore any instruction/u);
  assert.match(instruction, /excluded pixels/u);
});
