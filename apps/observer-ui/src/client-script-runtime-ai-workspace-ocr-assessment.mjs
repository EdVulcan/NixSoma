export const observerClientRuntimeAiWorkspaceOcrAssessmentScript = `let aiWorkspaceOcrAssessmentInFlight = false;
let aiWorkspaceOcrAssessmentTaskId = null;

function clearAiWorkspaceOcrAssessment(reason = "not assessed") {
  aiWorkspaceOcrAssessmentTaskId = null;
  aiWorkspaceOcrAssessmentStatus.textContent = reason;
}

async function assessAiWorkspaceWithOcr() {
  if (aiWorkspaceLocalOcrInFlight
    || aiWorkspaceOcrAssessmentInFlight
    || aiWorkspaceOcrClickInFlight
    || aiWorkspaceOcrTypeInFlight
    || aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight) return;
  aiWorkspaceOcrAssessmentInFlight = true;
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
    aiWorkspaceOcrAssessmentStatus.textContent = "assessing";
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "sense.ai.workspace.ocr_assessment",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const assessment = result.assessment ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const assessed = result.status === "assessed";
    const hash = (value) => /^[a-f0-9]{64}$/u.test(value ?? "");
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-ocr-assessment-v0"
      || !["assessed", "local_fallback"].includes(result.status)
      || !new Set(["complete", "incomplete", "blocked", "unknown"]).has(assessment.outcome)
      || (assessment.confidence !== null
        && (typeof assessment.confidence !== "number"
          || assessment.confidence < 0
          || assessment.confidence > 1))
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 0
      || governance.actionExecuted !== false
      || governance.taskMutated !== false
      || governance.automaticContinuation !== false
      || governance.rawTaskGoalProviderEgress !== false
      || governance.ocrTextPersistedLocally !== false
      || governance.pixelsProviderEgress !== false
      || governance.renderedTextMayContainVisibleUrlsOrValues !== true
      || governance.providerRetentionControlledExternally !== true
      || governance.mutatesHost !== false
      || Object.prototype.hasOwnProperty.call(result, "items")
      || (assessed && (governance.providerCalled !== true
        || governance.localOcrBound !== true
        || governance.localOcrRevalidated !== true
        || governance.currentActiveSurfaceBound !== true
        || governance.taskObjectiveBound !== true
        || governance.taskObjectiveProviderEgress !== true
        || governance.ocrTextProviderEgress !== true
        || evidence.taskId !== taskId
        || !hash(evidence.objectiveContentHash)
        || !hash(evidence.taskVersionHash)
        || !hash(evidence.contextContentHash)
        || !hash(evidence.requestContentHash)
        || !hash(evidence.responseContentHash)
        || !hash(evidence.frameContentHash)
        || !hash(evidence.ocrSceneContentHash)
        || !hash(evidence.ocrBindingHash)
        || !hash(evidence.verificationFrameContentHash)
        || !hash(evidence.verificationOcrSceneContentHash)
        || !Number.isInteger(evidence.frameSequence)
        || !Number.isInteger(evidence.verificationFrameSequence)
        || evidence.verificationFrameSequence <= evidence.frameSequence
        || !Number.isInteger(evidence.ocrItemCount)
        || evidence.ocrItemCount < 1
        || evidence.ocrItemCount > 24
        || !Number.isInteger(evidence.ocrCharacterCount)
        || evidence.ocrCharacterCount < 1
        || evidence.ocrCharacterCount > 1200
        || evidence.completionAudit !== true))) {
      throw new Error("AI workspace OCR assessment result was invalid.");
    }
    aiWorkspaceOcrAssessmentTaskId = taskId;
    aiWorkspaceOcrAssessmentStatus.textContent = assessment.outcome
      + (typeof assessment.confidence === "number"
        ? " " + Math.round(assessment.confidence * 100) + "%"
        : "");
    setControlMessage("OCR assessment: " + assessment.outcome + ".");
  } finally {
    aiWorkspaceOcrAssessmentInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

ocrAssessAiWorkspaceButton.addEventListener("click", () => {
  assessAiWorkspaceWithOcr().catch((error) => {
    clearAiWorkspaceOcrAssessment("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
