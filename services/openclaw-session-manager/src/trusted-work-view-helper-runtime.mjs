import { randomUUID } from "node:crypto";

import {
  TRUSTED_WORK_VIEW_HELPER_LEASE_REGISTRY,
  TRUSTED_WORK_VIEW_HELPER_RUNTIME_REGISTRY,
  normaliseTrustedWorkViewHelperLease,
} from "../../../packages/shared-utils/src/work-view-trust.mjs";

function requiredString(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Trusted work-view helper runtime requires ${label}.`);
  }
  return text;
}

export function createTrustedWorkViewHelperRuntime({
  createId = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  let lease = null;
  let browserObservation = null;
  let degradedReason = null;

  function start({ sessionId, workViewId, displayTarget }) {
    const issuedAt = now();
    lease = {
      registry: TRUSTED_WORK_VIEW_HELPER_LEASE_REGISTRY,
      owner: "openclaw-session-manager",
      mode: "in_process_session_helper",
      scope: "ai_owned_work_view_only",
      leaseId: createId(),
      sessionId: requiredString(sessionId, "sessionId"),
      workViewId: requiredString(workViewId, "workViewId"),
      displayTarget: requiredString(displayTarget, "displayTarget"),
      issuedAt,
      heartbeatAt: issuedAt,
      heartbeatCount: 1,
      rootRequired: false,
      externalProcessStarted: false,
      desktopWideCapture: false,
      providerEgress: false,
    };
    browserObservation = null;
    degradedReason = null;
    return snapshot();
  }

  function heartbeat({ sessionId, visibility = null, action = "state_read" } = {}) {
    if (!lease) {
      throw new Error("Trusted work-view helper runtime has no active lease.");
    }
    if (requiredString(sessionId, "sessionId") !== lease.sessionId) {
      throw new Error("Trusted work-view helper runtime session mismatch.");
    }
    lease = {
      ...lease,
      heartbeatAt: now(),
      heartbeatCount: lease.heartbeatCount + 1,
      lastVisibility: visibility,
      lastAction: action,
    };
    degradedReason = null;
    return snapshot();
  }

  function observeBrowserLease({ sessionId, trustedHelperLease }) {
    const observedAt = now();
    let observedLease = null;
    try {
      observedLease = normaliseTrustedWorkViewHelperLease(trustedHelperLease, {
        expectedSessionId: requiredString(sessionId, "browser sessionId"),
      });
    } catch (error) {
      degradedReason = error instanceof Error ? error.message : "invalid_browser_helper_lease";
    }
    browserObservation = {
      sessionId,
      leaseId: observedLease?.leaseId ?? null,
      observedAt,
    };
    return snapshot();
  }

  function markDegraded(reason) {
    degradedReason = requiredString(reason, "degraded reason");
    return snapshot();
  }

  function leaseEnvelope() {
    if (!lease) {
      return null;
    }
    return normaliseTrustedWorkViewHelperLease(lease, {
      expectedSessionId: lease.sessionId,
    });
  }

  function snapshot() {
    const browserLeaseId = browserObservation?.leaseId ?? null;
    const leaseMatched = Boolean(
      lease
      && browserLeaseId
      && browserLeaseId === lease.leaseId
      && browserObservation?.sessionId === lease.sessionId
    );
    const status = degradedReason
      ? "degraded"
      : !lease
        ? "inactive"
        : browserObservation
          ? leaseMatched ? "active" : "divergent"
          : "awaiting_browser";
    return {
      registry: TRUSTED_WORK_VIEW_HELPER_RUNTIME_REGISTRY,
      owner: "openclaw-session-manager",
      mode: "in_process_session_helper",
      status,
      leaseId: lease?.leaseId ?? null,
      sessionId: lease?.sessionId ?? null,
      workViewId: lease?.workViewId ?? null,
      displayTarget: lease?.displayTarget ?? null,
      browserLeaseId,
      browserSessionId: browserObservation?.sessionId ?? null,
      browserObservedAt: browserObservation?.observedAt ?? null,
      leaseMatched,
      heartbeatAt: lease?.heartbeatAt ?? null,
      heartbeatCount: lease?.heartbeatCount ?? 0,
      degradedReason,
      scope: "ai_owned_work_view_only",
      observerVisible: true,
      rootRequired: false,
      externalProcessStarted: false,
      desktopWideCapture: false,
      hostMutation: false,
      providerEgress: false,
    };
  }

  return {
    start,
    heartbeat,
    observeBrowserLease,
    markDegraded,
    leaseEnvelope,
    snapshot,
  };
}
