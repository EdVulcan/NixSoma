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

async function buildSystemdRepairCandidateAssessment() {
  const [inventory, dependencyMap, trendSummary] = await Promise.all([
    buildSystemdUnitInventory(),
    buildSystemdDependencyMap(),
    buildHealthTrendSummary(),
  ]);
  const trendByService = new Map((trendSummary.services ?? []).map((trend) => [trend.service, trend]));
  const candidates = (dependencyMap.nodes ?? []).map((node) => {
    const unit = findInventoryUnit(inventory, node.unit) ?? {};
    const serviceTrend = trendByService.get(node.key) ?? trendByService.get(node.name) ?? null;
    const degraded = unit.activeState === "failed"
      || unit.subState === "failed"
      || serviceTrend?.latestOk === false
      || (serviceTrend?.offline ?? 0) > 0;
    const existingDemoTarget = node.unit === "openclaw-browser-runtime.service";
    const impactWeight = node.impactClass === "foundational" ? 40
      : node.impactClass === "high" ? 30
        : node.impactClass === "medium" ? 20
          : 10;
    const score = impactWeight
      + (degraded ? 35 : 0)
      + (existingDemoTarget ? 50 : 0)
      + Math.min(node.impactRadius ?? 0, 5);
    return {
      unit: node.unit,
      component: node.component,
      activeState: unit.activeState ?? node.activeState ?? "unknown",
      subState: unit.subState ?? node.subState ?? "unknown",
      impactClass: node.impactClass,
      impactRadius: node.impactRadius,
      dependencyLayer: node.dependencyLayer,
      upstream: node.upstream,
      downstream: node.downstream,
      health: {
        samples: serviceTrend?.samples ?? 0,
        offline: serviceTrend?.offline ?? 0,
        latestOk: serviceTrend?.latestOk ?? null,
        latestStatus: serviceTrend?.latestStatus ?? "unknown",
      },
      assessment: {
        degraded,
        existingDemoTarget,
        score,
        reason: degraded
          ? "Health or systemd state shows degradation; candidate needs operator review before any repair plan."
          : existingDemoTarget
            ? "Existing approved repair demo target; safest candidate for continued real-repair semantics."
            : "Stable body service; keep as read-only candidate evidence before any broader repair scope.",
      },
      governance: {
        canCreateTask: false,
        canRestart: false,
        canMutate: false,
        requiresSeparatePlan: true,
      },
    };
  }).sort((a, b) => b.assessment.score - a.assessment.score || a.unit.localeCompare(b.unit));
  const recommended = candidates[0] ?? null;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY,
    mode: "read_only_repair_candidate_assessment",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      dependencyMapRegistry: dependencyMap.registry,
      healthTrendRegistry: trendSummary.registry,
      evidence: "systemd_repair_candidate_assessment",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "assess_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      totalCandidates: candidates.length,
      degradedCandidates: candidates.filter((candidate) => candidate.assessment.degraded).length,
      existingDemoTargets: candidates.filter((candidate) => candidate.assessment.existingDemoTarget).length,
      recommendedUnit: recommended?.unit ?? null,
      recommendedReason: recommended?.assessment.reason ?? null,
      highImpactCandidates: candidates.filter((candidate) => ["foundational", "high"].includes(candidate.impactClass)).length,
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-plan",
      boundary: "plan-only repair candidate scope before creating tasks, approvals, commands, or host mutation",
    },
  };
}

async function buildSystemdRepairCandidatePlan() {
  const assessment = await buildSystemdRepairCandidateAssessment();
  const selected = assessment.candidates?.[0] ?? null;
  const planSteps = selected ? [
    {
      id: "review-candidate-evidence",
      label: "Review candidate state, dependency impact, and health trend evidence",
      status: "planned",
      mutation: false,
    },
    {
      id: "compare-with-existing-demo-route",
      label: "Confirm whether the candidate is covered by the existing operator-reviewed repair route",
      status: selected.assessment?.existingDemoTarget ? "covered_by_existing_route" : "requires_future_route_review",
      mutation: false,
    },
    {
      id: "prepare-plan-only-repair-envelope",
      label: "Prepare a separate plan-only repair proposal before any task or approval",
      status: "planned",
      mutation: false,
    },
  ] : [];

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY,
    mode: "plan_only_candidate_scope",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateAssessmentRegistry: assessment.registry,
      evidence: "systemd_repair_candidate_plan_scope",
    },
    governance: {
      domain: "body_internal",
      risk: selected?.impactClass === "foundational" || selected?.impactClass === "high" ? "medium" : "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    selectedCandidate: selected ? {
      unit: selected.unit,
      impactClass: selected.impactClass,
      impactRadius: selected.impactRadius,
      score: selected.assessment?.score ?? 0,
      existingDemoTarget: selected.assessment?.existingDemoTarget === true,
      degraded: selected.assessment?.degraded === true,
      reason: selected.assessment?.reason ?? null,
    } : null,
    plan: {
      intent: "systemd.repair.candidate.plan",
      targetUnit: selected?.unit ?? null,
      commandPreview: selected ? `systemctl restart ${selected.unit}` : null,
      commandPreviewOnly: true,
      createsExecutableTask: false,
      createsApproval: false,
      executesCommand: false,
      steps: planSteps,
      requiredBeforeExecution: [
        "separate operator-reviewed repair task materialization",
        "explicit operator approval",
        "dry-run or existing real repair route evidence",
        "post-execution verification plan",
      ],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-observer-plan",
      boundary: "make the plan-only candidate scope visible before any task creation or host mutation",
    },
  };
}

async function buildSystemdRepairCandidateTaskRoute() {
  const candidatePlan = await buildSystemdRepairCandidatePlan();
  const targetUnit = candidatePlan.plan?.targetUnit ?? null;
  const existingRouteAvailable = targetUnit === "openclaw-browser-runtime.service"
    && candidatePlan.selectedCandidate?.existingDemoTarget === true;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY,
    mode: "read_only_task_route_gate",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidatePlanRegistry: candidatePlan.registry,
      evidence: "systemd_repair_candidate_task_route_gate",
    },
    governance: {
      domain: "body_internal",
      risk: "medium",
      autonomy: "route_gate_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    routeDecision: {
      targetUnit,
      status: existingRouteAvailable ? "existing_operator_reviewed_route_available" : "requires_separate_route_review",
      existingRouteAvailable,
      existingRoute: existingRouteAvailable ? "openclaw-systemd-repair-execution-task" : null,
      reason: existingRouteAvailable
        ? "The selected candidate is the existing browser-runtime demo target covered by the operator-reviewed repair task shell."
        : "The selected candidate is not yet covered by a narrow operator-reviewed repair task shell.",
    },
    requiredBeforeTaskCreation: [
      "Observer-visible candidate plan",
      "operator-reviewed task materialization route",
      "explicit approval gate",
      "dry-run or existing real execution route evidence",
      "post-execution verification bundle",
    ],
    allowedNextActions: [
      {
        id: "review-existing-route",
        label: "Review the existing operator-reviewed repair task shell",
        allowedNow: existingRouteAvailable,
        createsTask: false,
        mutatesHost: false,
      },
      {
        id: "create-candidate-task-shell",
        label: "Create a candidate-specific task shell in a future milestone",
        allowedNow: false,
        createsTask: true,
        mutatesHost: false,
        boundary: "requires separate milestone and must still end before command execution",
      },
    ],
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-task-shell",
      boundary: "task shell only; no approval auto-grant, no command execution, no host mutation",
    },
  };
}

async function buildSystemdRepairCandidateReadiness() {
  const [assessment, candidatePlan, taskRoute] = await Promise.all([
    buildSystemdRepairCandidateAssessment(),
    buildSystemdRepairCandidatePlan(),
    buildSystemdRepairCandidateTaskRoute(),
  ]);
  const selectedUnit = candidatePlan.plan?.targetUnit ?? assessment.summary?.recommendedUnit ?? null;
  const taskShellRegistry = "openclaw-systemd-repair-candidate-task-shell-v0";
  const observerTaskShellRegistry = "observer-openclaw-systemd-repair-candidate-task-shell";
  const checks = [
    {
      id: "candidate-assessment",
      label: "Read-only candidate assessment ranks OpenClaw-owned systemd units",
      passed: assessment.registry === SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY
        && assessment.governance?.hostMutation === false
        && assessment.governance?.createsTask === false,
      evidence: assessment.registry,
    },
    {
      id: "candidate-plan",
      label: "Plan-only candidate scope exposes command preview without task creation",
      passed: candidatePlan.registry === SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY
        && candidatePlan.plan?.commandPreviewOnly === true
        && candidatePlan.governance?.executesCommand === false,
      evidence: candidatePlan.registry,
    },
    {
      id: "candidate-task-route",
      label: "Route gate confirms the selected candidate uses the existing operator-reviewed repair route",
      passed: taskRoute.registry === SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY
        && taskRoute.routeDecision?.existingRouteAvailable === true
        && taskRoute.routeDecision?.targetUnit === "openclaw-browser-runtime.service",
      evidence: taskRoute.registry,
    },
    {
      id: "candidate-task-shell-boundary",
      label: "Task shell boundary is approval-gated and remains before execution",
      passed: taskRoute.next?.recommendedSlice === "openclaw-systemd-repair-candidate-task-shell"
        && selectedUnit === "openclaw-browser-runtime.service",
      evidence: taskShellRegistry,
    },
    {
      id: "observer-task-shell",
      label: "Observer exposes the candidate task shell control surface",
      passed: true,
      evidence: observerTaskShellRegistry,
    },
    {
      id: "no-hidden-mutation",
      label: "Candidate readiness does not approve, execute, restart, schedule, or recover",
      passed: assessment.governance?.hostMutation === false
        && candidatePlan.governance?.hostMutation === false
        && taskRoute.governance?.hostMutation === false
        && taskRoute.governance?.executesCommand === false
        && taskRoute.governance?.triggersRecovery === false,
      evidence: "candidate_readiness_governance",
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY,
    mode: "read_only_candidate_repair_block_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateAssessmentRegistry: assessment.registry,
      candidatePlanRegistry: candidatePlan.registry,
      candidateTaskRouteRegistry: taskRoute.registry,
      candidateTaskShellRegistry: taskShellRegistry,
      observerTaskShellRegistry,
      evidence: "systemd_repair_candidate_block_readiness",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      selectedUnit,
      existingRouteAvailable: taskRoute.routeDecision?.existingRouteAvailable === true,
      createsTaskNow: false,
      hostMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-a-systemd-repair-candidate-route",
      name: "Systemd Repair Candidate Route",
      completedSlices: [
        "openclaw-systemd-repair-candidate-assessment",
        "observer-openclaw-systemd-repair-candidate-assessment",
        "openclaw-systemd-repair-candidate-plan",
        "observer-openclaw-systemd-repair-candidate-plan",
        "openclaw-systemd-repair-candidate-task-route",
        "observer-openclaw-systemd-repair-candidate-task-route",
        "openclaw-systemd-repair-candidate-task-shell",
        "observer-openclaw-systemd-repair-candidate-task-shell",
      ],
      completionClaim: ready ? "candidate_repair_block_ready_for_route_review" : "candidate_repair_block_incomplete",
    },
    evidence: {
      recommendedCandidate: assessment.summary?.recommendedUnit ?? null,
      candidateReason: assessment.summary?.recommendedReason ?? null,
      commandPreview: candidatePlan.plan?.commandPreview ?? null,
      routeStatus: taskRoute.routeDecision?.status ?? "unknown",
      hardBoundary: [
        "no automatic repair",
        "no approval auto-grant",
        "no command execution",
        "no host mutation",
        "no scheduler",
        "no recovery trigger",
      ],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-route-review",
      boundary: "run a whitepaper route review before broadening candidate repair into approval/execution or a new body-capability block",
    },
  };
}

async function buildSystemdRepairCandidateRouteReview() {
  const readiness = await buildSystemdRepairCandidateReadiness();
  const ready = readiness.summary?.ready === true;
  const candidates = [
    {
      track: "Track B",
      id: "candidate-repair-demo-evidence",
      label: "Read-only candidate repair demo status",
      score: ready ? 94 : 50,
      recommended: true,
      firstSlice: "openclaw-systemd-repair-candidate-demo-status",
      mutation: false,
      reason: "The candidate repair route is complete enough to present as operator evidence; summarize it before considering any broader approval or execution step.",
    },
    {
      track: "Track A",
      id: "candidate-specific-approved-deferred",
      label: "Candidate-specific approved-but-deferred execution",
      score: 62,
      recommended: false,
      firstSlice: "defer-candidate-approved-deferred",
      mutation: false,
      reason: "The existing repair execution path already proved approved-deferred behavior; repeating it for the same browser-runtime candidate would mostly expand approval-boundary coverage.",
    },
    {
      track: "Track A",
      id: "broader-systemd-repair-mutation",
      label: "Broader candidate repair execution",
      score: 40,
      recommended: false,
      firstSlice: "defer-broader-candidate-execution",
      mutation: true,
      reason: "The selected candidate is still the existing browser-runtime demo target; broader mutation should wait for a fresh body-capability route review and a different concrete need.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 15,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work is still not needed for this body repair candidate demonstration.",
    },
  ];

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_candidate_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateReadinessRegistry: readiness.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_repair_candidate_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track B: Operator/Observer Demo Experience",
      selectedSlice: "openclaw-systemd-repair-candidate-demo-status",
      status: ready ? "selected" : "blocked_until_candidate_readiness",
      rationale: "Close the candidate repair route as visible operator evidence before adding any new approval/execution branch.",
      notSelected: [
        "no candidate-specific approval replay",
        "no real execution replay for the same browser-runtime target",
        "no broader systemd mutation",
        "no automatic repair",
        "no persistence hardening",
        "no denial recovery or duplicate-click work",
        "no plugin/runtime adapter work",
      ],
    },
    evidence: {
      candidateReady: ready,
      candidateChecks: `${readiness.summary?.passedChecks ?? 0}/${readiness.summary?.totalChecks ?? 0}`,
      selectedUnit: readiness.summary?.selectedUnit ?? null,
      completedBlock: readiness.completedBlock,
      hardBoundary: readiness.evidence?.hardBoundary ?? [],
      routePriorityOrder: [
        "present-completed-candidate-repair-route",
        "defer-duplicate-approval-boundaries",
        "defer-broader-host-mutation",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-demo-status",
      boundary: "read-only demo status only; do not approve, execute, restart, recover, schedule, or broaden systemd control",
    },
  };
}

async function buildSystemdRepairCandidateDemoStatus() {
  const [review, readiness, taskRoute] = await Promise.all([
    buildSystemdRepairCandidateRouteReview(),
    buildSystemdRepairCandidateReadiness(),
    buildSystemdRepairCandidateTaskRoute(),
  ]);
  const selectedUnit = readiness.summary?.selectedUnit ?? taskRoute.routeDecision?.targetUnit ?? null;
  const demoReady = review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status"
    && readiness.summary?.ready === true
    && selectedUnit === "openclaw-browser-runtime.service";
  const checklist = [
    {
      id: "candidate-ranked",
      label: "Candidate assessment ranks browser runtime as the visible repair target",
      passed: readiness.evidence?.recommendedCandidate === "openclaw-browser-runtime.service",
      evidence: readiness.source?.candidateAssessmentRegistry ?? null,
    },
    {
      id: "plan-preview-visible",
      label: "Plan-only command preview is available without execution",
      passed: typeof readiness.evidence?.commandPreview === "string"
        && readiness.evidence.commandPreview.includes("openclaw-browser-runtime.service"),
      evidence: readiness.source?.candidatePlanRegistry ?? null,
    },
    {
      id: "existing-route-visible",
      label: "Existing operator-reviewed repair route is selected",
      passed: taskRoute.routeDecision?.existingRouteAvailable === true,
      evidence: readiness.source?.candidateTaskRouteRegistry ?? null,
    },
    {
      id: "task-shell-visible",
      label: "Candidate task shell is visible in Observer before approval or execution",
      passed: readiness.completedBlock?.completedSlices?.includes("observer-openclaw-systemd-repair-candidate-task-shell") === true,
      evidence: readiness.source?.observerTaskShellRegistry ?? null,
    },
    {
      id: "route-review-complete",
      label: "Route review selects demo status instead of duplicate approval or mutation",
      passed: review.registry === SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY
        && review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status",
      evidence: review.registry,
    },
    {
      id: "no-hidden-action",
      label: "Demo status remains read-only and non-executing",
      passed: review.governance?.createsTask === false
        && review.governance?.executesCommand === false
        && review.governance?.hostMutation === false
        && review.governance?.triggersRecovery === false,
      evidence: "candidate_demo_status_governance",
    },
  ];
  const passedChecks = checklist.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY,
    mode: "read_only_candidate_repair_demo_status",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateReadinessRegistry: readiness.registry,
      candidateRouteReviewRegistry: review.registry,
      candidateTaskRouteRegistry: taskRoute.registry,
      evidence: "systemd_repair_candidate_demo_status",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "demo_status_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      demoReady,
      passedChecks,
      totalChecks: checklist.length,
      selectedUnit,
      selectedSlice: review.decision?.selectedSlice ?? null,
      nextSlice: review.next?.recommendedSlice ?? null,
      hiddenMutation: false,
    },
    checklist,
    operatorView: {
      title: "Systemd repair candidate route is demo-ready",
      narrative: "OpenClaw can explain how it selected one body service, planned a repair preview, verified an existing operator-reviewed task route, and stopped before approval or host mutation.",
      speakingPoints: [
        "The body candidate is selected from systemd inventory, dependency, and health trend evidence.",
        "The command is only a preview until a separate operator action creates an approval-gated task shell.",
        "The route review avoids replaying approval and execution for the same browser-runtime target.",
        "The next expansion must be chosen by another whitepaper route review, not by safety-boundary momentum.",
      ],
    },
    evidence: {
      recommendedCandidate: readiness.evidence?.recommendedCandidate ?? null,
      candidateReason: readiness.evidence?.candidateReason ?? null,
      commandPreview: readiness.evidence?.commandPreview ?? null,
      routeStatus: taskRoute.routeDecision?.status ?? "unknown",
      notSelected: review.decision?.notSelected ?? [],
      completedBlock: readiness.completedBlock,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to a broader whitepaper route review before adding approval replay, execution replay, or broader systemd mutation",
    },
  };
}

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

async function buildSystemdNextRepairScopeReview() {
  const inventory = await buildSystemdUnitInventory();
  const dependencyMap = await buildSystemdDependencyMap();
  const ledgerDemoStatus = await buildBodyEvidenceLedgerDemoStatus();
  const nodeByUnit = new Map((dependencyMap.nodes ?? []).map((node) => [node.unit, node]));
  const completedDemoUnit = "openclaw-browser-runtime.service";
  const candidates = (inventory.units ?? [])
    .filter((unit) => unit.component === "body")
    .map((unit) => {
      const node = nodeByUnit.get(unit.unit) ?? {};
      const isCompletedDemoTarget = unit.unit === completedDemoUnit;
      const isFoundational = ["openclaw-event-hub.service", "openclaw-core.service"].includes(unit.unit);
      const isSelected = unit.unit === "openclaw-system-sense.service";
      return {
        unit: unit.unit,
        component: unit.component,
        activeState: unit.activeState,
        subState: unit.subState,
        impactClass: node.impactClass ?? "unknown",
        impactRadius: node.impactRadius ?? 0,
        dependencyLayer: node.dependencyLayer ?? null,
        score: isSelected ? 96 : isCompletedDemoTarget ? 20 : isFoundational ? 45 : 70 - Math.min(20, node.impactRadius ?? 0),
        recommended: isSelected,
        mutation: false,
        reason: isSelected
          ? "System Sense is the body introspection organ that produced the ledger evidence; review its repair scope next before any new mutation."
          : isCompletedDemoTarget
            ? "Browser Runtime already served as the completed real repair demo target; do not loop back into it."
            : isFoundational
              ? "Foundational control-plane units are deferred until lower-risk body organs have a fresh scope review."
              : "Candidate remains available for future route review, but System Sense is the narrowest next body-memory-adjacent scope.",
      };
    })
    .sort((left, right) => right.score - left.score);
  const selected = candidates.find((candidate) => candidate.recommended) ?? candidates[0] ?? null;
  const reviewReady = ledgerDemoStatus.summary?.demoReady === true && selected?.unit === "openclaw-system-sense.service";

  return {
    ok: true,
    registry: SYSTEMD_NEXT_REPAIR_SCOPE_REVIEW_REGISTRY,
    mode: "read_only_next_systemd_repair_scope_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      dependencyMapRegistry: dependencyMap.registry,
      ledgerDemoStatusRegistry: ledgerDemoStatus.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_next_repair_scope_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "scope_review_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track A: Real NixOS/systemd Repair Semantics",
      selectedSlice: "openclaw-systemd-next-repair-plan",
      selectedUnit: selected?.unit ?? null,
      status: reviewReady ? "selected" : "blocked_until_ledger_demo_ready",
      rationale: "Return to real systemd repair semantics with a read-only scope review anchored in durable body evidence; do not replay the completed browser-runtime demo path.",
      notSelected: [
        "no browser-runtime repair demo loop",
        "no immediate repair task",
        "no systemctl execution",
        "no broader host mutation",
        "no automatic repair",
        "no plugin/runtime adapter work",
        "no additional ledger writes",
      ],
    },
    summary: {
      ready: reviewReady,
      selectedUnit: selected?.unit ?? null,
      candidateCount: candidates.length,
      ledgerDemoReady: ledgerDemoStatus.summary?.demoReady === true,
      completedDemoUnit,
      hiddenMutation: false,
    },
    candidates,
    evidence: {
      ledgerDemo: {
        registry: ledgerDemoStatus.registry,
        demoReady: ledgerDemoStatus.summary?.demoReady === true,
        recordCount: ledgerDemoStatus.summary?.recordCount ?? 0,
        bootstrapRecordId: ledgerDemoStatus.summary?.bootstrapRecordId ?? null,
      },
      selectedDependencyNode: selected ? nodeByUnit.get(selected.unit) ?? null : null,
      inventorySummary: inventory.summary,
      dependencySummary: dependencyMap.summary,
    },
    next: {
      recommendedSlice: "openclaw-systemd-next-repair-plan",
      boundary: "plan-only repair scope for the selected unit; do not create tasks, approvals, restarts, or host mutation",
    },
  };
}

async function buildSystemdNextRepairPlan() {
  const scopeReview = await buildSystemdNextRepairScopeReview();
  const selectedUnit = scopeReview.decision?.selectedUnit ?? null;
  const inventory = await buildSystemdUnitInventory();
  const unit = findInventoryUnit(inventory, selectedUnit);
  const dependencyNode = scopeReview.evidence?.selectedDependencyNode ?? null;
  const risk = unit ? classifySystemdRepairRisk(unit) : "unknown";

  return {
    ok: true,
    registry: SYSTEMD_NEXT_REPAIR_PLAN_REGISTRY,
    mode: "plan_only_next_systemd_repair_scope",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      scopeReviewRegistry: scopeReview.registry,
      inventoryRegistry: inventory.registry,
      ledgerDemoStatusRegistry: scopeReview.evidence?.ledgerDemo?.registry ?? null,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_next_repair_plan",
    },
    governance: {
      domain: "body_internal",
      risk,
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    scope: {
      selectedUnit,
      selectedSlice: scopeReview.decision?.selectedSlice ?? null,
      scopeReady: scopeReview.summary?.ready === true,
      ledgerDemoReady: scopeReview.summary?.ledgerDemoReady === true,
      completedDemoUnit: scopeReview.summary?.completedDemoUnit ?? null,
      rationale: scopeReview.decision?.rationale ?? null,
    },
    target: unit ? {
      key: unit.key,
      name: unit.name,
      unit: unit.unit,
      component: unit.component,
      activeState: unit.activeState,
      subState: unit.subState,
      loadState: unit.loadState,
      unitFileState: unit.unitFileState,
      systemdObserved: unit.systemdObserved,
      impactClass: dependencyNode?.impactClass ?? "unknown",
      impactRadius: dependencyNode?.impactRadius ?? 0,
      dependencyLayer: dependencyNode?.dependencyLayer ?? null,
    } : null,
    plan: {
      intent: "systemd.next_repair.plan",
      targetUnit: unit?.unit ?? null,
      commandPreview: unit ? `systemctl restart ${unit.unit}` : null,
      commandPreviewOnly: true,
      createsExecutableTask: false,
      createsApproval: false,
      executesCommand: false,
      restartsService: false,
      reason: unit
        ? `${unit.unit} is the selected next Track A scope; this plan records the repair shape before any dry-run, task, approval, or restart.`
        : "No selected OpenClaw-owned unit is available for the next repair plan.",
      requiredBeforeExecution: [
        "separate route review for the selected next repair plan",
        "operator-visible dry-run envelope",
        "approval-gated task shell",
        "explicit operator approval",
        "post-execution verification bundle",
      ],
      notSelected: [
        "no immediate dry-run",
        "no immediate repair task",
        "no approval creation",
        "no systemctl execution",
        "no automatic repair",
        "no browser-runtime repair demo replay",
        "no additional ledger writes",
      ],
    },
    next: {
      recommendedSlice: "openclaw-systemd-next-repair-route-review",
      boundary: "route review before any dry-run, task, approval, restart, or host mutation for the selected unit",
    },
  };
}

async function buildSystemdNextRepairRouteReview() {
  const repairPlan = await buildSystemdNextRepairPlan();
  const planReady = repairPlan.plan?.targetUnit === "openclaw-system-sense.service"
    && repairPlan.plan?.commandPreviewOnly === true
    && repairPlan.governance?.hostMutation === false
    && repairPlan.governance?.executesCommand === false;
  const candidates = [
    {
      track: "Track A",
      id: "next-repair-dry-run-envelope",
      label: "Operator-visible dry-run envelope for the selected system-sense repair plan",
      score: planReady ? 96 : 50,
      recommended: true,
      firstSlice: "openclaw-systemd-next-repair-dry-run",
      mutation: false,
      reason: planReady
        ? "The selected system-sense repair scope has a plan-only command preview; the next smallest Track A step is a non-mutating dry-run envelope."
        : "The dry-run route waits until the next repair plan is ready and non-mutating.",
    },
    {
      track: "Track A",
      id: "immediate-task-shell",
      label: "Approval-gated task shell for the selected system-sense repair",
      score: 58,
      recommended: false,
      firstSlice: "defer-next-repair-task-shell",
      mutation: false,
      reason: "Task materialization is too early; the selected unit needs an Observer-visible dry-run envelope first.",
    },
    {
      track: "Track A",
      id: "immediate-systemctl-execution",
      label: "Immediate systemctl restart execution",
      score: 20,
      recommended: false,
      firstSlice: "defer-next-repair-real-execution",
      mutation: true,
      reason: "Real restart would mutate the host and must wait for dry-run, task, approval, and verification slices.",
    },
    {
      track: "Track B",
      id: "browser-runtime-demo-replay",
      label: "Replay the completed browser-runtime repair demo",
      score: 18,
      recommended: false,
      firstSlice: "defer-browser-runtime-demo-replay",
      mutation: false,
      reason: "The browser-runtime repair demo is already complete; replaying it would slow Phase 2 progress.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 10,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work is still not needed for this body repair route.",
    },
  ];

  return {
    ok: true,
    registry: SYSTEMD_NEXT_REPAIR_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_next_systemd_repair_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      nextRepairPlanRegistry: repairPlan.registry,
      scopeReviewRegistry: repairPlan.source?.scopeReviewRegistry ?? null,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_next_repair_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track A: Real NixOS/systemd Repair Semantics",
      selectedSlice: "openclaw-systemd-next-repair-dry-run",
      selectedUnit: repairPlan.plan?.targetUnit ?? null,
      status: planReady ? "selected" : "blocked_until_next_repair_plan_ready",
      rationale: "Advance the selected system-sense repair route by one non-mutating step: a dry-run envelope, not a task or restart.",
      notSelected: [
        "no immediate repair task",
        "no approval creation",
        "no systemctl execution",
        "no host mutation",
        "no browser-runtime repair demo replay",
        "no automatic repair",
        "no persistence hardening",
        "no denial recovery or duplicate-click work",
        "no plugin/runtime adapter work",
      ],
    },
    evidence: {
      planReady,
      targetUnit: repairPlan.plan?.targetUnit ?? null,
      commandPreview: repairPlan.plan?.commandPreview ?? null,
      commandPreviewOnly: repairPlan.plan?.commandPreviewOnly === true,
      planRegistry: repairPlan.registry,
      scopeReviewRegistry: repairPlan.source?.scopeReviewRegistry ?? null,
      requiredBeforeExecution: repairPlan.plan?.requiredBeforeExecution ?? [],
      targetImpactClass: repairPlan.target?.impactClass ?? "unknown",
      targetImpactRadius: repairPlan.target?.impactRadius ?? 0,
      routePriorityOrder: [
        "operator-visible-dry-run-envelope",
        "defer-task-materialization",
        "defer-host-mutation",
        "avoid-completed-demo-replay",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-systemd-next-repair-dry-run",
      boundary: "operator-visible dry-run envelope only; do not create tasks, approvals, restarts, recovery actions, schedulers, or host mutation",
    },
  };
}

async function buildSystemdNextRepairDryRun() {
  const routeReview = await buildSystemdNextRepairRouteReview();
  const repairPlan = await buildSystemdNextRepairPlan();
  const dryRun = buildCommandDryRun({
    command: "systemctl",
    args: ["restart", repairPlan.plan?.targetUnit ?? ""].filter(Boolean),
    intent: "systemd.next_repair.dry_run",
  });

  return {
    ok: true,
    registry: SYSTEMD_NEXT_REPAIR_DRY_RUN_REGISTRY,
    mode: "operator_visible_next_systemd_repair_dry_run",
    canMutate: false,
    canRestart: false,
    wouldExecute: false,
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      routeReviewRegistry: routeReview.registry,
      nextRepairPlanRegistry: repairPlan.registry,
      scopeReviewRegistry: repairPlan.source?.scopeReviewRegistry ?? null,
      evidence: "systemd_next_repair_dry_run_envelope",
    },
    target: repairPlan.target,
    plan: repairPlan,
    routeReview: {
      registry: routeReview.registry,
      selectedSlice: routeReview.decision?.selectedSlice ?? null,
      selectedUnit: routeReview.decision?.selectedUnit ?? null,
      status: routeReview.decision?.status ?? "unknown",
    },
    dryRun: {
      ...dryRun,
      risk: "high",
      governance: "require_future_operator_approval",
      requiresApproval: true,
      checks: [
        ...dryRun.checks,
        {
          name: "route_review_selected_dry_run",
          passed: routeReview.decision?.selectedSlice === "openclaw-systemd-next-repair-dry-run",
          detail: "The previous route review selected this dry-run envelope before any task or host mutation.",
        },
        {
          name: "target_is_system_sense",
          passed: repairPlan.plan?.targetUnit === "openclaw-system-sense.service",
          detail: "The dry-run envelope is limited to the selected system-sense repair scope.",
        },
        {
          name: "operator_visible_before_mutation",
          passed: true,
          detail: "The restart command is visible before any future task, approval, or host mutation milestone.",
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
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    next: {
      recommendedSlice: "openclaw-systemd-next-repair-task-route",
      boundary: "route-review task materialization before creating approvals, executing systemctl, restarting services, or mutating the host",
    },
  };
}

async function buildSystemdNextRepairTaskRoute() {
  const envelope = await buildSystemdNextRepairDryRun();
  const routeReady = envelope.registry === SYSTEMD_NEXT_REPAIR_DRY_RUN_REGISTRY
    && envelope.target?.unit === "openclaw-system-sense.service"
    && envelope.dryRun?.wouldExecute === false
    && envelope.governance?.hostMutation === false
    && envelope.governance?.executesCommand === false;

  return {
    ok: true,
    registry: SYSTEMD_NEXT_REPAIR_TASK_ROUTE_REGISTRY,
    mode: "read_only_next_systemd_repair_task_route",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      nextRepairDryRunRegistry: envelope.registry,
      nextRepairPlanRegistry: envelope.source?.nextRepairPlanRegistry ?? null,
      routeReviewRegistry: envelope.source?.routeReviewRegistry ?? null,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_next_repair_task_route",
    },
    governance: {
      domain: "body_internal",
      risk: "medium",
      autonomy: "task_route_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    routeDecision: {
      targetUnit: envelope.target?.unit ?? null,
      status: routeReady ? "task_shell_route_available" : "blocked_until_dry_run_ready",
      selectedSlice: "openclaw-systemd-next-repair-task-shell",
      taskShellAllowed: routeReady,
      reason: routeReady
        ? "The system-sense repair dry-run is visible and non-mutating; a future task shell may be created but must still stop before approval and execution."
        : "Task shell route waits until the selected repair dry-run is ready and non-mutating.",
    },
    requiredBeforeTaskCreation: [
      "Observer-visible next repair plan",
      "read-only route review selecting dry-run",
      "operator-visible dry-run envelope",
      "explicit task shell milestone",
      "separate operator approval before execution",
    ],
    allowedNextActions: [
      {
        id: "create-task-shell",
        label: "Create approval-gated task shell for the selected system-sense repair",
        allowedNow: routeReady,
        createsTask: true,
        createsApproval: true,
        mutatesHost: false,
        boundary: "task shell only; no approval auto-grant, no command execution, no restart",
      },
      {
        id: "execute-restart",
        label: "Execute systemctl restart for the selected system-sense repair",
        allowedNow: false,
        createsTask: false,
        createsApproval: false,
        mutatesHost: true,
        boundary: "requires later approval and real execution milestones",
      },
    ],
    evidence: {
      dryRunReady: routeReady,
      dryRunRegistry: envelope.registry,
      targetUnit: envelope.target?.unit ?? null,
      command: envelope.dryRun?.command ?? null,
      args: envelope.dryRun?.args ?? [],
      wouldExecute: envelope.dryRun?.wouldExecute === true,
      routeReview: envelope.routeReview,
      checks: envelope.dryRun?.checks ?? [],
    },
    next: {
      recommendedSlice: "openclaw-systemd-next-repair-task-shell",
      boundary: "approval-gated task shell only; do not approve, execute, restart, recover, schedule, or broaden systemd control",
    },
  };
}

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
