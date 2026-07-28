import assert from "node:assert/strict";
import test from "node:test";

import {
  aiCompositorFrameMatches,
  normaliseAiCompositorPointerAction,
  projectAiCompositorInputEvidence,
} from "../src/ai-compositor-input.mjs";

const capturedAt = "2026-07-19T06:00:00.000Z";
const compositorFrame = {
  registry: "nixsoma-ai-compositor-frame-v0",
  socketName: "nixsoma-ai-0",
  width: 1280,
  height: 720,
  sha256: "a".repeat(64),
  sequence: 7,
  capturedAt,
};

test("native pointer action is bounded to one fresh fixed-output frame", () => {
  const action = normaliseAiCompositorPointerAction({
    x: 740,
    y: 22,
    button: "left",
    compositorFrame,
  }, { now: Date.parse(capturedAt) + 500 });

  assert.equal(action.operation, "pointer_click");
  assert.equal(action.frame.fresh, true);
  assert.equal(aiCompositorFrameMatches(action.frame, compositorFrame), true);
  assert.throws(
    () => normaliseAiCompositorPointerAction({ x: 1280, y: 22, compositorFrame }),
    /outside the fixed output/u,
  );
  assert.throws(
    () => normaliseAiCompositorPointerAction({
      x: 1,
      y: 1,
      compositorFrame: { ...compositorFrame, socketName: "wayland-0" },
    }),
    /binding is invalid/u,
  );
});

test("native input evidence retains hashes but never image data or broad authority", () => {
  const evidence = projectAiCompositorInputEvidence({
    status: "executed",
    operation: "pointer_click",
    requestId: "b".repeat(32),
    socketName: "nixsoma-ai-0",
    x: 740,
    y: 22,
    frame: compositorFrame,
    postFrame: { ...compositorFrame, sha256: "c".repeat(64), sequence: 8 },
    frameMatched: true,
    frameFresh: true,
    leaseMatched: true,
    receiptMatched: true,
    sequenceAdvanced: true,
    dataUrl: "must-not-survive",
  });

  assert.equal(evidence.status, "executed");
  assert.equal(evidence.sequenceAdvanced, true);
  assert.equal(evidence.desktopWideInput, false);
  assert.equal(evidence.parentDisplayConnected, false);
  assert.equal(JSON.stringify(evidence).includes("dataUrl"), false);
});
