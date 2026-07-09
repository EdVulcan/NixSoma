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

