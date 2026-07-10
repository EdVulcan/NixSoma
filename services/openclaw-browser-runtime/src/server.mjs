import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";
import { buildTrustedWorkViewContract } from "../../../packages/shared-utils/src/work-view-trust.mjs";


const host = process.env.OPENCLAW_BROWSER_RUNTIME_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_BROWSER_RUNTIME_PORT ?? "4103", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-browser-runtime");

const browserState = {
  running: false,
  browserPid: null,
  profile: "ai-browser-profile",
  activeTitle: null,
  activeUrl: null,
  sessionId: null,
  sessionAuthority: "browser-runtime-local",
  tabs: [],
  lastInput: null,
  lastClick: null,
  updatedAt: new Date().toISOString(),
};

function updateBrowserState(patch) {
  Object.assign(browserState, patch, {
    updatedAt: new Date().toISOString(),
  });
}

function serialiseBrowserState() {
  return {
    ...browserState,
    tabs: browserState.tabs.map((tab) => ({ ...tab })),
  };
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
  return tab;
}

function buildBrowserCapture() {
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
    visibleTextBlocks,
    snapshotText: lines.join("\n"),
    ocrBlocks: [
      { text: "AI-owned work view", confidence: 0.99 },
      { text: activeTitle, confidence: 0.99 },
      { text: activeUrl, confidence: 0.96 },
      { text: `Tabs ${tabs.length}`, confidence: 0.92 },
      ...(browserState.lastInput ? [{ text: browserState.lastInput, confidence: 0.87 }] : []),
    ],
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
      const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "https://example.com";

      if (!browserState.running) {
        updateBrowserState({
          running: true,
          browserPid: Math.floor(Math.random() * 90000) + 10000,
          sessionId: body.sessionId ?? browserState.sessionId ?? `session-${randomUUID()}`,
          sessionAuthority:
            typeof body.sessionAuthority === "string" && body.sessionAuthority.trim()
              ? body.sessionAuthority.trim()
              : browserState.sessionAuthority,
        });
      } else if (typeof body.sessionId === "string" && body.sessionId.trim()) {
        updateBrowserState({
          sessionId: body.sessionId.trim(),
          sessionAuthority:
            typeof body.sessionAuthority === "string" && body.sessionAuthority.trim()
              ? body.sessionAuthority.trim()
              : browserState.sessionAuthority,
        });
      }

      const tab = addTab(url);
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
      const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "https://example.com/docs";
      const tab = addTab(url);
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, tab, action: "new-tab" });
      sendJson(res, 201, { ok: true, browser, tab });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/browser/input") {
    try {
      if (!browserState.running) {
        sendJson(res, 409, { ok: false, error: "Browser runtime is not running." });
        return;
      }

      const body = await readJsonBody(req);
      const text = typeof body.text === "string" ? body.text : "";
      updateBrowserState({
        lastInput: text,
      });
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, action: "input", text });
      sendJson(res, 200, { ok: true, browser, echoedInput: text });
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
      const action = {
        x: typeof body.x === "number" ? body.x : null,
        y: typeof body.y === "number" ? body.y : null,
      };
      updateBrowserState({
        lastClick: action,
      });
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), { browser, action: "click", position: action });
      sendJson(res, 200, { ok: true, browser, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/browser/capture") {
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
      capture: buildBrowserCapture(),
      browser: serialiseBrowserState(),
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-browser-runtime listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-browser-runtime", `http://${host}:${port}`);
  await publishEvent(createEventName("service.started"), {
    service: "openclaw-browser-runtime",
    url: `http://${host}:${port}`,
  });
});
