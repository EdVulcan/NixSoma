import { createHash } from "node:crypto";
import descriptor from "./openclaw-hostd-capabilities.json" with { type: "json" };
import {
  HOSTD_ACTIVATION_MAX_AGE_MS,
  HOSTD_ACTIVATION_TARGET_PATH,
  isNixStorePath,
  isSha256,
  parseActivationExpiry,
} from "./openclaw-hostd-activation.mjs";

const rollback = descriptor.rollback ?? {};

export const HOSTD_ROLLBACK_CAPABILITY_REGISTRY = rollback.registry;
export const HOSTD_ROLLBACK_OPERATION = rollback.operation;
export const HOSTD_ROLLBACK_TARGET_PATH = rollback.targetPath;
export const HOSTD_ROLLBACK_CAPABILITY_ID = rollback.capabilityId;
export const HOSTD_ROLLBACK_PROTOCOL_VERSION = 1;
export const HOSTD_ROLLBACK_RESPONSE_REGISTRY = "openclaw-hostd-managed-config-rollback-response-v0";
export const HOSTD_ROLLBACK_RECEIPT_REGISTRY = "openclaw-hostd-managed-config-rollback-receipt-v0";
export const HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY = "nixsoma-managed-config-rollback-helper-v0";
export const HOSTD_ROLLBACK_REQUEST_MAX_BYTES = 8192;
export const HOSTD_ROLLBACK_MAX_AGE_MS = HOSTD_ACTIVATION_MAX_AGE_MS;

export function isRollbackSnapshotId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/u.test(value);
}

export function isBoundedRollbackExpiry(value, nowMs = Date.now()) {
  const expiry = parseActivationExpiry(value);
  const current = Number(nowMs);
  return expiry !== null
    && Number.isFinite(current)
    && expiry > current
    && expiry - current <= HOSTD_ROLLBACK_MAX_AGE_MS;
}

export function hostdManagedConfigRollbackCapability() {
  return {
    registry: HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
    operation: HOSTD_ROLLBACK_OPERATION,
    targetPath: HOSTD_ROLLBACK_TARGET_PATH,
    capabilityId: HOSTD_ROLLBACK_CAPABILITY_ID,
  };
}

function canonicalReceiptValue(value) {
  if (Array.isArray(value)) return value.map(canonicalReceiptValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalReceiptValue(value[key])]),
  );
}

export function hashManagedConfigRollbackReceipt(receipt) {
  const { receiptHash: _ignored, ...unsignedReceipt } = receipt ?? {};
  return createHash("sha256").update(JSON.stringify(canonicalReceiptValue(unsignedReceipt)), "utf8").digest("hex");
}

export function validateManagedConfigRollbackReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || receipt.registry !== HOSTD_ROLLBACK_RECEIPT_REGISTRY) return false;
  const baseValid = receipt.receiptHash === hashManagedConfigRollbackReceipt(receipt)
    && receipt.operation === HOSTD_ROLLBACK_OPERATION
    && receipt.targetPath === HOSTD_ROLLBACK_TARGET_PATH
    && isSha256(receipt.activationReceiptHash)
    && isRollbackSnapshotId(receipt.rollbackSnapshotId)
    && isSha256(receipt.candidateHash)
    && isNixStorePath(receipt.previousGenerationPath)
    && isNixStorePath(receipt.activatedGenerationPath)
    && receipt.previousGenerationPath !== receipt.activatedGenerationPath
    && typeof receipt.previousTargetPresent === "boolean"
    && (receipt.previousTargetHash === null || isSha256(receipt.previousTargetHash))
    && receipt.previousTargetPresent === (receipt.previousTargetHash !== null);
  if (!baseValid) return false;
  if (receipt.status !== "passed") {
    return receipt.rollbackExecuted === false
      && receipt.generationRestored === false
      && receipt.snapshotConsumed === false;
  }
  const helper = receipt.helperEvidence;
  return receipt.rollbackExecuted === true
    && receipt.generationRestored === true
    && receipt.snapshotConsumed === true
    && helper?.registry === HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY
    && helper.rollbackSnapshotId === receipt.rollbackSnapshotId
    && helper.candidateHash === receipt.candidateHash
    && helper.generationBefore === receipt.activatedGenerationPath
    && helper.profileBefore === receipt.activatedGenerationPath
    && helper.generationAfter === receipt.previousGenerationPath
    && helper.profileAfter === receipt.previousGenerationPath
    && helper.targetHashBefore === receipt.candidateHash
    && helper.previousTargetPresent === receipt.previousTargetPresent
    && helper.previousTargetHash === receipt.previousTargetHash
    && helper.targetPresentAfter === receipt.previousTargetPresent
    && helper.targetHashAfter === receipt.previousTargetHash
    && helper.rollbackExecuted === true
    && helper.snapshotConsumed === true;
}

if (HOSTD_ROLLBACK_TARGET_PATH !== HOSTD_ACTIVATION_TARGET_PATH) {
  throw new Error("Managed-config activation and rollback descriptors must share one fixed target.");
}
