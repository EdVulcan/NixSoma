import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createDebouncedPersist } from "../../../packages/shared-utils/src/persist.mjs";

export function createRuntimeState(config) {
  const { stateFilePath, getTaskById } = config;

  // L32-49
const tasks = new Map();
const approvals = new Map();
const policyAuditLog = [];
const capabilityInvocationLog = [];
const runtimeState = {
  status: "idle",
  currentTaskId: null,
  paused: false,
  lastUpdatedAt: new Date().toISOString(),
};

const ACTIVE_TASK_STATUSES = new Set(["queued", "running", "paused"]);
// H-1 Fix: Cap the total number of tasks to prevent unbounded memory growth.
const MAX_TASK_ENTRIES = 500;
const MAX_PHASE_HISTORY_ENTRIES = 50;
const MAX_POLICY_AUDIT_ENTRIES = 100;
const MAX_APPROVAL_ITEMS = 200;
const MAX_CAPABILITY_INVOCATION_ENTRIES = 200;
const CROSS_BOUNDARY_INTENTS = new Set([
  "account.login",
  "data.egress",
  "data.upload",
  "external_device.control",
  "network.publish",
  "social.post",
  "transaction.commit",
]);
const DENIED_INTENTS = new Set([
  "body.destroy",
  "security.disable",
]);
const CAPABILITY_HEALTH_TIMEOUT_MS = Number.parseInt(
  process.env.OPENCLAW_CAPABILITY_HEALTH_TIMEOUT_MS ?? "1200",
  10,
);
const APPROVAL_TTL_MS = parseOptionalPositiveInteger(process.env.OPENCLAW_APPROVAL_TTL_MS);
const SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS = parseOptionalPositiveInteger(process.env.OPENCLAW_SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS) ?? 15000;
const SYSTEMD_REPAIR_RESTART_HELPER = normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER);
const SYSTEMD_REPAIR_RESTART_HELPER_SUDO =
  normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER_SUDO) ?? "sudo";
const SYSTEMD_REPAIR_AUTH_DELEGATION = normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION);
const STATUS_PRIORITY = {
  running: 0,
  paused: 1,
  queued: 2,
  failed: 3,
  completed: 4,
  superseded: 5,
};
const SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY = "openclaw-systemd-repair-execution-task-v0";
const SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY = "openclaw-systemd-next-repair-task-shell-v0";
const SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY = "openclaw-systemd-next-repair-real-execution-v0";
const LONG_TERM_MEMORY_TASK_REGISTRY = "openclaw-long-term-memory-write-task-v0";
const LONG_TERM_MEMORY_DIR_DISPLAY_PATH = ".artifacts/openclaw-long-term-memory";
const LONG_TERM_MEMORY_FILE_DISPLAY_PATH = `${LONG_TERM_MEMORY_DIR_DISPLAY_PATH}/long-term-memory.jsonl`;
const CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH = ".artifacts/openclaw-cloud-consciousness";
const CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY = "openclaw-cloud-consciousness-handoff-task-v0";
const CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY = "openclaw-cloud-consciousness-provider-dry-run-task-v0";
const CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY = "openclaw-cloud-consciousness-real-provider-call-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY = "openclaw-cloud-consciousness-live-provider-call-runbook-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY = "openclaw-cloud-consciousness-live-provider-call-execution-plan-task-v0";
const CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH = `${CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH}/context-handoff.jsonl`;
const CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH = `${CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH}/provider-dry-run.jsonl`;
const CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH = `${CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH}/provider-response-rehearsal.jsonl`;
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH = `${CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH}/live-provider-call-runbook.jsonl`;
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH = `${CLOUD_CONSCIOUSNESS_DIR_DISPLAY_PATH}/live-provider-call-execution-plan.jsonl`;
const SYSTEMD_REPAIR_REAL_EXECUTION_UNIT = "openclaw-browser-runtime.service";
const SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT = "openclaw-system-sense.service";

  // L100-137
function normaliseAutonomyMode(value) {
  const mode = typeof value === "string" && value.trim() ? value.trim() : "guardian";
  if (["guardian", "sovereign_body", "full_autonomy"].includes(mode)) {
    return mode;
  }
  return "guardian";
}

function parseOptionalPositiveInteger(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normaliseOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueResolvedPaths(paths) {
  return [...new Set(paths.map((item) => path.resolve(item)))];
}

function parseWorkspaceRoots(value) {
  if (typeof value === "string" && value.trim()) {
    return uniqueResolvedPaths(value
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean));
  }

  return uniqueResolvedPaths([
    path.resolve(process.cwd(), "../openclaw"),
    path.resolve(process.cwd(), "../../..", "openclaw"),
  ]);
}

  // L188-192
function updateRuntimeState(patch) {
  Object.assign(runtimeState, patch, {
    lastUpdatedAt: new Date().toISOString(),
  });
}

  const persistState = createDebouncedPersist(stateFilePath, () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    runtime: runtimeState,
    tasks: [...tasks.values()],
    approvals: [...approvals.values()],
    policyAuditLog,
    capabilityInvocationLog,
  }));

  // L231-282
function loadPersistentState() {
  if (!existsSync(stateFilePath)) {
    return;
  }

  try {
    const data = JSON.parse(readFileSync(stateFilePath, "utf8"));
    if (data?.runtime && typeof data.runtime === "object") {
      Object.assign(runtimeState, data.runtime);
    }
    if (Array.isArray(data?.tasks)) {
      tasks.clear();
      // M-4 Fix: Validate task status against the allowed enum on load so that
      // corrupted or manually-edited state files cannot inject invalid statuses.
      const VALID_TASK_STATUSES = new Set([
        "queued", "running", "paused", "completed", "failed", "superseded",
      ]);
      for (const task of data.tasks.slice(-MAX_TASK_ENTRIES)) {
        if (task?.id) {
          if (typeof task.status === "string" && !VALID_TASK_STATUSES.has(task.status)) {
            task.status = "failed";
          }
          tasks.set(task.id, task);
        }
      }
    }
    if (Array.isArray(data?.approvals)) {
      approvals.clear();
      for (const approval of data.approvals.slice(-MAX_APPROVAL_ITEMS)) {
        if (approval?.id) {
          approvals.set(approval.id, approval);
        }
      }
    }
    if (Array.isArray(data?.policyAuditLog)) {
      policyAuditLog.splice(0, policyAuditLog.length, ...data.policyAuditLog.slice(-MAX_POLICY_AUDIT_ENTRIES));
    }
    if (Array.isArray(data?.capabilityInvocationLog)) {
      capabilityInvocationLog.splice(
        0,
        capabilityInvocationLog.length,
        ...data.capabilityInvocationLog.slice(-MAX_CAPABILITY_INVOCATION_ENTRIES),
      );
    }
  } catch (error) {
    console.error("Failed to load persisted core state:", error);
  }
}

function getCurrentTask() {
  return runtimeState.currentTaskId ? getTaskById(runtimeState.currentTaskId) : null;
}

  return {
    tasks, approvals, runtimeState, policyAuditLog, capabilityInvocationLog,
    ACTIVE_TASK_STATUSES, MAX_TASK_ENTRIES, MAX_PHASE_HISTORY_ENTRIES,
    MAX_POLICY_AUDIT_ENTRIES, MAX_APPROVAL_ITEMS, MAX_CAPABILITY_INVOCATION_ENTRIES,
    CROSS_BOUNDARY_INTENTS, DENIED_INTENTS, CAPABILITY_HEALTH_TIMEOUT_MS,
    APPROVAL_TTL_MS, SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS, SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_RESTART_HELPER_SUDO, SYSTEMD_REPAIR_AUTH_DELEGATION, STATUS_PRIORITY,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY, SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY, SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
    LONG_TERM_MEMORY_TASK_REGISTRY, LONG_TERM_MEMORY_DIR_DISPLAY_PATH, LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY, CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH, CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
    normaliseAutonomyMode, parseOptionalPositiveInteger, normaliseOptionalString, uniqueResolvedPaths, parseWorkspaceRoots,
    updateRuntimeState, persistState, loadPersistentState, getCurrentTask
  };
}
