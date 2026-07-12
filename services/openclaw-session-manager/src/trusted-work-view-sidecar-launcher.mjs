import { execFile, spawn } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFileAsync = promisify(execFile);
const SYSTEMD_USER_MODE = "systemd-user";
const DIRECT_SPAWN_MODE = "direct-spawn";
const ENVIRONMENT_KEYS = new Set([
  "NODE_NO_WARNINGS",
  "OPENCLAW_SIDECAR_SOCKET_PATH",
  "OPENCLAW_SIDECAR_TASK_ID",
  "OPENCLAW_SIDECAR_APPROVAL_ID",
  "OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS",
  "OPENCLAW_SIDECAR_CAPTURE_INTERVAL_MS",
  "OPENCLAW_SIDECAR_RECONNECT_TIMEOUT_MS",
]);

function normalizeMode(value) {
  if (value === SYSTEMD_USER_MODE || value === DIRECT_SPAWN_MODE) return value;
  throw new Error(`Unsupported trusted sidecar launcher mode: ${value ?? "missing"}.`);
}

function normalizeUnitInstance(value) {
  const instance = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_.-]+$/u.test(instance)) {
    throw new Error("Trusted sidecar unit instance must use only letters, numbers, dot, underscore, or dash.");
  }
  return instance;
}

function quoteEnvironmentValue(value) {
  const text = String(value);
  if (text.includes("\0") || text.includes("\n") || text.includes("\r")) {
    throw new Error("Trusted sidecar environment values must be single-line text.");
  }
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function serializeTrustedSidecarEnvironment(environment) {
  const entries = Object.entries(environment ?? {});
  for (const [key] of entries) {
    if (!ENVIRONMENT_KEYS.has(key)) {
      throw new Error(`Trusted sidecar environment key is not allowed: ${key}.`);
    }
  }
  for (const required of [
    "OPENCLAW_SIDECAR_SOCKET_PATH",
    "OPENCLAW_SIDECAR_TASK_ID",
    "OPENCLAW_SIDECAR_APPROVAL_ID",
  ]) {
    if (!entries.some(([key, value]) => key === required && String(value).trim())) {
      throw new Error(`Trusted sidecar environment requires ${required}.`);
    }
  }
  return `${entries.map(([key, value]) => `${key}=${quoteEnvironmentValue(value)}`).join("\n")}\n`;
}

export function createTrustedWorkViewSidecarLauncher({
  mode = process.env.OPENCLAW_TRUSTED_SIDECAR_LAUNCHER_MODE ?? SYSTEMD_USER_MODE,
  unitInstance = process.env.OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE ?? "primary",
  socketDirectory,
  spawnProcess = spawn,
  execFileAsync = defaultExecFileAsync,
  systemctlPath = "systemctl",
  commandTimeoutMs = 5_000,
} = {}) {
  const launcherMode = normalizeMode(mode);
  const fixedUnitInstance = normalizeUnitInstance(unitInstance);
  const unitName = `openclaw-trusted-sidecar@${fixedUnitInstance}.service`;
  const environmentFilePath = path.join(socketDirectory, `${fixedUnitInstance}.env`);

  function describe() {
    return {
      launcherMode,
      unitInstance: launcherMode === SYSTEMD_USER_MODE ? fixedUnitInstance : null,
      unitName: launcherMode === SYSTEMD_USER_MODE ? unitName : null,
      environmentFilePath: launcherMode === SYSTEMD_USER_MODE ? environmentFilePath : null,
      userManagerOwned: launcherMode === SYSTEMD_USER_MODE,
      directSpawnFallback: launcherMode === DIRECT_SPAWN_MODE,
      automaticStart: false,
      automaticRestart: false,
      persistentAuthorityValues: false,
    };
  }

  async function launch({ command, args, environment }) {
    const boundedEnvironment = serializeTrustedSidecarEnvironment(environment);
    if (launcherMode === DIRECT_SPAWN_MODE) {
      const processHandle = spawnProcess(command, args, {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        env: environment,
      });
      processHandle.unref?.();
      return { ...describe(), processHandle };
    }

    mkdirSync(socketDirectory, { recursive: true, mode: 0o700 });
    chmodSync(socketDirectory, 0o700);
    const temporaryPath = `${environmentFilePath}.tmp-${process.pid}`;
    try {
      writeFileSync(temporaryPath, boundedEnvironment, { encoding: "utf8", mode: 0o600 });
      chmodSync(temporaryPath, 0o600);
      renameSync(temporaryPath, environmentFilePath);
      await execFileAsync(systemctlPath, ["--user", "start", unitName], { timeout: commandTimeoutMs });
      return { ...describe(), processHandle: null };
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      rmSync(environmentFilePath, { force: true });
      throw error;
    }
  }

  async function stop() {
    if (launcherMode === SYSTEMD_USER_MODE) {
      try {
        await execFileAsync(systemctlPath, ["--user", "stop", unitName], { timeout: commandTimeoutMs });
      } finally {
        rmSync(environmentFilePath, { force: true });
      }
    }
    return describe();
  }

  return { describe, launch, stop };
}
