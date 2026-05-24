import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const captureMode = process.env.OPENCLAW_SCREEN_CAPTURE_MODE ?? "browser";
const captureCommand = process.env.OPENCLAW_SCREEN_CAPTURE_COMMAND ?? "";
const captureNodeFile = process.env.OPENCLAW_SCREEN_CAPTURE_NODE_FILE ?? "";
const capturePowerShellFile = process.env.OPENCLAW_SCREEN_CAPTURE_POWERSHELL_FILE ?? "";
const captureTimeoutMs = Number.parseInt(process.env.OPENCLAW_SCREEN_CAPTURE_TIMEOUT_MS ?? "2000", 10);

function normaliseCapturePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    snapshotPath: typeof payload.snapshotPath === "string" ? payload.snapshotPath : null,
    snapshotText: typeof payload.snapshotText === "string" ? payload.snapshotText : null,
    focusedWindow:
      payload.focusedWindow && typeof payload.focusedWindow === "object"
        ? {
            title: typeof payload.focusedWindow.title === "string" ? payload.focusedWindow.title : "OpenClaw External Capture",
            pid: typeof payload.focusedWindow.pid === "number" ? payload.focusedWindow.pid : undefined,
          }
        : null,
    windowList: Array.isArray(payload.windowList)
      ? payload.windowList
          .filter((item) => item && typeof item === "object" && typeof item.title === "string")
          .map((item) => ({
            title: item.title,
            pid: typeof item.pid === "number" ? item.pid : undefined,
          }))
      : null,
    ocrBlocks: Array.isArray(payload.ocrBlocks)
      ? payload.ocrBlocks
          .filter((item) => item && typeof item === "object" && typeof item.text === "string")
          .map((item) => ({
            text: item.text,
            confidence: typeof item.confidence === "number" ? item.confidence : undefined,
          }))
      : null,
    source: typeof payload.source === "string" ? payload.source : captureMode,
  };
}

async function readCommandCapture() {
  if (captureNodeFile.trim()) {
    try {
      const { stdout } = await execFileAsync(process.execPath, [captureNodeFile], {
        timeout: captureTimeoutMs,
        windowsHide: true,
      });
      const capture = normaliseCapturePayload(JSON.parse(stdout));
      return {
        capture,
        adapter: {
          mode: "command",
          ready: Boolean(capture),
          detail: capture ? "External Node capture script returned screen payload." : "External Node capture script returned empty payload.",
        },
      };
    } catch (error) {
      return {
        capture: null,
        adapter: {
          mode: "command",
          ready: false,
          detail: error instanceof Error ? error.message : "Unknown Node capture error.",
        },
      };
    }
  }

  if (capturePowerShellFile.trim()) {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", capturePowerShellFile],
        {
          timeout: captureTimeoutMs,
          windowsHide: true,
        },
      );
      const capture = normaliseCapturePayload(JSON.parse(stdout));
      return {
        capture,
        adapter: {
          mode: "command",
          ready: Boolean(capture),
          detail: capture
            ? "External PowerShell capture script returned screen payload."
            : "External PowerShell capture script returned empty payload.",
        },
      };
    } catch (error) {
      return {
        capture: null,
        adapter: {
          mode: "command",
          ready: false,
          detail: error instanceof Error ? error.message : "Unknown PowerShell capture error.",
        },
      };
    }
  }

  if (!captureCommand.trim()) {
    return {
      capture: null,
      adapter: {
        mode: "command",
        ready: false,
        detail: "OPENCLAW_SCREEN_CAPTURE_COMMAND, OPENCLAW_SCREEN_CAPTURE_NODE_FILE, or OPENCLAW_SCREEN_CAPTURE_POWERSHELL_FILE is not set.",
      },
    };
  }

  // H-3 Fix: Use execFileAsync instead of execAsync (which invokes a shell).
  // This prevents shell injection if captureCommand contains metacharacters.
  try {
    const parts = captureCommand.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: captureTimeoutMs,
      windowsHide: true,
    });
    const capture = normaliseCapturePayload(JSON.parse(stdout));
    return {
      capture,
      adapter: {
        mode: "command",
        ready: Boolean(capture),
        detail: capture ? "External capture command returned screen payload." : "External capture command returned empty payload.",
      },
    };
  } catch (error) {
    return {
      capture: null,
      adapter: {
        mode: "command",
        ready: false,
        detail: error instanceof Error ? error.message : "Unknown capture command error.",
      },
    };
  }
}

export async function readCaptureAdapter(fetchBrowserCapture) {
  if (captureMode === "command") {
    return readCommandCapture();
  }

  const browserCapture = await fetchBrowserCapture();
  return {
    capture: browserCapture,
    adapter: {
      mode: "browser",
      ready: Boolean(browserCapture),
      detail: browserCapture ? "Browser runtime capture is available." : "Browser runtime capture is not available yet.",
    },
  };
}
