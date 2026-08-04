export const observerClientRuntimeAiWorkspaceNativeIntakeWorkflowScript = `async function runAiWorkspaceNativeIntakeWorkflow() {
  if (aiWorkspaceActionInFlight()) return;
  aiWorkspaceNativeIntakeWorkflowInFlight = true;
  aiWorkspaceNativeIntakeWorkflowStatus.textContent = "running";
  updateAiSurfaceScrollControls();
  try {
    await refreshWorkView();
    await refreshRuntime();
    const taskId = currentAiWorkspaceTaskId();
    if (!taskId) throw new Error("A current operator-reviewed task is required.");
    const nativeIntakeLifecycle = latestWorkViewState?.aiGraphicalSession
      ?.nativeIntakeLifecycle ?? {};
    if (nativeIntakeLifecycle.enabled !== true
      || nativeIntakeLifecycle.status !== "stopped"
      || nativeIntakeLifecycle.active !== false
      || nativeIntakeLifecycle.surfaceAttached !== false) {
      throw new Error("The fixed native intake application must be stopped.");
    }

    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.native_intake_workflow",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const summary = response.summary ?? response.invocation?.summary ?? {};
    const started = result.application?.started ?? {};
    const stopped = result.application?.stopped ?? {};
    const typeStep = result.typeStep ?? {};
    const allowedStatuses = new Set([
      "completed",
      "completed_audit_unavailable",
      "precondition_unavailable",
      "precondition_failed",
      "start_outcome_unknown",
      "start_evidence_invalid",
      "stopped_after_type",
      "type_outcome_unknown",
      "cleanup_evidence_invalid",
      "cleanup_outcome_unknown",
      "runtime_unavailable",
      "local_fallback",
    ]);
    const completed = result.status === "completed";
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-native-intake-workflow-v0"
      || !allowedStatuses.has(result.status)
      || !Number.isInteger(evidence.providerCallCountMinimum)
      || evidence.providerCallCountMinimum < 0
      || evidence.providerCallCountMinimum > 1
      || !Number.isInteger(evidence.actionCountMinimum)
      || evidence.actionCountMinimum < 0
      || evidence.actionCountMinimum > 1
      || !Number.isInteger(evidence.lifecycleActionCountMinimum)
      || evidence.lifecycleActionCountMinimum < 0
      || evidence.lifecycleActionCountMinimum > 2
      || (evidence.taskId !== null && evidence.taskId !== taskId)
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 1
      || governance.maximumLifecycleActions !== 2
      || governance.maximumFixedActions !== 3
      || governance.exactFixedApplication !== true
      || governance.arbitraryKeyboardInput !== false
      || governance.enterKeyInput !== false
      || governance.hotkeyInput !== false
      || governance.automaticRepeat !== false
      || governance.inputTextExposed !== false
      || governance.inputTextPersisted !== false
      || governance.taskMutated !== false
      || governance.automaticTaskCompletion !== false
      || governance.arbitraryProcessLaunch !== false
      || governance.arbitraryWindowControl !== false
      || governance.networkAccessExpanded !== false
      || governance.createsTask !== false
      || governance.createsApproval !== false
      || governance.mutatesHost !== false
      || response.invocation?.capability?.id !== "act.ai.workspace.native_intake_workflow"
      || response.invocation?.authorization?.policyId
        !== "ai-workspace-explicit-native-intake-workflow"
      || response.invocation?.authorization?.approved !== true
      || summary.kind !== "ai.workspace.native_intake_workflow"
      || summary.status !== result.status
      || summary.inputTextPersisted !== false
      || summary.arbitraryProcessLaunch !== false
      || JSON.stringify(response).includes('"inputText"')) {
      throw new Error("AI workspace native intake workflow result was invalid.");
    }
    if (completed && (started.registry !== "nixsoma-ai-native-intake-lifecycle-v0"
      || started.unitName !== "nixsoma-ai-native-intake.service"
      || started.status !== "running"
      || started.active !== true
      || started.surfaceAttached !== true
      || started.activated !== true
      || !Number.isInteger(started.surfaceId)
      || started.surfaceId < 1
      || !Number.isInteger(started.inventorySequence)
      || started.inventorySequence < 1
      || stopped.registry !== "nixsoma-ai-native-intake-lifecycle-v0"
      || stopped.unitName !== "nixsoma-ai-native-intake.service"
      || stopped.status !== "stopped"
      || stopped.active !== false
      || stopped.surfaceAttached !== false
      || typeStep.status !== "executed"
      || typeStep.actionId !== "type_text"
      || typeStep.inputEvidence?.registry !== "openclaw-write-only-input-evidence-v0"
      || !Number.isInteger(typeStep.inputEvidence?.charCount)
      || typeStep.inputEvidence.charCount < 1
      || typeStep.inputEvidence.charCount > 32
      || typeStep.inputEvidence.textExposed !== false
      || typeStep.inputEvidence.persisted !== false
      || typeStep.providerCalled !== true
      || typeStep.actionExecuted !== true
      || typeStep.postActionVerified !== true
      || typeStep.completionAudit !== true
      || typeStep.expectedSurfaceBound !== true
      || evidence.taskId !== taskId
      || evidence.surfaceId !== started.surfaceId
      || evidence.inventorySequence !== started.inventorySequence
      || evidence.providerCallCount !== 1
      || evidence.actionCount !== 1
      || evidence.lifecycleActionCount !== 2
      || evidence.fixedActionCount !== 3
      || evidence.lifecycleStartVerified !== true
      || evidence.lifecycleStopVerified !== true
      || evidence.workflowCompletionAudit !== true
      || evidence.outcomeUnknown !== false
      || governance.fixedProcessStart !== true
      || governance.fixedProcessStop !== true
      || governance.currentActiveSurfaceBound !== true
      || summary.lifecycleStartVerified !== true
      || summary.lifecycleStopVerified !== true
      || summary.workflowCompletionAudit !== true)) {
      throw new Error("Completed native intake workflow evidence was invalid.");
    }

    aiWorkspaceNativeIntakeWorkflowStatus.textContent = completed
      ? "typed + stopped"
      : result.status.replaceAll("_", " ");
    setControlMessage("AI native intake workflow: "
      + aiWorkspaceNativeIntakeWorkflowStatus.textContent + ".");
    await refreshActionState();
    await refreshRuntime();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceNativeIntakeWorkflowInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceNativeIntakeWorkflowButton.addEventListener("click", () => {
  runAiWorkspaceNativeIntakeWorkflow().catch((error) => {
    aiWorkspaceNativeIntakeWorkflowStatus.textContent = "unavailable";
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
