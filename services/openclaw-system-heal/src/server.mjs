import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const host = process.env.OPENCLAW_SYSTEM_HEAL_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SYSTEM_HEAL_PORT ?? "4107", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const systemSenseUrl = process.env.OPENCLAW_SYSTEM_SENSE_URL ?? "http://127.0.0.1:4106";
const stateFilePath = process.env.OPENCLAW_SYSTEM_HEAL_STATE_FILE
  ?? path.resolve(process.cwd(), "../../.artifacts/openclaw-system-heal-state.json");

const healHistory = [];
const maintenanceRuns = [];
let latestDiagnosis = null;
let latestMaintenanceRun = null;
const MAX_HEAL_HISTORY = 100;
const MAX_MAINTENANCE_RUNS = 100;
const maintenancePolicy = {
  enabled: parseBooleanEnv(process.env.OPENCLAW_MAINTENANCE_AUTORUN, false),
  intervalMs: parsePositiveInteger(process.env.OPENCLAW_MAINTENANCE_INTERVAL_MS, 15 * 60 * 1000),
  autofix: parseBooleanEnv(process.env.OPENCLAW_MAINTENANCE_AUTOFIX, true),
  mode: "simulated",
  lastCheckedAt: null,
  nextDueAt: null,
  lastTick: null,
};

import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";

import { createDebouncedPersist } from "../../../packages/shared-utils/src/persist.mjs";


function parseBooleanEnv(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const normalised = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalised)) {
    return false;
  }
  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-system-heal");


function addHistory(entry) {
  healHistory.unshift(entry);
  while (healHistory.length > MAX_HEAL_HISTORY) {
    healHistory.pop();
  }
  persistState();
}

function addMaintenanceRun(run) {
  latestMaintenanceRun = run;
  maintenanceRuns.unshift(run);
  while (maintenanceRuns.length > MAX_MAINTENANCE_RUNS) {
    maintenanceRuns.pop();
  }
  persistState();
}

const persistState = createDebouncedPersist(stateFilePath, () => ({
  version: 1,
  savedAt: new Date().toISOString(),
  latestDiagnosis,
  latestMaintenanceRun,
  maintenancePolicy,
  healHistory,
  maintenanceRuns,
}));


function loadPersistentState() {
  if (!existsSync(stateFilePath)) {
    return;
  }

  // H-4 note: resolveAllowedPath-style path checks do not apply here because
  // stateFilePath is set from a trusted environment variable, not user input.
  try {
    const data = JSON.parse(readFileSync(stateFilePath, "utf8"));
    latestDiagnosis = data?.latestDiagnosis && typeof data.latestDiagnosis === "object"
      ? data.latestDiagnosis
      : null;
    latestMaintenanceRun = data?.latestMaintenanceRun && typeof data.latestMaintenanceRun === "object"
      ? data.latestMaintenanceRun
      : null;
    if (Array.isArray(data?.healHistory)) {
      healHistory.splice(0, healHistory.length, ...data.healHistory.slice(0, MAX_HEAL_HISTORY));
    }
    if (Array.isArray(data?.maintenanceRuns)) {
      maintenanceRuns.splice(0, maintenanceRuns.length, ...data.maintenanceRuns.slice(0, MAX_MAINTENANCE_RUNS));
    }
    if (data?.maintenancePolicy && typeof data.maintenancePolicy === "object") {
      // M-6 Fix: Validate mode against an explicit allowlist so that a corrupted
      // or manually-edited state file cannot inject an arbitrary mode string.
      const VALID_HEAL_MODES = ["simulated", "audit_only"];
      Object.assign(maintenancePolicy, {
        enabled: data.maintenancePolicy.enabled === true,
        intervalMs: parsePositiveInteger(data.maintenancePolicy.intervalMs, maintenancePolicy.intervalMs),
        autofix: data.maintenancePolicy.autofix !== false,
        mode: typeof data.maintenancePolicy.mode === "string"
          && VALID_HEAL_MODES.includes(data.maintenancePolicy.mode.trim())
          ? data.maintenancePolicy.mode.trim()
          : maintenancePolicy.mode,
        lastCheckedAt: typeof data.maintenancePolicy.lastCheckedAt === "string"
          ? data.maintenancePolicy.lastCheckedAt
          : null,
        nextDueAt: typeof data.maintenancePolicy.nextDueAt === "string"
          ? data.maintenancePolicy.nextDueAt
          : null,
        lastTick: data.maintenancePolicy.lastTick && typeof data.maintenancePolicy.lastTick === "object"
          ? data.maintenancePolicy.lastTick
          : null,
      });
    }
  } catch (error) {
    console.error("Failed to load persisted system-heal state:", error);
  }
}

function serialiseMaintenancePolicy() {
  return {
    enabled: maintenancePolicy.enabled,
    intervalMs: maintenancePolicy.intervalMs,
    autofix: maintenancePolicy.autofix,
    mode: maintenancePolicy.mode,
    lastCheckedAt: maintenancePolicy.lastCheckedAt,
    nextDueAt: maintenancePolicy.nextDueAt,
    lastTick: maintenancePolicy.lastTick,
  };
}

function calculateNextDueAt(from = new Date()) {
  return new Date(from.getTime() + maintenancePolicy.intervalMs).toISOString();
}

function updateMaintenancePolicy(patch = {}) {
  if (typeof patch.enabled === "boolean") {
    maintenancePolicy.enabled = patch.enabled;
  }
  if (Number.isFinite(patch.intervalMs) && patch.intervalMs > 0) {
    maintenancePolicy.intervalMs = Math.trunc(patch.intervalMs);
  }
  if (typeof patch.autofix === "boolean") {
    maintenancePolicy.autofix = patch.autofix;
  }
  // M-2 Fix: Validate mode against the same VALID_HEAL_MODES allowlist used
  // in loadPersistentState (M-6 Fix). Without this, the HTTP API could accept
  // arbitrary mode strings that bypass the state machine.
  if (typeof patch.mode === "string" && patch.mode.trim()) {
    const VALID_HEAL_MODES = ["simulated", "audit_only"];
    const candidateMode = patch.mode.trim();
    if (VALID_HEAL_MODES.includes(candidateMode)) {
      maintenancePolicy.mode = candidateMode;
    }
  }

  if (!maintenancePolicy.nextDueAt || patch.resetSchedule === true) {
    maintenancePolicy.nextDueAt = calculateNextDueAt();
  }

  persistState();
  return serialiseMaintenancePolicy();
}

function isMaintenanceDue(now = new Date()) {
  if (!maintenancePolicy.nextDueAt) {
    return true;
  }
  const dueAtMs = Date.parse(maintenancePolicy.nextDueAt);
  // L-2 Fix: A corrupted nextDueAt (NaN) previously triggered maintenance
  // silently. Now we log a warning and reset the schedule instead.
  if (Number.isNaN(dueAtMs)) {
    console.warn(
      `[system-heal] Invalid nextDueAt value "${maintenancePolicy.nextDueAt}" detected. ` +
      "Resetting maintenance schedule to prevent unintended trigger."
    );
    maintenancePolicy.nextDueAt = calculateNextDueAt(now);
    return false;
  }
  return dueAtMs <= now.getTime();
}

async function fetchSystemHealth() {
  const response = await fetch(`${systemSenseUrl}/system/health`);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false || !data?.system) {
    throw new Error(data?.error ?? "Unable to read system health.");
  }
  return data.system;
}

function getSystemFromBody(body) {
  if (body?.system && typeof body.system === "object") {
    return body.system;
  }
  return null;
}

function buildHealStep({ kind, service = null, reason, risk = "low", mode = "simulated", evidence = null }) {
  return {
    id: randomUUID(),
    kind,
    service,
    reason,
    risk,
    mode,
    evidence,
    status: "planned",
  };
}

function buildDiagnosis(system, options = {}) {
  const now = new Date().toISOString();
  const services = Object.values(system?.services ?? {});
  const alerts = Array.isArray(system?.alerts) ? system.alerts : [];
  const steps = [];

  for (const service of services.filter((candidate) => candidate && candidate.ok === false)) {
    steps.push(buildHealStep({
      kind: "restart-service",
      service: service.name,
      reason: `${service.name} reported ${service.status ?? "unhealthy"}`,
      risk: "medium",
      mode: options.mode ?? "simulated",
      evidence: {
        url: service.url ?? null,
        status: service.status ?? null,
        latencyMs: service.latencyMs ?? null,
        checkedAt: service.checkedAt ?? null,
      },
    }));
  }

  for (const alert of alerts) {
    if (alert?.code === "resource.memory.high" || alert?.code === "resource.disk.high") {
      steps.push(buildHealStep({
        kind: "observe-only",
        service: null,
        reason: alert.message,
        risk: "high",
        mode: "audit_only",
        evidence: alert,
      }));
    }
  }

  const status = steps.some((step) => step.kind === "restart-service")
    ? "repairable"
    : steps.length > 0
      ? "attention_required"
      : "healthy";

  return {
    id: randomUUID(),
    at: now,
    engine: "heal-v0",
    status,
    source: {
      timestamp: system?.timestamp ?? null,
      hostname: system?.body?.hostname ?? null,
      alerts: alerts.length,
      services: services.length,
    },
    plan: {
      mode: options.mode ?? "simulated",
      stepCount: steps.length,
      steps,
    },
  };
}

async function buildDiagnosisFromRequest(body = {}) {
  const system = getSystemFromBody(body) ?? await fetchSystemHealth();
  const diagnosis = buildDiagnosis(system, {
    mode: typeof body.mode === "string" && body.mode.trim() ? body.mode.trim() : "simulated",
  });
  latestDiagnosis = diagnosis;
  persistState();
  return diagnosis;
}

async function executeHealStep(step) {
  const startedAt = new Date().toISOString();
  const entry = {
    id: randomUUID(),
    action: step.kind,
    service: step.service,
    status: step.kind === "observe-only" ? "skipped" : "completed",
    mode: step.mode ?? "simulated",
    reason: step.reason,
    risk: step.risk,
    evidence: step.evidence ?? null,
    startedAt,
    completedAt: startedAt, // will be updated after execution below
  };

  await publishEvent("heal.started", { entry, step });
  // M-3 Fix: Record the actual completion time after work is done, then
  // persist history only after BOTH events have been published. This prevents
  // a state where history is written but heal.completed was never emitted
  // (e.g. if the first publishEvent call timed out).
  entry.completedAt = new Date().toISOString();
  await publishEvent("heal.completed", { entry, step });
  addHistory(entry);
  return entry;
}

function shouldAutofix(body = {}) {
  return body.autofix !== false && body.autoFix !== false && body.diagnoseOnly !== true;
}

function summariseMaintenanceStatus(diagnosis, entries, autofix) {
  if (diagnosis.status === "healthy") {
    return "healthy";
  }
  if (entries.some((entry) => entry.status === "completed")) {
    return "repaired";
  }
  if (!autofix) {
    return "diagnosed";
  }
  return "attention_required";
}

async function runMaintenance(body = {}) {
  const startedAt = new Date().toISOString();
  const autofix = shouldAutofix(body);
  const diagnosis = await buildDiagnosisFromRequest(body);
  const entries = [];

  await publishEvent("maintenance.started", {
    diagnosis,
    autofix,
    governance: "body_internal_audit",
  });

  if (autofix) {
    const executableSteps = diagnosis.plan.steps.filter((step) => step.kind === "restart-service");
    const skippedSteps = diagnosis.plan.steps.filter((step) => step.kind !== "restart-service");
    for (const step of executableSteps) {
      entries.push(await executeHealStep(step));
    }
    for (const step of skippedSteps) {
      entries.push(await executeHealStep(step));
    }
  }

  const run = {
    id: randomUUID(),
    engine: "maintenance-v0",
    status: summariseMaintenanceStatus(diagnosis, entries, autofix),
    autonomy: {
      domain: "body_internal",
      governance: "audit_only",
      approvalRequired: false,
      mode: "conservative",
    },
    autofix,
    diagnosis,
    executed: entries.filter((entry) => entry.status === "completed"),
    skipped: entries.filter((entry) => entry.status !== "completed"),
    startedAt,
    completedAt: new Date().toISOString(),
  };
  addMaintenanceRun(run);

  await publishEvent("maintenance.completed", { run });
  return run;
}

async function tickMaintenance(body = {}) {
  const now = new Date();
  const force = body.force === true;
  const tickBase = {
    id: randomUUID(),
    at: now.toISOString(),
    force,
    enabled: maintenancePolicy.enabled,
    due: force || isMaintenanceDue(now),
  };

  if (!maintenancePolicy.enabled && !force) {
    const tick = {
      ...tickBase,
      status: "skipped",
      reason: "maintenance_policy_disabled",
      nextDueAt: maintenancePolicy.nextDueAt,
    };
    maintenancePolicy.lastTick = tick;
    persistState();
    await publishEvent("maintenance.tick", { tick, policy: serialiseMaintenancePolicy() });
    return { tick, run: null };
  }

  if (!force && !isMaintenanceDue(now)) {
    const tick = {
      ...tickBase,
      status: "skipped",
      reason: "maintenance_not_due",
      nextDueAt: maintenancePolicy.nextDueAt,
    };
    maintenancePolicy.lastTick = tick;
    persistState();
    await publishEvent("maintenance.tick", { tick, policy: serialiseMaintenancePolicy() });
    return { tick, run: null };
  }

  const run = await runMaintenance({
    ...body,
    autofix: typeof body.autofix === "boolean" ? body.autofix : maintenancePolicy.autofix,
    mode: typeof body.mode === "string" && body.mode.trim() ? body.mode.trim() : maintenancePolicy.mode,
  });
  maintenancePolicy.lastCheckedAt = run.completedAt;
  maintenancePolicy.nextDueAt = calculateNextDueAt(new Date(run.completedAt));
  const tick = {
    ...tickBase,
    status: "ran",
    reason: force ? "forced" : "maintenance_due",
    nextDueAt: maintenancePolicy.nextDueAt,
    runId: run.id,
    runStatus: run.status,
  };
  maintenancePolicy.lastTick = tick;
  persistState();
  await publishEvent("maintenance.tick", { tick, policy: serialiseMaintenancePolicy(), run });
  return { tick, run };
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
      service: "openclaw-system-heal",
      stage: "active",
      host,
      port,
      systemSenseUrl,
      stateFilePath,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/heal/state") {
    sendJson(res, 200, {
      ok: true,
      engine: "heal-v0",
      mode: "conservative-simulated",
      latestDiagnosis,
      latestMaintenanceRun,
      historyCount: healHistory.length,
      maintenanceCount: maintenanceRuns.length,
      maintenancePolicy: serialiseMaintenancePolicy(),
      capabilities: {
        diagnose: true,
        autoFix: true,
        maintenance: true,
        scheduler: true,
        persistentLedger: true,
        restartService: "simulated",
        observeOnlyForHighRisk: true,
      },
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/heal/history") {
    sendJson(res, 200, {
      ok: true,
      items: healHistory,
      count: healHistory.length,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/maintenance/state") {
    sendJson(res, 200, {
      ok: true,
      engine: "maintenance-v0",
      mode: "body-internal-conservative",
      stateFilePath,
      latestRun: latestMaintenanceRun,
      runCount: maintenanceRuns.length,
      healHistoryCount: healHistory.length,
      policy: serialiseMaintenancePolicy(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/maintenance/policy") {
    sendJson(res, 200, {
      ok: true,
      policy: serialiseMaintenancePolicy(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/maintenance/policy") {
    try {
      const body = await readJsonBody(req);
      const policy = updateMaintenancePolicy(body);
      await publishEvent("maintenance.policy.updated", { policy });
      sendJson(res, 200, {
        ok: true,
        policy,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/maintenance/history") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    sendJson(res, 200, {
      ok: true,
      items: maintenanceRuns.slice(0, safeLimit),
      count: maintenanceRuns.length,
      latestRun: latestMaintenanceRun,
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/maintenance/tick") {
    try {
      const body = await readJsonBody(req);
      const { tick, run } = await tickMaintenance(body);
      sendJson(res, 200, {
        ok: true,
        tick,
        run,
        policy: serialiseMaintenancePolicy(),
        historyCount: healHistory.length,
        maintenanceCount: maintenanceRuns.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/maintenance/run") {
    try {
      const body = await readJsonBody(req);
      const run = await runMaintenance(body);
      sendJson(res, 200, {
        ok: true,
        run,
        historyCount: healHistory.length,
        maintenanceCount: maintenanceRuns.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/heal/diagnose") {
    try {
      const body = await readJsonBody(req);
      const diagnosis = await buildDiagnosisFromRequest(body);
      await publishEvent("heal.diagnosed", { diagnosis });
      sendJson(res, 200, {
        ok: true,
        diagnosis,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/heal/autofix") {
    try {
      const body = await readJsonBody(req);
      const diagnosis = await buildDiagnosisFromRequest(body);
      const executableSteps = diagnosis.plan.steps.filter((step) => step.kind === "restart-service");
      const skippedSteps = diagnosis.plan.steps.filter((step) => step.kind !== "restart-service");
      const entries = [];

      for (const step of executableSteps) {
        entries.push(await executeHealStep(step));
      }
      for (const step of skippedSteps) {
        entries.push(await executeHealStep(step));
      }

      sendJson(res, 200, {
        ok: true,
        diagnosis,
        executed: entries.filter((entry) => entry.status === "completed"),
        skipped: entries.filter((entry) => entry.status !== "completed"),
        historyCount: healHistory.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/heal/restart-service") {
    try {
      const body = await readJsonBody(req);
      const service = typeof body.service === "string" && body.service.trim() ? body.service.trim() : null;
      if (!service) {
        sendJson(res, 400, { ok: false, error: "service is required." });
        return;
      }

      const entry = {
        id: randomUUID(),
        action: "restart-service",
        service,
        status: "completed",
        mode: "simulated",
        reason: "Manual restart-service request",
        risk: "medium",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await publishEvent("heal.started", { entry });
      addHistory(entry);
      await publishEvent("heal.completed", { entry });
      sendJson(res, 200, { ok: true, entry });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

loadPersistentState();

server.listen(port, host, async () => {
  console.log(`openclaw-system-heal listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-system-heal", `http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-system-heal",
    url: `http://${host}:${port}`,
  });
});
