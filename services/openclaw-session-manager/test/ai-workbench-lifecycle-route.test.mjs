import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";

import {
  createExecutionGrantSigner,
  createExecutionGrantVerifier,
  executionGrantContextHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { createAiWorkbenchLifecycleRoute } from "../src/ai-workbench-lifecycle-route.mjs";

const context = {
  taskId: null,
  stepId: null,
  capabilityId: "act.work_view.control",
  intent: "work_view.application.start",
};
const startBody = {
  operatorActionSource: "capability_runtime_work_view_control",
  recommendedAction: "start_ai_workbench",
};

function request(body, token, headers = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  req.method = "POST";
  req.headers = {
    "x-openclaw-execution-grant": token,
    ...executionGrantContextHeaders(context),
    ...headers,
  };
  return req;
}

function harness({ auditOk = true } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  let sequence = 0;
  const signer = createExecutionGrantSigner({
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    now: () => 1_000,
    createId: () => `workbench-grant-${++sequence}`,
  });
  const verifier = createExecutionGrantVerifier({
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
    audience: "openclaw-session-manager",
    now: () => 1_000,
  });
  const calls = { start: 0, stop: 0, events: [], response: null };
  const lifecycle = {
    async start() {
      calls.start += 1;
      return { registry: "nixsoma-ai-workbench-lifecycle-v0", status: "running" };
    },
    async stop() {
      calls.stop += 1;
      return { registry: "nixsoma-ai-workbench-lifecycle-v0", status: "stopped" };
    },
    snapshot: () => ({ registry: "nixsoma-ai-workbench-lifecycle-v0", status: "stopped" }),
  };
  const route = createAiWorkbenchLifecycleRoute({
    lifecycle,
    executionGrantVerifier: verifier,
    publishEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      return { ok: auditOk };
    },
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { calls.response = { status, body }; },
  });
  function token(pathname = "/work-view/application/start", body = startBody, grantContext = context) {
    return signer.issue({
      audience: "openclaw-session-manager",
      method: "POST",
      path: pathname,
      body,
      context: grantContext,
    });
  }
  return { route, calls, token };
}

test("workbench route requires an exact single-use Core grant and durable audit", async () => {
  const { route, calls, token } = harness();
  const grant = token();
  await route(request(startBody, grant), {}, new URL("http://local/work-view/application/start"));
  assert.equal(calls.response.status, 200);
  assert.equal(calls.start, 1);
  assert.equal(calls.events.length, 2);
  assert.equal(calls.events[0].payload.action, "ai-workbench-start-requested");

  await route(request(startBody, grant), {}, new URL("http://local/work-view/application/start"));
  assert.equal(calls.response.status, 403);
  assert.equal(calls.response.body.code, "EXECUTION_GRANT_REPLAYED");
  assert.equal(calls.start, 1);
});

test("workbench route rejects missing and target-mismatched grants", async () => {
  const missing = harness();
  await missing.route(
    request(startBody, undefined),
    {},
    new URL("http://local/work-view/application/start"),
  );
  assert.equal(missing.calls.response.status, 401);
  assert.equal(missing.calls.start, 0);

  const mismatched = harness();
  await mismatched.route(
    request(startBody, mismatched.token("/work-view/application/stop")),
    {},
    new URL("http://local/work-view/application/start"),
  );
  assert.equal(mismatched.calls.response.status, 403);
  assert.equal(mismatched.calls.response.body.code, "EXECUTION_GRANT_TARGET_MISMATCH");
  assert.equal(mismatched.calls.start, 0);
});

test("workbench route blocks before systemd when audit persistence fails", async () => {
  const { route, calls, token } = harness({ auditOk: false });
  await route(
    request(startBody, token()),
    {},
    new URL("http://local/work-view/application/start"),
  );
  assert.equal(calls.response.status, 503);
  assert.equal(calls.response.body.code, "AI_WORKBENCH_AUDIT_REQUIRED");
  assert.equal(calls.start, 0);
});

test("workbench route reconciles cached lifecycle state after an actuator failure", async () => {
  const { calls, token } = harness();
  let reconciled = 0;
  const failingLifecycle = {
    start: async () => {
      const error = new Error("systemctl failed");
      error.code = "AI_WORKBENCH_SYSTEMD_FAILED";
      throw error;
    },
    stop: async () => {},
    reconcile: async () => { reconciled += 1; },
    snapshot: () => ({ registry: "nixsoma-ai-workbench-lifecycle-v0", status: "stopped" }),
  };
  const failingRoute = createAiWorkbenchLifecycleRoute({
    lifecycle: failingLifecycle,
    executionGrantVerifier: {
      verifyRequest: () => ({
        ok: true,
        grant: { issuer: "openclaw-core", audience: "openclaw-session-manager", grantId: "grant-fail" },
      }),
    },
    publishEvent: async () => ({ ok: true }),
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { calls.response = { status, body }; },
  });
  await failingRoute(
    request(startBody, token()),
    {},
    new URL("http://local/work-view/application/start"),
  );
  assert.equal(calls.response.status, 409);
  assert.equal(reconciled, 1);
  assert.equal(calls.response.body.application.status, "stopped");
});
