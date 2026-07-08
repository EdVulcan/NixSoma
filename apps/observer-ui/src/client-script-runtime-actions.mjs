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

async function createWorkspaceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated workspace command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceCommandPlanDraft();
}

async function createSourceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      query: "command",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated source command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshSourceCommandPlanDraft();
}

async function createNativePluginInvokeApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/invoke-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin invoke task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginInvokePlan();
}

async function createNativePluginRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime activation task \${result.task?.id ?? "unknown"}; runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginActivationPlan();
}

async function createNativePluginRuntimeAdapterApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime adapter task \${result.task?.id ?? "unknown"}; implementation remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginRuntimeAdapterContract();
}

async function createPluginSearchWebApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web adapter task \${result.task?.id ?? "unknown"}; network execution remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebAdapterContract();
}

async function createPluginSearchWebRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web runtime activation task \${result.task?.id ?? "unknown"}; network runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebRuntimeActivationPlan();
}

async function createPluginSearchWebProviderSandboxApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web provider sandbox task \${result.task?.id ?? "unknown"}; provider runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebProviderRuntimeSandbox();
}

async function createSourceAuthoredEditApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-authored-edit-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposalQuery: "edit",
      targetSelectionQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw source-authored edit task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

async function createWorkspaceTextWriteApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-text-write-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-write.txt",
      content: "hello from observer native OpenClaw workspace text write\\n",
      overwrite: true,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace text write task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceTextWriteDraft();
}

async function createWorkspacePatchApplyApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-patch-apply-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-edit.txt",
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposal: {
        title: "Observer sample edit proposal",
        rationale: "Demonstrate proposal envelope metadata for an approval-gated OpenClaw workspace patch.",
        targetContext: { symbol: "observer-sample", fileRole: "workspace scratch fixture" },
      },
      deriveProposalFromSource: true,
      proposalQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace patch apply task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

async function runOperatorStepFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/step\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  renderOperatorPanel(result);
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

async function postWorkView(path, payload = {}) {
  const result = await fetchJson(\`\${observerConfig.sessionManagerUrl}\${path}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (currentTaskState?.id) {
    const phase =
      path === "/work-view/prepare"
        ? "preparing_work_view"
        : path === "/work-view/reveal"
          ? "visible"
          : path === "/work-view/hide"
            ? "backgrounded"
            : null;
    if (phase) {
      await updateTaskPhase(currentTaskState.id, phase, {
        visibility: result.workView?.visibility ?? null,
        mode: result.workView?.mode ?? null,
      });
    }
  }
  setControlMessage(\`Work view \${result.workView?.status ?? "updated"} / \${result.workView?.visibility ?? "unknown"}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function openWorkViewUrl(taskId = null) {
  const entryUrl = getDesiredWorkViewUrl();
  if (taskId) {
    await updateTaskPhase(taskId, "opening_target", {
      targetUrl: entryUrl,
    });
  }
  const prepareResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/prepare\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayTarget: "workspace-2",
      entryUrl,
    }),
  });

  const revealResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/reveal\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryUrl }),
  });

  setControlMessage(\`Opened work view URL: \${revealResult.workView?.activeUrl ?? prepareResult.workView?.activeUrl ?? entryUrl}\`);
  await refreshWorkView();
  await refreshScreen();
  return revealResult;
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

async function runAction(path, payload) {
  const result = await fetchJson(\`\${observerConfig.screenActUrl}\${path}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (currentTaskState?.id) {
    await updateTaskPhase(currentTaskState.id, "acting_on_target", {
      actionKind: result.action?.kind ?? null,
      degraded: result.action?.degraded ?? false,
    });
  }
  setControlMessage(\`Action \${result.action?.kind ?? "unknown"} completed (\${result.action?.result ?? "unknown"})\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshScreen();
  await refreshWorkView();
}

async function runHeal(service) {
  const result = await fetchJson(\`\${observerConfig.systemHealUrl}/heal/restart-service\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ service }),
  });
  setControlMessage(\`Heal completed for \${result.entry?.service ?? service}\`);
  await refreshHealState();
}

async function runMaintenanceTickFromUi() {
  const result = await fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/tick\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      force: true,
      autofix: true,
      mode: "simulated",
    }),
  });
  const runStatus = result.run?.status ?? "no-run";
  setControlMessage(\`Maintenance tick \${result.tick?.status ?? "unknown"}: \${result.tick?.reason ?? "unknown"} / \${runStatus}\`);
  await refreshMaintenanceState();
  await refreshHealState();
  await refreshSystemState();
  await refreshAuditState();
}

async function createSystemdRepairExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Real systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairCandidateTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-candidate-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair candidate task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdRepairCandidateTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Next systemd repair task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} approvalState=pending-after-create mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Next systemd repair real execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerDirectoryTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/directory-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger directory task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} target=\${result.ledgerDirectory?.displayPath ?? "unknown"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerDirectoryTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFirstRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/first-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger first record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.firstRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.firstRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFirstRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFollowupRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/followup-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger follow-up record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.followupRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.followupRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFollowupRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function completeCurrentTask() {
  if (!currentTaskState?.id) {
    throw new Error("No active task to complete.");
  }

  const completedWorkViewUrl = currentTaskState.workView?.activeUrl ?? currentTaskState.targetUrl ?? null;
  const hiddenResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/hide\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
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

createTaskButton.addEventListener("click", () => {
  createDemoTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createPlannedTaskButton.addEventListener("click", () => {
  createPlannedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspaceCommandTaskButton.addEventListener("click", () => {
  createWorkspaceCommandApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

sourceCommandTaskButton.addEventListener("click", () => {
  createSourceCommandApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginInvokeTaskButton.addEventListener("click", () => {
  createNativePluginInvokeApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginActivationTaskButton.addEventListener("click", () => {
  createNativePluginRuntimeActivationApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginRuntimeAdapterTaskButton.addEventListener("click", () => {
  createNativePluginRuntimeAdapterApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebTaskButton.addEventListener("click", () => {
  createPluginSearchWebApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebActivationTaskButton.addEventListener("click", () => {
  createPluginSearchWebRuntimeActivationApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebSandboxTaskButton.addEventListener("click", () => {
  createPluginSearchWebProviderSandboxApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspaceTextWriteTaskButton.addEventListener("click", () => {
  createWorkspaceTextWriteApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspacePatchApplyTaskButton.addEventListener("click", () => {
  createWorkspacePatchApplyApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

sourceAuthoredEditTaskButton.addEventListener("click", () => {
  createSourceAuthoredEditApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

operatorStepButton.addEventListener("click", () => {
  runOperatorStepFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

operatorRunButton.addEventListener("click", () => {
  runOperatorLoopFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

approveLatestButton.addEventListener("click", () => {
  resolveLatestApproval("approve").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

denyLatestButton.addEventListener("click", () => {
  resolveLatestApproval("deny").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeVitalsButton.addEventListener("click", () => {
  invokeCapabilityFromUi("vitals").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeProcessButton.addEventListener("click", () => {
  invokeCapabilityFromUi("process").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeCommandDryRunButton.addEventListener("click", () => {
  invokeCapabilityFromUi("commandDryRun").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeApprovedCommandDryRunButton.addEventListener("click", () => {
  invokeCapabilityFromUi("approvedCommandDryRun").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

prepareWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/prepare", {
    displayTarget: "workspace-2",
    entryUrl: getDesiredWorkViewUrl(),
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

revealWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/reveal", {
    entryUrl: getDesiredWorkViewUrl(),
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

hideWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/hide").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

refreshScreenButton.addEventListener("click", () => {
  refreshScreenNow().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

clickActionButton.addEventListener("click", () => {
  runAction("/act/mouse/click", {
    x: 640,
    y: 360,
    button: "left",
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

typeActionButton.addEventListener("click", () => {
  runAction("/act/keyboard/type", {
    text: "hello from openclaw-screen-act",
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

healBrowserButton.addEventListener("click", () => {
  runHeal("openclaw-browser-runtime").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

runMaintenanceButton.addEventListener("click", () => {
  runMaintenanceTickFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdRepairExecutionTaskButton.addEventListener("click", () => {
  createSystemdRepairExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdRepairRealExecutionTaskButton.addEventListener("click", () => {
  createSystemdRepairRealExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdRepairCandidateTaskShellButton.addEventListener("click", () => {
  createSystemdRepairCandidateTaskShell().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdNextRepairTaskShellButton.addEventListener("click", () => {
  createSystemdNextRepairTaskShell().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdNextRepairRealExecutionButton.addEventListener("click", () => {
  createSystemdNextRepairRealExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerDirectoryTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerDirectoryTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerFirstRecordTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerFirstRecordTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerFollowupRecordTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerFollowupRecordTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

completeTaskButton.addEventListener("click", () => {
  completeCurrentTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pauseButton.addEventListener("click", () => {
  postControl("/control/pause").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

resumeButton.addEventListener("click", () => {
  postControl("/control/resume").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

takeoverButton.addEventListener("click", () => {
  postControl("/control/takeover").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

stopButton.addEventListener("click", () => {
  stopCurrentTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

openWorkViewUrlButton.addEventListener("click", () => {
  openWorkViewUrl().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverLatestTaskButton.addEventListener("click", () => {
  recoverLatestFinishedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverLatestFailedTaskButton.addEventListener("click", () => {
  recoverLatestFailedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadHistoryButton.addEventListener("click", () => {
  taskHistoryFocus = "latest-finished";
  selectedHistoryTaskId = null;
  refreshTaskHistoryDetail().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

followActiveUrlButton.addEventListener("click", () => {
  try {
    followActiveWorkViewUrl();
  } catch (error) {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  }
});

loadSelectedTaskButton.addEventListener("click", () => {
  loadSelectedTaskDetail().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadCurrentTaskButton.addEventListener("click", () => {
  if (!currentTaskState?.id) {
    setControlMessage("Request failed: No active task selected.");
    return;
  }
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = currentTaskState.id;
  taskDetailIdInput.value = currentTaskState.id;
  refreshTaskHistoryDetail().then(() => {
    setControlMessage(\`Viewing current task \${currentTaskState.id}\`);
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadLatestFailedTaskButton.addEventListener("click", () => {
  taskHistoryFocus = "latest-failed";
  refreshTaskHistoryDetail().then(() => {
    setControlMessage("Loaded latest failed task.");
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverSelectedTaskButton.addEventListener("click", () => {
  recoverSelectedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

useDetailUrlButton.addEventListener("click", () => {
  try {
    useSelectedTaskUrl();
  } catch (error) {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  }
});

workViewUrlInput.addEventListener("input", () => {
  desiredWorkViewUrl = workViewUrlInput.value.trim() || "https://example.com/work-view";
  desiredWorkViewUrlPinned = true;
  updateDesiredUrlHint(currentTaskState?.workView?.activeUrl ?? null);
});

taskListItems.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.taskAction;
  const taskId = target.dataset.taskId;
  const taskUrl = target.dataset.taskUrl;

  if (!action || !taskId) {
    return;
  }

  if (action === "inspect") {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    refreshTaskHistoryDetail().then(() => {
      setControlMessage(\`Loaded task history detail for \${taskId}\`);
    }).catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
    return;
  }

  if (action === "use-url") {
    try {
      if (!taskUrl) {
        throw new Error("Selected task does not have a recoverable URL.");
      }
      taskHistoryFocus = "selected-task";
      selectedHistoryTaskId = taskId;
      taskDetailIdInput.value = taskId;
      setDesiredWorkViewUrl(taskUrl);
      setControlMessage(\`Loaded task URL into work view input: \${taskUrl}\`);
    } catch (error) {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    }
    return;
  }

  if (action === "recover") {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    recoverSelectedTask().catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
    return;
  }

  if (target.closest(".task-card")) {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    refreshTaskHistoryDetail().catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
  }
});

`;
