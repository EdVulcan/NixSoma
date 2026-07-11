import { chmodSync, rmSync } from "node:fs";
import net from "node:net";

import {
  createSidecarMessageDecoder,
  encodeSidecarMessage,
} from "./trusted-work-view-sidecar-channel.mjs";

const HEARTBEAT_REGISTRY = "openclaw-trusted-work-view-sidecar-heartbeat-v0";
const socketPath = process.env.OPENCLAW_SIDECAR_SOCKET_PATH ?? null;
const heartbeatIntervalMs = Math.max(25, Number.parseInt(process.env.OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS ?? "250", 10));
const captureIntervalMs = Math.max(500, Number.parseInt(process.env.OPENCLAW_SIDECAR_CAPTURE_INTERVAL_MS ?? "1000", 10));
const reconnectTimeoutMs = Math.max(5_000, Number.parseInt(process.env.OPENCLAW_SIDECAR_RECONNECT_TIMEOUT_MS ?? "30000", 10));
const lifecycleTaskId = process.env.OPENCLAW_SIDECAR_TASK_ID ?? null;
const lifecycleApprovalId = process.env.OPENCLAW_SIDECAR_APPROVAL_ID ?? null;

if (!socketPath || !lifecycleTaskId || !lifecycleApprovalId) {
  throw new Error("Trusted work-view sidecar requires socket and lifecycle identity.");
}

let authoritySocket = null;
let binding = null;
const lifecycleIdentity = {
  taskId: lifecycleTaskId,
  approvalId: lifecycleApprovalId,
};
let heartbeatCount = 0;
let captureSequence = 0;
let captureInFlight = false;
let latestCaptureObservation = null;
let heartbeatTimer = null;
let captureTimer = null;
let reconnectTimer = null;
const processStartedAt = new Date().toISOString();

function clearRuntimeTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (captureTimer) clearInterval(captureTimer);
  heartbeatTimer = null;
  captureTimer = null;
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function send(type, details = {}) {
  if (!authoritySocket || authoritySocket.destroyed || !binding) {
    return false;
  }
  authoritySocket.write(encodeSidecarMessage({
    registry: HEARTBEAT_REGISTRY,
    type,
    sessionId: binding.sessionId,
    workViewId: binding.workViewId,
    pid: process.pid,
    processStartedAt,
    emittedAt: new Date().toISOString(),
    ...details,
  }));
  return true;
}

function validateLoopbackOrigin(value) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Trusted work-view sidecar capture source must be loopback-only.");
  }
  return url.origin;
}

function bindAuthority(message) {
  const required = ["taskId", "approvalId", "sessionId", "workViewId"];
  for (const field of required) {
    if (typeof message[field] !== "string" || !message[field].trim()) {
      throw new Error(`Trusted work-view sidecar bind requires ${field}.`);
    }
  }
  if (
    lifecycleIdentity.taskId !== message.taskId
    || lifecycleIdentity.approvalId !== message.approvalId
  ) {
    throw new Error("Trusted work-view sidecar lifecycle identity mismatch.");
  }
  binding = {
    ...lifecycleIdentity,
    sessionId: message.sessionId,
    workViewId: message.workViewId,
    browserRuntimeUrl: message.browserRuntimeUrl ? validateLoopbackOrigin(message.browserRuntimeUrl) : null,
  };
  heartbeatCount += 1;
  latestCaptureObservation = null;
  captureInFlight = false;
  clearReconnectTimer();
  clearRuntimeTimers();
  send("ready", { heartbeatCount });
  observeBrowserCapture();
  heartbeatTimer = setInterval(() => {
    heartbeatCount += 1;
    send("heartbeat", { heartbeatCount });
  }, heartbeatIntervalMs);
  captureTimer = setInterval(observeBrowserCapture, captureIntervalMs);
}

async function observeBrowserCapture() {
  if (!binding?.browserRuntimeUrl || captureInFlight) {
    return;
  }
  captureInFlight = true;
  try {
    const response = await fetch(`${binding.browserRuntimeUrl}/browser/capture?visual=metadata`);
    const data = await response.json();
    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error ?? "browser_capture_request_failed");
    }
    if (data.running !== true || !data.capture) {
      throw new Error("browser_runtime_not_running");
    }
    const capture = data.capture;
    const summary = capture.workViewSummary ?? {};
    captureSequence += 1;
    latestCaptureObservation = {
      registry: "openclaw-trusted-work-view-sidecar-capture-observation-v0",
      source: "browser-runtime-loopback",
      sessionId: capture.sessionId ?? data.browser?.sessionId ?? null,
      title: typeof summary.title === "string" ? summary.title.slice(0, 200) : null,
      activeUrl: typeof summary.url === "string" ? summary.url.slice(0, 2048) : null,
      tabCount: Number.isInteger(summary.tabCount) ? summary.tabCount : 0,
      visibleTextBlockCount: Array.isArray(summary.visibleTextBlocks) ? summary.visibleTextBlocks.length : 0,
      capturedAt: capture.capturedAt ?? new Date().toISOString(),
      observedAt: new Date().toISOString(),
      sequence: captureSequence,
      workspaceRecoveryStatus: typeof summary.workspaceRecovery?.status === "string"
        ? summary.workspaceRecovery.status.slice(0, 80)
        : null,
      restoredTabCount: Number.isInteger(summary.workspaceRecovery?.restoredTabCount)
        ? summary.workspaceRecovery.restoredTabCount
        : 0,
      freshAuthorityBound: summary.workspaceRecovery?.freshAuthorityBound === true,
      automaticActionReplay: false,
      browserEngineMode: typeof summary.engine?.mode === "string" ? summary.engine.mode.slice(0, 40) : "unknown",
      realBrowserEngine: summary.engine?.realEngine === true,
      browserEngineRegistry: typeof summary.engine?.registry === "string" ? summary.engine.registry.slice(0, 100) : null,
      fullPayloadRetained: false,
      desktopWideCapture: false,
    };
    send("capture_observation", { observation: latestCaptureObservation });
  } catch (error) {
    send("capture_failed", { reason: error instanceof Error ? error.message : "capture_failed" });
  } finally {
    captureInFlight = false;
  }
}

async function executeBrowserAction(message) {
  const observedAt = Date.parse(latestCaptureObservation?.observedAt ?? "");
  const fresh = Number.isFinite(observedAt) && Date.now() - observedAt <= 3_000;
  if (!fresh || latestCaptureObservation?.sessionId !== binding?.sessionId) {
    send("action_result", {
      requestId: message.requestId,
      result: { ok: false, reason: fresh ? "capture_session_mismatch" : "capture_stale" },
    });
    return;
  }
  const endpoint = message.kind === "keyboard.type"
    ? "/browser/input"
    : message.kind === "mouse.click"
      ? "/browser/click"
      : message.kind === "browser.new_tab" ? "/browser/new-tab" : null;
  if (!endpoint) {
    send("action_result", { requestId: message.requestId, result: { ok: false, reason: "unsupported_action" } });
    return;
  }
  try {
    const response = await fetch(`${binding.browserRuntimeUrl}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...message.payload, trustedHelperLease: message.trustedHelperLease }),
    });
    const data = await response.json();
    send("action_result", {
      requestId: message.requestId,
      result: {
        ok: response.ok && data?.ok === true,
        reason: data?.mediation?.reason ?? data?.error ?? null,
        mediation: data?.mediation ?? null,
        effect: data?.tab ? {
          tabId: data.tab.id ?? null,
          url: data.tab.url ?? null,
          tabCount: Array.isArray(data.browser?.tabs) ? data.browser.tabs.length : null,
        } : null,
      },
    });
  } catch (error) {
    send("action_result", {
      requestId: message.requestId,
      result: { ok: false, reason: error instanceof Error ? error.message : "browser_action_failed" },
    });
  }
}

function detachAuthority(socket) {
  if (authoritySocket !== socket) return;
  clearRuntimeTimers();
  authoritySocket = null;
  binding = null;
  latestCaptureObservation = null;
  captureInFlight = false;
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => stop("authority_reconnect_timeout"), reconnectTimeoutMs);
}

function handleAuthorityConnection(socket) {
  if (authoritySocket && !authoritySocket.destroyed) {
    socket.end(encodeSidecarMessage({ ok: false, reason: "authority_already_connected" }));
    return;
  }
  authoritySocket = socket;
  const decoder = createSidecarMessageDecoder({
    onMessage(message) {
      try {
        if (message?.type === "bind") bindAuthority(message);
        else if (message?.type === "shutdown") stop("authority_requested_shutdown");
        else if (message?.type === "browser_action" && binding) executeBrowserAction(message);
      } catch (error) {
        socket.end(encodeSidecarMessage({ ok: false, reason: error instanceof Error ? error.message : "invalid_authority_message" }));
      }
    },
    onError: () => socket.destroy(),
  });
  socket.on("data", decoder.push);
  socket.on("close", () => detachAuthority(socket));
  socket.on("error", () => detachAuthority(socket));
}

const server = net.createServer(handleAuthorityConnection);

function removeSocketFile() {
  rmSync(socketPath, { force: true });
}

function stop(reason) {
  clearRuntimeTimers();
  clearReconnectTimer();
  send("stopped", { heartbeatCount, reason });
  authoritySocket?.end();
  authoritySocket = null;
  binding = null;
  server.close(() => {
    removeSocketFile();
    process.exit(0);
  });
}

removeSocketFile();
server.listen(socketPath, () => {
  chmodSync(socketPath, 0o600);
  reconnectTimer = setTimeout(() => stop("initial_authority_timeout"), reconnectTimeoutMs);
});

process.on("SIGTERM", () => stop("sigterm"));
process.on("SIGINT", () => stop("sigint"));
process.on("exit", removeSocketFile);
