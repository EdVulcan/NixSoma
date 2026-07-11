import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";
import {
  buildTrustedWorkViewContract,
  normaliseTrustedWorkViewHelperLease,
  validateTrustedWorkViewActionLease,
} from "../../../packages/shared-utils/src/work-view-trust.mjs";
import {
  projectWorkViewVisualFrame,
  unavailableWorkViewVisualFrame,
} from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";
import { normaliseBoundedBrowserUrl } from "./browser-navigation.mjs";
import { createBrowserWorkspaceStore } from "./browser-workspace-store.mjs";
import { createBrowserEngineAdapter } from "./browser-engine-adapter.mjs";


const host = process.env.OPENCLAW_BROWSER_RUNTIME_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_BROWSER_RUNTIME_PORT ?? "4103", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const stateFilePath = process.env.OPENCLAW_BROWSER_RUNTIME_STATE_FILE ?? `/tmp/openclaw-browser-runtime-${port}.json`;
const engineMode = process.env.OPENCLAW_BROWSER_ENGINE_MODE ?? "simulated";
const engineProfileDirectory = process.env.OPENCLAW_BROWSER_PROFILE_DIR ?? `/tmp/openclaw-browser-profile-${port}`;
if (!["firefox", "simulated"].includes(engineMode)) {
  throw new Error(`Unsupported browser engine mode: ${engineMode}.`);
}

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-browser-runtime");

const workspaceStore = createBrowserWorkspaceStore({ stateFilePath });
const restoredWorkspace = workspaceStore.restore();
const restoredIntent = restoredWorkspace.intent?.workspace ?? null;
let browserEngine = null;
const browserState = {
  running: false,
  browserPid: null,
  profile: restoredIntent?.profile ?? "ai-browser-profile",
  activeTitle: restoredIntent?.activeTitle ?? null,
  activeUrl: restoredIntent?.activeUrl ?? null,
  sessionId: restoredIntent?.sessionId ?? null,
  sessionAuthority: restoredIntent?.sessionAuthority ?? "browser-runtime-local",
  trustedHelperLease: null,
  tabs: restoredIntent?.tabs ?? [],
  lastInput: null,
  lastClick: null,
  workspaceRecovery: {
    restored: restoredWorkspace.restored,
    status: restoredWorkspace.status,
    persistedAt: restoredWorkspace.intent?.persistedAt ?? null,
    restoredTabCount: restoredIntent?.tabs?.length ?? 0,
    freshAuthorityBound: false,
    actionAuthorityRestored: false,
    automaticActionReplay: false,
    sensitiveInteractionRestored: false,
  },
  engine: {
    mode: engineMode,
    registry: engineMode === "firefox" ? "openclaw-browser-engine-adapter-v0" : "openclaw-browser-simulated-engine-v0",
    realEngine: false,
    profileEphemeral: engineMode === "firefox",
    desktopWideCapture: false,
    rootRequired: false,
  },
  updatedAt: new Date().toISOString(),
};

if (engineMode === "firefox") {
  browserEngine = createBrowserEngineAdapter({
    executablePath: process.env.OPENCLAW_BROWSER_EXECUTABLE,
    profileDirectory: engineProfileDirectory,
    browserFamily: "firefox",
    onDisconnected() {
      updateBrowserState({
        running: false,
        browserPid: null,
        trustedHelperLease: null,
        engine: { ...browserState.engine, realEngine: false },
      });
    },
  });
}

function updateBrowserState(patch) {
  Object.assign(browserState, patch, {
    updatedAt: new Date().toISOString(),
  });
}

function serialiseBrowserState() {
  return {
    ...browserState,
    trustedHelperLease: browserState.trustedHelperLease
      ? { ...browserState.trustedHelperLease }
      : null,
    tabs: browserState.tabs.map((tab) => ({ ...tab })),
  };
}

function applyEngineSnapshot(snapshot) {
  updateBrowserState({
    running: snapshot.realEngine === true,
    browserPid: snapshot.browserPid,
    activeTitle: snapshot.activeTitle,
    activeUrl: snapshot.activeUrl,
    tabs: snapshot.tabs,
    engine: {
      mode: snapshot.mode,
      registry: snapshot.registry,
      realEngine: snapshot.realEngine,
      profileEphemeral: snapshot.profileEphemeral,
      desktopWideCapture: snapshot.desktopWideCapture,
      rootRequired: snapshot.rootRequired,
    },
  });
}

function validateBrowserActionMediation(body) {
  return validateTrustedWorkViewActionLease({
    candidate: body.trustedHelperLease,
    browserSessionId: browserState.sessionId,
    browserSessionAuthority: browserState.sessionAuthority,
    browserLease: browserState.trustedHelperLease,
  });
}

function titleForUrl(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Session management is passive in browser-runtime


// M-5 Fix: Cap the number of open tabs to prevent unbounded memory growth.
const MAX_TABS = 32;

function addTab(url) {
  const tab = {
    // H-1 Fix: Use randomUUID instead of tabs.length+1 to avoid duplicate IDs
    // if tabs are ever removed in the future.
    id: `tab-${randomUUID()}`,
    url,
    title: titleForUrl(url),
    createdAt: new Date().toISOString(),
  };

  // M-5 Fix: When the tab limit is reached, remove the oldest tab to make room.
  if (browserState.tabs.length >= MAX_TABS) {
    browserState.tabs.shift();
  }

  browserState.tabs.push(tab);
  updateBrowserState({
    activeUrl: tab.url,
    activeTitle: tab.title,
  });
  workspaceStore.persist(browserState);
  return tab;
}

function buildBrowserCapture(visualFrame = unavailableWorkViewVisualFrame("not_captured")) {
  const tabs = Array.isArray(browserState.tabs) ? browserState.tabs : [];
  const activeTitle = browserState.activeTitle ?? "OpenClaw AI Browser";
  const activeUrl = browserState.activeUrl ?? "about:blank";
  const capturedAt = new Date().toISOString();
  const lastInteraction = {
    input: browserState.lastInput,
    click: browserState.lastClick ? { ...browserState.lastClick } : null,
  };
  const visibleTextBlocks = [
    "AI-owned work view",
    activeTitle,
    activeUrl,
    `Tabs ${tabs.length}`,
    ...(browserState.lastInput ? [browserState.lastInput, `Last input: ${browserState.lastInput}`] : []),
    ...(browserState.lastClick
      ? [`Last click: ${browserState.lastClick.x ?? "?"},${browserState.lastClick.y ?? "?"}`]
      : []),
  ];
  const workViewSummary = {
    kind: "browser-work-view-summary",
    title: activeTitle,
    url: activeUrl,
    tabCount: tabs.length,
    visibleTextBlocks,
    recentInteraction: lastInteraction,
    summaryText: `AI work view is focused on ${activeTitle} at ${activeUrl} with ${tabs.length} tab(s).`,
    updatedAt: browserState.updatedAt,
    workspaceRecovery: { ...browserState.workspaceRecovery },
    engine: { ...browserState.engine },
    visualFrame: projectWorkViewVisualFrame(visualFrame, { includeData: false }),
  };
  const trustedSession = buildTrustedWorkViewContract({
    source: "browser-runtime",
    trustedComponent: "openclaw-browser-runtime",
    session: {
      sessionId: browserState.sessionId,
      status: browserState.running ? "running" : "stopped",
      displayTarget: "browser-runtime",
    },
    sessionAuthority: browserState.sessionAuthority,
    authoritativeSessionId: browserState.sessionAuthority === "openclaw-session-manager" ? browserState.sessionId : null,
    componentSessionId: browserState.sessionId,
    browserRuntimeSessionId: browserState.sessionId,
    workView: {
      status: browserState.running ? "ready" : "idle",
      visibility: browserState.running ? "observable" : "hidden",
      mode: "ai-owned-work-view",
      captureStrategy: "browser-runtime-backed",
      helperStatus: browserState.running ? "active" : "idle",
      browserStatus: browserState.running ? "running" : "stopped",
      activeUrl,
      displayTarget: "browser-runtime",
    },
    browser: browserState,
    captureStrategy: "browser-runtime-backed",
    activeUrl,
    capturedAt,
    browserRunning: browserState.running,
    visibleToObserver: true,
  });
  const workView = {
    owner: "openclaw-browser-runtime",
    mode: "ai-owned-work-view",
    visibility: browserState.running ? "observable" : "hidden",
    captureStrategy: "browser-runtime-backed",
    sessionId: browserState.sessionId,
    activeTitle,
    activeUrl,
    tabCount: tabs.length,
    lastInteraction,
    summary: workViewSummary,
    trustedSession,
    updatedAt: browserState.updatedAt,
    engine: { ...browserState.engine },
  };
  const lines = [
    "OpenClaw browser work view",
    "Source: browser-runtime",
    "Capture Strategy: browser-runtime-backed",
    `Trusted Session: ${trustedSession.identityLevel}`,
    `Trusted Boundary: ${trustedSession.boundary.workViewScope}`,
    `Summary: ${workViewSummary.summaryText}`,
    `Session: ${browserState.sessionId ?? "none"}`,
    `Title: ${activeTitle}`,
    `URL: ${activeUrl}`,
    `Tabs: ${tabs.length}`,
  ];

  if (browserState.lastInput) {
    lines.push(`Last Input: ${browserState.lastInput}`);
  }

  if (browserState.lastClick) {
    lines.push(`Last Click: (${browserState.lastClick.x ?? "?"}, ${browserState.lastClick.y ?? "?"})`);
  }

  return {
    source: "browser-runtime",
    capturedAt,
    captureStrategy: "browser-runtime-backed",
    activeTitle,
    activeUrl,
    tabCount: tabs.length,
    tabs: tabs.map((tab) => ({ ...tab })),
    sessionId: browserState.sessionId,
    browserRunning: browserState.running,
    lastInteraction,
    workView,
    workViewSummary,
    trustedSession,
    engine: { ...browserState.engine },
    visualFrame,
    visibleTextBlocks,
    snapshotText: lines.join("\n"),
    ocrBlocks: [
      { text: "AI-owned work view", confidence: 0.99 },
      { text: activeTitle, confidence: 0.99 },
      { text: activeUrl, confidence: 0.96 },
      { text: `Tabs ${tabs.length}`, confidence: 0.92 },
      ...(browserState.lastInput ? [{ text: browserState.lastInput, confidence: 0.87 }] : []),
    ],
    ocrSource: "runtime_state_projection",
    viewport: {
      width: 1280,
      height: 720,
    },
  };
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
      service: "openclaw-browser-runtime",
      stage: "active",
      host,
      port,
      eventHubUrl,
      sessionManagerUrl,
      engineMode,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/browser/state") {
    sendJson(res, 200, {
      ok: true,
      browser: serialiseBrowserState(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/open") {
    try {
      const body = await readJsonBody(req);
      const url = normaliseBoundedBrowserUrl(
        typeof body.url === "string" && body.url.trim() ? body.url.trim() : "https://example.com",
      );
      const requestedSessionId = typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : browserState.sessionId ?? `session-${randomUUID()}`;
      const trustedHelperLease = normaliseTrustedWorkViewHelperLease(body.trustedHelperLease, {
        expectedSessionId: requestedSessionId,
      });
      const sessionChanged = Boolean(browserState.sessionId && browserState.sessionId !== requestedSessionId);
      const restoreUrls = browserState.workspaceRecovery.restored
        ? browserState.tabs.map((tab) => tab.url)
        : [];

      if (!browserState.running) {
        updateBrowserState({
          running: browserEngine ? false : true,
          browserPid: browserEngine ? null : Math.floor(Math.random() * 90000) + 10000,
          sessionId: requestedSessionId,
          sessionAuthority:
            typeof body.sessionAuthority === "string" && body.sessionAuthority.trim()
              ? body.sessionAuthority.trim()
              : browserState.sessionAuthority,
          trustedHelperLease,
        });
      } else if (typeof body.sessionId === "string" && body.sessionId.trim()) {
        updateBrowserState({
          sessionId: body.sessionId.trim(),
          sessionAuthority:
            typeof body.sessionAuthority === "string" && body.sessionAuthority.trim()
              ? body.sessionAuthority.trim()
              : browserState.sessionAuthority,
          trustedHelperLease: trustedHelperLease ?? (sessionChanged ? null : browserState.trustedHelperLease),
        });
      }

      let tab;
      if (browserEngine) {
        applyEngineSnapshot(await browserEngine.open({ url, restoreUrls }));
        tab = browserState.tabs.find((candidate) => candidate.url === browserState.activeUrl) ?? browserState.tabs.at(-1);
      } else {
        tab = addTab(url);
      }
      if (browserState.workspaceRecovery.restored) {
        updateBrowserState({
          workspaceRecovery: {
            ...browserState.workspaceRecovery,
            status: trustedHelperLease
              ? "rebound_after_explicit_prepare"
              : "restored_without_action_authority",
            freshAuthorityBound: Boolean(trustedHelperLease),
            actionAuthorityRestored: false,
            reboundAt: new Date().toISOString(),
          },
        });
      }
      workspaceStore.persist(browserState);
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.started"), { browser, tab });
      sendJson(res, 201, { ok: true, browser, tab });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/new-tab") {
    try {
      if (!browserState.running) {
        sendJson(res, 409, { ok: false, error: "Browser runtime is not running." });
        return;
      }

      const body = await readJsonBody(req);
      const url = normaliseBoundedBrowserUrl(body.url ?? "https://example.com/docs");
      const mediation = validateBrowserActionMediation(body);
      if (!mediation.accepted) {
        sendJson(res, 409, { ok: false, error: mediation.reason, mediation });
        return;
      }
      let tab;
      if (browserEngine) {
        applyEngineSnapshot(await browserEngine.newTab(url));
        workspaceStore.persist(browserState);
        tab = browserState.tabs.find((candidate) => candidate.url === browserState.activeUrl) ?? browserState.tabs.at(-1);
      } else {
        tab = addTab(url);
      }
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, tab, action: "new-tab" });
      sendJson(res, 201, { ok: true, browser, tab, mediation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/trusted-helper-lease") {
    try {
      const body = await readJsonBody(req);
      const sessionId = typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : browserState.sessionId;
      if (!sessionId || (browserState.sessionId && browserState.sessionId !== sessionId)) {
        sendJson(res, 409, { ok: false, error: "Browser runtime helper lease session mismatch." });
        return;
      }
      const trustedHelperLease = normaliseTrustedWorkViewHelperLease(body.trustedHelperLease, {
        expectedSessionId: sessionId,
      });
      if (!trustedHelperLease) {
        sendJson(res, 400, { ok: false, error: "Browser runtime requires a trusted helper lease." });
        return;
      }
      updateBrowserState({
        sessionId,
        sessionAuthority: "openclaw-session-manager",
        trustedHelperLease,
        workspaceRecovery: browserState.workspaceRecovery.restored ? {
          ...browserState.workspaceRecovery,
          status: "rebound_after_explicit_prepare",
          freshAuthorityBound: true,
          actionAuthorityRestored: false,
          reboundAt: new Date().toISOString(),
        } : browserState.workspaceRecovery,
      });
      workspaceStore.persist(browserState);
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), {
        browser,
        action: "trusted-helper-lease-rebound",
        actionAuthority: trustedHelperLease.actionAuthority,
      });
      sendJson(res, 200, { ok: true, browser, trustedHelperLease });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/trusted-helper-lease/revoke") {
    if (browserState.sessionAuthority !== "openclaw-session-manager" || !browserState.trustedHelperLease) {
      sendJson(res, 200, { ok: true, revoked: false, browser: serialiseBrowserState() });
      return;
    }
    updateBrowserState({
      trustedHelperLease: {
        ...browserState.trustedHelperLease,
        actionAuthority: "suspended",
        suspendedAt: new Date().toISOString(),
        suspensionReason: "session_manager_recovery_required",
      },
    });
    sendJson(res, 200, { ok: true, revoked: true, browser: serialiseBrowserState() });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/input") {
    try {
      if (!browserState.running) {
        sendJson(res, 409, { ok: false, error: "Browser runtime is not running." });
        return;
      }

      const body = await readJsonBody(req);
      const mediation = validateBrowserActionMediation(body);
      if (!mediation.accepted) {
        sendJson(res, 409, { ok: false, error: mediation.reason, mediation });
        return;
      }
      const text = typeof body.text === "string" ? body.text : "";
      if (browserEngine) applyEngineSnapshot(await browserEngine.type(text));
      updateBrowserState({
        lastInput: text,
      });
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, action: "input", text });
      sendJson(res, 200, { ok: true, browser, echoedInput: text, mediation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/click") {
    try {
      if (!browserState.running) {
        sendJson(res, 409, { ok: false, error: "Browser runtime is not running." });
        return;
      }

      const body = await readJsonBody(req);
      const mediation = validateBrowserActionMediation(body);
      if (!mediation.accepted) {
        sendJson(res, 409, { ok: false, error: mediation.reason, mediation });
        return;
      }
      const action = {
        x: typeof body.x === "number" ? body.x : null,
        y: typeof body.y === "number" ? body.y : null,
      };
      if (browserEngine) applyEngineSnapshot(await browserEngine.click(action));
      updateBrowserState({
        lastClick: action,
      });
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, action: "click", position: action });
      sendJson(res, 200, { ok: true, browser, action, mediation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/browser/capture") {
    const visualMode = requestUrl.searchParams.get("visual") ?? "full";
    if (!["full", "metadata"].includes(visualMode)) {
      sendJson(res, 400, { ok: false, error: "Browser capture visual mode must be full or metadata." });
      return;
    }
    let visualFrame = unavailableWorkViewVisualFrame(engineMode === "simulated" ? "simulated_engine" : "browser_not_running");
    if (browserEngine && browserState.running) {
      applyEngineSnapshot(await browserEngine.snapshot());
      try {
        visualFrame = visualMode === "full"
          ? await browserEngine.captureVisualFrame({ includeData: true })
          : browserEngine.visualFrameMetadata();
      } catch {
        visualFrame = unavailableWorkViewVisualFrame("visual_capture_failed");
      }
    }
    if (!browserState.running) {
      sendJson(res, 200, {
        ok: true,
        running: false,
        capture: null,
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      running: true,
      capture: buildBrowserCapture(visualFrame),
      browser: serialiseBrowserState(),
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

async function shutdown() {
  await browserEngine?.close();
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

server.listen(port, host, async () => {
  console.log(`openclaw-browser-runtime listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-browser-runtime", `http://${host}:${port}`);
  await publishEvent(createEventName("service.started"), {
    service: "openclaw-browser-runtime",
    url: `http://${host}:${port}`,
  });
});
