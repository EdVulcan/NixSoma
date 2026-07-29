export const observerClientRuntimeAiWorkspaceOcrClickScript = `let aiWorkspaceOcrClickInFlight = false;
let aiWorkspaceOcrClickTaskId = null;

function clearAiWorkspaceOcrClick(reason = "not run") {
  aiWorkspaceOcrClickTaskId = null;
  aiWorkspaceOcrClickStatus.textContent = reason;
}

async function clickAiWorkspaceOcrItem() {
  if (aiWorkspaceLocalOcrInFlight
    || aiWorkspaceOcrAssessmentInFlight
    || aiWorkspaceOcrClickInFlight
    || aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight) return;
  aiWorkspaceOcrClickInFlight = true;
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
    aiWorkspaceOcrClickStatus.textContent = "running";
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.ocr_click",
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
      || result.registry !== "nixsoma-ai-workspace-ocr-click-v0"
      || !new Set(["executed", "no_action", "local_fallback"]).has(result.status)
      || !new Set(["click_item", "no_op"]).has(decision.actionId)
      || (decision.itemOrdinal !== null
        && (!Number.isInteger(decision.itemOrdinal)
          || decision.itemOrdinal < 1
          || decision.itemOrdinal > 24))
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 1
      || governance.taskMutated !== false
      || governance.automaticContinuation !== false
      || governance.rawTaskGoalProviderEgress !== false
      || governance.ocrTextPersistedLocally !== false
      || governance.pixelsProviderEgress !== false
      || governance.arbitraryPointerInput !== false
      || governance.providerRetentionControlledExternally !== true
      || governance.mutatesHost !== false
      || Object.prototype.hasOwnProperty.call(result, "items")
      || Object.prototype.hasOwnProperty.call(result, "reason")
      || (executed && (decision.actionId !== "click_item"
        || action.actionId !== "click_item"
        || action.executed !== true
        || !Number.isInteger(action.itemOrdinal)
        || action.itemOrdinal !== decision.itemOrdinal
        || governance.providerCalled !== true
        || governance.localOcrBound !== true
        || governance.localOcrRevalidated !== true
        || governance.currentFrameBound !== true
        || governance.currentActiveSurfaceBound !== true
        || governance.ocrItemOrdinalBound !== true
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
      throw new Error("AI workspace OCR click result was invalid.");
    }
    aiWorkspaceOcrClickTaskId = taskId;
    aiWorkspaceOcrClickStatus.textContent = executed
      ? "executed item " + action.itemOrdinal
      : result.status.replace("_", " ");
    clearAiWorkspaceOcrAssessment("workspace changed");
    setControlMessage("OCR click: " + aiWorkspaceOcrClickStatus.textContent + ".");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceOcrClickInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

ocrClickAiWorkspaceButton.addEventListener("click", () => {
  clickAiWorkspaceOcrItem().catch((error) => {
    clearAiWorkspaceOcrClick("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
