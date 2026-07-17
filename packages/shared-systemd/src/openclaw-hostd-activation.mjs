import { createHash } from "node:crypto";
import descriptor from "./openclaw-hostd-capabilities.json" with { type: "json" };

const activation = descriptor.activation ?? {};

export const HOSTD_ACTIVATION_CAPABILITY_REGISTRY = activation.registry;
export const HOSTD_ACTIVATION_OPERATION = activation.operation;
export const HOSTD_ACTIVATION_TARGET_PATH = activation.targetPath;
export const HOSTD_ACTIVATION_CAPABILITY_ID = activation.capabilityId;
export const HOSTD_ACTIVATION_PROTOCOL_VERSION = 1;
export const HOSTD_ACTIVATION_RESPONSE_REGISTRY = "openclaw-hostd-managed-config-activation-response-v0";
export const HOSTD_ACTIVATION_RECEIPT_REGISTRY = "openclaw-hostd-managed-config-activation-receipt-v0";
export const HOSTD_ACTIVATION_REQUEST_MAX_BYTES = 8192;
export const HOSTD_ACTIVATION_MAX_AGE_MS = 5 * 60 * 1000;

const ACTIVATION_EXPIRY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export function isNixStorePath(value) {
  return typeof value === "string" && /^\/nix\/store\/[a-z0-9][a-z0-9+._?=-]*$/u.test(value);
}

export function parseActivationExpiry(value) {
  if (typeof value !== "string" || !ACTIVATION_EXPIRY_PATTERN.test(value)) return null;
  const expiry = Date.parse(value);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== value) return null;
  return expiry;
}

export function isBoundedActivationExpiry(value, nowMs = Date.now()) {
  const expiry = parseActivationExpiry(value);
  const current = Number(nowMs);
  return expiry !== null
    && Number.isFinite(current)
    && expiry > current
    && expiry - current <= HOSTD_ACTIVATION_MAX_AGE_MS;
}

export function isActivationCapability(capability = null) {
  return capability?.registry === HOSTD_ACTIVATION_CAPABILITY_REGISTRY
    && capability?.operation === HOSTD_ACTIVATION_OPERATION
    && capability?.targetPath === HOSTD_ACTIVATION_TARGET_PATH
    && capability?.capabilityId === HOSTD_ACTIVATION_CAPABILITY_ID;
}

export function hostdManagedConfigActivationCapability() {
  return {
    registry: HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
    operation: HOSTD_ACTIVATION_OPERATION,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    capabilityId: HOSTD_ACTIVATION_CAPABILITY_ID,
  };
}

export function hashManagedConfigActivationReceipt(receipt) {
  const { receiptHash: _ignored, ...unsignedReceipt } = receipt ?? {};
  return createHash("sha256").update(JSON.stringify(unsignedReceipt), "utf8").digest("hex");
}

export function validateManagedConfigActivationReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || receipt.registry !== HOSTD_ACTIVATION_RECEIPT_REGISTRY) return false;
  return typeof receipt.receiptHash === "string"
    && receipt.receiptHash === hashManagedConfigActivationReceipt(receipt)
    && receipt.operation === HOSTD_ACTIVATION_OPERATION
    && receipt.targetPath === HOSTD_ACTIVATION_TARGET_PATH
    && isSha256(receipt.candidateHash)
    && isNixStorePath(receipt.evaluatedClosurePath)
    && receipt.rollbackExecuted === false;
}
