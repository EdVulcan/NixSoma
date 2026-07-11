import test from "node:test";
import assert from "node:assert/strict";

import { corsHeaders, createEventPublisher, withTracing } from "../src/http.mjs";

test("corsHeaders keeps OpenClaw defaults while accepting overrides", () => {
  const headers = corsHeaders({ "x-test": "ok" });

  assert.equal(headers["access-control-allow-origin"], "*");
  assert.equal(headers["access-control-allow-methods"], "GET, POST, OPTIONS");
  assert.equal(headers["x-test"], "ok");
});

test("withTracing adds request identity headers", async () => {
  const calls = [];
  const tracedFetch = withTracing(async (url, options) => {
    calls.push({ url, options });
    return new Response("ok");
  }, "openclaw-test");

  await tracedFetch("http://127.0.0.1/health", { requestId: "req-test" });

  assert.equal(calls[0].options.headers["x-request-id"], "req-test");
  assert.equal(calls[0].options.headers["x-source-service"], "openclaw-test");
});

test("createEventPublisher reports event-hub success and failure", async () => {
  const calls = [];
  const publish = createEventPublisher("http://event-hub", "openclaw-test", async (url, options) => {
    calls.push({ url, options });
    return new Response("ok", { status: 201 });
  });

  assert.deepEqual(await publish("test.event", { value: 1 }), { ok: true });
  assert.equal(calls[0].url, "http://event-hub/events");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    type: "test.event",
    source: "openclaw-test",
    payload: { value: 1 },
  });

  const originalError = console.error;
  console.error = () => {};
  try {
    const rejected = createEventPublisher("http://event-hub", "openclaw-test", async () => new Response("no", { status: 403 }));
    const unavailable = createEventPublisher("http://event-hub", "openclaw-test", async () => {
      throw new Error("offline");
    });
    assert.deepEqual(await rejected("test.event"), { ok: false, error: "event-hub returned HTTP 403" });
    assert.deepEqual(await unavailable("test.event"), { ok: false, error: "offline" });
  } finally {
    console.error = originalError;
  }
});
