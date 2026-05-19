import http from "node:http";

const host = process.env.OPENCLAW_BROWSER_RUNTIME_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_BROWSER_RUNTIME_PORT ?? "4103", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const sessionWaitMs = Number.parseInt(process.env.OPENCLAW_BROWSER_SESSION_WAIT_MS ?? "2000", 10);
const sessionPollMs = Number.parseInt(process.env.OPENCLAW_BROWSER_SESSION_POLL_MS ?? "100", 10);

const browserState = {
  running: false,
  browserPid: null,
  profile: "ai-browser-profile",
  activeTitle: null,
  activeUrl: null,
  sessionId: null,
  tabs: [],
  lastInput: null,
  lastClick: null,
  updatedAt: new Date().toISOString(),
};

function corsHeaders(extraHeaders = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extraHeaders,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, corsHeaders({ "content-type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
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

async function publishEvent(type, payload = {}) {
  try {
    await fetch(`${eventHubUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        source: "openclaw-browser-runtime",
        payload,
      }),
    });
  } catch (error) {
    console.error("Failed to publish browser runtime event:", error);
  }
}

async function readSessionState() {
  const response = await fetch(`${sessionManagerUrl}/session/state`);
  const data = await response.json();
  return data?.session ?? null;
}

async function waitForReadySession() {
  const deadline = Date.now() + sessionWaitMs;

  while (Date.now() <= deadline) {
    const session = await readSessionState();
    if (session?.status === "running" && session?.sessionId) {
      return session;
    }

    await sleep(sessionPollMs);
  }

  return null;
}

async function ensureSession() {
  const current = await readSessionState();
  if (current?.status === "running" && current?.sessionId) {
    return current;
  }

  await fetch(`${sessionManagerUrl}/session/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayTarget: "workspace-2" }),
  });

  return waitForReadySession();
}

function addTab(url) {
  const tab = {
    id: `tab-${browserState.tabs.length + 1}`,
    url,
    title: titleForUrl(url),
    createdAt: new Date().toISOString(),
  };

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
    updatedAt: browserState.updatedAt,
  };
  const lines = [
    "OpenClaw browser work view",
    "Source: browser-runtime",
    "Capture Strategy: browser-runtime-backed",
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
      const session = await ensureSession();

      if (!session?.sessionId) {
        sendJson(res, 409, { ok: false, error: "session not ready" });
        return;
      }

      if (!browserState.running) {
        updateBrowserState({
          running: true,
          browserPid: Math.floor(Math.random() * 90000) + 10000,
          sessionId: session.sessionId,
        });
      }

      const tab = addTab(url);
      const browser = serialiseBrowserState();
      await publishEvent("browser.started", { browser, tab });
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
      await publishEvent("browser.updated", { browser, tab, action: "new-tab" });
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
      await publishEvent("browser.updated", { browser, action: "input", text });
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
      await publishEvent("browser.updated", { browser, action: "click", position: action });
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
  await publishEvent("service.started", {
    service: "openclaw-browser-runtime",
    url: `http://${host}:${port}`,
  });
});
