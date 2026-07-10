const HEARTBEAT_REGISTRY = "openclaw-trusted-work-view-sidecar-heartbeat-v0";
const intervalMs = Math.max(25, Number.parseInt(process.env.OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS ?? "250", 10));
const sessionId = process.env.OPENCLAW_SIDECAR_SESSION_ID ?? null;
const workViewId = process.env.OPENCLAW_SIDECAR_WORK_VIEW_ID ?? null;
const browserRuntimeUrl = process.env.OPENCLAW_SIDECAR_BROWSER_RUNTIME_URL ?? null;
const captureIntervalMs = Math.max(500, Number.parseInt(process.env.OPENCLAW_SIDECAR_CAPTURE_INTERVAL_MS ?? "1000", 10));

let heartbeatCount = 1;
let captureSequence = 0;
let captureInFlight = false;
let latestCaptureObservation = null;

function send(type, details = {}) {
  if (typeof process.send !== "function") {
    process.exit(1);
  }
  process.send({
    registry: HEARTBEAT_REGISTRY,
    type,
    sessionId,
    workViewId,
    pid: process.pid,
    emittedAt: new Date().toISOString(),
    ...details,
  });
}

function heartbeat() {
  heartbeatCount += 1;
  send("heartbeat", { heartbeatCount });
}

async function observeBrowserCapture() {
  if (!browserRuntimeUrl || captureInFlight) {
    return;
  }
  captureInFlight = true;
  try {
    const response = await fetch(`${browserRuntimeUrl}/browser/capture`);
    const data = await response.json();
    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error ?? "browser_capture_request_failed");
    }
    if (data.running !== true || !data.capture) {
      throw new Error("browser_runtime_not_running");
    }
    const capture = data.capture ?? {};
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

send("ready", { heartbeatCount });
observeBrowserCapture();
const timer = setInterval(heartbeat, intervalMs);
const captureTimer = setInterval(observeBrowserCapture, captureIntervalMs);

function stop(reason) {
  clearInterval(timer);
  clearInterval(captureTimer);
  send("stopped", { heartbeatCount, reason });
  setImmediate(() => process.exit(0));
}

process.on("message", (message) => {
  if (message?.type === "shutdown") {
    stop("parent_requested_shutdown");
  } else if (message?.type === "browser_action") {
    executeBrowserAction(message);
  }
});

async function executeBrowserAction(message) {
  const observedAt = Date.parse(latestCaptureObservation?.observedAt ?? "");
  const fresh = Number.isFinite(observedAt) && Date.now() - observedAt <= 3_000;
  if (!fresh || latestCaptureObservation?.sessionId !== sessionId) {
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
    const response = await fetch(`${browserRuntimeUrl}${endpoint}`, {
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
process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => stop("sigterm"));
process.on("SIGINT", () => stop("sigint"));
