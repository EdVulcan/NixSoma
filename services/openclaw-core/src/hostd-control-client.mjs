import { randomUUID } from "node:crypto";
import net from "node:net";
import {
  HOSTD_RESTART_CAPABILITY_REGISTRY,
  hostdRestartCapabilityForTarget,
} from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import {
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_MAX_AGE_MS,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_PROTOCOL_VERSION,
  HOSTD_ACTIVATION_RESPONSE_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  isBoundedActivationExpiry,
  isNixStorePath,
  isSha256,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";

export const OPENCLAW_HOSTD_SOCKET_PATH_ENV = "OPENCLAW_HOSTD_SOCKET_PATH";
export const DEFAULT_OPENCLAW_HOSTD_SOCKET_PATH = "/run/openclaw/hostd.sock";
export const HOSTD_PROTOCOL_VERSION = 1;
export const HOSTD_REQUEST_OPERATION = "restart_system_sense";
export const HOSTD_TARGET_UNIT = "openclaw-system-sense.service";
export const HOSTD_RESPONSE_REGISTRY = "openclaw-hostd-systemd-restart-response-v0";
const HOSTD_REQUEST_MAX_BYTES = 8 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

function boundedSocketPath(socketPath) {
  if (typeof socketPath !== "string" || socketPath.length === 0 || socketPath.length > 256) {
    throw new Error("OpenClaw hostd requires a bounded Unix socket path.");
  }
  return socketPath;
}

function parseResponse(line, expectedRequestId, {
  registry = HOSTD_RESPONSE_REGISTRY,
  protocolVersion = HOSTD_PROTOCOL_VERSION,
  capabilityRegistry = HOSTD_RESTART_CAPABILITY_REGISTRY,
} = {}) {
  let response;
  try {
    response = JSON.parse(line);
  } catch {
    throw new Error("OpenClaw hostd returned invalid JSON.");
  }
  if (!response || typeof response !== "object" || Array.isArray(response)
    || response.registry !== registry
    || response.protocolVersion !== protocolVersion
    || (response.ok === true && response.capability?.registry !== capabilityRegistry)) {
    throw new Error("OpenClaw hostd returned an invalid protocol response.");
  }
  if (response.requestId !== expectedRequestId) {
    throw new Error("OpenClaw hostd response request id does not match the request.");
  }
  return response;
}

function requestHostdMessage({
  socketPath,
  request,
  requestId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createConnection = net.createConnection,
  response = {},
} = {}) {
  const targetSocketPath = boundedSocketPath(socketPath);
  const requestText = JSON.stringify(request);
  if (Buffer.byteLength(requestText, "utf8") > HOSTD_REQUEST_MAX_BYTES) {
    throw new Error("OpenClaw hostd request exceeds the bounded protocol size.");
  }

  const boundedTimeoutMs = Math.min(60_000, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    let socket;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("OpenClaw hostd request timed out.")), boundedTimeoutMs);

    try {
      socket = createConnection(targetSocketPath);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Unable to connect to OpenClaw hostd."));
      return;
    }

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer, "utf8") > HOSTD_REQUEST_MAX_BYTES) {
        finish(new Error("OpenClaw hostd response exceeds the bounded protocol size."));
        return;
      }
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex < 0) return;
      try {
        finish(null, parseResponse(buffer.slice(0, newlineIndex), requestId, response));
      } catch (error) {
        finish(error instanceof Error ? error : new Error("OpenClaw hostd returned an invalid response."));
      }
    });
    socket.on("error", (error) => finish(error));
    socket.on("end", () => {
      if (!settled) finish(new Error("OpenClaw hostd closed the connection without a response."));
    });
    socket.on("connect", () => socket.end(`${requestText}\n`));
  });
}

export async function requestHostdRestart({
  socketPath = process.env[OPENCLAW_HOSTD_SOCKET_PATH_ENV] ?? DEFAULT_OPENCLAW_HOSTD_SOCKET_PATH,
  targetUnit = HOSTD_TARGET_UNIT,
  operation = null,
  requestId = randomUUID(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createConnection = net.createConnection,
} = {}) {
  const capability = hostdRestartCapabilityForTarget(targetUnit);
  if (!capability || (operation !== null && operation !== capability.operation)) {
    throw new Error(`OpenClaw hostd client rejects restart target ${targetUnit}.`);
  }
  return requestHostdMessage({
    socketPath,
    request: {
      version: HOSTD_PROTOCOL_VERSION,
      operation: capability.operation,
      target: capability.targetUnit,
      requestId,
    },
    requestId,
    timeoutMs,
    createConnection,
  });
}

export async function requestHostdManagedConfigActivation({
  socketPath = process.env[OPENCLAW_HOSTD_SOCKET_PATH_ENV] ?? DEFAULT_OPENCLAW_HOSTD_SOCKET_PATH,
  targetPath = HOSTD_ACTIVATION_TARGET_PATH,
  stagingPath,
  candidateHash,
  evaluatedClosurePath,
  sourceStagingTaskId = null,
  activationDecisionTaskId = null,
  activationTaskId = null,
  expiresAt = new Date(Date.now() + HOSTD_ACTIVATION_MAX_AGE_MS).toISOString(),
  requestId = randomUUID(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createConnection = net.createConnection,
} = {}) {
  if (targetPath !== HOSTD_ACTIVATION_TARGET_PATH
    || typeof stagingPath !== "string"
    || !isSha256(candidateHash)
    || !isNixStorePath(evaluatedClosurePath)
    || !isBoundedActivationExpiry(expiresAt)) {
    throw new Error("OpenClaw hostd client rejects an unbound managed-config activation request.");
  }
  const request = {
    version: HOSTD_ACTIVATION_PROTOCOL_VERSION,
    operation: HOSTD_ACTIVATION_OPERATION,
    target: HOSTD_ACTIVATION_TARGET_PATH,
    stagingPath,
    candidateHash,
    evaluatedClosurePath,
    expiresAt,
    requestId,
    ...(sourceStagingTaskId ? { sourceStagingTaskId } : {}),
    ...(activationDecisionTaskId ? { activationDecisionTaskId } : {}),
    ...(activationTaskId ? { activationTaskId } : {}),
  };
  return requestHostdMessage({
    socketPath,
    request,
    requestId,
    timeoutMs,
    createConnection,
    response: {
      registry: HOSTD_ACTIVATION_RESPONSE_REGISTRY,
      protocolVersion: HOSTD_ACTIVATION_PROTOCOL_VERSION,
      capabilityRegistry: HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
    },
  });
}

export const requestHostdSystemSenseRestart = (options = {}) => requestHostdRestart({
  ...options,
  targetUnit: HOSTD_TARGET_UNIT,
  operation: HOSTD_REQUEST_OPERATION,
});

export { HOSTD_RESTART_CAPABILITY_REGISTRY };
