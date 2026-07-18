import assert from "node:assert/strict";
import test from "node:test";

import {
  SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID,
  createSystemdIncidentObservationCapabilityHandlers,
} from "../src/capability-runtime-systemd-incident-observation.mjs";
import { createCapabilityRuntime } from "../src/capability-runtime.mjs";
import { createSystemdIncidentRepairTask } from "./systemd-incident-fixture.mjs";

function createProviderTask(sourceTask, overrides = {}) {
  const receipt = sourceTask.outcome.details.incidentReceipt;
  return {
    id: "provider-observation-task-1",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    cloudConsciousnessLiveProviderEgressExecution: {
      responseContract: "engineering_recommendation_v0",
      recommendation: {
        registry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
        contract: "engineering_recommendation_v0",
        valid: true,
        actionId: "refresh_systemd_incident_observation",
        existingObserverControlId: "refresh-systemd-journal-evidence-button",
        existingCapabilityId: SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID,
        requiresOperatorReview: true,
        requiresApproval: false,
      },
      contextPacket: {
        sourceTaskId: sourceTask.id,
        systemdIncidentReceiptHash: receipt.receiptHash,
      },
      systemdIncidentContext: {
        registry: "openclaw-systemd-incident-provider-context-v0",
        sourceTaskId: sourceTask.id,
        sourceReceiptHash: receipt.receiptHash,
        target: { ...receipt.target },
      },
      ...overrides,
    },
  };
}

function observationResponses() {
  return {
    health: {
      system: {
        services: {
          eventHub: { ok: true, privateUrl: "http://private-health.invalid" },
        },
      },
    },
    inventory: {
      registry: "openclaw-systemd-unit-inventory-v0",
      units: [{
        unit: "openclaw-event-hub.service",
        systemdObserved: true,
        loadState: "loaded",
        activeState: "active",
        subState: "running",
      }],
    },
    journal: {
      registry: "openclaw-systemd-journal-evidence-v0",
      unit: "openclaw-event-hub.service",
      requestedLines: 25,
      available: true,
      summary: { returned: 2, parseErrors: 0 },
      entries: [
        { message: "private journal message one" },
        { message: "private journal message two" },
      ],
    },
  };
}

function createHarness({ providerOverrides, publishEvent } = {}) {
  const sourceTask = createSystemdIncidentRepairTask();
  const providerTask = createProviderTask(sourceTask, providerOverrides);
  const tasks = new Map([
    [sourceTask.id, sourceTask],
    [providerTask.id, providerTask],
  ]);
  const calls = [];
  const events = [];
  let persistCount = 0;
  const responses = observationResponses();
  const handlers = createSystemdIncidentObservationCapabilityHandlers({
    tasks,
    systemSenseUrl: "http://system-sense.invalid",
    fetchJson: async (url) => {
      calls.push(url);
      if (url.endsWith("/system/health")) return responses.health;
      if (url.endsWith("/system/systemd/units")) return responses.inventory;
      if (url.includes("/system/systemd/journal-evidence?")) return responses.journal;
      throw new Error(`Unexpected URL ${url}`);
    },
    persistState: () => {
      persistCount += 1;
    },
    publishEvent: publishEvent ?? (async (name, body) => events.push({ name, body })),
    now: () => "2026-07-18T13:15:00.000Z",
  });
  const capability = { id: SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID };
  const request = { params: { providerTaskId: providerTask.id, confirm: true } };
  return {
    handlers,
    capability,
    request,
    sourceTask,
    providerTask,
    calls,
    events,
    persistCount: () => persistCount,
  };
}

test("systemd incident observation capability persists one compact hash-bound receipt", async () => {
  const harness = createHarness();
  const response = await harness.handlers.callBackend(harness.capability, harness.request);

  assert.equal(response.handled, true);
  assert.equal(response.result.ok, true);
  assert.equal(response.result.receipt.target.unit, "openclaw-event-hub.service");
  assert.equal(response.result.receipt.health.serviceHealthy, true);
  assert.equal(response.result.receipt.health.unitRunning, true);
  assert.equal(response.result.receipt.journal.returned, 2);
  assert.equal(response.result.receipt.journal.messagesIncluded, false);
  assert.match(response.result.receipt.receiptHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(harness.persistCount(), 1);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.calls.length, 3);
  assert.equal(
    harness.providerTask.cloudConsciousnessLiveProviderEgressExecution
      .systemdIncidentObservationReceipt.receiptHash,
    response.result.receipt.receiptHash,
  );
  const persisted = JSON.stringify(harness.providerTask);
  assert.doesNotMatch(persisted, /private journal message|private-health/u);
  assert.doesNotMatch(JSON.stringify(harness.events), /private journal message|private-health/u);
});

test("systemd incident observation rejects a changed source binding before reading system-sense", async () => {
  const harness = createHarness({
    providerOverrides: {
      systemdIncidentContext: {
        registry: "openclaw-systemd-incident-provider-context-v0",
        sourceTaskId: "different-source-task",
        sourceReceiptHash: `sha256:${"a".repeat(64)}`,
        target: { unit: "openclaw-event-hub.service", healthServiceKey: "eventHub" },
      },
    },
  });

  await assert.rejects(
    () => harness.handlers.callBackend(harness.capability, harness.request),
    /source binding is invalid/u,
  );
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.persistCount(), 0);
});

test("systemd incident observation does not mutate task state when audit publishing fails", async () => {
  const harness = createHarness({
    publishEvent: async () => {
      throw new Error("event hub unavailable");
    },
  });

  await assert.rejects(
    () => harness.handlers.callBackend(harness.capability, harness.request),
    /event hub unavailable/u,
  );
  assert.equal(harness.persistCount(), 0);
  assert.equal(
    harness.providerTask.cloudConsciousnessLiveProviderEgressExecution
      .systemdIncidentObservationReceipt,
    undefined,
  );
});

test("production capability runtime records and summarises the compact observation receipt", async () => {
  const sourceTask = createSystemdIncidentRepairTask();
  const providerTask = createProviderTask(sourceTask, {
    providerResponse: { content: "private provider output" },
  });
  const tasks = new Map([
    [sourceTask.id, sourceTask],
    [providerTask.id, providerTask],
  ]);
  const responses = observationResponses();
  const fetchCalls = [];
  const events = [];
  let persistCount = 0;
  const state = {
    tasks,
    capabilityInvocationLog: [],
    CROSS_BOUNDARY_INTENTS: [],
    persistState: () => {
      persistCount += 1;
    },
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
      fetchJson: async (url) => {
        fetchCalls.push(url);
        if (url.endsWith("/system/health")) return responses.health;
        if (url.endsWith("/system/systemd/units")) return responses.inventory;
        if (url.includes("/system/systemd/journal-evidence?")) return responses.journal;
        throw new Error(`Unexpected URL ${url}`);
      },
      postJson: async () => ({ ok: true }),
    },
    state,
    pluginReview: {},
    taskManager: {},
    policyEvaluator: {
      evaluatePolicyIntent: (input) => ({
        id: "policy-observation-receipt",
        decision: "allow",
        domain: input.domain,
        risk: input.risk,
        reason: "bounded_local_observation",
        approved: false,
        autonomyMode: "guardian",
        autonomous: false,
      }),
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: (decision) => decision.decision === "allow",
    },
    publishEvent: async (name, body) => events.push({ name, body }),
    now: () => "2026-07-18T13:15:00.000Z",
  });

  const response = await runtime.invokeCapability({
    capabilityId: SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID,
    intent: "systemd_incident.observation_receipt",
    params: { providerTaskId: providerTask.id, confirm: true },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.response.invoked, true);
  assert.equal(response.response.summary.kind, "systemd_incident.observation_receipt");
  assert.equal(response.response.summary.targetUnit, "openclaw-event-hub.service");
  assert.equal(response.response.summary.journalEntries, 2);
  assert.equal(response.response.summary.journalMessagesIncluded, false);
  assert.equal(response.response.summary.providerOutputIncluded, false);
  assert.equal(response.response.summary.noProviderEgress, true);
  assert.equal(response.response.summary.noRepairAuthority, true);
  assert.equal(fetchCalls.length, 3);
  assert.equal(persistCount, 2);
  assert.match(
    providerTask.cloudConsciousnessLiveProviderEgressExecution
      .systemdIncidentObservationReceipt.receiptHash,
    /^sha256:[a-f0-9]{64}$/u,
  );
  assert.doesNotMatch(JSON.stringify(response.response.result), /private journal message|private provider output/u);
  assert.doesNotMatch(JSON.stringify(state.capabilityInvocationLog), /private journal message|private provider output/u);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "systemd_incident.observation_receipt_recorded",
    "capability.invoked",
  ]);
});

test("production capability runtime rejects missing confirmation before policy or observation", async () => {
  const sourceTask = createSystemdIncidentRepairTask();
  const providerTask = createProviderTask(sourceTask);
  const events = [];
  const fetchCalls = [];
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
      fetchJson: async (url) => {
        fetchCalls.push(url);
        return { ok: true };
      },
      postJson: async () => ({ ok: true }),
    },
    state: {
      tasks: new Map([
        [sourceTask.id, sourceTask],
        [providerTask.id, providerTask],
      ]),
      capabilityInvocationLog: [],
      CROSS_BOUNDARY_INTENTS: [],
    },
    pluginReview: {},
    taskManager: {},
    policyEvaluator: {
      evaluatePolicyIntent: () => {
        throw new Error("policy must not run");
      },
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: () => true,
    },
    publishEvent: async (name) => events.push(name),
  });

  const response = await runtime.invokeCapability({
    capabilityId: SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID,
    params: { providerTaskId: providerTask.id, confirm: false },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.response.error, /requires confirm=true/u);
  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(events, []);
});
