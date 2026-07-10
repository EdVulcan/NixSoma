import test from "node:test";
import assert from "node:assert/strict";

import { buildTrustedWorkViewActionLease } from "../src/trusted-work-view-action-mediation.mjs";

function trustedScreen(overrides = {}) {
  return {
    sessionId: "session-1",
    trustedSession: {
      sessionIdentity: {
        authority: "openclaw-session-manager",
        authoritativeSessionId: "session-1",
      },
      helperRuntime: {
        registry: "openclaw-trusted-work-view-helper-runtime-v0",
        owner: "openclaw-session-manager",
        status: "active",
        leaseId: "lease-1",
        browserLeaseId: "lease-1",
        leaseMatched: true,
        sessionId: "session-1",
        workViewId: "work-view-primary",
        heartbeatAt: "2026-07-10T10:00:00.000Z",
        ...overrides,
      },
    },
  };
}

test("screen-act builds a bounded helper lease from trusted screen state", () => {
  const mediation = buildTrustedWorkViewActionLease(trustedScreen());
  assert.equal(mediation.required, true);
  assert.equal(mediation.ready, true);
  assert.equal(mediation.trustedHelperLease.leaseId, "lease-1");
  assert.equal(mediation.trustedHelperLease.sessionId, "session-1");
  assert.equal(mediation.trustedHelperLease.externalProcessStarted, false);
});

test("screen-act blocks divergent helper state before browser mutation", () => {
  const mediation = buildTrustedWorkViewActionLease(trustedScreen({
    status: "divergent",
    leaseMatched: false,
    browserLeaseId: "lease-other",
  }));
  assert.equal(mediation.required, true);
  assert.equal(mediation.ready, false);
  assert.equal(mediation.reason, "trusted_helper_lease_not_ready");
  assert.equal(mediation.trustedHelperLease, null);
});

test("screen-act blocks helper action while operator takeover is active", () => {
  const mediation = buildTrustedWorkViewActionLease(trustedScreen({
    status: "suspended",
    actionAuthority: "suspended",
  }));
  assert.equal(mediation.required, true);
  assert.equal(mediation.ready, false);
  assert.equal(mediation.reason, "operator_takeover_active");
  assert.equal(mediation.trustedHelperLease, null);
});

test("screen-act requires fresh same-session capture after sidecar lifecycle activation", () => {
  const fresh = buildTrustedWorkViewActionLease(trustedScreen({
    sidecar: {
      taskId: "task-sidecar",
      status: "running",
      captureFreshness: "fresh",
      captureObservation: { sessionId: "session-1" },
    },
  }));
  assert.equal(fresh.ready, true);

  const stale = buildTrustedWorkViewActionLease(trustedScreen({
    sidecar: {
      taskId: "task-sidecar",
      status: "running",
      captureFreshness: "stale",
      captureObservation: { sessionId: "session-1" },
    },
  }));
  assert.equal(stale.ready, false);
  assert.equal(stale.reason, "trusted_sidecar_capture_stale");

  const divergent = buildTrustedWorkViewActionLease(trustedScreen({
    sidecar: {
      taskId: "task-sidecar",
      status: "running",
      captureFreshness: "fresh",
      captureObservation: { sessionId: "session-other" },
    },
  }));
  assert.equal(divergent.ready, false);
  assert.equal(divergent.reason, "trusted_sidecar_capture_not_ready");
});
