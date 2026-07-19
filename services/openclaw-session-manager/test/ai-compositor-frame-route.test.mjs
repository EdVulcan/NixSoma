import assert from "node:assert/strict";
import test from "node:test";
import { createAiCompositorFrameRoute } from "../src/ai-compositor-frame-route.mjs";

function routeFixture({ ready = true, available = true } = {}) {
  const calls = { capture: 0, events: [], response: null };
  const metadata = {
    registry: "nixsoma-ai-compositor-frame-v0",
    available,
    sourceScope: "ai_owned_nested_output_only",
    dataExposed: false,
  };
  const frame = available ? { ...metadata, dataExposed: true, dataUrl: "data:image/png;base64,AAAA" } : metadata;
  const handler = createAiCompositorFrameRoute({
    capture: {
      async capture() {
        calls.capture += 1;
        return frame;
      },
      snapshot() {
        return metadata;
      },
    },
    observeGraphicalSession: () => ({ ready, status: ready ? "ready" : "socket_missing" }),
    projectGraphicalSession: (session, compositorFrame) => ({ ...session, compositorFrame }),
    publishEvent: async (name, payload) => calls.events.push({ name, payload }),
    createEventName: (name) => name,
    sendJson: (_response, status, body) => {
      calls.response = { status, body };
    },
  });
  return { calls, handler };
}

test("compositor frame route is exact and blocks capture when the nested session is unavailable", async () => {
  const { calls, handler } = routeFixture({ ready: false });
  assert.equal(await handler({ method: "GET" }, {}, new URL("http://local/other")), false);
  assert.equal(await handler({ method: "GET" }, {}, new URL("http://local/work-view/compositor-frame")), true);
  assert.equal(calls.capture, 0);
  assert.equal(calls.response.status, 409);
  assert.equal(calls.events.length, 0);
});

test("compositor frame route returns transient pixels but audits metadata only", async () => {
  const { calls, handler } = routeFixture();
  assert.equal(await handler({ method: "GET" }, {}, new URL("http://local/work-view/compositor-frame")), true);
  assert.equal(calls.capture, 1);
  assert.equal(calls.response.status, 200);
  assert.match(calls.response.body.frame.dataUrl, /^data:image\/png;base64,/u);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].payload.compositorFrame.dataExposed, false);
  assert.equal(JSON.stringify(calls.events[0]).includes("data:image/"), false);
});
