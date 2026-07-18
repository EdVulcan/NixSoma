import { createHash } from "node:crypto";

import { validateSystemdIncidentReceiptTask } from "./systemd-incident-receipt.mjs";

export const SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID =
  "act.openclaw.systemd_incident.observation_receipt";
export const SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_REGISTRY =
  "openclaw-systemd-incident-observation-receipt-v0";

const RECOMMENDATION_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0";
const RECOMMENDATION_CONTRACT = "engineering_recommendation_v0";
const RECOMMENDATION_ACTION_ID = "refresh_systemd_incident_observation";
const RECOMMENDATION_CONTROL_ID = "refresh-systemd-journal-evidence-button";
const INCIDENT_CONTEXT_REGISTRY = "openclaw-systemd-incident-provider-context-v0";
const JOURNAL_REGISTRY = "openclaw-systemd-journal-evidence-v0";
const JOURNAL_LINES = 25;
const MAX_TASK_ID_CHARS = 200;

function hashReceipt(receipt) {
  return `sha256:${createHash("sha256").update(JSON.stringify(receipt)).digest("hex")}`;
}

function normaliseTaskId(value) {
  if (typeof value !== "string") {
    throw new Error("Systemd incident observation providerTaskId must be a string.");
  }
  const taskId = value.trim();
  if (!taskId || taskId.length > MAX_TASK_ID_CHARS) {
    throw new Error("Systemd incident observation providerTaskId is invalid.");
  }
  return taskId;
}

function taskForId(tasks, taskId) {
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === taskId) ?? null;
  return null;
}

function boundedCount(value, maximum = JOURNAL_LINES) {
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : 0;
}

function validateProviderBinding({ providerTask, sourceTask }) {
  const execution = providerTask?.cloudConsciousnessLiveProviderEgressExecution ?? null;
  const recommendation = execution?.recommendation ?? null;
  const context = execution?.systemdIncidentContext ?? null;
  const sourceValidation = validateSystemdIncidentReceiptTask({ sourceTask });
  if (!providerTask
    || recommendation?.registry !== RECOMMENDATION_REGISTRY
    || recommendation.contract !== RECOMMENDATION_CONTRACT
    || recommendation.valid !== true
    || recommendation.actionId !== RECOMMENDATION_ACTION_ID
    || recommendation.existingObserverControlId !== RECOMMENDATION_CONTROL_ID
    || recommendation.existingCapabilityId !== SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID
    || recommendation.requiresOperatorReview !== true
    || recommendation.requiresApproval !== false
    || execution?.responseContract !== RECOMMENDATION_CONTRACT
    || context?.registry !== INCIDENT_CONTEXT_REGISTRY
    || !sourceValidation.ok
    || context.sourceTaskId !== sourceTask.id
    || context.sourceReceiptHash !== sourceValidation.receipt.receiptHash
    || context.target?.unit !== sourceValidation.targetUnit
    || context.target?.healthServiceKey !== sourceValidation.healthServiceKey
    || execution?.contextPacket?.sourceTaskId !== sourceTask.id
    || execution?.contextPacket?.systemdIncidentReceiptHash !== sourceValidation.receipt.receiptHash) {
    throw new Error("Systemd incident observation source binding is invalid.");
  }
  return { execution, context, sourceValidation };
}

function buildObservationReceipt({
  providerTask,
  sourceTask,
  sourceValidation,
  health,
  inventory,
  journal,
  observedAt,
}) {
  const targetUnit = sourceValidation.targetUnit;
  const healthServiceKey = sourceValidation.healthServiceKey;
  const service = health?.system?.services?.[healthServiceKey] ?? null;
  const unit = Array.isArray(inventory?.units)
    ? inventory.units.find((item) => item?.unit === targetUnit) ?? null
    : null;
  if (journal?.registry !== JOURNAL_REGISTRY
    || journal.unit !== targetUnit
    || journal.requestedLines !== JOURNAL_LINES) {
    throw new Error("Systemd incident observation journal binding is invalid.");
  }

  const receipt = {
    registry: SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_REGISTRY,
    observedAt,
    providerTaskId: providerTask.id,
    sourceTaskId: sourceTask.id,
    sourceReceiptHash: sourceValidation.receipt.receiptHash,
    target: { unit: targetUnit, healthServiceKey },
    health: {
      systemAvailable: Boolean(health?.system),
      serviceObserved: Boolean(service),
      serviceHealthy: service?.ok === true,
      unitObserved: unit?.systemdObserved === true,
      unitLoaded: unit?.loadState === "loaded",
      unitActive: unit?.activeState === "active",
      unitRunning: unit?.subState === "running",
    },
    journal: {
      available: journal.available === true,
      requestedLines: JOURNAL_LINES,
      returned: boundedCount(journal.summary?.returned),
      parseErrors: boundedCount(journal.summary?.parseErrors),
      messagesIncluded: false,
    },
    governance: {
      operatorReviewed: true,
      readOnlyObservation: true,
      createsTask: false,
      createsApproval: false,
      callsProvider: false,
      networkEgress: false,
      executesCommand: false,
      invokesHostd: false,
      authorizesRepair: false,
      journalMessagesIncluded: false,
      providerOutputIncluded: false,
    },
  };
  return { ...receipt, receiptHash: hashReceipt(receipt) };
}

export function createSystemdIncidentObservationCapabilityHandlers({
  tasks = new Map(),
  fetchJson,
  systemSenseUrl,
  persistState = () => {},
  publishEvent = async () => {},
  now = () => new Date().toISOString(),
} = {}) {
  async function callObservationReceipt(request) {
    const params = request.params ?? {};
    const providerTaskId = normaliseTaskId(params.providerTaskId);
    const providerTask = taskForId(tasks, providerTaskId);
    if (!providerTask) {
      throw new Error("Systemd incident observation provider task was not found.");
    }
    if (params.confirm !== true) {
      throw new Error("Systemd incident observation requires confirm=true.");
    }
    const context = providerTask.cloudConsciousnessLiveProviderEgressExecution
      ?.systemdIncidentContext;
    const sourceTask = taskForId(tasks, context?.sourceTaskId);
    const { sourceValidation } = validateProviderBinding({ providerTask, sourceTask });
    const journalUrl = new URL("/system/systemd/journal-evidence", `${systemSenseUrl}/`);
    journalUrl.searchParams.set("unit", sourceValidation.targetUnit);
    journalUrl.searchParams.set("lines", String(JOURNAL_LINES));
    const [health, inventory, journal] = await Promise.all([
      fetchJson(`${systemSenseUrl}/system/health`),
      fetchJson(`${systemSenseUrl}/system/systemd/units`),
      fetchJson(journalUrl.toString()),
    ]);
    const receipt = buildObservationReceipt({
      providerTask,
      sourceTask,
      sourceValidation,
      health,
      inventory,
      journal,
      observedAt: now(),
    });
    await publishEvent("systemd_incident.observation_receipt_recorded", {
      providerTaskId,
      sourceTaskId: sourceTask.id,
      targetUnit: receipt.target.unit,
      receiptHash: receipt.receiptHash,
      serviceHealthy: receipt.health.serviceHealthy,
      unitRunning: receipt.health.unitRunning,
      journalAvailable: receipt.journal.available,
      journalEntries: receipt.journal.returned,
      journalMessagesIncluded: false,
      providerOutputIncluded: false,
    });
    providerTask.cloudConsciousnessLiveProviderEgressExecution = {
      ...providerTask.cloudConsciousnessLiveProviderEgressExecution,
      systemdIncidentObservationReceipt: receipt,
    };
    persistState();
    return {
      ok: true,
      registry: SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_REGISTRY,
      receipt,
      governance: receipt.governance,
    };
  }

  async function callBackend(capability, request) {
    if (capability.id !== SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    return { handled: true, result: await callObservationReceipt(request) };
  }

  function summariseResult(capability, result) {
    if (capability.id !== SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID) return null;
    return {
      kind: "systemd_incident.observation_receipt",
      ok: result?.ok === true,
      providerTaskId: result?.receipt?.providerTaskId ?? null,
      sourceTaskId: result?.receipt?.sourceTaskId ?? null,
      targetUnit: result?.receipt?.target?.unit ?? null,
      receiptHash: result?.receipt?.receiptHash ?? null,
      serviceHealthy: result?.receipt?.health?.serviceHealthy === true,
      unitRunning: result?.receipt?.health?.unitRunning === true,
      journalAvailable: result?.receipt?.journal?.available === true,
      journalEntries: result?.receipt?.journal?.returned ?? 0,
      journalMessagesIncluded: false,
      providerOutputIncluded: false,
      noProviderEgress: result?.governance?.callsProvider === false,
      noRepairAuthority: result?.governance?.authorizesRepair === false,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== SYSTEMD_INCIDENT_OBSERVATION_CAPABILITY_ID) return null;
    try {
      const params = request.params ?? {};
      const unknown = Object.keys(params).filter((key) => !["providerTaskId", "confirm"].includes(key));
      if (unknown.length > 0) {
        throw new Error("Systemd incident observation parameters are not allowed.");
      }
      normaliseTaskId(params.providerTaskId);
      if (params.confirm !== true) {
        throw new Error("Systemd incident observation requires confirm=true.");
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid systemd incident observation request.";
    }
  }

  return { callBackend, summariseResult, validateRequest };
}
