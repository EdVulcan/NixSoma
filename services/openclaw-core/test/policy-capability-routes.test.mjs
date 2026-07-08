import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handlePolicyCapabilityRoute } from "../src/policy-capability-routes.mjs";

async function invokePolicyCapabilityRoute(overrides, method, path, body = null) {
  const chunks = body === null ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {};

  let statusCode = null;
  let headers = null;
  let payload = "";
  const res = {
    writeHead(code, responseHeaders) {
      statusCode = code;
      headers = responseHeaders;
    },
    end(chunk = "") {
      payload = String(chunk);
    },
  };

  const events = [];
  const handled = await handlePolicyCapabilityRoute({
    req,
    res,
    requestUrl: new URL(path, "http://127.0.0.1:4100"),
    policyEvaluator: {
      buildPolicyState: () => ({ auditCount: 0 }),
      evaluatePolicyIntent: (input, context) => ({ input, context, decision: "allow" }),
      recordPolicyDecision: (decision) => ({ ...decision, recorded: true }),
      ...overrides.policyEvaluator,
    },
    planBuilder: {
      buildCapabilityRegistry: async () => ({
        registry: "capability-registry-v1",
        summary: { total: 1 },
      }),
      invokeCapability: async () => ({
        statusCode: 200,
        response: { ok: true },
      }),
      ...overrides.planBuilder,
    },
    publishEvent: async (name, eventBody) => {
      events.push({ name, body: eventBody });
      if (overrides.publishEvent) {
        await overrides.publishEvent(name, eventBody);
      }
    },
  });

  return {
    handled,
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
    events,
  };
}

test("policy capability route returns policy state read model", async () => {
  const response = await invokePolicyCapabilityRoute({
    policyEvaluator: {
      buildPolicyState: () => ({ auditCount: 2, lastDecision: "require_approval" }),
    },
  }, "GET", "/policy/state");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.deepEqual(response.body, {
    ok: true,
    policy: { auditCount: 2, lastDecision: "require_approval" },
  });
});

test("policy evaluate records decision, publishes event, and returns updated state", async () => {
  let observedInput = null;
  let observedContext = null;
  const response = await invokePolicyCapabilityRoute({
    policyEvaluator: {
      buildPolicyState: () => ({ auditCount: 1 }),
      evaluatePolicyIntent: (input, context) => {
        observedInput = input;
        observedContext = context;
        return { decision: "require_approval", reason: "cross_boundary" };
      },
      recordPolicyDecision: (decision) => ({ ...decision, id: "policy-1" }),
    },
  }, "POST", "/policy/evaluate", {
    policy: { intent: "cross_boundary" },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, { policy: { intent: "cross_boundary" } });
  assert.deepEqual(observedContext, { stage: "policy.evaluate" });
  assert.deepEqual(response.events, [{
    name: "policy.evaluated",
    body: {
      policy: { decision: "require_approval", reason: "cross_boundary", id: "policy-1" },
    },
  }]);
  assert.deepEqual(response.body, {
    ok: true,
    policy: { decision: "require_approval", reason: "cross_boundary", id: "policy-1" },
    state: { auditCount: 1 },
  });
});

test("policy evaluate and capability invoke preserve local 400 error contracts", async () => {
  const policyFailure = await invokePolicyCapabilityRoute({
    policyEvaluator: {
      evaluatePolicyIntent: () => {
        throw new Error("policy body invalid");
      },
    },
  }, "POST", "/policy/evaluate", {});

  assert.equal(policyFailure.statusCode, 400);
  assert.deepEqual(policyFailure.body, { ok: false, error: "policy body invalid" });

  const invokeFailure = await invokePolicyCapabilityRoute({
    planBuilder: {
      invokeCapability: async () => {
        throw new Error("capability missing");
      },
    },
  }, "POST", "/capabilities/invoke", {});

  assert.equal(invokeFailure.statusCode, 400);
  assert.deepEqual(invokeFailure.body, { ok: false, error: "capability missing" });
});

test("capability refresh publishes registry summary and returns refreshed envelope", async () => {
  const response = await invokePolicyCapabilityRoute({
    planBuilder: {
      buildCapabilityRegistry: async () => ({
        registry: "capability-registry-v2",
        summary: { total: 4 },
        capabilities: [{ id: "sense.filesystem.read" }],
      }),
    },
  }, "POST", "/capabilities/refresh");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.events, [{
    name: "capability.updated",
    body: {
      registry: "capability-registry-v2",
      summary: { total: 4 },
    },
  }]);
  assert.deepEqual(response.body, {
    ok: true,
    refreshed: true,
    registry: "capability-registry-v2",
    summary: { total: 4 },
    capabilities: [{ id: "sense.filesystem.read" }],
  });
});

test("capability invoke forwards body and response status without extra event", async () => {
  let observedBody = null;
  const response = await invokePolicyCapabilityRoute({
    planBuilder: {
      invokeCapability: async (body) => {
        observedBody = body;
        return {
          statusCode: 202,
          response: { ok: true, accepted: true, capabilityId: body.capabilityId },
        };
      },
    },
  }, "POST", "/capabilities/invoke", { capabilityId: "sense.filesystem.read" });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(observedBody, { capabilityId: "sense.filesystem.read" });
  assert.deepEqual(response.body, {
    ok: true,
    accepted: true,
    capabilityId: "sense.filesystem.read",
  });
  assert.deepEqual(response.events, []);
});

test("policy capability route reports misses without writing a response", async () => {
  const missed = await invokePolicyCapabilityRoute({}, "GET", "/capabilities");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});
