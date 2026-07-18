import { createHash } from "node:crypto";

import { hostdRestartCapabilityForTarget } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import { systemdHealthServiceKeyForUnit } from "./systemd-repair-verification.mjs";

export const SYSTEMD_INCIDENT_RECEIPT_REGISTRY =
  "openclaw-systemd-repair-incident-receipt-v0";
export const SYSTEMD_INCIDENT_STEP_ID = "execute-next-systemd-restart";

const JOURNAL_EVIDENCE_REGISTRY = "openclaw-systemd-journal-evidence-v0";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function receiptContentHash(receipt) {
  const { receiptHash: _receiptHash, ...content } = receipt;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function invalid(reason) {
  return {
    ok: false,
    reason,
    receipt: null,
    targetUnit: null,
    healthServiceKey: null,
  };
}

export function validateSystemdIncidentReceiptTask({ sourceTask } = {}) {
  if (!sourceTask?.id
    || sourceTask.type !== "systemd_next_repair_task"
    || !["completed", "failed"].includes(sourceTask.status)) {
    return invalid("systemd_incident_source_task_not_terminal_repair");
  }
  const latestPhase = Array.isArray(sourceTask.phaseHistory) ? sourceTask.phaseHistory.at(-1) : null;
  const receipt = sourceTask.outcome?.details?.incidentReceipt
    ?? latestPhase?.details?.incidentReceipt;
  if (!receipt || receipt.registry !== SYSTEMD_INCIDENT_RECEIPT_REGISTRY) {
    return invalid("systemd_incident_receipt_missing");
  }
  if (receipt.task?.id !== sourceTask.id || receipt.task?.stepId !== SYSTEMD_INCIDENT_STEP_ID) {
    return invalid("systemd_incident_receipt_task_binding_mismatch");
  }
  const receiptHash = typeof receipt.receiptHash === "string"
    ? receipt.receiptHash.replace(/^sha256:/u, "")
    : "";
  if (!SHA256_PATTERN.test(receiptHash) || receiptHash !== receiptContentHash(receipt)) {
    return invalid("systemd_incident_receipt_hash_mismatch");
  }

  const targetUnit = receipt.target?.unit;
  const healthServiceKey = systemdHealthServiceKeyForUnit(targetUnit);
  if (!healthServiceKey
    || receipt.target?.healthServiceKey !== healthServiceKey
    || receipt.preHealth?.healthServiceKey !== healthServiceKey
    || receipt.preHealth?.service?.key !== healthServiceKey
    || receipt.postHealth?.healthServiceKey !== healthServiceKey
    || receipt.postHealth?.service?.key !== healthServiceKey) {
    return invalid("systemd_incident_target_health_binding_mismatch");
  }
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

  return {
    ok: true,
    reason: null,
    receipt,
    targetUnit,
    healthServiceKey,
  };
}
