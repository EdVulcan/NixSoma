export const observerClientRuntimeBindingsScript = `createTaskButton.addEventListener("click", () => {
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

engineeringEditProposalTaskButton.addEventListener("click", () => {
  createEngineeringEditLoopApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringWriteProposalTaskButton.addEventListener("click", () => {
  createEngineeringWriteLoopApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringVerificationTaskButton.addEventListener("click", () => {
  createEngineeringVerificationLoopApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringLspLifecycleTaskButton.addEventListener("click", () => {
  createEngineeringLspLifecycleLoopTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringLspSourceTransferTaskButton.addEventListener("click", () => {
  createEngineeringLspSourceTransferLoopTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringLspSymbolRequestTaskButton.addEventListener("click", () => {
  createEngineeringLspSymbolRequestLoopTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringLoopCompletionButton.addEventListener("click", () => {
  refreshEngineeringLoopCompletionReadback().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringLoopRestoreButton.addEventListener("click", () => {
  restoreEngineeringLoopStateFromHistory().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringRecoveryDraftButton.addEventListener("click", () => {
  draftEngineeringRecoveryLoopAction().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringRecoveryTaskButton.addEventListener("click", () => {
  createEngineeringRecoveryLoopTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

engineeringPlanTodoBridgeButton.addEventListener("click", () => {
  bridgeEngineeringPlanningWorkbenchState().catch((error) => {
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
