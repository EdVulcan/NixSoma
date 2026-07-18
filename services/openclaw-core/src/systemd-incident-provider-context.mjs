import { createHash } from "node:crypto";

import { DEEPSEEK_CREDENTIAL_REFERENCE } from "./cloud-live-provider-network-sender.mjs";
import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  buildCloudLiveProviderEngineeringRecommendationInstruction,
} from "./cloud-live-provider-runtime-response-contract.mjs";
import { systemdHealthServiceKeyForUnit } from "./systemd-repair-verification.mjs";
import { hostdRestartCapabilityForTarget } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";

export const SYSTEMD_INCIDENT_PROVIDER_CONTEXT_REGISTRY =
  "openclaw-systemd-incident-provider-context-v0";

const INCIDENT_RECEIPT_REGISTRY = "openclaw-systemd-repair-incident-receipt-v0";
const JOURNAL_EVIDENCE_REGISTRY = "openclaw-systemd-journal-evidence-v0";
const INCIDENT_STEP_ID = "execute-next-systemd-restart";
const DEEPSEEK_MODEL = "deepseek-chat";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function taskList(tasks) {
  if (tasks instanceof Map) return [...tasks.values()];
  return Array.isArray(tasks) ? tasks : [];
}

function taskForId(tasks, taskId) {
  return taskList(tasks).find((task) => task?.id === taskId) ?? null;
}

function receiptContentHash(receipt) {
  const { receiptHash: _receiptHash, ...content } = receipt;
  return hashText(JSON.stringify(content));
}

function compactUnitState(state) {
  return state
    ? {
        unit: state.unit ?? null,
        loadState: state.loadState ?? null,
        activeState: state.activeState ?? null,
        subState: state.subState ?? null,
        mainPid: Number.isInteger(state.mainPid) ? state.mainPid : null,
        systemdObserved: state.systemdObserved === true,
      }
    : null;
}

function compactServiceHealth(service) {
  return service
    ? {
        key: service.key ?? null,
        name: service.name ?? null,
        ok: service.ok === true,
        status: service.status ?? null,
        checkedAt: service.checkedAt ?? null,
      }
    : null;
}

function compactHealth(health) {
  return {
    checkedAt: health?.checkedAt ?? null,
    healthServiceKey: health?.healthServiceKey ?? null,
    unit: compactUnitState(health?.unit),
    service: compactServiceHealth(health?.service),
    healthy: health?.healthy === true,
  };
}

function compactJournalEvidence(journal) {
  return {
    registry: journal.registry,
    available: journal.available === true,
    unit: journal.unit ?? null,
    requestedLines: Number.isInteger(journal.requestedLines) ? journal.requestedLines : null,
    returned: Number.isInteger(journal.returned) ? journal.returned : 0,
    parseErrors: Number.isInteger(journal.parseErrors) ? journal.parseErrors : 0,
    filteredEntries: Number.isInteger(journal.filteredEntries) ? journal.filteredEntries : 0,
    latestEntryAt: journal.latestEntryAt ?? null,
    errorCode: journal.errorCode ?? null,
    messagesIncluded: false,
  };
}

function compactHostdReceipt(hostd) {
  return {
    owner: hostd?.owner ?? null,
    transport: hostd?.transport ?? null,
    method: hostd?.method ?? null,
    unit: hostd?.unit ?? null,
    capability: hostd?.capability
      ? {
          operation: hostd.capability.operation ?? null,
          capabilityId: hostd.capability.capabilityId ?? null,
        }
      : null,
    jobPathPresent: typeof hostd?.jobPath === "string" && hostd.jobPath.length > 0,
    beforeMainPid: Number.isInteger(hostd?.beforeMainPid) ? hostd.beforeMainPid : null,
    afterMainPid: Number.isInteger(hostd?.afterMainPid) ? hostd.afterMainPid : null,
    commandSucceeded: hostd?.commandSucceeded === true,
  };
}

function projectionText(projection) {
  return JSON.stringify(projection);
}

function buildRequestContent(projection) {
  return [
    "NixSoma bounded systemd incident context, explicitly included for this one approved provider call:",
    projectionText(projection),
    "Operator request: Diagnose the bounded incident evidence. State whether service health was restored and recommend only an existing governed operator action. Do not infer missing journal content or request another restart.",
    buildCloudLiveProviderEngineeringRecommendationInstruction(),
  ].join("\n\n");
}

function invalid(reason) {
  return { ok: false, reason, projection: null, requestEnvelope: null, evidence: null };
}

export function buildSystemdIncidentProviderContext({ sourceTask } = {}) {
  if (!sourceTask?.id
    || sourceTask.type !== "systemd_next_repair_task"
    || !["completed", "failed"].includes(sourceTask.status)) {
    return invalid("systemd_incident_source_task_not_terminal_repair");
  }
  const receipt = sourceTask.outcome?.details?.incidentReceipt;
  if (!receipt || receipt.registry !== INCIDENT_RECEIPT_REGISTRY) {
    return invalid("systemd_incident_receipt_missing");
  }
  if (receipt.task?.id !== sourceTask.id || receipt.task?.stepId !== INCIDENT_STEP_ID) {
    return invalid("systemd_incident_receipt_task_binding_mismatch");
  }
  const receiptHash = typeof receipt.receiptHash === "string"
    ? receipt.receiptHash.replace(/^sha256:/u, "")
    : "";
  if (!SHA256_PATTERN.test(receiptHash) || receiptHash !== receiptContentHash(receipt)) {
    return invalid("systemd_incident_receipt_hash_mismatch");
  }
  const expectedHealthServiceKey = systemdHealthServiceKeyForUnit(receipt.target?.unit);
  if (!expectedHealthServiceKey
    || receipt.target?.healthServiceKey !== expectedHealthServiceKey
    || receipt.preHealth?.healthServiceKey !== expectedHealthServiceKey
    || receipt.preHealth?.service?.key !== expectedHealthServiceKey
    || receipt.postHealth?.healthServiceKey !== expectedHealthServiceKey
    || receipt.postHealth?.service?.key !== expectedHealthServiceKey) {
    return invalid("systemd_incident_target_health_binding_mismatch");
  }
  const targetUnit = receipt.target.unit;
  if (receipt.preHealth?.unit?.unit !== targetUnit
    || receipt.postHealth?.unit?.unit !== targetUnit
    || receipt.journalEvidence?.unit !== targetUnit
    || receipt.hostdReceipt?.unit !== targetUnit) {
    return invalid("systemd_incident_unit_binding_mismatch");
  }
  const expectedHostdCapability = hostdRestartCapabilityForTarget(targetUnit);
  const hostd = receipt.hostdReceipt;
  if (!expectedHostdCapability
    || (hostd.owner !== null && hostd.owner !== "openclaw-hostd")
    || (hostd.transport !== null && hostd.transport !== "dbus_native")
    || (hostd.method !== null && hostd.method !== "org.freedesktop.systemd1.Manager.RestartUnit")
    || (hostd.capability !== null
      && (hostd.capability?.operation !== expectedHostdCapability.operation
        || hostd.capability?.capabilityId !== expectedHostdCapability.capabilityId))) {
    return invalid("systemd_incident_hostd_binding_mismatch");
  }
  const journal = receipt.journalEvidence;
  if (!journal
    || journal.registry !== JOURNAL_EVIDENCE_REGISTRY
    || journal.messagesPersisted !== false
    || Object.hasOwn(journal, "entries")
    || Object.hasOwn(journal, "message")
    || Object.hasOwn(journal, "messages")) {
    return invalid("systemd_incident_journal_projection_not_safe");
  }

  const projection = {
    registry: SYSTEMD_INCIDENT_PROVIDER_CONTEXT_REGISTRY,
    mode: "bounded_systemd_incident_diagnosis_context",
    sourceTaskId: sourceTask.id,
    sourceTaskStatus: sourceTask.status,
    sourceReceiptHash: receipt.receiptHash,
    target: {
      unit: receipt.target.unit,
      healthServiceKey: expectedHealthServiceKey,
    },
    preHealth: compactHealth(receipt.preHealth),
    journalEvidence: compactJournalEvidence(journal),
    hostdReceipt: compactHostdReceipt(receipt.hostdReceipt),
    postHealth: compactHealth(receipt.postHealth),
    restoredHealthy: receipt.restoredHealthy === true,
    operatorRecoveryRecommended: receipt.restoredHealthy !== true,
    governance: {
      guidanceOnly: true,
      journalMessagesIncluded: false,
      serviceUrlsIncluded: false,
      errorTextIncluded: false,
      credentialsIncluded: false,
      createsTaskAutomatically: false,
      createsApprovalAutomatically: false,
      executesAutomatically: false,
      authorizesRepair: false,
    },
  };
  const contextContentHash = hashText(projectionText(projection));
  const requestEnvelope = {
    model: DEEPSEEK_MODEL,
    messages: [{ role: "user", content: buildRequestContent(projection) }],
  };
  return {
    ok: true,
    projection,
    contextContentHash,
    requestEnvelope,
    evidence: {
      registry: SYSTEMD_INCIDENT_PROVIDER_CONTEXT_REGISTRY,
      sourceRegistry: INCIDENT_RECEIPT_REGISTRY,
      taskId: sourceTask.id,
      executionTaskId: null,
      sourceTaskId: sourceTask.id,
      responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
      contextContentHash,
      providerMessageChars: requestEnvelope.messages[0].content.length,
      requestEnvelopeMaterialized: true,
      systemdIncidentContextIncluded: true,
      systemdIncidentTargetUnit: projection.target.unit,
      systemdIncidentHealthServiceKey: projection.target.healthServiceKey,
      systemdIncidentRestoredHealthy: projection.restoredHealthy,
      systemdIncidentJournalAvailable: projection.journalEvidence.available,
      systemdIncidentJournalEntries: projection.journalEvidence.returned,
      systemdIncidentReceiptHash: projection.sourceReceiptHash,
      journalMessagesIncluded: false,
      contextContentIncluded: false,
    },
  };
}

export function materialiseSystemdIncidentProviderHandoff({
  liveProviderExecution,
  tasks,
} = {}) {
  if (liveProviderExecution?.contextPacket?.includeSystemdIncidentReceipt !== true) {
    return { ok: true, liveProviderExecution, incidentContext: null, evidence: null };
  }
  const sourceTaskId = liveProviderExecution.contextPacket.sourceTaskId;
  const sourceTask = taskForId(tasks, sourceTaskId);
  const context = buildSystemdIncidentProviderContext({ sourceTask });
  if (!context.ok) return context;
  return {
    ok: true,
    incidentContext: context.projection,
    evidence: context.evidence,
    liveProviderExecution: {
      requested: true,
      credentialReference: DEEPSEEK_CREDENTIAL_REFERENCE,
      requestEnvelope: context.requestEnvelope,
      responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
      contextContentHash: context.contextContentHash,
      contextPacket: {
        requested: true,
        sourceTaskId,
        responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
        includeSystemdIncidentReceipt: true,
      },
      systemdIncidentContext: context.projection,
    },
  };
}

export function materialiseStoredSystemdIncidentProviderExecution({
  handoffTask,
  tasks,
} = {}) {
  const stored = handoffTask?.cloudConsciousnessLiveProviderEgressExecution?.systemdIncidentContext;
  if (!stored) return { handled: false, ok: true, liveProviderExecution: null, evidence: null };
  const sourceTask = taskForId(tasks, stored.sourceTaskId);
  const context = buildSystemdIncidentProviderContext({ sourceTask });
  if (!context.ok) return { handled: true, ...context };
  if (context.contextContentHash
      !== handoffTask.cloudConsciousnessLiveProviderEgressExecution.incidentContextContentHash
    || projectionText(context.projection) !== projectionText(stored)) {
    return { handled: true, ...invalid("systemd_incident_stored_context_mismatch") };
  }
  return {
    handled: true,
    ok: true,
    evidence: {
      ...context.evidence,
      executionTaskId: handoffTask.id,
    },
    liveProviderExecution: {
      requested: true,
      taskId: handoffTask.id,
      credentialReference: DEEPSEEK_CREDENTIAL_REFERENCE,
      requestEnvelope: context.requestEnvelope,
      responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
      contextPacket: {
        requested: true,
        taskId: handoffTask.id,
        sourceTaskId: sourceTask.id,
        responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
        includeSystemdIncidentReceipt: true,
      },
      authorization: {
        confirmed: true,
        credentialValueAccessAuthorized: true,
        endpointNetworkEgressAuthorized: true,
        liveProviderCallEnabled: true,
      },
    },
  };
}
