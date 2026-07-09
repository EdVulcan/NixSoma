import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildTrustedWorkViewContract } from "../../../packages/shared-utils/src/work-view-trust.mjs";

const host = process.env.OPENCLAW_SESSION_MANAGER_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SESSION_MANAGER_PORT ?? "4102", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const startDelayMs = Number.parseInt(process.env.OPENCLAW_SESSION_START_DELAY_MS ?? "0", 10);
const defaultWorkViewUrl = process.env.OPENCLAW_WORK_VIEW_URL ?? "https://example.com/work-view";

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
  mode: "background",
  displayTarget: "workspace-2",
  entryUrl: defaultWorkViewUrl,
  activeUrl: null,
  lastOperatorAction: null,
  preparedAt: null,
  lastRevealedAt: null,
  lastHiddenAt: null,
  updatedAt: new Date().toISOString(),
};

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
  const workView = { ...workViewState };
  return {
    ...workView,
    trustedSession: buildTrustedWorkViewContract({
      source: "session-manager",
      trustedComponent: "openclaw-session-manager",
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
    const response = await fetch(`${browserRuntimeUrl}/browser/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? "browser open failed");
    }

    updateWorkViewState({
      helperStatus: "active",
      browserStatus: data.browser?.running ? "running" : "unknown",
      entryUrl: url,
      activeUrl: data.browser?.activeUrl ?? data.tab?.url ?? url,
    });

    return {
      ok: true,
      browser: data.browser ?? null,
      tab: data.tab ?? null,
    };
  } catch (error) {
    updateWorkViewState({
      helperStatus: "degraded",
      browserStatus: "unavailable",
      entryUrl: url,
    });

    return {
      ok: false,
      error: error instanceof Error ? error.message : "browser open failed",
    };
  }
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
  updateWorkViewState({
    status: "prepared",
    visibility: "hidden",
    helperStatus: "active",
    browserStatus: "stopped",
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

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-session-manager listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-session-manager", `http://${host}:${port}`);
  await publishEvent(createEventName("service.started"), {
    service: "openclaw-session-manager",
    url: `http://${host}:${port}`,
  });
});
