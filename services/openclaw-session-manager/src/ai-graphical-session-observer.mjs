import { lstatSync } from "node:fs";
import path from "node:path";

export const AI_GRAPHICAL_SESSION_REGISTRY =
  "nixsoma-ai-graphical-session-observation-v0";

const EXPECTED_MODE = "nested_headless_wayland";
const EXPECTED_SOCKET_NAME = "nixsoma-ai-0";

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function boundedDimension(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function modeString(mode) {
  return (mode & 0o777).toString(8).padStart(4, "0");
}

function baseEvidence(config) {
  return {
    registry: AI_GRAPHICAL_SESSION_REGISTRY,
    identityLevel: "level_4_graphics_stack_native",
    owner: "nixsoma-ai-graphical-session",
    enabled: config.enabled,
    mode: config.mode,
    status: config.enabled ? "not_observed" : "disabled",
    ready: false,
    output: {
      width: config.width,
      height: config.height,
      virtual: true,
      headless: true,
    },
    socket: {
      name: EXPECTED_SOCKET_NAME,
      present: false,
      type: "missing",
      ownerUid: null,
      ownerMatched: false,
      mode: null,
      groupOrOtherWritable: false,
    },
    boundary: {
      parentDisplayConnected: false,
      desktopWideCapture: false,
      readsPixels: false,
      inputAuthority: false,
      browserAttached: false,
      hostMutation: false,
      rootRequired: false,
      networkAccess: false,
    },
  };
}

export function buildAiGraphicalSessionConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_AI_GRAPHICAL_SESSION_ENABLED),
    mode: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_MODE === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_MODE.trim()
      : "disabled",
    socketName: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME.trim()
      : EXPECTED_SOCKET_NAME,
    runtimeDir: typeof env.XDG_RUNTIME_DIR === "string" ? env.XDG_RUNTIME_DIR.trim() : "",
    width: boundedDimension(env.OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH, 1280, 640, 3840),
    height: boundedDimension(env.OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT, 720, 480, 2160),
  };
}

export function createAiGraphicalSessionObserver({
  env = process.env,
  stat = lstatSync,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
} = {}) {
  const config = buildAiGraphicalSessionConfig({ env });

  return function observeAiGraphicalSession() {
    const evidence = baseEvidence(config);
    if (!config.enabled) return evidence;
    if (config.mode !== EXPECTED_MODE
      || config.socketName !== EXPECTED_SOCKET_NAME
      || !path.isAbsolute(config.runtimeDir)) {
      return { ...evidence, status: "configuration_invalid" };
    }

    let runtimeStats;
    try {
      runtimeStats = stat(config.runtimeDir);
    } catch {
      return { ...evidence, status: "runtime_directory_missing" };
    }
    const runtimeTrusted = runtimeStats.isDirectory()
      && runtimeStats.uid === expectedUid
      && (runtimeStats.mode & 0o077) === 0;
    if (!runtimeTrusted) {
      return { ...evidence, status: "runtime_directory_untrusted" };
    }

    const socketPath = path.join(config.runtimeDir, EXPECTED_SOCKET_NAME);
    let socketStats;
    try {
      socketStats = stat(socketPath);
    } catch {
      return { ...evidence, status: "socket_missing" };
    }
    const socketMode = socketStats.mode & 0o777;
    const socket = {
      name: EXPECTED_SOCKET_NAME,
      present: true,
      type: socketStats.isSocket() ? "unix_socket" : "unexpected",
      ownerUid: socketStats.uid,
      ownerMatched: socketStats.uid === expectedUid,
      mode: modeString(socketStats.mode),
      groupOrOtherWritable: (socketMode & 0o022) !== 0,
    };
    const ready = socket.type === "unix_socket"
      && socket.ownerMatched
      && !socket.groupOrOtherWritable;
    return {
      ...evidence,
      status: ready ? "ready" : "socket_untrusted",
      ready,
      socket,
    };
  };
}
