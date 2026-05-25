import http from "node:http";
import { randomUUID } from "node:crypto";
import { readCaptureAdapter } from "./capture-adapter.mjs";

const host = process.env.OPENCLAW_SCREEN_SENSE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SCREEN_SENSE_PORT ?? "4104", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const stateWaitMs = Number.parseInt(process.env.OPENCLAW_SCREEN_STATE_WAIT_MS ?? "1500", 10);
const statePollMs = Number.parseInt(process.env.OPENCLAW_SCREEN_STATE_POLL_MS ?? "100", 10);

const screenState = {
  captureId: `capture-${randomUUID()}`,
  timestamp: new Date().toISOString(),
  snapshotPath: "/mock/snapshots/current-frame.txt",
  snapshotText:
    "OpenClaw screen-sense placeholder frame\nAI work view is not yet connected to a real compositor.",
  focusedWindow: {
    title: "OpenClaw AI Work View",
    pid: 4103,
  },
  windowList: [
    { title: "OpenClaw AI Work View", pid: 4103 },
    { title: "Observer UI", pid: 4170 },
  ],
  ocrBlocks: [
    { text: "OpenClaw AI Work View", confidence: 0.99 },
    { text: "Placeholder frame", confidence: 0.97 },
  ],
  summary: "Placeholder screen state for the AI work view.",
  sessionId: null,
  readiness: "warming_up",
  captureSource: "browser",
  captureStrategy: "browser-state-derived",
  captureMetadata: null,
  workView: null,
  workViewSummary: null,
};

import { corsHeaders, sendJson, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";


const publishEvent = createEventPublisher(eventHubUrl, "openclaw-screen-sense");


function updateScreenState(patch) {
  Object.assign(screenState, patch, {
    captureId: `capture-${randomUUID()}`,
    timestamp: new Date().toISOString(),
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeReadiness({ session, browser, browserCapture, degraded }) {
  if (degraded) {
    return "degraded";
  }

  if (browserCapture?.snapshotText || browserCapture?.focusedWindow) {
    return "ready";
  }

  if (browser?.running && !session?.sessionId) {
    return "warming_up";
  }

  if (session?.status === "running" || browser?.running) {
    return "ready";
  }

  return "warming_up";
}

function deriveScreenPatch({ session, browser, browserCapture, degraded }) {
  const tabs = Array.isArray(browser?.tabs) ? browser.tabs : [];
  const browserWindowReady = Boolean(browser?.running && session?.sessionId);
  const browserFocusedTitle =
    browser?.running && tabs.length > 0
      ? browser?.activeTitle ?? tabs.at(-1)?.title ?? "OpenClaw AI Browser"
      : "OpenClaw AI Work View";
  const activeTitle = browserWindowReady ? browserFocusedTitle : "OpenClaw AI Work View";
  const activeUrl = browser?.running && tabs.length > 0 ? browser?.activeUrl ?? tabs.at(-1)?.url ?? "about:blank" : "about:blank";
  const readiness = computeReadiness({ session, browser, browserCapture, degraded });
  const captureStrategy =
    browserCapture?.captureStrategy ??
    browserCapture?.workView?.captureStrategy ??
    (browserCapture ? "browser-runtime-backed" : "browser-state-derived");
  const captureSource = browserCapture?.source ?? "browser";
  const workView =
    browserCapture?.workView ??
    (browser?.running
      ? {
          owner: "openclaw-screen-sense",
          mode: "ai-owned-work-view",
          visibility: browserWindowReady ? "observable" : "warming_up",
          captureStrategy,
          sessionId: session?.sessionId ?? browser?.sessionId ?? null,
          activeTitle,
          activeUrl,
          tabCount: tabs.length,
          updatedAt: browser?.updatedAt ?? null,
        }
      : null);
  const captureMetadata = {
    source: captureSource,
    strategy: captureStrategy,
    capturedAt: browserCapture?.capturedAt ?? null,
    activeTitle: browserCapture?.activeTitle ?? activeTitle,
    activeUrl: browserCapture?.activeUrl ?? activeUrl,
    tabCount: typeof browserCapture?.tabCount === "number" ? browserCapture.tabCount : tabs.length,
    sessionId: browserCapture?.sessionId ?? session?.sessionId ?? browser?.sessionId ?? null,
    browserRunning: Boolean(browserCapture?.browserRunning ?? browser?.running),
    lastInteraction: browserCapture?.lastInteraction ?? {
      input: browser?.lastInput ?? null,
      click: browser?.lastClick ?? null,
    },
  };
  const visibleTextBlocks =
    browserCapture?.workViewSummary?.visibleTextBlocks ??
    browserCapture?.visibleTextBlocks ??
    (browser?.running
      ? [
          "AI-owned work view",
          activeTitle,
          activeUrl,
          `Tabs ${tabs.length}`,
          ...(browser?.lastInput ? [browser.lastInput, `Last input: ${browser.lastInput}`] : []),
        ]
      : ["OpenClaw AI Work View", readiness === "warming_up" ? "Warming up" : "No active work view"]);
  const workViewSummary = browserCapture?.workViewSummary ?? {
    kind: "screen-sense-work-view-summary",
    title: activeTitle,
    url: activeUrl,
    tabCount: tabs.length,
    visibleTextBlocks,
    recentInteraction: captureMetadata.lastInteraction,
    summaryText:
      readiness === "ready"
        ? `AI work view is focused on ${activeTitle} at ${activeUrl} with ${tabs.length} tab(s).`
        : `AI work view is ${readiness}.`,
    updatedAt: browser?.updatedAt ?? null,
  };
  const snapshotText =
    browserCapture?.snapshotText ??
    [
      "OpenClaw screen frame",
      `Summary: ${workViewSummary.summaryText}`,
      `Session: ${session?.sessionId ?? "none"}`,
      `Display: ${session?.displayTarget ?? "unknown"}`,
      `Active Title: ${activeTitle}`,
      `Active URL: ${activeUrl}`,
      `Open Tabs: ${tabs.length}`,
      `Readiness: ${readiness}`,
    ].join("\n");
  const ocrBlocks = browserCapture?.ocrBlocks
    ?? (browser?.running && tabs.length > 0
      ? [
          { text: browserFocusedTitle, confidence: 0.99 },
          { text: activeUrl, confidence: 0.95 },
          { text: `Tabs ${tabs.length}`, confidence: 0.9 },
        ]
      : [
          { text: "OpenClaw AI Work View", confidence: 0.99 },
          { text: readiness === "warming_up" ? "Warming up" : "Placeholder frame", confidence: 0.97 },
        ]);

  let summary;
  if (readiness === "degraded") {
    summary = "AI work view state settling. Returning best-effort screen state while browser/session sync finishes.";
  } else if (browserCapture?.source) {
    summary = `AI work view is using external capture source ${browserCapture.source}.`;
  } else if (readiness === "warming_up") {
    summary = "AI work view is warming up. Waiting for browser/session state to settle.";
  } else if (session?.status === "running") {
    summary = `AI work view attached to ${session.displayTarget} with ${tabs.length} browser tab(s).`;
  } else {
    summary = "AI work view is not currently running.";
  }

  return {
    sessionId: session?.sessionId ?? null,
    readiness,
    captureSource,
    captureStrategy,
    captureMetadata,
    workView,
    workViewSummary,
    snapshotPath: browserCapture?.snapshotPath ?? screenState.snapshotPath,
    snapshotText,
    focusedWindow:
      browserCapture?.focusedWindow ??
      (session?.status === "running" || browser?.running
        ? {
            title: activeTitle,
            pid: browser?.browserPid ?? 4103,
          }
        : null),
    windowList:
      browserCapture?.windowList ??
      (session?.status === "running" || browser?.running
        ? [
            { title: activeTitle, pid: browser?.browserPid ?? 4103 },
            { title: "Observer UI", pid: 4170 },
          ]
        : [{ title: "Observer UI", pid: 4170 }]),
    ocrBlocks,
    summary,
  };
}

async function readUpstreamState() {
  // M-7 Fix: Added .catch(() => null) to the sessionManager fetch, matching
  // the browserRuntime fetch. Without this, an unreachable session-manager
  // caused an unhandled exception instead of a graceful degradation.
  const [sessionResponse, browserResponse] = await Promise.all([
    fetch(`${sessionManagerUrl}/session/state`).catch(() => null),
    fetch(`${browserRuntimeUrl}/browser/state`).catch(() => null),
  ]);

  const sessionData = sessionResponse ? await sessionResponse.json().catch(() => null) : null;
  const session = sessionData?.session ?? null;
  const browserData = browserResponse ? await browserResponse.json().catch(() => null) : null;
  const browser = browserData?.browser ?? null;
  const adapter = await readCaptureAdapter(async () => {
    const browserCaptureResponse = await fetch(`${browserRuntimeUrl}/browser/capture`).catch(() => null);
    const browserCaptureData = browserCaptureResponse ? await browserCaptureResponse.json() : null;
    return browserCaptureData?.capture ?? null;
  });
  return { session, browser, browserCapture: adapter.capture, captureAdapter: adapter.adapter };
}

async function collectStableScreenState() {
  const deadline = Date.now() + stateWaitMs;
  let latest = {
    session: null,
    browser: null,
  };

  try {
    while (Date.now() <= deadline) {
      latest = await readUpstreamState();

      // M-5 Fix: The original condition was `!(latest.browser?.running) || latest.session?.sessionId`.
      // When the browser-runtime fetch fails, latest.browser is null, so
      // latest.browser?.running is undefined, and !(undefined) is true — this
      // caused a failed fetch to be treated as "browser not running" and
      // returned degraded:false incorrectly.
      //
      // Now we distinguish three explicit cases:
      //   1. Browser explicitly reports running=false (not null): stable state,
      //      no need to wait further.
      //   2. Browser-runtime capture is ready: stable state, even when
      //      session-manager is passive and has no separate sessionId.
      //   3. Session is ready (has a sessionId): stable state.
      //   4. Everything else (null browser, browser running but no session yet):
      //      keep polling until the deadline.

      if (latest.browser !== null && !latest.browser.running) {
        // Browser is explicitly not running — stable, nothing to wait for.
        const patch = deriveScreenPatch({ ...latest, degraded: false });
        updateScreenState(patch);
        return { ...screenState };
      }

      if (latest.browserCapture?.snapshotText || latest.browserCapture?.focusedWindow) {
        const patch = deriveScreenPatch({ ...latest, degraded: false });
        updateScreenState(patch);
        return { ...screenState };
      }

      if (latest.session?.sessionId) {
        // Session is ready (browser is running and session is established).
        const patch = deriveScreenPatch({ ...latest, degraded: false });
        updateScreenState(patch);
        return { ...screenState };
      }

      await sleep(statePollMs);
    }

    // Timed out waiting for a consistent state.
    const degradedPatch = deriveScreenPatch({ ...latest, degraded: true });
    updateScreenState(degradedPatch);
    return { ...screenState };
  } catch {
    updateScreenState({
      sessionId: null,
      readiness: "degraded",
      focusedWindow: null,
      summary: "Unable to reach session manager for screen state.",
    });
    return { ...screenState };
  }
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
      service: "openclaw-screen-sense",
      stage: "active",
      host,
      port,
      eventHubUrl,
      sessionManagerUrl,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/screen/current") {
    const screen = await collectStableScreenState();
    sendJson(res, 200, { ok: true, screen });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/screen/provider") {
    const upstream = await readUpstreamState();
    sendJson(res, 200, {
      ok: true,
      provider: upstream.captureAdapter,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/screen/windows") {
    const screen = await collectStableScreenState();
    sendJson(res, 200, {
      ok: true,
      focusedWindow: screen.focusedWindow,
      windowList: screen.windowList,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/screen/ocr") {
    const screen = await collectStableScreenState();
    sendJson(res, 200, {
      ok: true,
      ocrBlocks: screen.ocrBlocks,
      summary: screen.summary,
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/screen/refresh") {
    const screen = await collectStableScreenState();
    await publishEvent("screen.updated", { screen });
    sendJson(res, 200, { ok: true, screen });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-screen-sense listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-screen-sense", `http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-screen-sense",
    url: `http://${host}:${port}`,
  });
});
