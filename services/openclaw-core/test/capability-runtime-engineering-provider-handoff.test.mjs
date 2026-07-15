import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

const CAPABILITY_ID = "act.openclaw.engineering_context.provider_handoff_task";
const CREDENTIAL_REFERENCE = "openclaw://credential/deepseek-api-key";

function createHarness({ policyDecision = {} } = {}) {
  const events = [];
  const calls = [];
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
    eventHubUrl: "http://127.0.0.1:4301",
    sessionManagerUrl: "http://127.0.0.1:4302",
    browserRuntimeUrl: "http://127.0.0.1:4303",
    screenSenseUrl: "http://127.0.0.1:4304",
    screenActUrl: "http://127.0.0.1:4305",
    systemSenseUrl: "http://127.0.0.1:4306",
    systemHealUrl: "http://127.0.0.1:4307",
    fetchJson: async () => ({ ok: true }),
    postJson: async () => ({ ok: true }),
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4300,
    client,
    state,
    pluginReview: {},
    taskManager: {},
    policyEvaluator: {
      evaluatePolicyIntent: (input) => ({
        id: "provider-handoff-policy",
        decision: input.approved ? "audit_only" : "require_approval",
        domain: input.domain,
        risk: input.risk,
        reason: input.approved ? "approved_and_audited" : "cross_boundary_requires_user_approval",
        approved: input.approved,
        ...policyDecision,
      }),
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: (decision) => decision.decision !== "require_approval" && decision.decision !== "deny",
    },
    providerRuntime: {
      createCloudConsciousnessLiveProviderEgressExecutionTask: async (input) => {
        calls.push(input);
        return {
          ok: true,
          registry: "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0",
          task: {
            id: "provider-handoff-task-1",
            status: "queued",
            cloudConsciousnessLiveProviderEgressExecution: {
              requestBinding: {
                provider: "deepseek",
                model: "deepseek-chat",
                endpointFingerprint: "e".repeat(64),
                credentialReference: CREDENTIAL_REFERENCE,
                requestContentHash: "r".repeat(64),
                contextContentHash: "c".repeat(64),
                sourceTaskId: "source-task-1",
                responseContract: "engineering_recommendation_v0",
                requestContentIncluded: false,
                credentialValueIncluded: false,
              },
            },
          },
          approval: { id: "provider-handoff-approval-1", status: "pending" },
          governance: {
            createsTask: true,
            createsApproval: true,
            endpointContacted: false,
            networkEgress: false,
            providerResponseCreated: false,
            providerCall: false,
          },
        };
      },
    },
    publishEvent: async (name, body) => events.push({ name, body }),
    fetchImpl: async () => ({
      ok: true,
      statusText: "OK",
      json: async () => ({ ok: true }),
    }),
    now: () => "2026-07-15T00:00:00.000Z",
  });
  return { runtime, state, events, calls };
}

function request(overrides = {}) {
  return {
    capabilityId: CAPABILITY_ID,
    approved: true,
    params: {
      confirm: true,
      liveProviderExecution: {
        credentialReference: CREDENTIAL_REFERENCE,
        requestEnvelope: {
          model: "deepseek-chat",
          messages: [{ role: "user", content: "transient provider prompt" }],
        },
        contextPacket: { requested: true, sourceTaskId: "source-task-1" },
        contextContentHash: "c".repeat(64),
        responseContract: "engineering_recommendation_v0",
      },
    },
    ...overrides,
  };
}

test("provider handoff capability remains explicitly approval-gated and request-bound", async () => {
  const { runtime, state, events, calls } = createHarness();
  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === CAPABILITY_ID);

  assert.equal(capability?.governance, "require_approval");
  assert.equal(capability?.requiresApproval, true);
  assert.equal(capability?.available, true);

  const blocked = await runtime.invokeCapability({
    capabilityId: CAPABILITY_ID,
    params: { confirm: false },
  });
  assert.equal(blocked.response.invoked, false);
  assert.equal(blocked.response.blocked, true);
  assert.equal(blocked.response.reason, "policy_requires_approval");
  assert.equal(calls.length, 0);

  const created = await runtime.invokeCapability(request());
  assert.equal(created.response.invoked, true);
  assert.equal(created.response.result.task.id, "provider-handoff-task-1");
  assert.equal(created.response.result.approval.status, "pending");
  assert.equal(created.response.summary.kind, "engineering.provider_handoff_task");
  assert.equal(created.response.summary.requestBound, true);
  assert.equal(created.response.summary.contextBound, true);
  assert.equal(created.response.summary.noProviderCall, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].confirm, true);
  assert.equal(calls[0].liveProviderExecution.requested, true);
  assert.equal(calls[0].liveProviderExecution.credentialReference, CREDENTIAL_REFERENCE);
  assert.equal(calls[0].liveProviderExecution.contextPacket.sourceTaskId, "source-task-1");
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("transient provider prompt"), false);
  assert.equal(JSON.stringify(events).includes("transient provider prompt"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.blocked",
    "policy.evaluated",
    "capability.invoked",
  ]);
});

test("provider handoff capability rejects non-DeepSeek or malformed request bindings", async () => {
  const { runtime, events } = createHarness();
  const invalidCredential = await runtime.invokeCapability(request({
    params: {
      confirm: true,
      liveProviderExecution: {
        credentialReference: "openclaw://credential/other",
        requestEnvelope: { messages: [{ role: "user", content: "no" }] },
      },
    },
  }));
  assert.equal(invalidCredential.statusCode, 400);
  assert.match(invalidCredential.response.error, /fixed DeepSeek reference/);

  const invalidHash = await runtime.invokeCapability(request({
    params: {
      confirm: true,
      liveProviderExecution: {
        credentialReference: CREDENTIAL_REFERENCE,
        requestEnvelope: { messages: [{ role: "user", content: "no" }] },
        contextContentHash: "not-a-hash",
      },
    },
  }));
  assert.equal(invalidHash.statusCode, 400);
  assert.match(invalidHash.response.error, /SHA-256 hash/);

  const invalidEnvelope = await runtime.invokeCapability(request({
    params: {
      confirm: true,
      liveProviderExecution: {
        credentialReference: CREDENTIAL_REFERENCE,
        requestEnvelope: {
          messages: [{ role: "tool", content: "unsupported role" }],
        },
      },
    },
  }));
  assert.equal(invalidEnvelope.statusCode, 400);
  assert.match(invalidEnvelope.response.error, /requestEnvelope is invalid/);

  const oversizedEnvelope = await runtime.invokeCapability(request({
    params: {
      confirm: true,
      liveProviderExecution: {
        credentialReference: CREDENTIAL_REFERENCE,
        requestEnvelope: {
          messages: [{ role: "user", content: "x".repeat(8_001) }],
        },
      },
    },
  }));
  assert.equal(oversizedEnvelope.statusCode, 400);
  assert.match(oversizedEnvelope.response.error, /requestEnvelope is invalid/);
  assert.deepEqual(events, []);
});
