import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceOcrAssessmentCapabilityHandlers } from
  "../src/capability-runtime-ai-workspace-ocr-assessment.mjs";

const capability = { id: "sense.ai.workspace.ocr_assessment" };

function result() {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-ocr-assessment-v0",
    status: "assessed",
    assessment: { outcome: "complete", confidence: 0.95 },
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
      ocrTruncated: false,
      verificationFrameContentHash: "3".repeat(64),
      verificationFrameSequence: 8,
      verificationOcrSceneContentHash: "4".repeat(64),
      surfaceId: 42,
      inventorySequence: 9,
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      localOcrBound: true,
      localOcrRevalidated: true,
      currentActiveSurfaceBound: true,
      taskObjectiveBound: true,
      taskObjectiveProviderEgress: true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: true,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      renderedTextMayContainVisibleUrlsOrValues: true,
      providerRetentionControlledExternally: true,
    },
  };
}

test("OCR assessment capability returns outcome and persists compact evidence only", async () => {
  const handlers = createAiWorkspaceOcrAssessmentCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true },
  };
  const body = { capabilityId: capability.id, taskId: "task-1", params: request.params };
  assert.equal(handlers.authorizeRequest(capability, request, body).authorization.approved, true);
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.equal(summary.kind, "ai.workspace.ocr_assessment");
  assert.equal(summary.outcome, "complete");
  assert.equal(summary.ocrTextProviderEgress, true);
  assert.equal(summary.ocrTextPersistedLocally, false);
  assert.equal(summary.pixelsProviderEgress, false);
  assert.equal(JSON.stringify(summary).includes("NixSoma AI Workbench"), false);
});

test("OCR assessment capability rejects caller-controlled fields", () => {
  const handlers = createAiWorkspaceOcrAssessmentCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true, ocrText: "forbidden" },
  };
  assert.match(handlers.validateRequest(capability, request, {
    capabilityId: capability.id,
    taskId: request.taskId,
    params: request.params,
  }), /accepts only/u);
});
