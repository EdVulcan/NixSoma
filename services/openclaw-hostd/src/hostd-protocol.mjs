import { randomUUID } from "node:crypto";
import { HOSTD_RESTART_METHOD, HOSTD_TARGET_UNIT, runFixedSystemdRestart } from "./systemd-hostd-control.mjs";
import {
  HOSTD_RESTART_CAPABILITY_REGISTRY,
  findHostdRestartCapability,
} from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import { createHostdActivationRequestHandler } from "./hostd-activation-protocol.mjs";

export const HOSTD_PROTOCOL_VERSION = 1;
export const HOSTD_REQUEST_MAX_BYTES = 8192;
export const HOSTD_REQUEST_OPERATION = "restart_system_sense";
export const HOSTD_RESPONSE_REGISTRY = "openclaw-hostd-systemd-restart-response-v0";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const ALLOWED_REQUEST_KEYS = new Set(["version", "operation", "target", "requestId"]);

function boundedError(error) {
  const message = error instanceof Error ? error.message : "OpenClaw hostd request failed.";
  return message.slice(0, 256);
}

export function buildHostdGovernance(peerIdentity = null) {
  const verified = peerIdentity?.verified === true;
  const matched = verified && peerIdentity?.matched === true;
  return {
    callerBoundary: verified ? "kernel_so_peercred" : "openclaw-service-group-socket",
    socketPeerIdentityVerified: verified,
    socketPeerIdentityMatched: matched,
    arbitraryUnit: false,
    arbitraryMethod: false,
    automaticRestart: false,
  };
}

function errorResponse({ requestId = null, code, error, peerIdentity = null }) {
  return {
    ok: false,
    registry: HOSTD_RESPONSE_REGISTRY,
    protocolVersion: HOSTD_PROTOCOL_VERSION,
    requestId,
    owner: "openclaw-hostd",
    error: { code, message: error },
    governance: buildHostdGovernance(peerIdentity),
  };
}

export function parseHostdRequest(line) {
  if (typeof line !== "string" || Buffer.byteLength(line, "utf8") > HOSTD_REQUEST_MAX_BYTES) {
    return { ok: false, response: errorResponse({ code: "request_too_large", error: "Hostd request exceeds the bounded protocol size." }) };
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return { ok: false, response: errorResponse({ code: "invalid_json", error: "Hostd request must be one JSON object." }) };
  }

  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return { ok: false, response: errorResponse({ code: "invalid_request", error: "Hostd request must be one JSON object." }) };
  }
  if (Object.keys(request).some((key) => !ALLOWED_REQUEST_KEYS.has(key))) {
    return { ok: false, response: errorResponse({ code: "unknown_field", error: "Hostd request contains an unsupported field." }) };
  }
  const capability = findHostdRestartCapability({
    operation: request.operation,
    targetUnit: request.target,
  });
  if (request.version !== HOSTD_PROTOCOL_VERSION
    || !capability
    || typeof request.requestId !== "string"
    || !REQUEST_ID_PATTERN.test(request.requestId)) {
    return {
      ok: false,
      response: errorResponse({
        requestId: typeof request.requestId === "string" ? request.requestId : null,
        code: "unsupported_capability",
        error: "Hostd accepts only a fixed allowlisted OpenClaw restart capability.",
      }),
    };
  }
  return { ok: true, request };
}

export function createHostdRequestHandler({
  runRestart = runFixedSystemdRestart,
  runActivation,
  requirePeerIdentity = true,
} = {}) {
  const handleActivation = createHostdActivationRequestHandler({
    runActivation,
    requirePeerIdentity,
  });
  return async function handleHostdRequest(line, { peerIdentity = null } = {}) {
    const activationResponse = await handleActivation(line, { peerIdentity });
    if (activationResponse !== null) return activationResponse;
    const parsed = parseHostdRequest(line);
    if (!parsed.ok) return parsed.response;

    const { request } = parsed;
    const capability = findHostdRestartCapability({
      operation: request.operation,
      targetUnit: request.target,
    });
    if (requirePeerIdentity && (peerIdentity?.verified !== true || peerIdentity?.matched !== true)) {
      return errorResponse({
        requestId: request.requestId,
        code: "peer_identity_denied",
        error: "Hostd requires a matching kernel peer identity before privileged mutation.",
        peerIdentity,
      });
    }
    try {
      const nativeMutation = await runRestart({ args: [], unit: capability.targetUnit });
      if (nativeMutation?.ok !== true
        || nativeMutation.owner !== "openclaw-hostd"
        || nativeMutation.transport !== "dbus_native"
        || nativeMutation.method !== HOSTD_RESTART_METHOD
        || nativeMutation.unit !== capability.targetUnit
        || nativeMutation.capability?.registry !== HOSTD_RESTART_CAPABILITY_REGISTRY
        || nativeMutation.capability?.operation !== capability.operation
        || nativeMutation.capability?.capabilityId !== capability.capabilityId) {
        return errorResponse({
          requestId: request.requestId,
          code: "invalid_mutation_evidence",
          error: "Hostd restart owner returned invalid native mutation evidence.",
          peerIdentity,
        });
      }
      return {
        ok: true,
        registry: HOSTD_RESPONSE_REGISTRY,
        protocolVersion: HOSTD_PROTOCOL_VERSION,
        requestId: request.requestId,
        operation: request.operation,
        owner: "openclaw-hostd",
        transport: "unix_socket",
        method: HOSTD_RESTART_METHOD,
        unit: capability.targetUnit,
        capability: {
          registry: HOSTD_RESTART_CAPABILITY_REGISTRY,
          operation: capability.operation,
          capabilityId: capability.capabilityId,
        },
        nativeMutation,
        governance: {
          ...buildHostdGovernance(peerIdentity),
          passwordPromptAllowed: false,
        },
      };
    } catch (error) {
      return errorResponse({
        requestId: request.requestId,
        code: "native_restart_failed",
        error: boundedError(error),
        peerIdentity,
      });
    }
  };
}

export function createHostdRequestId() {
  return randomUUID();
}
