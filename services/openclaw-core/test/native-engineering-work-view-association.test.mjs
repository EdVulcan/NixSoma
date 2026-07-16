import test from "node:test";
import assert from "node:assert/strict";

import {
  NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY,
  NATIVE_ENGINEERING_WORK_VIEW_OBSERVATION_REGISTRY,
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
          sidecar: {
            captureSourceStatus: "ready",
            captureFreshness: "fresh",
            captureAgeMs: 120,
            captureStaleAfterMs: 3_000,
            captureObservation: {
              registry: "openclaw-trusted-work-view-sidecar-capture-observation-v0",
              activeUrl: "https://private.example.invalid/should-not-appear",
              title: "private title should not appear",
              sequence: 7,
              tabCount: 2,
              visibleTextBlockCount: 3,
              visualFrame: {
                available: true,
                fresh: true,
                sequence: 12,
                sha256: "a".repeat(64),
                pageUrl: "https://private.example.invalid/frame",
                width: 960,
                height: 540,
                byteLength: 12_000,
                sourceScope: "ai_owned_page_only",
              },
              semanticTargets: {
                available: true,
                itemCount: 2,
                truncated: false,
                inventorySha256: "b".repeat(64),
                frameSequence: 12,
                frameSha256: "a".repeat(64),
                items: [{ name: "private target should not appear" }],
              },
            },
          },
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
    includeWorkViewObservation: true,
    now: () => "2026-07-14T12:00:00.000Z",
  });

  assert.equal(association.ok, true);
  assert.equal(association.registry, NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY);
  assert.equal(association.identityLevel, "Level 2: trusted session/work-view component");
  assert.equal(association.summary.status, "bound");
  assert.equal(association.summary.bindingStatus, "bound");
  assert.equal(association.authority.leaseMatched, true);
  assert.equal(association.observation.registry, NATIVE_ENGINEERING_WORK_VIEW_OBSERVATION_REGISTRY);
  assert.equal(association.observation.status, "ready");
  assert.equal(association.observation.freshness, "fresh");
  assert.equal(association.observation.visualFrame.sha256, "a".repeat(64));
  assert.equal(association.observation.semanticTargets.itemCount, 2);
  assert.equal(association.observation.pageReferencePresent, true);
  assert.equal(association.summary.semanticTargetCount, 2);
  assert.equal(association.semanticActionDecision.status, "ready_for_target_selection");
  assert.equal(association.semanticActionDecision.reason, null);
  assert.equal(association.summary.semanticActionReady, true);
  assert.equal(association.governance.readsSemanticActionDecision, true);
  assert.equal(association.governance.exposesLeaseId, false);
  assert.equal(association.governance.exposesActiveUrl, false);
  assert.equal(association.governance.exposesVisualFrameBytes, false);
  assert.equal(association.governance.exposesSemanticTargetItems, false);
  assert.equal(association.governance.readsTrustedWorkViewObservation, true);
  assert.equal(JSON.stringify(association).includes("lease-secret"), false);
  assert.equal(JSON.stringify(association).includes("private.example"), false);
  assert.equal(JSON.stringify(association).includes("private target"), false);
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
  assert.equal(stale.semanticActionDecision.reason, "work_view_binding_stale");

  const unavailable = buildNativeEngineeringWorkViewAssociation({
    taskId: "task-missing",
    readStatus: "unavailable",
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.summary.status, "work_view_state_unavailable");
  assert.equal(unavailable.semanticActionDecision.reason, "task_selection_required");
  assert.equal(unavailable.governance.exposesLeaseId, false);
});
