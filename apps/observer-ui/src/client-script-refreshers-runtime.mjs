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
    screenWorkViewSummary.textContent = workViewSummary
      ? [
          "Summary: " + (workViewSummary.summaryText ?? "none"),
          "Title: " + (workViewSummary.title ?? "none"),
          "URL: " + (workViewSummary.url ?? "none"),
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

async function refreshHealthTrends() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/health/trends\`);
    const summary = data.summary ?? {};
    const resources = data.resources ?? {};
    const services = Array.isArray(data.services) ? data.services : [];
    healthTrendSampleCount.textContent = String(summary.sampleCount ?? 0);
    healthTrendStableServices.textContent = String(summary.stableServices ?? 0);
    healthTrendDegradedServices.textContent = String(summary.degradedServices ?? 0);
    healthTrendAlertCount.textContent = String(summary.latestAlertCount ?? 0);
    healthTrendJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(data.governance?.hostMutation)} recovery=\${Boolean(data.governance?.triggersRecovery)}\`,
      \`Window: \${summary.windowStart ?? "none"} -> \${summary.windowEnd ?? "none"} samples=\${summary.sampleCount ?? 0}\`,
      \`Services: online=\${summary.latestOnlineServices ?? 0}/\${summary.latestTotalServices ?? 0} stable=\${summary.stableServices ?? 0} degraded=\${summary.degradedServices ?? 0}\`,
      \`Resources: cpu=\${resources.cpuPercent?.latest ?? "n/a"}% memory=\${resources.memoryPercent?.latest ?? "n/a"}% disk=\${resources.diskPercent?.latest ?? "n/a"}%\`,
      \`Service trends: \${services.map((service) => \`\${service.service}:\${service.latestStatus}/offline=\${service.offline}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "route-aware recommendation"}\`,
    ].join("\\n");
  } catch {
    healthTrendSampleCount.textContent = "0";
    healthTrendStableServices.textContent = "0";
    healthTrendDegradedServices.textContent = "0";
    healthTrendAlertCount.textContent = "0";
    healthTrendJson.textContent = "Unable to read OpenClaw health trend summary.";
  }
}

async function refreshRouteAwareNextAction() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/next-action\`);
    const recommendation = data.recommendation ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    routeNextActionName.textContent = recommendation.action ?? "unknown";
    routeNextActionPriority.textContent = recommendation.priority ?? "unknown";
    routeNextActionCreatesTask.textContent = String(Boolean(governance.createsTask));
    routeNextActionMutation.textContent = String(Boolean(governance.hostMutation));
    routeNextActionJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Recommendation: \${recommendation.action ?? "unknown"} priority=\${recommendation.priority ?? "unknown"}\`,
      \`Reason: \${recommendation.reason ?? "none"}\`,
      \`Targets: \${(recommendation.targets ?? []).join(", ") || "none"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependency?.nodes ?? 0} highImpact=\${evidence.dependency?.highImpact ?? 0} healthSamples=\${evidence.health?.samples ?? 0} degraded=\${evidence.health?.degradedServices ?? 0}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.id}:allowed=\${Boolean(candidate.allowedNow)} mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "policy explanation"}\`,
    ].join("\\n");
  } catch {
    routeNextActionName.textContent = "offline";
    routeNextActionPriority.textContent = "unknown";
    routeNextActionCreatesTask.textContent = "false";
    routeNextActionMutation.textContent = "false";
    routeNextActionJson.textContent = "Unable to read route-aware next-action recommendation.";
  }
}

async function refreshConservativeRecoveryPolicy() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/recovery-policy\`);
    const governance = data.governance ?? {};
    const policy = data.policy ?? {};
    const routeState = data.routeState ?? {};
    const hardBoundaries = data.hardBoundaries ?? {};
    recoveryPolicyPosture.textContent = policy.currentPosture ?? "unknown";
    recoveryPolicyCreatesTask.textContent = String(Boolean(governance.createsTask));
    recoveryPolicyExecutesCommand.textContent = String(Boolean(governance.executesCommand));
    recoveryPolicyMutation.textContent = String(Boolean(governance.hostMutation));
    recoveryPolicyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Policy: \${policy.name ?? "unknown"} posture=\${policy.currentPosture ?? "unknown"}\`,
      \`Reason: \${policy.currentReason ?? "none"}\`,
      \`Route: action=\${routeState.action ?? "unknown"} priority=\${routeState.priority ?? "unknown"} degraded=\${routeState.degradedServices ?? 0} alerts=\${routeState.latestAlertCount ?? 0}\`,
      \`Evidence: dependencyNodes=\${routeState.dependencyNodes ?? 0} highImpact=\${routeState.highImpactNodes ?? 0} healthSamples=\${routeState.healthSamples ?? 0}\`,
      \`Rules: \${(data.rules ?? []).map((rule) => \`\${rule.id}:mutation=\${Boolean(rule.mutation)} createsTask=\${Boolean(rule.createsTask)}\`).join(", ")}\`,
      \`Boundaries: noTask=\${Boolean(hardBoundaries.noTaskCreation)} noCommand=\${Boolean(hardBoundaries.noCommandExecution)} noMutation=\${Boolean(hardBoundaries.noHostMutation)} noScheduler=\${Boolean(hardBoundaries.noScheduler)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "body governance readiness"}\`,
    ].join("\\n");
  } catch {
    recoveryPolicyPosture.textContent = "offline";
    recoveryPolicyCreatesTask.textContent = "false";
    recoveryPolicyExecutesCommand.textContent = "false";
    recoveryPolicyMutation.textContent = "false";
    recoveryPolicyJson.textContent = "Unable to read conservative recovery policy explanation.";
  }
}

async function refreshBodyGovernanceReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-governance-readiness\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const evidence = data.evidence ?? {};
    const completedTrack = data.completedTrack ?? {};
    bodyGovernanceReady.textContent = String(Boolean(summary.ready));
    bodyGovernanceChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    bodyGovernancePosture.textContent = summary.currentPosture ?? "unknown";
    bodyGovernanceMutation.textContent = String(Boolean(governance.hostMutation));
    bodyGovernanceJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Checks: \${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0} posture=\${summary.currentPosture ?? "unknown"} action=\${summary.routeAction ?? "unknown"} priority=\${summary.routePriority ?? "unknown"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependencyNodes ?? 0} highImpact=\${evidence.highImpactNodes ?? 0} healthSamples=\${evidence.healthSamples ?? 0} policyRules=\${evidence.policyRules ?? 0}\`,
      \`Completed: \${completedTrack.name ?? "unknown"} claim=\${completedTrack.completionClaim ?? "unknown"}\`,
      \`Slices: \${(completedTrack.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "phase 2 route review"}\`,
    ].join("\\n");
  } catch {
    bodyGovernanceReady.textContent = "false";
    bodyGovernanceChecks.textContent = "0/0";
    bodyGovernancePosture.textContent = "offline";
    bodyGovernanceMutation.textContent = "false";
    bodyGovernanceJson.textContent = "Unable to read body governance readiness bundle.";
  }
}

async function refreshBodyEvidenceTimeline() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const memory = data.memoryModel ?? {};
    bodyEvidenceTimelineReady.textContent = String(Boolean(summary.timelineReady));
    bodyEvidenceTimelineEntries.textContent = String(summary.entries ?? entries.length);
    bodyEvidenceTimelineLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.timelineReady)} entries=\${summary.entries ?? entries.length} phases=\${(summary.phases ?? []).join(",")}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Latest: \${summary.latestEntryId ?? "none"} registry=\${summary.latestRegistry ?? "none"} candidateDemoReady=\${Boolean(summary.candidateDemoReady)} nextRepairDemoReady=\${Boolean(summary.nextRepairDemoReady)} bodyGovernanceReady=\${Boolean(summary.bodyGovernanceReady)}\`,
      \`Entries: \${entries.map((entry) => \`\${entry.id}:\${entry.registry}:\${entry.phase}:mutation=\${Boolean(entry.mutation)}\`).join(", ")}\`,
      \`Memory: \${memory.label ?? "body_evidence_memory_v0"} purpose=\${memory.purpose ?? "none"}\`,
      \`Operator Use: \${(memory.operatorUse ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-timeline-readiness"} boundary=\${data.next?.boundary ?? "read-only readiness"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReady.textContent = "false";
    bodyEvidenceTimelineEntries.textContent = "0";
    bodyEvidenceTimelineLatest.textContent = "offline";
    bodyEvidenceTimelineMutation.textContent = "false";
    bodyEvidenceTimelineJson.textContent = "Unable to read body evidence timeline.";
  }
}

async function refreshBodyEvidenceTimelineReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    bodyEvidenceTimelineReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceTimelineReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceTimelineReadinessLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length} entries=\${summary.timelineEntries ?? 0}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReadinessReady.textContent = "false";
    bodyEvidenceTimelineReadinessChecks.textContent = "0/0";
    bodyEvidenceTimelineReadinessLatest.textContent = "offline";
    bodyEvidenceTimelineReadinessMutation.textContent = "false";
    bodyEvidenceTimelineReadinessJson.textContent = "Unable to read body evidence timeline readiness.";
  }
}

async function refreshBodyEvidenceLedgerPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const schema = plan.plannedRecordSchema ?? {};
    const gates = Array.isArray(plan.writeGates) ? plan.writeGates : [];
    bodyEvidenceLedgerPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerPlanSchema.textContent = summary.plannedSchema ?? schema.version ?? "unknown";
    bodyEvidenceLedgerPlanGates.textContent = String(summary.writeGateCount ?? gates.length);
    bodyEvidenceLedgerPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Schema: \${schema.version ?? "unknown"} required=\${(schema.requiredFields ?? []).join(",")}\`,
      \`Content: \${schema.contentPolicy ?? "unknown"}\`,
      \`Storage: \${plan.storageMode ?? "unknown"} status=\${plan.implementationStatus ?? "unknown"}\`,
      \`Write Gates: \${gates.map((gate) => \`\${gate.id}:required=\${Boolean(gate.requiredBeforeWrite)} passed=\${Boolean(gate.passed)}\`).join(", ")}\`,
      \`Verification: \${(plan.verificationPlan ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-route-review"} boundary=\${data.next?.boundary ?? "route review before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerPlanReady.textContent = "false";
    bodyEvidenceLedgerPlanSchema.textContent = "offline";
    bodyEvidenceLedgerPlanGates.textContent = "0";
    bodyEvidenceLedgerPlanWritten.textContent = "false";
    bodyEvidenceLedgerPlanJson.textContent = "Unable to read body evidence ledger plan.";
  }
}

async function refreshBodyEvidenceLedgerRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = String(Boolean(governance.canWriteLedger));
    bodyEvidenceLedgerRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerPlanReady=\${Boolean(evidence.ledgerPlanReady)} schema=\${evidence.plannedSchema ?? "unknown"} gates=\${evidence.writeGateCount ?? 0} unmet=\${(evidence.unmetWriteGateIds ?? []).join(",") || "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-plan"} boundary=\${data.next?.boundary ?? "storage root plan before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerRouteReviewMutation.textContent = "false";
    bodyEvidenceLedgerRouteReviewJson.textContent = "Unable to read body evidence ledger route review.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selectedRoot = plan.selectedRoot ?? {};
    const candidateRoots = Array.isArray(plan.candidateRoots) ? plan.candidateRoots : [];
    bodyEvidenceLedgerStorageRootPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = summary.selectedDisplayPath ?? selectedRoot.displayPath ?? "unknown";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = String(Boolean(summary.directoryCreated));
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerStorageRootPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} routeReviewReady=\${Boolean(summary.routeReviewReady)} directoryCreated=\${Boolean(summary.directoryCreated)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Selected: \${selectedRoot.id ?? "unknown"} path=\${selectedRoot.displayPath ?? "unknown"} policy=\${selectedRoot.rootPolicy ?? "unknown"}\`,
      \`Candidates: \${candidateRoots.map((root) => \`\${root.id}:\${root.displayPath}:recommended=\${Boolean(root.recommended)}:createsNow=\${Boolean(root.createsDirectoryNow)}:writesNow=\${Boolean(root.writesRecordsNow)}\`).join(", ")}\`,
      \`Path Policy: workspace=\${Boolean(plan.pathPolicy?.mustStayInsideWorkspace)} observerVisible=\${Boolean(plan.pathPolicy?.mustBeObserverVisible)} noCreate=\${Boolean(plan.pathPolicy?.mustNotCreateDirectoryInThisSlice)}\`,
      \`Pre-write Checks: \${(plan.preWriteChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-route-review"} boundary=\${data.next?.boundary ?? "route review before directory creation"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootPlanReady.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = "offline";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanJson.textContent = "Unable to read body evidence ledger storage root plan.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = String(Boolean(governance.canCreateDirectory));
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: root=\${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-write Checks: \${(evidence.preWriteChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-directory-task"} boundary=\${data.next?.boundary ?? "directory task before record writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = "Unable to read body evidence ledger storage root route review.";
  }
}

async function refreshBodyEvidenceLedgerDirectoryTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-directory-task"
      && decision.status === "selected"
      && evidence.rootInsideWorkspace === true;
    bodyEvidenceLedgerDirectoryTaskReady.textContent = String(ready);
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = evidence.selectedDisplayPath ?? "unknown";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = String(Boolean(evidence.directoryCreated));
    bodyEvidenceLedgerDirectoryTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-directory-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-directory-task-shell ready=\${ready}\`,
      \`Target: \${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canCreateDirectory=false canWriteLedger=false mutation=false executed=false",
      "Endpoint: /body/evidence-ledger/directory-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDirectoryTaskReady.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = "offline";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskJson.textContent = "Unable to read body evidence ledger directory task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFirstRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = String(Boolean(summary.directoryExists));
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} ledgerPlanReady=\${Boolean(summary.ledgerPlanReady)} timelineReady=\${Boolean(summary.timelineReady)} directoryExists=\${Boolean(summary.directoryExists)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Root: \${plan.ledgerRoot?.displayPath ?? "unknown"} resolved=\${plan.ledgerRoot?.resolvedPath ?? "unknown"} exists=\${Boolean(plan.ledgerRoot?.exists)}\`,
      \`Record: version=\${record.version ?? "unknown"} type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"}\`,
      \`Hash: \${record.contentHashStrategy ?? "unknown"}\`,
      \`Required: \${(plan.requiredFields ?? []).join(",")}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-route-review"} boundary=\${data.next?.boundary ?? "route review before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = "Unable to read body evidence ledger first record plan.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.firstRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} directoryExists=\${Boolean(evidence.directoryExists)} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-task"} boundary=\${data.next?.boundary ?? "approval-gated task shell before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = "Unable to read body evidence ledger first record route review.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-first-record-task"
      && decision.status === "selected"
      && evidence.firstRecordPlanReady === true
      && evidence.directoryExists === true;
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFirstRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-first-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-first-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} source=\${evidence.sourceRegistry ?? "unknown"} requiredFields=\${evidence.requiredFieldCount ?? 0} directoryExists=\${Boolean(evidence.directoryExists)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false",
      "Endpoint: /body/evidence-ledger/first-record-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = "Unable to read body evidence ledger first record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const records = Array.isArray(data.evidence?.records) ? data.evidence.records : [];
    bodyEvidenceLedgerReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceLedgerReadinessRecords.textContent = String(summary.recordCount ?? records.length);
    bodyEvidenceLedgerReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} records=\${summary.recordCount ?? records.length} bootstrap=\${summary.bootstrapRecordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"} exists=\${Boolean(summary.ledgerFileExists)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Records: \${records.map((record) => \`\${record.id}:\${record.evidenceType}:hash=\${Boolean(record.hashValid)}:source=\${record.sourceRegistry}\`).join(", ") || "none"}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more ledger writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerReadinessReady.textContent = "false";
    bodyEvidenceLedgerReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerReadinessRecords.textContent = "0";
    bodyEvidenceLedgerReadinessMutation.textContent = "false";
    bodyEvidenceLedgerReadinessJson.textContent = "Unable to read body evidence ledger readiness.";
  }
}

async function refreshBodyEvidenceLedgerDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const narrative = Array.isArray(data.demoNarrative) ? data.demoNarrative : [];
    bodyEvidenceLedgerDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    bodyEvidenceLedgerDemoStatusChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? checklist.length}\`;
    bodyEvidenceLedgerDemoStatusRecord.textContent = summary.bootstrapRecordId ?? "none";
    bodyEvidenceLedgerDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} ledgerReady=\${Boolean(summary.ledgerReady)} records=\${summary.recordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"}\`,
      \`Record: id=\${summary.bootstrapRecordId ?? "none"} hash=\${summary.bootstrapRecordHash ?? "none"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${Boolean(item.passed)}\`).join(", ")}\`,
      \`Narrative: \${narrative.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more body capability work"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDemoStatusReady.textContent = "false";
    bodyEvidenceLedgerDemoStatusChecks.textContent = "0/0";
    bodyEvidenceLedgerDemoStatusRecord.textContent = "offline";
    bodyEvidenceLedgerDemoStatusMutation.textContent = "false";
    bodyEvidenceLedgerDemoStatusJson.textContent = "Unable to read body evidence ledger demo status.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    const existingRecords = Array.isArray(plan.existingRecords) ? plan.existingRecords : [];
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = String(summary.existingRecordCount ?? existingRecords.length);
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} ledgerReady=\${Boolean(summary.ledgerReady)} existingRecords=\${summary.existingRecordCount ?? existingRecords.length} plannedSequence=\${summary.plannedSequence ?? "unknown"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Ledger: \${plan.ledgerFile?.displayPath ?? "unknown"} exists=\${Boolean(plan.ledgerFile?.exists)} lines=\${plan.ledgerFile?.lineCount ?? 0} latest=\${summary.latestRecordId ?? "none"} latestHashValid=\${Boolean(summary.latestRecordHashValid)}\`,
      \`Record: type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"} sequence=\${record.sequence ?? "unknown"}\`,
      \`Existing: \${existingRecords.map((item) => \`\${item.index}:\${item.id}:\${item.evidenceType}:hash=\${Boolean(item.hashValid)}\`).join(", ") || "none"}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(plan.deferredActions ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = "Unable to read body evidence ledger follow-up record plan.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.followupRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(evidence.deferredActions ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-followup-record-task"} boundary=\${data.next?.boundary ?? "future task shell before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up record route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-followup-record-task"
      && decision.status === "selected"
      && evidence.followupRecordPlanReady === true
      && evidence.plannedRecordType === "body_evidence_timeline_followup"
      && evidence.plannedSequence === 2
      && evidence.existingRecordCount === 1;
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-followup-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-followup-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} latest=\${evidence.latestRecordId ?? "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false scheduler=false backgroundWriter=false",
      "Endpoint: /body/evidence-ledger/followup-record-tasks",
    ].join("\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = "Unable to read body evidence ledger follow-up record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const hardBoundary = Array.isArray(data.evidence?.hardBoundary) ? data.evidence.hardBoundary : [];
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"}\`,
      \`Record: type=\${summary.plannedRecordType ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${item.status}\`).join(", ")}\`,
      \`Boundary: \${hardBoundary.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before any follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = "Unable to read body evidence ledger follow-up record readiness.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-route-review\`);
    const decision = data.decision ?? {};
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = decision.status ?? data.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = String(Boolean(governance.approvesTask));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = String(Boolean(summary.recordAppended));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-route-review-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} approvesTask=\${Boolean(governance.approvesTask)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Append Registry: openclaw-body-evidence-ledger-followup-record-append-v0\`,
      \`Append Endpoint: /body/evidence-ledger/followup-record-append\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up append route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = data.checklist ?? [];
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} record=\${summary.recordId ?? "none"} previous=\${summary.previousRecordId ?? "none"} records=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durable=\${Boolean(summary.durableStorageWritten)}\`,
      \`Hash: previous=\${summary.previousRecordHash ?? "none"} current=\${summary.contentHash ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = "Unable to read body evidence ledger follow-up append readiness.";
  }
}

async function refreshPhase2RouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/phase-2-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    phase2RouteSelectedTrack.textContent = decision.selectedTrack ?? "unknown";
    phase2RouteNextSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    phase2RouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    phase2RouteMutation.textContent = String(Boolean(governance.hostMutation));
    phase2RouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: trackCReady=\${Boolean(evidence.trackCReady)} checks=\${evidence.trackCChecks ?? "0/0"} completed=\${evidence.completedTrack?.completionClaim ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo control room"}\`,
    ].join("\\n");
  } catch {
    phase2RouteSelectedTrack.textContent = "offline";
    phase2RouteNextSlice.textContent = "unknown";
    phase2RouteCreatesTask.textContent = "false";
    phase2RouteMutation.textContent = "false";
    phase2RouteJson.textContent = "Unable to read Phase 2 route review.";
  }
}

async function refreshSystemdRepairCandidates() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidates\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const candidates = data.candidates ?? [];
    systemdRepairCandidateCount.textContent = String(summary.totalCandidates ?? candidates.length);
    systemdRepairCandidateRecommended.textContent = summary.recommendedUnit ?? "unknown";
    systemdRepairCandidateCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Summary: total=\${summary.totalCandidates ?? 0} degraded=\${summary.degradedCandidates ?? 0} demoTargets=\${summary.existingDemoTargets ?? 0} highImpact=\${summary.highImpactCandidates ?? 0}\`,
      \`Recommended: \${summary.recommendedUnit ?? "none"} reason=\${summary.recommendedReason ?? "none"}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.unit}:score=\${candidate.assessment?.score ?? 0}:demo=\${Boolean(candidate.assessment?.existingDemoTarget)}:degraded=\${Boolean(candidate.assessment?.degraded)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "repair candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateCount.textContent = "0";
    systemdRepairCandidateRecommended.textContent = "offline";
    systemdRepairCandidateCreatesTask.textContent = "false";
    systemdRepairCandidateMutation.textContent = "false";
    systemdRepairCandidateJson.textContent = "Unable to read systemd repair candidate assessment.";
  }
}

async function refreshSystemdRepairCandidatePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selected = data.selectedCandidate ?? {};
    systemdRepairCandidatePlanTarget.textContent = plan.targetUnit ?? selected.unit ?? "unknown";
    systemdRepairCandidatePlanMode.textContent = data.mode ?? "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidatePlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidatePlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Selected: \${selected.unit ?? "none"} score=\${selected.score ?? 0} demoTarget=\${Boolean(selected.existingDemoTarget)} degraded=\${Boolean(selected.degraded)}\`,
      \`Plan: intent=\${plan.intent ?? "unknown"} target=\${plan.targetUnit ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} command=\${plan.commandPreview ?? "none"}\`,
      \`Steps: \${(plan.steps ?? []).map((step) => \`\${step.id}=\${step.status}\`).join(", ")}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "observer candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidatePlanTarget.textContent = "offline";
    systemdRepairCandidatePlanMode.textContent = "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = "false";
    systemdRepairCandidatePlanMutation.textContent = "false";
    systemdRepairCandidatePlanJson.textContent = "Unable to read systemd repair candidate plan.";
  }
}

async function refreshSystemdRepairCandidateRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    systemdRepairCandidateRouteStatus.textContent = decision.status ?? "unknown";
    systemdRepairCandidateRouteTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: status=\${decision.status ?? "unknown"} target=\${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Reason: \${decision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Allowed Next: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)} createsTask=\${Boolean(action.createsTask)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "candidate task shell"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteStatus.textContent = "offline";
    systemdRepairCandidateRouteTarget.textContent = "offline";
    systemdRepairCandidateRouteCreatesTask.textContent = "false";
    systemdRepairCandidateRouteMutation.textContent = "false";
    systemdRepairCandidateRouteJson.textContent = "Unable to read repair candidate task route gate.";
  }
}

async function refreshSystemdRepairCandidateTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    const ready = decision.existingRouteAvailable === true
      && decision.targetUnit === "openclaw-browser-runtime.service";
    systemdRepairCandidateTaskShellReady.textContent = String(ready);
    systemdRepairCandidateTaskShellTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateTaskShellApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = [
      "Registry: openclaw-systemd-repair-candidate-task-shell-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-candidate-task-shell ready=\${ready}\`,
      \`Target: \${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Approval: creates pending high-risk approval only after explicit button click\`,
      \`Governance: createsTaskOnClick=true mutation=false executed=false hostMutation=false routeMutation=\${Boolean(governance.hostMutation)}\`,
      "Endpoint: /system/systemd/repair-candidate-tasks",
    ].join("\\n");
  } catch {
    systemdRepairCandidateTaskShellReady.textContent = "false";
    systemdRepairCandidateTaskShellTarget.textContent = "offline";
    systemdRepairCandidateTaskShellApproval.textContent = "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = "Unable to read repair candidate task shell boundary.";
  }
}

async function refreshSystemdRepairCandidateReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const nextSlice = data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-route-review";
    systemdRepairCandidateReadinessReady.textContent = String(Boolean(summary.ready));
    systemdRepairCandidateReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    systemdRepairCandidateReadinessNext.textContent = nextSlice;
    systemdRepairCandidateReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} selectedUnit=\${summary.selectedUnit ?? "unknown"}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${nextSlice} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateReadinessReady.textContent = "false";
    systemdRepairCandidateReadinessChecks.textContent = "0/0";
    systemdRepairCandidateReadinessNext.textContent = "offline";
    systemdRepairCandidateReadinessMutation.textContent = "false";
    systemdRepairCandidateReadinessJson.textContent = "Unable to read repair candidate block readiness.";
  }
}

async function refreshSystemdRepairCandidateRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-route-review\`);
    const decision = data.decision ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    systemdRepairCandidateRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdRepairCandidateRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: candidateReady=\${Boolean(evidence.candidateReady)} checks=\${evidence.candidateChecks ?? "0/0"} selectedUnit=\${evidence.selectedUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-demo-status"} boundary=\${data.next?.boundary ?? "read-only demo status"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteReviewTrack.textContent = "offline";
    systemdRepairCandidateRouteReviewSlice.textContent = "offline";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = "false";
    systemdRepairCandidateRouteReviewMutation.textContent = "false";
    systemdRepairCandidateRouteReviewJson.textContent = "Unable to read repair candidate route review.";
  }
}

async function refreshSystemdRepairCandidateDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const operatorView = data.operatorView ?? {};
    systemdRepairCandidateDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    systemdRepairCandidateDemoStatusChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    systemdRepairCandidateDemoStatusTarget.textContent = summary.selectedUnit ?? "unknown";
    systemdRepairCandidateDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} target=\${summary.selectedUnit ?? "unknown"} hiddenMutation=\${Boolean(summary.hiddenMutation)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checklist: \${(data.checklist ?? []).map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Narrative: \${operatorView.narrative ?? "none"}\`,
      \`Speaking: \${(operatorView.speakingPoints ?? []).join(" | ")}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateDemoStatusReady.textContent = "false";
    systemdRepairCandidateDemoStatusChecks.textContent = "0/0";
    systemdRepairCandidateDemoStatusTarget.textContent = "offline";
    systemdRepairCandidateDemoStatusMutation.textContent = "false";
    systemdRepairCandidateDemoStatusJson.textContent = "Unable to read repair candidate demo status.";
  }
}

async function refreshSystemdNextRepairScopeReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-scope-review\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairScopeReviewReady.textContent = String(Boolean(summary.ready));
    systemdNextRepairScopeReviewUnit.textContent = summary.selectedUnit ?? decision.selectedUnit ?? "unknown";
    systemdNextRepairScopeReviewCandidates.textContent = String(summary.candidateCount ?? data.candidates?.length ?? 0);
    systemdNextRepairScopeReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairScopeReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerDemoReady=\${Boolean(summary.ledgerDemoReady)} ledgerRegistry=\${evidence.ledgerDemo?.registry ?? "unknown"} recordCount=\${evidence.ledgerDemo?.recordCount ?? 0} completedDemoUnit=\${summary.completedDemoUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.unit}:score=\${candidate.score}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-plan"} boundary=\${data.next?.boundary ?? "plan-only repair scope"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairScopeReviewReady.textContent = "false";
    systemdNextRepairScopeReviewUnit.textContent = "offline";
    systemdNextRepairScopeReviewCandidates.textContent = "0";
    systemdNextRepairScopeReviewMutation.textContent = "false";
    systemdNextRepairScopeReviewJson.textContent = "Unable to read next repair scope review.";
  }
}

async function refreshSystemdNextRepairPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const scope = data.scope ?? {};
    systemdNextRepairPlanTarget.textContent = plan.targetUnit ?? data.target?.unit ?? "unknown";
    systemdNextRepairPlanMode.textContent = data.mode ?? "plan_only";
    systemdNextRepairPlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairPlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Scope: ready=\${Boolean(scope.scopeReady)} ledgerDemoReady=\${Boolean(scope.ledgerDemoReady)} completedDemoUnit=\${scope.completedDemoUnit ?? "unknown"}\`,
      \`Target: \${plan.targetUnit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command preview: \${plan.commandPreview ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} restartsService=\${Boolean(plan.restartsService)}\`,
      \`Reason: \${plan.reason ?? "none"}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Avoid: \${(plan.notSelected ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-route-review"} boundary=\${data.next?.boundary ?? "route review before mutation"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairPlanTarget.textContent = "offline";
    systemdNextRepairPlanMode.textContent = "offline";
    systemdNextRepairPlanCreatesTask.textContent = "false";
    systemdNextRepairPlanMutation.textContent = "false";
    systemdNextRepairPlanJson.textContent = "Unable to read next repair plan.";
  }
}

async function refreshSystemdNextRepairRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdNextRepairRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.planReady)} target=\${evidence.targetUnit ?? "unknown"} previewOnly=\${Boolean(evidence.commandPreviewOnly)} command=\${evidence.commandPreview ?? "none"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-dry-run"} boundary=\${data.next?.boundary ?? "dry-run envelope only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairRouteReviewTrack.textContent = "offline";
    systemdNextRepairRouteReviewSlice.textContent = "offline";
    systemdNextRepairRouteReviewCreatesTask.textContent = "false";
    systemdNextRepairRouteReviewMutation.textContent = "false";
    systemdNextRepairRouteReviewJson.textContent = "Unable to read next repair route review.";
  }
}

async function refreshSystemdNextRepairDryRun() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-dry-run\`);
    const governance = data.governance ?? {};
    const dryRun = data.dryRun ?? {};
    systemdNextRepairDryRunTarget.textContent = data.target?.unit ?? data.plan?.plan?.targetUnit ?? "unknown";
    systemdNextRepairDryRunMode.textContent = data.mode ?? "dry_run";
    systemdNextRepairDryRunWouldExecute.textContent = String(Boolean(dryRun.wouldExecute));
    systemdNextRepairDryRunMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairDryRunJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} wouldExecute=\${Boolean(data.wouldExecute)} canRestart=\${Boolean(data.canRestart)} mutation=\${Boolean(governance.hostMutation)} executesCommand=\${Boolean(governance.executesCommand)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)}\`,
      \`Route: \${data.routeReview?.status ?? "unknown"} selected=\${data.routeReview?.selectedSlice ?? "unknown"} unit=\${data.routeReview?.selectedUnit ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command: \${dryRun.command ?? "none"} \${(dryRun.args ?? []).join(" ")} risk=\${dryRun.risk ?? "unknown"} requiresApproval=\${Boolean(dryRun.requiresApproval)} wouldExecute=\${Boolean(dryRun.wouldExecute)}\`,
      "Expected checks: no_execution, route_review_selected_dry_run, target_is_system_sense, operator_visible_before_mutation, no_restart_executed",
      \`Checks: \${(dryRun.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-route"} boundary=\${data.next?.boundary ?? "route-review task materialization"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairDryRunTarget.textContent = "offline";
    systemdNextRepairDryRunMode.textContent = "offline";
    systemdNextRepairDryRunWouldExecute.textContent = "false";
    systemdNextRepairDryRunMutation.textContent = "false";
    systemdNextRepairDryRunJson.textContent = "Unable to read next repair dry-run envelope.";
  }
}

async function refreshSystemdNextRepairTaskRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairTaskRouteStatus.textContent = routeDecision.status ?? "unknown";
    systemdNextRepairTaskRouteSlice.textContent = routeDecision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairTaskRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairTaskRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Route: \${routeDecision.status ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"} taskShellAllowed=\${Boolean(routeDecision.taskShellAllowed)}\`,
      \`Reason: \${routeDecision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Evidence: dryRunReady=\${Boolean(evidence.dryRunReady)} command=\${evidence.command ?? "none"} \${(evidence.args ?? []).join(" ")} wouldExecute=\${Boolean(evidence.wouldExecute)}\`,
      \`Actions: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)}:createsTask=\${Boolean(action.createsTask)}:mutation=\${Boolean(action.mutatesHost)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"} boundary=\${data.next?.boundary ?? "task shell only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskRouteStatus.textContent = "offline";
    systemdNextRepairTaskRouteSlice.textContent = "offline";
    systemdNextRepairTaskRouteCreatesTask.textContent = "false";
    systemdNextRepairTaskRouteMutation.textContent = "false";
    systemdNextRepairTaskRouteJson.textContent = "Unable to read next repair task route.";
  }
}

async function refreshSystemdNextRepairTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const createShell = data.allowedNextActions?.find((action) => action.id === "create-task-shell") ?? {};
    systemdNextRepairTaskShellReady.textContent = String(Boolean(routeDecision.taskShellAllowed));
    systemdNextRepairTaskShellTarget.textContent = routeDecision.targetUnit ?? "openclaw-system-sense.service";
    systemdNextRepairTaskShellApproval.textContent = createShell.createsApproval === true ? "pending-after-create" : "unavailable";
    systemdNextRepairTaskShellMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskShellJson.textContent = [
      "Registry: openclaw-systemd-next-repair-task-shell-v0",
      "Real Execution Registry: openclaw-systemd-next-repair-real-execution-v0",
      "Endpoint: /system/systemd/next-repair-tasks",
      \`Route: \${data.registry ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"}\`,
      \`Create: allowed=\${Boolean(createShell.allowedNow)} createsTask=\${Boolean(createShell.createsTask)} createsApproval=\${Boolean(createShell.createsApproval)} approvalState=pending-after-create\`,
      \`Boundary: executed=false hostMutation=\${Boolean(governance.hostMutation)} realExecutionEnabled=false\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskShellReady.textContent = "false";
    systemdNextRepairTaskShellTarget.textContent = "offline";
    systemdNextRepairTaskShellApproval.textContent = "unavailable";
    systemdNextRepairTaskShellMutation.textContent = "false";
    systemdNextRepairTaskShellJson.textContent = "Unable to read next repair task shell route.";
  }
}

async function refreshSystemdUnitInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/units\`);
    const summary = data.summary ?? {};
    const source = data.source ?? {};
    const governance = data.governance ?? {};
    const units = Array.isArray(data.units) ? data.units : [];
    systemdUnitTotal.textContent = String(summary.total ?? units.length);
    systemdUnitActive.textContent = String(summary.active ?? 0);
    systemdUnitObserved.textContent = String(summary.observed ?? 0);
    systemdUnitMode.textContent = data.mode ?? "read_only";
    systemdUnitJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canMutate=\${Boolean(data.canMutate)} canRestart=\${Boolean(data.canRestart)}\`,
      \`Systemd: \${source.systemdAvailable ? source.systemdVersion ?? "available" : source.unavailableReason ?? "unavailable"}\`,
      \`Governance: \${governance.autonomy ?? "observe_only"} domain=\${governance.domain ?? "body_internal"} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Units: \${units.map((unit) => \`\${unit.unit}:\${unit.activeState ?? unit.status ?? "unknown"}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "plan-only repair proposal"}\`,
    ].join("\\n");
  } catch {
    systemdUnitTotal.textContent = "0";
    systemdUnitActive.textContent = "0";
    systemdUnitObserved.textContent = "0";
    systemdUnitMode.textContent = "offline";
    systemdUnitJson.textContent = "Unable to read OpenClaw systemd unit inventory.";
  }
}

async function refreshSystemdDependencyMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/dependency-map\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const highImpact = nodes
      .filter((node) => node.impactClass === "foundational" || node.impactClass === "high")
      .map((node) => \`\${node.unit}:\${node.impactRadius ?? 0}\`);
    systemdDependencyNodeCount.textContent = String(summary.nodes ?? nodes.length);
    systemdDependencyEdgeCount.textContent = String(summary.edges ?? edges.length);
    systemdDependencyRootCount.textContent = String(summary.roots ?? data.roots?.length ?? 0);
    systemdDependencyHighImpact.textContent = String(summary.highImpact ?? highImpact.length);
    systemdDependencyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Roots: \${(data.roots ?? []).join(", ") || "none"}\`,
      \`Leaves: \${(data.leaves ?? []).join(", ") || "none"}\`,
      \`High impact: \${highImpact.join(", ") || "none"}\`,
      \`Layers: \${Object.entries(data.startupLayers ?? {}).map(([layer, units]) => \`\${layer}=[\${units.join(", ")}]\`).join(" ")}\`,
      \`Edges: \${edges.map((edge) => \`\${edge.from}->\${edge.to}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "health trend summary"}\`,
    ].join("\\n");
  } catch {
    systemdDependencyNodeCount.textContent = "0";
    systemdDependencyEdgeCount.textContent = "0";
    systemdDependencyRootCount.textContent = "0";
    systemdDependencyHighImpact.textContent = "0";
    systemdDependencyJson.textContent = "Unable to read OpenClaw body dependency map.";
  }
}

async function refreshSystemdRepairPlan() {
  try {
    const [plan, dryRun] = await Promise.all([
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-plan?unit=openclaw-browser-runtime.service\`),
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service\`),
    ]);
    const proposal = plan.proposal ?? {};
    const target = plan.target ?? {};
    systemdRepairPlanTarget.textContent = target.unit ?? "unknown";
    systemdRepairPlanRisk.textContent = proposal.risk ?? "unknown";
    systemdRepairPlanMode.textContent = plan.mode ?? "plan_only";
    systemdRepairDryRunMode.textContent = dryRun.mode ?? "operator_visible_dry_run";
    systemdRepairPlanJson.textContent = [
      \`Registry: \${plan.registry ?? "unknown"}\`,
      \`Target: \${target.unit ?? "unknown"} state=\${target.activeState ?? "unknown"}/\${target.subState ?? "unknown"}\`,
      \`Command: \${proposal.command?.command ?? "systemctl"} \${(proposal.command?.args ?? []).join(" ")}\`,
      \`Risk: \${proposal.risk ?? "unknown"} approvalForExecution=\${Boolean(proposal.approvalRequiredForExecution)}\`,
      \`Reason: \${proposal.reason ?? "none"}\`,
      \`Rollback: \${proposal.rollbackNote ?? "none"}\`,
    ].join("\\n");
    systemdRepairDryRunJson.textContent = [
      \`Registry: \${dryRun.registry ?? "unknown"}\`,
      \`Mode: \${dryRun.mode ?? "unknown"} wouldExecute=\${Boolean(dryRun.wouldExecute)} canRestart=\${Boolean(dryRun.canRestart)}\`,
      \`Dry Run: \${dryRun.dryRun?.command ?? "systemctl"} \${(dryRun.dryRun?.args ?? []).join(" ")}\`,
      \`Governance: \${dryRun.governance?.autonomy ?? "dry_run_only"} mutation=\${Boolean(dryRun.governance?.hostMutation)}\`,
      \`Checks: \${(dryRun.dryRun?.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Next: \${dryRun.next?.recommendedSlice ?? "separate route review required"}\`,
    ].join("\\n");
  } catch {
    systemdRepairPlanTarget.textContent = "offline";
    systemdRepairPlanRisk.textContent = "unknown";
    systemdRepairPlanMode.textContent = "offline";
    systemdRepairDryRunMode.textContent = "offline";
    systemdRepairPlanJson.textContent = "Unable to read OpenClaw systemd repair plan.";
    systemdRepairDryRunJson.textContent = "Unable to read OpenClaw systemd repair dry-run envelope.";
  }
}

async function refreshSystemdRepairExecutionTaskDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service\`);
    const draft = data.draft ?? {};
    const systemdRepair = draft.systemdRepair ?? {};
    systemdRepairExecutionTaskRegistry.textContent = data.registry ?? "openclaw-systemd-repair-execution-task-v0";
    systemdRepairExecutionTaskTarget.textContent = data.target?.unit ?? systemdRepair.target?.unit ?? "unknown";
    systemdRepairExecutionTaskApproval.textContent = draft.policy?.decision?.decision === "require_approval" ? "required" : "unknown";
    systemdRepairExecutionTaskExecuted.textContent = String(Boolean(systemdRepair.execution?.executed));
    systemdRepairExecutionTaskJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"}\`,
      \`Policy: \${draft.policy?.decision?.decision ?? "unknown"} risk=\${draft.policy?.decision?.risk ?? "unknown"}\`,
      \`Command: \${systemdRepair.command?.command ?? "systemctl"} \${(systemdRepair.command?.args ?? []).join(" ")}\`,
      \`Evidence: inventory=\${systemdRepair.inventoryRegistry ?? "unknown"} plan=\${systemdRepair.planRegistry ?? "unknown"} dryRun=\${systemdRepair.sourceRegistry ?? "unknown"}\`,
      \`Execution: shellOnly=\${Boolean(systemdRepair.execution?.shellOnly)} realExecutionEnabled=\${Boolean(systemdRepair.execution?.realExecutionEnabled)} executed=\${Boolean(systemdRepair.execution?.executed)} hostMutation=\${Boolean(systemdRepair.execution?.hostMutation)} hostMutationAttempted=\${Boolean(systemdRepair.execution?.hostMutationAttempted)}\`,
      \`Real execution unit: \${systemdRepair.execution?.selectedRealExecutionUnit ?? "not-enabled"}\`,
    ].join("\\n");
  } catch {
    systemdRepairExecutionTaskRegistry.textContent = "offline";
    systemdRepairExecutionTaskTarget.textContent = "offline";
    systemdRepairExecutionTaskApproval.textContent = "unknown";
    systemdRepairExecutionTaskExecuted.textContent = "false";
    systemdRepairExecutionTaskJson.textContent = "Unable to read OpenClaw systemd repair execution task draft.";
  }
}

async function refreshHealState() {
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
