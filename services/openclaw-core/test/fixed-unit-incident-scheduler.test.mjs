import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
  FIXED_UNIT_INCIDENT_SCHEDULER_REGISTRY,
  FIXED_UNIT_INCIDENT_TASK_TYPE,
  createFixedUnitIncidentScheduler,
  listFixedUnitIncidentTargets,
} from "../src/fixed-unit-incident-scheduler.mjs";

const NOW_MS = Date.parse("2026-07-18T14:30:00.000Z");

function healthyResponses() {
  const targets = listFixedUnitIncidentTargets();
  return {
    health: {
      ok: true,
      system: {
        services: Object.fromEntries(targets
          .filter((target) => target.healthServiceKey !== "systemSense")
          .map((target) => [target.healthServiceKey, {
            name: target.healthServiceKey,
            ok: true,
            status: "healthy",
            url: `http://private.invalid/${target.healthServiceKey}`,
            error: "must not persist",
          }])),
      },
    },
    inventory: {
      ok: true,
      units: targets.map((target) => ({
        unit: target.unit,
        systemdObserved: true,
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        observation: "dbus_properties_read_only",
        fragmentPath: `/nix/store/private/${target.unit}`,
      })),
    },
  };
}

function markUnhealthy(responses, unit, {
  serviceStatus = "unhealthy",
  activeState = "failed",
  subState = "failed",
} = {}) {
  const target = listFixedUnitIncidentTargets().find((candidate) => candidate.unit === unit);
  const systemdUnit = responses.inventory.units.find((candidate) => candidate.unit === unit);
  systemdUnit.activeState = activeState;
  systemdUnit.subState = subState;
  if (target.healthServiceKey !== "systemSense") {
    responses.health.system.services[target.healthServiceKey].ok = false;
    responses.health.system.services[target.healthServiceKey].status = serviceStatus;
  }
}

function createHarness({
  responses = healthyResponses(),
  schedulerState = {},
  publishAuditEvent = async () => ({ ok: true }),
  fetchJson,
  setTimer,
  clearTimer,
} = {}) {
  const tasks = [];
  let persistenceCount = 0;
  let taskSequence = 0;
  const taskManager = {
    createTask(body, options) {
      const task = { id: `scheduled-task-${++taskSequence}`, status: "queued", ...body };
      tasks.push({ task, options });
      return task;
    },
    completeTask(task, details) {
      task.status = "completed";
      task.executionPhase = "completed";
      task.outcome = { kind: "completed", details, summary: details.summary };
      return task;
    },
  };
  const scheduler = createFixedUnitIncidentScheduler({
    enabled: true,
    intervalMs: 60_000,
    fetchJson: fetchJson ?? (async (url) => url.endsWith("/system/health")
      ? responses.health
      : responses.inventory),
    systemSenseUrl: "http://127.0.0.1:4106",
    taskManager,
    schedulerState,
    persistState: () => { persistenceCount += 1; },
    publishAuditEvent,
    nowMs: () => NOW_MS,
    setTimer,
    clearTimer,
  });
  return {
    scheduler,
    tasks,
    schedulerState,
    persistenceCount: () => persistenceCount,
  };
}

test("fixed-unit scheduler creates no task for healthy fixed targets", async () => {
  const harness = createHarness();

  const result = await harness.scheduler.tick();

  assert.equal(result.ok, true);
  assert.equal(result.observedUnits, 3);
  assert.deepEqual(result.createdTaskIds, []);
  assert.equal(harness.tasks.length, 0);
  assert.equal(harness.scheduler.readState().lastResult, "observed");
});

test("fixed-unit scheduler creates one compact completed incident task", async () => {
  const responses = healthyResponses();
  markUnhealthy(responses, "openclaw-system-heal.service");
  const audits = [];
  const harness = createHarness({
    responses,
    publishAuditEvent: async (type, payload) => {
      audits.push({ type, payload });
      return { ok: true };
    },
  });

  const result = await harness.scheduler.tick();

  assert.equal(result.createdTaskIds.length, 1);
  assert.equal(harness.tasks.length, 1);
  const { task, options } = harness.tasks[0];
  assert.equal(task.type, FIXED_UNIT_INCIDENT_TASK_TYPE);
  assert.equal(task.status, "completed");
  assert.equal(options.skipInitialPolicy, true);
  assert.equal(task.systemdIncidentObservation.registry, FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY);
  assert.equal(task.systemdIncidentObservation.target.unit, "openclaw-system-heal.service");
  assert.match(task.systemdIncidentObservation.fingerprint, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(task.systemdIncidentObservation.governance.approvalRequired, false);
  assert.equal(task.systemdIncidentObservation.governance.callsProvider, false);
  assert.equal(task.systemdIncidentObservation.governance.authorizesRepair, false);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].type, "systemd.fixed_unit_incident_observed");
  const serialised = JSON.stringify(task.systemdIncidentObservation);
  assert.doesNotMatch(serialised, /private\.invalid|must not persist|\/nix\/store|secret endpoint|commandText/u);
  assert.equal(task.systemdIncidentObservation.governance.credentialsIncluded, false);
  assert.equal(task.systemdIncidentObservation.governance.journalMessagesIncluded, false);
});

test("fixed-unit scheduler deduplicates one unchanged unhealthy fingerprint", async () => {
  const responses = healthyResponses();
  markUnhealthy(responses, "openclaw-event-hub.service");
  const harness = createHarness({ responses });

  await harness.scheduler.tick();
  await harness.scheduler.tick();

  assert.equal(harness.tasks.length, 1);
  assert.equal(
    harness.scheduler.readState().units["openclaw-event-hub.service"].latestTaskId,
    "scheduled-task-1",
  );
});

test("fixed-unit scheduler creates a new task after recovery and regression", async () => {
  const responses = healthyResponses();
  const harness = createHarness({ responses });

  markUnhealthy(responses, "openclaw-system-sense.service");
  await harness.scheduler.tick();
  const unit = responses.inventory.units.find((candidate) => candidate.unit === "openclaw-system-sense.service");
  unit.activeState = "active";
  unit.subState = "running";
  await harness.scheduler.tick();
  markUnhealthy(responses, "openclaw-system-sense.service");
  await harness.scheduler.tick();

  assert.equal(harness.tasks.length, 2);
  assert.equal(harness.scheduler.readState().units[unit.unit].status, "unhealthy");
});

test("fixed-unit scheduler keeps one health read in flight", async () => {
  const responses = healthyResponses();
  let releaseHealth;
  let healthReads = 0;
  const blockedHealth = new Promise((resolve) => { releaseHealth = resolve; });
  const harness = createHarness({
    fetchJson: async (url) => {
      if (url.endsWith("/system/health")) {
        healthReads += 1;
        await blockedHealth;
        return responses.health;
      }
      return responses.inventory;
    },
  });

  const first = harness.scheduler.tick();
  const second = harness.scheduler.tick();
  assert.equal(first, second);
  assert.equal(healthReads, 1);
  releaseHealth();
  await first;
  assert.equal(harness.scheduler.readState().tickInFlight, false);
});

test("fixed-unit scheduler makes no durable mutation when incident audit fails", async () => {
  const responses = healthyResponses();
  markUnhealthy(responses, "openclaw-system-heal.service");
  const harness = createHarness({
    responses,
    publishAuditEvent: async () => { throw new Error("event hub unavailable"); },
  });

  const result = await harness.scheduler.tick();

  assert.equal(result.ok, false);
  assert.equal(result.reason, "incident_audit_failed");
  assert.equal(harness.tasks.length, 0);
  assert.equal(harness.persistenceCount(), 0);
  assert.deepEqual(harness.schedulerState.units, {});
});

test("fixed-unit scheduler records compact read failure without an incident", async () => {
  const events = [];
  const harness = createHarness({
    fetchJson: async () => { throw new Error("secret endpoint failure text"); },
    publishAuditEvent: async (type, payload) => {
      events.push({ type, payload });
      return { ok: true };
    },
  });

  const result = await harness.scheduler.tick();

  assert.equal(result.reason, "system_sense_read_failed");
  assert.equal(harness.tasks.length, 0);
  assert.equal(harness.scheduler.readState().lastFailure.code, "system_sense_read_failed");
  assert.doesNotMatch(JSON.stringify(harness.scheduler.readState()), /secret endpoint/u);
  assert.equal(events[0].type, "systemd.fixed_unit_incident_scheduler_read_failed");
});

test("fixed-unit scheduler clears its timer when stopped", () => {
  const timers = [];
  const cleared = [];
  const harness = createHarness({
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => { cleared.push(timer); },
  });

  assert.equal(harness.scheduler.start(), true);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delayMs, 60_000);
  harness.scheduler.stop();
  assert.deepEqual(cleared, [timers[0]]);
  assert.equal(harness.scheduler.readState().running, false);
  assert.equal(harness.scheduler.readState().nextDueAt, null);
});

test("fixed-unit scheduler restores dedupe state and discards unknown units", async () => {
  const responses = healthyResponses();
  markUnhealthy(responses, "openclaw-event-hub.service");
  const persisted = {
    registry: FIXED_UNIT_INCIDENT_SCHEDULER_REGISTRY,
    enabled: true,
    units: {
      "untrusted.service": {
        status: "unhealthy",
        fingerprint: `sha256:${"a".repeat(64)}`,
        latestTaskId: "untrusted-task",
      },
    },
  };
  const first = createHarness({ responses, schedulerState: persisted });
  await first.scheduler.tick();
  const second = createHarness({ responses, schedulerState: persisted });

  await second.scheduler.tick();

  assert.equal(first.tasks.length, 1);
  assert.equal(second.tasks.length, 0);
  assert.equal(Object.hasOwn(second.scheduler.readState().units, "untrusted.service"), false);
  assert.deepEqual(listFixedUnitIncidentTargets().map((target) => target.unit).sort(), [
    "openclaw-event-hub.service",
    "openclaw-system-heal.service",
    "openclaw-system-sense.service",
  ]);
});
