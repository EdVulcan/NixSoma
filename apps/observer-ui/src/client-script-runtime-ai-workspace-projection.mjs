export const observerClientRuntimeAiWorkspaceProjectionScript = `const AI_WORKSPACE_PROJECTION_INTERVAL_MS = 5000;
let aiWorkspaceProjectionMode = "browser";
let aiWorkspaceProjectionRequest = null;
let aiWorkspaceProjectionBinding = null;
let aiWorkspaceSingleStepInFlight = false;

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

function currentAiSurfaceScrollBinding() {
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

function updateAiSurfaceScrollControls() {
  const enabled = currentAiSurfaceScrollBinding() !== null;
  const taskId = currentAiWorkspaceTaskId();
  scrollAiSurfaceUpButton.disabled = !enabled;
  scrollAiSurfaceDownButton.disabled = !enabled;
  runAiWorkspaceSingleStepButton.disabled = !enabled || !taskId || aiWorkspaceSingleStepInFlight;
}

function clearAiWorkspaceProjection(reason = "unavailable") {
  aiWorkspaceProjectionBinding = null;
  aiWorkspaceProjectionFrame.removeAttribute("src");
  aiWorkspaceProjectionFrame.hidden = true;
  aiWorkspaceProjectionStatus.textContent = reason;
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
  const binding = currentAiSurfaceScrollBinding();
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

async function runAiWorkspaceSingleStep() {
  if (aiWorkspaceSingleStepInFlight) return;
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
`;
