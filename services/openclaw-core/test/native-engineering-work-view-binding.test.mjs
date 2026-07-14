import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeEngineeringWorkViewBindDecision,
  NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
} from "../src/native-engineering-work-view-binding.mjs";

function workViewState({
  sessionId = "session-current",
  workViewId = "work-view-primary",
  actionAuthority = "active",
  leaseMatched = true,
  sessionIdentityStatus = "authoritative",
  sessionStatus = "running",
  workViewStatus = "ready",
} = {}) {
  return {
    session: { sessionId, status: sessionStatus },
    workView: {
      workViewId,
      status: workViewStatus,
      visibility: "hidden",
      mode: "background",
      displayTarget: "workspace-2",
      activeUrl: "https://private.example.invalid/not-in-readback",
      trustedSession: {
        sessionIdentity: { status: sessionIdentityStatus },
        helperRuntime: {
          status: "active",
          actionAuthority,
          leaseMatched,
          leaseId: "lease-secret-not-in-readback",
        },
        recoveryRecommendation: { action: "none" },
      },
    },
  };
}

test("operator-reviewed bind accepts an unbound task only after authoritative revalidation", () => {
  const decision = buildNativeEngineeringWorkViewBindDecision({
    task: { id: "task-engineering-1", status: "completed" },
    taskId: "task-engineering-1",
    workViewState: workViewState(),
    confirm: true,
    now: () => "2026-07-14T12:00:00.000Z",
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.shouldMutate, true);
  assert.equal(decision.status, "ready_to_bind");
  assert.equal(decision.internalBinding.sessionId, "session-current");
  assert.equal(decision.internalBinding.workViewId, "work-view-primary");
  assert.equal(decision.readback.registry, NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY);
  assert.equal(decision.readback.governance.changesTaskStatus, false);
  assert.equal(JSON.stringify(decision.readback).includes("session-current"), false);
  assert.equal(JSON.stringify(decision.readback).includes("lease-secret"), false);
  assert.equal(JSON.stringify(decision.readback).includes("private.example"), false);
});

test("operator-reviewed bind remains explicit and rejects stale or unavailable authority", () => {
  const unconfirmed = buildNativeEngineeringWorkViewBindDecision({
    task: { id: "task-unbound", status: "queued" },
    workViewState: workViewState(),
    confirm: false,
  });
  assert.equal(unconfirmed.status, "operator_confirmation_required");
  assert.equal(unconfirmed.shouldMutate, false);

  const staleSession = buildNativeEngineeringWorkViewBindDecision({
    task: {
      id: "task-stale-session",
      status: "completed",
      workView: { sessionId: "session-old" },
    },
    workViewState: workViewState(),
    confirm: true,
  });
  assert.equal(staleSession.status, "stale_session_binding");
  assert.equal(staleSession.ok, false);

  const staleWorkView = buildNativeEngineeringWorkViewBindDecision({
    task: {
      id: "task-stale-view",
      status: "completed",
      workView: { workViewId: "work-view-old", sessionId: "session-current" },
    },
    workViewState: workViewState(),
    confirm: true,
  });
  assert.equal(staleWorkView.status, "stale_work_view_binding");

  const authorityBlocked = buildNativeEngineeringWorkViewBindDecision({
    task: { id: "task-authority", status: "queued" },
    workViewState: workViewState({ actionAuthority: "suspended", leaseMatched: false }),
    confirm: true,
  });
  assert.equal(authorityBlocked.status, "authority_not_ready");

  const unavailable = buildNativeEngineeringWorkViewBindDecision({
    task: { id: "task-unavailable", status: "queued" },
    readStatus: "unavailable",
    confirm: true,
  });
  assert.equal(unavailable.status, "work_view_state_unavailable");
});

test("operator-reviewed bind is idempotent for the same current session and work view", () => {
  const decision = buildNativeEngineeringWorkViewBindDecision({
    task: {
      id: "task-already-bound",
      status: "paused",
      workView: {
        sessionId: "session-current",
        workViewId: "work-view-primary",
      },
    },
    workViewState: workViewState(),
    confirm: true,
  });

  assert.equal(decision.status, "already_bound");
  assert.equal(decision.ok, true);
  assert.equal(decision.shouldMutate, false);
  assert.equal(decision.readback.governance.mutatesTaskState, false);
});
