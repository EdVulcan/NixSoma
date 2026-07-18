import { createHash } from "node:crypto";

import { HOSTD_RESTART_CAPABILITIES } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import { systemdHealthServiceKeyForUnit } from "./systemd-repair-verification.mjs";

export const FIXED_UNIT_INCIDENT_SCHEDULER_REGISTRY =
  "openclaw-fixed-unit-incident-scheduler-v0";
export const FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY =
  "openclaw-fixed-unit-incident-observation-v0";
export const FIXED_UNIT_INCIDENT_TASK_TYPE = "systemd_fixed_unit_incident_task";
export const DEFAULT_FIXED_UNIT_INCIDENT_INTERVAL_MS = 5 * 60 * 1000;
export const MIN_FIXED_UNIT_INCIDENT_INTERVAL_MS = 30 * 1000;
export const MAX_FIXED_UNIT_INCIDENT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const FIXED_TARGETS = Object.freeze(HOSTD_RESTART_CAPABILITIES.map((capability) => Object.freeze({
  unit: capability.targetUnit,
  healthServiceKey: systemdHealthServiceKeyForUnit(capability.targetUnit),
})));

function compactEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : "unknown";
}

function boundedIntervalMs(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FIXED_UNIT_INCIDENT_INTERVAL_MS;
  return Math.min(MAX_FIXED_UNIT_INCIDENT_INTERVAL_MS, Math.max(MIN_FIXED_UNIT_INCIDENT_INTERVAL_MS, parsed));
}

function compactTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(Date.parse(value)).toISOString();
}

function compactUnitState(unit, targetUnit) {
  return {
    unit: targetUnit,
    systemdObserved: unit?.systemdObserved === true,
    loadState: compactEnum(unit?.loadState, ["loaded", "not-found", "error", "masked", "stub"]),
    activeState: compactEnum(unit?.activeState, ["active", "reloading", "inactive", "failed", "activating", "deactivating"]),
    subState: compactEnum(unit?.subState, ["running", "exited", "dead", "failed", "start", "stop", "auto-restart"]),
    observation: compactEnum(unit?.observation, [
      "dbus_properties_read_only",
      "dbus_properties_read_failed",
      "planned_inventory_only",
    ]),
  };
}

function compactServiceState(service, healthServiceKey) {
  return {
    key: healthServiceKey,
    ok: service?.ok === true,
    status: compactEnum(service?.status, ["healthy", "unhealthy", "offline"]),
  };
}

function observationHealthy(unit, service) {
  return unit.systemdObserved === true
    && unit.loadState === "loaded"
    && unit.activeState === "active"
    && unit.subState === "running"
    && service.ok === true;
}

function hashObservation(observation) {
  return `sha256:${createHash("sha256").update(JSON.stringify(observation)).digest("hex")}`;
}

function buildObservation({ target, health, inventory, observedAt }) {
  const rawUnit = Array.isArray(inventory?.units)
    ? inventory.units.find((unit) => unit?.unit === target.unit)
    : null;
  const unit = compactUnitState(rawUnit, target.unit);
  const rawService = target.healthServiceKey === "systemSense" && health?.ok === true
    ? { ok: true, status: "healthy" }
    : health?.system?.services?.[target.healthServiceKey];
  const service = compactServiceState(rawService, target.healthServiceKey);
  const healthState = {
    unit,
    service,
    healthy: observationHealthy(unit, service),
  };
  const fingerprint = hashObservation({ target, health: healthState });
  return {
    registry: FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
    mode: "automatic_local_read_only",
    observedAt,
    fingerprint,
    target,
    health: healthState,
    governance: {
      domain: "body_internal",
      risk: "low",
      approvalRequired: false,
      readOnly: true,
      callsProvider: false,
      createsProviderApproval: false,
      authorizesRepair: false,
      invokesHostd: false,
      activatesGeneration: false,
      rollsBackGeneration: false,
      journalMessagesIncluded: false,
      errorTextIncluded: false,
      urlsIncluded: false,
      credentialsIncluded: false,
      commandsIncluded: false,
    },
  };
}

function normaliseUnitSchedulerState(value) {
  if (!value || typeof value !== "object") return null;
  const status = value.status === "unhealthy" ? "unhealthy" : "healthy";
  const fingerprint = status === "unhealthy"
    && typeof value.fingerprint === "string"
    && /^sha256:[a-f0-9]{64}$/u.test(value.fingerprint)
    ? value.fingerprint
    : null;
  return {
    status,
    fingerprint,
    lastObservedAt: compactTimestamp(value.lastObservedAt),
    latestTaskId: typeof value.latestTaskId === "string" && value.latestTaskId.trim()
      ? value.latestTaskId.trim()
      : null,
  };
}

function normaliseSchedulerState(state, { enabled, intervalMs }) {
  const sourceUnits = state?.units && typeof state.units === "object" ? state.units : {};
  const units = {};
  for (const target of FIXED_TARGETS) {
    const restored = normaliseUnitSchedulerState(sourceUnits[target.unit]);
    if (restored) units[target.unit] = restored;
  }
  Object.assign(state, {
    registry: FIXED_UNIT_INCIDENT_SCHEDULER_REGISTRY,
    enabled,
    intervalMs,
    lastTickAt: compactTimestamp(state.lastTickAt),
    nextDueAt: compactTimestamp(state.nextDueAt),
    lastResult: typeof state.lastResult === "string" ? state.lastResult : "not_started",
    lastFailure: state.lastFailure?.code === "system_sense_read_failed"
      ? { code: "system_sense_read_failed", at: compactTimestamp(state.lastFailure.at) }
      : null,
    units,
  });
  for (const key of Object.keys(state)) {
    if (!["registry", "enabled", "intervalMs", "lastTickAt", "nextDueAt", "lastResult", "lastFailure", "units"].includes(key)) {
      delete state[key];
    }
  }
  return state;
}

function nextDueAt(nowMs, intervalMs) {
  return new Date(nowMs + intervalMs).toISOString();
}

export function listFixedUnitIncidentTargets() {
  return FIXED_TARGETS.map((target) => ({ ...target }));
}

export function createFixedUnitIncidentScheduler({
  enabled = false,
  intervalMs = DEFAULT_FIXED_UNIT_INCIDENT_INTERVAL_MS,
  fetchJson,
  systemSenseUrl,
  taskManager,
  schedulerState = {},
  persistState = () => {},
  publishAuditEvent = async () => ({ ok: true }),
  nowMs = () => Date.now(),
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timer) => clearTimeout(timer),
} = {}) {
  const configuredIntervalMs = boundedIntervalMs(intervalMs);
  const state = normaliseSchedulerState(schedulerState, {
    enabled: enabled === true,
    intervalMs: configuredIntervalMs,
  });
  let timer = null;
  let inFlight = null;
  let started = false;

  function applyReadFailure(at, currentMs) {
    Object.assign(state, {
      lastTickAt: at,
      nextDueAt: nextDueAt(currentMs, configuredIntervalMs),
      lastResult: "read_failed",
      lastFailure: { code: "system_sense_read_failed", at },
    });
    persistState();
  }

  function applySuccessfulObservation(observations, at, currentMs, createdTaskByUnit) {
    for (const observation of observations) {
      const prior = state.units[observation.target.unit] ?? {};
      const unhealthy = observation.health.healthy !== true;
      state.units[observation.target.unit] = {
        status: unhealthy ? "unhealthy" : "healthy",
        fingerprint: unhealthy ? observation.fingerprint : null,
        lastObservedAt: at,
        latestTaskId: createdTaskByUnit.get(observation.target.unit)?.id ?? prior.latestTaskId ?? null,
      };
    }
    Object.assign(state, {
      lastTickAt: at,
      nextDueAt: nextDueAt(currentMs, configuredIntervalMs),
      lastResult: createdTaskByUnit.size > 0 ? "incidents_created" : "observed",
      lastFailure: null,
    });
    persistState();
  }

  async function runTick() {
    if (!state.enabled) return { ok: true, skipped: true, reason: "disabled", createdTaskIds: [] };
    const currentMs = Number(nowMs());
    const observedAt = new Date(currentMs).toISOString();
    let health;
    let inventory;
    try {
      [health, inventory] = await Promise.all([
        fetchJson(`${systemSenseUrl}/system/health`),
        fetchJson(`${systemSenseUrl}/system/systemd/units`),
      ]);
    } catch {
      applyReadFailure(observedAt, currentMs);
      await publishAuditEvent("systemd.fixed_unit_incident_scheduler_read_failed", {
        registry: FIXED_UNIT_INCIDENT_SCHEDULER_REGISTRY,
        observedAt,
        code: "system_sense_read_failed",
        createsTask: false,
        callsProvider: false,
        authorizesRepair: false,
      }).catch(() => null);
      return { ok: false, reason: "system_sense_read_failed", createdTaskIds: [] };
    }

    const observations = FIXED_TARGETS.map((target) => buildObservation({
      target,
      health,
      inventory,
      observedAt,
    }));
    const incidents = observations.filter((observation) => {
      if (observation.health.healthy) return false;
      const prior = state.units[observation.target.unit];
      return prior?.status !== "unhealthy" || prior.fingerprint !== observation.fingerprint;
    });

    for (const observation of incidents) {
      let audit;
      try {
        audit = await publishAuditEvent("systemd.fixed_unit_incident_observed", {
          registry: FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
          observedAt,
          fingerprint: observation.fingerprint,
          target: observation.target,
          health: observation.health,
          governance: observation.governance,
        });
      } catch {
        audit = { ok: false };
      }
      if (audit?.ok !== true) {
        return { ok: false, reason: "incident_audit_failed", createdTaskIds: [] };
      }
    }

    const createdTaskByUnit = new Map();
    for (const observation of incidents) {
      const task = taskManager.createTask({
        goal: `Record automatic local incident observation for ${observation.target.unit}`,
        type: FIXED_UNIT_INCIDENT_TASK_TYPE,
        intent: "systemd_incident.observe",
        policy: {
          intent: "systemd_incident.observe",
          domain: "body_internal",
          risk: "low",
          approvalRequired: false,
        },
        systemdIncidentObservation: observation,
      }, { skipInitialPolicy: true });
      taskManager.completeTask(task, {
        summary: `Recorded an automatic read-only incident for ${observation.target.unit}.`,
        systemdIncidentObservation: observation,
      });
      createdTaskByUnit.set(observation.target.unit, task);
    }
    applySuccessfulObservation(observations, observedAt, currentMs, createdTaskByUnit);
    return {
      ok: true,
      skipped: false,
      observedUnits: observations.length,
      createdTaskIds: [...createdTaskByUnit.values()].map((task) => task.id),
    };
  }

  function tick() {
    if (inFlight) return inFlight;
    inFlight = runTick().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function scheduleNext() {
    if (!started || !state.enabled || timer !== null) return;
    const currentMs = Number(nowMs());
    state.nextDueAt = nextDueAt(currentMs, configuredIntervalMs);
    persistState();
    timer = setTimer(async () => {
      timer = null;
      try {
        await tick();
      } finally {
        scheduleNext();
      }
    }, configuredIntervalMs);
  }

  function start() {
    if (started) return false;
    started = true;
    scheduleNext();
    return state.enabled;
  }

  function stop() {
    started = false;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    state.nextDueAt = null;
    persistState();
  }

  function readState() {
    return JSON.parse(JSON.stringify({
      ...state,
      running: started,
      tickInFlight: inFlight !== null,
      fixedTargets: listFixedUnitIncidentTargets(),
    }));
  }

  return { start, stop, tick, readState };
}
