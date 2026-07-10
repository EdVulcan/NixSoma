import { spawn } from "node:child_process";

const HEARTBEAT_REGISTRY = "openclaw-trusted-work-view-sidecar-heartbeat-v0";
const SIDECAR_REGISTRY = "openclaw-trusted-work-view-sidecar-supervisor-v0";
const sidecarPath = new URL("./trusted-work-view-sidecar.mjs", import.meta.url);

function requiredString(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Trusted work-view sidecar requires ${label}.`);
  }
  return text;
}

export function createTrustedWorkViewSidecarSupervisor({
  spawnProcess = spawn,
  now = () => new Date().toISOString(),
  heartbeatIntervalMs = 250,
  heartbeatTimeoutMs = 1_500,
  startTimeoutMs = 2_000,
  stopTimeoutMs = 1_000,
  onHeartbeat = () => {},
  onFailure = () => {},
} = {}) {
  let child = null;
  let status = "inactive";
  let owner = null;
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
  let captureResolver = null;

  function clearHeartbeatTimer() {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function reportFailure() {
    if (!failureReported) {
      failureReported = true;
      onFailure(snapshot());
    }
  }

  function armHeartbeatTimer(processHandle) {
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      if (child === processHandle && status === "running") {
        status = "degraded";
        degradedReason = "trusted_sidecar_heartbeat_timeout";
        reportFailure();
        processHandle.kill("SIGTERM");
      }
    }, heartbeatTimeoutMs);
  }

  function snapshot() {
    return {
      registry: SIDECAR_REGISTRY,
      status,
      running: status === "running" && Boolean(child),
      pid: child?.pid ?? null,
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
      mode: "supervised_user_space_ipc_heartbeat",
      sessionManagerOwned: true,
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
      heartbeatAt = message.emittedAt ?? now();
      heartbeatCount = Number.isInteger(message.heartbeatCount)
        ? message.heartbeatCount
        : heartbeatCount + 1;
      degradedReason = null;
      onHeartbeat({ ...message, leaseId: owner.leaseId });
      armHeartbeatTimer(child);
    } else if (message.type === "capture_observation") {
      captureObservation = message.observation ?? null;
      captureFailure = null;
      captureResolver?.();
      captureResolver = null;
    } else if (message.type === "capture_failed") {
      captureFailure = message.reason ?? "capture_failed";
      captureResolver?.();
      captureResolver = null;
    }
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
    if (input.browserRuntimeUrl) {
      const browserUrl = new URL(input.browserRuntimeUrl);
      if (!["127.0.0.1", "localhost"].includes(browserUrl.hostname)) {
        throw new Error("Trusted work-view sidecar capture source must be loopback-only.");
      }
      nextOwner.browserRuntimeUrl = browserUrl.origin;
    }
    if (input.approvalStatus !== "approved") {
      throw new Error("Trusted work-view sidecar requires approved lifecycle authority.");
    }
    if (child && status === "running") {
      if (owner?.taskId !== nextOwner.taskId || owner?.sessionId !== nextOwner.sessionId) {
        throw new Error("A trusted work-view sidecar is already owned by another lifecycle task.");
      }
      return { ...snapshot(), reused: true };
    }

    owner = nextOwner;
    status = "starting";
    startedAt = now();
    stoppedAt = null;
    heartbeatAt = null;
    heartbeatCount = 0;
    exitCode = null;
    exitSignal = null;
    degradedReason = null;
    failureReported = false;
    captureObservation = null;
    captureFailure = null;

    const processHandle = spawnProcess(process.execPath, [sidecarPath.pathname], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: {
        NODE_NO_WARNINGS: "1",
        OPENCLAW_SIDECAR_SESSION_ID: nextOwner.sessionId,
        OPENCLAW_SIDECAR_WORK_VIEW_ID: nextOwner.workViewId,
        OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS: String(heartbeatIntervalMs),
        ...(nextOwner.browserRuntimeUrl
          ? { OPENCLAW_SIDECAR_BROWSER_RUNTIME_URL: nextOwner.browserRuntimeUrl }
          : {}),
      },
    });
    child = processHandle;
    processHandle.on("message", handleMessage);
    processHandle.on("error", (error) => {
      status = "degraded";
      degradedReason = error instanceof Error ? error.message : "sidecar_process_error";
    });
    processHandle.on("exit", (code, signal) => {
      clearHeartbeatTimer();
      exitCode = code;
      exitSignal = signal;
      stoppedAt = now();
      if (status !== "stopping") {
        status = "degraded";
        degradedReason ??= `trusted_sidecar_exited_${code ?? signal ?? "unknown"}`;
        reportFailure();
        child = null;
      } else {
        status = "stopped";
        child = null;
      }
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Trusted work-view sidecar heartbeat timed out.")), startTimeoutMs);
      const onMessage = (message) => {
        if (message?.registry === HEARTBEAT_REGISTRY && message.type === "ready") {
          clearTimeout(timeout);
          processHandle.off("message", onMessage);
          resolve();
        }
      };
      processHandle.on("message", onMessage);
      processHandle.once("error", (error) => {
        clearTimeout(timeout);
        processHandle.off("message", onMessage);
        reject(error);
      });
    }).catch((error) => {
      processHandle.kill("SIGTERM");
      status = "degraded";
      degradedReason = error instanceof Error ? error.message : "sidecar_start_failed";
      throw error;
    });

    if (nextOwner.browserRuntimeUrl && !captureObservation && !captureFailure) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, startTimeoutMs);
        captureResolver = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }
    return { ...snapshot(), reused: false };
  }

  async function stop({ taskId } = {}) {
    if (!child) {
      return { ...snapshot(), stopped: false };
    }
    if (requiredString(taskId, "taskId") !== owner?.taskId) {
      throw new Error("Trusted work-view sidecar lifecycle task mismatch.");
    }
    const processHandle = child;
    status = "stopping";
    clearHeartbeatTimer();
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        processHandle.kill("SIGTERM");
      }, stopTimeoutMs);
      processHandle.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      processHandle.send({ type: "shutdown" });
    });
    return { ...snapshot(), stopped: true };
  }

  function rebindLease({ sessionId, leaseId } = {}) {
    if (!owner) {
      return snapshot();
    }
    if (requiredString(sessionId, "sessionId") !== owner.sessionId) {
      throw new Error("Trusted work-view sidecar session mismatch during lease rebind.");
    }
    owner = {
      ...owner,
      leaseId: requiredString(leaseId, "leaseId"),
    };
    return snapshot();
  }

  return { start, stop, rebindLease, snapshot };
}
