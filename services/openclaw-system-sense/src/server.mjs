import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createSystemBodyEvidence } from "./system-body-evidence.mjs";
import { createSystemCommandOperations } from "./system-command-operations.mjs";
import { createSystemFileOperations } from "./system-file-operations.mjs";
import { createSystemHealthGovernance } from "./system-health-governance.mjs";
import { createSystemdInspection } from "./systemd-inspection.mjs";
import { createSystemdNextRepairPlanning } from "./systemd-next-repair-planning.mjs";
import { createSystemdRepairCandidatePlanning } from "./systemd-repair-candidate-planning.mjs";

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
const commandAllowlist = (process.env.OPENCLAW_SYSTEM_COMMAND_ALLOWLIST ?? "echo,printf,pwd,whoami,ls,cat,head,tail,wc,find,grep,rg")
  .split(",")
  .map((command) => command.trim())
  .filter(Boolean);
const commandTimeoutMs = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS ?? "3000", 10);
const commandOutputLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_OUTPUT_LIMIT ?? "8192", 10);
const execFileAsync = promisify(execFile);
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


import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";


const publishEvent = createEventPublisher(eventHubUrl, "openclaw-system-sense");


const {
  resolveAllowedPath,
  buildFileMetadata,
  listFiles,
  searchFiles,
  readTextFile,
  writeTextFile,
  appendTextFile,
  createDirectory,
} = createSystemFileOperations({
  allowedRoots,
  maxFileListLimit,
  maxSearchLimit,
  maxSearchDepth,
  maxFileReadBytes,
  maxFileWriteBytes,
});

const {
  listProcesses,
  buildCommandDryRun,
  executeCommand,
} = createSystemCommandOperations({
  commandAllowlist,
  commandTimeoutMs,
  commandOutputLimit,
  resolveAllowedPath,
  defaultCwd: allowedRoots[0],
});

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
  execFileAsync,
  serviceTimeoutMs,
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

function buildSystemdRepairReason(unit, requestedReason) {
  if (typeof requestedReason === "string" && requestedReason.trim()) {
    return requestedReason.trim();
  }
  if (unit.activeState === "failed" || unit.subState === "failed") {
    return `${unit.unit} reports failed state and may need an operator-approved restart.`;
  }
  if (unit.activeState === "inactive") {
    return `${unit.unit} reports inactive state and may need an operator-reviewed start/restart decision.`;
  }
  return `${unit.unit} is an OpenClaw-owned body unit; this proposal demonstrates the controlled repair path without mutating the host.`;
}

async function buildSystemdRepairPlan({ unit: requestedUnit, reason } = {}) {
  const inventory = await buildSystemdUnitInventory();
  const unit = findInventoryUnit(inventory, requestedUnit);
  if (!unit) {
    const error = new Error("Requested unit is not part of the OpenClaw-owned systemd inventory.");
    error.code = "SYSTEMD_UNIT_NOT_OPENCLAW_OWNED";
    error.details = {
      requestedUnit: requestedUnit ?? null,
      allowedUnits: inventory.units.map((item) => item.unit),
    };
    throw error;
  }

  const risk = classifySystemdRepairRisk(unit);
  const command = {
    command: "systemctl",
    args: ["restart", unit.unit],
    shell: false,
    requiresOperator: true,
  };

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_PLAN_REGISTRY,
    mode: "plan_only",
    canMutate: false,
    canRestart: false,
    wouldExecute: false,
    createdAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      inventoryObservedAt: inventory.observedAt,
      systemdAvailable: inventory.source.systemdAvailable,
      evidence: "operator_visible_repair_proposal",
    },
    target: {
      key: unit.key,
      name: unit.name,
      unit: unit.unit,
      component: unit.component,
      activeState: unit.activeState,
      subState: unit.subState,
      loadState: unit.loadState,
      unitFileState: unit.unitFileState,
      systemdObserved: unit.systemdObserved,
      observation: unit.observation,
    },
    proposal: {
      action: "restart-service",
      command,
      risk,
      reason: buildSystemdRepairReason(unit, reason),
      approvalRequiredForExecution: true,
      dryRunRequiredBeforeExecution: true,
      rollbackNote: `No automatic rollback is attempted. Before any future execution, capture systemctl status ${unit.unit}; after execution, verify health and journal output, then stop and escalate to the operator if the unit remains unhealthy.`,
    },
    governance: {
      domain: "body_internal",
      autonomy: "operator_visible_plan_only",
      hostMutation: false,
      executesCommand: false,
      approvalFlowCreated: false,
      forbiddenUntilFutureMilestone: ["automatic_restart", "blind_restart", "host_mutation"],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-dry-run",
      boundary: "explicit dry-run envelope before any host mutation",
    },
  };
}

async function buildSystemdRepairDryRun({ unit, reason } = {}) {
  const plan = await buildSystemdRepairPlan({ unit, reason });
  const dryRun = buildCommandDryRun({
    command: plan.proposal.command.command,
    args: plan.proposal.command.args,
    intent: "systemd.repair.dry_run",
  });

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_DRY_RUN_REGISTRY,
    mode: "operator_visible_dry_run",
    canMutate: false,
    canRestart: false,
    wouldExecute: false,
    createdAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      planRegistry: plan.registry,
      inventoryRegistry: plan.source.inventoryRegistry,
      evidence: "explicit_operator_visible_dry_run_envelope",
    },
    target: plan.target,
    plan,
    dryRun: {
      ...dryRun,
      risk: "high",
      governance: "require_future_operator_approval",
      requiresApproval: true,
      checks: [
        ...dryRun.checks,
        {
          name: "operator_visible_before_mutation",
          passed: true,
          detail: "Repair command is visible to Observer before any future host mutation milestone.",
        },
        {
          name: "no_restart_executed",
          passed: true,
          detail: "This endpoint does not execute systemctl restart.",
        },
      ],
    },
    governance: {
      domain: "body_internal",
      autonomy: "dry_run_only",
      hostMutation: false,
      executesCommand: false,
      approvalFlowCreated: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    next: {
      recommendedSlice: "operator-reviewed-systemd-repair-execution",
      boundary: "do not execute until a separate whitepaper route review accepts real host mutation",
    },
  };
}

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

  if (req.method === "GET" && requestUrl.pathname === "/system/health") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      system: { ...systemState },
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/health/trends") {
    const trendSummary = await buildHealthTrendSummary();
    sendJson(res, 200, trendSummary);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/next-action") {
    const recommendation = await buildRouteAwareNextActionRecommendation();
    sendJson(res, 200, recommendation);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/recovery-policy") {
    const policy = await buildConservativeRecoveryPolicyExplanation();
    sendJson(res, 200, policy);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-governance-readiness") {
    const readiness = await buildBodyGovernanceReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-timeline") {
    const timeline = await buildBodyEvidenceTimeline();
    sendJson(res, 200, timeline);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-timeline-readiness") {
    const readiness = await buildBodyEvidenceTimelineReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-plan") {
    const plan = await buildBodyEvidenceLedgerPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-route-review") {
    const review = await buildBodyEvidenceLedgerRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-storage-root-plan") {
    const plan = await buildBodyEvidenceLedgerStorageRootPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-storage-root-route-review") {
    const review = await buildBodyEvidenceLedgerStorageRootRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-first-record-plan") {
    const plan = await buildBodyEvidenceLedgerFirstRecordPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-first-record-route-review") {
    const review = await buildBodyEvidenceLedgerFirstRecordRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-readiness") {
    const readiness = await buildBodyEvidenceLedgerReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-demo-status") {
    const status = await buildBodyEvidenceLedgerDemoStatus();
    sendJson(res, 200, status);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-followup-record-plan") {
    const plan = await buildBodyEvidenceLedgerFollowupRecordPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-followup-record-route-review") {
    const review = await buildBodyEvidenceLedgerFollowupRecordRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/phase-2-review") {
    const review = await buildPhase2RouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/body") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      body: systemState.body,
      resources: systemState.resources,
      network: systemState.network,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/services") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      services: systemState.services,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/units") {
    const inventory = await buildSystemdUnitInventory();
    sendJson(res, 200, inventory);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/dependency-map") {
    const dependencyMap = await buildSystemdDependencyMap();
    sendJson(res, 200, dependencyMap);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidates") {
    const assessment = await buildSystemdRepairCandidateAssessment();
    sendJson(res, 200, assessment);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-plan") {
    const plan = await buildSystemdRepairCandidatePlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-task-route") {
    const route = await buildSystemdRepairCandidateTaskRoute();
    sendJson(res, 200, route);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-readiness") {
    const readiness = await buildSystemdRepairCandidateReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-route-review") {
    const review = await buildSystemdRepairCandidateRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-demo-status") {
    const status = await buildSystemdRepairCandidateDemoStatus();
    sendJson(res, 200, status);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/next-repair-scope-review") {
    const review = await buildSystemdNextRepairScopeReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/next-repair-plan") {
    const plan = await buildSystemdNextRepairPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/next-repair-route-review") {
    const review = await buildSystemdNextRepairRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/next-repair-dry-run") {
    const envelope = await buildSystemdNextRepairDryRun();
    sendJson(res, 200, envelope);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/next-repair-task-route") {
    const route = await buildSystemdNextRepairTaskRoute();
    sendJson(res, 200, route);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-plan") {
    try {
      const plan = await buildSystemdRepairPlan({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        reason: requestUrl.searchParams.get("reason"),
      });
      sendJson(res, 200, plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-dry-run") {
    try {
      const envelope = await buildSystemdRepairDryRun({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        reason: requestUrl.searchParams.get("reason"),
      });
      sendJson(res, 200, envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/alerts") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      alerts: systemState.alerts,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/metadata") {
    try {
      const result = resolveAllowedPath(requestUrl.searchParams.get("path"));
      const metadata = buildFileMetadata(result.path);
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
        metadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/list") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = listFiles(requestUrl.searchParams.get("path"), limit);
      await publishEvent(createEventName("system.files.listed"), {
        path: result.path,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/search") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = searchFiles(
        requestUrl.searchParams.get("path"),
        requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit,
      );
      await publishEvent(createEventName("system.files.searched"), {
        path: result.path,
        query: result.query,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/read-text") {
    try {
      const result = readTextFile(requestUrl.searchParams.get("path"));
      await publishEvent(createEventName("system.files.read"), {
        path: result.path,
        contentBytes: result.contentBytes,
        mode: result.mode,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/write-text") {
    try {
      const body = await readJsonBody(req);
      const result = writeTextFile(body);
      await publishEvent(createEventName("system.files.written"), {
        path: result.path,
        contentBytes: result.contentBytes,
        overwrite: result.overwrite,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/append-text") {
    try {
      const body = await readJsonBody(req);
      const result = appendTextFile(body);
      await publishEvent(createEventName("system.files.appended"), {
        path: result.path,
        contentBytes: result.contentBytes,
        previousBytes: result.previousBytes,
        totalBytes: result.totalBytes,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/mkdir") {
    try {
      const body = await readJsonBody(req);
      const result = createDirectory(body);
      await publishEvent(createEventName("system.files.directory_created"), {
        path: result.path,
        recursive: result.recursive,
        created: result.created,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/processes") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = await listProcesses({
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "",
        limit,
      });
      await publishEvent(createEventName("system.processes.listed"), {
        count: result.count,
        query: result.query,
      });
      sendJson(res, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 500, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/dry-run") {
    try {
      const body = await readJsonBody(req);
      const plan = buildCommandDryRun(body);
      await publishEvent(createEventName("system.command.planned"), { plan });
      sendJson(res, 200, {
        ok: true,
        plan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/execute") {
    try {
      const body = await readJsonBody(req);
      const execution = await executeCommand(body);
      await publishEvent(createEventName("system.command.executed"), {
        command: execution.command,
        cwd: execution.cwd,
        exitCode: execution.result.exitCode,
        timedOut: execution.result.timedOut,
        durationMs: execution.result.durationMs,
      });
      sendJson(res, 200, {
        ok: true,
        execution,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/refresh") {
    await refreshSystemState();
    await publishEvent(createEventName(systemState.alerts.length > 0 ? "service.failed" : "system.updated"), {
      alerts: systemState.alerts,
      services: systemState.services,
      resources: systemState.resources,
      body: systemState.body,
    });
    sendJson(res, 200, {
      ok: true,
      system: { ...systemState },
    });
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
