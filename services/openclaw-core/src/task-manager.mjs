import { randomUUID } from "node:crypto";
import { createTaskRecovery } from "./task-recovery.mjs";
import { redactWriteOnlyInputActionTree } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";

const TASK_EXTENSION_FIELDS = [
  { name: "sourceCommand", copyFromCreateInput: true },
  { name: "engineeringPlanTodoSuggestionLink", copyFromCreateInput: true },
  { name: "engineeringEditProposal" },
  { name: "engineeringWriteProposal" },
  { name: "engineeringLspLifecycle" },
  { name: "nativePluginRuntimeRefresh" },
  { name: "nativeAcpxCodexBridgeWrapper" },
  { name: "nativeAcpxCodexBridgeProcessSpawn" },
  { name: "workViewTrustedSidecarLifecycle" },
  { name: "systemdRepair", copyFromCreateInput: true },
  { name: "systemdNextRepair", copyFromCreateInput: true },
  { name: "systemdRepairCandidate" },
  { name: "operatorTakeover" },
  { name: "bodyEvidenceLedgerDirectory" },
  { name: "bodyEvidenceLedgerFirstRecord" },
  { name: "bodyEvidenceLedgerFollowupRecord" },
  { name: "longTermMemoryWrite" },
  { name: "cloudConsciousnessHandoff" },
  { name: "cloudConsciousnessProviderDryRun" },
  { name: "cloudConsciousnessProviderCallRehearsal" },
  { name: "cloudConsciousnessLiveProviderRunbook" },
  { name: "cloudConsciousnessLiveProviderExecutionPlan", copyFromCreateInput: true },
  { name: "cloudConsciousnessLiveProviderRuntimeAdapter" },
  { name: "cloudConsciousnessLiveProviderRuntimeImplementation" },
  { name: "cloudConsciousnessLiveProviderRuntimeAdapterImplementation" },
  { name: "cloudConsciousnessLiveProviderRuntimeAdapterModule" },
  { name: "cloudConsciousnessLiveProviderRequestBuilder" },
  { name: "cloudConsciousnessLiveProviderCredentialReferenceResolver" },
  { name: "cloudConsciousnessLiveProviderNoNetworkSender" },
  { name: "cloudConsciousnessLiveProviderEgressTranscriptRecorder" },
  { name: "cloudConsciousnessLiveProviderResponseVerifier" },
  { name: "cloudConsciousnessLiveProviderRollbackNote" },
  { name: "cloudConsciousnessLiveProviderRuntimeAdapterClosure" },
  { name: "cloudConsciousnessLiveProviderRealLaunch" },
  { name: "cloudConsciousnessLiveProviderEgressExecution" },
  { name: "cloudConsciousnessLiveProviderCredentialValueAuthorization" },
  { name: "cloudConsciousnessLiveProviderCredentialValueRead" },
  { name: "cloudConsciousnessLiveProviderCredentialValueAccessAuthorization" },
  { name: "cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalRead" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecution" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttempt" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalRead" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelope" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreation" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecution" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttempt" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt" },
  { name: "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead" },
];

function serialiseTaskExtensionFields(task) {
  return Object.fromEntries(
    TASK_EXTENSION_FIELDS.map(({ name }) => [name, task[name] ?? null]),
  );
}

function cloneTaskExtensionFieldsFromCreateInput(body) {
  const fields = {};
  for (const { name, copyFromCreateInput } of TASK_EXTENSION_FIELDS) {
    if (copyFromCreateInput !== true) {
      continue;
    }
    fields[name] = body[name] && typeof body[name] === "object"
      ? clonePlainObject(body[name])
      : null;
  }
  return fields;
}

function clonePlainObject(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

export function createTaskManager(deps) {
  const {
    state,
    buildRulePlan,
    shouldBuildPlan,
    serialisePlanForPublic,
    createApprovalRequestForTask,
    ensureTaskPolicy,
    updatePlanForPhase,
    publishEvent,
  } = deps;
  const {
    tasks,
    runtimeState,
    ACTIVE_TASK_STATUSES,
    MAX_TASK_ENTRIES,
    MAX_PHASE_HISTORY_ENTRIES,
    STATUS_PRIORITY,
    persistState,
    approvals,
    updateRuntimeState,
    getCurrentTask,
  } = state;

  const {
    recoverTask,
    isRecoverableTask,
    hasRecoverableCapabilityPlan,
    hasRecoverableNativePluginRuntimeActivationPlan,
    hasRecoverableSearchWebAdapterPlan,
    buildEyeHandRecoveryEvidence,
  } = createTaskRecovery({
    tasks,
    createTask,
    persistState,
  });

  // L9571-9611
function serialiseTask(task) {
  const currentTask = getCurrentTask();
  return redactWriteOnlyInputActionTree({
    id: task.id,
    type: task.type,
    goal: task.goal,
    status: task.status,
    targetUrl: task.targetUrl ?? null,
    workViewStrategy: task.workViewStrategy ?? null,
    plan: serialisePlanForPublic(task.plan),
    policy: task.policy ?? null,
    approval: task.approval ?? null,
    workView: task.workView ?? null,
    lastAction: task.lastAction ?? null,
    outcome: task.outcome ?? null,
    ...serialiseTaskExtensionFields(task),
    recovery: task.recovery ?? null,
    recoveredByTaskId: task.recoveredByTaskId ?? null,
    restorable: isRecoverableTask(task),
    executionPhase: task.executionPhase ?? "queued",
    phaseHistory: task.phaseHistory ?? [],
    createdAt: task.createdAt,
    closedAt: task.closedAt ?? null,
    updatedAt: task.updatedAt,
    isCurrentTask: currentTask?.id === task.id,
    isActive: isActiveTask(task),
  });
}


  // L9924-10040
function isActiveTask(task) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

function compareTasksForDisplay(left, right) {
  const leftPriority = STATUS_PRIORITY[left.status] ?? 99;
  const rightPriority = STATUS_PRIORITY[right.status] ?? 99;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function listTasks() {
  return [...tasks.values()]
    .sort(compareTasksForDisplay)
    .map((task) => serialiseTask(task));
}

function getActiveTasks() {
  return [...tasks.values()]
    .filter((task) => isActiveTask(task))
    .sort(compareTasksForDisplay);
}

function getNextQueuedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "queued")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function getLatestFinishedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "completed")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function getLatestFailedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "failed")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function buildTaskSummary() {
  const items = [...tasks.values()];
  const counts = {
    total: items.length,
    active: 0,
    queued: 0,
    running: 0,
    paused: 0,
    failed: 0,
    completed: 0,
    superseded: 0,
    recoverable: 0,
  };

  for (const task of items) {
    if (counts[task.status] !== undefined) {
      counts[task.status] += 1;
    }
    if (isActiveTask(task)) {
      counts.active += 1;
    }
    if (isRecoverableTask(task)) {
      counts.recoverable += 1;
    }
  }

  return {
    counts,
    currentTaskId: runtimeState.currentTaskId ?? null,
    currentTaskStatus: getCurrentTask()?.status ?? null,
  };
}


  // L19241-19585
function createTask(body, options = {}) {
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) {
    throw new Error("Task goal is required.");
  }

  const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "generic_task";
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    type,
    goal,
    status: "queued",
    targetUrl:
      typeof body.targetUrl === "string" && body.targetUrl.trim()
        ? body.targetUrl.trim()
        : null,
    workViewStrategy:
      typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
        ? body.workViewStrategy.trim()
        : "ai-work-view",
    plan: shouldBuildPlan(body)
      ? buildRulePlan({
          goal,
          type,
          intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : null,
          policy: body.policy && typeof body.policy === "object" ? body.policy : null,
          targetUrl:
            typeof body.targetUrl === "string" && body.targetUrl.trim()
              ? body.targetUrl.trim()
              : null,
          actions: body.actions,
        })
      : body.plan && typeof body.plan === "object"
        ? body.plan
        : null,
    policy:
      body.policy && typeof body.policy === "object"
        ? { request: body.policy }
        : {
            request: {
              intent:
                typeof body.intent === "string" && body.intent.trim()
                  ? body.intent.trim()
                  : "task.execute",
            },
          },
    workView: null,
    lastAction: null,
    outcome: null,
    ...cloneTaskExtensionFieldsFromCreateInput(body),
    recovery:
      body.recovery && typeof body.recovery === "object"
        ? {
            recoveredFromTaskId:
              typeof body.recovery.recoveredFromTaskId === "string" && body.recovery.recoveredFromTaskId.trim()
                ? body.recovery.recoveredFromTaskId.trim()
                : null,
            recoveredFromOutcome:
              typeof body.recovery.recoveredFromOutcome === "string" && body.recovery.recoveredFromOutcome.trim()
                ? body.recovery.recoveredFromOutcome.trim()
                : null,
            attempt:
              Number.isInteger(body.recovery.attempt) && body.recovery.attempt > 0
                ? body.recovery.attempt
                : 1,
            recoveryEvidence:
              body.recovery.recoveryEvidence && typeof body.recovery.recoveryEvidence === "object"
                ? clonePlainObject(body.recovery.recoveryEvidence)
                : null,
          }
        : null,
    recoveredByTaskId: null,
    executionPhase: "queued",
    phaseHistory: [
      {
        phase: "queued",
        at: now,
      },
    ],
    createdAt: now,
    closedAt: null,
    updatedAt: now,
  };

  // H-1 Fix: Evict oldest non-active tasks when the Map exceeds MAX_TASK_ENTRIES.
  if (tasks.size > MAX_TASK_ENTRIES) {
    const removable = [...tasks.values()]
      .filter((candidate) => !ACTIVE_TASK_STATUSES.has(candidate.status))
      .sort((left, right) => Date.parse(left.updatedAt ?? left.createdAt) - Date.parse(right.updatedAt ?? right.createdAt));
    let toRemove = tasks.size - MAX_TASK_ENTRIES;
    for (const candidate of removable) {
      if (toRemove <= 0) break;
      tasks.delete(candidate.id);
      toRemove -= 1;
    }
  }

  tasks.set(task.id, task);
  if (options.skipInitialPolicy !== true) {
    ensureTaskPolicy(task, { stage: "task.created" });
  }
  persistState();
  return task;
}

function getTaskById(taskId) {
  return tasks.get(taskId) ?? null;
}

function appendTaskPhase(task, phase, details = null) {
  const now = new Date().toISOString();
  task.executionPhase = phase;
  task.updatedAt = now;
  if (phase === "acting_on_target" && details?.actionKind) {
    task.lastAction = {
      kind: details.actionKind,
      degraded: Boolean(details.degraded),
      at: now,
    };
  }
  // M-8 Fix: Cap phaseHistory to prevent unbounded growth per task.
  const newEntry = { phase, at: now, details };
  const history = [...(task.phaseHistory ?? []), newEntry];
  task.phaseHistory = history.length > MAX_PHASE_HISTORY_ENTRIES
    ? history.slice(-MAX_PHASE_HISTORY_ENTRIES)
    : history;
  updatePlanForPhase(task, phase, details);
  persistState();
  return task;
}

async function setTaskPhase(task, phase, { status = task.status, details = null } = {}) {
  task.status = status;
  const updatedTask = appendTaskPhase(task, phase, details);
  reconcileRuntimeState();
  await publishEvent("task.phase_changed", { task: serialiseTask(updatedTask) });
  return updatedTask;
}

function reconcileRuntimeState() {
  const activeTasks = [...tasks.values()]
    .filter((task) => isActiveTask(task))
    .sort(compareTasksForDisplay);
  const currentTask = activeTasks[0] ?? null;

  if (!currentTask) {
    updateRuntimeState({
      status: "idle",
      currentTaskId: null,
      paused: false,
    });
    persistState();
    return null;
  }

  updateRuntimeState({
    status: currentTask.status === "paused" ? "paused" : currentTask.status,
    currentTaskId: currentTask.id,
    paused: currentTask.status === "paused",
  });
  persistState();
  return currentTask;
}

function reconcileInterruptedTasksAtStartup() {
  const interruptedTasks = [...tasks.values()].filter((task) => (
    task.status === "running"
    && task.type === "browser_task"
    && task.plan?.strategy === "rule-v1"
  ));

  for (const task of interruptedTasks) {
    failTask(task, "Core runtime restarted while the browser task was active.", {
      targetUrl: task.targetUrl ?? null,
      executor: "core-startup-reconciliation-v1",
      coreRuntimeInterruption: {
        kind: "core-runtime-interruption",
        code: "core_runtime_interruption",
        stage: task.executionPhase ?? "running",
        recoverable: true,
        automaticRestart: false,
        recoveryAction: "recover_task_after_core_restart",
      },
    });
  }

  return interruptedTasks;
}

function supersedeOtherActiveTasks(exceptTaskId) {
  const reclaimed = [];

  for (const task of tasks.values()) {
    if (task.id === exceptTaskId || !isActiveTask(task)) {
      continue;
    }

    task.status = "superseded";
    appendTaskPhase(task, "superseded", {
      replacedByTaskId: exceptTaskId,
    });
    task.outcome = {
      kind: "superseded",
      summary: `Superseded by task ${exceptTaskId}`,
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    reclaimed.push(task);
  }

  if (reclaimed.length > 0) {
    persistState();
  }
  return reclaimed;
}

function attachTaskToWorkView(task, body) {
  const now = new Date().toISOString();
  const activeUrl =
    typeof body.activeUrl === "string" && body.activeUrl.trim()
      ? body.activeUrl.trim()
      : task.targetUrl;

  task.status = "running";
  task.workView = {
    workViewId:
      typeof body.workViewId === "string" && body.workViewId.trim()
        ? body.workViewId.trim()
        : null,
    sessionId:
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : null,
    status:
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : "ready",
    visibility:
      typeof body.visibility === "string" && body.visibility.trim()
        ? body.visibility.trim()
        : "visible",
    mode:
      typeof body.mode === "string" && body.mode.trim()
        ? body.mode.trim()
        : "foreground-observable",
    helperStatus:
      typeof body.helperStatus === "string" && body.helperStatus.trim()
        ? body.helperStatus.trim()
        : "active",
    displayTarget:
      typeof body.displayTarget === "string" && body.displayTarget.trim()
        ? body.displayTarget.trim()
        : null,
    activeUrl,
    attachedAt: now,
  };
  appendTaskPhase(task, "ready_for_action", {
    sessionId: task.workView.sessionId,
    activeUrl,
  });
  reconcileRuntimeState();

  return task;
}

function bindTaskToTrustedWorkView(task, binding) {
  if (!task || !binding || typeof binding !== "object") {
    throw new Error("Trusted work-view binding requires a task and authoritative binding.");
  }

  const now = new Date().toISOString();
  const operatorActionSource = typeof binding.operatorActionSource === "string" && binding.operatorActionSource.trim()
    ? binding.operatorActionSource.trim().slice(0, 120)
    : "observer_engineering_context_packet";
  task.workView = {
    ...(task.workView ?? {}),
    workViewId: binding.workViewId,
    sessionId: binding.sessionId,
    status: binding.status ?? task.workView?.status ?? "ready",
    visibility: binding.visibility ?? task.workView?.visibility ?? "hidden",
    mode: binding.mode ?? task.workView?.mode ?? "background",
    helperStatus: binding.helperStatus ?? task.workView?.helperStatus ?? "active",
    displayTarget: binding.displayTarget ?? task.workView?.displayTarget ?? null,
    trustedBinding: {
      registry: "openclaw-native-engineering-work-view-bind-v0",
      mode: "operator_reviewed",
      source: operatorActionSource,
      authorityStatus: "authoritative",
      leaseMatched: true,
      boundAt: now,
    },
  };
  task.updatedAt = now;
  persistState();
  return task;
}

function completeTask(task, details = null) {
  if (details?.workView && typeof details.workView === "object") {
    task.workView = {
      ...(task.workView ?? {}),
      ...details.workView,
    };
  }
  task.status = "completed";
  appendTaskPhase(task, "completed", details);
  task.outcome = {
    kind: "completed",
    summary: typeof details?.summary === "string" && details.summary.trim()
      ? details.summary.trim()
      : `Completed work view task for ${task.targetUrl ?? "current target"}`,
    details,
    at: task.updatedAt,
  };
  task.closedAt = task.updatedAt;
  reconcileRuntimeState();
  persistState();
  return task;
}

function failTask(task, reason, details = null) {
  const failureDetails = details && typeof details === "object"
    ? {
        ...details,
        recoveryEvidence: details.recoveryEvidence ?? buildEyeHandRecoveryEvidence(task, reason, details),
      }
    : details;
  task.status = "failed";
  appendTaskPhase(task, "failed", { reason, details: failureDetails });
  task.outcome = {
    kind: "failed",
    summary: reason,
    reason,
    details: failureDetails,
    at: task.updatedAt,
  };
  task.closedAt = task.updatedAt;
  reconcileRuntimeState();
  persistState();
  return task;
}

function buildWorkViewAttachPayload(data, targetUrl) {
  const workView = data?.workView ?? {};
  return {
    workViewId: workView.workViewId ?? null,
    sessionId: data?.session?.sessionId ?? null,
    status: workView.status ?? "ready",
    visibility: workView.visibility ?? "visible",
    mode: workView.mode ?? "foreground-observable",
    helperStatus: workView.helperStatus ?? "active",
    displayTarget: workView.displayTarget ?? "workspace-2",
    activeUrl: workView.activeUrl ?? data?.browser?.browser?.activeUrl ?? data?.browser?.tab?.url ?? targetUrl,
  };
}


  return {
    serialiseTask,
    isActiveTask,
    hasRecoverableCapabilityPlan,
    hasRecoverableNativePluginRuntimeActivationPlan,
    hasRecoverableSearchWebAdapterPlan,
    buildEyeHandRecoveryEvidence,
    isRecoverableTask,
    compareTasksForDisplay,
    listTasks,
    getActiveTasks,
    getNextQueuedTask,
    getLatestFinishedTask,
    getLatestFailedTask,
    buildTaskSummary,
    createTask,
    getTaskById,
    appendTaskPhase,
    setTaskPhase,
    attachTaskToWorkView,
    bindTaskToTrustedWorkView,
    buildWorkViewAttachPayload,
    completeTask,
    failTask,
    recoverTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    reconcileInterruptedTasksAtStartup,
  };
}
