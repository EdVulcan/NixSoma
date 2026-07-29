import { createHash } from "node:crypto";

export const AI_WORKSPACE_TASK_OBJECTIVE_REGISTRY =
  "nixsoma-ai-workspace-task-objective-v0";

const MAX_TASK_ID_CHARS = 200;
const MAX_OBJECTIVE_CHARS = 180;
const ELIGIBLE_TASK_STATUSES = new Set(["queued", "running"]);
const ELIGIBLE_POLICY_DECISIONS = new Set(["allow", "audit_only"]);

const UNSAFE_OBJECTIVE_PATTERNS = [
  ["control_characters", /[\p{C}\p{Zl}\p{Zp}]/u],
  ["url", /\b(?:https?|ftp|file):\/\/|\bwww\./iu],
  ["email_address", /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u],
  ["network_address", /\b(?:\d{1,3}\.){3}\d{1,3}\b/u],
  ["file_path", /(?:^|\s)(?:~?\/|\.{1,2}\/|[A-Za-z]:[\\/]|\\\\)|\/[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*/u],
  ["credential_label", /\b(?:password|passwd|secret|token|api[_-]?key|credential)\b\s*[:=]/iu],
  ["credential_value", /\bBearer\s+[A-Za-z0-9._~+/-]+=*|\bsk-[A-Za-z0-9_-]{16,}\b/iu],
  ["prompt_hierarchy", /\b(?:system|developer|assistant|tool)\s*(?:message|prompt|instruction|role)?\s*:/iu],
  ["prompt_override", /\b(?:ignore|disregard|override|bypass)\s+(?:all\s+)?(?:previous|prior|system|developer|safety|policy)\b/iu],
  ["executable_instruction", /(?:^|\s)(?:sudo|curl|wget|bash|powershell|cmd\.exe)\b/iu],
  ["structured_payload", /```|[{}]/u],
];

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function reject(reason) {
  return {
    ok: false,
    reason: `ai_workspace_task_objective_${reason}`,
    providerProjection: null,
    evidence: null,
  };
}

export function normaliseAiWorkspaceTaskId(value) {
  if (typeof value !== "string") return null;
  const taskId = value.trim();
  return taskId && taskId.length <= MAX_TASK_ID_CHARS ? taskId : null;
}

function projectObjective(goal) {
  if (typeof goal !== "string") return reject("missing");
  const objective = goal.normalize("NFKC").trim().replace(/[\t ]+/gu, " ");
  if (!objective || [...objective].length > MAX_OBJECTIVE_CHARS) {
    return reject(objective ? "too_long" : "missing");
  }
  for (const [reason, pattern] of UNSAFE_OBJECTIVE_PATTERNS) {
    if (pattern.test(objective)) return reject(`unsafe_${reason}`);
  }
  return { ok: true, objective };
}

function trustedWorkViewMatches(task, workViewState) {
  const taskWorkView = task?.workView ?? {};
  const reviewed = taskWorkView.trustedBinding ?? {};
  const currentWorkView = workViewState?.workView ?? {};
  const currentSession = workViewState?.session ?? {};
  const trustedSession = currentWorkView.trustedSession ?? workViewState?.trustedSession ?? {};
  const identity = trustedSession.sessionIdentity ?? {};
  const helper = trustedSession.helperRuntime ?? currentWorkView.helperRuntime ?? {};
  return reviewed.registry === "openclaw-native-engineering-work-view-bind-v0"
    && reviewed.mode === "operator_reviewed"
    && reviewed.authorityStatus === "authoritative"
    && reviewed.leaseMatched === true
    && typeof reviewed.boundAt === "string"
    && Number.isFinite(Date.parse(reviewed.boundAt))
    && typeof taskWorkView.workViewId === "string"
    && taskWorkView.workViewId === currentWorkView.workViewId
    && typeof taskWorkView.sessionId === "string"
    && taskWorkView.sessionId === currentSession.sessionId
    && currentSession.status === "running"
    && currentSession.role === "ai-work-view"
    && currentWorkView.status === "prepared"
    && identity.status === "authoritative"
    && helper.status === "active"
    && helper.actionAuthority === "active"
    && helper.leaseMatched === true;
}

export function buildAiWorkspaceTaskObjectiveBinding({
  task,
  taskId,
  workViewState,
  maximumActions = 1,
} = {}) {
  const requestedTaskId = normaliseAiWorkspaceTaskId(taskId);
  if (!requestedTaskId) return reject("task_id_invalid");
  if (!task || task.id !== requestedTaskId) return reject("task_not_found");
  if (!ELIGIBLE_TASK_STATUSES.has(task.status)) return reject("task_status_ineligible");
  const policyDecision = task.policy?.decision?.decision;
  if (!ELIGIBLE_POLICY_DECISIONS.has(policyDecision)) return reject("task_policy_ineligible");
  if (!trustedWorkViewMatches(task, workViewState)) return reject("work_view_binding_invalid");
  if (typeof task.updatedAt !== "string" || !Number.isFinite(Date.parse(task.updatedAt))) {
    return reject("task_version_invalid");
  }

  const objectiveResult = projectObjective(task.goal);
  if (!objectiveResult.ok) return objectiveResult;
  const objectiveContentHash = hashValue(objectiveResult.objective);
  const taskVersionHash = hashValue({
    taskId: requestedTaskId,
    taskStatus: task.status,
    taskUpdatedAt: task.updatedAt,
    policyDecision,
    objectiveContentHash,
    workViewId: task.workView.workViewId,
    sessionId: task.workView.sessionId,
    trustedBinding: {
      registry: task.workView.trustedBinding.registry,
      mode: task.workView.trustedBinding.mode,
      authorityStatus: task.workView.trustedBinding.authorityStatus,
      leaseMatched: task.workView.trustedBinding.leaseMatched,
      boundAt: task.workView.trustedBinding.boundAt,
    },
  });
  return {
    ok: true,
    reason: null,
    providerProjection: {
      registry: AI_WORKSPACE_TASK_OBJECTIVE_REGISTRY,
      statement: objectiveResult.objective,
      source: "existing_operator_reviewed_task",
      interpretation: "bounded_objective_data_not_instruction_hierarchy",
      maximumActions: maximumActions === 0 ? 0 : 1,
    },
    evidence: {
      registry: AI_WORKSPACE_TASK_OBJECTIVE_REGISTRY,
      taskId: requestedTaskId,
      taskStatus: task.status,
      objectiveContentHash,
      taskVersionHash,
      policyDecision,
      operatorReviewed: true,
      currentWorkViewBound: true,
      objectiveTextRetained: false,
    },
  };
}

export function projectAiWorkspaceTaskEvidence(binding) {
  const evidence = binding?.evidence ?? {};
  return {
    taskId: evidence.taskId ?? null,
    taskStatus: evidence.taskStatus ?? null,
    objectiveContentHash: evidence.objectiveContentHash ?? null,
    taskVersionHash: evidence.taskVersionHash ?? null,
  };
}

export function aiWorkspaceTaskObjectiveBindingMatches(expected, current) {
  return expected?.ok === true
    && current?.ok === true
    && expected.evidence.taskId === current.evidence.taskId
    && expected.evidence.taskStatus === current.evidence.taskStatus
    && expected.evidence.objectiveContentHash === current.evidence.objectiveContentHash
    && expected.evidence.taskVersionHash === current.evidence.taskVersionHash;
}
