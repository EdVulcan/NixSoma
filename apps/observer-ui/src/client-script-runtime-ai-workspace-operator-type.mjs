export function normaliseAiWorkspaceOperatorTypeText(value) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 32
    && /^[A-Za-z0-9 .,_-]+$/u.test(value)
    ? value
    : null;
}

export const observerClientRuntimeAiWorkspaceOperatorTypeScript = `${normaliseAiWorkspaceOperatorTypeText.toString()}

function resetAiWorkspaceOperatorType(reason = "empty") {
  aiWorkspaceOperatorTypeInput.value = "";
  aiWorkspaceOperatorTypeStatus.textContent = reason;
  aiWorkspaceOperatorTypeButton.disabled = true;
}

function syncAiWorkspaceOperatorTypeControl({ bindingReady = false, busy = false } = {}) {
  const available = bindingReady
    && !busy
    && aiWorkspaceProjectionMode === "workspace"
    && operatorSession?.authenticated
    && document.visibilityState === "visible";
  aiWorkspaceOperatorTypeInput.disabled = !available;
  aiWorkspaceOperatorTypeButton.disabled = !available
    || normaliseAiWorkspaceOperatorTypeText(aiWorkspaceOperatorTypeInput.value) === null;
  if (!available) {
    resetAiWorkspaceOperatorType(aiWorkspaceOperatorTypeInFlight ? "typing" : "unavailable");
  }
}

async function runAiWorkspaceOperatorType() {
  if (aiWorkspaceOperatorTypeInFlight) return;
  let text = normaliseAiWorkspaceOperatorTypeText(aiWorkspaceOperatorTypeInput.value);
  if (text === null) {
    aiWorkspaceOperatorTypeStatus.textContent = "invalid";
    return;
  }
  const binding = currentAiSurfaceActionBinding();
  if (!binding) throw new Error("A fresh active AI workspace projection is required.");
  const inputCharCount = text.length;
  aiWorkspaceOperatorTypeInFlight = true;
  aiWorkspaceOperatorTypeInput.value = "";
  aiWorkspaceOperatorTypeStatus.textContent = "typing";
  updateAiSurfaceScrollControls();
  try {
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.screen.pointer_keyboard",
        operation: "keyboard.type",
        params: { ...binding, text },
      }),
    });
    const result = response.result ?? {};
    const mediation = result.action?.mediation ?? {};
    const visual = mediation.visualGrounding ?? {};
    if (response.ok !== true
      || response.invoked !== true
      || response.blocked !== false
      || result.ok !== true
      || result.registry !== "openclaw-screen-keyboard-capability-v0"
      || result.operation !== "keyboard.type"
      || result.summary?.accepted !== true
      || result.governance?.compositorNativeExecuted !== true
      || result.governance?.nativeTextInput !== true
      || result.governance?.currentFrameBound !== true
      || result.governance?.currentActiveSurfaceBound !== true
      || result.governance?.automaticDispatch !== false
      || result.governance?.exposesInputValue !== false
      || result.governance?.providerEgress !== false
      || mediation.accepted !== true
      || mediation.leaseMatched !== true
      || visual.frameMatched !== true
      || visual.frameFresh !== true
      || visual.receiptMatched !== true
      || visual.inventoryMatched !== true
      || visual.surfaceMatched !== true
      || visual.keyboardInput !== true
      || visual.inputCharCount !== inputCharCount
      || visual.inputTextExposed !== false
      || visual.inputTextPersisted !== false
      || visual.hotkeyInput !== false
      || visual.enterKeyInput !== false
      || visual.automaticRepeat !== false) {
      throw new Error(mediation.reason ?? "Native AI workspace type was rejected.");
    }
    await refreshActionState();
    await refreshWorkView();
    await refreshAiWorkspaceProjection();
    aiWorkspaceOperatorTypeStatus.textContent = "typed " + inputCharCount;
    setControlMessage("Typed " + inputCharCount + " write-only characters into AI surface #" + binding.surfaceId + ".");
  } finally {
    text = "";
    aiWorkspaceOperatorTypeInFlight = false;
    updateAiSurfaceScrollControls();
  }
}

aiWorkspaceOperatorTypeInput.addEventListener("input", () => {
  syncAiWorkspaceOperatorTypeControl({
    bindingReady: currentAiSurfaceActionBinding() !== null,
    busy: aiWorkspaceOperatorTypeInFlight,
  });
});

aiWorkspaceOperatorTypeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});

aiWorkspaceOperatorTypeButton.addEventListener("click", () => {
  runAiWorkspaceOperatorType().catch((error) => {
    resetAiWorkspaceOperatorType("rejected");
    setControlMessage("Request failed: " + formatError(error));
  });
});
`;
