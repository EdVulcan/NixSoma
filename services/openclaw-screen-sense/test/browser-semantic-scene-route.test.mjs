import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserSemanticSceneReader,
  createBrowserSemanticSceneRoute,
} from "../src/browser-semantic-scene-route.mjs";

const NOW = "2026-07-28T11:00:00.000Z";

function browserCaptureResponse() {
  const frame = {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: 120,
    sha256: "a".repeat(64),
    capturedAt: NOW,
    sequence: 7,
  };
  return {
    ok: true,
    running: true,
    browser: { running: true, browserPid: 8123 },
    capture: {
      activeUrl: "https://must-not-survive.invalid/private",
      visualFrame: frame,
      semanticTargets: {
        available: true,
        pageUrl: "https://must-not-survive.invalid/private",
        frame,
        items: [{
          targetId: "frame-7-target-1",
          role: "button",
          name: "Continue",
          disabled: false,
          bounds: { x: 20, y: 400, width: 120, height: 32 },
          value: "must-not-survive",
          selector: "#must-not-survive",
        }],
      },
    },
  };
}

test("screen-sense semantic scene reader requests metadata and projects content only", async () => {
  const calls = [];
  const reader = createBrowserSemanticSceneReader({
    browserRuntimeUrl: "http://127.0.0.1:4103",
    browserRuntimeHeaders: () => ({ authorization: "Bearer test" }),
    now: () => Date.parse(NOW),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => browserCaptureResponse() };
    },
  });

  const scene = await reader();

  assert.equal(calls[0].url, "http://127.0.0.1:4103/browser/capture?visual=metadata");
  assert.equal(calls[0].options.headers.authorization, "Bearer test");
  assert.equal(scene.available, true);
  assert.equal(scene.items[0].name, "Continue");
  assert.equal(JSON.stringify(scene).includes("must-not-survive"), false);
  assert.equal(scene.pixelsExposed, false);
  assert.equal(scene.urlsExposed, false);
});

test("screen-sense semantic scene reader fails closed without raw transport errors", async () => {
  const reader = createBrowserSemanticSceneReader({
    browserRuntimeUrl: "http://127.0.0.1:4103",
    fetchImpl: async () => { throw new Error("private transport detail"); },
  });

  const scene = await reader();

  assert.equal(scene.available, false);
  assert.equal(scene.reason, "browser_semantic_capture_unavailable");
  assert.equal(JSON.stringify(scene).includes("private transport detail"), false);
});

test("screen-sense semantic scene route is exact and no-store", async () => {
  const responses = [];
  const headers = [];
  const scene = { registry: "nixsoma-ai-browser-semantic-scene-v0", available: true };
  const route = createBrowserSemanticSceneRoute({
    readBrowserSemanticScene: async () => scene,
    sendJson: (_res, statusCode, body) => responses.push({ statusCode, body }),
  });
  const res = { setHeader: (name, value) => headers.push({ name, value }) };

  assert.equal(await route({ method: "POST" }, res, { pathname: "/screen/semantic-scene" }), false);
  assert.equal(await route({ method: "GET" }, res, { pathname: "/screen/semantic-scene-extra" }), false);
  assert.equal(await route({ method: "GET" }, res, { pathname: "/screen/semantic-scene" }), true);
  assert.deepEqual(responses, [{ statusCode: 200, body: { ok: true, scene } }]);
  assert.deepEqual(headers, [{ name: "cache-control", value: "no-store" }]);
});
