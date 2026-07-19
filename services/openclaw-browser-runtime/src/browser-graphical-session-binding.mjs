import { lstatSync } from "node:fs";
import path from "node:path";

export const BROWSER_GRAPHICAL_SESSION_REGISTRY =
  "nixsoma-browser-graphical-session-binding-v0";

const EXPECTED_MODE = "nested_headed_wayland";
const EXPECTED_RUNTIME_DIRECTORY = "nixsoma-ai-graphical-session";
const EXPECTED_SOCKET_NAME = "nixsoma-ai-0";
const CHILD_ENV_ALLOWLIST = [
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "PATH",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "TZDIR",
  "LOCALE_ARCHIVE",
  "XDG_DATA_DIRS",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "TMPDIR",
  "GTK_THEME",
];

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function baseEvidence(config) {
  return {
    registry: BROWSER_GRAPHICAL_SESSION_REGISTRY,
    enabled: config.enabled,
    mode: config.mode,
    status: config.enabled ? "not_observed" : "disabled",
    attached: false,
    headed: config.enabled,
    socket: {
      name: EXPECTED_SOCKET_NAME,
      present: false,
      type: "missing",
      ownerMatched: false,
      groupOrOtherWritable: false,
    },
    boundary: {
      aiOwnedWorkspaceOnly: true,
      parentDisplayEnvironment: false,
      parentSessionBusEnvironment: false,
      desktopWideCapture: false,
      inputAuthorityExpanded: false,
      networkScope: "existing_browser_runtime",
      networkAuthorityExpanded: false,
      rootRequired: false,
      hostMutation: false,
    },
  };
}

export function buildBrowserGraphicalSessionConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_ENABLED),
    mode: typeof env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_MODE === "string"
      ? env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_MODE.trim()
      : "disabled",
    runtimeDirectory: typeof env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_RUNTIME_DIRECTORY === "string"
      ? env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_RUNTIME_DIRECTORY.trim()
      : EXPECTED_RUNTIME_DIRECTORY,
    socketName: typeof env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME === "string"
      ? env.OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME.trim()
      : EXPECTED_SOCKET_NAME,
    runtimeBaseDir: typeof env.XDG_RUNTIME_DIR === "string" ? env.XDG_RUNTIME_DIR.trim() : "",
  };
}

export function createBrowserGraphicalSessionBinding({
  env = process.env,
  stat = lstatSync,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
} = {}) {
  const config = buildBrowserGraphicalSessionConfig({ env });

  function inspect({ browserRunning = false } = {}) {
    const evidence = baseEvidence(config);
    if (!config.enabled) return evidence;
    if (config.mode !== EXPECTED_MODE
      || config.runtimeDirectory !== EXPECTED_RUNTIME_DIRECTORY
      || config.socketName !== EXPECTED_SOCKET_NAME
      || !path.isAbsolute(config.runtimeBaseDir)) {
      return { ...evidence, status: "configuration_invalid" };
    }

    const runtimeDir = path.join(config.runtimeBaseDir, EXPECTED_RUNTIME_DIRECTORY);
    let runtimeStats;
    let socketStats;
    try {
      runtimeStats = stat(runtimeDir);
    } catch {
      return { ...evidence, status: "runtime_directory_missing" };
    }
    if (!runtimeStats.isDirectory()
      || runtimeStats.uid !== expectedUid
      || (runtimeStats.mode & 0o077) !== 0) {
      return { ...evidence, status: "runtime_directory_untrusted" };
    }
    try {
      socketStats = stat(path.join(runtimeDir, EXPECTED_SOCKET_NAME));
    } catch {
      return { ...evidence, status: "socket_missing" };
    }

    const socketMode = socketStats.mode & 0o777;
    const socket = {
      name: EXPECTED_SOCKET_NAME,
      present: true,
      type: socketStats.isSocket() ? "unix_socket" : "unexpected",
      ownerMatched: socketStats.uid === expectedUid,
      groupOrOtherWritable: (socketMode & 0o022) !== 0,
    };
    const ready = socket.type === "unix_socket"
      && socket.ownerMatched
      && !socket.groupOrOtherWritable;
    return {
      ...evidence,
      status: ready ? (browserRunning ? "attached" : "ready") : "socket_untrusted",
      attached: ready && browserRunning,
      socket,
    };
  }

  function launchOptions() {
    const evidence = inspect();
    if (!config.enabled) return { headless: true, evidence };
    if (evidence.status !== "ready") {
      throw new Error(`AI graphical session is not ready for browser launch: ${evidence.status}.`);
    }

    const childEnv = Object.fromEntries(CHILD_ENV_ALLOWLIST
      .filter((name) => typeof env[name] === "string" && env[name])
      .map((name) => [name, env[name]]));
    childEnv.XDG_RUNTIME_DIR = path.join(config.runtimeBaseDir, EXPECTED_RUNTIME_DIRECTORY);
    childEnv.WAYLAND_DISPLAY = EXPECTED_SOCKET_NAME;
    childEnv.MOZ_ENABLE_WAYLAND = "1";
    childEnv.GSETTINGS_BACKEND = "memory";
    return { headless: false, env: childEnv, evidence };
  }

  return { inspect, launchOptions };
}
