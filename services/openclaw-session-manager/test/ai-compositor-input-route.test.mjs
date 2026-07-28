import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { createAiCompositorInputRoute } from "../src/ai-compositor-input-route.mjs";

function request(body, token = "grant-token", intent = null) {
  const req = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  req.method = "POST";
  req.headers = {
    "x-openclaw-execution-grant": token,
    "x-openclaw-task-id": "task-1",
    ...(intent ? { "x-openclaw-intent": intent } : {}),
  };
  return req;
}

test("native input route verifies the original screen-act grant target before execution", async () => {
  const action = { x: 740, y: 22, button: "left", compositorFrame: { sha256: "a".repeat(64) } };
  const calls = { verify: null, execute: null, response: null, events: [] };
  const handler = createAiCompositorInputRoute({
    controller: {
      execute: async (value) => {
        calls.execute = value;
        return { registry: "nixsoma-ai-compositor-input-v0", status: "executed" };
      },
      snapshot: () => ({ status: "not_executed" }),
    },
    executionGrantVerifier: {
      verifyRequest(value) {
        calls.verify = value;
        return {
          ok: true,
          grant: {
            issuer: "openclaw-core",
            audience: "openclaw-screen-act",
            grantId: "grant-1",
            taskId: "task-1",
          },
        };
      },
    },
    publishEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      return { ok: true };
    },
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { calls.response = { status, body }; },
  });

  const lease = { leaseId: "lease-1" };
  assert.equal(await handler(
    request({ action, trustedHelperLease: lease }),
    {},
    new URL("http://local/work-view/compositor-input"),
  ), true);
  assert.equal(calls.verify.path, "/act/mouse/click");
  assert.deepEqual(calls.verify.body, action);
  assert.deepEqual(calls.execute, { action, trustedHelperLease: lease });
  assert.equal(calls.response.status, 200);
  assert.equal(calls.events.length, 2);
});

test("native scroll route verifies the forwarded scroll grant and audits compact target binding", async () => {
  const action = {
    direction: "down",
    surfaceId: 33,
    inventorySequence: 12,
    compositorFrame: { sha256: "b".repeat(64), sequence: 4, socketName: "nixsoma-ai-0" },
  };
  const calls = { verify: null, execute: null, response: null, events: [] };
  const handler = createAiCompositorInputRoute({
    controller: {
      execute: async (value) => {
        calls.execute = value;
        return {
          registry: "nixsoma-ai-compositor-input-v0",
          status: "executed",
          operation: "pointer_scroll",
        };
      },
      snapshot: () => ({ status: "not_executed" }),
    },
    executionGrantVerifier: {
      verifyRequest(value) {
        calls.verify = value;
        return {
          ok: true,
          grant: {
            issuer: "openclaw-core",
            audience: "openclaw-screen-act",
            grantId: "grant-scroll",
            taskId: "task-1",
          },
        };
      },
    },
    publishEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      return { ok: true };
    },
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { calls.response = { status, body }; },
  });

  const lease = { leaseId: "lease-scroll" };
  await handler(
    request({ action, trustedHelperLease: lease }, "scroll-grant", "mouse.scroll"),
    {},
    new URL("http://local/work-view/compositor-input"),
  );
  assert.equal(calls.verify.path, "/act/mouse/scroll");
  assert.equal(calls.verify.context.intent, "mouse.scroll");
  assert.deepEqual(calls.verify.body, action);
  assert.deepEqual(calls.execute, { action, trustedHelperLease: lease });
  assert.equal(calls.events[0].payload.input.operation, "pointer_scroll");
  assert.equal(calls.events[0].payload.input.direction, "down");
  assert.equal(calls.events[0].payload.input.surfaceId, 33);
  assert.equal(calls.events[0].payload.input.inventorySequence, 12);
  assert.equal(calls.response.status, 200);
});

test("native input route rejects a scroll body carried under click intent", async () => {
  let verifications = 0;
  let executions = 0;
  let response;
  const handler = createAiCompositorInputRoute({
    controller: {
      execute: async () => { executions += 1; },
      snapshot: () => ({ status: "not_executed" }),
    },
    executionGrantVerifier: {
      verifyRequest: () => {
        verifications += 1;
        return { ok: true, grant: {} };
      },
    },
    publishEvent: async () => ({ ok: true }),
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { response = { status, body }; },
  });
  const action = {
    direction: "up",
    surfaceId: 8,
    inventorySequence: 4,
    compositorFrame: {},
  };
  await handler(
    request({ action, trustedHelperLease: {} }, "click-grant", "mouse.click"),
    {},
    new URL("http://local/work-view/compositor-input"),
  );
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "AI_COMPOSITOR_INPUT_INTENT_MISMATCH");
  assert.equal(verifications, 1);
  assert.equal(executions, 0);
});

test("native input route fails closed when the forwarded grant is invalid", async () => {
  let executions = 0;
  let response;
  const handler = createAiCompositorInputRoute({
    controller: {
      execute: async () => { executions += 1; },
      snapshot: () => ({ status: "not_executed" }),
    },
    executionGrantVerifier: {
      verifyRequest: () => ({
        ok: false,
        reason: "Execution grant target mismatch.",
        code: "EXECUTION_GRANT_TARGET_MISMATCH",
        statusCode: 403,
      }),
    },
    publishEvent: async () => ({ ok: true }),
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { response = { status, body }; },
  });

  await handler(
    request({ action: { x: 1, y: 1 }, trustedHelperLease: {} }, "wrong"),
    {},
    new URL("http://local/work-view/compositor-input"),
  );
  assert.equal(executions, 0);
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "EXECUTION_GRANT_TARGET_MISMATCH");
});

test("native input route blocks before mutation when durable audit is unavailable", async () => {
  let executions = 0;
  let response;
  const handler = createAiCompositorInputRoute({
    controller: {
      execute: async () => { executions += 1; },
      snapshot: () => ({ status: "not_executed" }),
    },
    executionGrantVerifier: {
      verifyRequest: () => ({
        ok: true,
        grant: { issuer: "openclaw-core", audience: "openclaw-screen-act", grantId: "grant-2" },
      }),
    },
    publishEvent: async () => ({ ok: false }),
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { response = { status, body }; },
  });

  await handler(
    request({ action: { x: 1, y: 1 }, trustedHelperLease: {} }),
    {},
    new URL("http://local/work-view/compositor-input"),
  );
  assert.equal(executions, 0);
  assert.equal(response.status, 503);
  assert.equal(response.body.code, "AI_COMPOSITOR_INPUT_AUDIT_REQUIRED");
});
