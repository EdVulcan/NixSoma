export const observerClientRuntimeAiWorkspaceOcrFocusTypeScript = `let aiWorkspaceOcrFocusTypeInFlight = false;
let aiWorkspaceOcrFocusTypeTaskId = null;

function clearAiWorkspaceOcrFocusType(reason = "not run") {
  aiWorkspaceOcrFocusTypeTaskId = null;
  aiWorkspaceOcrFocusTypeStatus.textContent = reason;
}

function validOcrFocusTypeInputEvidence(value, { allowEmpty = false } = {}) {
  return value?.registry === "openclaw-write-only-input-evidence-v0"
    && Number.isInteger(value.charCount)
    && value.charCount >= (allowEmpty ? 0 : 1)
    && Number.isInteger(value.byteLength)
    && value.byteLength >= (allowEmpty ? 0 : 1)
    && value.maxChars === 32
    && value.truncated === false
    && value.textExposed === false
    && value.persisted === false;
}

async function focusAndTypeAiWorkspaceOcrObjective() {
  if (aiWorkspaceOcrFocusTypeInFlight) return;
  const taskId = currentAiWorkspaceTaskId();
  if (!taskId) {
    clearAiWorkspaceOcrFocusType("task required");
    return;
  }
  aiWorkspaceOcrFocusTypeInFlight = true;
  clearAiWorkspaceOcrFocusType("running");
  updateAiSurfaceScrollControls();
  try {
    const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.ocr_focus_type",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const decision = result.decision ?? {};
    const actions = Array.isArray(result.actions) ? result.actions : [];
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const executed = result.status === "executed";
    const noAction = result.status === "no_action";
    const fallback = result.status === "local_fallback";
    const focusAction = actions.find((action) => action?.actionId === "focus_item");
    const typeAction = actions.find((action) => action?.actionId === "type_text");
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-ocr-focus-type-v0"
      || (!executed && !noAction && !fallback)
      || !new Set(["focus_and_type", "no_op"]).has(decision.actionId)
      || !Array.isArray(result.actions)
      || actions.length > 2
      || evidence.taskId !== taskId
      || !Number.isInteger(evidence.actionCount)
      || evidence.actionCount < 0
      || evidence.actionCount > 2
      || evidence.actionCount !== actions.filter((action) => action?.executed === true).length
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 2
      || governance.fixedActionSequence !== true
      || governance.taskMutated !== false
      || governance.automaticContinuation !== false
      || governance.automaticRepeat !== false
      || governance.hotkeyInput !== false
      || governance.enterKeyInput !== false
      || governance.inputTextExposed !== false
      || governance.inputTextPersisted !== false
      || governance.ocrTextPersistedLocally !== false
      || governance.pixelsProviderEgress !== false
      || governance.arbitraryPointerInput !== false
      || governance.arbitraryKeyboardInput !== false
      || governance.providerRetentionControlledExternally !== true
      || governance.mutatesHost !== false
      || JSON.stringify(result).includes('"inputText"')
      || Object.prototype.hasOwnProperty.call(result, "items")
      || Object.prototype.hasOwnProperty.call(result, "reason")
      || (executed && (decision.actionId !== "focus_and_type"
        || !Number.isInteger(decision.itemOrdinal)
        || !validOcrFocusTypeInputEvidence(decision.inputEvidence)
        || actions.length !== 2
        || focusAction?.index !== 1
        || focusAction.itemOrdinal !== decision.itemOrdinal
        || focusAction.executed !== true
        || typeAction?.index !== 2
        || typeAction.executed !== true
        || !validOcrFocusTypeInputEvidence(typeAction.inputEvidence)
        || typeAction.inputEvidence.charCount !== decision.inputEvidence.charCount
        || evidence.actionCount !== 2
        || evidence.focusActionExecuted !== true
        || evidence.focusActionVerified !== true
        || evidence.typeActionExecuted !== true
        || evidence.postActionVerified !== true
        || evidence.completionAudit !== true
        || governance.providerCalled !== true
        || governance.localOcrBound !== true
        || governance.localOcrRevalidated !== true
        || governance.focusRevalidated !== true
        || governance.currentFrameBound !== true
        || governance.currentActiveSurfaceBound !== true
        || governance.ocrItemOrdinalBound !== true
        || governance.taskObjectiveInputBound !== true
        || governance.providerGeneratedInput !== true
        || governance.pointerInput !== true
        || governance.keyboardInput !== true
        || governance.taskObjectiveBound !== true
        || governance.taskObjectiveProviderEgress !== true
        || governance.ocrTextProviderEgress !== true))) {
      throw new Error("AI workspace OCR focus type result was invalid.");
    }
    if ((noAction || (fallback && evidence.actionCount === 0))
      && !validOcrFocusTypeInputEvidence(decision.inputEvidence, { allowEmpty: true })) {
      throw new Error("AI workspace OCR focus type no-action evidence was invalid.");
    }
    aiWorkspaceOcrFocusTypeTaskId = taskId;
    aiWorkspaceOcrFocusTypeStatus.textContent = executed
      ? "focused + typed " + decision.inputEvidence.charCount
      : fallback ? "stopped " + evidence.actionCount + "/2" : "no action";
    clearAiWorkspaceOcrAssessment("workspace changed");
    clearAiWorkspaceOcrClick("workspace changed");
    clearAiWorkspaceOcrType("workspace changed");
    setControlMessage("OCR focus + type: " + aiWorkspaceOcrFocusTypeStatus.textContent + ".");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceOcrFocusTypeInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

ocrFocusTypeAiWorkspaceButton.addEventListener("click", () => {
  focusAndTypeAiWorkspaceOcrObjective().catch((error) => {
    clearAiWorkspaceOcrFocusType("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
