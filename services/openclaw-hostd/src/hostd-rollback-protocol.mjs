import {
  HOSTD_ROLLBACK_CAPABILITY_ID,
  HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
  HOSTD_ROLLBACK_OPERATION,
  HOSTD_ROLLBACK_PROTOCOL_VERSION,
  HOSTD_ROLLBACK_REQUEST_MAX_BYTES,
  HOSTD_ROLLBACK_RESPONSE_REGISTRY,
  HOSTD_ROLLBACK_TARGET_PATH,
  isBoundedRollbackExpiry,
  isRollbackSnapshotId,
  validateManagedConfigRollbackReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import { isNixStorePath, isSha256 } from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { runFixedManagedConfigRollback } from "./managed-config-rollback.mjs";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;
const ALLOWED_REQUEST_KEYS = new Set([
  "version",
  "operation",
  "target",
  "requestId",
  "expiresAt",
  "activationTaskId",
  "rollbackTaskId",
  "activationReceiptHash",
  "rollbackSnapshotId",
  "candidateHash",
  "previousGenerationPath",
  "activatedGenerationPath",
  "previousTargetPresent",
  "previousTargetHash",
]);

function buildRollbackGovernance(peerIdentity = null) {
  const verified = peerIdentity?.verified === true;
  return {
    callerBoundary: verified ? "kernel_so_peercred" : "openclaw-service-group-socket",
    socketPeerIdentityVerified: verified,
    socketPeerIdentityMatched: verified && peerIdentity?.matched === true,
    arbitraryTarget: false,
    arbitraryGeneration: false,
    arbitraryCommand: false,
    automaticRollback: false,
  };
}

function errorResponse({ requestId = null, code, error, peerIdentity = null }) {
  return {
    ok: false,
    registry: HOSTD_ROLLBACK_RESPONSE_REGISTRY,
    protocolVersion: HOSTD_ROLLBACK_PROTOCOL_VERSION,
    requestId,
    owner: "openclaw-hostd",
    error: { code, message: error },
    governance: buildRollbackGovernance(peerIdentity),
  };
}

export function parseHostdRollbackRequest(line) {
  if (typeof line !== "string" || Buffer.byteLength(line, "utf8") > HOSTD_ROLLBACK_REQUEST_MAX_BYTES) return { recognised: false };
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return { recognised: false };
  }
  if (!request || typeof request !== "object" || Array.isArray(request)
    || request.operation !== HOSTD_ROLLBACK_OPERATION) return { recognised: false };
  if (Object.keys(request).some((key) => !ALLOWED_REQUEST_KEYS.has(key))) {
    return { recognised: true, ok: false, response: errorResponse({ code: "unknown_field", error: "Hostd rollback request contains an unsupported field." }) };
  }
  const requestIdOk = typeof request.requestId === "string" && REQUEST_ID_PATTERN.test(request.requestId);
  const taskIdsOk = [request.activationTaskId, request.rollbackTaskId]
    .every((value) => typeof value === "string" && ID_PATTERN.test(value));
  const bindingOk = isSha256(request.activationReceiptHash)
    && isRollbackSnapshotId(request.rollbackSnapshotId)
    && isSha256(request.candidateHash)
    && isNixStorePath(request.previousGenerationPath)
    && isNixStorePath(request.activatedGenerationPath)
    && request.previousGenerationPath !== request.activatedGenerationPath
    && typeof request.previousTargetPresent === "boolean"
    && (request.previousTargetHash === null || isSha256(request.previousTargetHash))
    && request.previousTargetPresent === (request.previousTargetHash !== null);
  if (request.version !== HOSTD_ROLLBACK_PROTOCOL_VERSION
    || request.target !== HOSTD_ROLLBACK_TARGET_PATH
    || !requestIdOk
    || !taskIdsOk
    || !bindingOk
    || !isBoundedRollbackExpiry(request.expiresAt)) {
    return {
      recognised: true,
      ok: false,
      response: errorResponse({
        requestId: requestIdOk ? request.requestId : null,
        code: "unsupported_capability",
        error: "Hostd accepts only an exact activation-receipt-bound managed-config rollback request.",
      }),
    };
  }
  return { recognised: true, ok: true, request };
}

export function createHostdRollbackRequestHandler({
  runRollback = runFixedManagedConfigRollback,
  requirePeerIdentity = true,
  now = () => Date.now(),
} = {}) {
  const consumedRequestIds = new Set();
  return async function handleHostdRollbackRequest(line, { peerIdentity = null } = {}) {
    const parsed = parseHostdRollbackRequest(line);
    if (!parsed.recognised) return null;
    if (!parsed.ok) return parsed.response;
    const { request } = parsed;
    if (requirePeerIdentity && (peerIdentity?.verified !== true || peerIdentity?.matched !== true)) {
      return errorResponse({ requestId: request.requestId, code: "peer_identity_denied", error: "Hostd requires a matching kernel peer identity before managed-config rollback.", peerIdentity });
    }
    if (consumedRequestIds.has(request.requestId)) {
      return errorResponse({ requestId: request.requestId, code: "request_replayed", error: "Hostd rollback request ids are single-use.", peerIdentity });
    }
    if (Date.parse(request.expiresAt) <= now()) {
      return errorResponse({ requestId: request.requestId, code: "request_expired", error: "Hostd rollback request has expired.", peerIdentity });
    }
    consumedRequestIds.add(request.requestId);
    try {
      const receipt = await runRollback(request);
      if (!validateManagedConfigRollbackReceipt(receipt)
        || receipt.requestId !== request.requestId
        || receipt.activationReceiptHash !== request.activationReceiptHash
        || receipt.rollbackSnapshotId !== request.rollbackSnapshotId
        || receipt.rollbackTaskId !== request.rollbackTaskId) {
        return errorResponse({ requestId: request.requestId, code: "invalid_rollback_receipt", error: "Hostd rollback owner returned invalid receipt evidence.", peerIdentity });
      }
      return {
        ok: receipt.status === "passed",
        registry: HOSTD_ROLLBACK_RESPONSE_REGISTRY,
        protocolVersion: HOSTD_ROLLBACK_PROTOCOL_VERSION,
        requestId: request.requestId,
        operation: HOSTD_ROLLBACK_OPERATION,
        owner: "openclaw-hostd",
        transport: "unix_socket",
        capability: {
          registry: HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
          operation: HOSTD_ROLLBACK_OPERATION,
          capabilityId: HOSTD_ROLLBACK_CAPABILITY_ID,
          targetPath: HOSTD_ROLLBACK_TARGET_PATH,
        },
        receipt,
        governance: buildRollbackGovernance(peerIdentity),
      };
    } catch (error) {
      return errorResponse({
        requestId: request.requestId,
        code: error?.code === "rollback_disabled" ? "rollback_disabled" : "rollback_failed",
        error: error instanceof Error ? error.message.slice(0, 256) : "Hostd managed-config rollback failed.",
        peerIdentity,
      });
    }
  };
}

export { buildRollbackGovernance };
