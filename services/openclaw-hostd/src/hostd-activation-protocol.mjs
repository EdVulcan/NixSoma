import { randomUUID } from "node:crypto";

import {
  HOSTD_ACTIVATION_CAPABILITY_ID,
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_MAX_AGE_MS,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_PROTOCOL_VERSION,
  HOSTD_ACTIVATION_REQUEST_MAX_BYTES,
  HOSTD_ACTIVATION_RESPONSE_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  isBoundedActivationExpiry,
  isNixStorePath,
  isSha256,
  validateManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { runFixedManagedConfigActivation } from "./managed-config-activation.mjs";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;
const ALLOWED_REQUEST_KEYS = new Set([
  "version",
  "operation",
  "target",
  "stagingPath",
  "candidateHash",
  "evaluatedClosurePath",
  "expiresAt",
  "requestId",
  "sourceStagingTaskId",
  "activationDecisionTaskId",
  "activationTaskId",
]);

function errorResponse({ requestId = null, code, error, peerIdentity = null }) {
  return {
    ok: false,
    registry: HOSTD_ACTIVATION_RESPONSE_REGISTRY,
    protocolVersion: HOSTD_ACTIVATION_PROTOCOL_VERSION,
    requestId,
    owner: "openclaw-hostd",
    error: { code, message: error },
    governance: buildActivationGovernance(peerIdentity),
  };
}

function buildActivationGovernance(peerIdentity = null) {
  const verified = peerIdentity?.verified === true;
  return {
    callerBoundary: verified ? "kernel_so_peercred" : "openclaw-service-group-socket",
    socketPeerIdentityVerified: verified,
    socketPeerIdentityMatched: verified && peerIdentity?.matched === true,
    arbitraryTarget: false,
    arbitraryCommand: false,
    automaticActivation: false,
    automaticRollback: false,
    rollbackExecuted: false,
  };
}

function parseJsonLine(line) {
  if (typeof line !== "string" || Buffer.byteLength(line, "utf8") > HOSTD_ACTIVATION_REQUEST_MAX_BYTES) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function parseHostdActivationRequest(line) {
  const request = parseJsonLine(line);
  if (!request || typeof request !== "object" || Array.isArray(request)
    || request.operation !== HOSTD_ACTIVATION_OPERATION) return { recognised: false };
  if (Object.keys(request).some((key) => !ALLOWED_REQUEST_KEYS.has(key))) {
    return { recognised: true, ok: false, response: errorResponse({ code: "unknown_field", error: "Hostd activation request contains an unsupported field." }) };
  }
  const requestIdOk = typeof request.requestId === "string" && REQUEST_ID_PATTERN.test(request.requestId);
  const optionalIdOk = ["sourceStagingTaskId", "activationDecisionTaskId", "activationTaskId"]
    .every((key) => request[key] === undefined || (typeof request[key] === "string" && ID_PATTERN.test(request[key])));
  if (request.version !== HOSTD_ACTIVATION_PROTOCOL_VERSION
    || request.operation !== HOSTD_ACTIVATION_OPERATION
    || request.target !== HOSTD_ACTIVATION_TARGET_PATH
    || typeof request.stagingPath !== "string"
    || request.stagingPath.length < 1
    || request.stagingPath.length > 512
    || !isSha256(request.candidateHash)
    || !isNixStorePath(request.evaluatedClosurePath)
    || !isBoundedActivationExpiry(request.expiresAt)
    || !requestIdOk
    || !optionalIdOk) {
    return {
      recognised: true,
      ok: false,
      response: errorResponse({
        requestId: requestIdOk ? request.requestId : null,
        code: "unsupported_capability",
        error: "Hostd accepts only a bounded, hash-bound managed-config activation request.",
      }),
    };
  }
  return { recognised: true, ok: true, request };
}

export function createHostdActivationRequestHandler({
  runActivation = runFixedManagedConfigActivation,
  requirePeerIdentity = true,
  now = () => Date.now(),
} = {}) {
  const consumedRequestIds = new Set();
  return async function handleHostdActivationRequest(line, { peerIdentity = null } = {}) {
    const parsed = parseHostdActivationRequest(line);
    if (!parsed.recognised) return null;
    if (!parsed.ok) return parsed.response;
    const { request } = parsed;
    if (requirePeerIdentity && (peerIdentity?.verified !== true || peerIdentity?.matched !== true)) {
      return errorResponse({
        requestId: request.requestId,
        code: "peer_identity_denied",
        error: "Hostd requires a matching kernel peer identity before managed-config activation.",
        peerIdentity,
      });
    }
    if (consumedRequestIds.has(request.requestId)) {
      return errorResponse({
        requestId: request.requestId,
        code: "request_replayed",
        error: "Hostd activation request ids are single-use.",
        peerIdentity,
      });
    }
    if (Date.parse(request.expiresAt) <= now()) {
      return errorResponse({
        requestId: request.requestId,
        code: "request_expired",
        error: "Hostd activation request has expired.",
        peerIdentity,
      });
    }
    consumedRequestIds.add(request.requestId);
    try {
      const receipt = await runActivation(request);
      if (!validateManagedConfigActivationReceipt(receipt)
        || receipt.requestId !== request.requestId
        || receipt.candidateHash !== request.candidateHash
        || receipt.evaluatedClosurePath !== request.evaluatedClosurePath) {
        return errorResponse({
          requestId: request.requestId,
          code: "invalid_activation_receipt",
          error: "Hostd activation owner returned invalid receipt evidence.",
          peerIdentity,
        });
      }
      return {
        ok: receipt.status === "passed",
        registry: HOSTD_ACTIVATION_RESPONSE_REGISTRY,
        protocolVersion: HOSTD_ACTIVATION_PROTOCOL_VERSION,
        requestId: request.requestId,
        operation: HOSTD_ACTIVATION_OPERATION,
        owner: "openclaw-hostd",
        transport: "unix_socket",
        capability: {
          registry: HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
          operation: HOSTD_ACTIVATION_OPERATION,
          capabilityId: HOSTD_ACTIVATION_CAPABILITY_ID,
          targetPath: HOSTD_ACTIVATION_TARGET_PATH,
        },
        receipt,
        governance: buildActivationGovernance(peerIdentity),
      };
    } catch (error) {
      return errorResponse({
        requestId: request.requestId,
        code: error?.code === "activation_disabled" ? "activation_disabled" : "activation_failed",
        error: error instanceof Error ? error.message.slice(0, 256) : "Hostd managed-config activation failed.",
        peerIdentity,
      });
    }
  };
}

export function createHostdActivationRequestId() {
  return randomUUID();
}

export { buildActivationGovernance };
