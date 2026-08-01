import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";
import {
  PRIVILEGED_CAPABILITY_BOUNDARY_REGISTRY,
  PRIVILEGED_CAPABILITY_DEFERRED_REASON,
  buildPrivilegedCapabilityDescriptors,
} from "../src/privileged-capability-boundary.mjs";

function createHarness() {
  const calls = { backend: 0, policy: 0, events: [] };
  const state = {
    capabilityInvocationLog: [],
    MAX_CAPABILITY_INVOCATION_ENTRIES: 20,
    CAPABILITY_HEALTH_TIMEOUT_MS: 25,
    CROSS_BOUNDARY_INTENTS: new Set(),
    persistState: () => {},
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4100,
    client: {
      eventHubUrl: "http://127.0.0.1:4101",
      sessionManagerUrl: "http://127.0.0.1:4102",
      browserRuntimeUrl: "http://127.0.0.1:4103",
      screenSenseUrl: "http://127.0.0.1:4104",
      screenActUrl: "http://127.0.0.1:4105",
      systemSenseUrl: "http://127.0.0.1:4106",
      systemHealUrl: "http://127.0.0.1:4107",
      fetchJson: async () => { calls.backend += 1; return { ok: true }; },
      postJson: async () => { calls.backend += 1; return { ok: true }; },
    },
    state,
    policyEvaluator: {
      evaluatePolicyIntent: () => { calls.policy += 1; return { decision: "allow" }; },
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: () => true,
    },
    pluginReview: {},
    taskManager: {},
    publishEvent: async (name, payload) => { calls.events.push({ name, payload }); },
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    now: () => "2026-08-01T13:00:00.000Z",
    createId: () => "privileged-invocation-1",
  });
  return { runtime, state, calls };
}

test("privileged descriptors are visible but permanently unavailable", () => {
  const descriptors = buildPrivilegedCapabilityDescriptors({ host: "127.0.0.1", port: 4100 });
  assert.equal(descriptors.length, 6);
  assert.ok(descriptors.every((capability) => capability.registry === PRIVILEGED_CAPABILITY_BOUNDARY_REGISTRY));
  assert.ok(descriptors.every((capability) => capability.deferred === true));
  assert.ok(descriptors.every((capability) => capability.available === false));
  assert.ok(descriptors.every((capability) => capability.governance === "deferred"));
  assert.ok(descriptors.every((capability) => capability.risk === "critical"));
});

test("privileged capability invocation fails closed before policy or backend dispatch", async () => {
  const { runtime, state, calls } = createHarness();
  const response = await runtime.invokeCapability({
    capabilityId: "act.host.root",
    taskId: "task-1",
    params: { command: "rm -rf /", path: "/etc/shadow" },
    approved: true,
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.response.ok, false);
  assert.equal(response.response.error, PRIVILEGED_CAPABILITY_DEFERRED_REASON);
  assert.equal(response.response.invoked, false);
  assert.equal(response.response.blocked, true);
  assert.equal(response.response.invocation.request.command, null);
  assert.equal(response.response.invocation.request.path, null);
  assert.equal(calls.backend, 0);
  assert.equal(calls.policy, 0);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].name, "capability.blocked");
  assert.equal(state.capabilityInvocationLog.length, 1);
  assert.equal(state.capabilityInvocationLog[0].reason, PRIVILEGED_CAPABILITY_DEFERRED_REASON);
});

test("privileged capabilities remain deferred in the assembled registry", async () => {
  const { runtime } = createHarness();
  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "act.desktop.input");
  assert.deepEqual({
    status: capability.status,
    available: capability.available,
    health: capability.health,
  }, {
    status: "deferred",
    available: false,
    health: {
      ok: false,
      status: "deferred",
      detail: PRIVILEGED_CAPABILITY_DEFERRED_REASON,
    },
  });
});
