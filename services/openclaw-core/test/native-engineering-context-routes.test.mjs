import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleNativeEngineeringContextRoute } from "../src/native-engineering-context-routes.mjs";

async function invoke({ method = "POST", body = {}, publishEvent = async () => {} } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  const response = { statusCode: null, body: null };
  const res = {
    writeHead(statusCode) { response.statusCode = statusCode; },
    end(payload) { response.body = JSON.parse(String(payload)); },
  };
  const handled = await handleNativeEngineeringContextRoute({
    req,
    res,
    requestUrl: new URL("http://127.0.0.1/plugins/native-adapter/engineering-microcompact/projection"),
    publishEvent,
  });
  return { handled, ...response };
}

test("microcompact projection route returns transformed copy and summary-only audit event", async () => {
  const events = [];
  const raw = "sensitive-tool-output-".repeat(100);
  const response = await invoke({
    body: {
      thresholdChars: 100,
      protectRecentAssistantTurns: 0,
      messages: [
        { role: "assistant", content: [{ type: "text", text: "old" }] },
        { role: "toolResult", toolName: "cc_grep", content: [{ type: "text", text: raw }] },
        { role: "assistant", content: [{ type: "text", text: "new" }] },
      ],
    },
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.registry, "openclaw-native-engineering-microcompact-projection-v0");
  assert.equal(response.body.summary.compactedMessages, 1);
  assert.equal(JSON.stringify(events).includes("sensitive-tool-output"), false);
  assert.equal(events[0].name, "native_engineering.microcompact_projection_built");
});

test("microcompact projection route rejects invalid input and other methods", async () => {
  const invalid = await invoke({ body: { messages: "invalid" } });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body.error, /requires messages/u);

  const method = await invoke({ method: "GET" });
  assert.equal(method.statusCode, 405);
});
