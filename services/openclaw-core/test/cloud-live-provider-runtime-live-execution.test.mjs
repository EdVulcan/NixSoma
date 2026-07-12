import test from "node:test";
import assert from "node:assert/strict";

import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
  executeCloudConsciousnessLiveProviderRequest,
} from "../src/cloud-live-provider-runtime-live-execution.mjs";

function createHarness() {
  const calls = [];
  const events = [];
  const approvals = new Map([
    ["approval-1", { id: "approval-1", status: "approved", updatedAt: "2026-07-13T00:00:00.000Z" }],
  ]);
  const deps = {
    approvals,
    appendTaskPhase: (task, phase, details) => {
      calls.push({ name: "appendTaskPhase", phase, details });
      task.phaseHistory = [...(task.phaseHistory ?? []), { phase, details }];
      task.executionPhase = phase;
      return task;
    },
    completeTask: (task, details) => {
      calls.push({ name: "completeTask", details });
      task.status = "completed";
      task.outcome = { kind: "completed", details };
      return task;
    },
    failTask: (task, reason, details) => {
      calls.push({ name: "failTask", reason, details });
      task.status = "failed";
      task.outcome = { kind: "failed", reason, details };
      return task;
    },
    reconcileRuntimeState: () => calls.push({ name: "reconcileRuntimeState" }),
    persistState: () => calls.push({ name: "persistState" }),
    publishEvent: async (name, body) => events.push({ name, body }),
    serialiseTask: (task) => ({
      id: task.id,
      status: task.status,
      outcome: task.outcome ?? null,
      phaseHistory: task.phaseHistory ?? [],
    }),
  };
  return { approvals, calls, events, deps };
}

function createTask() {
  return {
    id: "task-1",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    status: "queued",
    approval: { requestId: "approval-1" },
    cloudConsciousnessLiveProviderEgressExecution: {
      registry: "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0",
    },
  };
}

function liveOptions(overrides = {}) {
  return {
    liveProviderExecution: {
      requested: true,
      taskId: "task-1",
      credentialReference: "openclaw://credential/deepseek-api-key",
      requestEnvelope: {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Summarise this bounded test." }],
      },
      authorization: {
        confirmed: true,
        credentialValueAccessAuthorized: true,
        endpointNetworkEgressAuthorized: true,
        liveProviderCallEnabled: true,
      },
      ...overrides,
    },
  };
}

test("live execution is inert when the operator does not request it", async () => {
  const harness = createHarness();
  const task = createTask();
  const result = await executeCloudConsciousnessLiveProviderRequest({
    ...harness.deps,
    task,
    options: {},
    sendLiveProviderRequestImpl: async () => {
      throw new Error("sender should not run");
    },
  });
  assert.equal(result, null);
  assert.equal(harness.calls.length, 0);
});

test("live execution rejects a request bound to a different task", async () => {
  const harness = createHarness();
  const task = createTask();
  let senderCalled = false;
  const result = await executeCloudConsciousnessLiveProviderRequest({
    ...harness.deps,
    task,
    options: liveOptions({ taskId: "task-other" }),
    sendLiveProviderRequestImpl: async () => {
      senderCalled = true;
      return { ok: true };
    },
  });
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "live_provider_request_task_mismatch");
  assert.equal(senderCalled, false);
  assert.equal(task.status, "queued");
});

test("approved live execution returns transient content but persists only compact evidence", async () => {
  const harness = createHarness();
  const task = createTask();
  let received;
  const result = await executeCloudConsciousnessLiveProviderRequest({
    ...harness.deps,
    task,
    options: liveOptions(),
    env: {
      OPENCLAW_CLOUD_PROVIDER_ENDPOINT: "https://api.deepseek.com",
      OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS: "true",
    },
    sendLiveProviderRequestImpl: async (input) => {
      received = input;
      return {
        ok: true,
        provider: "deepseek",
        model: "deepseek-chat",
        audit: {
          endpointFingerprint: "endpoint-hash",
          credentialReference: "openclaw://credential/deepseek-api-key",
          requestContentHash: "request-hash",
          responseContentHash: "response-hash",
          endpointContacted: true,
          networkEgress: true,
          transmitsExternally: true,
          providerResponseCreated: true,
        },
        governance: {
          providerCredentialRead: true,
          credentialValueRead: true,
          credentialValueExposed: false,
          endpointContacted: true,
          networkEgress: true,
          transmitsExternally: true,
          providerResponseCreated: true,
          liveProviderCallEnabled: true,
        },
        response: {
          id: "response-1",
          model: "deepseek-chat",
          assistantContent: "transient answer",
          responseContentHash: "response-hash",
          responseTruncated: false,
          usage: { total_tokens: 8 },
        },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "live_provider_call_completed");
  assert.equal(result.liveProvider.assistantContent, "transient answer");
  assert.equal(result.task.status, "completed");
  assert.equal(result.task.outcome.details.liveProvider.responseContentHash, "response-hash");
  assert.equal("assistantContent" in result.task.outcome.details.liveProvider, false);
  assert.equal(JSON.stringify(result.task).includes("transient answer"), false);
  assert.equal(received.operatorAuthorization.state, "authorized");
  assert.equal(received.operatorAuthorization.taskId, "task-1");
  assert.equal(received.providerRequest.request.body.messages[0].content, "Summarise this bounded test.");
  assert.equal(harness.events.at(-1).name, "task.phase_changed");
  assert.equal(harness.calls.some((call) => call.name === "failTask"), false);
  assert.equal(result.summary.registry, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY);
});

test("a blocked sender result fails the task without creating response evidence", async () => {
  const harness = createHarness();
  const task = createTask();
  const result = await executeCloudConsciousnessLiveProviderRequest({
    ...harness.deps,
    task,
    options: liveOptions(),
    sendLiveProviderRequestImpl: async () => ({
      ok: false,
      reason: "provider_credential_missing",
      audit: {
        endpointContacted: false,
        networkEgress: false,
        transmitsExternally: false,
        providerResponseCreated: false,
      },
      governance: {
        providerCredentialRead: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        transmitsExternally: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_credential_missing");
  assert.equal(task.status, "failed");
  assert.equal(task.outcome.details.liveProvider.providerResponseCreated, false);
  assert.equal(task.outcome.details.liveProvider.assistantContent, undefined);
  assert.equal(result.summary.endpointContacted, false);
  assert.equal(result.summary.networkEgress, false);
});
