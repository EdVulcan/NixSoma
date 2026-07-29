import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiLocalOcrObservation,
  normaliseAiLocalOcrObservation,
  projectAiLocalOcrSummary,
} from "../src/ai-local-ocr.mjs";

function observation(overrides = {}) {
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
      confidence: 0.94,
      bounds: { x: 20, y: 40, width: 320, height: 32 },
    }],
    sourceItemCount: 1,
    truncated: false,
    ...overrides,
  });
}

test("local OCR observation binds transient text to one native frame and active surface", () => {
  const value = observation();
  const normalised = normaliseAiLocalOcrObservation(value);

  assert.deepEqual(normalised, value);
  assert.match(value.sceneContentSha256, /^[a-f0-9]{64}$/u);
  assert.equal(value.boundary.textTransient, true);
  assert.equal(value.boundary.textPersisted, false);
  assert.equal(value.boundary.pixelsProviderEgress, false);
  assert.equal(value.boundary.maximumActions, 0);
});

test("local OCR durable summary excludes recognized text", () => {
  const value = observation();
  const summary = projectAiLocalOcrSummary(value);

  assert.equal(summary.itemCount, 1);
  assert.equal(summary.sceneContentSha256, value.sceneContentSha256);
  assert.equal(summary.textExposed, false);
  assert.equal(JSON.stringify(summary).includes("NIXSOMA_OCR_TRANSIENT_CANARY"), false);
});

test("local OCR normalization rejects tampered text, hash, and bounds", () => {
  const value = observation();
  assert.equal(normaliseAiLocalOcrObservation({
    ...value,
    items: [{ ...value.items[0], text: "changed" }],
  }), null);
  assert.equal(normaliseAiLocalOcrObservation({
    ...value,
    items: [{ ...value.items[0], bounds: { x: 1270, y: 1, width: 20, height: 10 } }],
  }), null);
});
