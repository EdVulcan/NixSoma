export const observerClientRuntimeAiWorkspaceReviewedMultiApplicationMissionScript = `async function runAiWorkspaceReviewedMultiApplicationMission() {
  if (aiWorkspaceActionInFlight()) return;
  aiWorkspaceReviewedMultiApplicationMissionInFlight = true;
  aiWorkspaceReviewedMultiApplicationMissionStatus.textContent = "running";
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
        capabilityId: "act.ai.workspace.reviewed_multi_application_mission",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const summary = response.summary ?? response.invocation?.summary ?? {};
    const applications = Array.isArray(result.applications) ? result.applications : [];
    const allowedStatuses = new Set([
      "completed",
      "completed_audit_unavailable",
      "precondition_failed",
      "browser_outcome_unknown",
      "stopped_after_browser",
      "native_outcome_unknown",
      "stopped_after_native",
      "runtime_unavailable",
      "local_fallback",
    ]);
    const completed = result.status === "completed";
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-reviewed-multi-application-mission-v0"
      || !allowedStatuses.has(result.status)
      || !Number.isInteger(evidence.providerCallCountMinimum)
      || evidence.providerCallCountMinimum < 0
      || evidence.providerCallCountMinimum > 3
      || !Number.isInteger(evidence.actionCountMinimum)
      || evidence.actionCountMinimum < 0
      || evidence.actionCountMinimum > 3
      || !Number.isInteger(evidence.lifecycleActionCountMinimum)
      || evidence.lifecycleActionCountMinimum < 0
      || evidence.lifecycleActionCountMinimum > 2
      || !Number.isInteger(evidence.fixedActionCountMinimum)
      || evidence.fixedActionCountMinimum < 0
      || evidence.fixedActionCountMinimum > 5
      || governance.maximumApplications !== 2
      || JSON.stringify(governance.fixedApplicationOrder)
        !== JSON.stringify(["fixed_browser_form", "fixed_native_intake"])
      || governance.continuationAfterVerifiedBrowserOnly !== true
      || governance.maximumProviderCalls !== 3
      || governance.maximumActions !== 3
      || governance.maximumLifecycleActions !== 2
      || governance.maximumFixedActions !== 5
      || governance.automaticRepeat !== false
      || governance.retry !== false
      || governance.arbitraryApplicationSelection !== false
      || governance.arbitraryProcessLaunch !== false
      || governance.arbitraryWindowControl !== false
      || governance.arbitraryKeyboardInput !== false
      || governance.enterKeyInput !== false
      || governance.hotkeyInput !== false
      || governance.inputTextExposed !== false
      || governance.inputTextPersisted !== false
      || governance.taskMutated !== false
      || governance.automaticTaskCompletion !== false
      || governance.createsTask !== false
      || governance.createsApproval !== false
      || governance.mutatesHost !== false
      || response.invocation?.capability?.id
        !== "act.ai.workspace.reviewed_multi_application_mission"
      || response.invocation?.authorization?.policyId
        !== "ai-workspace-explicit-reviewed-multi-application-mission"
      || response.invocation?.authorization?.approved !== true
      || summary.kind !== "ai.workspace.reviewed_multi_application_mission"
      || summary.status !== result.status
      || summary.inputTextPersisted !== false
      || summary.arbitraryApplicationSelection !== false
      || JSON.stringify(response).includes('"expectedInputText"')
      || JSON.stringify(response).includes('"inputText"')) {
      throw new Error("Reviewed multi-application mission result was invalid.");
    }
    if (completed) {
      const browser = applications[0] ?? {};
      const native = applications[1] ?? {};
      if (applications.length !== 2
        || browser.applicationId !== "fixed_browser_form"
        || browser.registry !== "nixsoma-ai-workspace-semantic-form-workflow-v0"
        || browser.status !== "completed"
        || browser.stepCount !== 2
        || JSON.stringify(browser.actionSequence) !== JSON.stringify(["type_item", "click_item"])
        || browser.providerCallCount !== 2
        || browser.actionCount !== 2
        || browser.lifecycleActionCount !== 0
        || browser.continuationAudit !== true
        || browser.completionAudit !== true
        || browser.exactInputMatched !== true
        || browser.verified !== true
        || browser.outcomeUnknown !== false
        || native.applicationId !== "fixed_native_intake"
        || native.registry !== "nixsoma-ai-workspace-native-intake-workflow-v0"
        || native.status !== "completed"
        || native.stepCount !== 1
        || JSON.stringify(native.actionSequence) !== JSON.stringify(["type_text"])
        || native.providerCallCount !== 1
        || native.actionCount !== 1
        || native.lifecycleActionCount !== 2
        || native.completionAudit !== true
        || native.exactInputMatched !== true
        || native.lifecycleStartVerified !== true
        || native.lifecycleStopVerified !== true
        || native.verified !== true
        || native.outcomeUnknown !== false
        || evidence.taskId !== taskId
        || evidence.inputEvidence?.registry !== "openclaw-write-only-input-evidence-v0"
        || !Number.isInteger(evidence.inputEvidence?.charCount)
        || evidence.inputEvidence.charCount < 1
        || evidence.inputEvidence.charCount > 32
        || evidence.inputEvidence.maxChars !== 32
        || evidence.inputEvidence.textExposed !== false
        || evidence.inputEvidence.persisted !== false
        || evidence.applicationCount !== 2
        || evidence.providerCallCount !== 3
        || evidence.actionCount !== 3
        || evidence.lifecycleActionCount !== 2
        || evidence.fixedActionCount !== 5
        || evidence.continuationAudit !== true
        || evidence.missionCompletionAudit !== true
        || evidence.outcomeUnknown !== false
        || governance.continuedToNativeApplication !== true
        || governance.sameReviewedTaskAcrossApplications !== true
        || governance.sameExactObjectiveInputAcrossApplications !== true
        || summary.applicationCount !== 2
        || summary.missionCompletionAudit !== true) {
        throw new Error("Completed reviewed multi-application mission evidence was invalid.");
      }
    }

    aiWorkspaceReviewedMultiApplicationMissionStatus.textContent = completed
      ? "browser + native complete"
      : result.status.replaceAll("_", " ");
    setControlMessage("Reviewed multi-application mission: "
      + aiWorkspaceReviewedMultiApplicationMissionStatus.textContent + ".");
    await refreshActionState();
    await refreshRuntime();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceReviewedMultiApplicationMissionInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceReviewedMultiApplicationMissionButton.addEventListener("click", () => {
  runAiWorkspaceReviewedMultiApplicationMission().catch((error) => {
    aiWorkspaceReviewedMultiApplicationMissionStatus.textContent = "unavailable";
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
