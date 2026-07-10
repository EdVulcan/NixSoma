import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { createDelegatedPlanTaskHandlers } from "./task-executor-delegated-plan-handlers.mjs";
import { createNativeDeferredTaskHandlers } from "./task-executor-native-deferred-handlers.mjs";
import { createNativePluginRuntimeRefreshTaskHandlers } from "./task-executor-native-plugin-runtime-refresh-handlers.mjs";
import { createNativeAcpxCodexBridgeTaskHandlers } from "./task-executor-native-acpx-codex-bridge-handlers.mjs";
import { createNativeEngineeringLspLifecycleTaskHandlers } from "./native-engineering-lsp-lifecycle-tasks.mjs";
import { createSystemBodyTaskHandlers } from "./task-executor-system-body-handlers.mjs";
import { planCapabilityActionSteps } from "./task-recovery.mjs";
import {
  executeBrowserTaskActionWithCaptureRecovery,
  observedBrowserTaskUrl,
} from "./browser-task-action-contract.mjs";

export function createTaskExecutor(deps) {
  const { client, state, taskManager, planBuilder, approvalEngine, workspaceOps, policyEvaluator, publishEvent } = deps;
  const {
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenSenseUrl,
    screenActUrl,
  } = client;
  const {
    tasks,
    persistState,
    approvals,
    policyAuditLog,
    capabilityInvocationLog,
    runtimeState,
    updateRuntimeState,
    getCurrentTask,
  } = state;
  const {
    serialiseTask,
    createTask,
    isActiveTask,
    recoverTask,
    getTaskById,
    appendTaskPhase,
    setTaskPhase,
    attachTaskToWorkView,
    buildWorkViewAttachPayload,
    completeTask,
    failTask,
    reconcileRuntimeState,
    getNextQueuedTask,
    buildTaskSummary,
  } = taskManager;
  const {
    invokeCapability,
    capabilityById,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
  } = planBuilder;
  const { serialiseApproval, buildApprovalSummary, createApprovalRequestForTask, publishTaskApprovalIfPending } = approvalEngine;
  const { applyWorkspacePatchEdits, readBoundedWorkspaceTextFile } = workspaceOps;
  const { ensureTaskPolicy, recordPolicyDecision, evaluatePolicyIntent, isPolicyExecutionAllowed } = policyEvaluator;

  // L10299-10323
function buildOperatorState() {
  reconcileRuntimeState();
  const currentTask = getCurrentTask();
  const nextTask = getNextQueuedTask();
  const paused = runtimeState.paused === true;
  return {
    status: paused ? "paused" : nextTask ? "ready" : "idle",
    blocked: paused,
    reason: paused ? "runtime_paused" : null,
    currentTask: currentTask ? serialiseTask(currentTask) : null,
    nextTask: nextTask ? serialiseTask(nextTask) : null,
    policy: {
      respectsPause: true,
      enforcesTaskPolicy: true,
      defaultMaxSteps: 5,
      maxStepsLimit: 20,
      supportsDryRun: true,
      controls: ["pause", "resume", "stop", "takeover"],
      decisions: ["allow", "audit_only", "require_approval", "deny"],
    },
    approvals: buildApprovalSummary(),
    summary: buildTaskSummary(),
  };
}


  // L19586-22450
function normaliseExecutorActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-task-executor" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      params: action.params && typeof action.params === "object" ? action.params : {},
    }));
}

function shouldExecuteCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

function inferCapabilityOperation(step) {
  if (typeof step.params?.operation === "string" && step.params.operation.trim()) {
    return step.params.operation.trim();
  }
  if (step.kind === "filesystem.metadata") {
    return "metadata";
  }
  if (step.kind === "filesystem.read_text" || step.kind === "filesystem.read-text") {
    return "read_text";
  }
  if (step.kind === "filesystem.search") {
    return "search";
  }
  if (step.kind === "filesystem.list") {
    return "list";
  }
  return null;
}

function buildCapabilityInvokeBodyFromPlanStep(step, task) {
  const approved = isTaskPolicyApproved(task);
  return {
    capabilityId: step.capabilityId,
    taskId: task.id,
    intent: step.intent ?? step.kind,
    operation: inferCapabilityOperation(step),
    approved,
    params: step.params ?? {},
    policy: {
      intent: step.intent ?? step.kind,
      approved,
    },
  };
}

function buildCommandTranscriptEntry(step, response) {
  if (response.capability?.id !== "act.system.command.execute") {
    return null;
  }
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: response.capability.id,
    invocationId: response.invocation?.id ?? null,
    command: response.invocation?.request?.command ?? step.params?.command ?? null,
    exitCode: response.summary?.exitCode ?? null,
    timedOut: response.summary?.timedOut ?? null,
    stdout: response.summary?.stdout ?? "",
    stderr: response.summary?.stderr ?? "",
  };
}

function normaliseCommandFailureMode(step) {
  const mode = typeof step.onFailure === "string" ? step.onFailure.trim() : "";
  return mode === "continue" ? "continue" : "fail_task";
}

function isFailedCommandTranscriptEntry(entry) {
  return entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0);
}

function latestExecutedCommandTranscriptEntry(commandTranscript) {
  return commandTranscript
    .slice()
    .reverse()
    .find((entry) => entry.capabilityId === "act.system.command.execute" && entry.skipped !== true) ?? null;
}

function evaluateCommandStepCondition(step, commandTranscript) {
  const condition = step.when && typeof step.when === "object" ? step.when : null;
  if (!condition) {
    return { shouldRun: true, reason: null, condition: null };
  }

  const previous = latestExecutedCommandTranscriptEntry(commandTranscript);
  if (!previous) {
    return { shouldRun: false, reason: "missing_previous_command_result", condition };
  }

  if (typeof condition.previousStdoutIncludes === "string" && !previous.stdout.includes(condition.previousStdoutIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_missing_text", condition };
  }
  if (typeof condition.previousStdoutNotIncludes === "string" && previous.stdout.includes(condition.previousStdoutNotIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_contains_text", condition };
  }
  if (Number.isInteger(condition.previousExitCode) && previous.exitCode !== condition.previousExitCode) {
    return { shouldRun: false, reason: "previous_exit_code_mismatch", condition };
  }

  return { shouldRun: true, reason: null, condition };
}

function buildSkippedCommandTranscriptEntry(step, conditionResult) {
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: step.capabilityId ?? null,
    invocationId: null,
    command: step.params?.command ?? null,
    skipped: true,
    skipReason: conditionResult.reason,
    condition: conditionResult.condition,
    exitCode: null,
    timedOut: false,
    stdout: "",
    stderr: "",
  };
}

function extractTaskCommandTranscript(task) {
  return Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
}

function classifyCommandTranscriptEntry(entry) {
  if (entry?.skipped === true) {
    return "skipped";
  }
  if (entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0)) {
    return "failed";
  }
  return "executed";
}

function buildCommandTranscriptRecords() {
  return [...tasks.values()]
    .flatMap((task) => extractTaskCommandTranscript(task).map((entry, index) => ({
      taskId: task.id,
      taskGoal: task.goal,
      taskStatus: task.status,
      taskClosedAt: task.closedAt ?? null,
      taskUpdatedAt: task.updatedAt ?? null,
      sourceCommand: task.sourceCommand ?? null,
      taskOutcome: task.outcome?.kind ?? task.status,
      index,
      state: classifyCommandTranscriptEntry(entry),
      stepId: entry.stepId ?? null,
      actionKind: entry.actionKind ?? null,
      capabilityId: entry.capabilityId ?? null,
      invocationId: entry.invocationId ?? null,
      command: entry.command ?? null,
      exitCode: entry.exitCode ?? null,
      timedOut: entry.timedOut === true,
      skipped: entry.skipped === true,
      skipReason: entry.skipReason ?? null,
      stdout: entry.stdout ?? "",
      stderr: entry.stderr ?? "",
    })))
    .sort((left, right) => {
      const leftTime = Date.parse(left.taskClosedAt ?? left.taskUpdatedAt ?? "");
      const rightTime = Date.parse(right.taskClosedAt ?? right.taskUpdatedAt ?? "");
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
      if (safeLeftTime !== safeRightTime) {
        return safeRightTime - safeLeftTime;
      }
      if (left.taskId !== right.taskId) {
        return String(right.taskId).localeCompare(String(left.taskId));
      }
      return left.index - right.index;
    });
}

function listCommandTranscriptRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildCommandTranscriptRecords().slice(0, safeLimit);
}

function buildCommandTranscriptSummary() {
  return buildCommandTranscriptRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.state] = (summary[record.state] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const command = record.command ?? "unknown";
    summary.byCommand[command] = (summary.byCommand[command] ?? 0) + 1;
    const status = record.taskStatus ?? "unknown";
    summary.byTaskStatus[status] = (summary.byTaskStatus[status] ?? 0) + 1;
    const timestamp = record.taskClosedAt ?? record.taskUpdatedAt ?? null;
    if (timestamp && (!summary.latestAt || String(timestamp).localeCompare(summary.latestAt) > 0)) {
      summary.latestAt = timestamp;
    }
    return summary;
  }, {
    total: 0,
    executed: 0,
    skipped: 0,
    failed: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCommand: {},
    byTaskStatus: {},
  });
}

function serialiseCommandTranscriptSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

const FILESYSTEM_CHANGE_CAPABILITIES = new Set([
  "act.filesystem.mkdir",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
]);

function classifyFilesystemChange(entry) {
  if (entry.capability?.id === "act.filesystem.mkdir") {
    return "mkdir";
  }
  if (entry.capability?.id === "act.filesystem.write_text") {
    return "write_text";
  }
  if (entry.capability?.id === "act.filesystem.append_text") {
    return "append_text";
  }
  return "unknown";
}

function buildFilesystemChangeRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && FILESYSTEM_CHANGE_CAPABILITIES.has(entry.capability?.id))
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      change: classifyFilesystemChange(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      overwrite: entry.summary?.overwrite ?? null,
      created: entry.summary?.created ?? null,
      recursive: entry.summary?.recursive ?? null,
      previousBytes: entry.summary?.previousBytes ?? null,
      totalBytes: entry.summary?.totalBytes ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemChangeRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemChangeRecords().slice(0, safeLimit);
}

function buildFilesystemChangeSummary() {
  return buildFilesystemChangeRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.change] = (summary[record.change] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    mkdir: 0,
    write_text: 0,
    append_text: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemChangeSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function classifyFilesystemRead(entry) {
  const requestedOperation = entry.request?.operation ?? null;
  if (requestedOperation === "read-text") {
    return "read_text";
  }
  return entry.summary?.operation ?? requestedOperation ?? "read";
}

function buildFilesystemReadRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && entry.capability?.id === "sense.filesystem.read")
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      operation: classifyFilesystemRead(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      count: entry.summary?.count ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      encoding: entry.summary?.encoding ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemReadRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemReadRecords().slice(0, safeLimit);
}

function buildFilesystemReadSummary() {
  return buildFilesystemReadRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.operation] = (summary[record.operation] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    metadata: 0,
    list: 0,
    search: 0,
    read_text: 0,
    read: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemReadSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function isTaskPolicyApproved(task) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || approval?.status === "approved";
}

function buildCapabilityApprovalGate(task, actionSteps) {
  if (isTaskPolicyApproved(task)) {
    return null;
  }

  for (const step of actionSteps) {
    const capability = capabilityById(step.capabilityId);
    const requiresApproval = step.requiresApproval === true
      || capability?.requiresApproval === true
      || capability?.governance === "require_approval";
    if (!capability || !requiresApproval) {
      continue;
    }

    const request = normaliseCapabilityInvokeRequest(buildCapabilityInvokeBodyFromPlanStep(step, task));
    const decision = recordPolicyDecision(evaluatePolicyIntent(
      buildCapabilityPolicyInput(capability, request),
      {
        stage: "capability_plan.approval",
        taskId: task.id,
        type: task.type,
        goal: task.goal,
      },
    ));

    if (!isPolicyExecutionAllowed(decision)) {
      return {
        step,
        capability,
        decision,
        reason: decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      };
    }
  }

  return null;
}

function buildActionEvidence(actionResults, workViewSummary) {
  const actions = actionResults.map((action, index) => ({
    index,
    id: action?.id ?? null,
    kind: action?.kind ?? null,
    params: action?.params ?? {},
    degraded: Boolean(action?.degraded),
    result: action?.result ?? null,
    executedAt: action?.executedAt ?? null,
    screenContext: action?.screenContext ?? null,
    mediation: action?.mediation ? {
      accepted: action.mediation.accepted === true,
      transport: action.mediation.transport ?? null,
      effect: action.mediation.effect ?? null,
    } : null,
    recovery: action?.recovery ?? null,
  }));

  return {
    kind: "eye-hand-action-evidence",
    actionCount: actions.length,
    degradedCount: actions.filter((action) => action.degraded).length,
    actions,
    observedAfterActions: workViewSummary
      ? {
          summaryText: workViewSummary.summaryText ?? null,
          url: workViewSummary.url ?? null,
          visibleTextBlocks: workViewSummary.visibleTextBlocks ?? [],
          recentInteraction: workViewSummary.recentInteraction ?? null,
        }
      : null,
  };
}

function buildExecutionVerification({ targetUrl, options, verifiedScreen, actionResults, workView }) {
  const expectedUrl =
    typeof options.expectedUrl === "string" && options.expectedUrl.trim()
      ? options.expectedUrl.trim()
      : targetUrl;
  const expectedReadiness =
    typeof options.expectedReadiness === "string" && options.expectedReadiness.trim()
      ? options.expectedReadiness.trim()
      : "ready";
  const workViewSummary = verifiedScreen?.screen?.workViewSummary ?? null;
  const activeUrl = observedBrowserTaskUrl({
    workViewSummary,
    workView,
    snapshotText: verifiedScreen?.screen?.snapshotText,
  });
  const readiness = verifiedScreen?.screen?.readiness ?? null;
  const actionEvidence = buildActionEvidence(actionResults, workViewSummary);
  const degradedActions = actionResults.filter((action) => action?.degraded);
  const checks = [
    {
      name: "target_url",
      expected: expectedUrl,
      actual: activeUrl,
      passed: activeUrl === expectedUrl,
    },
    {
      name: "screen_readiness",
      expected: expectedReadiness,
      actual: readiness,
      passed: readiness === expectedReadiness,
    },
    {
      name: "actions_not_degraded",
      expected: 0,
      actual: degradedActions.length,
      passed: degradedActions.length === 0,
    },
  ];

  if (options.hideOnComplete === false) {
    checks.push({
      name: "work_view_visible",
      expected: "visible",
      actual: workView?.visibility ?? null,
      passed: workView?.visibility === "visible",
    });
  }

  const failedChecks = checks.filter((check) => !check.passed);
  return {
    ok: failedChecks.length === 0,
    expectedUrl,
    expectedReadiness,
    activeUrl,
    readiness,
    workViewSummary,
    observedTextBlocks: workViewSummary?.visibleTextBlocks ?? [],
    recentInteraction: workViewSummary?.recentInteraction ?? null,
    actionEvidence,
    checks,
    failedChecks,
  };
}

async function executeTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const targetUrl =
    typeof options.targetUrl === "string" && options.targetUrl.trim()
      ? options.targetUrl.trim()
      : task.targetUrl;
  if (!targetUrl) {
    throw new Error("Task targetUrl is required for execution.");
  }

  const policy = ensureTaskPolicy(task, { stage: "task.execute", targetUrl });
  await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked task execution: ${policy.decision.reason}`, {
      targetUrl,
      executor: "core-v2",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent(createEventName("task.failed"), {
      task: serialiseTask(failedTask),
      reason: "Policy blocked task execution.",
      policy: policy.decision,
      executor: "core-v2",
    });
    return {
      task: failedTask,
      prepare: null,
      reveal: null,
      initialScreen: null,
      verifiedScreen: null,
      actions: [],
      finalWorkViewState: null,
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const displayTarget =
    typeof options.displayTarget === "string" && options.displayTarget.trim()
      ? options.displayTarget.trim()
      : "workspace-2";
  const actions = normaliseExecutorActions(options.actions);
  const actionResults = [];

  try {
    await setTaskPhase(task, "preparing_work_view", {
      status: "running",
      details: { targetUrl, displayTarget, executor: "core-v1" },
    });
    const prepare = await postJson(`${sessionManagerUrl}/work-view/prepare`, {
      displayTarget,
      entryUrl: targetUrl,
    });

    await setTaskPhase(task, "opening_target", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const reveal = await postJson(`${sessionManagerUrl}/work-view/reveal`, {
      entryUrl: targetUrl,
    });
    const attachedTask = attachTaskToWorkView(task, buildWorkViewAttachPayload(reveal, targetUrl));
    await publishEvent(createEventName("task.running"), { task: serialiseTask(attachedTask) });

    await setTaskPhase(task, "observing_screen", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const initialScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    for (const action of actions) {
      const actionData = await executeBrowserTaskActionWithCaptureRecovery({
        action,
        recoveryEnabled: options.recoverCaptureInterruptions !== false,
        postAction: (endpoint, params) => postJson(`${screenActUrl}${endpoint}`, params),
        prepareWorkView: () => postJson(`${sessionManagerUrl}/work-view/prepare`, {
          displayTarget,
          entryUrl: targetUrl,
          operatorActionSource: "task_capture_interruption_recovery",
          recommendedAction: "prepare_work_view",
        }),
      });
      actionResults.push(actionData.action);
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: action.kind,
          degraded: Boolean(actionData.action?.degraded),
          result: actionData.action?.result ?? null,
          captureRecoveryAttempted: actionData.action?.recovery?.attempted === true,
          executor: "core-v1",
        },
      });
    }

    await setTaskPhase(task, "verifying_result", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const verifiedScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    const preCompletionWorkViewState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    const verificationWorkView = preCompletionWorkViewState?.workView ?? reveal?.workView ?? {};
    const verification = buildExecutionVerification({
      targetUrl,
      options,
      verifiedScreen,
      actionResults,
      workView: verificationWorkView,
    });

    if (!verification.ok) {
      const failedTask = failTask(task, "Executor verification failed.", {
        targetUrl,
        executor: "core-v2",
        verification,
        workViewSummary: verification.workViewSummary ?? null,
        actionEvidence: verification.actionEvidence ?? null,
        actionCount: actionResults.length,
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: "Executor verification failed.",
        verification,
        executor: "core-v2",
      });
      return {
        task: failedTask,
        prepare,
        reveal,
        initialScreen,
        verifiedScreen,
        actions: actionResults,
        finalWorkViewState: preCompletionWorkViewState,
        verification,
      };
    }

    let finalWorkViewState = preCompletionWorkViewState;
    if (options.hideOnComplete !== false) {
      finalWorkViewState = await postJson(`${sessionManagerUrl}/work-view/hide`, {});
    }

    const workView = finalWorkViewState?.workView ?? verificationWorkView;
    const updatedTask = completeTask(task, {
      targetUrl,
      workViewUrl: targetUrl,
      summary: `Executor completed task at ${targetUrl}`,
      executor: "core-v2",
      actionCount: actionResults.length,
      verification,
      workViewSummary: verification.workViewSummary ?? null,
      actionEvidence: verification.actionEvidence ?? null,
      initialScreen: {
        readiness: initialScreen.screen?.readiness ?? null,
        focusedWindow: initialScreen.screen?.focusedWindow ?? null,
      },
      verifiedScreen: {
        readiness: verifiedScreen.screen?.readiness ?? null,
        focusedWindow: verifiedScreen.screen?.focusedWindow ?? null,
        workViewSummary: verification.workViewSummary ?? null,
      },
      actions: actionResults.map((action) => ({
        id: action?.id ?? null,
        kind: action?.kind ?? null,
        params: action?.params ?? {},
        degraded: Boolean(action?.degraded),
        result: action?.result ?? null,
        screenContext: action?.screenContext ?? null,
        mediation: action?.mediation ? {
          accepted: action.mediation.accepted === true,
          transport: action.mediation.transport ?? null,
          effect: action.mediation.effect ?? null,
        } : null,
        recovery: action?.recovery ?? null,
      })),
      workView: {
        status: workView.status ?? null,
        visibility: workView.visibility ?? null,
        mode: workView.mode ?? null,
        helperStatus: workView.helperStatus ?? null,
        browserStatus: workView.browserStatus ?? null,
        entryUrl: workView.entryUrl ?? targetUrl,
        activeUrl: workView.activeUrl ?? targetUrl,
        displayTarget: workView.displayTarget ?? displayTarget,
      },
    });
    await publishEvent(createEventName("task.completed"), { task: serialiseTask(updatedTask), executor: "core-v2", verification });
    return {
      task: updatedTask,
      prepare,
      reveal,
      initialScreen,
      verifiedScreen,
      actions: actionResults,
      finalWorkViewState,
      verification,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task execution failed.";
    const failedTask = failTask(task, message, {
      targetUrl,
      executor: "core-v1",
      actionCount: actionResults.length,
    });
    await publishEvent(createEventName("task.failed"), { task: serialiseTask(failedTask), reason: message, executor: "core-v1" });
    throw error;
  }
}

async function executeCapabilityPlanTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const actionSteps = planCapabilityActionSteps(task);
  if (actionSteps.length === 0) {
    throw new Error("Task does not include invokable capability plan steps.");
  }

  const policy = ensureTaskPolicy(task, { stage: "capability_plan.execute" });
  await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked capability plan execution: ${policy.decision.reason}`, {
      executor: "capability-invoke-v1",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent(createEventName("task.failed"), {
      task: serialiseTask(failedTask),
      reason: "Policy blocked capability plan execution.",
      policy: policy.decision,
      executor: "capability-invoke-v1",
    });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const approvalGate = buildCapabilityApprovalGate(task, actionSteps);
  if (approvalGate) {
    const approval = createApprovalRequestForTask(task, approvalGate.decision);
    await publishEvent(createEventName("policy.evaluated"), {
      task: serialiseTask(task),
      policy: approvalGate.decision,
      capability: approvalGate.capability,
    });
    await setTaskPhase(task, "waiting_for_approval", {
      status: "queued",
      details: {
        executor: "capability-invoke-v1",
        capabilityId: approvalGate.capability.id,
        actionKind: approvalGate.step.kind,
        reason: approvalGate.reason,
        approvalId: approval.id,
      },
    });
    await publishTaskApprovalIfPending(task);
    return {
      task,
      blocked: true,
      reason: approvalGate.reason,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: approvalGate.decision,
      approval: serialiseApproval(approval),
    };
  }

  const capabilityInvocations = [];
  const commandTranscript = [];
  try {
    for (const step of actionSteps) {
      const conditionResult = evaluateCommandStepCondition(step, commandTranscript);
      if (!conditionResult.shouldRun) {
        const transcriptEntry = buildSkippedCommandTranscriptEntry(step, conditionResult);
        commandTranscript.push(transcriptEntry);
        await setTaskPhase(task, "acting_on_target", {
          status: "running",
          details: {
            actionKind: step.kind,
            capabilityId: step.capabilityId,
            skipped: true,
            skipReason: conditionResult.reason,
            condition: conditionResult.condition,
            executor: "capability-invoke-v1",
          },
        });
        continue;
      }

      const invocation = await invokeCapability(buildCapabilityInvokeBodyFromPlanStep(step, task));
      const response = invocation.response;
      capabilityInvocations.push(response);
      const transcriptEntry = buildCommandTranscriptEntry(step, response);
      if (transcriptEntry) {
        commandTranscript.push(transcriptEntry);
      }
      if (response.blocked === true || response.invoked !== true) {
        const failedTask = failTask(task, `Capability invocation blocked: ${response.reason ?? "unknown"}`, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
        });
        await publishEvent(createEventName("task.failed"), {
          task: serialiseTask(failedTask),
          reason: "Capability invocation blocked.",
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }

      const failureMode = transcriptEntry ? normaliseCommandFailureMode(step) : null;
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: step.kind,
          capabilityId: step.capabilityId,
          invocationId: response.invocation?.id ?? null,
          summary: response.summary ?? null,
          commandFailed: transcriptEntry ? isFailedCommandTranscriptEntry(transcriptEntry) : false,
          onFailure: failureMode,
          executor: "capability-invoke-v1",
        },
      });

      if (transcriptEntry && isFailedCommandTranscriptEntry(transcriptEntry) && failureMode !== "continue") {
        const reason = transcriptEntry.timedOut === true
          ? "Command execution timed out."
          : `Command execution failed with exit code ${transcriptEntry.exitCode}.`;
        const failedTask = failTask(task, reason, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
          commandTranscript,
          failedCommand: transcriptEntry,
          onFailure: failureMode,
        });
        await publishEvent(createEventName("task.failed"), {
          task: serialiseTask(failedTask),
          reason,
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          commandTranscript,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }
    }

    const completedTask = completeTask(task, {
      executor: "capability-invoke-v1",
      summary: `Completed ${capabilityInvocations.length} capability invocation(s).`,
      capabilityInvocations: capabilityInvocations.map((response) => ({
        id: response.invocation?.id ?? null,
        capabilityId: response.capability?.id ?? null,
        invoked: response.invoked === true,
        blocked: response.blocked === true,
        summary: response.summary ?? null,
      })),
      commandTranscript,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "capability-invoke-v1",
      capabilityInvocations: capabilityInvocations.map((response) => response.invocation ?? null),
    });
    return {
      task: completedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: { ok: true, checks: [], failedChecks: [] },
      policy: policy.decision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    const failedTask = failTask(task, message, {
      executor: "capability-invoke-v1",
      capabilityInvocations,
      commandTranscript,
    });
    await publishEvent(createEventName("task.failed"), { task: serialiseTask(failedTask), reason: message, executor: "capability-invoke-v1" });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: null,
      policy: policy.decision,
    };
  }
}

function recoveryEvidenceTargetUrl(sourceTask) {
  const targetUrl = sourceTask?.outcome?.details?.recoveryEvidence?.recommendation?.targetUrl;
  return typeof targetUrl === "string" && targetUrl.trim() ? targetUrl.trim() : null;
}

function buildRecoveryExecuteOptions(options, attempt, sourceTask = null) {
  const recoveryOptions = options.recovery && typeof options.recovery === "object" ? options.recovery : {};
  const evidenceTargetUrl = recoveryEvidenceTargetUrl(sourceTask);
  return {
    ...options,
    ...recoveryOptions,
    autoRecover: false,
    recoveryEvidenceTargetUrl: evidenceTargetUrl,
    expectedUrl:
      typeof recoveryOptions.expectedUrl === "string" && recoveryOptions.expectedUrl.trim()
        ? recoveryOptions.expectedUrl.trim()
        : evidenceTargetUrl
          ? evidenceTargetUrl
        : typeof options.recoveryExpectedUrl === "string" && options.recoveryExpectedUrl.trim()
          ? options.recoveryExpectedUrl.trim()
          : options.targetUrl,
    actions: Array.isArray(recoveryOptions.actions) ? recoveryOptions.actions : options.actions,
    recoveryAttempt: attempt,
  };
}

function serialiseExecutionResult(executionResult) {
  const finalExecution = executionResult.finalExecution ?? executionResult;
  return {
    executor: finalExecution.capabilityInvocations ? "capability-invoke-v1" : executionResult.recovery?.attempted ? "core-v3" : finalExecution.verification ? "core-v2" : "core-v1",
    actions: (finalExecution.actions ?? []).map((action) => ({
      kind: action?.kind ?? null,
      degraded: Boolean(action?.degraded),
      result: action?.result ?? null,
    })),
    policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
    verification: finalExecution.verification ?? null,
    workViewSummary:
      finalExecution.verification?.workViewSummary
      ?? finalExecution.task?.outcome?.details?.workViewSummary
      ?? null,
    observedTextBlocks: finalExecution.verification?.observedTextBlocks ?? [],
    actionEvidence:
      finalExecution.verification?.actionEvidence
      ?? finalExecution.task?.outcome?.details?.actionEvidence
      ?? null,
    capabilityInvocations: (finalExecution.capabilityInvocations ?? []).map((response) => ({
      id: response.invocation?.id ?? null,
      capabilityId: response.capability?.id ?? null,
      invoked: response.invoked === true,
      blocked: response.blocked === true,
      reason: response.reason ?? null,
      summary: response.summary ?? null,
    })),
    commandTranscript: finalExecution.task?.outcome?.details?.commandTranscript ?? [],
    finalReadiness: finalExecution.verifiedScreen?.screen?.readiness ?? null,
    finalWorkView: finalExecution.finalWorkViewState?.workView ?? null,
    recovery: executionResult.recovery ?? null,
    attempts: (executionResult.attempts ?? [finalExecution]).map((attempt) => ({
      taskId: attempt.task?.id ?? null,
      status: attempt.task?.status ?? null,
      phase: attempt.task?.executionPhase ?? null,
      verification: attempt.verification?.ok ?? null,
      workViewSummaryUrl: attempt.verification?.workViewSummary?.url ?? null,
      failedChecks: attempt.verification?.failedChecks?.map((check) => check.name) ?? [],
    })),
  };
}

function buildNonRecoverableExecutionResult(finalExecution) {
  return {
    finalExecution,
    attempts: [finalExecution],
    recovery: {
      attempted: false,
      maxAttempts: 0,
    },
  };
}

const NON_RECOVERABLE_TASK_HANDLERS = [
  ...createNativeEngineeringLspLifecycleTaskHandlers({ state, taskManager, approvalEngine, policyEvaluator, publishEvent }),
  ...createNativePluginRuntimeRefreshTaskHandlers({ state, taskManager, approvalEngine, policyEvaluator, planBuilder, publishEvent }),
  ...createNativeAcpxCodexBridgeTaskHandlers({ state, taskManager, approvalEngine, policyEvaluator, planBuilder, publishEvent }),
  ...createNativeDeferredTaskHandlers({ state, taskManager, approvalEngine, policyEvaluator, publishEvent }),
  ...createSystemBodyTaskHandlers({ client, state, taskManager, publishEvent }),
  ...createDelegatedPlanTaskHandlers(planBuilder),
  { name: "capability-plan", predicate: shouldExecuteCapabilityPlan, execute: executeCapabilityPlanTask },
];

async function executeMatchedNonRecoverableTask(task, options) {
  const entry = NON_RECOVERABLE_TASK_HANDLERS.find(({ predicate }) => predicate(task));
  if (!entry) {
    return null;
  }

  return buildNonRecoverableExecutionResult(await entry.execute(task, options));
}

async function executeTaskWithRecovery(task, options = {}) {
  const nonRecoverableExecution = await executeMatchedNonRecoverableTask(task, options);
  if (nonRecoverableExecution) {
    return nonRecoverableExecution;
  }

  const firstExecution = await executeTask(task, options);
  const maxRecoveryAttempts =
    Number.isInteger(options.maxRecoveryAttempts) && options.maxRecoveryAttempts > 0
      ? options.maxRecoveryAttempts
      : Number.isInteger(options.retryBudget) && options.retryBudget > 0
        ? options.retryBudget
        : 0;

  if (firstExecution.task.status !== "failed" || options.autoRecover !== true || maxRecoveryAttempts < 1) {
    return {
      finalExecution: firstExecution,
      attempts: [firstExecution],
      recovery: {
        attempted: false,
        maxAttempts: maxRecoveryAttempts,
      },
    };
  }

  let sourceTask = firstExecution.task;
  const attempts = [firstExecution];
  const recoveredTaskIds = [];
  const usedRecommendationTargetUrls = [];

  for (let attempt = 1; attempt <= maxRecoveryAttempts; attempt += 1) {
    const recoveredTask = recoverTask(sourceTask);
    recoveredTaskIds.push(recoveredTask.id);
    reconcileRuntimeState();
    await publishEvent(createEventName("task.created"), { task: serialiseTask(recoveredTask), executor: "core-v3" });
    await publishTaskApprovalIfPending(recoveredTask);
    await publishEvent(createEventName("task.recovered"), {
      task: serialiseTask(recoveredTask),
      recoveredFromTaskId: sourceTask.id,
      autoRecovered: true,
      attempt,
      executor: "core-v3",
    });

    const recoveryOptions = buildRecoveryExecuteOptions(options, attempt, sourceTask);
    if (recoveryOptions.recoveryEvidenceTargetUrl) {
      usedRecommendationTargetUrls.push(recoveryOptions.recoveryEvidenceTargetUrl);
    }
    const recoveryExecution = await executeTask(recoveredTask, recoveryOptions);
    attempts.push(recoveryExecution);
    sourceTask = recoveryExecution.task;

    if (recoveryExecution.task.status !== "failed") {
      return {
        finalExecution: recoveryExecution,
        attempts,
        recovery: {
          attempted: true,
          succeeded: true,
          attempts: attempt,
          recoveredTaskIds,
          recoveredFromTaskId: firstExecution.task.id,
          usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
          usedRecommendationTargetUrls,
        },
      };
    }
  }

  return {
    finalExecution: attempts.at(-1),
    attempts,
    recovery: {
      attempted: true,
      succeeded: false,
      attempts: maxRecoveryAttempts,
      recoveredTaskIds,
      recoveredFromTaskId: firstExecution.task.id,
      usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
      usedRecommendationTargetUrls,
    },
  };
}

function buildOperatorOptions(task, body = {}) {
  const planActions = task.plan?.steps
    ?.filter((step) => step.phase === "acting_on_target")
    .map((step) => ({ kind: step.kind, params: step.params ?? {} }));
  return {
    ...body,
    targetUrl: body.targetUrl ?? task.targetUrl,
    actions: Array.isArray(body.actions) ? body.actions : planActions,
    operator: "loop-v1",
  };
}

async function runOperatorStep(body = {}) {
  reconcileRuntimeState();
  const ignorePause = body.ignorePause === true;
  const dryRun = body.dryRun === true || body.peek === true;

  if (runtimeState.paused && !ignorePause) {
    return {
      ran: false,
      blocked: true,
      reason: "runtime_paused",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const task = getNextQueuedTask();
  if (!task) {
    return {
      ran: false,
      blocked: false,
      reason: "no_queued_task",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  if (dryRun) {
    return {
      ran: false,
      blocked: false,
      reason: "dry_run",
      dryRun: true,
      task,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const policy = ensureTaskPolicy(task, { stage: "operator.step" });
  await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    return {
      ran: false,
      blocked: true,
      reason: policy.decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const pendingApproval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (pendingApproval?.status === "pending") {
    return {
      ran: false,
      blocked: true,
      reason: "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: task.policy?.decision ?? null,
      approval: serialiseApproval(pendingApproval),
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const executionResult = await executeTaskWithRecovery(task, buildOperatorOptions(task, body));
  const finalExecution = executionResult.finalExecution ?? executionResult;
  if (finalExecution.blocked === true) {
    return {
      ran: false,
      blocked: true,
      reason: finalExecution.reason ?? "policy_requires_approval",
      dryRun: false,
      task: finalExecution.task,
      execution: null,
      policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
      approval: finalExecution.approval ?? finalExecution.task?.approval ?? null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  return {
    ran: true,
    blocked: false,
    reason: null,
    dryRun: false,
    task: executionResult.finalExecution.task,
    execution: executionResult,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

async function runOperatorLoop(body = {}) {
  const maxSteps = Number.isInteger(body.maxSteps) && body.maxSteps > 0 ? Math.min(body.maxSteps, 20) : 5;
  const steps = [];
  let stopReason = null;
  let blocked = false;
  let dryRun = false;
  let nextTask = null;

  for (let index = 0; index < maxSteps; index += 1) {
    const step = await runOperatorStep(body);
    if (!step.ran) {
      stopReason = step.reason ?? null;
      blocked = step.blocked === true;
      dryRun = step.dryRun === true;
      nextTask = step.task ?? null;
      break;
    }
    steps.push(step);
  }

  return {
    ran: steps.length > 0,
    steps,
    blocked,
    reason: stopReason,
    dryRun,
    nextTask,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

  return {
    executeTask,
    executeTaskWithRecovery,
    serialiseExecutionResult,
    listCommandTranscriptRecords,
    buildCommandTranscriptSummary,
    serialiseCommandTranscriptSummary,
    listFilesystemChangeRecords,
    buildFilesystemChangeSummary,
    serialiseFilesystemChangeSummary,
    listFilesystemReadRecords,
    buildFilesystemReadSummary,
    serialiseFilesystemReadSummary,
    buildOperatorState,
    buildOperatorOptions,
    runOperatorStep,
    runOperatorLoop,
  };
}
