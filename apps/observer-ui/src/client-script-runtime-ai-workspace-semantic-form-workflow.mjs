export const observerClientRuntimeAiWorkspaceSemanticFormWorkflowScript = `async function runAiWorkspaceSemanticFormWorkflow() {
  if (aiWorkspaceSemanticFormWorkflowInFlight
    || aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceSemanticSubmitInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight) return;
  aiWorkspaceSemanticFormWorkflowInFlight = true;
  aiWorkspaceSemanticFormWorkflowStatus.textContent = "running";
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    await refreshRuntime();
    if (!currentAiSurfaceActionBinding()) {
      throw new Error("A fresh active AI workspace projection is required.");
    }
    const taskId = currentAiWorkspaceTaskId();
    if (!taskId) throw new Error("A current operator-reviewed task is required.");
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.semantic_form_workflow",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const summary = response.summary ?? response.invocation?.summary ?? {};
    const steps = Array.isArray(result.steps) ? result.steps : [];
    const completed = result.status === "completed";
    const allowedStatuses = new Set([
      "completed",
      "completed_audit_unavailable",
      "stopped_after_type",
      "stopped_after_submit",
      "type_step_outcome_unknown",
      "submit_step_outcome_unknown",
      "runtime_unavailable",
      "local_fallback",
    ]);
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-semantic-form-workflow-v0"
      || !allowedStatuses.has(result.status)
      || !Number.isInteger(evidence.providerCallCountMinimum)
      || evidence.providerCallCountMinimum < 0
      || evidence.providerCallCountMinimum > 2
      || !Number.isInteger(evidence.actionCountMinimum)
      || evidence.actionCountMinimum < 0
      || evidence.actionCountMinimum > 2
      || governance.maximumProviderCalls !== 2
      || governance.maximumActions !== 2
      || governance.continuationAfterVerifiedTypeOnly !== true
      || governance.terminalAfterSubmitStep !== true
      || governance.automaticRepeat !== false
      || governance.inputTextExposed !== false
      || governance.inputTextPersisted !== false
      || governance.taskMutated !== false
      || governance.automaticTaskCompletion !== false
      || governance.createsTask !== false
      || governance.createsApproval !== false
      || governance.mutatesHost !== false
      || response.invocation?.capability?.id !== "act.ai.workspace.semantic_form_workflow"
      || response.invocation?.authorization?.policyId !== "ai-workspace-explicit-semantic-form-workflow"
      || response.invocation?.authorization?.approved !== true
      || summary.kind !== "ai.workspace.semantic_form_workflow"
      || summary.status !== result.status
      || summary.taskId !== evidence.taskId
      || summary.continuationAfterVerifiedTypeOnly !== true
      || summary.automaticRepeat !== false
      || summary.inputTextExposed !== false
      || summary.inputTextPersisted !== false
      || summary.automaticTaskCompletion !== false
      || JSON.stringify(response).includes('"inputText"')) {
      throw new Error("AI workspace semantic form workflow result was invalid.");
    }
    if (completed && (steps.length !== 2
      || steps[0]?.actionId !== "type_item"
      || steps[1]?.actionId !== "click_item"
      || steps.some((step) => step.providerCalled !== true
        || step.actionExecuted !== true
        || step.postActionVerified !== true
        || step.completionAudit !== true)
      || steps[0]?.inputEvidence?.registry !== "openclaw-write-only-input-evidence-v0"
      || !Number.isInteger(steps[0]?.inputEvidence?.charCount)
      || steps[0].inputEvidence.charCount < 1
      || steps[0]?.inputEvidence?.textExposed !== false
      || steps[0]?.inputEvidence?.persisted !== false
      || steps[1]?.semanticSubmitTargetBound !== true
      || evidence.providerCallCount !== 2
      || evidence.actionCount !== 2
      || evidence.continuationAudit !== true
      || evidence.workflowCompletionAudit !== true
      || evidence.outcomeUnknown !== false
      || governance.continuedAfterVerifiedType !== true
      || governance.boundedAutomaticContinuation !== true)) {
      throw new Error("Completed semantic form workflow evidence was invalid.");
    }

    aiWorkspaceSemanticFormWorkflowStatus.textContent = completed
      ? "typed + submitted"
      : result.status.replaceAll("_", " ");
    setControlMessage("AI semantic form workflow: "
      + aiWorkspaceSemanticFormWorkflowStatus.textContent + ".");
    await refreshActionState();
    await refreshRuntime();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceSemanticFormWorkflowInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceSemanticFormWorkflowButton.addEventListener("click", () => {
  runAiWorkspaceSemanticFormWorkflow().catch((error) => {
    aiWorkspaceSemanticFormWorkflowStatus.textContent = "unavailable";
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
