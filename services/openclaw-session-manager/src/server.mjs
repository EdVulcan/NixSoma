import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildTrustedWorkViewContract } from "../../../packages/shared-utils/src/work-view-trust.mjs";
import { createTrustedWorkViewHelperRuntime } from "./trusted-work-view-helper-runtime.mjs";
import { createTrustedWorkViewSidecarSupervisor } from "./trusted-work-view-sidecar-supervisor.mjs";
import { createTrustedWorkViewSidecarRecoveryStore } from "./trusted-work-view-sidecar-recovery-store.mjs";

const host = process.env.OPENCLAW_SESSION_MANAGER_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SESSION_MANAGER_PORT ?? "4102", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const startDelayMs = Number.parseInt(process.env.OPENCLAW_SESSION_START_DELAY_MS ?? "0", 10);
const defaultWorkViewUrl = process.env.OPENCLAW_WORK_VIEW_URL ?? "https://example.com/work-view";
const stateFilePath = process.env.OPENCLAW_SESSION_MANAGER_STATE_FILE ?? `/tmp/openclaw-session-manager-${port}.json`;
const trustedWorkViewHelperRuntime = createTrustedWorkViewHelperRuntime();

const sessionState = {
  sessionId: null,
  status: "stopped",
  displayTarget: "workspace-2",
  role: "ai-work-view",
  createdAt: null,
  updatedAt: new Date().toISOString(),
};

const workViewState = {
  workViewId: "work-view-primary",
  status: "idle",
  visibility: "hidden",
  captureStrategy: "browser-runtime",
  helperStatus: "idle",
  browserStatus: "stopped",
  browserSessionId: null,
  mode: "background",
  displayTarget: "workspace-2",
  entryUrl: defaultWorkViewUrl,
  activeUrl: null,
  lastOperatorAction: null,
  lastSidecarFailure: null,
  preparedAt: null,
  lastRevealedAt: null,
  lastHiddenAt: null,
  updatedAt: new Date().toISOString(),
};
const sidecarRecoveryStore = createTrustedWorkViewSidecarRecoveryStore({ stateFilePath });
let sidecarLifecycleIntent = sidecarRecoveryStore.snapshot();
const trustedWorkViewSidecarSupervisor = createTrustedWorkViewSidecarSupervisor({
  onHeartbeat(message) {
    const helperRuntime = trustedWorkViewHelperRuntime.snapshot();
    if (
      message.sessionId === sessionState.sessionId
      && message.leaseId === helperRuntime.leaseId
    ) {
      trustedWorkViewHelperRuntime.heartbeat({
        sessionId: sessionState.sessionId,
        visibility: workViewState.visibility,
        action: "trusted_sidecar_heartbeat",
      });
    }
  },
  onFailure(failure) {
    handleTrustedSidecarFailure(failure).catch(() => {});
  },
});

import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";



function serialiseSessionState() {
  return { ...sessionState };
}

function updateSessionState(patch) {
  Object.assign(sessionState, patch, {
    updatedAt: new Date().toISOString(),
  });
}

function serialiseWorkViewState() {
  const supervisedSidecar = trustedWorkViewSidecarSupervisor.snapshot();
  const sidecar = !supervisedSidecar.taskId && sidecarLifecycleIntent?.taskId
    ? {
        ...supervisedSidecar,
        taskId: sidecarLifecycleIntent.taskId,
        approvalId: sidecarLifecycleIntent.approvalId ?? null,
        status: sidecarLifecycleIntent.status,
        recoveryRequired: sidecarLifecycleIntent.status === "recovery_required",
        automaticRestart: false,
      }
    : supervisedSidecar;
  const helperRuntime = {
    ...trustedWorkViewHelperRuntime.snapshot(),
    externalProcessStarted: sidecar.running,
    sidecar,
  };
  const workView = { ...workViewState, helperRuntime, trustedSidecar: sidecar };
  return {
    ...workView,
    trustedSession: buildTrustedWorkViewContract({
      source: "session-manager",
      trustedComponent: "openclaw-session-manager",
      sessionAuthority: "openclaw-session-manager",
      authoritativeSessionId: sessionState.sessionId,
      componentSessionId: sessionState.sessionId,
      browserRuntimeSessionId: workView.browserSessionId,
      helperRuntime,
      session: sessionState,
      workView,
      captureStrategy: workView.captureStrategy,
      browserRunning: workView.browserStatus === "running",
      visibleToObserver: true,
    }),
  };
}

function updateWorkViewState(patch) {
  Object.assign(workViewState, patch, {
    updatedAt: new Date().toISOString(),
  });
}

function workViewActionSnapshot(source = workViewState) {
  return {
    status: source.status ?? null,
    visibility: source.visibility ?? null,
    mode: source.mode ?? null,
    helperStatus: source.helperStatus ?? null,
    browserStatus: source.browserStatus ?? null,
    displayTarget: source.displayTarget ?? null,
    activeUrl: source.activeUrl ?? null,
  };
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordWorkViewOperatorAction(action, metadata = {}) {
  updateWorkViewState({
    lastOperatorAction: {
      action,
      source: stringOrNull(metadata.source) ?? "direct_endpoint",
      recommendedAction: stringOrNull(metadata.recommendedAction),
      endpoint: stringOrNull(metadata.endpoint),
      previous: metadata.previous ?? null,
      next: workViewActionSnapshot(),
      rootRequired: false,
      hostMutation: false,
      operatorVisible: true,
      invokedAt: new Date().toISOString(),
    },
  });
}

// L-3 Fix: Both /session/state and /work-view/state return identical payloads.
// Extract a shared builder to keep them consistent and DRY.
function buildStateResponse() {
  const workView = serialiseWorkViewState();
  return {
    ok: true,
    session: serialiseSessionState(),
    workView,
    trustedSession: workView.trustedSession,
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-session-manager");


async function ensureBrowserWorkView(url = workViewState.entryUrl || defaultWorkViewUrl) {
  try {
    trustedWorkViewHelperRuntime.heartbeat({
      sessionId: sessionState.sessionId,
      visibility: workViewState.visibility,
      action: "ensure_browser_work_view",
    });
    const response = await fetch(`${browserRuntimeUrl}/browser/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        sessionId: sessionState.sessionId,
        sessionAuthority: "openclaw-session-manager",
        trustedHelperLease: trustedWorkViewHelperRuntime.leaseEnvelope(),
      }),
    });
    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? "browser open failed");
    }
    const helperRuntime = trustedWorkViewHelperRuntime.observeBrowserLease({
      sessionId: data.browser?.sessionId,
      trustedHelperLease: data.browser?.trustedHelperLease,
    });

    updateWorkViewState({
      helperStatus: helperRuntime.status === "active" ? "active" : "degraded",
      browserStatus: data.browser?.running ? "running" : "unknown",
      browserSessionId: data.browser?.sessionId ?? null,
      entryUrl: url,
      activeUrl: data.browser?.activeUrl ?? data.tab?.url ?? url,
    });

    return {
      ok: true,
      browser: data.browser ?? null,
      tab: data.tab ?? null,
    };
  } catch (error) {
    trustedWorkViewHelperRuntime.markDegraded(error instanceof Error ? error.message : "browser open failed");
    updateWorkViewState({
      helperStatus: "degraded",
      browserStatus: "unavailable",
      browserSessionId: null,
      entryUrl: url,
    });

    return {
      ok: false,
      error: error instanceof Error ? error.message : "browser open failed",
    };
  }
}

async function syncBrowserHelperLease() {
  const trustedHelperLease = trustedWorkViewHelperRuntime.leaseEnvelope();
  if (!trustedHelperLease) {
    return { ok: true, synced: false, browser: null };
  }
  const response = await fetch(`${browserRuntimeUrl}/browser/trusted-helper-lease`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: sessionState.sessionId,
      trustedHelperLease,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error ?? "browser helper lease sync failed");
  }
  const helperRuntime = trustedWorkViewHelperRuntime.observeBrowserLease({
    sessionId: data.browser?.sessionId,
    trustedHelperLease: data.browser?.trustedHelperLease,
  });
  updateWorkViewState({
    helperStatus: helperRuntime.status,
    browserStatus: data.browser?.running ? "running" : workViewState.browserStatus,
    browserSessionId: data.browser?.sessionId ?? workViewState.browserSessionId,
  });
  return { ok: true, synced: true, browser: data.browser ?? null, helperRuntime };
}

async function suspendHelperActionAuthority(reason) {
  const helperRuntime = trustedWorkViewHelperRuntime.suspend({
    sessionId: sessionState.sessionId,
    reason,
  });
  if (!helperRuntime.leaseId) {
    return { ok: true, synced: false, helperRuntime };
  }
  const sync = await syncBrowserHelperLease();
  updateWorkViewState({
    helperStatus: "suspended",
  });
  return { ...sync, helperRuntime: trustedWorkViewHelperRuntime.snapshot() };
}

async function handleTrustedSidecarFailure(failure) {
  const previous = workViewActionSnapshot();
  trustedWorkViewHelperRuntime.suspend({
    sessionId: sessionState.sessionId,
    reason: failure.degradedReason ?? "trusted_sidecar_failure",
  });
  updateWorkViewState({
    helperStatus: "suspended",
    lastSidecarFailure: {
      status: failure.status,
      reason: failure.degradedReason ?? "trusted_sidecar_failure",
      pid: failure.pid ?? null,
      taskId: failure.taskId ?? null,
      heartbeatAt: failure.heartbeatAt ?? null,
      detectedAt: new Date().toISOString(),
      automaticRestart: false,
      recoveryAction: "restart_approved_trusted_sidecar",
      previous,
    },
  });
  sidecarLifecycleIntent = sidecarRecoveryStore.record({
    taskId: failure.taskId,
    approvalId: failure.approvalId,
    status: "recovery_required",
  });
  try {
    await syncBrowserHelperLease();
  } catch (error) {
    trustedWorkViewHelperRuntime.markDegraded(error instanceof Error ? error.message : "sidecar failure lease sync failed");
  }
}

async function resumeHelperActionAuthority(reason) {
  const previousLeaseId = trustedWorkViewHelperRuntime.snapshot().leaseId;
  const helperRuntime = trustedWorkViewHelperRuntime.rebind({
    sessionId: sessionState.sessionId,
    reason,
  });
  if (!helperRuntime.leaseId) {
    return { ok: true, synced: false, previousLeaseId, helperRuntime };
  }
  trustedWorkViewSidecarSupervisor.rebindLease({
    sessionId: sessionState.sessionId,
    leaseId: helperRuntime.leaseId,
  });
  const sync = await syncBrowserHelperLease();
  updateWorkViewState({
    helperStatus: "active",
  });
  return {
    ...sync,
    previousLeaseId,
    rebound: previousLeaseId !== trustedWorkViewHelperRuntime.snapshot().leaseId,
    helperRuntime: trustedWorkViewHelperRuntime.snapshot(),
  };
}

async function startSession(displayTarget) {
  if (startDelayMs > 0) {
    await sleep(startDelayMs);
  }

  const now = new Date().toISOString();
  updateSessionState({
    sessionId: randomUUID(),
    status: "running",
    displayTarget,
    createdAt: now,
  });
  trustedWorkViewHelperRuntime.start({
    sessionId: sessionState.sessionId,
    workViewId: workViewState.workViewId,
    displayTarget,
  });
  updateWorkViewState({
    status: "prepared",
    visibility: "hidden",
    helperStatus: "active",
    browserStatus: "stopped",
    browserSessionId: null,
    displayTarget,
    preparedAt: workViewState.preparedAt ?? now,
    mode: "background",
  });
}

async function prepareWorkView(displayTarget, entryUrl = workViewState.entryUrl || defaultWorkViewUrl) {
  if (sessionState.status !== "running" || !sessionState.sessionId) {
    await startSession(displayTarget);
  } else {
    updateWorkViewState({
      status: "prepared",
      visibility: "hidden",
      helperStatus: "active",
      displayTarget,
      entryUrl,
      preparedAt: workViewState.preparedAt ?? new Date().toISOString(),
      mode: "background",
    });
  }

  return ensureBrowserWorkView(entryUrl);
}

async function revealWorkView(entryUrl = workViewState.entryUrl || defaultWorkViewUrl) {
  const browser = await ensureBrowserWorkView(entryUrl);
  updateWorkViewState({
    visibility: "visible",
    status: "ready",
    helperStatus: browser.ok ? "active" : "degraded",
    browserStatus: browser.browser?.running ? "running" : workViewState.browserStatus,
    entryUrl,
    activeUrl: browser.browser?.activeUrl ?? browser.tab?.url ?? entryUrl,
    lastRevealedAt: new Date().toISOString(),
    mode: "foreground-observable",
  });

  return browser;
}

function hideWorkView() {
  trustedWorkViewHelperRuntime.heartbeat({
    sessionId: sessionState.sessionId,
    visibility: "hidden",
    action: "hide_work_view",
  });
  updateWorkViewState({
    status: "prepared",
    visibility: "hidden",
    helperStatus: "active",
    lastHiddenAt: new Date().toISOString(),
    mode: "background",
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "openclaw-session-manager",
      stage: "active",
      host,
      port,
      eventHubUrl,
      browserRuntimeUrl,
      startDelayMs,
      defaultWorkViewUrl,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/session/state") {
    // L-3 Fix: Use shared builder so both routes stay in sync.
    sendJson(res, 200, buildStateResponse());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/work-view/state") {
    // L-3 Fix: Use shared builder so both routes stay in sync.
    sendJson(res, 200, buildStateResponse());
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/session/start") {
    try {
      const body = await readJsonBody(req);
      const displayTarget =
        typeof body.displayTarget === "string" && body.displayTarget.trim()
          ? body.displayTarget.trim()
          : "workspace-2";

      if (sessionState.status === "running") {
        sendJson(res, 200, {
          ok: true,
          reused: true,
          session: serialiseSessionState(),
          workView: serialiseWorkViewState(),
        });
        return;
      }

      await startSession(displayTarget);
      const session = serialiseSessionState();
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("service.started"), {
        service: "openclaw-session-manager",
        session,
        workView,
      });
      sendJson(res, 201, { ok: true, reused: false, session, workView });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/session/restart") {
    try {
      const body = await readJsonBody(req);
      const displayTarget =
        typeof body.displayTarget === "string" && body.displayTarget.trim()
          ? body.displayTarget.trim()
          : sessionState.displayTarget;

      await startSession(displayTarget);
      const session = serialiseSessionState();
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("service.started"), {
        service: "openclaw-session-manager",
        restarted: true,
        session,
        workView,
      });
      sendJson(res, 200, { ok: true, restarted: true, session, workView });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/prepare") {
    try {
      const body = await readJsonBody(req);
      const displayTarget =
        typeof body.displayTarget === "string" && body.displayTarget.trim()
          ? body.displayTarget.trim()
          : workViewState.displayTarget;
      const entryUrl =
        typeof body.entryUrl === "string" && body.entryUrl.trim()
          ? body.entryUrl.trim()
          : workViewState.entryUrl;

      const previous = workViewActionSnapshot();
      const browser = await prepareWorkView(displayTarget, entryUrl);
      recordWorkViewOperatorAction("prepare_work_view", {
        source: body.operatorActionSource,
        recommendedAction: body.recommendedAction,
        endpoint: "/work-view/prepare",
        previous,
      });
      const session = serialiseSessionState();
      const workView = serialiseWorkViewState();
      // M-1 Fix: Use screen.updated instead of service.started for work-view
      // state transitions so event subscribers can distinguish them.
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "work-view-prepared",
        session,
        workView,
        browser,
      });
      sendJson(res, 200, { ok: true, session, workView, browser });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/reveal") {
    try {
      const body = await readJsonBody(req);
      const entryUrl =
        typeof body.entryUrl === "string" && body.entryUrl.trim()
          ? body.entryUrl.trim()
          : workViewState.entryUrl;

      if (sessionState.status !== "running" || !sessionState.sessionId) {
        await prepareWorkView(workViewState.displayTarget, entryUrl);
      }

      const previous = workViewActionSnapshot();
      const browser = await revealWorkView(entryUrl);
      recordWorkViewOperatorAction("reveal_work_view", {
        source: body.operatorActionSource,
        recommendedAction: body.recommendedAction,
        endpoint: "/work-view/reveal",
        previous,
      });
      const session = serialiseSessionState();
      const workView = serialiseWorkViewState();
      // M-1 Fix: Use screen.updated for visibility change events.
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "work-view-revealed",
        session,
        workView,
        browser,
      });
      sendJson(res, 200, { ok: true, session, workView, browser });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/hide") {
    try {
      const body = await readJsonBody(req);
      const previous = workViewActionSnapshot();
      hideWorkView();
      recordWorkViewOperatorAction("hide_work_view", {
        source: body.operatorActionSource,
        recommendedAction: body.recommendedAction,
        endpoint: "/work-view/hide",
        previous,
      });
      const session = serialiseSessionState();
      const workView = serialiseWorkViewState();
      // M-1 Fix: Use screen.updated for visibility change events.
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "work-view-hidden",
        session,
        workView,
      });
      sendJson(res, 200, { ok: true, session, workView });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/helper-authority/suspend") {
    try {
      const body = await readJsonBody(req);
      const previous = workViewActionSnapshot();
      const authority = await suspendHelperActionAuthority(
        stringOrNull(body.reason) ?? "operator_takeover",
      );
      recordWorkViewOperatorAction("suspend_helper_action_authority", {
        source: body.operatorActionSource,
        endpoint: "/work-view/helper-authority/suspend",
        previous,
      });
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "helper-action-authority-suspended",
        workView,
      });
      sendJson(res, 200, { ok: true, authority, session: serialiseSessionState(), workView });
    } catch (error) {
      trustedWorkViewHelperRuntime.markDegraded(error instanceof Error ? error.message : "helper authority suspend failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 409, { ok: false, error: message, workView: serialiseWorkViewState() });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/helper-authority/resume") {
    try {
      const body = await readJsonBody(req);
      const previous = workViewActionSnapshot();
      const authority = await resumeHelperActionAuthority(
        stringOrNull(body.reason) ?? "operator_resume",
      );
      recordWorkViewOperatorAction("resume_helper_action_authority", {
        source: body.operatorActionSource,
        endpoint: "/work-view/helper-authority/resume",
        previous,
      });
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "helper-action-authority-resumed",
        workView,
      });
      sendJson(res, 200, { ok: true, authority, session: serialiseSessionState(), workView });
    } catch (error) {
      trustedWorkViewHelperRuntime.markDegraded(error instanceof Error ? error.message : "helper authority resume failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 409, { ok: false, error: message, workView: serialiseWorkViewState() });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/trusted-sidecar/start") {
    try {
      const body = await readJsonBody(req);
      const helperRuntime = trustedWorkViewHelperRuntime.snapshot();
      if (!helperRuntime.leaseId || helperRuntime.status === "inactive") {
        sendJson(res, 409, { ok: false, error: "Trusted work-view helper lease is not active." });
        return;
      }
      const sidecar = await trustedWorkViewSidecarSupervisor.start({
        sessionId: sessionState.sessionId,
        workViewId: workViewState.workViewId,
        leaseId: helperRuntime.leaseId,
        taskId: body.taskId,
        approvalId: body.approvalId,
        approvalStatus: body.approvalStatus,
        browserRuntimeUrl,
      });
      sidecarLifecycleIntent = sidecarRecoveryStore.record({
        taskId: body.taskId,
        approvalId: body.approvalId,
        status: "running",
      });
      let authority = null;
      if (trustedWorkViewHelperRuntime.snapshot().actionAuthority === "suspended") {
        authority = await resumeHelperActionAuthority("approved_trusted_sidecar_restart");
      }
      updateWorkViewState({ helperStatus: trustedWorkViewHelperRuntime.snapshot().status });
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "trusted-sidecar-started",
        workView,
      });
      sendJson(res, 200, { ok: true, sidecar, authority, session: serialiseSessionState(), workView });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 409, { ok: false, error: message, workView: serialiseWorkViewState() });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/trusted-sidecar/stop") {
    try {
      const body = await readJsonBody(req);
      const sidecar = await trustedWorkViewSidecarSupervisor.stop({ taskId: body.taskId });
      sidecarLifecycleIntent = sidecarRecoveryStore.record({
        taskId: body.taskId,
        approvalId: sidecarLifecycleIntent?.approvalId ?? null,
        status: "stopped",
      });
      const authority = await suspendHelperActionAuthority("trusted_sidecar_stopped");
      const workView = serialiseWorkViewState();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "trusted-sidecar-stopped",
        workView,
      });
      sendJson(res, 200, { ok: true, sidecar, authority, session: serialiseSessionState(), workView });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 409, { ok: false, error: message, workView: serialiseWorkViewState() });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/work-view/trusted-sidecar/action") {
    try {
      const body = await readJsonBody(req);
      const result = await trustedWorkViewSidecarSupervisor.executeBrowserAction({
        kind: body.kind,
        payload: body.payload ?? {},
        trustedHelperLease: body.trustedHelperLease,
      });
      sendJson(res, result.ok ? 200 : 409, {
        ok: result.ok,
        transport: "trusted-sidecar-ipc",
        mediation: result.mediation ?? { accepted: false, reason: result.reason },
        effect: result.effect ?? null,
        error: result.ok ? null : result.reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 409, { ok: false, error: message, transport: "trusted-sidecar-ipc" });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

async function revokeStaleBrowserLeaseBeforeRecovery() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${browserRuntimeUrl}/browser/trusted-helper-lease/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) {
        return;
      }
    } catch {
      // Browser runtime may still be starting alongside session-manager.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Unable to revoke stale browser helper lease during sidecar recovery.");
}

async function startSessionManager() {
  if (sidecarLifecycleIntent?.status === "recovery_required") {
    await revokeStaleBrowserLeaseBeforeRecovery();
  }
  server.listen(port, host, async () => {
    console.log(`openclaw-session-manager listening on http://${host}:${port}`);
    await registerService(eventHubUrl, "openclaw-session-manager", `http://${host}:${port}`);
    await publishEvent(createEventName("service.started"), {
      service: "openclaw-session-manager",
      url: `http://${host}:${port}`,
    });
  });
}

startSessionManager().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
