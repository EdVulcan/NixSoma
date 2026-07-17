import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createSystemBodyEvidence } from "./system-body-evidence.mjs";
import { handleSystemBodyEvidenceRoutes } from "./system-body-evidence-routes.mjs";
import { handleSystemCommandRoutes } from "./system-command-routes.mjs";
import { createSystemCommandOperations } from "./system-command-operations.mjs";
import { handleSystemFileRoutes } from "./system-file-routes.mjs";
import { createSystemFileOperations } from "./system-file-operations.mjs";
import { createSystemHealthGovernance } from "./system-health-governance.mjs";
import { handleSystemHealthRoutes } from "./system-health-routes.mjs";
import { createKernelProcessExecCapture } from "./kernel-process-exec-capture.mjs";
import { handleSystemKernelEventRoutes } from "./system-kernel-event-routes.mjs";
import { createSystemdDbusAdapter } from "./systemd-dbus-adapter.mjs";
import { createSystemdInspection } from "./systemd-inspection.mjs";
import { createSystemdNextRepairPlanning } from "./systemd-next-repair-planning.mjs";
import { createSystemdRepairCandidatePlanning } from "./systemd-repair-candidate-planning.mjs";
import { createSystemdRepairProposals } from "./systemd-repair-proposals.mjs";
import { handleSystemdRoutes } from "./systemd-routes.mjs";

const host = process.env.OPENCLAW_SYSTEM_SENSE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SYSTEM_SENSE_PORT ?? "4106", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const stateDir = process.env.OPENCLAW_BODY_STATE_DIR ?? process.cwd();
const diskPath = process.env.OPENCLAW_SYSTEM_SENSE_DISK_PATH ?? stateDir;
const allowedRoots = (process.env.OPENCLAW_SYSTEM_ALLOWED_ROOTS ?? `${stateDir}${path.delimiter}${process.cwd()}`)
  .split(path.delimiter)
  .map((root) => root.trim())
  .filter(Boolean)
  .map((root) => path.resolve(root));
const memoryWarningPercent = Number.parseInt(process.env.OPENCLAW_SYSTEM_MEMORY_WARNING_PERCENT ?? "90", 10);
const diskWarningPercent = Number.parseInt(process.env.OPENCLAW_SYSTEM_DISK_WARNING_PERCENT ?? "90", 10);
const serviceTimeoutMs = Number.parseInt(process.env.OPENCLAW_SYSTEM_SERVICE_TIMEOUT_MS ?? "1500", 10);
const maxFileListLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_LIST_LIMIT ?? "100", 10);
const maxSearchLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_SEARCH_LIMIT ?? "100", 10);
const maxSearchDepth = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_SEARCH_DEPTH ?? "4", 10);
const maxFileReadBytes = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_READ_LIMIT ?? "65536", 10);
const maxFileWriteBytes = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_WRITE_LIMIT ?? "65536", 10);
const commandAllowlist = (process.env.OPENCLAW_SYSTEM_COMMAND_ALLOWLIST ?? "echo,printf,pwd,whoami,ls,cat,head,tail,wc")
  .split(",")
  .map((command) => command.trim())
  .filter(Boolean);
const commandTimeoutMs = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS ?? "3000", 10);
const commandOutputLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_OUTPUT_LIMIT ?? "8192", 10);
const execFileAsync = promisify(execFile);
const kernelProcessExecCapture = createKernelProcessExecCapture({
  enabled: process.env.OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED === "1",
  probeCommand: process.env.OPENCLAW_KERNEL_EVENT_PROBE ?? "",
  durationMs: process.env.OPENCLAW_KERNEL_EVENT_CAPTURE_DURATION_MS ?? "1000",
  maxEvents: process.env.OPENCLAW_KERNEL_EVENT_CAPTURE_MAX_EVENTS ?? "128",
  execFile: execFileAsync,
});
const SYSTEMD_UNIT_INVENTORY_REGISTRY = "openclaw-systemd-unit-inventory-v0";
const SYSTEMD_DEPENDENCY_MAP_REGISTRY = "openclaw-systemd-dependency-map-v0";
const HEALTH_TREND_SUMMARY_REGISTRY = "openclaw-health-trend-summary-v0";
const ROUTE_AWARE_NEXT_ACTION_REGISTRY = "openclaw-route-aware-next-action-v0";
const CONSERVATIVE_RECOVERY_POLICY_REGISTRY = "openclaw-conservative-recovery-policy-v0";
const BODY_GOVERNANCE_READINESS_REGISTRY = "openclaw-body-governance-readiness-v0";
const BODY_EVIDENCE_TIMELINE_REGISTRY = "openclaw-body-evidence-timeline-v0";
const BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY = "openclaw-body-evidence-timeline-readiness-v0";
const BODY_EVIDENCE_LEDGER_PLAN_REGISTRY = "openclaw-body-evidence-ledger-plan-v0";
const BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-route-review-v0";
const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY = "openclaw-body-evidence-ledger-storage-root-plan-v0";
const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-storage-root-route-review-v0";
const BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY = "openclaw-body-evidence-ledger-first-record-plan-v0";
const BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-first-record-route-review-v0";
const BODY_EVIDENCE_LEDGER_READINESS_REGISTRY = "openclaw-body-evidence-ledger-readiness-v0";
const BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY = "openclaw-body-evidence-ledger-demo-status-v0";
const BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_PLAN_REGISTRY = "openclaw-body-evidence-ledger-followup-record-plan-v0";
const BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-followup-record-route-review-v0";
const SYSTEMD_NEXT_REPAIR_SCOPE_REVIEW_REGISTRY = "openclaw-systemd-next-repair-scope-review-v0";
const SYSTEMD_NEXT_REPAIR_PLAN_REGISTRY = "openclaw-systemd-next-repair-plan-v0";
const SYSTEMD_NEXT_REPAIR_ROUTE_REVIEW_REGISTRY = "openclaw-systemd-next-repair-route-review-v0";
const SYSTEMD_NEXT_REPAIR_DRY_RUN_REGISTRY = "openclaw-systemd-next-repair-dry-run-v0";
const SYSTEMD_NEXT_REPAIR_TASK_ROUTE_REGISTRY = "openclaw-systemd-next-repair-task-route-v0";
const PHASE_2_ROUTE_REVIEW_REGISTRY = "openclaw-phase-2-route-review-v0";
const SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY = "openclaw-systemd-repair-candidate-assessment-v0";
const SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY = "openclaw-systemd-repair-candidate-plan-v0";
const SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY = "openclaw-systemd-repair-candidate-task-route-v0";
const SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY = "openclaw-systemd-repair-candidate-readiness-v0";
const SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY = "openclaw-systemd-repair-candidate-route-review-v0";
const SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY = "openclaw-systemd-repair-candidate-demo-status-v0";
const SYSTEMD_REPAIR_PLAN_REGISTRY = "openclaw-systemd-repair-plan-v0";
const SYSTEMD_REPAIR_DRY_RUN_REGISTRY = "openclaw-systemd-repair-dry-run-v0";
const MAX_HEALTH_TREND_SNAPSHOTS = 24;

const serviceTargets = {
  core: process.env.OPENCLAW_CORE_URL ?? "http://127.0.0.1:4100",
  eventHub: process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101",
  sessionManager: process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102",
  browserRuntime: process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103",
  screenSense: process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104",
  screenAct: process.env.OPENCLAW_SCREEN_ACT_URL ?? "http://127.0.0.1:4105",
  systemHeal: process.env.OPENCLAW_SYSTEM_HEAL_URL ?? "http://127.0.0.1:4107",
};

const configuredUserOwnedUnits = process.env.OPENCLAW_BODY_USER_OWNED_UNITS === undefined
  ? null
  : new Set(process.env.OPENCLAW_BODY_USER_OWNED_UNITS
    .split(",")
    .map((unit) => unit.trim())
    .filter(Boolean)
    .map((unit) => unit.endsWith(".service") ? unit : `${unit}.service`));

const openClawSystemdUnitSpecs = [
  {
    key: "eventHub",
    name: "openclaw-event-hub",
    description: "OpenClaw Event Hub",
    component: "body",
    url: serviceTargets.eventHub,
    after: [],
  },
  {
    key: "core",
    name: "openclaw-core",
    description: "OpenClaw Core Control Plane",
    component: "body",
    url: serviceTargets.core,
    after: ["openclaw-event-hub"],
  },
  {
    key: "sessionManager",
    name: "openclaw-session-manager",
    description: "OpenClaw AI Work View Session Manager",
    component: "body",
    url: serviceTargets.sessionManager,
    after: ["openclaw-event-hub"],
  },
  {
    key: "browserRuntime",
    name: "openclaw-browser-runtime",
    description: "OpenClaw Browser Runtime",
    component: "body",
    url: serviceTargets.browserRuntime,
    after: ["openclaw-event-hub", "openclaw-session-manager"],
  },
  {
    key: "screenSense",
    name: "openclaw-screen-sense",
    description: "OpenClaw Screen Sense",
    component: "body",
    url: serviceTargets.screenSense,
    after: ["openclaw-event-hub", "openclaw-session-manager", "openclaw-browser-runtime"],
  },
  {
    key: "screenAct",
    name: "openclaw-screen-act",
    description: "OpenClaw Screen Act",
    component: "body",
    url: serviceTargets.screenAct,
    after: ["openclaw-event-hub", "openclaw-screen-sense", "openclaw-browser-runtime"],
  },
  {
    key: "systemSense",
    name: "openclaw-system-sense",
    description: "OpenClaw System Sense",
    component: "body",
    url: `http://${host}:${port}`,
    after: ["openclaw-event-hub", "openclaw-core"],
  },
  {
    key: "systemHeal",
    name: "openclaw-system-heal",
    description: "OpenClaw System Heal",
    component: "body",
    url: serviceTargets.systemHeal,
    after: ["openclaw-event-hub", "openclaw-system-sense"],
  },
  {
    key: "observerUi",
    name: "observer-ui",
    description: "OpenClaw Observer UI",
    component: "observer",
    url: process.env.OBSERVER_UI_URL ?? `http://127.0.0.1:${process.env.OBSERVER_UI_PORT ?? "4170"}`,
    after: ["openclaw-core", "openclaw-event-hub", "openclaw-session-manager"],
  },
].map((spec) => ({
  ...spec,
  unit: `${spec.name}.service`,
  expectedManager: configuredUserOwnedUnits === null
    ? "unknown"
    : configuredUserOwnedUnits.has(`${spec.name}.service`) ? "user" : "system",
}));

async function refreshServiceRegistry() {
  try {
    const response = await fetch(`${eventHubUrl}/services/registry`);
    const data = await response.json();
    if (data.ok && data.services) {
      const keyMap = {
        "openclaw-core": "core",
        "openclaw-event-hub": "eventHub",
        "openclaw-session-manager": "sessionManager",
        "openclaw-browser-runtime": "browserRuntime",
        "openclaw-screen-sense": "screenSense",
        "openclaw-screen-act": "screenAct",
        "openclaw-system-heal": "systemHeal"
      };

      for (const [name, info] of Object.entries(data.services)) {
        const key = keyMap[name];
        if (key) {
          serviceTargets[key] = info.url;
          const spec = openClawSystemdUnitSpecs.find(s => s.key === key);
          if (spec) {
            spec.url = info.url;
            spec.healthUrl = `${info.url}/health`;
          }
        }
      }
    }
  } catch (error) {
    // Ignore and keep current values
  }
}

refreshServiceRegistry().catch(() => {});
setInterval(refreshServiceRegistry, 30_000);

const systemState = {
  timestamp: new Date().toISOString(),
  body: {},
  services: {},
  resources: {
    cpuPercent: 0,
    loadAverage: [],
    memoryPercent: 0,
    diskPercent: 0,
  },
  network: {
    online: false,
  },
  alerts: [],
};
const healthSnapshots = [];


import { corsHeaders, sendJson, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";


const publishEvent = createEventPublisher(eventHubUrl, "openclaw-system-sense");
const publishAuditEvent = createEventPublisher(eventHubUrl, "openclaw-system-sense", fetch, { required: true });


const systemFileOperations = createSystemFileOperations({
  allowedRoots,
  maxFileListLimit,
  maxSearchLimit,
  maxSearchDepth,
  maxFileReadBytes,
  maxFileWriteBytes,
});

const systemCommandOperations = createSystemCommandOperations({
  commandAllowlist,
  commandTimeoutMs,
  commandOutputLimit,
  resolveAllowedPath: systemFileOperations.resolveAllowedPath,
  defaultCwd: allowedRoots[0],
});
const { buildCommandDryRun } = systemCommandOperations;

const {
  buildBodyState,
  buildResourceState,
  recordHealthSnapshot,
  buildHealthTrendSummary,
  buildRouteAwareNextActionRecommendation,
  buildConservativeRecoveryPolicyExplanation,
  buildBodyGovernanceReadiness,
  buildPhase2RouteReview,
} = createSystemHealthGovernance({
  stateDir,
  diskPath,
  systemState,
  healthSnapshots,
  maxHealthTrendSnapshots: MAX_HEALTH_TREND_SNAPSHOTS,
  refreshSystemState: () => refreshSystemState(),
  buildSystemdDependencyMap: () => buildSystemdDependencyMap(),
  registries: {
    healthTrendSummary: HEALTH_TREND_SUMMARY_REGISTRY,
    routeAwareNextAction: ROUTE_AWARE_NEXT_ACTION_REGISTRY,
    conservativeRecoveryPolicy: CONSERVATIVE_RECOVERY_POLICY_REGISTRY,
    bodyGovernanceReadiness: BODY_GOVERNANCE_READINESS_REGISTRY,
    phase2RouteReview: PHASE_2_ROUTE_REVIEW_REGISTRY,
  },
});

const systemHealthRouteBuilders = {
  buildHealthTrendSummary,
  buildRouteAwareNextActionRecommendation,
  buildConservativeRecoveryPolicyExplanation,
  buildBodyGovernanceReadiness,
  buildPhase2RouteReview,
};

async function checkService(name, baseUrl) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serviceTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return {
      name,
      ok: response.ok && !!data?.ok,
      status: response.ok && !!data?.ok ? "healthy" : "unhealthy",
      url: baseUrl,
      detail: data?.service ?? name,
      stage: data?.stage ?? null,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      name,
      ok: false,
      status: "offline",
      url: baseUrl,
      detail: "offline",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchServiceJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serviceTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

const {
  buildSystemdUnitInventory,
  buildSystemdDependencyMap,
} = createSystemdInspection({
  systemdAdapter: createSystemdDbusAdapter({ timeoutMs: serviceTimeoutMs }),
  openClawSystemdUnitSpecs,
  registries: {
    systemdUnitInventory: SYSTEMD_UNIT_INVENTORY_REGISTRY,
    systemdDependencyMap: SYSTEMD_DEPENDENCY_MAP_REGISTRY,
  },
});

function normaliseUnitName(value) {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : "openclaw-browser-runtime.service";
  return raw.endsWith(".service") ? raw : `${raw}.service`;
}

function findInventoryUnit(inventory, unitName) {
  const normalised = normaliseUnitName(unitName);
  return inventory.units.find((unit) => {
    return unit.unit === normalised
      || unit.name === normalised.replace(/\.service$/, "")
      || unit.key === unitName;
  }) ?? null;
}

const {
  buildSystemdRepairCandidateAssessment,
  buildSystemdRepairCandidatePlan,
  buildSystemdRepairCandidateTaskRoute,
  buildSystemdRepairCandidateReadiness,
  buildSystemdRepairCandidateRouteReview,
  buildSystemdRepairCandidateDemoStatus,
} = createSystemdRepairCandidatePlanning({
  buildSystemdUnitInventory,
  buildSystemdDependencyMap,
  buildHealthTrendSummary,
  findInventoryUnit,
  registries: {
    systemdRepairCandidateAssessment: SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY,
    systemdRepairCandidatePlan: SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY,
    systemdRepairCandidateTaskRoute: SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY,
    systemdRepairCandidateReadiness: SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY,
    systemdRepairCandidateRouteReview: SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY,
    systemdRepairCandidateDemoStatus: SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY,
  },
});

const {
  buildBodyEvidenceTimeline,
  buildBodyEvidenceTimelineReadiness,
  buildBodyEvidenceLedgerPlan,
  buildBodyEvidenceLedgerRouteReview,
  buildBodyEvidenceLedgerStorageRootPlan,
  buildBodyEvidenceLedgerStorageRootRouteReview,
  buildBodyEvidenceLedgerFirstRecordPlan,
  buildBodyEvidenceLedgerFirstRecordRouteReview,
  buildBodyEvidenceLedgerReadiness,
  buildBodyEvidenceLedgerDemoStatus,
  buildBodyEvidenceLedgerFollowupRecordPlan,
  buildBodyEvidenceLedgerFollowupRecordRouteReview,
} = createSystemBodyEvidence({
  buildSystemdDependencyMap,
  buildHealthTrendSummary,
  buildRouteAwareNextActionRecommendation,
  buildConservativeRecoveryPolicyExplanation,
  buildBodyGovernanceReadiness,
  buildPhase2RouteReview,
  buildSystemdRepairCandidateDemoStatus,
  fetchNextRepairDemoStatus: () => fetchServiceJson(`${serviceTargets.core}/phase-2/next-repair-demo-status`),
  registries: {
    bodyEvidenceTimeline: BODY_EVIDENCE_TIMELINE_REGISTRY,
    bodyEvidenceTimelineReadiness: BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY,
    bodyEvidenceLedgerPlan: BODY_EVIDENCE_LEDGER_PLAN_REGISTRY,
    bodyEvidenceLedgerRouteReview: BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY,
    bodyEvidenceLedgerStorageRootPlan: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY,
    bodyEvidenceLedgerStorageRootRouteReview: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY,
    bodyEvidenceLedgerFirstRecordPlan: BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY,
    bodyEvidenceLedgerFirstRecordRouteReview: BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY,
    bodyEvidenceLedgerReadiness: BODY_EVIDENCE_LEDGER_READINESS_REGISTRY,
    bodyEvidenceLedgerDemoStatus: BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY,
    bodyEvidenceLedgerFollowupRecordPlan: BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_PLAN_REGISTRY,
    bodyEvidenceLedgerFollowupRecordRouteReview: BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_ROUTE_REVIEW_REGISTRY,
  },
});

const bodyEvidenceRouteBuilders = {
  buildBodyEvidenceTimeline,
  buildBodyEvidenceTimelineReadiness,
  buildBodyEvidenceLedgerPlan,
  buildBodyEvidenceLedgerRouteReview,
  buildBodyEvidenceLedgerStorageRootPlan,
  buildBodyEvidenceLedgerStorageRootRouteReview,
  buildBodyEvidenceLedgerFirstRecordPlan,
  buildBodyEvidenceLedgerFirstRecordRouteReview,
  buildBodyEvidenceLedgerReadiness,
  buildBodyEvidenceLedgerDemoStatus,
  buildBodyEvidenceLedgerFollowupRecordPlan,
  buildBodyEvidenceLedgerFollowupRecordRouteReview,
};

const kernelEventRouteBuilders = {
  buildKernelProcessExecEvents: () => kernelProcessExecCapture.capture(),
};

const {
  buildSystemdNextRepairScopeReview,
  buildSystemdNextRepairPlan,
  buildSystemdNextRepairRouteReview,
  buildSystemdNextRepairDryRun,
  buildSystemdNextRepairTaskRoute,
} = createSystemdNextRepairPlanning({
  buildSystemdUnitInventory,
  buildSystemdDependencyMap,
  buildBodyEvidenceLedgerDemoStatus,
  buildCommandDryRun,
  findInventoryUnit,
  classifySystemdRepairRisk,
  registries: {
    systemdNextRepairScopeReview: SYSTEMD_NEXT_REPAIR_SCOPE_REVIEW_REGISTRY,
    systemdNextRepairPlan: SYSTEMD_NEXT_REPAIR_PLAN_REGISTRY,
    systemdNextRepairRouteReview: SYSTEMD_NEXT_REPAIR_ROUTE_REVIEW_REGISTRY,
    systemdNextRepairDryRun: SYSTEMD_NEXT_REPAIR_DRY_RUN_REGISTRY,
    systemdNextRepairTaskRoute: SYSTEMD_NEXT_REPAIR_TASK_ROUTE_REGISTRY,
  },
});
function classifySystemdRepairRisk(unit) {
  if (unit.name === "openclaw-event-hub" || unit.name === "openclaw-core") {
    return "high";
  }
  return "medium";
}

const {
  buildSystemdRepairPlan,
  buildSystemdRepairDryRun,
} = createSystemdRepairProposals({
  buildSystemdUnitInventory,
  buildCommandDryRun,
  findInventoryUnit,
  classifySystemdRepairRisk,
  registries: {
    systemdRepairPlan: SYSTEMD_REPAIR_PLAN_REGISTRY,
    systemdRepairDryRun: SYSTEMD_REPAIR_DRY_RUN_REGISTRY,
  },
});

const systemdRouteBuilders = {
  buildSystemdUnitInventory,
  buildSystemdDependencyMap,
  buildSystemdRepairCandidateAssessment,
  buildSystemdRepairCandidatePlan,
  buildSystemdRepairCandidateTaskRoute,
  buildSystemdRepairCandidateReadiness,
  buildSystemdRepairCandidateRouteReview,
  buildSystemdRepairCandidateDemoStatus,
  buildSystemdNextRepairScopeReview,
  buildSystemdNextRepairPlan,
  buildSystemdNextRepairRouteReview,
  buildSystemdNextRepairDryRun,
  buildSystemdNextRepairTaskRoute,
  buildSystemdRepairPlan,
  buildSystemdRepairDryRun,
};
async function refreshSystemState() {
  const entries = await Promise.all(
    Object.entries(serviceTargets).map(async ([name, url]) => [name, await checkService(name, url)]),
  );

  const services = Object.fromEntries(entries);
  const alerts = Object.values(services)
    .filter((service) => !service.ok)
    .map((service) => ({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "service.offline",
      source: service.name,
      message: `${service.name} is offline`,
    }));
  const resources = buildResourceState();

  if (resources.memoryPercent >= memoryWarningPercent) {
    alerts.push({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "resource.memory.high",
      source: "openclaw-system-sense",
      message: `Memory usage is ${resources.memoryPercent}%`,
    });
  }

  if (resources.disk.available && resources.diskPercent >= diskWarningPercent) {
    alerts.push({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "resource.disk.high",
      source: "openclaw-system-sense",
      message: `Disk usage is ${resources.diskPercent}% at ${diskPath}`,
    });
  }

  systemState.timestamp = new Date().toISOString();
  systemState.body = buildBodyState();
  systemState.services = services;
  systemState.resources = resources;
  systemState.network = {
    online: Object.values(services).some((service) => service.ok),
    checkedTargets: Object.keys(serviceTargets).length,
  };
  systemState.alerts = alerts;
  recordHealthSnapshot();
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
      service: "openclaw-system-sense",
      stage: "active",
      host,
      port,
    });
    return;
  }

  if (await handleSystemHealthRoutes({
    req,
    res,
    requestUrl,
    refreshSystemState,
    getSystemState: () => systemState,
    publishEvent,
    builders: systemHealthRouteBuilders,
  })) {
    return;
  }

  if (await handleSystemBodyEvidenceRoutes({
    req,
    res,
    requestUrl,
    builders: bodyEvidenceRouteBuilders,
  })) {
    return;
  }

  if (await handleSystemKernelEventRoutes({
    req,
    res,
    requestUrl,
    builders: kernelEventRouteBuilders,
  })) {
    return;
  }

  if (await handleSystemdRoutes({
    req,
    res,
    requestUrl,
    builders: systemdRouteBuilders,
  })) {
    return;
  }

  if (await handleSystemFileRoutes({
    req,
    res,
    requestUrl,
    publishEvent,
    publishAuditEvent,
    allowedRoots,
    operations: systemFileOperations,
  })) {
    return;
  }

  if (await handleSystemCommandRoutes({
    req,
    res,
    requestUrl,
    publishEvent,
    publishAuditEvent,
    operations: systemCommandOperations,
  })) {
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-system-sense listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-system-sense", `http://${host}:${port}`);
  await publishEvent(createEventName("service.started"), {
    service: "openclaw-system-sense",
    url: `http://${host}:${port}`,
  });
});
