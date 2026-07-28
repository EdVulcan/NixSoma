import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const AI_WORKBENCH_LIFECYCLE_REGISTRY =
  "nixsoma-ai-workbench-lifecycle-v0";

const EXPECTED_UNIT = "nixsoma-ai-workbench.service";
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

function baseSnapshot(config) {
  return {
    registry: AI_WORKBENCH_LIFECYCLE_REGISTRY,
    enabled: config.enabled,
    unitName: EXPECTED_UNIT,
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

export function buildAiWorkbenchLifecycleConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED),
    unitName: typeof env.OPENCLAW_AI_WORKBENCH_UNIT === "string"
      ? env.OPENCLAW_AI_WORKBENCH_UNIT.trim()
      : EXPECTED_UNIT,
    systemctlPath: typeof env.OPENCLAW_AI_WORKBENCH_SYSTEMCTL === "string"
      ? env.OPENCLAW_AI_WORKBENCH_SYSTEMCTL.trim()
      : "systemctl",
    commandTimeoutMs: boundedInteger(
      env.OPENCLAW_AI_WORKBENCH_COMMAND_TIMEOUT_MS,
      3_000,
      500,
      10_000,
    ),
    pollMs: boundedInteger(env.OPENCLAW_AI_WORKBENCH_POLL_MS, 25, 5, 250),
    settleTimeoutMs: boundedInteger(
      env.OPENCLAW_AI_WORKBENCH_SETTLE_TIMEOUT_MS,
      2_000,
      250,
      10_000,
    ),
  };
}

export function createAiWorkbenchLifecycle({
  env = process.env,
  execFileAsync = defaultExecFileAsync,
  observeSurfaceInventory,
  sleep = delay,
} = {}) {
  const config = buildAiWorkbenchLifecycleConfig({ env });
  if (config.enabled && (config.unitName !== EXPECTED_UNIT
    || (!path.isAbsolute(config.systemctlPath) && config.systemctlPath !== "systemctl"))) {
    throw new Error("AI workbench lifecycle configuration is invalid.");
  }
  if (typeof observeSurfaceInventory !== "function") {
    throw new Error("AI workbench lifecycle requires a surface inventory observer.");
  }
  let current = baseSnapshot(config);

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
      EXPECTED_UNIT,
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
      ...baseSnapshot(config),
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

  async function reconcile() {
    if (!config.enabled) return snapshot();
    try {
      const { unitState, inventory } = await observe();
      return project(unitState, inventory);
    } catch (error) {
      current = {
        ...baseSnapshot(config),
        status: "degraded",
        error: error instanceof Error ? error.message : "AI workbench observation failed.",
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
    error.code = "AI_WORKBENCH_SETTLE_TIMEOUT";
    error.statusCode = 409;
    throw error;
  }

  async function start() {
    if (!config.enabled) {
      const error = new Error("AI workbench lifecycle is disabled.");
      error.code = "AI_WORKBENCH_DISABLED";
      error.statusCode = 409;
      throw error;
    }
    const initial = await observe();
    const existingSurface = initial.unitState.mainPid
      ? initial.inventory.surfaces?.find((surface) => surface.pid === initial.unitState.mainPid)
      : null;
    if (initial.unitState.activeState === "active" && existingSurface) {
      return { ...project(initial.unitState, initial.inventory), reused: true };
    }
    if (initial.unitState.activeState !== "active") {
      current = { ...current, status: "starting" };
      await runSystemctl(["start", EXPECTED_UNIT]);
    }
    const settled = await pollUntil(
      ({ unitState, inventory }) => unitState.activeState === "active"
        && Boolean(unitState.mainPid)
        && inventory.available === true
        && inventory.surfaces.some((surface) => surface.pid === unitState.mainPid),
      "AI workbench started without attaching its bounded compositor surface.",
    );
    return { ...project(settled.unitState, settled.inventory), reused: false };
  }

  async function stop() {
    if (!config.enabled) {
      const error = new Error("AI workbench lifecycle is disabled.");
      error.code = "AI_WORKBENCH_DISABLED";
      error.statusCode = 409;
      throw error;
    }
    const initial = await observe();
    const retainedPid = initial.unitState.mainPid;
    if (initial.unitState.activeState !== "inactive"
      || (retainedPid && initial.inventory.surfaces.some((surface) => surface.pid === retainedPid))) {
      current = { ...current, status: "stopping" };
      await runSystemctl(["stop", EXPECTED_UNIT]);
    }
    const settled = await pollUntil(
      ({ unitState, inventory }, pid) => unitState.activeState === "inactive"
        && (!pid || !inventory.surfaces.some((surface) => surface.pid === pid)),
      "AI workbench stopped without removing its bounded compositor surface.",
      retainedPid,
    );
    return { ...project(settled.unitState, settled.inventory, "stopped"), reused: false };
  }

  function snapshot() {
    return structuredClone(current);
  }

  return { reconcile, snapshot, start, stop };
}
