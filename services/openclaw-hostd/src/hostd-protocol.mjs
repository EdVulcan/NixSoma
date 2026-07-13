import { randomUUID } from "node:crypto";
import { HOSTD_RESTART_METHOD, HOSTD_TARGET_UNIT, runFixedSystemdRestart } from "./systemd-hostd-control.mjs";

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

function errorResponse({ requestId = null, code, error }) {
  return {
    ok: false,
    registry: HOSTD_RESPONSE_REGISTRY,
    protocolVersion: HOSTD_PROTOCOL_VERSION,
    requestId,
    owner: "openclaw-hostd",
    error: { code, message: error },
    governance: {
      callerBoundary: "openclaw-service-group-socket",
      socketPeerIdentityVerified: false,
      arbitraryUnit: false,
      arbitraryMethod: false,
      automaticRestart: false,
    },
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
  if (request.version !== HOSTD_PROTOCOL_VERSION
    || request.operation !== HOSTD_REQUEST_OPERATION
    || request.target !== HOSTD_TARGET_UNIT
    || typeof request.requestId !== "string"
    || !REQUEST_ID_PATTERN.test(request.requestId)) {
    return {
      ok: false,
      response: errorResponse({
        requestId: typeof request.requestId === "string" ? request.requestId : null,
        code: "unsupported_capability",
        error: "Hostd accepts only the fixed system-sense restart capability.",
      }),
    };
  }
  return { ok: true, request };
}

export function createHostdRequestHandler({ runRestart = runFixedSystemdRestart } = {}) {
  return async function handleHostdRequest(line) {
    const parsed = parseHostdRequest(line);
    if (!parsed.ok) return parsed.response;

    const { request } = parsed;
    try {
      const nativeMutation = await runRestart({ args: [] });
      if (nativeMutation?.ok !== true
        || nativeMutation.owner !== "openclaw-hostd"
        || nativeMutation.transport !== "dbus_native"
        || nativeMutation.method !== HOSTD_RESTART_METHOD
        || nativeMutation.unit !== HOSTD_TARGET_UNIT) {
        return errorResponse({
          requestId: request.requestId,
          code: "invalid_mutation_evidence",
          error: "Hostd restart owner returned invalid native mutation evidence.",
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
        unit: HOSTD_TARGET_UNIT,
        nativeMutation,
        governance: {
          callerBoundary: "openclaw-service-group-socket",
          socketPeerIdentityVerified: false,
          arbitraryUnit: false,
          arbitraryMethod: false,
          automaticRestart: false,
          passwordPromptAllowed: false,
        },
      };
    } catch (error) {
      return errorResponse({
        requestId: request.requestId,
        code: "native_restart_failed",
        error: boundedError(error),
      });
    }
  };
}

export function createHostdRequestId() {
  return randomUUID();
}
