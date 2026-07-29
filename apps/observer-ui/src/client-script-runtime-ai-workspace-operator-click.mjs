export function mapAiWorkspaceProjectionPoint({
  clientX,
  clientY,
  rect,
  outputWidth = 1280,
  outputHeight = 720,
} = {}) {
  if (!Number.isFinite(clientX)
    || !Number.isFinite(clientY)
    || !rect
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
    || rect.width <= 0
    || rect.height <= 0
    || !Number.isInteger(outputWidth)
    || !Number.isInteger(outputHeight)
    || outputWidth <= 0
    || outputHeight <= 0) {
    throw new Error("AI workspace projection geometry is invalid.");
  }
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
    throw new Error("AI workspace click is outside the projected output.");
  }
  return {
    x: Math.min(outputWidth - 1, Math.floor((localX / rect.width) * outputWidth)),
    y: Math.min(outputHeight - 1, Math.floor((localY / rect.height) * outputHeight)),
  };
}

export const observerClientRuntimeAiWorkspaceOperatorClickScript = `${mapAiWorkspaceProjectionPoint.toString()}

function resetAiWorkspaceOperatorClick(reason = "off") {
  aiWorkspaceOperatorClickToggle.checked = false;
  aiWorkspaceProjectionFrame.classList.remove("operator-click-ready");
  aiWorkspaceOperatorClickStatus.textContent = reason;
}

function syncAiWorkspaceOperatorClickControl({ bindingReady = false, busy = false } = {}) {
  const available = bindingReady
    && !busy
    && aiWorkspaceProjectionMode === "workspace"
    && operatorSession?.authenticated
    && document.visibilityState === "visible";
  aiWorkspaceOperatorClickToggle.disabled = !available;
  if (!available) {
    resetAiWorkspaceOperatorClick(aiWorkspaceOperatorClickInFlight ? "clicking" : "unavailable");
  }
}

function currentAiWorkspaceProjectedPoint(event) {
  const binding = currentAiSurfaceActionBinding();
  if (!binding) throw new Error("A fresh active AI workspace projection is required.");
  const bounds = aiWorkspaceProjectionFrame.getBoundingClientRect();
  const point = mapAiWorkspaceProjectionPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: {
      left: bounds.left + aiWorkspaceProjectionFrame.clientLeft,
      top: bounds.top + aiWorkspaceProjectionFrame.clientTop,
      width: aiWorkspaceProjectionFrame.clientWidth,
      height: aiWorkspaceProjectionFrame.clientHeight,
    },
  });
  return { ...binding, ...point, button: "left" };
}

async function runAiWorkspaceOperatorClick(event) {
  if (aiWorkspaceOperatorClickInFlight || !aiWorkspaceOperatorClickToggle.checked) return;
  if (event.isTrusted !== true || event.button !== 0) {
    resetAiWorkspaceOperatorClick("off");
    return;
  }
  const action = currentAiWorkspaceProjectedPoint(event);
  aiWorkspaceOperatorClickInFlight = true;
  resetAiWorkspaceOperatorClick("clicking");
  updateAiSurfaceScrollControls();
  try {
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.screen.pointer_keyboard",
        operation: "mouse.click",
        params: action,
      }),
    });
    const result = response.result ?? {};
    const mediation = result.action?.mediation ?? {};
    const visual = mediation.visualGrounding ?? {};
    if (response.ok !== true
      || response.invoked !== true
      || response.blocked !== false
      || result.ok !== true
      || result.registry !== "openclaw-screen-pointer-capability-v0"
      || result.operation !== "mouse.click"
      || result.summary?.accepted !== true
      || result.governance?.compositorNativeExecuted !== true
      || result.governance?.currentFrameBound !== true
      || result.governance?.currentActiveSurfaceBound !== true
      || result.governance?.automaticDispatch !== false
      || result.governance?.providerEgress !== false
      || mediation.accepted !== true
      || mediation.leaseMatched !== true
      || visual.frameMatched !== true
      || visual.frameFresh !== true
      || visual.receiptMatched !== true
      || visual.inventoryMatched !== true
      || visual.surfaceMatched !== true) {
      throw new Error(mediation.reason ?? "Projected AI workspace click was rejected.");
    }
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
    aiWorkspaceOperatorClickStatus.textContent = "clicked " + action.x + "," + action.y;
    setControlMessage("Clicked AI surface #" + action.surfaceId + " at " + action.x + "," + action.y + ".");
  } finally {
    aiWorkspaceOperatorClickInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

aiWorkspaceOperatorClickToggle.addEventListener("change", () => {
  if (!aiWorkspaceOperatorClickToggle.checked) {
    resetAiWorkspaceOperatorClick("off");
    return;
  }
  if (!currentAiSurfaceActionBinding()) {
    resetAiWorkspaceOperatorClick("stale");
    refreshAiWorkspaceProjection();
    return;
  }
  aiWorkspaceProjectionFrame.classList.add("operator-click-ready");
  aiWorkspaceOperatorClickStatus.textContent = "armed";
});

aiWorkspaceProjectionFrame.addEventListener("click", (event) => {
  runAiWorkspaceOperatorClick(event).catch((error) => {
    resetAiWorkspaceOperatorClick("rejected");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
