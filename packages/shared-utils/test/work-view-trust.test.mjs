import test from "node:test";
import assert from "node:assert/strict";

import { buildTrustedWorkViewContract } from "../src/work-view-trust.mjs";

test("trusted work-view contract records Level 2 boundary without host takeover", () => {
  const contract = buildTrustedWorkViewContract({
    source: "browser-runtime",
    trustedComponent: "openclaw-browser-runtime",
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
  assert.equal(contract.captureProvenance.activeUrl, "https://example.com/work-view");
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
  assert.equal(contract.captureProvenance.visibleToObserver, true);
  assert.equal(contract.deferred.rootSessionDaemon, true);
  assert.equal(contract.deferred.graphicsStackNativeWorkspace, true);
});

