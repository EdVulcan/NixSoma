import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

function createHarness({ transcriptRecord } = {}) {
  const events = [];
  const calls = { transcriptLimits: [], postJson: [] };
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
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    browserRuntimeUrl: "http://127.0.0.1:4103",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    fetchJson: async () => ({ ok: true }),
    postJson: async (url) => {
      calls.postJson.push(url);
      return { ok: true };
    },
  };
  const policyEvaluator = {
    evaluatePolicyIntent: (input) => ({
      id: "policy-microcompact-test",
      decision: "audit_only",
      domain: input.domain,
      risk: input.risk,
      reason: "body_internal_audit",
      approved: input.approved,
    }),
    recordPolicyDecision: (decision) => decision,
    isPolicyExecutionAllowed: () => true,
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4100,
    client,
    state,
    pluginReview: {},
    taskManager: {},
    policyEvaluator,
    publishEvent: async (name, body) => events.push({ name, body }),
    fetchImpl: async () => ({
      ok: true,
      statusText: "OK",
      json: async () => ({ ok: true, service: "test-service" }),
    }),
    listCommandTranscriptRecords: ({ limit }) => {
      calls.transcriptLimits.push(limit);
      return transcriptRecord ? [transcriptRecord] : [];
    },
    now: () => "2026-07-15T00:00:00.000Z",
  });
  return { runtime, state, events, calls };
}

test("capability runtime exposes bounded microcompact evidence without raw output", async () => {
  const outputSecret = "MICROCOMPACT_OUTPUT_SECRET_DO_NOT_PERSIST";
  const { runtime, state, events, calls } = createHarness({
    transcriptRecord: {
      taskId: "microcompact-task",
      index: 0,
      command: "npm test",
      stdout: `${outputSecret} ${"x".repeat(800)}`,
      stderr: "",
      state: "executed",
      capabilityId: "act.system.command.execute",
      exitCode: 0,
      timedOut: false,
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.engineering_context.microcompact_evidence");
  assert.equal(capability?.kind, "sensor");
  assert.equal(capability?.governance, "audit_only");
  assert.equal(capability?.available, true);

  const response = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.microcompact_evidence",
    params: { limit: 4, thresholdChars: 100, protectRecentItems: 0 },
  });

  assert.equal(response.response.invoked, true);
  assert.equal(response.response.result.capability.id, "sense.openclaw.engineering_context.microcompact_evidence");
  assert.equal(response.response.result.summary.compactableItems, 1);
  assert.equal(response.response.result.bounds.noRawOutputText, true);
  assert.equal(response.response.summary.kind, "engineering.microcompact_evidence");
  assert.equal(response.response.summary.noRuntimeMessageMutation, true);
  assert.equal(response.response.summary.noPersistedLogMutation, true);
  assert.equal(response.response.summary.noProviderEgress, true);
  assert.deepEqual(calls.transcriptLimits, [4]);
  assert.deepEqual(calls.postJson, []);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes(outputSecret), false);
  assert.equal(JSON.stringify(events).includes(outputSecret), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime projects a caller-owned microcompact copy with summary-only audit", async () => {
  const inputSecret = "MICROCOMPACT_PROJECTION_SECRET_DO_NOT_PERSIST";
  const messages = [
    { role: "assistant", content: [{ type: "text", text: "old turn" }] },
    {
      role: "toolResult",
      toolName: "cc_grep",
      content: [{ type: "text", text: `${inputSecret} ${"y".repeat(800)}` }],
    },
    { role: "assistant", content: [{ type: "text", text: "current turn" }] },
  ];
  const before = structuredClone(messages);
  const { runtime, state, events, calls } = createHarness();

  const response = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.microcompact_projection",
    params: { messages, thresholdChars: 100, protectRecentAssistantTurns: 0 },
  });

  assert.equal(response.response.invoked, true);
  assert.equal(response.response.result.capability.id, "act.openclaw.engineering_context.microcompact_projection");
  assert.equal(response.response.result.summary.compactedMessages, 1);
  assert.equal(response.response.result.summary.reclaimedChars > 0, true);
  assert.equal(response.response.result.messages[1].content[0].text.includes(inputSecret), false);
  assert.deepEqual(messages, before);
  assert.equal(response.response.summary.kind, "engineering.microcompact_projection");
  assert.equal(response.response.summary.noInputMutation, true);
  assert.equal(response.response.summary.noPersistedMutation, true);
  assert.equal(response.response.summary.noProviderEgress, true);
  assert.deepEqual(calls.transcriptLimits, []);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes(inputSecret), false);
  assert.equal(JSON.stringify(events).includes(inputSecret), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "native_engineering.microcompact_projection_built",
    "capability.invoked",
  ]);
});

test("capability runtime rejects an invalid microcompact projection before policy", async () => {
  const { runtime, state, events } = createHarness();
  const response = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.microcompact_projection",
    params: { messages: "not-an-array" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.response.error, "Microcompact projection requires messages[].");
  assert.equal(state.capabilityInvocationLog.length, 0);
  assert.deepEqual(events, []);
});
