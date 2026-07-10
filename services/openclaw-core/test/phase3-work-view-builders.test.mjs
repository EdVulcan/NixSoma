import test from "node:test";
import assert from "node:assert/strict";

import { createPhase3WorkViewBuilders } from "../src/phase3-work-view-builders.mjs";

function createPhase3Harness(overrides = {}) {
  const fetchUrls = [];
  const workViewState = overrides.workViewState ?? {
    session: {
      id: "session-1",
    },
    workView: {
      visibility: "hidden",
      mode: "background",
      captureStrategy: "browser-runtime",
      displayTarget: "workspace-2",
      trustedSession: {
        identityLevel: "level_2_trusted_session_work_view",
        sessionIdentity: {
          status: "authoritative",
          authority: "openclaw-session-manager",
          authoritativeSessionId: "session-1",
          componentSessionId: "session-1",
          browserRuntimeSessionId: "session-1",
          alignment: {
            component: "matched",
            browserRuntime: "matched",
          },
        },
        boundary: {
          workViewScope: "ai_owned_work_view_only",
          desktopWideCapture: false,
          rootRequired: false,
        },
        operatorGates: {
          reveal: "explicit_operator_action",
        },
        recoveryRecommendation: {
          action: "reveal_work_view",
          rootRequired: false,
        },
        sidecarContract: {
          status: "drafted_not_started",
          lifecycle: {
            processStarted: false,
            rootRequired: false,
          },
          lifecycleProposal: {
            status: "proposal_ready",
            executionStatus: "deferred",
          },
          approvalTaskDraft: {
            status: "draft_ready",
            createsTaskNow: false,
            processStartEnabled: false,
          },
        },
      },
    },
  };
  const builders = createPhase3WorkViewBuilders({
    sessionManagerUrl: "http://127.0.0.1:4102",
    fetchJson: async (url) => {
      fetchUrls.push(url);
      if (overrides.rejectWorkView === true) {
        throw new Error("work view unavailable");
      }
      return workViewState;
    },
    buildOperatorState: () => overrides.operatorState ?? {
      status: "idle",
      blocked: false,
      policy: {
        respectsPause: true,
      },
      summary: {
        counts: {
          queued: 0,
        },
      },
    },
  });
  return { builders, fetchUrls };
}

test("phase 3 work-view builders preserve plan and background work-view contracts", async () => {
  const { builders, fetchUrls } = createPhase3Harness();

  const plan = await builders.buildPhase3Plan();
  const background = await builders.buildPhase3BackgroundWorkView();

  assert.equal(plan.registry, "openclaw-phase-3-plan-v0");
  assert.equal(plan.summary.ready, true);
  assert.equal(plan.next.recommendedSlice, "openclaw-phase-3-background-work-view");
  assert.equal(background.registry, "openclaw-phase-3-background-work-view-v0");
  assert.equal(background.summary.ready, true);
  assert.equal(background.summary.defaultForegroundSteal, false);
  assert.equal(background.workViewContract.defaultVisibility, "hidden");
  assert.equal(background.workViewContract.defaultMode, "background");
  assert.equal(background.workViewContract.trustedSession.identityLevel, "level_2_trusted_session_work_view");
  assert.equal(background.workViewContract.trustedSession.sessionIdentity.status, "authoritative");
  assert.equal(background.workViewContract.trustedSession.sessionIdentity.alignment.browserRuntime, "matched");
  assert.equal(background.workViewContract.trustedSession.boundary.desktopWideCapture, false);
  assert.equal(background.workViewContract.trustedSession.recoveryRecommendation.action, "reveal_work_view");
  assert.equal(background.workViewContract.trustedSession.sidecarContract.status, "drafted_not_started");
  assert.equal(background.workViewContract.trustedSession.sidecarContract.lifecycleProposal.status, "proposal_ready");
  assert.equal(background.workViewContract.trustedSession.sidecarContract.approvalTaskDraft.status, "draft_ready");
  assert.equal(background.summary.total, 5);
  assert.deepEqual(fetchUrls, ["http://127.0.0.1:4102/work-view/state"]);
});

test("phase 3 work-view builders close operator controls, readiness, and exit", async () => {
  const { builders } = createPhase3Harness();

  const controls = await builders.buildPhase3OperatorInterruptControls();
  const readiness = await builders.buildPhase3CompletionReadiness();
  const exit = await builders.buildPhase3Exit();

  assert.equal(controls.registry, "openclaw-phase-3-operator-interrupt-controls-v0");
  assert.equal(controls.summary.ready, true);
  assert.equal(controls.summary.takeoverSupported, true);
  assert.equal(controls.operator.policy.respectsPause, true);
  assert.equal(readiness.registry, "openclaw-phase-3-completion-readiness-v0");
  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.governance.stealsForeground, false);
  assert.equal(exit.registry, "openclaw-phase-3-exit-v0");
  assert.equal(exit.summary.complete, true);
  assert.equal(exit.next.recommendedSlice, "openclaw-phase-4-plan");
});

test("phase 3 work-view builders preserve fallback read model when session manager is unreachable", async () => {
  const { builders } = createPhase3Harness({
    rejectWorkView: true,
  });

  const background = await builders.buildPhase3BackgroundWorkView();

  assert.equal(background.registry, "openclaw-phase-3-background-work-view-v0");
  assert.equal(background.summary.ready, false);
  assert.equal(background.current.reachable, false);
  assert.equal(background.current.error, "work view unavailable");
  assert.equal(background.governance.mutatesHost, false);
});
