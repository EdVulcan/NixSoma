const TRUSTED_WORK_VIEW_KIND = "openclaw-trusted-session-work-view-contract";
const TRUSTED_WORK_VIEW_IDENTITY_LEVEL = "level_2_trusted_session_work_view";
const TRUSTED_WORK_VIEW_SCOPE = "ai_owned_work_view_only";

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function firstBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function deriveReadiness({ degraded, helperStatus, sessionStatus, browserRunning, workViewStatus, activeUrl }) {
  if (degraded || helperStatus === "degraded") {
    return "degraded";
  }

  if (activeUrl && (browserRunning || sessionStatus === "running" || workViewStatus === "ready")) {
    return "ready";
  }

  if (workViewStatus === "prepared" || sessionStatus === "running") {
    return "prepared";
  }

  return "warming_up";
}

function helperActions() {
  return [
    { id: "prepare_work_view", endpoint: "/work-view/prepare", approvalRequired: false },
    { id: "reveal_work_view", endpoint: "/work-view/reveal", approvalRequired: false },
    { id: "hide_work_view", endpoint: "/work-view/hide", approvalRequired: false },
    { id: "operator_takeover", endpoint: "/control/takeover", approvalRequired: false },
  ];
}

function deriveHelperReadiness({ readiness, helperStatus, browserStatus, browserRunning, activeUrl, visibility }) {
  if (readiness === "degraded" || helperStatus === "degraded" || browserStatus === "unavailable") {
    return {
      state: "degraded",
      reason: "helper_or_browser_runtime_degraded",
      recommendedOperatorAction: "prepare_work_view",
      recoveryEndpoint: "/work-view/prepare",
      approvalRequired: false,
      rootRequired: false,
      canRecoverWithoutRoot: true,
      observerVisible: true,
      availableOperatorActions: helperActions(),
    };
  }

  if (!activeUrl || (!browserRunning && browserStatus !== "running")) {
    return {
      state: "needs_prepare",
      reason: "no_active_browser_runtime_work_view",
      recommendedOperatorAction: "prepare_work_view",
      recoveryEndpoint: "/work-view/prepare",
      approvalRequired: false,
      rootRequired: false,
      canRecoverWithoutRoot: true,
      observerVisible: true,
      availableOperatorActions: helperActions(),
    };
  }

  if (visibility === "hidden" || visibility === "background") {
    return {
      state: "prepared_hidden",
      reason: "work_view_ready_but_hidden",
      recommendedOperatorAction: "reveal_work_view",
      recoveryEndpoint: "/work-view/reveal",
      approvalRequired: false,
      rootRequired: false,
      canRecoverWithoutRoot: true,
      observerVisible: true,
      availableOperatorActions: helperActions(),
    };
  }

  return {
    state: "ready",
    reason: "ai_owned_work_view_observable",
    recommendedOperatorAction: "none",
    recoveryEndpoint: null,
    approvalRequired: false,
    rootRequired: false,
    canRecoverWithoutRoot: true,
    observerVisible: true,
    availableOperatorActions: helperActions(),
  };
}

function buildSidecarContract() {
  return {
    status: "drafted_not_started",
    identityLevel: TRUSTED_WORK_VIEW_IDENTITY_LEVEL,
    lifecycle: {
      processStarted: false,
      installRequired: false,
      rootRequired: false,
      systemDaemonRequired: false,
      approvalRequiredBeforeStart: true,
    },
    lifecycleProposal: {
      status: "proposal_ready",
      capabilityId: "plan.openclaw.work_view.trusted_sidecar_lifecycle",
      approvalGate: "required_before_process_start",
      executionStatus: "deferred",
      taskCreationDeferred: true,
      allowedTransitions: ["drafted_not_started", "approved_user_space_start_probe", "stopped"],
    },
    approvalTaskDraft: {
      status: "draft_ready",
      createsTaskNow: false,
      createsApprovalNow: false,
      approvalRequiredBeforeExecution: true,
      taskType: "work_view_trusted_sidecar_lifecycle",
      plannedCapabilityId: "act.openclaw.work_view.trusted_sidecar_lifecycle",
      executionStatus: "deferred",
      processStartEnabled: false,
      rootRequired: false,
      plannedPhases: [
        "review_sidecar_contract",
        "wait_for_operator_approval",
        "deferred_user_space_start_probe",
      ],
    },
    responsibilities: {
      capture: "emit_ai_owned_work_view_capture_contract",
      action: "mediate_ai_owned_work_view_reveal_hide_prepare_only",
      recovery: "surface_recommendations_and_record_operator_action_results",
      observer: "publish_state_without_revealing_user_foreground",
    },
    forbidden: {
      desktopWideCapture: true,
      rootDaemon: true,
      hostMutation: true,
      providerEgress: true,
      credentialAccess: true,
      arbitraryEndpointExecution: true,
    },
    observerVisibility: {
      workViewState: "/work-view/state",
      screenState: "/screen/current",
      phase3Readback: "/phase-3/background-work-view",
    },
  };
}

export function buildTrustedWorkViewContract(input = {}) {
  const session = input.session ?? {};
  const workView = input.workView ?? {};
  const browser = input.browser ?? {};
  const capture = input.browserCapture ?? input.capture ?? {};
  const trustedComponent = firstString(input.trustedComponent, input.source, "openclaw-session-manager");
  const source = firstString(input.source, capture.source, trustedComponent, "session-manager");
  const strategy = firstString(
    input.captureStrategy,
    capture.captureStrategy,
    capture.workView?.captureStrategy,
    workView.captureStrategy,
    "browser-runtime"
  );
  const sessionId = firstString(input.sessionId, capture.sessionId, session.sessionId, browser.sessionId, workView.sessionId);
  const activeUrl = firstString(input.activeUrl, capture.activeUrl, capture.workView?.activeUrl, workView.activeUrl, browser.activeUrl);
  const displayTarget = firstString(input.displayTarget, session.displayTarget, workView.displayTarget, "workspace-2");
  const helperStatus = firstString(input.helperStatus, workView.helperStatus, browser.running ? "active" : "idle");
  const browserStatus = firstString(
    input.browserStatus,
    workView.browserStatus,
    browser.running === true ? "running" : browser.running === false ? "stopped" : null,
    "unknown"
  );
  const browserRunning = firstBoolean(input.browserRunning, capture.browserRunning, browser.running, browserStatus === "running");
  const visibility = firstString(input.visibility, capture.workView?.visibility, workView.visibility, browserRunning ? "observable" : "hidden");
  const mode = firstString(input.mode, capture.workView?.mode, workView.mode, "ai-owned-work-view");
  const readiness = deriveReadiness({
    degraded: input.degraded === true,
    helperStatus,
    sessionStatus: session.status,
    browserRunning,
    workViewStatus: workView.status,
    activeUrl,
  });
  const helperReadiness = deriveHelperReadiness({
    readiness,
    helperStatus,
    browserStatus,
    browserRunning,
    activeUrl,
    visibility,
  });

  return {
    kind: TRUSTED_WORK_VIEW_KIND,
    identityLevel: TRUSTED_WORK_VIEW_IDENTITY_LEVEL,
    identityLevelNumber: 2,
    identityPath: ["level_1_user_space_control_plane", TRUSTED_WORK_VIEW_IDENTITY_LEVEL],
    readiness,
    trustedComponent,
    boundary: {
      workViewScope: TRUSTED_WORK_VIEW_SCOPE,
      desktopWideCapture: false,
      rootRequired: false,
      hostMutation: false,
      providerEgress: false,
    },
    capabilities: {
      managesAiOwnedWorkView: true,
      observesAiOwnedWorkView: true,
      recordsCaptureProvenance: true,
      supportsRevealHide: true,
      supportsOperatorTakeover: true,
    },
    operatorGates: {
      prepare: "user_space_control_plane",
      reveal: "explicit_operator_action",
      hide: "explicit_operator_action_or_task_completion",
      takeover: "operator_interrupt_control",
    },
    captureProvenance: {
      source,
      strategy,
      browserRuntimeBacked: strategy === "browser-runtime-backed" || strategy === "browser-runtime",
      sessionId,
      activeUrl,
      capturedAt: firstString(input.capturedAt, capture.capturedAt),
      visibleToObserver: input.visibleToObserver !== false,
    },
    helperReadiness,
    recoveryRecommendation: {
      action: helperReadiness.recommendedOperatorAction,
      endpoint: helperReadiness.recoveryEndpoint,
      reason: helperReadiness.reason,
      approvalRequired: helperReadiness.approvalRequired,
      rootRequired: helperReadiness.rootRequired,
      canRecoverWithoutRoot: helperReadiness.canRecoverWithoutRoot,
    },
    sidecarContract: buildSidecarContract(),
    evidence: {
      sessionStatus: firstString(session.status, "unknown"),
      workViewStatus: firstString(workView.status, "unknown"),
      visibility,
      mode,
      helperStatus,
      browserStatus,
      displayTarget,
    },
    deferred: {
      desktopWideCapture: true,
      rootSessionDaemon: true,
      hostMutation: true,
      graphicsStackNativeWorkspace: true,
    },
  };
}
