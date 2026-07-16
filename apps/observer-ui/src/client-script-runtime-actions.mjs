import { observerClientRuntimeApprovalTasksScript } from "./client-script-runtime-approval-tasks.mjs";
import { observerClientRuntimeEngineeringLoopControlsScript } from "./client-script-runtime-engineering-loop-controls.mjs";
import { observerClientRuntimeEngineeringLspTargetSelectionScript } from "./client-script-runtime-engineering-lsp-target-selection.mjs";
import { observerClientRuntimeEngineeringSuggestedActionScript } from "./client-script-runtime-engineering-suggested-action.mjs";
import { observerClientRuntimeEngineeringRecommendationScript } from "./client-script-runtime-engineering-recommendation.mjs";
import { observerClientRuntimeSystemBodyTasksScript } from "./client-script-runtime-system-body-tasks.mjs";
import { observerClientRuntimeSystemHealScript } from "./client-script-runtime-system-heal.mjs";
import { observerClientRuntimeWorkViewControlsScript } from "./client-script-runtime-work-view-controls.mjs";
import { observerClientRuntimeBindingsScript } from "./client-script-runtime-bindings.mjs";
import { observerClientNativeRuntimeRefreshTasksScript } from "./client-script-runtime-native-runtime-refresh.mjs";

export const observerClientRuntimeActionsScript = `async function loadRecentEvents() {
  try {
    const data = await fetchJson(\`\${observerConfig.eventHubUrl}/events/recent\`);
    eventsList.innerHTML = "";
    for (const event of [...data.items].reverse()) {
      addEventItem(event);
    }
  } catch {
    eventsList.innerHTML = "<li>Unable to load recent events.</li>";
  }
}

async function createDemoTask() {
  const targetUrl = getDesiredWorkViewUrl();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      goal: \`Open the AI work view at \${targetUrl}\`,
      type: "browser_task",
      targetUrl,
      workViewStrategy: "ai-work-view",
    }),
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Created task \${result.task?.id ?? "unknown"} for \${targetUrl}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function createPlannedTask() {
  const targetUrl = getDesiredWorkViewUrl();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/plan\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      goal: \`Plan an AI work view run for \${targetUrl}\`,
      type: "browser_task",
      targetUrl,
      workViewStrategy: "ai-work-view",
      actions: [
        { kind: "keyboard.type", params: { text: "hello from openclaw-operator" } },
        { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
      ],
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task ?? { plan: result.plan });
  setControlMessage(\`Planned task \${result.task?.id ?? "unknown"} for \${targetUrl}. Use Operator Step or Run to execute it.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

${observerClientRuntimeApprovalTasksScript}${observerClientRuntimeEngineeringLoopControlsScript}${observerClientRuntimeEngineeringLspTargetSelectionScript}${observerClientRuntimeEngineeringSuggestedActionScript}${observerClientRuntimeEngineeringRecommendationScript}${observerClientNativeRuntimeRefreshTasksScript}${observerClientRuntimeSystemHealScript}${observerClientRuntimeWorkViewControlsScript}async function runOperatorStepFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/step\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  renderOperatorPanel(result);
  renderEngineeringRecommendationFromOperatorResult(result);
  taskHistoryFocus = result.task?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = result.task?.id ?? selectedHistoryTaskId;
  if (result.task?.id) {
    taskDetailIdInput.value = result.task.id;
  }
  setControlMessage(result.ran
    ? \`Operator completed task \${result.task?.id ?? "unknown"}.\`
    : "Operator step found no queued task.");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
  await refreshOperatorState();
  await refreshPolicyState();
  await refreshCapabilityHistory();
  await refreshCommandLedger();
}

async function runOperatorLoopFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/run\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxSteps: 5 }),
  });

  renderOperatorPanel(result);
  renderEngineeringRecommendationFromOperatorResult(result);
  const lastTask = [...(result.steps ?? [])].reverse().find((step) => step.task?.id)?.task ?? null;
  taskHistoryFocus = lastTask?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = lastTask?.id ?? selectedHistoryTaskId;
  if (lastTask?.id) {
    taskDetailIdInput.value = lastTask.id;
  }
  setControlMessage(result.ran
    ? \`Operator run completed \${result.count ?? result.steps?.length ?? 0} task(s).\`
    : "Operator run found no queued tasks.");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
  await refreshOperatorState();
  await refreshPolicyState();
  await refreshCapabilityHistory();
  await refreshCommandLedger();
}

async function launchTaskIntoWorkView(taskId, targetUrl) {
  if (!taskId || !targetUrl) {
    return;
  }

  await updateTaskPhase(taskId, "preparing_work_view", {
    targetUrl,
    displayTarget: "workspace-2",
  });
  const workViewResult = await openWorkViewUrl(taskId, targetUrl);
  await attachTaskToWorkView(taskId, workViewResult);
}

async function recoverLatestFinishedTask() {
  const latest = await fetchJson(\`\${observerConfig.coreUrl}/tasks/latest-finished\`);
  const sourceTask = latest.task ?? null;
  if (!sourceTask?.id) {
    throw new Error("No finished task available to recover.");
  }

  const targetUrl = sourceTask.targetUrl ?? sourceTask.workView?.activeUrl ?? null;
  if (targetUrl) {
    setDesiredWorkViewUrl(targetUrl);
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTask.id}/recover\`, {
    method: "POST",
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Recovered task \${result.task?.id ?? "unknown"} from \${sourceTask.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function recoverSelectedTask() {
  const sourceTaskId = getSelectedHistoryTaskId();
  if (!sourceTaskId) {
    throw new Error("Enter or load a task ID first.");
  }

  const taskResponse = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTaskId}\`);
  const sourceTask = taskResponse.task ?? null;
  if (!sourceTask?.id) {
    throw new Error("Selected task could not be loaded.");
  }

  if (!sourceTask.restorable) {
    throw new Error("Selected task is not recoverable.");
  }

  const targetUrl = sourceTask.targetUrl ?? sourceTask.workView?.activeUrl ?? null;
  if (targetUrl) {
    setDesiredWorkViewUrl(targetUrl);
  }
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTask.id}/recover\`, {
    method: "POST",
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Recovered task \${result.task?.id ?? "unknown"} from selected task \${sourceTask.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function loadSelectedTaskDetail() {
  selectedHistoryTaskId = getSelectedHistoryTaskId();
  if (!selectedHistoryTaskId) {
    throw new Error("Enter a task ID first.");
  }

  taskHistoryFocus = "selected-task";
  await refreshTaskHistoryDetail();
  setControlMessage(\`Loaded task history detail for \${selectedHistoryTaskId}\`);
}

function useSelectedTaskUrl() {
  const selectedTask = latestHistoryTask ?? null;
  const taskUrl = selectedTask?.targetUrl ?? selectedTask?.workView?.activeUrl ?? null;
  if (!taskUrl) {
    throw new Error("Selected task does not have a recoverable URL.");
  }

  setDesiredWorkViewUrl(taskUrl);
  setControlMessage(\`Loaded task URL into work view input: \${taskUrl}\`);
}

async function recoverLatestFailedTask() {
  const latest = await fetchJson(\`\${observerConfig.coreUrl}/tasks/latest-failed\`);
  const failedTask = latest.task ?? recentTasksState.find((task) => task.status === "failed" && task.restorable) ?? null;
  if (!failedTask?.id) {
    throw new Error("No failed task available to recover.");
  }

  taskHistoryFocus = "latest-failed";
  selectedHistoryTaskId = failedTask.id;
  taskDetailIdInput.value = failedTask.id;
  await refreshTaskHistoryDetail();
  await recoverSelectedTask();
}

function renderTaskCard(task) {
  const selectedClass = selectedHistoryTaskId === task.id ? " selected" : "";
  const activeClass = task.id === currentTaskState?.id ? " active" : "";
  const taskUrl = task.targetUrl ?? task.workView?.activeUrl ?? "";
  const escapedUrl = escapeHtml(taskUrl);
  const statusClass = task.status === "failed" ? "status-pill warn" : "status-pill";
  const relationLabel = describeTaskRelationship(task);
  return \`<article class="task-card\${selectedClass}\${activeClass}" data-task-id="\${task.id}">
    <div class="task-card-top">
      <h3>\${escapeHtml(task.goal)}</h3>
      <div class="task-status-group">
        <span class="\${statusClass}">\${escapeHtml(task.status)}</span>
        \${task.isCurrentTask ? '<span class="status-pill">current</span>' : ""}
        \${task.restorable ? '<span class="status-pill">recoverable</span>' : ""}
      </div>
    </div>
    <pre>\${escapeHtml(renderTaskSummary(task))}</pre>
    <div class="hint">\${escapeHtml(relationLabel)}</div>
    <div class="task-card-actions">
      <button class="secondary" data-task-action="inspect" data-task-id="\${task.id}">Inspect</button>
      <button class="secondary" data-task-action="use-url" data-task-id="\${task.id}" data-task-url="\${escapedUrl}" \${taskUrl ? "" : "disabled"}>Use URL</button>
      <button class="secondary" data-task-action="recover" data-task-id="\${task.id}" \${task.restorable ? "" : "disabled"}>Recover</button>
    </div>
  </article>\`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function createTrustedSidecarLifecycleTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/work-view/trusted-sidecar/lifecycle-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created trusted work-view sidecar lifecycle task \${result.task?.id ?? "unknown"}; approval is required before bounded process start.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkView();
}

async function startTrustedSidecarLifecycleProbe() {
  const controls = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/operator-interrupt-controls\`);
  const taskId = controls.sidecarLifecycle?.taskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Create or load a trusted sidecar lifecycle task first.");
  }

  const response = await fetch(\`\${observerConfig.coreUrl}/work-view/trusted-sidecar/lifecycle-tasks/\${encodeURIComponent(taskId)}/start-probe\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : { ok: false, error: await response.text() };
  if (!response.ok && response.status !== 409) {
    throw new Error(result?.error ?? \`Request failed with status \${response.status}\`);
  }

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? taskId;
  taskDetailIdInput.value = result.task?.id ?? taskId;
  renderPlanPanel(result.task ?? latestHistoryTask);
  setControlMessage(\`Trusted sidecar probe \${result.readback?.status ?? "unknown"} for \${taskId}; processStarted=\${String(Boolean(result.readback?.execution?.processStarted))}\`);
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPhase3OperatorInterruptControls();
  await refreshWorkView();
}

async function stopTrustedSidecarLifecycle() {
  const controls = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/operator-interrupt-controls\`);
  const taskId = controls.sidecarLifecycle?.taskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Create or load a trusted sidecar lifecycle task first.");
  }
  const result = await fetchJson(\`\${observerConfig.coreUrl}/work-view/trusted-sidecar/lifecycle-tasks/\${encodeURIComponent(taskId)}/stop\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? taskId;
  taskDetailIdInput.value = result.task?.id ?? taskId;
  renderPlanPanel(result.task ?? latestHistoryTask);
  setControlMessage(\`Trusted sidecar \${result.readback?.status ?? "stopped"} for \${taskId}.\`);
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
  await refreshPhase3OperatorInterruptControls();
  await refreshWorkView();
}

async function openWorkViewUrl(taskId = null) {
  const entryUrl = getDesiredWorkViewUrl();
  if (taskId) {
    await updateTaskPhase(taskId, "opening_target", {
      targetUrl: entryUrl,
    });
  }
  await postWorkView("/work-view/prepare", {
    displayTarget: "workspace-2",
    entryUrl,
  }, { refresh: false });
  const revealResult = await postWorkView("/work-view/reveal", { entryUrl }, { refresh: false });
  const stateResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
  const workView = stateResult.workView ?? null;
  const enrichedRevealResult = { ...revealResult, workView };
  setControlMessage(\`Opened work view URL: \${workView?.activeUrl ?? entryUrl}\`);
  await refreshWorkView();
  await refreshScreen();
  return enrichedRevealResult;
}

async function updateTaskPhase(taskId, phase, details = null) {
  if (!taskId || !phase) {
    return null;
  }

  return fetchJson(\`\${observerConfig.coreUrl}/tasks/\${taskId}/phase\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phase,
      status: "running",
      details,
    }),
  });
}

async function attachTaskToWorkView(taskId, workViewResult) {
  if (!taskId || !workViewResult?.workView) {
    return;
  }

  const activeUrl =
    workViewResult.workView?.activeUrl
    ?? workViewResult.browser?.activeUrl
    ?? workViewResult.tab?.url
    ?? currentTaskState?.targetUrl
    ?? getDesiredWorkViewUrl();

  await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${taskId}/attach-work-view\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workViewId: workViewResult.workView?.workViewId ?? null,
      sessionId: workViewResult.session?.sessionId ?? null,
      status: workViewResult.workView?.status ?? "ready",
      visibility: workViewResult.workView?.visibility ?? "visible",
      mode: workViewResult.workView?.mode ?? "foreground-observable",
      helperStatus: workViewResult.workView?.helperStatus ?? "active",
      displayTarget: workViewResult.workView?.displayTarget ?? "workspace-2",
      activeUrl,
    }),
  });
}

async function postControl(path) {
  const result = await fetchJson(\`\${observerConfig.coreUrl}\${path}\`, {
    method: "POST",
  });
  setControlMessage(\`Control request completed: \${path}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

async function refreshScreenNow() {
  const result = await fetchJson(\`\${observerConfig.screenSenseUrl}/screen/refresh\`, {
    method: "POST",
  });
  setControlMessage(\`Screen refreshed: \${result.screen?.readiness ?? "unknown"}\`);
  await refreshScreen();
}

async function runBrowserOpenCapability(url) {
  const result = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.browser.open",
      operation: "browser.new_tab",
      params: { url },
    }),
  });
  const action = result.result?.action ?? {};
  if (currentTaskState?.id) {
    await updateTaskPhase(currentTaskState.id, "acting_on_target", {
      actionKind: action.kind ?? "browser.new_tab",
      degraded: action.degraded === true,
    });
  }
  setControlMessage("Capability browser.new_tab completed (" + (action.result ?? "unknown") + ")");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshScreen();
  await refreshWorkView();
}

async function runMouseClickCapability(x, y) {
  const result = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.screen.pointer_keyboard",
      operation: "mouse.click",
      params: { x, y, button: "left" },
    }),
  });
  const action = result.result?.action ?? {};
  if (currentTaskState?.id) {
    await updateTaskPhase(currentTaskState.id, "acting_on_target", {
      actionKind: action.kind ?? "mouse.click",
      degraded: action.degraded === true,
    });
  }
  setControlMessage("Capability mouse.click completed (" + (action.result ?? "unknown") + ")");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshScreen();
  await refreshWorkView();
}

async function runKeyboardTypeCapability(text) {
  const result = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.screen.pointer_keyboard",
      operation: "keyboard.type",
      params: { text },
    }),
  });
  const action = result.result?.action ?? {};
  if (currentTaskState?.id) {
    await updateTaskPhase(currentTaskState.id, "acting_on_target", {
      actionKind: action.kind ?? "keyboard.type",
      degraded: action.degraded === true,
    });
  }
  setControlMessage("Capability keyboard.type completed (" + (action.result ?? "unknown") + ")");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshScreen();
  await refreshWorkView();
}

${observerClientRuntimeSystemBodyTasksScript}async function completeCurrentTask() {
  if (!currentTaskState?.id) {
    throw new Error("No active task to complete.");
  }

  const completedWorkViewUrl = currentTaskState.workView?.activeUrl ?? currentTaskState.targetUrl ?? null;
  const hiddenResult = await postWorkView("/work-view/hide", {}, { refresh: false });
  const hiddenState = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
  const hiddenWorkView = hiddenState.workView ?? hiddenResult.workView ?? null;

  if (!hiddenWorkView || hiddenWorkView.visibility !== "hidden") {
    throw new Error("Work view did not transition to hidden state.");
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${currentTaskState.id}/complete\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      details: {
        targetUrl: currentTaskState.targetUrl ?? null,
        workViewUrl: completedWorkViewUrl,
        summary: completedWorkViewUrl
          ? \`Completed task at \${completedWorkViewUrl}\`
          : "Completed task.",
        workView: hiddenWorkView
          ? {
            status: hiddenWorkView.status ?? null,
            visibility: hiddenWorkView.visibility ?? null,
            mode: hiddenWorkView.mode ?? null,
            helperStatus: hiddenWorkView.helperStatus ?? null,
            browserStatus: hiddenWorkView.browserStatus ?? null,
            entryUrl: hiddenWorkView.entryUrl ?? completedWorkViewUrl,
            displayTarget: hiddenWorkView.displayTarget ?? null,
            activeUrl: hiddenWorkView.activeUrl ?? completedWorkViewUrl,
          }
          : null,
      },
    }),
  });

  taskHistoryFocus = "latest-finished";
  selectedHistoryTaskId = result.task?.id ?? currentTaskState.id;
  taskDetailIdInput.value = selectedHistoryTaskId ?? "";
  setControlMessage(\`Completed task \${result.task?.id ?? currentTaskState.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
}

async function stopCurrentTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/control/stop\`, {
    method: "POST",
  });
  taskHistoryFocus = "latest-failed";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Stopped task \${result.task?.id ?? "unknown"}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
}

function subscribeEvents() {
  const stream = new EventSource(\`\${observerConfig.eventHubUrl}/events/stream\`);
  stream.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      addEventItem(event);
    } catch (error) {
      console.error("Unable to parse event stream payload", error);
    }
  };

  for (const eventName of [
    "task.created",
    "task.planned",
    "task.phase_changed",
    "task.running",
    "task.completed",
    "task.recovered",
    "task.paused",
    "task.resumed",
    "task.failed",
    "policy.evaluated",
    "approval.created",
    "approval.approved",
    "approval.denied",
    "capability.updated",
    "capability.invoked",
    "capability.blocked",
    "system.command.executed",
    "service.started",
    "browser.started",
    "browser.updated",
    "screen.updated",
    "action.completed",
    "system.updated",
    "service.failed",
    "heal.diagnosed",
    "heal.started",
    "heal.completed",
    "systemd.repair.execution_completed",
    "systemd.repair.execution_failed",
    "systemd.next_repair.execution_completed",
    "systemd.next_repair.execution_failed",
    "maintenance.policy.updated",
    "maintenance.tick",
    "maintenance.started",
    "maintenance.completed",
  ]) {
    stream.addEventListener(eventName, async (message) => {
      try {
        addEventItem(JSON.parse(message.data));
        await refreshRuntime();
        await refreshTaskList();
        await refreshTaskHistoryDetail();
        await refreshWorkView();
        if (eventName === "policy.evaluated") {
          await refreshPolicyState();
        }
        if (eventName === "approval.created" || eventName === "approval.approved" || eventName === "approval.denied") {
          await refreshApprovalState();
        }
        if (
          eventName === "capability.updated"
          || eventName === "capability.invoked"
          || eventName === "capability.blocked"
          || eventName === "service.started"
          || eventName === "service.failed"
        ) {
          await refreshCapabilityState();
        }
        if (eventName === "capability.invoked" || eventName === "capability.blocked") {
          await refreshCapabilityHistory();
        }
        if (eventName === "system.command.executed" || eventName === "task.completed" || eventName === "task.failed") {
          await refreshCommandLedger();
        }
        if (
          eventName === "screen.updated"
          || eventName === "service.started"
          || eventName === "browser.started"
          || eventName === "browser.updated"
          || eventName === "action.completed"
        ) {
          await refreshScreen();
        }
        if (eventName === "action.completed" || eventName === "service.started") {
          await refreshActionState();
        }
        if (eventName === "system.updated" || eventName === "service.failed" || eventName === "service.started") {
          await refreshSystemState();
        }
        if (eventName === "heal.diagnosed" || eventName === "heal.started" || eventName === "heal.completed" || eventName === "service.started") {
          await refreshHealState();
        }
        if (
          eventName === "maintenance.policy.updated"
          || eventName === "maintenance.tick"
          || eventName === "maintenance.started"
          || eventName === "maintenance.completed"
          || eventName === "service.started"
        ) {
          await refreshMaintenanceState();
        }
        await refreshAuditState();
      } catch (error) {
        console.error("Unable to process named event", error);
      }
    });
  }
}

${observerClientRuntimeBindingsScript}`;
