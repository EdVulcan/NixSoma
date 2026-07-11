import { chmodSync, rmSync } from "node:fs";
import net from "node:net";

import {
  createSidecarMessageDecoder,
  encodeSidecarMessage,
} from "./trusted-work-view-sidecar-channel.mjs";
import { projectWorkViewVisualFrame } from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";

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
let capturePromise = null;
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
  capturePromise = null;
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

async function observeBrowserCapture({ afterMutation = false } = {}) {
  if (!binding?.browserRuntimeUrl) return null;
  if (afterMutation && capturePromise) await capturePromise;
  if (capturePromise) return capturePromise;
  const boundSessionId = binding.sessionId;
  const browserRuntimeUrl = binding.browserRuntimeUrl;
  capturePromise = (async () => {
    try {
      const response = await fetch(`${browserRuntimeUrl}/browser/capture?visual=metadata`);
      const data = await response.json();
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error ?? "browser_capture_request_failed");
      }
      if (data.running !== true || !data.capture) {
        throw new Error("browser_runtime_not_running");
      }
      if (binding?.sessionId !== boundSessionId) return null;
      const capture = data.capture;
      const summary = capture.workViewSummary ?? {};
      const visualFrame = projectWorkViewVisualFrame(capture.visualFrame, { includeData: false });
      const semanticTargetSummary = summary.semanticTargets ?? {};
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
        visualFrame,
        semanticTargets: {
          registry: semanticTargetSummary.registry ?? "openclaw-browser-semantic-target-inventory-v0",
          available: semanticTargetSummary.available === true,
          itemCount: Number.isInteger(semanticTargetSummary.itemCount) ? semanticTargetSummary.itemCount : 0,
          truncated: semanticTargetSummary.truncated === true,
          inventorySha256: typeof semanticTargetSummary.inventorySha256 === "string"
            ? semanticTargetSummary.inventorySha256.slice(0, 64)
            : null,
          frameSequence: Number.isInteger(semanticTargetSummary.frame?.sequence)
            ? semanticTargetSummary.frame.sequence
            : null,
          itemsRetained: false,
          inputValuesExposed: false,
          selectorsExposed: false,
          mutation: false,
        },
        visualGroundingReady: summary.engine?.realEngine !== true || (visualFrame.available && visualFrame.fresh),
        fullPayloadRetained: false,
        desktopWideCapture: false,
      };
      send("capture_observation", { observation: latestCaptureObservation });
      return latestCaptureObservation;
    } catch (error) {
      send("capture_failed", { reason: error instanceof Error ? error.message : "capture_failed" });
      return null;
    }
  })().finally(() => {
    capturePromise = null;
  });
  return capturePromise;
}

function frameReference(observation) {
  const frame = observation?.visualFrame;
  if (!frame?.available) return null;
  return {
    registry: frame.registry,
    sha256: frame.sha256,
    sequence: frame.sequence,
    pageUrl: frame.pageUrl,
    capturedAt: frame.capturedAt,
    fresh: frame.fresh === true,
    width: frame.width,
    height: frame.height,
    byteLength: frame.byteLength,
    sourceScope: frame.sourceScope,
    dataExposed: false,
    persisted: false,
  };
}

async function executeBrowserAction(message) {
  const beforeObservation = latestCaptureObservation;
  const observedAt = Date.parse(latestCaptureObservation?.observedAt ?? "");
  const fresh = Number.isFinite(observedAt) && Date.now() - observedAt <= 3_000;
  if (!fresh || latestCaptureObservation?.sessionId !== binding?.sessionId) {
    send("action_result", {
      requestId: message.requestId,
      result: { ok: false, reason: fresh ? "capture_session_mismatch" : "capture_stale" },
    });
    return;
  }
  const visualGroundingRequired = beforeObservation.realBrowserEngine === true;
  const beforeFrame = frameReference(beforeObservation);
  if (visualGroundingRequired && (!beforeFrame || beforeFrame.fresh !== true)) {
    send("action_result", {
      requestId: message.requestId,
      result: { ok: false, reason: "visual_frame_not_ready" },
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
    const actionAccepted = response.ok && data?.ok === true;
    const afterObservation = actionAccepted ? await observeBrowserCapture({ afterMutation: true }) : null;
    const afterFrame = frameReference(afterObservation);
    const sequenceAdvanced = Boolean(beforeFrame && afterFrame && afterFrame.sequence > beforeFrame.sequence);
    const visualGrounding = {
      registry: "openclaw-trusted-work-view-visual-action-grounding-v0",
      required: visualGroundingRequired,
      status: !visualGroundingRequired
        ? "simulated_not_required"
        : actionAccepted && sequenceAdvanced ? "grounded" : actionAccepted ? "post_action_frame_unverified" : "action_rejected",
      before: beforeFrame,
      after: afterFrame,
      sequenceAdvanced,
      imageDataRetained: false,
      desktopWideCapture: false,
      persisted: false,
    };
    send("action_result", {
      requestId: message.requestId,
      result: {
        ok: actionAccepted,
        reason: data?.mediation?.reason ?? data?.error ?? null,
        mediation: data?.mediation ?? null,
        effect: data?.tab ? {
          tabId: data.tab.id ?? null,
          url: data.tab.url ?? null,
          tabCount: Array.isArray(data.browser?.tabs) ? data.browser.tabs.length : null,
        } : null,
        visualGrounding,
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
  capturePromise = null;
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
