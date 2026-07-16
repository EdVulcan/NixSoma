const CAPABILITY_ID = "act.screen.pointer_keyboard";
const OPERATION = "keyboard.type";
const REGISTRY = "openclaw-screen-keyboard-capability-v0";
const MAX_INPUT_CHARS = 2_000;
const SAFE_MEDIATION_REASONS = new Set([
  "operator_takeover_active",
  "trusted_sidecar_capture_source_unavailable",
  "trusted_helper_lease_not_ready",
  "trusted_sidecar_capture_stale",
  "trusted_sidecar_capture_not_ready",
  "visual_frame_not_ready",
  "semantic_target_capture_mismatch",
  "unsupported_action",
  "authority_already_connected",
  "browser_action_owner_unavailable",
  "screen_keyboard_owner_unavailable",
]);

function boundedReason(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const reason = value.trim();
  return SAFE_MEDIATION_REASONS.has(reason) ? reason : "owner_rejected";
}

function normaliseOperation(request) {
  const params = request?.params ?? {};
  return request?.operation ?? params.operation ?? request?.intent ?? null;
}

function normaliseInput(value) {
  if (typeof value !== "string") {
    throw new Error("Screen keyboard capability requires params.text.");
  }
  if (value.length > MAX_INPUT_CHARS) {
    throw new Error("Screen keyboard capability input must be within 2000 characters.");
  }
  return value;
}

function compactMediation(mediation) {
  return {
    attempted: mediation?.attempted === true,
    accepted: mediation?.accepted === true,
    status: typeof mediation?.status === "string" ? mediation.status.slice(0, 80) : null,
    reason: boundedReason(mediation?.reason),
    leaseMatched: mediation?.leaseMatched === true,
    transport: typeof mediation?.transport === "string" ? mediation.transport.slice(0, 80) : null,
    visualGrounding: mediation?.visualGrounding
      ? {
          required: mediation.visualGrounding.required === true,
          status: typeof mediation.visualGrounding.status === "string"
            ? mediation.visualGrounding.status.slice(0, 80)
            : null,
          sequenceAdvanced: mediation.visualGrounding.sequenceAdvanced === true,
          imageDataRetained: false,
          persisted: false,
        }
      : null,
  };
}

function projectOwnerResponse(response, operation) {
  const action = response?.action ?? {};
  const mediation = compactMediation(action.mediation);
  const ownerContractMatched = action.kind === OPERATION;
  const browserRuntimeExecuted = action.result === "executed-browser-runtime";
  return {
    ok: response?.ok === true && ownerContractMatched && mediation.accepted === true,
    registry: REGISTRY,
    operation,
    action: {
      kind: OPERATION,
      result: typeof action.result === "string" ? action.result.slice(0, 80) : null,
      degraded: action.degraded === true,
      mediation,
    },
    governance: {
      dispatchesExistingScreenActOwner: true,
      ownerContractMatched,
      requiresFreshScreenContext: true,
      requiresTrustedLease: true,
      writesBrowserInput: true,
      browserNetworkNavigation: false,
      automaticDispatch: false,
      createsTask: false,
      createsApproval: false,
      mutatesBrowserState: browserRuntimeExecuted,
      exposesNavigationUrl: false,
      exposesPagePayload: false,
      exposesSelectors: false,
      exposesInputValue: false,
      providerCall: false,
      providerEgress: false,
      externalProviderContact: false,
    },
    summary: {
      operation,
      ownerContractMatched,
      actionAttempted: mediation.attempted,
      accepted: mediation.accepted,
      browserRuntimeExecuted,
      degraded: action.degraded === true,
      mediationStatus: mediation.status,
      mediationReason: mediation.reason,
      leaseMatched: mediation.leaseMatched,
      writesBrowserInput: true,
      inputValueExposed: false,
      browserNetworkNavigation: false,
      noAutomaticDispatch: true,
      noPayloadExposure: true,
      noProviderEgress: true,
    },
  };
}

function unavailableOwnerResponse(operation) {
  return {
    ok: false,
    registry: REGISTRY,
    operation,
    action: {
      kind: OPERATION,
      result: null,
      degraded: true,
      mediation: {
        attempted: true,
        accepted: false,
        status: "unavailable",
        reason: "screen_keyboard_owner_unavailable",
        leaseMatched: false,
        transport: null,
        visualGrounding: null,
      },
    },
    governance: {
      dispatchesExistingScreenActOwner: true,
      ownerContractMatched: false,
      requiresFreshScreenContext: true,
      requiresTrustedLease: true,
      writesBrowserInput: true,
      browserNetworkNavigation: false,
      automaticDispatch: false,
      createsTask: false,
      createsApproval: false,
      mutatesBrowserState: false,
      exposesNavigationUrl: false,
      exposesPagePayload: false,
      exposesSelectors: false,
      exposesInputValue: false,
      providerCall: false,
      providerEgress: false,
      externalProviderContact: false,
    },
    summary: {
      operation,
      ownerContractMatched: false,
      actionAttempted: true,
      accepted: false,
      browserRuntimeExecuted: false,
      degraded: true,
      mediationStatus: "unavailable",
      mediationReason: "screen_keyboard_owner_unavailable",
      leaseMatched: false,
      writesBrowserInput: true,
      inputValueExposed: false,
      browserNetworkNavigation: false,
      noAutomaticDispatch: true,
      noPayloadExposure: true,
      noProviderEgress: true,
    },
  };
}

export function createScreenKeyboardCapabilityHandlers({
  screenActUrl,
  postJson = async () => {
    throw new Error("Screen keyboard capability transport is not configured.");
  },
} = {}) {
  function normaliseRequest(request) {
    const operation = normaliseOperation(request);
    if (operation !== OPERATION) {
      throw new Error("Screen keyboard capability only allows keyboard.type.");
    }
    const params = request?.params ?? {};
    const unsupportedParams = Object.keys(params)
      .filter((key) => !["operation", "text"].includes(key));
    if (unsupportedParams.length > 0) {
      throw new Error("Screen keyboard capability only accepts params.text.");
    }
    return {
      operation,
      text: normaliseInput(params.text),
    };
  }

  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    const action = normaliseRequest(request);
    try {
      const response = await postJson(`${screenActUrl}/act/keyboard/type`, { text: action.text });
      return {
        handled: true,
        result: projectOwnerResponse(response, action.operation),
      };
    } catch {
      return {
        handled: true,
        result: unavailableOwnerResponse(action.operation),
      };
    }
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "keyboard.type",
      ok: result?.ok === true,
      operation: result?.operation ?? OPERATION,
      actionAttempted: summary.actionAttempted === true,
      accepted: summary.accepted === true,
      browserRuntimeExecuted: summary.browserRuntimeExecuted === true,
      degraded: summary.degraded === true,
      mediationStatus: summary.mediationStatus ?? null,
      mediationReason: summary.mediationReason ?? null,
      leaseMatched: summary.leaseMatched === true,
      writesBrowserInput: governance.writesBrowserInput === true,
      inputValueExposed: governance.exposesInputValue === true,
      browserNetworkNavigation: governance.browserNetworkNavigation === true,
      noAutomaticDispatch: governance.automaticDispatch === false,
      noPayloadExposure: governance.exposesNavigationUrl === false
        && governance.exposesPagePayload === false
        && governance.exposesSelectors === false
        && governance.exposesInputValue === false,
      noProviderEgress: governance.providerCall !== true
        && governance.providerEgress !== true
        && governance.externalProviderContact !== true,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    const params = request?.params ?? {};
    const candidates = [request?.operation, params.operation, request?.intent]
      .filter((value) => value !== undefined && value !== null && value !== "");
    if (candidates.length === 0 || candidates.some((value) => value !== OPERATION)) {
      return "Screen keyboard capability only allows keyboard.type.";
    }
    const unsupportedParams = Object.keys(params)
      .filter((key) => !["operation", "text"].includes(key));
    if (unsupportedParams.length > 0) {
      return "Screen keyboard capability only accepts params.text.";
    }
    try {
      normaliseInput(params.text);
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid screen keyboard input.";
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
