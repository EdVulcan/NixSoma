export const observerClientRuntimeAiWorkspaceReviewedCycleScript = `function validReviewedCycleHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

async function runAiWorkspaceReviewedCycle() {
  if (aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight) return;
  aiWorkspaceReviewedCycleInFlight = true;
  clearAiWorkspaceAssessment("cycle running");
  aiWorkspaceReviewedCycleStatus.textContent = "running";
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    await refreshRuntime();
    if (!currentAiSurfaceScrollBinding()) {
      throw new Error("A fresh active AI workspace projection is required.");
    }
    const taskId = currentAiWorkspaceTaskId();
    if (!taskId) throw new Error("A current operator-reviewed task is required.");
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.reviewed_cycle",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const run = result.run ?? {};
    const runEvidence = run.evidence ?? {};
    const assessmentResult = result.assessment ?? {};
    const assessment = assessmentResult.assessment ?? {};
    const assessmentEvidence = assessmentResult.evidence ?? {};
    const assessmentGovernance = assessmentResult.governance ?? {};
    const invocation = response.invocation ?? {};
    const summary = invocation.summary ?? {};
    const receiptAssessment = summary.assessment ?? {};
    const knownCounts = evidence.outcomeUnknown === false
      && Number.isInteger(evidence.providerCallCount)
      && evidence.providerCallCount >= 1
      && evidence.providerCallCount <= 3
      && Number.isInteger(evidence.actionCount)
      && evidence.actionCount >= 0
      && evidence.actionCount <= 2;
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-reviewed-cycle-v0"
      || !["assessed", "assessment_fallback", "stopped_after_run"].includes(result.status)
      || !Number.isInteger(evidence.providerCallCountMinimum)
      || evidence.providerCallCountMinimum < 0
      || evidence.providerCallCountMinimum > 3
      || !Number.isInteger(evidence.actionCountMinimum)
      || evidence.actionCountMinimum < 0
      || evidence.actionCountMinimum > 2
      || (!knownCounts && evidence.outcomeUnknown !== true)
      || governance.maximumProviderCalls !== 3
      || governance.maximumActions !== 2
      || governance.taskMutated !== false
      || governance.automaticTaskCompletion !== false
      || governance.requiresOperatorAcceptance !== true
      || governance.providerTriggeredCompletion !== false
      || governance.createsTask !== false
      || governance.createsApproval !== false
      || governance.mutatesHost !== false
      || invocation.capability?.id !== "act.ai.workspace.reviewed_cycle"
      || invocation.authorization?.policyId !== "ai-workspace-explicit-reviewed-cycle"
      || invocation.authorization?.approved !== true
      || summary.kind !== "ai.workspace.reviewed_cycle"
      || summary.status !== result.status
      || summary.taskId !== evidence.taskId
      || summary.objectiveContentHash !== evidence.objectiveContentHash
      || summary.taskVersionHash !== evidence.taskVersionHash
      || summary.automaticTaskCompletion !== false
      || summary.requiresOperatorAcceptance !== true
      || summary.providerTriggeredCompletion !== false) {
      throw new Error("AI workspace reviewed-cycle result was invalid.");
    }

    const assessed = result.status === "assessed";
    const allowedOutcomes = new Set(["complete", "incomplete", "blocked", "unknown"]);
    if (assessed && (run.registry !== "nixsoma-ai-workspace-bounded-run-v0"
      || runEvidence.runCompletionAudit !== true
      || runEvidence.outcomeUnknown !== false
      || assessmentResult.registry !== "nixsoma-ai-workspace-task-assessment-v0"
      || assessmentResult.status !== "assessed"
      || !allowedOutcomes.has(assessment.outcome)
      || typeof assessment.confidence !== "number"
      || assessment.confidence < 0
      || assessment.confidence > 1
      || assessmentEvidence.taskId !== taskId
      || assessmentEvidence.taskId !== evidence.taskId
      || assessmentEvidence.objectiveContentHash !== evidence.objectiveContentHash
      || assessmentEvidence.taskVersionHash !== evidence.taskVersionHash
      || assessmentEvidence.completionAudit !== true
      || assessmentGovernance.providerCalled !== true
      || assessmentGovernance.maximumActions !== 0
      || assessmentGovernance.actionExecuted !== false
      || assessmentGovernance.taskMutated !== false
      || assessmentGovernance.automaticContinuation !== false
      || evidence.runCompletionAudit !== true
      || evidence.assessmentContinuationAudit !== true
      || evidence.assessmentCompletionAudit !== true
      || evidence.cycleCompletionAudit !== true
      || summary.runCompletionAudit !== true
      || summary.assessmentContinuationAudit !== true
      || summary.assessmentCompletionAudit !== true
      || summary.cycleCompletionAudit !== true
      || receiptAssessment.status !== "assessed"
      || receiptAssessment.outcome !== assessment.outcome
      || receiptAssessment.confidence !== assessment.confidence
      || receiptAssessment.taskId !== taskId
      || receiptAssessment.objectiveContentHash !== evidence.objectiveContentHash
      || receiptAssessment.taskVersionHash !== evidence.taskVersionHash
      || receiptAssessment.responseContentHash !== assessmentEvidence.responseContentHash
      || receiptAssessment.sceneContentHash !== assessmentEvidence.sceneContentHash
      || receiptAssessment.completionAudit !== true
      || receiptAssessment.providerCalled !== true
      || receiptAssessment.maximumActions !== 0
      || receiptAssessment.actionExecuted !== false
      || receiptAssessment.taskMutated !== false
      || receiptAssessment.automaticContinuation !== false)) {
      throw new Error("AI workspace reviewed-cycle assessment receipt was invalid.");
    }

    const completeReceipt = assessed
      && assessment.outcome === "complete"
      && evidence.assessmentReceiptEligible === true
      && summary.assessmentReceiptEligible === true
      && typeof invocation.id === "string"
      && invocation.id.length > 0
      && invocation.id.length <= 200
      && [
        receiptAssessment.objectiveContentHash,
        receiptAssessment.taskVersionHash,
        receiptAssessment.responseContentHash,
        receiptAssessment.sceneContentHash,
      ].every(validReviewedCycleHash);
    aiWorkspaceAssessmentTaskId = taskId;
    aiWorkspaceAssessmentReceipt = completeReceipt
      ? {
          taskId,
          assessmentInvocationId: invocation.id,
          objectiveContentHash: receiptAssessment.objectiveContentHash,
          taskVersionHash: receiptAssessment.taskVersionHash,
          responseContentHash: receiptAssessment.responseContentHash,
          sceneContentHash: receiptAssessment.sceneContentHash,
        }
      : null;
    const confidence = typeof assessment.confidence === "number"
      ? " " + Math.round(assessment.confidence * 100) + "%"
      : "";
    const outcome = assessed ? assessment.outcome : result.status;
    aiWorkspaceReviewedCycleStatus.textContent = outcome + confidence;
    aiWorkspaceAssessmentStatus.textContent = assessed
      ? assessment.outcome + confidence
      : "not assessed";
    setControlMessage("AI reviewed cycle: " + outcome + confidence + ".");
    await refreshActionState();
    await refreshRuntime();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceReviewedCycleInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceReviewedCycleButton.addEventListener("click", () => {
  runAiWorkspaceReviewedCycle().catch((error) => {
    aiWorkspaceReviewedCycleStatus.textContent = "unavailable";
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
