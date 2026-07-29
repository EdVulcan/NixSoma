import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceOcrFocusTypeCapabilityHandlers } from
  "../src/capability-runtime-ai-workspace-ocr-focus-type.mjs";

const capability = { id: "act.ai.workspace.ocr_focus_type" };
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
    registry: "nixsoma-ai-workspace-ocr-focus-type-v0",
    status: "executed",
    decision: { actionId: "focus_and_type", itemOrdinal: 7, inputEvidence, confidence: 0.95 },
    actions: [
      { index: 1, actionId: "focus_item", itemOrdinal: 7, surfaceId: 42, inventorySequence: 9, executed: true },
      { index: 2, actionId: "type_text", inputEvidence, surfaceId: 42, inventorySequence: 10, executed: true },
    ],
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
      ocrItemCount: 19,
      ocrCharacterCount: 245,
      verificationFrameContentHash: "3".repeat(64),
      verificationFrameSequence: 8,
      verificationOcrSceneContentHash: "4".repeat(64),
      focusFrameContentHash: "5".repeat(64),
      focusFrameSequence: 10,
      focusOcrSceneContentHash: "6".repeat(64),
      postActionFrameContentHash: "7".repeat(64),
      postActionFrameSequence: 12,
      postActionOcrSceneContentHash: "8".repeat(64),
      itemOrdinal: 7,
      inputEvidence,
      actionCount: 2,
      focusActionExecuted: true,
      focusActionVerified: true,
      typeActionExecuted: true,
      postActionVerified: true,
      outcomeUnknown: false,
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      localOcrBound: true,
      localOcrRevalidated: true,
      focusRevalidated: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      ocrItemOrdinalBound: true,
      taskObjectiveInputBound: true,
      providerGeneratedInput: true,
      pointerInput: true,
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
      arbitraryPointerInput: false,
      arbitraryKeyboardInput: false,
      providerRetentionControlledExternally: true,
    },
  };
}

test("OCR focus type capability invokes one task and emits compact two-action summary", async () => {
  const handlers = createAiWorkspaceOcrFocusTypeCapabilityHandlers({
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
  assert.equal(summary.kind, "ai.workspace.ocr_focus_type");
  assert.equal(summary.actionId, "focus_and_type");
  assert.equal(summary.actionCount, 2);
  assert.equal(summary.focusActionVerified, true);
  assert.equal(summary.typeActionExecuted, true);
  assert.equal(summary.postActionVerified, true);
  assert.equal(summary.maximumActions, 2);
  assert.equal(summary.fixedActionSequence, true);
  assert.equal(summary.inputEvidence.charCount, 6);
  assert.equal(JSON.stringify(summary).includes("QWERTY"), false);
});

test("OCR focus type capability rejects caller target, ordinal, and input", () => {
  const handlers = createAiWorkspaceOcrFocusTypeCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  for (const params of [
    { confirm: true, inputText: "QWERTY" },
    { confirm: true, itemOrdinal: 7 },
    { confirm: true, targetText: "Customername" },
  ]) {
    const request = { taskId: "task-1", params };
    assert.match(handlers.validateRequest(capability, request, {
      capabilityId: capability.id,
      taskId: request.taskId,
      params,
    }), /accepts only/u);
  }
});

test("OCR focus type capability preserves partial executed fallback evidence", () => {
  const handlers = createAiWorkspaceOcrFocusTypeCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const partial = result();
  partial.status = "local_fallback";
  partial.actions = partial.actions.slice(0, 1);
  partial.evidence.actionCount = 1;
  partial.evidence.typeActionExecuted = false;
  partial.evidence.postActionVerified = false;
  partial.governance.keyboardInput = false;
  const summary = handlers.summariseResult(capability, partial);
  assert.equal(summary.actionId, "focus_and_type");
  assert.equal(summary.actionCount, 1);
  assert.equal(summary.focusActionExecuted, true);
  assert.equal(summary.typeActionExecuted, false);
  assert.equal(summary.postActionVerified, false);
});
