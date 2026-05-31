import { randomUUID } from "node:crypto";

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

  // L9571-9611
function serialiseTask(task) {
  const currentTask = getCurrentTask();
  return {
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
    sourceCommand: task.sourceCommand ?? null,
    systemdRepair: task.systemdRepair ?? null,
    systemdNextRepair: task.systemdNextRepair ?? null,
    systemdRepairCandidate: task.systemdRepairCandidate ?? null,
    operatorTakeover: task.operatorTakeover ?? null,
    bodyEvidenceLedgerDirectory: task.bodyEvidenceLedgerDirectory ?? null,
    bodyEvidenceLedgerFirstRecord: task.bodyEvidenceLedgerFirstRecord ?? null,
    bodyEvidenceLedgerFollowupRecord: task.bodyEvidenceLedgerFollowupRecord ?? null,
    longTermMemoryWrite: task.longTermMemoryWrite ?? null,
    cloudConsciousnessHandoff: task.cloudConsciousnessHandoff ?? null,
    cloudConsciousnessProviderDryRun: task.cloudConsciousnessProviderDryRun ?? null,
    cloudConsciousnessProviderCallRehearsal: task.cloudConsciousnessProviderCallRehearsal ?? null,
    cloudConsciousnessLiveProviderRunbook: task.cloudConsciousnessLiveProviderRunbook ?? null,
    cloudConsciousnessLiveProviderExecutionPlan: task.cloudConsciousnessLiveProviderExecutionPlan ?? null,
    cloudConsciousnessLiveProviderRuntimeAdapter: task.cloudConsciousnessLiveProviderRuntimeAdapter ?? null,
    cloudConsciousnessLiveProviderRuntimeImplementation: task.cloudConsciousnessLiveProviderRuntimeImplementation ?? null,
    cloudConsciousnessLiveProviderRuntimeAdapterImplementation: task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation ?? null,
    cloudConsciousnessLiveProviderRuntimeAdapterModule: task.cloudConsciousnessLiveProviderRuntimeAdapterModule ?? null,
    cloudConsciousnessLiveProviderRequestBuilder: task.cloudConsciousnessLiveProviderRequestBuilder ?? null,
    cloudConsciousnessLiveProviderCredentialReferenceResolver: task.cloudConsciousnessLiveProviderCredentialReferenceResolver ?? null,
    cloudConsciousnessLiveProviderNoNetworkSender: task.cloudConsciousnessLiveProviderNoNetworkSender ?? null,
    cloudConsciousnessLiveProviderEgressTranscriptRecorder: task.cloudConsciousnessLiveProviderEgressTranscriptRecorder ?? null,
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
  };
}


  // L9924-10040
function isActiveTask(task) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

const OPERATOR_INVOKABLE_CAPABILITIES = new Set([
  "sense.system.vitals",
  "sense.filesystem.read",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
  "act.filesystem.mkdir",
  "sense.process.list",
  "act.system.command.dry_run",
  "act.system.command.execute",
  "act.system.heal",
]);

function planCapabilityActionSteps(task) {
  return (task.plan?.steps ?? [])
    .filter((step) => step.phase === "acting_on_target" && OPERATOR_INVOKABLE_CAPABILITIES.has(step.capabilityId));
}

function isNativePluginRuntimeActivationTask(task) {
  return task?.type === "native_plugin_runtime_activation"
    && task?.plan?.strategy === "native-plugin-runtime-activation-v0";
}

function isNativePluginRuntimeAdapterTask(task) {
  return task?.type === "native_plugin_runtime_adapter_implementation"
    && task?.plan?.strategy === "native-plugin-runtime-adapter-v0";
}

function isOpenClawSearchWebAdapterTask(task) {
  return task?.type === "openclaw_search_web_adapter_invocation"
    && task?.plan?.strategy === "openclaw-search-web-adapter-v0";
}

function isOpenClawSearchWebRuntimeActivationTask(task) {
  return task?.type === "openclaw_search_web_runtime_activation"
    && task?.plan?.strategy === "openclaw-search-web-runtime-activation-v0";
}

function isOpenClawSearchWebProviderRuntimeSandboxTask(task) {
  return task?.type === "openclaw_search_web_provider_runtime_sandbox"
    && task?.plan?.strategy === "openclaw-search-web-provider-runtime-sandbox-v0";
}

function hasRecoverableCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

function hasRecoverableNativePluginRuntimeActivationPlan(task) {
  return (isNativePluginRuntimeActivationTask(task) || isNativePluginRuntimeAdapterTask(task))
    && task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
    && task?.plan?.governance?.canReadSourceFileContent === false
    && task?.plan?.governance?.canImportModule === false
    && task?.plan?.governance?.canExecutePluginCode === false
    && task?.plan?.governance?.canActivateRuntime === false;
}

function hasRecoverableSearchWebAdapterPlan(task) {
  const hasDeferredBoundary = isOpenClawSearchWebAdapterTask(task)
    ? task?.plan?.governance?.requiresRuntimePreflightBeforeExecution === true
    : isOpenClawSearchWebRuntimeActivationTask(task)
      ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
      : isOpenClawSearchWebProviderRuntimeSandboxTask(task)
        ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
        : false;
  return hasDeferredBoundary
    && task?.plan?.governance?.canUseNetwork === false
    && task?.plan?.governance?.canExecutePluginCode === false;
}

function isRecoverableTask(task) {
  if (!["completed", "failed", "superseded"].includes(task.status)) {
    return false;
  }

  if (typeof task.targetUrl === "string" && task.targetUrl.trim().length > 0) {
    return true;
  }

  return hasRecoverableCapabilityPlan(task)
    || hasRecoverableNativePluginRuntimeActivationPlan(task)
    || hasRecoverableSearchWebAdapterPlan(task);
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
    sourceCommand:
      body.sourceCommand && typeof body.sourceCommand === "object"
        ? clonePlainObject(body.sourceCommand)
        : null,
    systemdRepair:
      body.systemdRepair && typeof body.systemdRepair === "object"
        ? clonePlainObject(body.systemdRepair)
        : null,
    systemdNextRepair:
      body.systemdNextRepair && typeof body.systemdNextRepair === "object"
        ? clonePlainObject(body.systemdNextRepair)
        : null,
    cloudConsciousnessLiveProviderExecutionPlan:
      body.cloudConsciousnessLiveProviderExecutionPlan && typeof body.cloudConsciousnessLiveProviderExecutionPlan === "object"
        ? clonePlainObject(body.cloudConsciousnessLiveProviderExecutionPlan)
        : null,
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

function buildEyeHandRecoveryEvidence(task, reason, details = null) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const verification = details.verification ?? null;
  const actionEvidence = details.actionEvidence ?? verification?.actionEvidence ?? null;
  const workViewSummary = details.workViewSummary ?? verification?.workViewSummary ?? null;

  if (!actionEvidence && !workViewSummary) {
    return null;
  }

  const failedChecks = (verification?.failedChecks ?? []).map((check) => ({
    name: check.name ?? null,
    expected: check.expected ?? null,
    actual: check.actual ?? null,
  }));
  const observedUrl = actionEvidence?.observedAfterActions?.url ?? workViewSummary?.url ?? details.targetUrl ?? task.targetUrl ?? null;

  return {
    kind: "eye-hand-recovery-evidence",
    sourceTaskId: task.id,
    reason,
    failedChecks,
    targetUrl: details.targetUrl ?? task.targetUrl ?? null,
    observedUrl,
    actionEvidence,
    workViewSummary,
    recommendation: {
      strategy: "retry_with_fresh_observation",
      targetUrl: observedUrl,
      rationale: failedChecks.length > 0
        ? `Recover by re-opening the work view and re-verifying failed check(s): ${failedChecks.map((check) => check.name).join(", ")}.`
        : "Recover by re-opening the work view and re-checking the latest observation after the recorded action sequence.",
    },
  };
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

function clonePlainObject(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

function buildRecoveredPolicyRequest(sourceTask) {
  const request = clonePlainObject(sourceTask.policy?.request ?? sourceTask.policy ?? {});
  delete request.approved;
  return request;
}

function resetRecoveredPlan(plan) {
  const now = new Date().toISOString();
  const recoveredPlan = clonePlainObject(plan);
  recoveredPlan.planId = `plan-${randomUUID()}`;
  recoveredPlan.status = "planned";
  recoveredPlan.createdAt = now;
  recoveredPlan.updatedAt = now;
  delete recoveredPlan.failure;

  if (Array.isArray(recoveredPlan.steps)) {
    recoveredPlan.steps = recoveredPlan.steps.map((step) => {
      const recoveredStep = {
        ...step,
        status: "pending",
      };
      delete recoveredStep.completedAt;
      delete recoveredStep.details;
      return recoveredStep;
    });
  }

  return recoveredPlan;
}

function recoverTask(sourceTask) {
  if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
    throw new Error(`Task already has a recovery task: ${sourceTask.recoveredByTaskId}`);
  }

  const recoveryAttempt = (sourceTask.recovery?.attempt ?? 0) + 1;
  const recoverableCapabilityPlan = hasRecoverableCapabilityPlan(sourceTask);
  const recoverableNativePluginRuntimeActivationPlan = hasRecoverableNativePluginRuntimeActivationPlan(sourceTask);
  const recoverableSearchWebAdapterPlan = hasRecoverableSearchWebAdapterPlan(sourceTask);
  const shouldRecoverExistingPlan = recoverableCapabilityPlan
    || recoverableNativePluginRuntimeActivationPlan
    || recoverableSearchWebAdapterPlan;
  const recoveryBody = {
    goal: sourceTask.goal,
    type: sourceTask.type,
    targetUrl: sourceTask.targetUrl,
    workViewStrategy: sourceTask.workViewStrategy,
    includePlan: Boolean(sourceTask.plan) && !shouldRecoverExistingPlan,
    recovery: {
      recoveredFromTaskId: sourceTask.id,
      recoveredFromOutcome: sourceTask.outcome?.kind ?? sourceTask.status,
      attempt: recoveryAttempt,
      recoveryEvidence: sourceTask.outcome?.details?.recoveryEvidence ?? null,
    },
  };

  if (shouldRecoverExistingPlan) {
    recoveryBody.plan = resetRecoveredPlan(sourceTask.plan);
    recoveryBody.policy = buildRecoveredPolicyRequest(sourceTask);
  }
  if (sourceTask.sourceCommand && typeof sourceTask.sourceCommand === "object") {
    recoveryBody.sourceCommand = sourceTask.sourceCommand;
  }

  const recoveredTask = createTask(recoveryBody);

  sourceTask.recoveredByTaskId = recoveredTask.id;
  sourceTask.updatedAt = new Date().toISOString();
  persistState();
  return recoveredTask;
}

function buildWorkViewAttachPayload(data, targetUrl) {
  const workView = data?.workView ?? {};
  return {
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
    buildWorkViewAttachPayload,
    completeTask,
    failTask,
    recoverTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
  };
}
