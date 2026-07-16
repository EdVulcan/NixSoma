import test from "node:test";
import assert from "node:assert/strict";

import { createPluginSearchWebContractCapabilityHandlers } from "../src/capability-runtime-plugin-search-web-contract.mjs";
import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

const capability = { id: "plan.openclaw.plugin_search_web_adapter_contract" };

function buildContract() {
  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-contract-v0",
    adapter: {
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
    },
    summary: {
      providerContractCount: 2,
      operationCount: 3,
      requiredChecks: 8,
      passedRequired: 8,
      failedRequired: 0,
      adapterContractReady: true,
      runtimeAdapterImplemented: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
    },
    governance: {
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
    },
    providerContracts: [{ endpoint: "SECRET_ENDPOINT" }],
  };
}

test("search/web contract handler delegates and keeps invocation summaries compact", () => {
  const calls = [];
  const handlers = createPluginSearchWebContractCapabilityHandlers({
    buildOpenClawPluginSearchWebAdapterContract: (input) => {
      calls.push(input);
      return buildContract();
    },
  });

  const backend = handlers.callBackend(capability, {
    params: { workspacePath: "/tmp/workspace", q: "search secret", limit: 4 },
  });

  assert.equal(backend.handled, true);
  assert.deepEqual(calls, [{
    workspacePath: "/tmp/workspace",
    query: "search secret",
    limit: 4,
  }]);
  assert.deepEqual(handlers.summariseResult(capability, backend.result), {
    kind: "plugin.search_web_adapter_contract",
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-contract-v0",
    providerContractCount: 2,
    operationCount: 3,
    requiredChecks: 8,
    passedRequired: 8,
    failedRequired: 0,
    adapterContractReady: true,
    runtimeAdapterImplemented: false,
    noNetwork: true,
    noModuleImport: true,
    noPluginExecution: true,
    noRuntimeActivation: true,
    noTaskCreation: true,
    noApprovalCreation: true,
    noManifestBodyExposure: true,
    noAuthEnvVarNameExposure: true,
    noEndpointHostExposure: true,
    noConfigSchemaExposure: true,
    noSourceContentExposure: true,
    requiresExplicitApprovalBeforeNetworkUse: true,
  });
});

test("common capability runtime invokes the existing search/web contract builder", async () => {
  const events = [];
  const state = {
    tasks: new Map(),
    runtimeState: {},
    capabilityInvocationLog: [],
    MAX_CAPABILITY_INVOCATION_ENTRIES: 20,
    CAPABILITY_HEALTH_TIMEOUT_MS: 50,
    CROSS_BOUNDARY_INTENTS: new Set(),
    persistState: () => {},
  };
  const client = {
    eventHubUrl: "http://127.0.0.1:4201",
    sessionManagerUrl: "http://127.0.0.1:4202",
    browserRuntimeUrl: "http://127.0.0.1:4203",
    screenSenseUrl: "http://127.0.0.1:4204",
    screenActUrl: "http://127.0.0.1:4205",
    systemSenseUrl: "http://127.0.0.1:4206",
    systemHealUrl: "http://127.0.0.1:4207",
    fetchJson: async () => ({ ok: true }),
    postJson: async () => ({ ok: true }),
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4200,
    client,
    state,
    pluginReview: {
      buildOpenClawPluginSearchWebAdapterContract: (input) => {
        assert.deepEqual(input, { workspacePath: "/tmp/workspace", query: "secret query", limit: 2 });
        return buildContract();
      },
    },
    taskManager: {},
    policyEvaluator: {
      evaluatePolicyIntent: (input) => ({
        id: "policy-search-web-contract-test",
        decision: "audit_only",
        domain: input.domain,
        risk: input.risk,
        reason: "body_internal_audit",
        approved: input.approved,
      }),
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: () => true,
    },
    publishEvent: async (name, body) => events.push({ name, body }),
    fetchImpl: async () => ({
      ok: true,
      statusText: "OK",
      json: async () => ({ ok: true }),
    }),
    now: () => "2026-07-17T00:00:00.000Z",
  });

  const response = await runtime.invokeCapability({
    capabilityId: capability.id,
    intent: "plugin.search_web.contract",
    params: { workspacePath: "/tmp/workspace", query: "secret query", limit: 2 },
  });

  assert.equal(response.response.invoked, true);
  assert.equal(response.response.result.registry, "openclaw-plugin-search-web-adapter-contract-v0");
  assert.equal(response.response.summary.kind, "plugin.search_web_adapter_contract");
  assert.equal(response.response.summary.noNetwork, true);
  assert.equal(response.response.summary.noTaskCreation, true);
  assert.equal(response.response.summary.noApprovalCreation, true);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("SECRET_ENDPOINT"), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});
