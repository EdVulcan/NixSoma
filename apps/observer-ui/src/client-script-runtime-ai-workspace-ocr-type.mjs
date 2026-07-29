export const observerClientRuntimeAiWorkspaceOcrTypeScript = `let aiWorkspaceOcrTypeInFlight = false;
let aiWorkspaceOcrTypeTaskId = null;

function clearAiWorkspaceOcrType(reason = "not run") {
  aiWorkspaceOcrTypeTaskId = null;
  aiWorkspaceOcrTypeStatus.textContent = reason;
}

function validOcrTypeInputEvidence(value) {
  return value?.registry === "openclaw-write-only-input-evidence-v0"
    && Number.isInteger(value.charCount)
    && value.charCount >= 0
    && value.charCount <= 32
    && Number.isInteger(value.byteLength)
    && value.byteLength === value.charCount
    && value.maxChars === 32
    && value.truncated === false
    && value.textExposed === false
    && value.persisted === false;
}

async function typeAiWorkspaceOcrObjectiveValue() {
  if (aiWorkspaceLocalOcrInFlight
    || aiWorkspaceOcrAssessmentInFlight
    || aiWorkspaceOcrClickInFlight
    || aiWorkspaceOcrTypeInFlight
    || aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight) return;
  aiWorkspaceOcrTypeInFlight = true;
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
    aiWorkspaceOcrTypeStatus.textContent = "running";
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.ocr_type",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const decision = result.decision ?? {};
    const action = result.action ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const executed = result.status === "executed";
    const hash = (value) => /^[a-f0-9]{64}$/u.test(value ?? "");
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-ocr-type-v0"
      || !new Set(["executed", "no_action", "local_fallback"]).has(result.status)
      || !new Set(["type_text", "no_op"]).has(decision.actionId)
      || !validOcrTypeInputEvidence(decision.inputEvidence)
      || !validOcrTypeInputEvidence(action.inputEvidence)
      || !validOcrTypeInputEvidence(evidence.inputEvidence)
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 1
      || governance.taskMutated !== false
      || governance.automaticContinuation !== false
      || governance.rawTaskGoalProviderEgress !== false
      || governance.ocrTextPersistedLocally !== false
      || governance.pixelsProviderEgress !== false
      || governance.arbitraryKeyboardInput !== false
      || governance.hotkeyInput !== false
      || governance.enterKeyInput !== false
      || governance.inputTextExposed !== false
      || governance.inputTextPersisted !== false
      || governance.providerRetentionControlledExternally !== true
      || governance.mutatesHost !== false
      || JSON.stringify(result).includes('"inputText"')
      || Object.prototype.hasOwnProperty.call(result, "items")
      || Object.prototype.hasOwnProperty.call(result, "reason")
      || (executed && (decision.actionId !== "type_text"
        || action.actionId !== "type_text"
        || action.executed !== true
        || action.inputEvidence.charCount < 1
        || action.inputEvidence.charCount !== evidence.inputEvidence.charCount
        || governance.providerCalled !== true
        || governance.localOcrBound !== true
        || governance.localOcrRevalidated !== true
        || governance.currentFrameBound !== true
        || governance.currentActiveSurfaceBound !== true
        || governance.taskObjectiveInputBound !== true
        || governance.providerGeneratedInput !== true
        || governance.keyboardInput !== true
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
        || !hash(evidence.verificationFrameContentHash)
        || !hash(evidence.postActionFrameContentHash)
        || !Number.isInteger(evidence.frameSequence)
        || !Number.isInteger(evidence.verificationFrameSequence)
        || !Number.isInteger(evidence.postActionFrameSequence)
        || evidence.verificationFrameSequence <= evidence.frameSequence
        || evidence.postActionFrameSequence <= evidence.verificationFrameSequence
        || evidence.receiptMatched !== true
        || evidence.frameChanged !== true
        || evidence.postActionVerified !== true
        || evidence.completionAudit !== true))) {
      throw new Error("AI workspace OCR type result was invalid.");
    }
    aiWorkspaceOcrTypeTaskId = taskId;
    aiWorkspaceOcrTypeStatus.textContent = executed
      ? "typed " + action.inputEvidence.charCount
      : result.status.replace("_", " ");
    clearAiWorkspaceOcrAssessment("workspace changed");
    clearAiWorkspaceOcrClick("workspace changed");
    setControlMessage("OCR type: " + aiWorkspaceOcrTypeStatus.textContent + ".");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceOcrTypeInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

ocrTypeAiWorkspaceButton.addEventListener("click", () => {
  typeAiWorkspaceOcrObjectiveValue().catch((error) => {
    clearAiWorkspaceOcrType("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
