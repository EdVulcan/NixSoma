const HEARTBEAT_REGISTRY = "openclaw-trusted-work-view-sidecar-heartbeat-v0";
const intervalMs = Math.max(25, Number.parseInt(process.env.OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS ?? "250", 10));
const sessionId = process.env.OPENCLAW_SIDECAR_SESSION_ID ?? null;
const workViewId = process.env.OPENCLAW_SIDECAR_WORK_VIEW_ID ?? null;
const browserRuntimeUrl = process.env.OPENCLAW_SIDECAR_BROWSER_RUNTIME_URL ?? null;

let heartbeatCount = 1;

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
  if (!browserRuntimeUrl) {
    return;
  }
  try {
    const response = await fetch(`${browserRuntimeUrl}/browser/capture`);
    const data = await response.json();
    const capture = data.capture ?? {};
    const summary = capture.workViewSummary ?? {};
    send("capture_observation", {
      observation: {
        registry: "openclaw-trusted-work-view-sidecar-capture-observation-v0",
        source: "browser-runtime-loopback",
        sessionId: capture.sessionId ?? data.browser?.sessionId ?? null,
        title: typeof summary.title === "string" ? summary.title.slice(0, 200) : null,
        activeUrl: typeof summary.url === "string" ? summary.url.slice(0, 2048) : null,
        tabCount: Number.isInteger(summary.tabCount) ? summary.tabCount : 0,
        visibleTextBlockCount: Array.isArray(summary.visibleTextBlocks) ? summary.visibleTextBlocks.length : 0,
        capturedAt: capture.capturedAt ?? new Date().toISOString(),
        fullPayloadRetained: false,
        desktopWideCapture: false,
      },
    });
  } catch (error) {
    send("capture_failed", { reason: error instanceof Error ? error.message : "capture_failed" });
  }
}

send("ready", { heartbeatCount });
observeBrowserCapture();
const timer = setInterval(heartbeat, intervalMs);

function stop(reason) {
  clearInterval(timer);
  send("stopped", { heartbeatCount, reason });
  setImmediate(() => process.exit(0));
}

process.on("message", (message) => {
  if (message?.type === "shutdown") {
    stop("parent_requested_shutdown");
  }
});
process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => stop("sigterm"));
process.on("SIGINT", () => stop("sigint"));
