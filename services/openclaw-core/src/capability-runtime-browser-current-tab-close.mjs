import {
  BROWSER_CURRENT_TAB_CLOSE_ACTION,
  BROWSER_CURRENT_TAB_CLOSE_REGISTRY,
} from "../../../packages/shared-utils/src/browser-action-contract.mjs";

export const BROWSER_CURRENT_TAB_CLOSE_CAPABILITY_ID =
  "act.browser.current_tab.close";

const CAPABILITY_REGISTRY = "openclaw-browser-current-tab-close-capability-v0";
const ALLOWED_BODY_KEYS = new Set(["capabilityId", "operation", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);
const SAFE_REASONS = new Set([
  "operator_takeover_active",
  "trusted_sidecar_capture_source_unavailable",
  "trusted_helper_lease_not_ready",
  "visual_frame_not_ready",
  "authority_already_connected",
  "browser_action_owner_unavailable",
  "current_tab_close_browser_not_running",
  "current_tab_close_requires_multiple_tabs",
  "current_tab_close_active_page_changed",
  "current_tab_close_no_remaining_page",
]);

function isCapability(capability) {
  return capability?.id === BROWSER_CURRENT_TAB_CLOSE_CAPABILITY_ID;
}

function boundedReason(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const reason = value.trim();
  return SAFE_REASONS.has(reason) ? reason : "owner_rejected";
}

function compactEffect(effect) {
  const tabCountBefore = Number.isInteger(effect?.tabCountBefore) ? effect.tabCountBefore : null;
  const tabCountAfter = Number.isInteger(effect?.tabCountAfter) ? effect.tabCountAfter : null;
  const contractMatched = effect?.registry === BROWSER_CURRENT_TAB_CLOSE_REGISTRY
    && effect?.operation === BROWSER_CURRENT_TAB_CLOSE_ACTION.kind
    && effect?.status === "closed"
    && tabCountBefore >= 2
    && tabCountAfter === tabCountBefore - 1
    && effect?.currentTabClosed === true
    && effect?.activeTabChanged === true
    && effect?.lastTabPreserved === true
    && effect?.callerSelectedTab === false
    && effect?.automaticCleanup === false
    && effect?.browserProcessControlled === false
    && effect?.browserWindowControlled === false
    && effect?.desktopTakeover === false;
  return {
    registry: contractMatched ? BROWSER_CURRENT_TAB_CLOSE_REGISTRY : null,
    status: contractMatched ? "closed" : null,
    tabCountBefore,
    tabCountAfter,
    currentTabClosed: contractMatched,
    activeTabChanged: contractMatched,
    lastTabPreserved: effect?.lastTabPreserved === true,
    callerSelectedTab: effect?.callerSelectedTab === true,
    automaticCleanup: effect?.automaticCleanup === true,
    browserProcessControlled: effect?.browserProcessControlled === true,
    browserWindowControlled: effect?.browserWindowControlled === true,
    desktopTakeover: effect?.desktopTakeover === true,
    contractMatched,
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
    effect: compactEffect(mediation?.effect),
  };
}

function projectOwnerResponse(response) {
  const action = response?.action ?? {};
  const mediation = compactMediation(action.mediation);
  const ownerContractMatched = action.kind === BROWSER_CURRENT_TAB_CLOSE_ACTION.kind;
  const browserRuntimeExecuted = action.result === "executed-browser-runtime"
    && mediation.accepted
    && mediation.effect.contractMatched;
  const ok = response?.ok === true && ownerContractMatched && browserRuntimeExecuted;
  return {
    ok,
    registry: CAPABILITY_REGISTRY,
    operation: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
    action: {
      kind: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
      result: typeof action.result === "string" ? action.result.slice(0, 80) : null,
      degraded: action.degraded === true,
      mediation,
    },
    governance: {
      explicitOperatorConfirmation: true,
      dispatchesExistingScreenActOwner: true,
      ownerContractMatched,
      requiresFreshScreenContext: true,
      requiresTrustedLease: true,
      currentTabOnly: true,
      callerTabSelection: false,
      maximumActions: 1,
      actionExecuted: browserRuntimeExecuted,
      automaticCleanup: false,
      automaticRepeat: false,
      createsTask: false,
      createsApproval: false,
      browserProcessControl: false,
      browserWindowControl: false,
      desktopTakeover: false,
      exposesPagePayload: false,
      exposesNavigationUrl: false,
      providerCall: false,
      providerEgress: false,
      mutatesHost: false,
    },
    summary: {
      kind: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
      ok,
      operation: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
      actionAttempted: mediation.attempted,
      accepted: mediation.accepted,
      browserRuntimeExecuted,
      degraded: action.degraded === true,
      mediationStatus: mediation.status,
      mediationReason: mediation.reason,
      leaseMatched: mediation.leaseMatched,
      tabCountBefore: mediation.effect.tabCountBefore,
      tabCountAfter: mediation.effect.tabCountAfter,
      currentTabClosed: mediation.effect.currentTabClosed,
      minimumTabPreserved: mediation.effect.lastTabPreserved,
      currentTabOnly: true,
      noCallerTabSelection: true,
      noAutomaticCleanup: true,
      noProcessOrWindowControl: true,
      noPayloadExposure: true,
      noProviderEgress: true,
      noHostMutation: true,
    },
  };
}

function unavailableOwnerResponse() {
  return projectOwnerResponse({
    ok: false,
    action: {
      kind: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
      result: null,
      degraded: true,
      mediation: {
        attempted: true,
        accepted: false,
        status: "unavailable",
        reason: "browser_action_owner_unavailable",
        leaseMatched: false,
      },
    },
  });
}

function requestIsBounded(request, rawBody) {
  return request?.operation === BROWSER_CURRENT_TAB_CLOSE_ACTION.kind
    && request.intent === null
    && request.taskId === null
    && request.stepId === null
    && request.params?.confirm === true
    && Object.keys(request.params ?? {}).every((key) => ALLOWED_PARAM_KEYS.has(key))
    && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

export function createBrowserCurrentTabCloseCapabilityHandlers({
  screenActUrl,
  postJson = async () => {
    throw new Error("Browser current-tab close transport is not configured.");
  },
} = {}) {
  function validateRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return null;
    return requestIsBounded(request, rawBody)
      ? null
      : "Browser current-tab close accepts only capabilityId, operation=browser.current_tab.close, and params.confirm=true.";
  }

  async function callBackend(capability) {
    if (!isCapability(capability)) return { handled: false, result: null };
    try {
      const response = await postJson(
        `${screenActUrl}${BROWSER_CURRENT_TAB_CLOSE_ACTION.screenActEndpoint}`,
        {},
      );
      return { handled: true, result: projectOwnerResponse(response) };
    } catch {
      return { handled: true, result: unavailableOwnerResponse() };
    }
  }

  function summariseResult(capability, result) {
    return isCapability(capability) ? result?.summary ?? null : null;
  }

  return { callBackend, summariseResult, validateRequest };
}
