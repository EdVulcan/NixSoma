import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceOcrClickCapabilityHandlers } from
  "../src/capability-runtime-ai-workspace-ocr-click.mjs";

const capability = { id: "act.ai.workspace.ocr_click" };

function result() {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-ocr-click-v0",
    status: "executed",
    decision: { actionId: "click_item", itemOrdinal: 1, confidence: 0.95 },
    action: { actionId: "click_item", itemOrdinal: 1, surfaceId: 42,
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
      postActionFrameSequence: 9,
      postActionOcrSceneContentHash: "6".repeat(64),
      surfaceId: 42,
      inventorySequence: 9,
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
      ocrItemOrdinalBound: true,
      taskObjectiveBound: true,
      taskObjectiveProviderEgress: true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: true,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      arbitraryPointerInput: false,
      providerRetentionControlledExternally: true,
    },
  };
}

test("OCR click capability invokes one task and persists compact action evidence", async () => {
  const handlers = createAiWorkspaceOcrClickCapabilityHandlers({
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
  assert.equal(summary.kind, "ai.workspace.ocr_click");
  assert.equal(summary.actionExecuted, true);
  assert.equal(summary.itemOrdinal, 1);
  assert.equal(summary.postActionVerified, true);
  assert.equal(summary.arbitraryPointerInput, false);
  assert.equal(JSON.stringify(summary).includes("Acknowledge action"), false);
});

test("OCR click capability rejects caller OCR and coordinate fields", () => {
  const handlers = createAiWorkspaceOcrClickCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true, itemOrdinal: 1, x: 10 },
  };
  assert.match(handlers.validateRequest(capability, request, {
    capabilityId: capability.id,
    taskId: request.taskId,
    params: request.params,
  }), /accepts only/u);
});

test("OCR click capability preserves an executed fallback receipt without claiming verification", () => {
  const handlers = createAiWorkspaceOcrClickCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const fallback = result();
  fallback.status = "local_fallback";
  fallback.decision = { actionId: "no_op", itemOrdinal: null, confidence: null };
  fallback.evidence.postActionVerified = false;
  fallback.governance.postActionVerified = false;
  const summary = handlers.summariseResult(capability, fallback);
  assert.equal(summary.actionId, "click_item");
  assert.equal(summary.actionExecuted, true);
  assert.equal(summary.receiptMatched, true);
  assert.equal(summary.frameChanged, true);
  assert.equal(summary.postActionVerified, false);
});
