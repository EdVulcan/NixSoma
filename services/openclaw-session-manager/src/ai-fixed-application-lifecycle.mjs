import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFileAsync = promisify(execFile);

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUnitState(stdout) {
  const properties = Object.fromEntries(
    String(stdout ?? "")
      .split(/\r?\n/u)
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const mainPid = Number.parseInt(properties.MainPID ?? "0", 10);
  return {
    activeState: properties.ActiveState ?? "unknown",
    subState: properties.SubState ?? "unknown",
    mainPid: Number.isInteger(mainPid) && mainPid > 0 ? mainPid : null,
  };
}

function baseSnapshot(config, definition) {
  return {
    registry: definition.registry,
    enabled: config.enabled,
    unitName: definition.expectedUnit,
    status: config.enabled ? "not_observed" : "disabled",
    active: false,
    activeState: "inactive",
    subState: "dead",
    mainPid: null,
    matchingSurface: null,
    surfaceAttached: false,
    automaticStart: false,
    automaticRestart: false,
    boundary: {
      fixedApplication: true,
      arbitraryProcessLaunch: false,
      parentDisplayConnected: false,
      inputAuthorityExpanded: false,
      rootRequired: false,
      hostMutation: false,
      providerEgress: false,
      persisted: false,
    },
  };
}

export function buildAiFixedApplicationLifecycleConfig({
  env = process.env,
  expectedUnit,
  environmentPrefix,
  enabledVariable = "OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED",
} = {}) {
  return {
    enabled: enabled(env[enabledVariable]),
    unitName: typeof env[`${environmentPrefix}_UNIT`] === "string"
      ? env[`${environmentPrefix}_UNIT`].trim()
      : expectedUnit,
    systemctlPath: typeof env[`${environmentPrefix}_SYSTEMCTL`] === "string"
      ? env[`${environmentPrefix}_SYSTEMCTL`].trim()
      : "systemctl",
    commandTimeoutMs: boundedInteger(
      env[`${environmentPrefix}_COMMAND_TIMEOUT_MS`],
      3_000,
      500,
      10_000,
    ),
    pollMs: boundedInteger(env[`${environmentPrefix}_POLL_MS`], 25, 5, 250),
    settleTimeoutMs: boundedInteger(
      env[`${environmentPrefix}_SETTLE_TIMEOUT_MS`],
      2_000,
      250,
      10_000,
    ),
  };
}

export function createAiFixedApplicationLifecycle({
  definition,
  config,
  execFileAsync = defaultExecFileAsync,
  observeSurfaceInventory,
  sleep = delay,
} = {}) {
  if (!definition?.registry
    || !definition.expectedUnit
    || !definition.label
    || !definition.errorCodePrefix) {
    throw new Error("Fixed AI application lifecycle definition is invalid.");
  }
  if (!config || (config.enabled && (config.unitName !== definition.expectedUnit
    || (!path.isAbsolute(config.systemctlPath) && config.systemctlPath !== "systemctl")))) {
    throw new Error(`${definition.label} lifecycle configuration is invalid.`);
  }
  if (typeof observeSurfaceInventory !== "function") {
    throw new Error(`${definition.label} lifecycle requires a surface inventory observer.`);
  }
  let current = baseSnapshot(config, definition);

  async function runSystemctl(args) {
    return execFileAsync(
      config.systemctlPath,
      ["--user", ...args],
      { timeout: config.commandTimeoutMs, maxBuffer: 65_536 },
    );
  }

  async function readUnitState() {
    const result = await runSystemctl([
      "show",
      definition.expectedUnit,
      "--property=ActiveState",
      "--property=SubState",
      "--property=MainPID",
      "--no-pager",
    ]);
    return parseUnitState(result.stdout);
  }

  function project(unitState, inventory, status = null) {
    const matchingSurface = unitState.mainPid
      ? inventory.surfaces?.find((surface) => surface.pid === unitState.mainPid) ?? null
      : null;
    const active = unitState.activeState === "active";
    current = {
      ...baseSnapshot(config, definition),
      status: status ?? (active
        ? matchingSurface ? "running" : "surface_pending"
        : "stopped"),
      active,
      activeState: unitState.activeState,
      subState: unitState.subState,
      mainPid: unitState.mainPid,
      matchingSurface: matchingSurface ? { ...matchingSurface } : null,
      surfaceAttached: Boolean(matchingSurface),
      surfaceInventoryStatus: inventory.status ?? "unknown",
      surfaceInventorySequence: inventory.sequence ?? null,
    };
    return snapshot();
  }

  async function observe() {
    const [unitState, inventory] = await Promise.all([
      readUnitState(),
      Promise.resolve(observeSurfaceInventory()),
    ]);
    return { unitState, inventory };
  }

  function surfaceReady(surface) {
    return Boolean(surface)
      && (definition.requireActivatedSurface !== true || surface.activated === true);
  }

  async function reconcile() {
    if (!config.enabled) return snapshot();
    try {
      const { unitState, inventory } = await observe();
      return project(unitState, inventory);
    } catch (error) {
      current = {
        ...baseSnapshot(config, definition),
        status: "degraded",
        error: error instanceof Error
          ? error.message
          : `${definition.label} observation failed.`,
      };
      return snapshot();
    }
  }

  async function pollUntil(predicate, failureMessage, retainedPid = null) {
    const deadline = Date.now() + config.settleTimeoutMs;
    let latest;
    do {
      latest = await observe();
      if (predicate(latest, retainedPid)) return latest;
      await sleep(config.pollMs);
    } while (Date.now() < deadline);
    const error = new Error(failureMessage);
    error.code = `${definition.errorCodePrefix}_SETTLE_TIMEOUT`;
    error.statusCode = 409;
    throw error;
  }

  function requireEnabled() {
    if (config.enabled) return;
    const error = new Error(`${definition.label} lifecycle is disabled.`);
    error.code = `${definition.errorCodePrefix}_DISABLED`;
    error.statusCode = 409;
    throw error;
  }

  async function start() {
    requireEnabled();
    const initial = await observe();
    const existingSurface = initial.unitState.mainPid
      ? initial.inventory.surfaces?.find((surface) => surface.pid === initial.unitState.mainPid)
      : null;
    if (initial.unitState.activeState === "active" && surfaceReady(existingSurface)) {
      return { ...project(initial.unitState, initial.inventory), reused: true };
    }
    if (initial.unitState.activeState !== "active") {
      current = { ...current, status: "starting" };
      await runSystemctl(["start", definition.expectedUnit]);
    }
    const settled = await pollUntil(
      ({ unitState, inventory }) => unitState.activeState === "active"
        && Boolean(unitState.mainPid)
        && inventory.available === true
        && inventory.surfaces.some((surface) => surface.pid === unitState.mainPid
          && surfaceReady(surface)),
      `${definition.label} started without attaching its bounded compositor surface.`,
    );
    return { ...project(settled.unitState, settled.inventory), reused: false };
  }

  async function stop() {
    requireEnabled();
    const initial = await observe();
    const retainedPid = initial.unitState.mainPid;
    if (initial.unitState.activeState !== "inactive"
      || (retainedPid && initial.inventory.surfaces.some((surface) => surface.pid === retainedPid))) {
      current = { ...current, status: "stopping" };
      await runSystemctl(["stop", definition.expectedUnit]);
    }
    const settled = await pollUntil(
      ({ unitState, inventory }, pid) => unitState.activeState === "inactive"
        && (!pid || !inventory.surfaces.some((surface) => surface.pid === pid)),
      `${definition.label} stopped without removing its bounded compositor surface.`,
      retainedPid,
    );
    return { ...project(settled.unitState, settled.inventory, "stopped"), reused: false };
  }

  function snapshot() {
    return structuredClone(current);
  }

  return { reconcile, snapshot, start, stop };
}
