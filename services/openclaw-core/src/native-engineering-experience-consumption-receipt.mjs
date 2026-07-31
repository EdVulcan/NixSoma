import { createHash } from "node:crypto";

export const NATIVE_ENGINEERING_EXPERIENCE_CONSUMPTION_RECEIPT_REGISTRY =
  "openclaw-native-engineering-experience-consumption-receipt-v0";
export const NATIVE_ENGINEERING_EXPERIENCE_CONSUMPTION_CANDIDATE =
  Symbol("openclaw-native-engineering-experience-consumption-candidate");

const MAX_RECORD_IDS = 4;
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function recordIdsFromMemory(experienceMemory) {
  return [...new Set((Array.isArray(experienceMemory?.records) ? experienceMemory.records : [])
    .map((record) => safeId(record?.id))
    .filter(Boolean))]
    .slice(0, MAX_RECORD_IDS);
}

export function buildExperienceConsumptionCandidate({
  experienceMemory,
  executionTaskId,
  sourceTaskId,
  contextContentHash,
  responseContract,
} = {}) {
  const recordIds = recordIdsFromMemory(experienceMemory);
  const execution = safeId(executionTaskId);
  const source = safeId(sourceTaskId);
  if (recordIds.length === 0 || !execution || !source || !SHA256.test(contextContentHash ?? "")) {
    return null;
  }
  return {
    executionTaskId: execution,
    sourceTaskId: source,
    recordIds,
    recordSetHash: sha256(JSON.stringify(recordIds)),
    contextContentHash,
    responseContract: typeof responseContract === "string" ? responseContract : null,
  };
}

export function finaliseExperienceConsumptionReceipt({
  candidate,
  providerResult,
  consumedAt = new Date().toISOString(),
} = {}) {
  const audit = providerResult?.audit ?? {};
  if (!candidate
    || providerResult?.ok !== true
    || audit.providerResponseCreated !== true
    || audit.endpointContacted !== true
    || audit.networkEgress !== true
    || audit.transmitsExternally !== true
    || !SHA256.test(audit.requestContentHash ?? "")) {
    return null;
  }
  const receipt = {
    registry: NATIVE_ENGINEERING_EXPERIENCE_CONSUMPTION_RECEIPT_REGISTRY,
    status: "consumed_by_governed_provider",
    consumedAt,
    executionTaskId: candidate.executionTaskId,
    sourceTaskId: candidate.sourceTaskId,
    recordIds: [...candidate.recordIds],
    recordCount: candidate.recordIds.length,
    recordSetHash: candidate.recordSetHash,
    contextContentHash: candidate.contextContentHash,
    requestContentHash: audit.requestContentHash,
    responseContract: candidate.responseContract,
    providerResponseCreated: true,
    governance: {
      taskBound: true,
      contextBound: true,
      requestBound: true,
      providerConsumptionProven: true,
      downstreamAdvisoryApplicationProven: false,
      causalAttribution: false,
      providerContentPersisted: false,
      createsTask: false,
      createsApproval: false,
      executesAction: false,
    },
  };
  return {
    ...receipt,
    receiptHash: sha256(JSON.stringify(receipt)),
  };
}

export function validateExperienceConsumptionReceipt(value) {
  if (!value
    || value.registry !== NATIVE_ENGINEERING_EXPERIENCE_CONSUMPTION_RECEIPT_REGISTRY
    || value.status !== "consumed_by_governed_provider"
    || !safeId(value.executionTaskId)
    || !safeId(value.sourceTaskId)
    || !Array.isArray(value.recordIds)
    || value.recordIds.length === 0
    || value.recordIds.length > MAX_RECORD_IDS
    || value.recordIds.some((id) => !safeId(id))
    || new Set(value.recordIds).size !== value.recordIds.length
    || value.recordCount !== value.recordIds.length
    || !SHA256.test(value.recordSetHash ?? "")
    || value.recordSetHash !== sha256(JSON.stringify(value.recordIds))
    || !SHA256.test(value.contextContentHash ?? "")
    || !SHA256.test(value.requestContentHash ?? "")
    || !SHA256.test(value.receiptHash ?? "")
    || value.governance?.taskBound !== true
    || value.governance?.contextBound !== true
    || value.governance?.requestBound !== true
    || value.governance?.providerConsumptionProven !== true
    || value.governance?.downstreamAdvisoryApplicationProven !== false
    || value.governance?.causalAttribution !== false
    || value.governance?.providerContentPersisted !== false
    || value.governance?.createsTask !== false
    || value.governance?.createsApproval !== false
    || value.governance?.executesAction !== false) {
    return null;
  }
  const { receiptHash, ...receipt } = value;
  return sha256(JSON.stringify(receipt)) === receiptHash ? value : null;
}
