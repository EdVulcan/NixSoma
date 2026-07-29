import assert from "node:assert/strict";
import test from "node:test";

import { createAiLocalOcrRoute } from "../src/ai-local-ocr-route.mjs";

const frame = {
  registry: "nixsoma-ai-compositor-frame-v0",
  available: true,
  fresh: true,
  socketName: "nixsoma-ai-0",
  width: 1280,
  height: 720,
  sha256: "a".repeat(64),
  sequence: 7,
  capturedAt: "2026-07-29T05:00:00.000Z",
};

function inventory(sequence = 9) {
  return {
    available: true,
    socketName: "nixsoma-ai-0",
    sequence,
    surfaces: [{ surfaceId: 42, width: 1280, height: 720, activated: true }],
  };
}

function harness({ inventories = [inventory(), inventory()] } = {}) {
  const responses = [];
  const events = [];
  let inventoryIndex = 0;
  const handler = createAiLocalOcrRoute({
    engine: {
      recognize: async () => ({
        items: [{
          ordinal: 1,
          text: "NIXSOMA_OCR_TRANSIENT_CANARY",
          confidence: 0.9,
          bounds: { x: 10, y: 20, width: 300, height: 30 },
        }],
        sourceItemCount: 1,
        characterCount: 28,
        truncated: false,
      }),
    },
    capture: { capture: async () => frame },
    observeGraphicalSession: () => ({ ready: true }),
    observeSurfaceInventory: () => inventories[Math.min(inventoryIndex++, inventories.length - 1)],
    publishEvent: async (name, payload) => events.push({ name, payload }),
    createEventName: (name) => name,
    sendJson: (res, statusCode, body) => responses.push({ statusCode, body, headers: res.openclawResponseHeaders }),
  });
  return { handler, responses, events };
}

test("local OCR route returns transient text and publishes compact evidence only", async () => {
  const { handler, responses, events } = harness();
  const handled = await handler(
    { method: "GET" },
    {},
    new URL("http://local/work-view/local-ocr"),
  );

  assert.equal(handled, true);
  assert.equal(responses[0].statusCode, 200);
  assert.equal(responses[0].body.observation.items[0].text, "NIXSOMA_OCR_TRANSIENT_CANARY");
  assert.equal(responses[0].headers["cache-control"].includes("no-store"), true);
  assert.equal(events[0].payload.localOcr.itemCount, 1);
  assert.equal(JSON.stringify(events).includes("NIXSOMA_OCR_TRANSIENT_CANARY"), false);
});

test("local OCR route fails closed when the active-surface inventory changes", async () => {
  const { handler, responses, events } = harness({ inventories: [inventory(9), inventory(10)] });
  await handler(
    { method: "GET" },
    {},
    new URL("http://local/work-view/local-ocr"),
  );

  assert.equal(responses[0].statusCode, 409);
  assert.equal(responses[0].body.ok, false);
  assert.equal(events.length, 0);
});
