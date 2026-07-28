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
