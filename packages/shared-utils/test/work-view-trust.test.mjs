import test from "node:test";
import assert from "node:assert/strict";

import { buildTrustedWorkViewContract } from "../src/work-view-trust.mjs";

test("trusted work-view contract records Level 2 boundary without host takeover", () => {
  const contract = buildTrustedWorkViewContract({
    source: "browser-runtime",
    trustedComponent: "openclaw-browser-runtime",
    sessionAuthority: "openclaw-session-manager",
    authoritativeSessionId: "session-1",
    componentSessionId: "session-1",
    browserRuntimeSessionId: "session-1",
    session: {
      sessionId: "session-1",
      status: "running",
      displayTarget: "workspace-2",
    },
    workView: {
      status: "ready",
      visibility: "observable",
      mode: "ai-owned-work-view",
      captureStrategy: "browser-runtime-backed",
      helperStatus: "active",
      browserStatus: "running",
      activeUrl: "https://example.com/work-view",
    },
    browser: {
      running: true,
    },
  });

  assert.equal(contract.kind, "openclaw-trusted-session-work-view-contract");
  assert.equal(contract.identityLevel, "level_2_trusted_session_work_view");
  assert.equal(contract.readiness, "ready");
  assert.equal(contract.boundary.workViewScope, "ai_owned_work_view_only");
  assert.equal(contract.boundary.desktopWideCapture, false);
  assert.equal(contract.boundary.rootRequired, false);
  assert.equal(contract.boundary.hostMutation, false);
  assert.equal(contract.operatorGates.reveal, "explicit_operator_action");
  assert.equal(contract.captureProvenance.browserRuntimeBacked, true);
  assert.equal(contract.sessionIdentity.status, "authoritative");
  assert.equal(contract.sessionIdentity.authority, "openclaw-session-manager");
  assert.equal(contract.sessionIdentity.authoritativeSessionId, "session-1");
  assert.equal(contract.sessionIdentity.browserRuntimeSessionId, "session-1");
  assert.equal(contract.sessionIdentity.alignment.browserRuntime, "matched");
  assert.equal(contract.captureProvenance.activeUrl, "https://example.com/work-view");
  assert.equal(contract.helperReadiness.state, "ready");
  assert.equal(contract.recoveryRecommendation.action, "none");
  assert.equal(contract.sidecarContract.status, "drafted_not_started");
  assert.equal(contract.sidecarContract.lifecycle.processStarted, false);
  assert.equal(contract.sidecarContract.lifecycleProposal.status, "proposal_ready");
  assert.equal(contract.sidecarContract.lifecycleProposal.executionStatus, "deferred");
  assert.equal(contract.sidecarContract.approvalTaskDraft.status, "draft_ready");
  assert.equal(contract.sidecarContract.approvalTaskDraft.createsTaskNow, false);
  assert.equal(contract.sidecarContract.approvalTaskDraft.processStartEnabled, false);
  assert.equal(contract.sidecarContract.forbidden.desktopWideCapture, true);
});

test("trusted work-view contract detects divergent browser runtime session identity", () => {
  const contract = buildTrustedWorkViewContract({
    source: "screen-sense",
    sessionAuthority: "openclaw-session-manager",
    authoritativeSessionId: "session-manager-1",
    componentSessionId: "browser-local-2",
    browserRuntimeSessionId: "browser-local-2",
    session: {
      sessionId: "session-manager-1",
      status: "running",
    },
    workView: {
      status: "ready",
      helperStatus: "active",
      browserStatus: "running",
      activeUrl: "https://example.com/work-view",
    },
    browser: {
      running: true,
      sessionId: "browser-local-2",
    },
  });

  assert.equal(contract.sessionIdentity.status, "divergent");
  assert.equal(contract.sessionIdentity.authority, "openclaw-session-manager");
  assert.equal(contract.sessionIdentity.alignment.component, "divergent");
  assert.equal(contract.sessionIdentity.alignment.browserRuntime, "divergent");
  assert.equal(contract.sessionIdentity.rootRequired, false);
  assert.equal(contract.sessionIdentity.hostMutation, false);
});

test("trusted work-view contract reports degraded helper state", () => {
  const contract = buildTrustedWorkViewContract({
    source: "screen-sense",
    session: {
      status: "running",
    },
    workView: {
      status: "prepared",
      helperStatus: "degraded",
      browserStatus: "unavailable",
    },
  });

  assert.equal(contract.readiness, "degraded");
  assert.equal(contract.helperReadiness.state, "degraded");
  assert.equal(contract.recoveryRecommendation.endpoint, "/work-view/prepare");
  assert.equal(contract.recoveryRecommendation.canRecoverWithoutRoot, true);
  assert.equal(contract.captureProvenance.visibleToObserver, true);
  assert.equal(contract.deferred.rootSessionDaemon, true);
  assert.equal(contract.deferred.graphicsStackNativeWorkspace, true);
});

test("trusted work-view contract recommends reveal for prepared hidden work view", () => {
  const contract = buildTrustedWorkViewContract({
    source: "session-manager",
    session: {
      status: "running",
      displayTarget: "workspace-2",
    },
    workView: {
      status: "prepared",
      visibility: "hidden",
      mode: "background",
      captureStrategy: "browser-runtime",
      helperStatus: "active",
      browserStatus: "running",
      activeUrl: "https://example.com/hidden",
    },
  });

  assert.equal(contract.readiness, "ready");
  assert.equal(contract.helperReadiness.state, "prepared_hidden");
  assert.equal(contract.recoveryRecommendation.action, "reveal_work_view");
  assert.equal(contract.recoveryRecommendation.endpoint, "/work-view/reveal");
  assert.equal(contract.recoveryRecommendation.rootRequired, false);
});
