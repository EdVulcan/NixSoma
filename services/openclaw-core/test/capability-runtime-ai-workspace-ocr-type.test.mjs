import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceOcrTypeCapabilityHandlers } from
  "../src/capability-runtime-ai-workspace-ocr-type.mjs";

const capability = { id: "act.ai.workspace.ocr_type" };
const inputEvidence = {
  registry: "openclaw-write-only-input-evidence-v0",
  charCount: 6,
  byteLength: 6,
  maxChars: 32,
  truncated: false,
  textExposed: false,
  persisted: false,
};

function result() {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-ocr-type-v0",
    status: "executed",
    decision: { actionId: "type_text", inputEvidence, confidence: 0.95 },
    action: { actionId: "type_text", inputEvidence, surfaceId: 42,
      inventorySequence: 9, executed: true },
    evidence: {
      taskId: "task-1",
      taskStatus: "running",
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      contextContentHash: "c".repeat(64),
      requestContentHash: "d".repeat(64),
      responseContentHash: "e".repeat(64),
      frameContentHash: "f".repeat(64),
      frameSequence: 7,
      ocrSceneContentHash: "1".repeat(64),
      ocrBindingHash: "2".repeat(64),
      ocrItemCount: 8,
      ocrCharacterCount: 162,
      verificationFrameContentHash: "3".repeat(64),
      verificationFrameSequence: 8,
      verificationOcrSceneContentHash: "4".repeat(64),
      postActionFrameContentHash: "5".repeat(64),
      postActionFrameSequence: 10,
      postActionOcrSceneContentHash: "6".repeat(64),
      inputEvidence,
      actionExecuted: true,
      receiptMatched: true,
      frameChanged: true,
      postActionVerified: true,
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      localOcrBound: true,
      localOcrRevalidated: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      taskObjectiveInputBound: true,
      providerGeneratedInput: true,
      keyboardInput: true,
      hotkeyInput: false,
      enterKeyInput: false,
      inputTextExposed: false,
      inputTextPersisted: false,
      taskObjectiveBound: true,
      taskObjectiveProviderEgress: true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: true,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      arbitraryKeyboardInput: false,
      providerRetentionControlledExternally: true,
    },
  };
}

test("OCR type capability invokes one task and persists write-only input evidence", async () => {
  const handlers = createAiWorkspaceOcrTypeCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true },
  };
  const body = { capabilityId: capability.id, taskId: request.taskId, params: request.params };
  assert.equal(handlers.authorizeRequest(capability, request, body).authorization.approved, true);
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.equal(summary.kind, "ai.workspace.ocr_type");
  assert.equal(summary.actionExecuted, true);
  assert.equal(summary.inputEvidence.charCount, 6);
  assert.equal(summary.postActionVerified, true);
  assert.equal(summary.arbitraryKeyboardInput, false);
  assert.equal(JSON.stringify(summary).includes("K7M2Q9"), false);
});

test("OCR type capability rejects caller input fields", () => {
  const handlers = createAiWorkspaceOcrTypeCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true, inputText: "K7M2Q9" },
  };
  assert.match(handlers.validateRequest(capability, request, {
    capabilityId: capability.id,
    taskId: request.taskId,
    params: request.params,
  }), /accepts only/u);
});

test("OCR type capability preserves an executed fallback receipt", () => {
  const handlers = createAiWorkspaceOcrTypeCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const fallback = result();
  fallback.status = "local_fallback";
  fallback.decision = {
    actionId: "no_op",
    inputEvidence: { ...inputEvidence, charCount: 0, byteLength: 0 },
    confidence: null,
  };
  fallback.evidence.postActionVerified = false;
  fallback.governance.postActionVerified = false;
  const summary = handlers.summariseResult(capability, fallback);
  assert.equal(summary.actionId, "type_text");
  assert.equal(summary.actionExecuted, true);
  assert.equal(summary.receiptMatched, true);
  assert.equal(summary.postActionVerified, false);
});
