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

export function hashFixedUnitIncidentObservation(observation) {
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
  const fingerprint = hashFixedUnitIncidentObservation({ target, health: healthState });
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
    latestTriageTaskId: typeof value.latestTriageTaskId === "string" && value.latestTriageTaskId.trim()
      ? value.latestTriageTaskId.trim()
      : null,
    triageStatus: ["completed", "failed"].includes(value.triageStatus)
      ? value.triageStatus
      : null,
    triageFailure: value.triageFailure?.code === "automatic_triage_failed"
      ? {
          code: "automatic_triage_failed",
          at: compactTimestamp(value.triageFailure.at),
        }
      : null,
    latestRepairTaskId: typeof value.latestRepairTaskId === "string" && value.latestRepairTaskId.trim()
      ? value.latestRepairTaskId.trim()
      : null,
    latestRepairApprovalId: typeof value.latestRepairApprovalId === "string" && value.latestRepairApprovalId.trim()
      ? value.latestRepairApprovalId.trim()
      : null,
    repairApprovalStatus: ["pending", "approved", "denied", "expired"].includes(value.repairApprovalStatus)
      ? value.repairApprovalStatus
      : null,
    repairPromotionStatus: ["completed", "failed"].includes(value.repairPromotionStatus)
      ? value.repairPromotionStatus
      : null,
    repairPromotionFailure: value.repairPromotionFailure?.code === "automatic_repair_promotion_failed"
      ? {
          code: "automatic_repair_promotion_failed",
          at: compactTimestamp(value.repairPromotionFailure.at),
        }
      : null,
    repairDispatchTaskId: typeof value.repairDispatchTaskId === "string" && value.repairDispatchTaskId.trim()
      ? value.repairDispatchTaskId.trim()
      : null,
    repairDispatchStatus: ["reserved", "completed", "failed"].includes(value.repairDispatchStatus)
      ? value.repairDispatchStatus
      : null,
    repairDispatchAt: compactTimestamp(value.repairDispatchAt),
    repairDispatchCompletedAt: compactTimestamp(value.repairDispatchCompletedAt),
    repairDispatchOutcomeStatus: ["completed", "failed"].includes(value.repairDispatchOutcomeStatus)
      ? value.repairDispatchOutcomeStatus
      : null,
    repairDispatchFailure: [
      "automatic_repair_dispatch_failed",
      "automatic_repair_dispatch_interrupted",
    ].includes(value.repairDispatchFailure?.code)
      ? {
          code: value.repairDispatchFailure.code,
          at: compactTimestamp(value.repairDispatchFailure.at),
        }
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

export function validateFixedUnitIncidentTask(task) {
  const observation = task?.systemdIncidentObservation;
  if (task?.type !== FIXED_UNIT_INCIDENT_TASK_TYPE || task?.status !== "completed") {
    return { ok: false, reason: "source_not_completed_fixed_unit_incident" };
  }
  if (observation?.registry !== FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY
    || observation?.health?.healthy !== false) {
    return { ok: false, reason: "source_incident_observation_invalid" };
  }
  const target = FIXED_TARGETS.find((candidate) => candidate.unit === observation.target?.unit);
  if (!target
    || target.healthServiceKey !== observation.target?.healthServiceKey
    || observation.health?.unit?.unit !== target.unit
    || observation.health?.service?.key !== target.healthServiceKey) {
    return { ok: false, reason: "source_incident_target_not_fixed" };
  }
  const expectedFingerprint = hashFixedUnitIncidentObservation({
    target: observation.target,
    health: observation.health,
  });
  if (observation.fingerprint !== expectedFingerprint) {
    return { ok: false, reason: "source_incident_fingerprint_mismatch" };
  }
  if (observation.governance?.callsProvider !== false
    || observation.governance?.authorizesRepair !== false
    || observation.governance?.invokesHostd !== false) {
    return { ok: false, reason: "source_incident_authority_invalid" };
  }
  return { ok: true, reason: null, observation, target };
}

export function createFixedUnitIncidentScheduler({
  enabled = false,
  intervalMs = DEFAULT_FIXED_UNIT_INCIDENT_INTERVAL_MS,
  fetchJson,
  systemSenseUrl,
  taskManager,
  createIncidentTriageTask = null,
  createIncidentRepairTask = null,
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
      const newIncident = createdTaskByUnit.has(observation.target.unit);
      state.units[observation.target.unit] = {
        status: unhealthy ? "unhealthy" : "healthy",
        fingerprint: unhealthy ? observation.fingerprint : null,
        lastObservedAt: at,
        latestTaskId: createdTaskByUnit.get(observation.target.unit)?.id ?? prior.latestTaskId ?? null,
        latestTriageTaskId: unhealthy && !newIncident ? prior.latestTriageTaskId ?? null : null,
        triageStatus: unhealthy && !newIncident ? prior.triageStatus ?? null : null,
        triageFailure: unhealthy && !newIncident ? prior.triageFailure ?? null : null,
        latestRepairTaskId: unhealthy && !newIncident ? prior.latestRepairTaskId ?? null : null,
        latestRepairApprovalId: unhealthy && !newIncident ? prior.latestRepairApprovalId ?? null : null,
        repairApprovalStatus: unhealthy && !newIncident ? prior.repairApprovalStatus ?? null : null,
        repairPromotionStatus: unhealthy && !newIncident ? prior.repairPromotionStatus ?? null : null,
        repairPromotionFailure: unhealthy && !newIncident ? prior.repairPromotionFailure ?? null : null,
        repairDispatchTaskId: unhealthy && !newIncident ? prior.repairDispatchTaskId ?? null : null,
        repairDispatchStatus: unhealthy && !newIncident ? prior.repairDispatchStatus ?? null : null,
        repairDispatchAt: unhealthy && !newIncident ? prior.repairDispatchAt ?? null : null,
        repairDispatchCompletedAt: unhealthy && !newIncident ? prior.repairDispatchCompletedAt ?? null : null,
        repairDispatchOutcomeStatus: unhealthy && !newIncident ? prior.repairDispatchOutcomeStatus ?? null : null,
        repairDispatchFailure: unhealthy && !newIncident ? prior.repairDispatchFailure ?? null : null,
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

  async function triageCurrentIncidents(observations, observedAt) {
    if (typeof createIncidentTriageTask !== "function") {
      return { records: [], failures: [] };
    }
    const records = [];
    const failures = [];
    for (const observation of observations) {
      if (observation.health.healthy) continue;
      const unitState = state.units[observation.target.unit];
      if (!unitState?.latestTaskId) continue;
      try {
        const result = await createIncidentTriageTask({ sourceTaskId: unitState.latestTaskId });
        if (result?.task?.status !== "completed"
          || result?.triage?.source?.taskId !== unitState.latestTaskId
          || result?.triage?.source?.fingerprint !== observation.fingerprint
          || result?.governance?.createsApproval !== false
          || result?.governance?.executesRepair !== false
          || result?.governance?.invokesHostd !== false
          || result?.governance?.callsProvider !== false) {
          throw new Error("automatic_triage_contract_invalid");
        }
        unitState.latestTriageTaskId = result.task.id;
        unitState.triageStatus = "completed";
        unitState.triageFailure = null;
        records.push({
          unit: observation.target.unit,
          sourceTaskId: unitState.latestTaskId,
          sourceFingerprint: observation.fingerprint,
          triageTaskId: result.task.id,
        });
      } catch {
        unitState.triageStatus = "failed";
        unitState.triageFailure = {
          code: "automatic_triage_failed",
          at: observedAt,
        };
        failures.push({
          unit: observation.target.unit,
          sourceTaskId: unitState.latestTaskId,
          ...unitState.triageFailure,
        });
      }
    }
    persistState();
    return { records, failures };
  }

  async function promoteCurrentTriages(triageRecords, observedAt) {
    if (typeof createIncidentRepairTask !== "function") {
      return { taskIds: [], approvalIds: [], failures: [] };
    }
    const taskIds = [];
    const approvalIds = [];
    const failures = [];
    for (const record of triageRecords) {
      const unitState = state.units[record.unit];
      if (!unitState || unitState.latestTaskId !== record.sourceTaskId) continue;
      try {
        const result = await createIncidentRepairTask({ triageTaskId: record.triageTaskId });
        if (typeof result?.task?.id !== "string"
          || result?.task?.type !== "systemd_next_repair_task"
          || result?.task?.systemdNextRepair?.target?.unit !== record.unit
          || result?.task?.approval?.requestId !== result?.approval?.id
          || result?.approval?.taskId !== result.task.id
          || result?.promotion?.triageTaskId !== record.triageTaskId
          || result?.promotion?.sourceTaskId !== record.sourceTaskId
          || result?.promotion?.sourceFingerprint !== record.sourceFingerprint
          || result?.promotion?.targetUnit !== record.unit
          || result?.task?.systemdIncidentRepairPromotion?.bindingHash !== result?.promotion?.bindingHash
          || !["pending", "approved", "denied", "expired"].includes(result?.approval?.status)
          || result?.governance?.createsApproval !== true
          || result?.governance?.executesRepair !== false
          || result?.governance?.invokesHostd !== false
          || result?.governance?.callsProvider !== false) {
          throw new Error("automatic_repair_promotion_contract_invalid");
        }
        unitState.latestRepairTaskId = result.task.id;
        unitState.latestRepairApprovalId = result.approval.id;
        unitState.repairApprovalStatus = result.approval.status;
        unitState.repairPromotionStatus = "completed";
        unitState.repairPromotionFailure = null;
        taskIds.push(result.task.id);
        approvalIds.push(result.approval.id);
      } catch {
        unitState.repairPromotionStatus = "failed";
        unitState.repairPromotionFailure = {
          code: "automatic_repair_promotion_failed",
          at: observedAt,
        };
        failures.push({
          unit: record.unit,
          triageTaskId: record.triageTaskId,
          ...unitState.repairPromotionFailure,
        });
      }
    }
    persistState();
    return { taskIds, approvalIds, failures };
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
    const triage = await triageCurrentIncidents(observations, observedAt);
    const repairPromotion = await promoteCurrentTriages(triage.records, observedAt);
    return {
      ok: true,
      skipped: false,
      observedUnits: observations.length,
      createdTaskIds: [...createdTaskByUnit.values()].map((task) => task.id),
      triageTaskIds: triage.records.map((record) => record.triageTaskId),
      triageFailureCount: triage.failures.length,
      automaticTriageEnabled: typeof createIncidentTriageTask === "function",
      repairTaskIds: repairPromotion.taskIds,
      repairApprovalIds: repairPromotion.approvalIds,
      repairPromotionFailureCount: repairPromotion.failures.length,
      automaticRepairPromotionEnabled: typeof createIncidentRepairTask === "function",
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
