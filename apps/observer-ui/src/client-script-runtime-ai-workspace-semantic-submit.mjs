export const observerClientRuntimeAiWorkspaceSemanticSubmitScript = `let aiWorkspaceSemanticSubmitInFlight = false;
let aiWorkspaceSemanticTypeReceipt = null;

function validSemanticSubmitHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function clearAiWorkspaceSemanticSubmit(reason = "type receipt required") {
  aiWorkspaceSemanticTypeReceipt = null;
  aiWorkspaceSemanticSubmitStatus.textContent = reason;
  runAiWorkspaceSemanticSubmitButton.disabled = true;
}

function captureAiWorkspaceSemanticTypeReceipt(response, result, taskId) {
  const summary = response.invocation?.summary ?? {};
  const evidence = result.evidence ?? {};
  const inputEvidence = result.action?.inputEvidence ?? evidence.inputEvidence;
  const valid = result.status === "executed"
    && result.decision?.actionId === "type_item"
    && result.governance?.actionExecuted === true
    && result.governance?.providerGeneratedInput === true
    && result.governance?.inputTextPersisted === false
    && evidence.postActionVerified === true
    && evidence.completionAudit === true
    && summary.completionAudit === true
    && typeof response.invocation?.id === "string"
    && response.invocation.id.length > 0
    && summary.taskId === taskId
    && validSemanticSubmitHash(summary.objectiveContentHash)
    && validSemanticSubmitHash(summary.taskVersionHash)
    && validSemanticSubmitHash(summary.responseContentHash)
    && validSemanticSubmitHash(summary.sceneContentHash)
    && inputEvidence?.textExposed === false
    && inputEvidence?.persisted === false
    && Number.isInteger(inputEvidence?.charCount)
    && inputEvidence.charCount > 0;
  if (!valid) {
    clearAiWorkspaceSemanticSubmit();
    return;
  }
  aiWorkspaceSemanticTypeReceipt = {
    taskId,
    typeInvocationId: response.invocation.id,
    objectiveContentHash: summary.objectiveContentHash,
    taskVersionHash: summary.taskVersionHash,
    responseContentHash: summary.responseContentHash,
    sceneContentHash: summary.sceneContentHash,
  };
  aiWorkspaceSemanticSubmitStatus.textContent = "ready";
}

async function runAiWorkspaceSemanticSubmit() {
  if (aiWorkspaceSemanticSubmitInFlight) return;
  const receipt = aiWorkspaceSemanticTypeReceipt;
  const taskId = currentAiWorkspaceTaskId();
  if (!receipt || receipt.taskId !== taskId) {
    clearAiWorkspaceSemanticSubmit();
    throw new Error("A current verified semantic type receipt is required.");
  }
  aiWorkspaceSemanticSubmitInFlight = true;
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    await refreshRuntime();
    if (!currentAiSurfaceScrollBinding() || currentAiWorkspaceTaskId() !== taskId) {
      throw new Error("A fresh active AI workspace projection is required.");
    }
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.semantic_submit",
        taskId,
        params: {
          confirm: true,
          typeInvocationId: receipt.typeInvocationId,
          objectiveContentHash: receipt.objectiveContentHash,
          taskVersionHash: receipt.taskVersionHash,
          responseContentHash: receipt.responseContentHash,
          sceneContentHash: receipt.sceneContentHash,
        },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    const actionId = result.action?.actionId ?? "no_op";
    const executed = governance.actionExecuted === true;
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-semantic-submit-v0"
      || evidence.taskId !== taskId
      || evidence.typeInvocationId !== receipt.typeInvocationId
      || evidence.priorTypeReceiptBound !== true
      || evidence.authorizationAudit !== true
      || !["no_op", "click_item"].includes(actionId)
      || governance.maximumProviderCalls !== 1
      || governance.maximumActions !== 1
      || governance.priorTypeReceiptRequired !== true
      || governance.automaticRepeat !== false
      || governance.keyboardInput !== false
      || governance.inputTextPersisted !== false
      || governance.taskMutated !== false
      || governance.automaticTaskCompletion !== false
      || governance.mutatesHost !== false
      || JSON.stringify(result).includes('"inputText"')
      || (executed && (actionId !== "click_item"
        || governance.semanticSubmitTargetBound !== true
        || result.action?.postActionVerified !== true
        || evidence.completionAudit !== true))) {
      throw new Error("AI workspace semantic submit result was invalid.");
    }
    aiWorkspaceSemanticSubmitStatus.textContent = actionId + " (" + result.status + ")";
    setControlMessage("Semantic submit: " + actionId + " (" + result.status + ").");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceSemanticTypeReceipt = null;
    aiWorkspaceSemanticSubmitInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceSemanticSubmitButton.addEventListener("click", () => {
  runAiWorkspaceSemanticSubmit().catch((error) => {
    clearAiWorkspaceSemanticSubmit("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
