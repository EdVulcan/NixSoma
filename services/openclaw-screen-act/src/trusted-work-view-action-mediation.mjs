import {
  TRUSTED_WORK_VIEW_HELPER_LEASE_REGISTRY,
  normaliseTrustedWorkViewHelperLease,
} from "../../../packages/shared-utils/src/work-view-trust.mjs";

export function buildTrustedWorkViewActionLease(screen) {
  const trustedSession = screen?.trustedSession
    ?? screen?.workView?.trustedSession
    ?? screen?.captureMetadata?.trustedSession
    ?? null;
  const sessionIdentity = trustedSession?.sessionIdentity ?? {};
  const helperRuntime = trustedSession?.helperRuntime ?? {};
  const required = sessionIdentity.authority === "openclaw-session-manager";
  if (!required) {
    return {
      registry: "openclaw-trusted-work-view-action-mediation-v0",
      required: false,
      ready: true,
      status: "local_fallback_not_required",
      reason: null,
      trustedHelperLease: null,
    };
  }

  if (helperRuntime.status === "suspended" || helperRuntime.actionAuthority === "suspended") {
    return {
      registry: "openclaw-trusted-work-view-action-mediation-v0",
      required: true,
      ready: false,
      status: "blocked",
      reason: "operator_takeover_active",
      trustedHelperLease: null,
    };
  }

  const sidecar = helperRuntime.sidecar ?? null;
  if (sidecar?.taskId && (
    sidecar.status !== "running"
    || sidecar.captureFreshness !== "fresh"
    || sidecar.captureObservation?.sessionId !== sessionIdentity.authoritativeSessionId
  )) {
    return {
      registry: "openclaw-trusted-work-view-action-mediation-v0",
      required: true,
      ready: false,
      status: "blocked",
      reason: sidecar.captureFreshness === "stale"
        ? "trusted_sidecar_capture_stale"
        : "trusted_sidecar_capture_not_ready",
      trustedHelperLease: null,
    };
  }

  if (
    helperRuntime.registry !== "openclaw-trusted-work-view-helper-runtime-v0"
    || helperRuntime.owner !== "openclaw-session-manager"
    || helperRuntime.status !== "active"
    || helperRuntime.leaseMatched !== true
    || !helperRuntime.leaseId
    || helperRuntime.browserLeaseId !== helperRuntime.leaseId
    || helperRuntime.sessionId !== sessionIdentity.authoritativeSessionId
  ) {
    return {
      registry: "openclaw-trusted-work-view-action-mediation-v0",
      required: true,
      ready: false,
      status: "blocked",
      reason: "trusted_helper_lease_not_ready",
      trustedHelperLease: null,
    };
  }

  const trustedHelperLease = normaliseTrustedWorkViewHelperLease({
    registry: TRUSTED_WORK_VIEW_HELPER_LEASE_REGISTRY,
    owner: helperRuntime.owner,
    mode: "in_process_session_helper",
    scope: "ai_owned_work_view_only",
    leaseId: helperRuntime.leaseId,
    sessionId: helperRuntime.sessionId,
    workViewId: helperRuntime.workViewId,
    heartbeatAt: helperRuntime.heartbeatAt,
  }, { expectedSessionId: screen.sessionId });

  return {
    registry: "openclaw-trusted-work-view-action-mediation-v0",
    required: true,
    ready: true,
    status: "ready",
    reason: null,
    trustedHelperLease,
  };
}
