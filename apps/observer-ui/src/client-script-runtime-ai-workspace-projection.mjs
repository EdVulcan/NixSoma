export const observerClientRuntimeAiWorkspaceProjectionScript = `const AI_WORKSPACE_PROJECTION_INTERVAL_MS = 5000;
let aiWorkspaceProjectionMode = "browser";
let aiWorkspaceProjectionRequest = null;
let aiWorkspaceProjectionBinding = null;
let aiWorkspaceOperatorClickInFlight = false;
let aiWorkspaceOperatorTypeInFlight = false;
let aiWorkspaceLocalOcrInFlight = false;
let aiWorkspaceSingleStepInFlight = false;
let aiWorkspaceBoundedRunInFlight = false;
let aiWorkspaceReviewedCycleInFlight = false;
let aiWorkspaceAssessmentInFlight = false;
let aiWorkspaceAssessmentAcceptanceInFlight = false;
let aiWorkspaceAssessmentTaskId = null;
let aiWorkspaceAssessmentReceipt = null;

function currentAiWorkspaceTask() {
  if (taskHistoryFocus === "selected-task") {
    const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
    const selectedTask = recentTasksState.find((task) => task?.id === taskId)
      ?? (latestHistoryTask?.id === taskId ? latestHistoryTask : null);
    if (selectedTask) return selectedTask;
  }
  return currentTaskState;
}

function currentAiWorkspaceTaskId() {
  const task = currentAiWorkspaceTask();
  const binding = task?.workView?.trustedBinding ?? {};
  const policyDecision = task?.policy?.decision?.decision;
  const eligible = ["queued", "running"].includes(task?.status)
    && ["allow", "audit_only"].includes(policyDecision)
    && binding.registry === "openclaw-native-engineering-work-view-bind-v0"
    && binding.mode === "operator_reviewed"
    && binding.authorityStatus === "authoritative"
    && binding.leaseMatched === true
    && task.workView?.workViewId === latestWorkViewState?.workViewId;
  return eligible ? task.id : null;
}

function currentAiSurfaceActionBinding() {
  const graphicalSession = latestWorkViewState?.aiGraphicalSession ?? {};
  const inventory = graphicalSession.surfaceInventory ?? {};
  const activeSurface = Array.isArray(inventory.surfaces)
    ? inventory.surfaces.find((surface) => surface.activated === true)
    : null;
  const capturedAtMs = Date.parse(aiWorkspaceProjectionBinding?.capturedAt ?? "");
  const frameFresh = Number.isFinite(capturedAtMs)
    && Date.now() - capturedAtMs <= 2000;
  if (aiWorkspaceProjectionMode !== "workspace"
    || !operatorSession?.authenticated
    || document.visibilityState !== "visible"
    || !frameFresh
    || inventory.available !== true
    || !Number.isInteger(inventory.sequence)
    || inventory.sequence < 1
    || !activeSurface) return null;
  return {
    surfaceId: activeSurface.surfaceId,
    inventorySequence: inventory.sequence,
    compositorFrame: { ...aiWorkspaceProjectionBinding },
  };
}

function currentAiSurfaceScrollBinding() {
  return currentAiSurfaceActionBinding();
}

function updateAiSurfaceScrollControls() {
  const enabled = currentAiSurfaceActionBinding() !== null;
  const taskId = currentAiWorkspaceTaskId();
  if (aiWorkspaceAssessmentTaskId && aiWorkspaceAssessmentTaskId !== taskId) {
    clearAiWorkspaceAssessment();
  }
  if (aiWorkspaceOcrAssessmentTaskId && aiWorkspaceOcrAssessmentTaskId !== taskId) {
    clearAiWorkspaceOcrAssessment();
  }
  if (aiWorkspaceOcrClickTaskId && aiWorkspaceOcrClickTaskId !== taskId) {
    clearAiWorkspaceOcrClick();
  }
  if (aiWorkspaceOcrTypeTaskId && aiWorkspaceOcrTypeTaskId !== taskId) {
    clearAiWorkspaceOcrType();
  }
  const aiRunInFlight = aiWorkspaceSingleStepInFlight
    || aiWorkspaceOperatorClickInFlight
    || aiWorkspaceOperatorTypeInFlight
    || aiWorkspaceLocalOcrInFlight
    || aiWorkspaceOcrAssessmentInFlight
    || aiWorkspaceOcrClickInFlight
    || aiWorkspaceOcrTypeInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight;
  scrollAiSurfaceUpButton.disabled = !enabled || aiRunInFlight;
  scrollAiSurfaceDownButton.disabled = !enabled || aiRunInFlight;
  runAiWorkspaceLocalOcrButton.disabled = !enabled || aiRunInFlight;
  ocrAssessAiWorkspaceButton.disabled = !enabled || !taskId || aiRunInFlight;
  ocrClickAiWorkspaceButton.disabled = !enabled || !taskId || aiRunInFlight;
  ocrTypeAiWorkspaceButton.disabled = !enabled || !taskId || aiRunInFlight;
  runAiWorkspaceSingleStepButton.disabled = !enabled || !taskId || aiRunInFlight;
  runAiWorkspaceBoundedRunButton.disabled = !enabled || !taskId || aiRunInFlight;
  runAiWorkspaceReviewedCycleButton.disabled = !enabled || !taskId || aiRunInFlight;
  assessAiWorkspaceButton.disabled = !enabled || !taskId || aiRunInFlight;
  acceptAiWorkspaceAssessmentButton.disabled = aiRunInFlight
    || aiWorkspaceAssessmentReceipt?.taskId !== taskId;
  syncAiWorkspaceOperatorClickControl({ bindingReady: enabled, busy: aiRunInFlight });
  syncAiWorkspaceOperatorTypeControl({ bindingReady: enabled, busy: aiRunInFlight });
}

function clearAiWorkspaceAssessment(reason = "not assessed") {
  aiWorkspaceAssessmentTaskId = null;
  aiWorkspaceAssessmentReceipt = null;
  aiWorkspaceAssessmentStatus.textContent = reason;
  aiWorkspaceReviewedCycleStatus.textContent = reason;
  acceptAiWorkspaceAssessmentButton.disabled = true;
}

function clearAiWorkspaceLocalOcr(reason = "not observed") {
  aiWorkspaceLocalOcrStatus.textContent = reason;
  aiWorkspaceLocalOcrOutput.textContent = reason;
}

function clearAiWorkspaceProjection(reason = "unavailable") {
  aiWorkspaceProjectionBinding = null;
  resetAiWorkspaceOperatorClick(reason);
  resetAiWorkspaceOperatorType(reason);
  aiWorkspaceProjectionFrame.removeAttribute("src");
  aiWorkspaceProjectionFrame.hidden = true;
  aiWorkspaceProjectionStatus.textContent = reason;
  clearAiWorkspaceLocalOcr(reason);
  clearAiWorkspaceOcrAssessment(reason);
  clearAiWorkspaceOcrClick(reason);
  clearAiWorkspaceOcrType(reason);
  updateAiSurfaceScrollControls();
}

async function validatedAiWorkspaceProjection(data) {
  const frame = data?.frame ?? {};
  const boundary = data?.boundary ?? {};
  if (data?.registry !== "nixsoma-ai-output-projection-v0"
    || data.mode !== "operator_transient"
    || frame.registry !== "nixsoma-ai-compositor-frame-v0"
    || frame.available !== true
    || frame.fresh !== true
    || frame.sourceScope !== "ai_owned_nested_output_only"
    || frame.captureApi !== "weston_output_capture_v1"
    || frame.socketName !== "nixsoma-ai-0"
    || frame.mediaType !== "image/png"
    || frame.width !== 1280
    || frame.height !== 720
    || !Number.isInteger(frame.byteLength)
    || frame.byteLength < 1
    || frame.byteLength > 262144
    || typeof frame.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(frame.sha256)
    || frame.dataExposed !== true
    || frame.persisted !== false
    || typeof frame.dataUrl !== "string"
    || !frame.dataUrl.startsWith("data:image/png;base64,")
    || boundary.operatorAuthenticationRequired !== true
    || boundary.serverPersistence !== false
    || boundary.browserMemoryOnly !== true
    || boundary.parentDisplayConnected !== false
    || boundary.desktopWideCapture !== false
    || boundary.inputAuthorityExpanded !== false
    || boundary.rootRequired !== false
    || boundary.hostMutation !== false) {
    throw new Error("invalid_projection_contract");
  }
  const bytes = Uint8Array.from(atob(frame.dataUrl.slice("data:image/png;base64,".length)), (value) => value.charCodeAt(0));
  if (bytes.byteLength !== frame.byteLength
    || bytes.length < 8
    || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    throw new Error("invalid_projection_bytes");
  }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== frame.sha256) throw new Error("invalid_projection_hash");
  return frame;
}

async function refreshAiWorkspaceProjection() {
  if (aiWorkspaceProjectionMode !== "workspace") return;
  if (document.visibilityState !== "visible") {
    clearAiWorkspaceProjection("paused");
    return;
  }
  if (!operatorSession?.authenticated) {
    clearAiWorkspaceProjection("operator auth required");
    return;
  }
  if (aiWorkspaceProjectionRequest) return aiWorkspaceProjectionRequest;
  aiWorkspaceProjectionStatus.textContent = "loading";
  aiWorkspaceProjectionRequest = (async () => {
    try {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/proxy/session-manager/work-view/compositor-frame\`);
      const frame = await validatedAiWorkspaceProjection(data);
      if (aiWorkspaceProjectionMode !== "workspace"
        || document.visibilityState !== "visible"
        || !operatorSession?.authenticated) return;
      aiWorkspaceProjectionBinding = {
        registry: frame.registry,
        socketName: frame.socketName,
        width: frame.width,
        height: frame.height,
        sha256: frame.sha256,
        sequence: frame.sequence,
        capturedAt: frame.capturedAt,
      };
      aiWorkspaceProjectionFrame.src = frame.dataUrl;
      aiWorkspaceProjectionFrame.hidden = false;
      aiWorkspaceProjectionStatus.textContent = \`fresh \${frame.width}x\${frame.height} \${frame.byteLength}B seq=\${frame.sequence}\`;
      updateAiSurfaceScrollControls();
    } catch {
      clearAiWorkspaceProjection("unavailable");
    } finally {
      aiWorkspaceProjectionRequest = null;
    }
  })();
  return aiWorkspaceProjectionRequest;
}

function selectAiWorkspaceProjectionMode(mode) {
  aiWorkspaceProjectionMode = mode === "workspace" ? "workspace" : "browser";
  const workspaceSelected = aiWorkspaceProjectionMode === "workspace";
  browserPagePreviewTab.setAttribute("aria-selected", String(!workspaceSelected));
  aiWorkspacePreviewTab.setAttribute("aria-selected", String(workspaceSelected));
  browserPagePreview.hidden = workspaceSelected;
  aiWorkspacePreview.hidden = !workspaceSelected;
  updateAiSurfaceScrollControls();
  if (workspaceSelected) {
    refreshAiWorkspaceProjection();
  } else {
    clearAiWorkspaceProjection("not selected");
  }
}

browserPagePreviewTab.addEventListener("click", () => selectAiWorkspaceProjectionMode("browser"));
aiWorkspacePreviewTab.addEventListener("click", () => selectAiWorkspaceProjectionMode("workspace"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    clearAiWorkspaceProjection("paused");
  } else if (aiWorkspaceProjectionMode === "workspace") {
    refreshAiWorkspaceProjection();
  }
});
setInterval(() => {
  refreshAiWorkspaceProjection();
}, AI_WORKSPACE_PROJECTION_INTERVAL_MS);

async function runAiSurfaceScroll(direction) {
  if (direction !== "up" && direction !== "down") {
    throw new Error("AI surface scroll direction is invalid.");
  }
  await refreshAiWorkspaceProjection();
  await refreshWorkView();
  const binding = currentAiSurfaceActionBinding();
  if (!binding) throw new Error("A fresh active AI workspace projection is required.");
  const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.screen.pointer_keyboard",
      operation: "mouse.scroll",
      params: { ...binding, direction },
    }),
  });
  const result = response.result ?? {};
  if (response.invoked !== true
    || result.summary?.accepted !== true
    || result.governance?.currentActiveSurfaceBound !== true) {
    throw new Error(result.action?.mediation?.reason ?? "AI surface scroll was rejected.");
  }
  setControlMessage("AI surface #" + binding.surfaceId + " scrolled " + direction + ".");
  await refreshActionState();
  await refreshWorkView();
  await refreshAiWorkspaceProjection();
}

scrollAiSurfaceUpButton.addEventListener("click", () => {
  runAiSurfaceScroll("up").catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});

scrollAiSurfaceDownButton.addEventListener("click", () => {
  runAiSurfaceScroll("down").catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});

async function runAiWorkspaceLocalOcr() {
  if (aiWorkspaceLocalOcrInFlight) return;
  aiWorkspaceLocalOcrInFlight = true;
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    const binding = currentAiSurfaceScrollBinding();
    if (!binding) throw new Error("A fresh active AI workspace projection is required.");
    aiWorkspaceLocalOcrStatus.textContent = "observing";
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "sense.ai.workspace.local_ocr",
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const governance = result.governance ?? {};
    const items = Array.isArray(result.items) ? result.items : [];
    const validBounds = (bounds) => Number.isInteger(bounds?.x)
      && Number.isInteger(bounds?.y)
      && Number.isInteger(bounds?.width)
      && Number.isInteger(bounds?.height)
      && bounds.x >= 0
      && bounds.y >= 0
      && bounds.width > 0
      && bounds.height > 0
      && bounds.x + bounds.width <= 1280
      && bounds.y + bounds.height <= 720;
    const validItem = (item, index) => item?.ordinal === index + 1
      && typeof item.text === "string"
      && item.text.length > 0
      && item.text.length <= 160
      && typeof item.confidence === "number"
      && item.confidence >= 0
      && item.confidence <= 1
      && validBounds(item.bounds);
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-local-ocr-v0"
      || result.status !== "observed"
      || result.frame?.registry !== "nixsoma-ai-compositor-frame-v0"
      || result.frame?.socketName !== "nixsoma-ai-0"
      || result.frame?.width !== 1280
      || result.frame?.height !== 720
      || !/^[a-f0-9]{64}$/u.test(result.frame?.sha256 ?? "")
      || !/^[a-f0-9]{64}$/u.test(result.sceneContentSha256 ?? "")
      || result.surface?.surfaceId !== binding.surfaceId
      || result.inventorySequence !== binding.inventorySequence
      || result.itemCount !== items.length
      || items.length > 64
      || result.characterCount !== items.reduce((total, item) => total + String(item?.text ?? "").length, 0)
      || result.characterCount > 4096
      || !items.every(validItem)
      || governance.localOcr !== true
      || governance.providerCalled !== false
      || governance.networkEgress !== false
      || governance.pixelsProviderEgress !== false
      || governance.maximumProviderCalls !== 0
      || governance.maximumActions !== 0
      || governance.actionExecuted !== false
      || governance.taskMutated !== false
      || governance.automaticContinuation !== false
      || governance.textTransient !== true
      || governance.textPersisted !== false
      || governance.browserStorage !== false
      || governance.parentDisplayConnected !== false
      || governance.desktopWideCapture !== false
      || governance.processLaunchExpanded !== false
      || governance.mutatesHost !== false
      || Object.prototype.hasOwnProperty.call(result.frame ?? {}, "dataUrl")) {
      throw new Error("AI workspace local OCR result was invalid.");
    }
    aiWorkspaceLocalOcrStatus.textContent = items.length + " lines seq=" + result.frame.sequence;
    aiWorkspaceLocalOcrOutput.textContent = items.length > 0
      ? items.map((item) => item.text).join("\\n")
      : "no text";
    setControlMessage("Local OCR observed " + items.length + " text lines.");
  } finally {
    aiWorkspaceLocalOcrInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceLocalOcrButton.addEventListener("click", () => {
  runAiWorkspaceLocalOcr().catch((error) => {
    clearAiWorkspaceLocalOcr("unavailable");
    setControlMessage("Request failed: " + formatError(error));
  });
});

async function runAiWorkspaceSingleStep() {
  if (aiWorkspaceSingleStepInFlight || aiWorkspaceOcrTypeInFlight) return;
  aiWorkspaceSingleStepInFlight = true;
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    await refreshRuntime();
    if (!currentAiSurfaceScrollBinding()) {
      throw new Error("A fresh active AI workspace projection is required.");
    }
    const taskId = currentAiWorkspaceTaskId();
    if (!taskId) {
      throw new Error("A current operator-reviewed task is required.");
    }
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.single_step",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const governance = result.governance ?? {};
    const actionId = result.decision?.actionId ?? result.fallback?.actionId ?? "no_op";
    const semanticType = actionId === "type_item";
    const providerDecisionReturned = result.status !== "local_fallback";
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-single-step-v0"
      || governance.maximumActions !== 1
      || governance.automaticRepeat !== false
      || governance.rawTaskGoalProviderEgress !== false
      || governance.keyboardInput !== semanticType
      || governance.mutatesHost !== false
      || (providerDecisionReturned && (governance.taskObjectiveBound !== true
        || governance.taskObjectiveProviderEgress !== true
        || result.evidence?.taskId !== taskId
        || !/^[a-f0-9]{64}$/u.test(result.evidence?.objectiveContentHash ?? "")
        || !/^[a-f0-9]{64}$/u.test(result.evidence?.taskVersionHash ?? "")))
      || !(["no_op", "local_fallback"].includes(result.status)
        || result.status?.startsWith("executed"))) {
      throw new Error("AI workspace single-step result was invalid.");
    }
    if (JSON.stringify(result).includes('"inputText"')
      || (semanticType && (result.action?.inputEvidence?.textExposed !== false
        || result.action?.inputEvidence?.persisted !== false
        || !Number.isInteger(result.action?.inputEvidence?.charCount)
        || result.action.inputEvidence.charCount < 1
        || governance.providerGeneratedInput !== true
        || governance.inputTextPersisted !== false))) {
      throw new Error("AI workspace semantic input evidence was invalid.");
    }
    if (result.status.startsWith("executed")
      && (governance.actionExecuted !== true
        || governance.currentFrameBound !== true
        || governance.currentActiveSurfaceBound !== true)) {
      throw new Error("AI workspace single-step execution evidence was incomplete.");
    }
    const itemSuffix = ["click_item", "type_item"].includes(actionId)
      && Number.isInteger(result.action?.itemOrdinal)
      ? " #" + result.action.itemOrdinal
      : "";
    setControlMessage("AI step: " + actionId + itemSuffix + " (" + result.status + ").");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceSingleStepInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceSingleStepButton.addEventListener("click", () => {
  runAiWorkspaceSingleStep().catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});

async function runAiWorkspaceBoundedRun() {
  if (aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceOcrTypeInFlight) return;
  aiWorkspaceBoundedRunInFlight = true;
  updateAiSurfaceScrollControls();
  try {
    await refreshAiWorkspaceProjection();
    await refreshWorkView();
    await refreshRuntime();
    if (!currentAiSurfaceScrollBinding()) {
      throw new Error("A fresh active AI workspace projection is required.");
    }
    const taskId = currentAiWorkspaceTaskId();
    if (!taskId) {
      throw new Error("A current operator-reviewed task is required.");
    }
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.bounded_run",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const governance = result.governance ?? {};
    const evidence = result.evidence ?? {};
    const steps = Array.isArray(result.steps) ? result.steps : [];
    const allowedStatuses = new Set([
      "completed",
      "stopped_after_first",
      "stopped_after_second_fallback",
      "first_step_outcome_unknown",
      "second_step_outcome_unknown",
      "runtime_unavailable",
      "local_fallback",
    ]);
    const allowedActions = new Set([
      "no_op", "scroll_up", "scroll_down", "click_item", "type_item",
    ]);
    const validStep = (step, index) => step?.index === index + 1
      && typeof step.status === "string"
      && allowedActions.has(step.actionId)
      && typeof step.providerCalled === "boolean"
      && typeof step.actionExecuted === "boolean"
      && (!step.inputEvidence || (step.actionId === "type_item"
        && Number.isInteger(step.inputEvidence.charCount)
        && step.inputEvidence.charCount > 0
        && step.inputEvidence.textExposed === false
        && step.inputEvidence.persisted === false));
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-bounded-run-v0"
      || !allowedStatuses.has(result.status)
      || steps.length > 2
      || !steps.every(validStep)
      || evidence.stepCount !== steps.length
      || !Number.isInteger(evidence.providerCallCountMinimum)
      || evidence.providerCallCountMinimum < 0
      || evidence.providerCallCountMinimum > 2
      || !Number.isInteger(evidence.actionCountMinimum)
      || evidence.actionCountMinimum < 0
      || evidence.actionCountMinimum > 2
      || (evidence.outcomeUnknown === true
        ? evidence.providerCallCount !== null || evidence.actionCount !== null
        : (!Number.isInteger(evidence.providerCallCount)
          || evidence.providerCallCount < 0
          || evidence.providerCallCount > 2
          || !Number.isInteger(evidence.actionCount)
          || evidence.actionCount < 0
          || evidence.actionCount > 2))
      || governance.maximumProviderCalls !== 2
      || governance.maximumActions !== 2
      || governance.providerCallCount !== evidence.providerCallCount
      || governance.actionCount !== evidence.actionCount
      || governance.continuationAfterVerifiedScrollOnly !== true
      || governance.terminalAfterSecondStep !== true
      || governance.automaticRepeat !== false
      || governance.inputTextPersisted !== false
      || governance.mutatesHost !== false
      || JSON.stringify(result).includes('"inputText"')) {
      throw new Error("AI workspace bounded-run result was invalid.");
    }
    if (steps.length === 2
      && (!new Set(["scroll_up", "scroll_down"]).has(steps[0].actionId)
        || steps[0].actionExecuted !== true
        || evidence.continuationAudit !== true
        || governance.continuedAfterVerifiedScroll !== true)) {
      throw new Error("AI workspace bounded-run continuation was invalid.");
    }
    if (steps.length < 2 && governance.continuedAfterVerifiedScroll === true) {
      throw new Error("AI workspace bounded-run continuation evidence diverged.");
    }
    const actionSummary = steps.map((step) => step.actionId).join(" -> ") || "no action";
    setControlMessage("AI run: " + actionSummary + " (" + result.status + ").");
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
  } finally {
    aiWorkspaceBoundedRunInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

runAiWorkspaceBoundedRunButton.addEventListener("click", () => {
  runAiWorkspaceBoundedRun().catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});

async function assessAiWorkspace() {
  if (aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceOcrTypeInFlight) return;
  aiWorkspaceAssessmentInFlight = true;
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
        capabilityId: "sense.ai.workspace.assessment",
        taskId,
        params: { confirm: true },
      }),
    });
    const result = response.result ?? {};
    const assessment = result.assessment ?? {};
    const governance = result.governance ?? {};
    const assessed = result.status === "assessed";
    const allowedOutcomes = new Set(["complete", "incomplete", "blocked", "unknown"]);
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-task-assessment-v0"
      || !["assessed", "local_fallback"].includes(result.status)
      || !allowedOutcomes.has(assessment.outcome)
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
      || governance.pixelsProviderEgress !== false
      || governance.urlsProviderEgress !== false
      || governance.inputValuesProviderEgress !== false
      || governance.mutatesHost !== false
      || (assessed && (governance.providerCalled !== true
        || governance.semanticSceneBound !== true
        || governance.currentBrowserSurfaceBound !== true
        || governance.taskObjectiveBound !== true
        || governance.taskObjectiveProviderEgress !== true
        || result.evidence?.taskId !== taskId
        || result.evidence?.completionAudit !== true))) {
      throw new Error("AI workspace assessment result was invalid.");
    }
    const assessmentReceiptValid = assessed
      && typeof response.invocation?.id === "string"
      && response.invocation.id.length > 0
      && response.invocation.id.length <= 200
      && [
        result.evidence?.objectiveContentHash,
        result.evidence?.taskVersionHash,
        result.evidence?.responseContentHash,
        result.evidence?.sceneContentHash,
      ].every((value) => /^[a-f0-9]{64}$/u.test(value ?? ""));
    if (assessed && !assessmentReceiptValid) {
      throw new Error("AI workspace assessment receipt was invalid.");
    }
    aiWorkspaceAssessmentTaskId = taskId;
    aiWorkspaceAssessmentReceipt = assessed && assessment.outcome === "complete"
      ? {
          taskId,
          assessmentInvocationId: response.invocation.id,
          objectiveContentHash: result.evidence.objectiveContentHash,
          taskVersionHash: result.evidence.taskVersionHash,
          responseContentHash: result.evidence.responseContentHash,
          sceneContentHash: result.evidence.sceneContentHash,
        }
      : null;
    const confidence = typeof assessment.confidence === "number"
      ? " " + Math.round(assessment.confidence * 100) + "%"
      : "";
    aiWorkspaceAssessmentStatus.textContent = assessment.outcome + confidence;
    setControlMessage("AI assessment: " + assessment.outcome + confidence + ".");
  } finally {
    aiWorkspaceAssessmentInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

assessAiWorkspaceButton.addEventListener("click", () => {
  assessAiWorkspace().catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});

async function acceptAiWorkspaceAssessment() {
  if (aiWorkspaceSingleStepInFlight
    || aiWorkspaceBoundedRunInFlight
    || aiWorkspaceReviewedCycleInFlight
    || aiWorkspaceAssessmentInFlight
    || aiWorkspaceAssessmentAcceptanceInFlight
    || aiWorkspaceOcrTypeInFlight) return;
  const receipt = aiWorkspaceAssessmentReceipt;
  const taskId = currentAiWorkspaceTaskId();
  if (!receipt || receipt.taskId !== taskId) {
    throw new Error("A current verified complete assessment is required.");
  }
  const {
    taskId: receiptTaskId,
    ...assessmentReceipt
  } = receipt;
  aiWorkspaceAssessmentAcceptanceInFlight = true;
  updateAiSurfaceScrollControls();
  try {
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.ai.workspace.accept_assessment",
        taskId,
        params: { confirm: true, ...assessmentReceipt },
      }),
    });
    const result = response.result ?? {};
    const evidence = result.evidence ?? {};
    const governance = result.governance ?? {};
    if (response.invoked !== true
      || result.registry !== "nixsoma-ai-workspace-assessment-acceptance-v0"
      || result.status !== "accepted"
      || result.task?.id !== taskId
      || receiptTaskId !== taskId
      || result.task?.status !== "completed"
      || evidence.taskId !== taskId
      || evidence.assessmentInvocationId !== receipt.assessmentInvocationId
      || evidence.taskVersionHash !== receipt.taskVersionHash
      || evidence.responseContentHash !== receipt.responseContentHash
      || evidence.requiredAudit !== true
      || evidence.taskCompleted !== true
      || governance.explicitOperatorConfirmation !== true
      || governance.providerCalled !== false
      || governance.providerTriggeredCompletion !== false
      || governance.maximumActions !== 0
      || governance.actionExecuted !== false
      || governance.automaticContinuation !== false
      || governance.mutatesTask !== true
      || governance.mutatesHost !== false) {
      throw new Error(result.reason ?? "AI workspace assessment acceptance was rejected.");
    }
    taskHistoryFocus = "latest-finished";
    selectedHistoryTaskId = result.task.id;
    taskDetailIdInput.value = result.task.id;
    clearAiWorkspaceAssessment("accepted");
    setControlMessage("Accepted verified completion for task " + taskId + ".");
    await refreshRuntime();
    await refreshTaskList();
    await refreshTaskHistoryDetail();
    await refreshWorkView();
  } finally {
    aiWorkspaceAssessmentAcceptanceInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

acceptAiWorkspaceAssessmentButton.addEventListener("click", () => {
  acceptAiWorkspaceAssessment().catch((error) => {
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
