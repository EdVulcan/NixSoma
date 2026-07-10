import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createSidecarMessageDecoder,
  encodeSidecarMessage,
} from "./trusted-work-view-sidecar-channel.mjs";

const HEARTBEAT_REGISTRY = "openclaw-trusted-work-view-sidecar-heartbeat-v0";
const SIDECAR_REGISTRY = "openclaw-trusted-work-view-sidecar-supervisor-v0";
const sidecarPath = new URL("./trusted-work-view-sidecar.mjs", import.meta.url);

function requiredString(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`Trusted work-view sidecar requires ${label}.`);
  return text;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectSocket(socketPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Trusted work-view sidecar socket connection timed out."));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.removeListener("error", rejectConnection);
      resolve(socket);
    });
    function rejectConnection(error) {
      clearTimeout(timeout);
      reject(error);
    }
    socket.once("error", rejectConnection);
  });
}

function sidecarSocketPath(socketDirectory, taskId) {
  const digest = createHash("sha256").update(taskId).digest("hex").slice(0, 24);
  return path.join(socketDirectory, `openclaw-sidecar-${digest}.sock`);
}

export function createTrustedWorkViewSidecarSupervisor({
  spawnProcess = spawn,
  now = () => new Date().toISOString(),
  heartbeatIntervalMs = 250,
  captureIntervalMs = 1_000,
  captureStaleAfterMs = 3_000,
  heartbeatTimeoutMs = 1_500,
  startTimeoutMs = 2_000,
  stopTimeoutMs = 1_000,
  reconnectTimeoutMs = 30_000,
  socketDirectory = path.join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), "openclaw-sidecars"),
  onHeartbeat = () => {},
  onFailure = () => {},
} = {}) {
  let transport = null;
  let spawnedProcess = null;
  let status = "inactive";
  let owner = null;
  let socketPath = null;
  let pid = null;
  let startedAt = null;
  let stoppedAt = null;
  let heartbeatAt = null;
  let heartbeatCount = 0;
  let exitCode = null;
  let exitSignal = null;
  let degradedReason = null;
  let heartbeatTimer = null;
  let failureReported = false;
  let captureObservation = null;
  let captureFailure = null;
  let captureFailedAt = null;
  let captureResolver = null;
  let startResolver = null;
  let startRejecter = null;
  let stopResolver = null;
  const pendingActions = new Map();

  function clearHeartbeatTimer() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }

  function rejectPendingActions(reason) {
    for (const pending of pendingActions.values()) {
      pending.reject(new Error(reason));
    }
    pendingActions.clear();
  }

  function reportFailure() {
    if (!failureReported) {
      failureReported = true;
      onFailure(snapshot());
    }
  }

  function armHeartbeatTimer() {
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      if (transport && status === "running") {
        status = "degraded";
        degradedReason = "trusted_sidecar_heartbeat_timeout";
        reportFailure();
        transport.destroy();
      }
    }, heartbeatTimeoutMs);
  }

  function snapshot() {
    const captureObservedAt = captureObservation?.observedAt ?? null;
    const captureAgeMs = captureObservedAt
      ? Math.max(0, Date.parse(now()) - Date.parse(captureObservedAt))
      : null;
    const captureFreshness = captureAgeMs === null
      ? "missing"
      : captureAgeMs <= captureStaleAfterMs ? "fresh" : "stale";
    return {
      registry: SIDECAR_REGISTRY,
      status,
      running: status === "running" && Boolean(transport),
      recoveryRequired: status === "recovery_required" || status === "degraded",
      automaticRestart: false,
      authorityConnected: Boolean(transport),
      pid,
      sessionId: owner?.sessionId ?? null,
      workViewId: owner?.workViewId ?? null,
      leaseId: owner?.leaseId ?? null,
      taskId: owner?.taskId ?? null,
      approvalId: owner?.approvalId ?? null,
      startedAt,
      stoppedAt,
      heartbeatAt,
      heartbeatCount,
      exitCode,
      exitSignal,
      degradedReason,
      captureObservation,
      captureFailure,
      captureFailedAt,
      captureSourceStatus: captureFailure
        ? "recovery_required"
        : captureObservation ? "ready" : "waiting",
      captureRecoveryRequired: Boolean(captureFailure),
      captureFreshness,
      captureAgeMs,
      captureStaleAfterMs,
      mode: "supervised_user_session_socket",
      sessionManagerOwned: false,
      userSessionOwned: true,
      reconnectable: true,
      boundedProcess: true,
      installRequired: false,
      credentialEnvironmentInherited: false,
      networkAccessRequired: Boolean(owner?.browserRuntimeUrl),
      networkScope: owner?.browserRuntimeUrl ? "loopback_browser_runtime_only" : "none",
      filesystemAccessRequired: false,
      rootRequired: false,
      systemDaemonRequired: false,
      desktopWideCapture: false,
      hostMutation: false,
      providerEgress: false,
    };
  }

  function handleMessage(message) {
    if (message?.ok === false) {
      startRejecter?.(new Error(message.reason ?? "Trusted sidecar rejected authority binding."));
      return;
    }
    if (
      message?.registry !== HEARTBEAT_REGISTRY
      || message.sessionId !== owner?.sessionId
      || message.workViewId !== owner?.workViewId
    ) {
      degradedReason = "invalid_sidecar_heartbeat_contract";
      return;
    }
    if (message.type === "ready" || message.type === "heartbeat") {
      status = "running";
      pid = Number.isInteger(message.pid) ? message.pid : pid;
      startedAt = message.processStartedAt ?? startedAt ?? now();
      heartbeatAt = message.emittedAt ?? now();
      heartbeatCount = Number.isInteger(message.heartbeatCount) ? message.heartbeatCount : heartbeatCount + 1;
      degradedReason = null;
      onHeartbeat({ ...message, leaseId: owner.leaseId });
      armHeartbeatTimer();
      if (message.type === "ready") startResolver?.();
    } else if (message.type === "capture_observation") {
      captureObservation = message.observation ?? null;
      captureFailure = null;
      captureFailedAt = null;
      captureResolver?.();
      captureResolver = null;
    } else if (message.type === "capture_failed") {
      captureFailure = message.reason ?? "capture_failed";
      captureFailedAt = message.emittedAt ?? now();
      captureResolver?.();
      captureResolver = null;
    } else if (message.type === "action_result") {
      const pending = pendingActions.get(message.requestId);
      if (pending) {
        pendingActions.delete(message.requestId);
        pending.resolve(message.result ?? { ok: false, reason: "missing_action_result" });
      }
    } else if (message.type === "stopped") {
      exitCode = 0;
      stoppedAt = message.emittedAt ?? now();
      if (status === "stopping") {
        status = "stopped";
      } else {
        status = "degraded";
        degradedReason = `trusted_sidecar_stopped_${message.reason ?? "unexpectedly"}`;
        reportFailure();
      }
      stopResolver?.();
    }
  }

  function attachTransport(socket) {
    transport = socket;
    const decoder = createSidecarMessageDecoder({
      onMessage: handleMessage,
      onError(error) {
        degradedReason = error.message;
        socket.destroy();
      },
    });
    socket.on("data", decoder.push);
    socket.on("close", () => {
      if (transport !== socket) return;
      clearHeartbeatTimer();
      transport = null;
      captureObservation = null;
      captureFailure = "sidecar_authority_disconnected";
      captureFailedAt = now();
      rejectPendingActions("Trusted work-view sidecar authority disconnected.");
      if (status !== "stopping" && status !== "stopped") {
        status = "recovery_required";
        degradedReason ??= "trusted_sidecar_authority_disconnected";
        reportFailure();
      }
      stopResolver?.();
    });
    socket.on("error", (error) => {
      degradedReason = error instanceof Error ? error.message : "sidecar_socket_error";
    });
  }

  async function openExistingSocket(targetPath) {
    try {
      const socket = await connectSocket(targetPath, Math.min(startTimeoutMs, 250));
      attachTransport(socket);
      return true;
    } catch {
      return false;
    }
  }

  async function spawnAndConnect(targetPath) {
    mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
    chmodSync(path.dirname(targetPath), 0o700);
    rmSync(targetPath, { force: true });
    const processHandle = spawnProcess(process.execPath, [sidecarPath.pathname], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        NODE_NO_WARNINGS: "1",
        OPENCLAW_SIDECAR_SOCKET_PATH: targetPath,
        OPENCLAW_SIDECAR_TASK_ID: owner.taskId,
        OPENCLAW_SIDECAR_APPROVAL_ID: owner.approvalId,
        OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS: String(heartbeatIntervalMs),
        OPENCLAW_SIDECAR_CAPTURE_INTERVAL_MS: String(captureIntervalMs),
        OPENCLAW_SIDECAR_RECONNECT_TIMEOUT_MS: String(reconnectTimeoutMs),
      },
    });
    spawnedProcess = processHandle;
    pid = processHandle.pid ?? null;
    processHandle.once("error", (error) => startRejecter?.(error));
    processHandle.once("exit", (code, signal) => {
      exitCode = code;
      exitSignal = signal;
      stoppedAt = now();
      if (status !== "stopping" && status !== "stopped") {
        status = "degraded";
        degradedReason ??= `trusted_sidecar_exited_${code ?? signal ?? "unknown"}`;
        reportFailure();
      }
      if (spawnedProcess === processHandle) spawnedProcess = null;
      if (pid === processHandle.pid) pid = null;
    });
    processHandle.unref?.();

    const deadline = Date.now() + startTimeoutMs;
    while (Date.now() < deadline) {
      if (await openExistingSocket(targetPath)) return;
      await delay(25);
    }
    throw new Error("Trusted work-view sidecar socket did not become ready.");
  }

  async function waitForReady() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Trusted work-view sidecar heartbeat timed out.")), startTimeoutMs);
      startResolver = () => {
        clearTimeout(timeout);
        resolve();
      };
      startRejecter = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    }).finally(() => {
      startResolver = null;
      startRejecter = null;
    });
  }

  async function start(input = {}) {
    const nextOwner = {
      sessionId: requiredString(input.sessionId, "sessionId"),
      workViewId: requiredString(input.workViewId, "workViewId"),
      leaseId: requiredString(input.leaseId, "leaseId"),
      taskId: requiredString(input.taskId, "taskId"),
      approvalId: requiredString(input.approvalId, "approvalId"),
      browserRuntimeUrl: null,
    };
    if (input.approvalStatus !== "approved") {
      throw new Error("Trusted work-view sidecar requires approved lifecycle authority.");
    }
    if (input.browserRuntimeUrl) {
      const browserUrl = new URL(input.browserRuntimeUrl);
      if (!["127.0.0.1", "localhost"].includes(browserUrl.hostname)) {
        throw new Error("Trusted work-view sidecar capture source must be loopback-only.");
      }
      nextOwner.browserRuntimeUrl = browserUrl.origin;
    }
    if (transport && status === "running") {
      if (owner?.taskId !== nextOwner.taskId || owner?.sessionId !== nextOwner.sessionId) {
        throw new Error("A trusted work-view sidecar is already owned by another lifecycle task.");
      }
      return { ...snapshot(), reused: true, reconnected: false };
    }

    owner = nextOwner;
    socketPath = sidecarSocketPath(socketDirectory, nextOwner.taskId);
    status = "starting";
    heartbeatAt = null;
    heartbeatCount = 0;
    exitCode = null;
    exitSignal = null;
    degradedReason = null;
    failureReported = false;
    captureObservation = null;
    captureFailure = null;
    captureFailedAt = null;

    let reconnected = await openExistingSocket(socketPath);
    try {
      if (!reconnected) await spawnAndConnect(socketPath);
      const ready = waitForReady();
      transport.write(encodeSidecarMessage({
        type: "bind",
        taskId: nextOwner.taskId,
        approvalId: nextOwner.approvalId,
        sessionId: nextOwner.sessionId,
        workViewId: nextOwner.workViewId,
        browserRuntimeUrl: nextOwner.browserRuntimeUrl,
      }));
      await ready;
    } catch (error) {
      transport?.destroy();
      if (!reconnected) spawnedProcess?.kill("SIGTERM");
      status = "degraded";
      degradedReason = error instanceof Error ? error.message : "sidecar_start_failed";
      throw error;
    }

    if (nextOwner.browserRuntimeUrl && !captureObservation && !captureFailure) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, startTimeoutMs);
        captureResolver = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }
    return { ...snapshot(), reused: false, reconnected };
  }

  async function disconnectAuthority({ taskId } = {}) {
    if (!transport) return { ...snapshot(), disconnected: false };
    if (requiredString(taskId, "taskId") !== owner?.taskId) {
      throw new Error("Trusted work-view sidecar lifecycle task mismatch.");
    }
    const socket = transport;
    await new Promise((resolve) => {
      socket.once("close", resolve);
      socket.destroy();
    });
    return { ...snapshot(), disconnected: true };
  }

  async function stop({ taskId } = {}) {
    if (!transport) return { ...snapshot(), stopped: false };
    if (requiredString(taskId, "taskId") !== owner?.taskId) {
      throw new Error("Trusted work-view sidecar lifecycle task mismatch.");
    }
    status = "stopping";
    clearHeartbeatTimer();
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        transport?.destroy();
        spawnedProcess?.kill("SIGTERM");
        resolve();
      }, stopTimeoutMs);
      stopResolver = () => {
        clearTimeout(timeout);
        resolve();
      };
      transport.write(encodeSidecarMessage({ type: "shutdown" }));
    });
    stopResolver = null;
    status = "stopped";
    pid = null;
    return { ...snapshot(), stopped: true };
  }

  function rebindLease({ sessionId, leaseId } = {}) {
    if (!owner) return snapshot();
    if (requiredString(sessionId, "sessionId") !== owner.sessionId) {
      throw new Error("Trusted work-view sidecar session mismatch during lease rebind.");
    }
    owner = { ...owner, leaseId: requiredString(leaseId, "leaseId") };
    return snapshot();
  }

  async function executeBrowserAction({ kind, payload, trustedHelperLease } = {}) {
    if (!transport || status !== "running" || captureObservation?.sessionId !== owner?.sessionId) {
      throw new Error("Trusted work-view sidecar action transport is not ready.");
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingActions.delete(requestId);
        reject(new Error("Trusted work-view sidecar action timed out."));
      }, startTimeoutMs);
      pendingActions.set(requestId, {
        resolve(result) {
          clearTimeout(timeout);
          resolve(result);
        },
        reject(error) {
          clearTimeout(timeout);
          reject(error);
        },
      });
      transport.write(encodeSidecarMessage({
        type: "browser_action",
        requestId,
        kind,
        payload,
        trustedHelperLease,
      }));
    });
  }

  return { start, stop, disconnectAuthority, rebindLease, executeBrowserAction, snapshot };
}
