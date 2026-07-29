import assert from "node:assert/strict";
import test from "node:test";

import { createAiCompositorPointerDispatch } from "../src/ai-compositor-pointer-dispatch.mjs";

const compositorFrame = {
  registry: "nixsoma-ai-compositor-frame-v0",
  socketName: "nixsoma-ai-0",
  width: 1280,
  height: 720,
  sha256: "a".repeat(64),
  sequence: 3,
  capturedAt: new Date().toISOString(),
};

test("native pointer dispatch preserves the grant-bound action and projects metadata only", async () => {
  let request;
  const dispatch = createAiCompositorPointerDispatch({
    sessionManagerUrl: "http://session-manager",
    fetchFn: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          input: {
            registry: "nixsoma-ai-compositor-input-v0",
            status: "executed",
            operation: "pointer_click",
            leaseMatched: true,
            frameMatched: true,
            frameFresh: true,
            receiptMatched: true,
            sequenceAdvanced: true,
          },
        }),
      };
    },
  });
  const action = { x: 740, y: 22, button: "left", compositorFrame };
  const mediation = await dispatch({
    action,
    trustedHelperLease: { leaseId: "lease-1", sessionId: "session-1" },
    forwardedGrantHeaders: { "x-openclaw-execution-grant": "signed" },
  });

  assert.equal(request.url, "http://session-manager/work-view/compositor-input");
  assert.deepEqual(request.body.action, action);
  assert.equal(request.options.headers["x-openclaw-execution-grant"], "signed");
  assert.equal(mediation.accepted, true);
  assert.equal(mediation.transport, "ai-compositor-native");
  assert.equal(mediation.visualGrounding.sequenceAdvanced, true);
  assert.equal(JSON.stringify(mediation).includes("dataUrl"), false);
});

test("native scroll dispatch requires exact surface and inventory evidence", async () => {
  let request;
  const dispatch = createAiCompositorPointerDispatch({
    sessionManagerUrl: "http://session-manager",
    fetchFn: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          input: {
            registry: "nixsoma-ai-compositor-input-v0",
            status: "executed",
            operation: "pointer_scroll",
            direction: "down",
            surfaceId: 24,
            inventorySequence: 10,
            leaseMatched: true,
            frameMatched: true,
            frameFresh: true,
            receiptMatched: true,
            sequenceAdvanced: true,
            frameChanged: true,
            inventoryMatched: true,
            surfaceMatched: true,
          },
        }),
      };
    },
  });
  const action = {
    direction: "down",
    surfaceId: 24,
    inventorySequence: 10,
    compositorFrame,
  };
  const mediation = await dispatch({
    action,
    trustedHelperLease: { leaseId: "lease-2", sessionId: "session-2" },
    forwardedGrantHeaders: { "x-openclaw-execution-grant": "scroll-signed" },
  });

  assert.deepEqual(request.body.action, action);
  assert.equal(request.options.headers["x-openclaw-execution-grant"], "scroll-signed");
  assert.equal(mediation.accepted, true);
  assert.equal(mediation.visualGrounding.surfaceId, 24);
  assert.equal(mediation.visualGrounding.inventorySequence, 10);
  assert.equal(mediation.visualGrounding.inventoryMatched, true);
  assert.equal(mediation.visualGrounding.surfaceMatched, true);
  assert.equal(mediation.visualGrounding.frameChanged, true);
});

test("surface-bound click dispatch requires exact target and receipt evidence", async () => {
  const dispatch = createAiCompositorPointerDispatch({
    sessionManagerUrl: "http://session-manager",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        input: {
          registry: "nixsoma-ai-compositor-input-v0",
          status: "executed",
          operation: "pointer_click",
          surfaceId: 24,
          inventorySequence: 10,
          leaseMatched: true,
          frameMatched: true,
          frameFresh: true,
          receiptMatched: true,
          sequenceAdvanced: true,
          frameChanged: true,
          inventoryMatched: true,
          surfaceMatched: true,
        },
      }),
    }),
  });
  const mediation = await dispatch({
    action: {
      x: 200,
      y: 140,
      button: "left",
      surfaceId: 24,
      inventorySequence: 10,
      compositorFrame,
    },
    trustedHelperLease: { leaseId: "lease-click", sessionId: "session-click" },
    forwardedGrantHeaders: { "x-openclaw-execution-grant": "click-signed" },
  });
  assert.equal(mediation.accepted, true);
  assert.equal(mediation.visualGrounding.surfaceId, 24);
  assert.equal(mediation.visualGrounding.inventorySequence, 10);
  assert.equal(mediation.visualGrounding.inventoryMatched, true);
  assert.equal(mediation.visualGrounding.surfaceMatched, true);
  assert.equal(mediation.visualGrounding.frameChanged, true);
});

test("native scroll dispatch rejects a divergent surface receipt", async () => {
  const dispatch = createAiCompositorPointerDispatch({
    sessionManagerUrl: "http://session-manager",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        input: {
          registry: "nixsoma-ai-compositor-input-v0",
          status: "executed_surface_diverged",
          operation: "pointer_scroll",
          direction: "up",
          surfaceId: 24,
          inventorySequence: 10,
          receiptMatched: true,
          inventoryMatched: true,
          surfaceMatched: false,
        },
      }),
    }),
  });
  const mediation = await dispatch({
    action: {
      direction: "up",
      surfaceId: 24,
      inventorySequence: 10,
      compositorFrame,
    },
  });
  assert.equal(mediation.accepted, false);
  assert.equal(mediation.status, "rejected");
});
