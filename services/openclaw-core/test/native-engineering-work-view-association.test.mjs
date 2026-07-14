import test from "node:test";
import assert from "node:assert/strict";

import {
  NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY,
  buildNativeEngineeringWorkViewAssociation,
} from "../src/native-engineering-work-view-association.mjs";

function state({ helperStatus = "active", actionAuthority = "active", leaseMatched = true } = {}) {
  return {
    session: {
      sessionId: "session-current",
      status: "running",
      role: "ai-work-view",
      displayTarget: "workspace-2",
    },
    workView: {
      workViewId: "work-view-primary",
      status: "ready",
      visibility: "hidden",
      mode: "background",
      captureStrategy: "browser-runtime",
      helperStatus,
      browserStatus: "running",
      activeUrl: "https://private.example.invalid/should-not-appear",
      trustedSession: {
        identityLevel: "level_2_trusted_session_work_view",
        sessionIdentity: {
          status: "authoritative",
          authority: "openclaw-session-manager",
          sessionManagerBacked: true,
          browserRuntimeBacked: true,
        },
        helperRuntime: {
          status: helperStatus,
          actionAuthority,
          leaseMatched,
          scope: "ai_owned_work_view_only",
          leaseId: "lease-secret-should-not-appear",
        },
        recoveryRecommendation: { action: "none" },
      },
    },
  };
}

test("trusted work-view association reports a bound task with compact authority state", () => {
  const association = buildNativeEngineeringWorkViewAssociation({
    task: {
      id: "task-engineering-1",
      type: "native_engineering_lsp_lifecycle",
      status: "running",
      workViewStrategy: "openclaw-native-engineering-lsp-lifecycle",
      workView: {
        sessionId: "session-current",
        workViewId: "work-view-primary",
      },
    },
    taskId: "task-engineering-1",
    workViewState: state(),
    now: () => "2026-07-14T12:00:00.000Z",
  });

  assert.equal(association.ok, true);
  assert.equal(association.registry, NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY);
  assert.equal(association.identityLevel, "Level 2: trusted session/work-view component");
  assert.equal(association.summary.status, "bound");
  assert.equal(association.summary.bindingStatus, "bound");
  assert.equal(association.authority.leaseMatched, true);
  assert.equal(association.governance.exposesLeaseId, false);
  assert.equal(association.governance.exposesActiveUrl, false);
  assert.equal(JSON.stringify(association).includes("lease-secret"), false);
  assert.equal(JSON.stringify(association).includes("private.example"), false);
});

test("trusted work-view association distinguishes stale task binding and unavailable state", () => {
  const stale = buildNativeEngineeringWorkViewAssociation({
    task: {
      id: "task-stale",
      status: "completed",
      workView: { sessionId: "session-old", workViewId: "work-view-primary" },
    },
    taskId: "task-stale",
    workViewState: state(),
  });
  assert.equal(stale.summary.status, "stale_session_binding");
  assert.equal(stale.binding.sessionMatched, false);

  const unavailable = buildNativeEngineeringWorkViewAssociation({
    taskId: "task-missing",
    readStatus: "unavailable",
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.summary.status, "work_view_state_unavailable");
  assert.equal(unavailable.governance.exposesLeaseId, false);
});
