import assert from "node:assert/strict";
import test from "node:test";

import {
  aiCompositorFrameMatches,
  normaliseAiCompositorInputAction,
  normaliseAiCompositorPointerAction,
  normaliseAiCompositorScrollAction,
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

test("native pointer action optionally binds one current surface and inventory", () => {
  const action = normaliseAiCompositorPointerAction({
    x: 200,
    y: 140,
    button: "left",
    surfaceId: 42,
    inventorySequence: 9,
    compositorFrame,
  }, { now: Date.parse(capturedAt) + 500 });
  assert.equal(action.surfaceId, 42);
  assert.equal(action.inventorySequence, 9);
  assert.equal(normaliseAiCompositorInputAction({
    x: 200,
    y: 140,
    surfaceId: 42,
    inventorySequence: 9,
    compositorFrame,
  }, { now: Date.parse(capturedAt) + 500 }).operation, "pointer_click");
  assert.throws(() => normaliseAiCompositorPointerAction({
    x: 200,
    y: 140,
    surfaceId: 42,
    compositorFrame,
  }), /requires both surfaceId and inventorySequence/u);
});

test("native scroll is one fixed-center step bound to a current numeric surface", () => {
  const action = normaliseAiCompositorScrollAction({
    direction: "up",
    surfaceId: 17,
    inventorySequence: 9,
    compositorFrame,
  }, { now: Date.parse(capturedAt) + 500 });

  assert.deepEqual({
    operation: action.operation,
    x: action.x,
    y: action.y,
    direction: action.direction,
    surfaceId: action.surfaceId,
    inventorySequence: action.inventorySequence,
    fresh: action.frame.fresh,
  }, {
    operation: "pointer_scroll",
    x: 640,
    y: 360,
    direction: "up",
    surfaceId: 17,
    inventorySequence: 9,
    fresh: true,
  });
  assert.equal(normaliseAiCompositorInputAction({
    direction: "down",
    surfaceId: 17,
    inventorySequence: 9,
    compositorFrame,
  }, { now: Date.parse(capturedAt) + 500 }).operation, "pointer_scroll");
  assert.throws(
    () => normaliseAiCompositorScrollAction({
      direction: "continuous",
      surfaceId: 17,
      inventorySequence: 9,
      compositorFrame,
    }),
    /one up or down step/u,
  );
  assert.throws(
    () => normaliseAiCompositorScrollAction({
      direction: "down",
      surfaceId: 0,
      inventorySequence: 9,
      compositorFrame,
    }),
    /positive 32-bit integer/u,
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

test("native scroll evidence retains only bounded target and frame metadata", () => {
  const evidence = projectAiCompositorInputEvidence({
    status: "executed",
    operation: "pointer_scroll",
    requestId: "d".repeat(32),
    socketName: "nixsoma-ai-0",
    x: 640,
    y: 360,
    direction: "down",
    surfaceId: 23,
    inventorySequence: 11,
    frame: compositorFrame,
    postFrame: { ...compositorFrame, sha256: "e".repeat(64), sequence: 8 },
    frameMatched: true,
    frameFresh: true,
    leaseMatched: true,
    receiptMatched: true,
    sequenceAdvanced: true,
    frameChanged: true,
    inventoryMatched: true,
    surfaceMatched: true,
    dataUrl: "must-not-survive",
  });

  assert.equal(evidence.operation, "pointer_scroll");
  assert.equal(evidence.direction, "down");
  assert.equal(evidence.surfaceId, 23);
  assert.equal(evidence.inventorySequence, 11);
  assert.equal(evidence.frameChanged, true);
  assert.equal(evidence.inventoryMatched, true);
  assert.equal(evidence.surfaceMatched, true);
  assert.equal(JSON.stringify(evidence).includes("dataUrl"), false);
});

test("surface-bound click evidence retains target matching without image data", () => {
  const evidence = projectAiCompositorInputEvidence({
    status: "executed",
    operation: "pointer_click",
    requestId: "f".repeat(32),
    socketName: "nixsoma-ai-0",
    x: 200,
    y: 140,
    surfaceId: 42,
    inventorySequence: 9,
    frame: compositorFrame,
    postFrame: { ...compositorFrame, sha256: "b".repeat(64), sequence: 8 },
    frameMatched: true,
    frameFresh: true,
    leaseMatched: true,
    receiptMatched: true,
    sequenceAdvanced: true,
    frameChanged: true,
    inventoryMatched: true,
    surfaceMatched: true,
    dataUrl: "must-not-survive",
  });
  assert.equal(evidence.operation, "pointer_click");
  assert.equal(evidence.surfaceId, 42);
  assert.equal(evidence.inventorySequence, 9);
  assert.equal(evidence.inventoryMatched, true);
  assert.equal(evidence.surfaceMatched, true);
  assert.equal(JSON.stringify(evidence).includes("dataUrl"), false);
});
