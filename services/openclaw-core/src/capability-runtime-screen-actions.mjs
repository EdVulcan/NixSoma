const CAPABILITY_ID = "act.screen.pointer_keyboard";
const KEYBOARD_OPERATION = "keyboard.type";
const POINTER_OPERATION = "mouse.click";
const OPERATIONS = new Set([KEYBOARD_OPERATION, POINTER_OPERATION]);
const REGISTRIES = Object.freeze({
  [KEYBOARD_OPERATION]: "openclaw-screen-keyboard-capability-v0",
  [POINTER_OPERATION]: "openclaw-screen-pointer-capability-v0",
});
const MAX_INPUT_CHARS = 2_000;
const MAX_X = 959;
const MAX_Y = 539;
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
  "screen_action_owner_unavailable",
]);

function registryForOperation(operation) {
  return REGISTRIES[operation] ?? "openclaw-screen-action-capability-v0";
}

function boundedReason(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const reason = value.trim();
  return SAFE_MEDIATION_REASONS.has(reason) ? reason : "owner_rejected";
}

function normaliseOperation(request) {
  const params = request?.params ?? {};
  return request?.operation ?? params.operation ?? request?.intent ?? null;
}

function operationError() {
  return new Error("Screen action capability only allows keyboard.type or mouse.click.");
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

function normaliseCoordinate(value, label, maximum) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`Screen pointer capability ${label} must be an integer between 0 and ${maximum}.`);
  }
  return value;
}

function normaliseClickParams(params) {
  const unsupportedParams = Object.keys(params)
    .filter((key) => !["operation", "x", "y", "button"].includes(key));
  if (unsupportedParams.length > 0) {
    throw new Error("Screen pointer capability only accepts params.x, params.y, and left button.");
  }
  if (params.button !== undefined && params.button !== "left") {
    throw new Error("Screen pointer capability only allows the left button.");
  }
  return {
    x: normaliseCoordinate(params.x, "x", MAX_X),
    y: normaliseCoordinate(params.y, "y", MAX_Y),
    button: "left",
  };
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
  const ownerContractMatched = action.kind === operation;
  const browserRuntimeExecuted = ownerContractMatched && action.result === "executed-browser-runtime";
  const writesBrowserInput = operation === KEYBOARD_OPERATION;
  const pointerAction = operation === POINTER_OPERATION;
  return {
    ok: response?.ok === true && ownerContractMatched && mediation.accepted === true,
    registry: registryForOperation(operation),
    operation,
    action: {
      kind: operation,
      result: typeof action.result === "string" ? action.result.slice(0, 80) : null,
      degraded: action.degraded === true,
      mediation,
    },
    governance: {
      dispatchesExistingScreenActOwner: true,
      ownerContractMatched,
      requiresFreshScreenContext: true,
      requiresTrustedLease: true,
      writesBrowserInput,
      pointerAction,
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
      writesBrowserInput,
      pointerAction,
      inputValueExposed: false,
      browserNetworkNavigation: false,
      noAutomaticDispatch: true,
      noPayloadExposure: true,
      noProviderEgress: true,
    },
  };
}

function unavailableOwnerResponse(operation) {
  const writesBrowserInput = operation === KEYBOARD_OPERATION;
  const pointerAction = operation === POINTER_OPERATION;
  return {
    ok: false,
    registry: registryForOperation(operation),
    operation,
    action: {
      kind: operation,
      result: null,
      degraded: true,
      mediation: {
        attempted: true,
        accepted: false,
        status: "unavailable",
        reason: "screen_action_owner_unavailable",
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
      writesBrowserInput,
      pointerAction,
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
      mediationReason: "screen_action_owner_unavailable",
      leaseMatched: false,
      writesBrowserInput,
      pointerAction,
      inputValueExposed: false,
      browserNetworkNavigation: false,
      noAutomaticDispatch: true,
      noPayloadExposure: true,
      noProviderEgress: true,
    },
  };
}

export function createScreenActionCapabilityHandlers({
  screenActUrl,
  postJson = async () => {
    throw new Error("Screen action capability transport is not configured.");
  },
} = {}) {
  function normaliseRequest(request) {
    const operation = normaliseOperation(request);
    const candidates = [request?.operation, request?.params?.operation, request?.intent]
      .filter((value) => value !== undefined && value !== null && value !== "");
    if (!OPERATIONS.has(operation) || candidates.length === 0 || candidates.some((value) => value !== operation)) {
      throw operationError();
    }
    const params = request?.params ?? {};
    if (operation === KEYBOARD_OPERATION) {
      const unsupportedParams = Object.keys(params)
        .filter((key) => !["operation", "text"].includes(key));
      if (unsupportedParams.length > 0) {
        throw new Error("Screen keyboard capability only accepts params.text.");
      }
      return {
        operation,
        payload: { text: normaliseInput(params.text) },
      };
    }
    return {
      operation,
      payload: normaliseClickParams(params),
    };
  }

  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    const action = normaliseRequest(request);
    try {
      const endpoint = action.operation === KEYBOARD_OPERATION
        ? "/act/keyboard/type"
        : "/act/mouse/click";
      const response = await postJson(`${screenActUrl}${endpoint}`, action.payload);
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
    const operation = result?.operation ?? null;
    return {
      kind: operation,
      ok: result?.ok === true,
      operation,
      actionAttempted: summary.actionAttempted === true,
      accepted: summary.accepted === true,
      browserRuntimeExecuted: summary.browserRuntimeExecuted === true,
      degraded: summary.degraded === true,
      mediationStatus: summary.mediationStatus ?? null,
      mediationReason: summary.mediationReason ?? null,
      leaseMatched: summary.leaseMatched === true,
      writesBrowserInput: governance.writesBrowserInput === true,
      pointerAction: governance.pointerAction === true,
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
    try {
      normaliseRequest(request);
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid screen action request.";
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
