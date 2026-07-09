import { observerClientBodyEvidenceRefreshersScript } from "./client-script-refreshers-body-evidence.mjs";
import { observerClientSystemdRefreshersScript } from "./client-script-refreshers-systemd.mjs";
export const observerClientRuntimeRefreshersScript = `async function refreshRuntime() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/state/runtime\`);
    const currentTask = data.currentTask ?? null;
    currentTaskState = currentTask;
    runtimeStatus.textContent = data.runtime.status;
    runtimeTask.textContent = currentTask ? currentTask.goal : "none";
    runtimePaused.textContent = String(data.runtime.paused);
    runtimeCount.textContent = String(data.taskCount);
    runtimeUpdated.textContent = data.runtime.lastUpdatedAt;
    const taskLastAction = deriveTaskLastAction(currentTask);
    taskJson.textContent = currentTask
      ? renderTaskSummary(currentTask, { includeRecovery: false, includeOutcome: false })
      : "No active task.";
    renderPlanPanel(currentTask ?? latestHistoryTask);
    renderCommandTranscriptFromTask(currentTask ?? latestHistoryTask, { source: currentTask ? "current-task" : "latest-history" });
  } catch {
    currentTaskState = null;
    runtimeStatus.textContent = "offline";
    taskJson.textContent = "Unable to read runtime state.";
    renderPlanPanel(latestHistoryTask);
    renderCommandTranscriptFromTask(latestHistoryTask, { source: "latest-history" });
  }
}

async function refreshTaskList() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks?limit=8\`);
    const items = data.items ?? [];
    latestTaskSummary = data.summary ?? null;
    recentTasksState = items;
    const activeTasks = items.filter((task) => task.isActive);
    const historyTasks = items.filter((task) => !task.isActive);
    const summaryCounts = data.summary?.counts ?? {};
    const activeCount = summaryCounts.active ?? activeTasks.length;
    taskListCount.textContent = \`\${items.length} visible / \${activeCount} active\`;
    taskActiveCount.textContent = String(summaryCounts.active ?? activeTasks.length);
    taskRecoverableCount.textContent = String(summaryCounts.recoverable ?? items.filter((task) => task.restorable).length);
    taskFailedCount.textContent = String(summaryCounts.failed ?? items.filter((task) => task.status === "failed").length);
    taskCompletedCount.textContent = String(summaryCounts.completed ?? items.filter((task) => task.status === "completed").length);
    taskSupersededCount.textContent = String(summaryCounts.superseded ?? items.filter((task) => task.status === "superseded").length);
    taskQueuedCount.textContent = String(summaryCounts.queued ?? items.filter((task) => task.status === "queued").length);
    latestHistoryTask = items.find((task) => task.status !== "running" && task.status !== "queued" && task.status !== "paused")
      ?? items[0]
      ?? null;
    if (!selectedHistoryTaskId && latestHistoryTask?.id) {
      taskDetailIdInput.value = latestHistoryTask.id;
    }
    taskListItems.innerHTML = items.length > 0
      ? [
          renderTaskSection("Active Tasks", activeTasks),
          renderTaskSection("Task History", historyTasks),
        ].filter(Boolean).join("")
      : "<pre>No tasks recorded yet.</pre>";
  } catch {
    recentTasksState = [];
    latestHistoryTask = null;
    latestTaskSummary = null;
    taskListCount.textContent = "0";
    taskActiveCount.textContent = "0";
    taskRecoverableCount.textContent = "0";
    taskFailedCount.textContent = "0";
    taskCompletedCount.textContent = "0";
    taskSupersededCount.textContent = "0";
    taskQueuedCount.textContent = "0";
    taskListItems.innerHTML = "<pre>Unable to read recent tasks.</pre>";
  }
}

async function refreshTaskHistoryDetail() {
  try {
    const explicitTaskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
    let historyTask = null;

    if (taskHistoryFocus === "current-task") {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/current\`);
      historyTask = data.task ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    } else if (taskHistoryFocus === "latest-failed") {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/latest-failed\`);
      historyTask = data.task ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    } else if (taskHistoryFocus === "selected-task" || explicitTaskId) {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${explicitTaskId}\`);
      historyTask = data.task ?? latestHistoryTask ?? null;
    } else {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/latest-finished\`);
      historyTask = data.task ?? latestHistoryTask ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    }

    latestHistoryTask = historyTask;
    selectedHistoryTaskId = taskHistoryFocus === "selected-task" || taskHistoryFocus === "latest-failed"
      ? historyTask?.id ?? explicitTaskId ?? null
      : historyTask?.id ?? selectedHistoryTaskId ?? explicitTaskId ?? null;
    if (historyTask?.id && taskHistoryFocus !== "current-task") {
      taskDetailIdInput.value = historyTask.id;
    }
    taskHistoryMeta.textContent = formatTaskFocusLabel(taskHistoryFocus, historyTask);
    taskHistoryJson.textContent = historyTask
      ? renderTaskSummary(historyTask)
      : taskHistoryFocus === "latest-failed"
        ? "No failed task recorded yet."
        : taskHistoryFocus === "current-task"
          ? "No active task selected."
          : "No finished task recorded yet.";
    renderPlanPanel(currentTaskState ?? historyTask);
    renderCommandTranscriptFromTask(historyTask ?? currentTaskState, { source: taskHistoryFocus });
  } catch {
    taskHistoryMeta.textContent = formatTaskFocusLabel(taskHistoryFocus, latestHistoryTask);
    taskHistoryJson.textContent = latestHistoryTask
      ? renderTaskSummary(latestHistoryTask)
      : "Unable to read task history detail.";
    renderPlanPanel(currentTaskState ?? latestHistoryTask);
    renderCommandTranscriptFromTask(latestHistoryTask ?? currentTaskState, { source: "latest-history" });
  }
}

async function refreshWorkView() {
  try {
    const data = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
    const workView = data.workView ?? {};
    latestWorkViewState = workView;
    workViewStatus.textContent = workView.status ?? "unknown";
    workViewVisibility.textContent = workView.visibility ?? "unknown";
    workViewMode.textContent = workView.mode ?? "unknown";
    workViewHelper.textContent = workView.helperStatus ?? "unknown";
    workViewCapture.textContent = workView.captureStrategy ?? "unknown";
    const trustedSession = workView.trustedSession ?? data.trustedSession ?? {};
    if (!desiredWorkViewUrlPinned && document.activeElement !== workViewUrlInput) {
      setDesiredWorkViewUrl(workView.activeUrl ?? workView.entryUrl ?? "https://example.com/work-view", {
        pinned: false,
      });
    }
    updateDesiredUrlHint(workView.activeUrl ?? workView.entryUrl ?? null);
    workViewJson.textContent = [
      \`Session: \${data.session?.status ?? "unknown"}\`,
      \`Session ID: \${data.session?.sessionId ?? "none"}\`,
      \`Display: \${workView.displayTarget ?? "unknown"}\`,
      \`Browser: \${workView.browserStatus ?? "unknown"}\`,
      \`Trusted Session: \${trustedSession.identityLevel ?? "unknown"} readiness=\${trustedSession.readiness ?? "unknown"}\`,
      \`Trusted Boundary: \${trustedSession.boundary?.workViewScope ?? "unknown"} root=\${String(Boolean(trustedSession.boundary?.rootRequired))} desktopWide=\${String(Boolean(trustedSession.boundary?.desktopWideCapture))}\`,
      \`Helper Readiness: \${trustedSession.helperReadiness?.state ?? "unknown"} reason=\${trustedSession.helperReadiness?.reason ?? "unknown"}\`,
      \`Recovery Recommendation: \${trustedSession.recoveryRecommendation?.action ?? "unknown"} endpoint=\${trustedSession.recoveryRecommendation?.endpoint ?? "none"}\`,
      \`Last Operator Action: \${workView.lastOperatorAction?.action ?? "none"} source=\${workView.lastOperatorAction?.source ?? "none"}\`,
      \`Sidecar Contract: \${trustedSession.sidecarContract?.status ?? "unknown"} processStarted=\${String(Boolean(trustedSession.sidecarContract?.lifecycle?.processStarted))} root=\${String(Boolean(trustedSession.sidecarContract?.lifecycle?.rootRequired))}\`,
      \`Sidecar Lifecycle: \${trustedSession.sidecarContract?.lifecycleProposal?.status ?? "unknown"} execution=\${trustedSession.sidecarContract?.lifecycleProposal?.executionStatus ?? "unknown"} approval=\${trustedSession.sidecarContract?.lifecycleProposal?.approvalGate ?? "unknown"}\`,
      \`Sidecar Approval Draft: \${trustedSession.sidecarContract?.approvalTaskDraft?.status ?? "unknown"} createsTask=\${String(Boolean(trustedSession.sidecarContract?.approvalTaskDraft?.createsTaskNow))} processStart=\${String(Boolean(trustedSession.sidecarContract?.approvalTaskDraft?.processStartEnabled))}\`,
      \`Reveal Gate: \${trustedSession.operatorGates?.reveal ?? "unknown"}\`,
      \`Entry URL: \${workView.entryUrl ?? "none"}\`,
      \`Active URL: \${workView.activeUrl ?? "none"}\`,
      \`Prepared: \${formatTimestamp(workView.preparedAt)}\`,
      \`Revealed: \${formatTimestamp(workView.lastRevealedAt)}\`,
      \`Hidden: \${formatTimestamp(workView.lastHiddenAt)}\`,
      \`Updated: \${formatTimestamp(workView.updatedAt)}\`,
    ].join("\\n");
  } catch {
    latestWorkViewState = null;
    workViewStatus.textContent = "offline";
    workViewVisibility.textContent = "offline";
    workViewMode.textContent = "offline";
    workViewHelper.textContent = "offline";
    workViewCapture.textContent = "offline";
    workViewJson.textContent = "Unable to read work view state.";
    updateDesiredUrlHint(null);
  }
}

async function refreshScreen() {
  try {
    const data = await fetchJson(\`\${observerConfig.screenSenseUrl}/screen/current\`);
    const screen = data.screen;
    screenWindow.textContent = screen.focusedWindow?.title ?? "none";
    screenSession.textContent = screen.sessionId ?? "none";
    screenReadiness.textContent = screen.readiness ?? "unknown";
    screenCaptureSource.textContent = screen.captureSource ?? "unknown";
    screenCaptureStrategy.textContent = screen.captureStrategy ?? "unknown";
    screenWorkViewUrl.textContent = screen.workView?.activeUrl ?? screen.captureMetadata?.activeUrl ?? "none";
    const workViewSummary = screen.workViewSummary ?? screen.workView?.summary ?? null;
    const trustedSession = screen.trustedSession ?? screen.workView?.trustedSession ?? screen.captureMetadata?.trustedSession ?? {};
    screenWorkViewSummary.textContent = workViewSummary
      ? [
          "Summary: " + (workViewSummary.summaryText ?? "none"),
          "Title: " + (workViewSummary.title ?? "none"),
          "URL: " + (workViewSummary.url ?? "none"),
          "Trusted Session: " + (trustedSession.identityLevel ?? "unknown") + " readiness=" + (trustedSession.readiness ?? "unknown"),
          "Trusted Boundary: " + (trustedSession.boundary?.workViewScope ?? "unknown"),
          "Helper Readiness: " + (trustedSession.helperReadiness?.state ?? "unknown"),
          "Recovery Recommendation: " + (trustedSession.recoveryRecommendation?.action ?? "unknown"),
          "Sidecar Contract: " + (trustedSession.sidecarContract?.status ?? "unknown"),
          "Sidecar Lifecycle: " + (trustedSession.sidecarContract?.lifecycleProposal?.status ?? "unknown"),
          "Sidecar Approval Draft: " + (trustedSession.sidecarContract?.approvalTaskDraft?.status ?? "unknown"),
          "Visible Text: " + ((workViewSummary.visibleTextBlocks ?? []).join(" | ") || "none"),
          "Recent Input: " + (workViewSummary.recentInteraction?.input ?? "none"),
        ].join("\\n")
      : "No work view summary yet.";
    screenSummary.textContent = screen.summary;
    screenSnapshot.textContent = screen.snapshotText ?? "No snapshot text.";
  } catch {
    screenWindow.textContent = "offline";
    screenSession.textContent = "unknown";
    screenReadiness.textContent = "degraded";
    screenCaptureSource.textContent = "unavailable";
    screenCaptureStrategy.textContent = "unavailable";
    screenWorkViewUrl.textContent = "none";
    screenWorkViewSummary.textContent = "No work view summary available.";
    screenSummary.textContent = "Unable to read screen state.";
    screenSnapshot.textContent = "No screen preview available.";
  }
}

async function refreshActionState() {
  try {
    const data = await fetchJson(\`\${observerConfig.screenActUrl}/act/state\`);
    const state = data.state;
    latestActionState = state;
    actionKind.textContent = state.lastAction?.kind ?? "none";
    actionCount.textContent = String(state.actionCount ?? 0);
    actionDegraded.textContent = String(state.lastAction?.degraded ?? false);
    actionJson.textContent = state.lastAction
      ? [
          \`Result: \${state.lastAction.result}\`,
          \`Executed: \${formatTimestamp(state.lastAction.executedAt)}\`,
          \`Window: \${state.lastAction.screenContext?.focusedWindow?.title ?? "none"}\`,
          \`Session: \${state.lastAction.screenContext?.sessionId ?? "none"}\`,
        ].join("\\n")
      : "No action executed yet.";
  } catch {
    latestActionState = null;
    actionKind.textContent = "offline";
    actionCount.textContent = "0";
    actionDegraded.textContent = "unknown";
    actionJson.textContent = "Unable to read action state.";
  }
}

async function refreshSystemState() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/health\`);
    const system = data.system;
    const onlineCount = Object.values(system.services).filter((service) => service.ok).length;
    systemServicesOnline.textContent = String(onlineCount);
    systemAlertCount.textContent = String(system.alerts.length);
    systemBodyUptime.textContent = \`\${system.body?.uptimeSeconds ?? 0}s\`;
    systemSummary.textContent = [
      \`Host: \${system.body?.hostname ?? "unknown"} (\${system.body?.platform ?? "unknown"} \${system.body?.arch ?? "unknown"})\`,
      \`Node: \${system.body?.node ?? "unknown"} PID: \${system.body?.pid ?? "unknown"}\`,
      \`CPU: \${system.resources?.cpuPercent ?? 0}%\`,
      \`Load: \${(system.resources?.loadAverage ?? []).join(", ") || "n/a"}\`,
      \`Memory: \${system.resources?.memoryPercent ?? 0}%\`,
      \`Disk: \${system.resources?.diskPercent ?? 0}%\`,
      \`Network: \${system.network?.online ? "online" : "offline"} (\${system.network?.checkedTargets ?? 0} targets)\`,
      \`Alerts: \${system.alerts?.length ?? 0}\`,
    ].join("\\n");
  } catch {
    systemServicesOnline.textContent = "0";
    systemAlertCount.textContent = "0";
    systemBodyUptime.textContent = "0s";
    systemSummary.textContent = "Unable to read system state.";
  }
}

${observerClientBodyEvidenceRefreshersScript}${observerClientSystemdRefreshersScript}async function refreshHealState() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemHealUrl}/heal/history\`);
    healCount.textContent = String(data.count ?? 0);
    const latest = data.items?.[0] ?? null;
    healSummary.textContent = latest
      ? [
          \`Action: \${latest.action}\`,
          \`Service: \${latest.service}\`,
          \`Status: \${latest.status}\`,
          \`Completed: \${formatTimestamp(latest.completedAt)}\`,
        ].join("\\n")
      : "No heal actions yet.";
  } catch {
    healCount.textContent = "0";
    healSummary.textContent = "Unable to read heal history.";
  }
}

async function refreshMaintenanceState() {
  try {
    const [state, history] = await Promise.all([
      fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/state\`),
      fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/history?limit=5\`),
    ]);
    const policy = state.policy ?? {};
    const latestRun = state.latestRun ?? history.latestRun ?? history.items?.[0] ?? null;
    const lastTick = policy.lastTick ?? null;
    const intervalMs = Number.isFinite(policy.intervalMs) ? policy.intervalMs : 0;
    const intervalMinutes = Math.round(intervalMs / 60000);

    maintenancePolicyEnabled.textContent = policy.enabled ? "enabled" : "disabled";
    maintenanceNextDue.textContent = formatTimestamp(policy.nextDueAt);
    maintenanceLastTick.textContent = lastTick
      ? \`\${lastTick.status ?? "unknown"} (\${lastTick.reason ?? "unknown"})\`
      : "none";
    maintenanceRunCount.textContent = String(state.runCount ?? history.count ?? 0);
    maintenanceSummary.textContent = [
      \`Interval: \${intervalMinutes > 0 ? \`\${intervalMinutes}m\` : \`\${intervalMs}ms\`}\`,
      \`Autofix: \${policy.autofix === false ? "false" : "true"}\`,
      \`Last Checked: \${formatTimestamp(policy.lastCheckedAt)}\`,
      \`Latest Run: \${latestRun?.status ?? "none"}\`,
      latestRun ? \`Run Completed: \${formatTimestamp(latestRun.completedAt)}\` : "Run Completed: -",
      latestRun?.autonomy ? \`Governance: \${latestRun.autonomy.governance ?? "unknown"}\` : "Governance: -",
    ].join("\\n");
  } catch {
    maintenancePolicyEnabled.textContent = "unknown";
    maintenanceNextDue.textContent = "-";
    maintenanceLastTick.textContent = "unknown";
    maintenanceRunCount.textContent = "0";
    maintenanceSummary.textContent = "Unable to read maintenance state.";
  }
}

async function refreshAuditState() {
  try {
    const summary = await fetchJson(\`\${observerConfig.eventHubUrl}/events/audit/summary\`);
    const audit = summary.audit ?? {};
    const byType = audit.byType ?? {};
    const bySource = audit.bySource ?? {};
    const topTypes = Object.entries(byType)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([type, count]) => \`\${type}: \${count}\`);

    auditTotal.textContent = String(audit.total ?? 0);
    auditTypeCount.textContent = String(Object.keys(byType).length);
    auditSourceCount.textContent = String(Object.keys(bySource).length);
    auditSummary.textContent = [
      \`Log: \${audit.logFile ?? "unknown"}\`,
      \`Earliest: \${formatTimestamp(audit.earliestTimestamp)}\`,
      \`Latest: \${formatTimestamp(audit.latestTimestamp)}\`,
      \`Malformed Lines: \${audit.malformed ?? 0}\`,
      topTypes.length ? \`Top Types: \${topTypes.join(", ")}\` : "Top Types: none",
    ].join("\\n");
  } catch {
    auditTotal.textContent = "0";
    auditTypeCount.textContent = "0";
    auditSourceCount.textContent = "0";
    auditSummary.textContent = "Unable to read audit ledger.";
  }
}

`;
