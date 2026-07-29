import assert from "node:assert/strict";
import test from "node:test";

import { buildAiLocalOcrObservation } from "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import { createAiWorkspaceLocalOcrCapabilityHandlers } from "../src/capability-runtime-ai-workspace-local-ocr.mjs";

const capability = { id: "sense.ai.workspace.local_ocr" };

function observation() {
  return buildAiLocalOcrObservation({
    observedAt: "2026-07-29T05:00:00.000Z",
    frame: {
      registry: "nixsoma-ai-compositor-frame-v0",
      socketName: "nixsoma-ai-0",
      width: 1280,
      height: 720,
      sha256: "a".repeat(64),
      sequence: 7,
      capturedAt: "2026-07-29T05:00:00.000Z",
    },
    surface: { surfaceId: 42, width: 1280, height: 720 },
    inventorySequence: 9,
    items: [{
      ordinal: 1,
      text: "NIXSOMA_OCR_TRANSIENT_CANARY",
      confidence: 0.9,
      bounds: { x: 10, y: 20, width: 300, height: 30 },
    }],
    sourceItemCount: 1,
    truncated: false,
  });
}

test("local OCR capability returns transient lines and summarizes only compact evidence", async () => {
  const calls = [];
  const handlers = createAiWorkspaceLocalOcrCapabilityHandlers({
    sessionManagerUrl: "http://session-manager",
    fetchJson: async (url) => {
      calls.push(url);
      return { ok: true, observation: observation() };
    },
  });

  const backend = await handlers.callBackend(capability);
  const summary = handlers.summariseResult(capability, backend.result);

  assert.deepEqual(calls, ["http://session-manager/work-view/local-ocr"]);
  assert.equal(backend.result.items[0].text, "NIXSOMA_OCR_TRANSIENT_CANARY");
  assert.equal(summary.kind, "ai.workspace.local_ocr");
  assert.equal(summary.itemCount, 1);
  assert.equal(summary.providerCalled, false);
  assert.equal(summary.maximumActions, 0);
  assert.equal(summary.textExposedInTransientResult, true);
  assert.equal(summary.textPersisted, false);
  assert.equal(JSON.stringify(summary).includes("NIXSOMA_OCR_TRANSIENT_CANARY"), false);
});

test("local OCR capability rejects caller fields and malformed backend observations", async () => {
  const handlers = createAiWorkspaceLocalOcrCapabilityHandlers({
    sessionManagerUrl: "http://session-manager",
    fetchJson: async () => ({ ok: true, observation: { ...observation(), itemCount: 99 } }),
  });
  const request = {
    taskId: null,
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true, prompt: "forbidden" },
  };

  assert.match(
    handlers.validateRequest(capability, request, {
      capabilityId: capability.id,
      params: request.params,
    }),
    /accepts only/u,
  );
  await assert.rejects(() => handlers.callBackend(capability), /invalid observation/u);
});
