import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

function createHarness(overrides = {}) {
  const events = [];
  const calls = {
    fetchJson: [],
    postJson: [],
    health: [],
  };
  const state = {
    capabilityInvocationLog: [],
    MAX_CAPABILITY_INVOCATION_ENTRIES: 3,
    CAPABILITY_HEALTH_TIMEOUT_MS: 50,
    CROSS_BOUNDARY_INTENTS: new Set(["cloud.provider.send"]),
    persistState: () => {
      calls.persisted = (calls.persisted ?? 0) + 1;
    },
    ...overrides.state,
  };
  const client = {
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    browserRuntimeUrl: "http://127.0.0.1:4103",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    fetchJson: async (url) => {
      calls.fetchJson.push(url);
      return overrides.fetchJsonResult ?? { ok: true, mode: "read_text", path: "/tmp/a", contentBytes: 8 };
    },
    postJson: async (url, body) => {
      calls.postJson.push({ url, body });
      return overrides.postJsonResult ?? { ok: true };
    },
    ...overrides.client,
  };
  const policyEvaluator = {
    evaluatePolicyIntent: (input, context) => ({
      id: "policy-evaluated",
      input,
      context,
      decision: "audit_only",
      domain: input.domain,
      risk: input.risk,
      reason: "body_internal_audit",
      approved: input.approved,
      autonomyMode: "guardian",
      autonomous: false,
      ...overrides.policyDecision,
    }),
    recordPolicyDecision: (decision) => ({ ...decision, id: decision.id ?? "policy-recorded" }),
    isPolicyExecutionAllowed: (decision) => decision.decision !== "deny" && decision.decision !== "require_approval",
    ...overrides.policyEvaluator,
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4100,
    client,
    state,
    pluginReview: {
      buildNativePluginManifestProfile: () => ({ ok: true, plugin: { id: "plugin-a" }, capabilities: [] }),
      buildNativeOpenClawToolCatalogProfile: () => ({ ok: true, summary: {} }),
      buildNativeOpenClawWorkspaceSemanticIndex: () => ({ ok: true, summary: {}, governance: {} }),
      buildNativeOpenClawWorkspaceSymbolLookup: () => ({ ok: true, summary: {}, query: {}, governance: {} }),
      buildNativeOpenClawWorkspaceEditTargetSelection: () => ({ ok: true }),
      buildNativeOpenClawPromptSemanticsProfile: () => ({ ok: true }),
      buildOpenClawPluginManifestMap: () => ({ ok: true }),
      buildOpenClawPluginCapabilityPlan: () => ({ ok: true }),
      ...overrides.pluginReview,
    },
    policyEvaluator,
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
    fetchImpl: async (url) => {
      calls.health.push(url);
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ ok: true, service: url.includes("4106") ? "openclaw-system-sense" : "test-service" }),
      };
    },
    createId: () => `id-${(calls.ids = (calls.ids ?? 0) + 1)}`,
    now: () => "2026-07-08T00:00:00.000Z",
  });

  return { runtime, state, events, calls };
}

test("capability runtime builds the local body registry with service health", async () => {
  const { runtime, calls } = createHarness();

  const registry = await runtime.buildCapabilityRegistry();

  assert.equal(registry.registry, "capability-v0");
  assert.equal(registry.mode, "local-body-registry");
  assert.equal(registry.generatedAt, "2026-07-08T00:00:00.000Z");
  assert.ok(registry.summary.total > 20);
  assert.ok(registry.summary.online > 0);
  assert.equal(registry.capabilities.find((capability) => capability.id === "sense.system.vitals")?.available, true);
  assert.equal(runtime.capabilityByIntent("cloud.provider.send")?.id, "boundary.cross_domain.approval");
  assert.ok(calls.health.some((url) => url === "http://127.0.0.1:4106/health"));
});

test("capability runtime normalises invoke requests and policy inputs", () => {
  const { runtime } = createHarness();
  const capability = runtime.capabilityById("act.filesystem.write_text");
  const request = runtime.normaliseCapabilityInvokeRequest({
    id: " act.filesystem.write_text ",
    taskId: " task-1 ",
    params: { path: "/tmp/a" },
    policy: { domain: "user_task", risk: "critical", approved: true },
  });

  assert.equal(request.capabilityId, "act.filesystem.write_text");
  assert.equal(request.taskId, "task-1");
  assert.equal(request.approved, true);

  const policyInput = runtime.buildCapabilityPolicyInput(capability, request);

  assert.equal(policyInput.intent, "filesystem.write");
  assert.equal(policyInput.domain, "user_task");
  assert.equal(policyInput.risk, "critical");
  assert.equal(policyInput.requiresApproval, true);
  assert.equal(policyInput.policy.approved, true);
});

test("capability runtime records and publishes blocked invocations", async () => {
  const { runtime, state, events, calls } = createHarness({
    policyDecision: {
      decision: "require_approval",
      reason: "approval_required",
      approved: false,
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.system.command.dry_run",
    params: { command: "date" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, false);
  assert.equal(result.response.blocked, true);
  assert.equal(result.response.reason, "policy_requires_approval");
  assert.equal(state.capabilityInvocationLog.length, 1);
  assert.equal(state.capabilityInvocationLog[0].blocked, true);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.blocked"]);
  assert.equal(calls.persisted, 1);
});

test("capability runtime invokes filesystem reads and trims invocation history", async () => {
  const { runtime, state, events, calls } = createHarness({
    fetchJsonResult: {
      ok: true,
      results: [{ path: "/tmp/a" }],
      count: 1,
      path: "/tmp",
    },
  });

  for (let index = 0; index < 4; index += 1) {
    const result = await runtime.invokeCapability({
      capabilityId: "sense.filesystem.read",
      operation: "search",
      params: { path: "/tmp", query: "a", limit: 5 },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.response.invoked, true);
    assert.equal(result.response.summary.kind, "filesystem.read");
    assert.equal(result.response.summary.operation, "search");
  }

  assert.equal(state.capabilityInvocationLog.length, 3);
  assert.equal(runtime.buildCapabilityInvocationSummary().total, 3);
  assert.equal(runtime.listCapabilityInvocations({ limit: 2 }).length, 2);
  assert.equal(calls.fetchJson[0], "http://127.0.0.1:4106/system/files/search?path=%2Ftmp&query=a&limit=5");
  assert.equal(events.filter((event) => event.name === "capability.invoked").length, 4);
});
