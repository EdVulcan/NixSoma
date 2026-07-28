import {
  normaliseAiCompositorPointerAction,
  normaliseAiCompositorScrollAction,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";

const CAPABILITY_ID = "act.screen.pointer_keyboard";
const KEYBOARD_OPERATION = "keyboard.type";
const POINTER_OPERATION = "mouse.click";
const SCROLL_OPERATION = "mouse.scroll";
const OPERATIONS = new Set([KEYBOARD_OPERATION, POINTER_OPERATION, SCROLL_OPERATION]);
const REGISTRIES = Object.freeze({
  [KEYBOARD_OPERATION]: "openclaw-screen-keyboard-capability-v0",
  [POINTER_OPERATION]: "openclaw-screen-pointer-capability-v0",
  [SCROLL_OPERATION]: "openclaw-screen-pointer-capability-v0",
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
  "ai_compositor_input_rejected",
  "AI compositor input frame is stale or no longer current.",
  "AI compositor input requires active work-view action authority.",
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
  return new Error("Screen action capability only allows keyboard.type, mouse.click, or mouse.scroll.");
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
    .filter((key) => !["operation", "x", "y", "button", "compositorFrame"].includes(key));
  if (unsupportedParams.length > 0) {
    throw new Error("Screen pointer capability only accepts coordinates, left button, and an optional native frame binding.");
  }
  if (params.button !== undefined && params.button !== "left") {
    throw new Error("Screen pointer capability only allows the left button.");
  }
  if (params.compositorFrame) {
    const nativeAction = normaliseAiCompositorPointerAction({
      x: params.x,
      y: params.y,
      button: params.button,
      compositorFrame: params.compositorFrame,
    });
    if (!nativeAction.frame.fresh) {
      throw new Error("Screen pointer native frame binding is stale.");
    }
    return {
      x: nativeAction.x,
      y: nativeAction.y,
      button: "left",
      compositorFrame: {
        registry: nativeAction.frame.registry,
        socketName: nativeAction.frame.socketName,
        width: nativeAction.frame.width,
        height: nativeAction.frame.height,
        sha256: nativeAction.frame.sha256,
        sequence: nativeAction.frame.sequence,
        capturedAt: nativeAction.frame.capturedAt,
      },
    };
  }
  return {
    x: normaliseCoordinate(params.x, "x", MAX_X),
    y: normaliseCoordinate(params.y, "y", MAX_Y),
    button: "left",
  };
}

function normaliseScrollParams(params) {
  const unsupportedParams = Object.keys(params)
    .filter((key) => ![
      "operation",
      "direction",
      "surfaceId",
      "inventorySequence",
      "compositorFrame",
    ].includes(key));
  if (unsupportedParams.length > 0) {
    throw new Error("Screen scroll capability only accepts one direction, active surface binding, and native frame binding.");
  }
  const action = normaliseAiCompositorScrollAction(params);
  if (!action.frame.fresh) {
    throw new Error("Screen scroll native frame binding is stale.");
  }
  return {
    direction: action.direction,
    surfaceId: action.surfaceId,
    inventorySequence: action.inventorySequence,
    compositorFrame: {
      registry: action.frame.registry,
      socketName: action.frame.socketName,
      width: action.frame.width,
      height: action.frame.height,
      sha256: action.frame.sha256,
      sequence: action.frame.sequence,
      capturedAt: action.frame.capturedAt,
    },
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
          frameMatched: mediation.visualGrounding.frameMatched === true,
          frameFresh: mediation.visualGrounding.frameFresh === true,
          receiptMatched: mediation.visualGrounding.receiptMatched === true,
          frameChanged: mediation.visualGrounding.frameChanged === true,
          inventoryMatched: mediation.visualGrounding.inventoryMatched === true,
          surfaceMatched: mediation.visualGrounding.surfaceMatched === true,
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
  const compositorNativeExecuted = ownerContractMatched && action.result === "executed-ai-compositor";
  const writesBrowserInput = operation === KEYBOARD_OPERATION;
  const pointerAction = operation === POINTER_OPERATION || operation === SCROLL_OPERATION;
  const scrollAction = operation === SCROLL_OPERATION;
  const currentActiveSurfaceBound = compositorNativeExecuted
    && scrollAction
    && mediation.visualGrounding?.inventoryMatched === true
    && mediation.visualGrounding?.surfaceMatched === true;
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
      scrollAction,
      browserNetworkNavigation: false,
      automaticDispatch: false,
      createsTask: false,
      createsApproval: false,
      mutatesBrowserState: browserRuntimeExecuted || compositorNativeExecuted,
      compositorNativeExecuted,
      currentFrameBound: compositorNativeExecuted,
      currentActiveSurfaceBound,
      inputScope: compositorNativeExecuted ? "ai_owned_nested_output_only" : "active_browser_page",
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
      compositorNativeExecuted,
      currentFrameBound: compositorNativeExecuted,
      degraded: action.degraded === true,
      mediationStatus: mediation.status,
      mediationReason: mediation.reason,
      leaseMatched: mediation.leaseMatched,
      writesBrowserInput,
      pointerAction,
      scrollAction,
      currentActiveSurfaceBound,
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
  const pointerAction = operation === POINTER_OPERATION || operation === SCROLL_OPERATION;
  const scrollAction = operation === SCROLL_OPERATION;
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
      scrollAction,
      browserNetworkNavigation: false,
      automaticDispatch: false,
      createsTask: false,
      createsApproval: false,
      mutatesBrowserState: false,
      compositorNativeExecuted: false,
      currentFrameBound: false,
      currentActiveSurfaceBound: false,
      inputScope: "none",
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
      compositorNativeExecuted: false,
      currentFrameBound: false,
      degraded: true,
      mediationStatus: "unavailable",
      mediationReason: "screen_action_owner_unavailable",
      leaseMatched: false,
      writesBrowserInput,
      pointerAction,
      scrollAction,
      currentActiveSurfaceBound: false,
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
    if (operation === SCROLL_OPERATION) {
      return {
        operation,
        payload: normaliseScrollParams(params),
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
        : action.operation === SCROLL_OPERATION
          ? "/act/mouse/scroll"
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
      scrollAction: governance.scrollAction === true,
      currentActiveSurfaceBound: governance.currentActiveSurfaceBound === true,
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
