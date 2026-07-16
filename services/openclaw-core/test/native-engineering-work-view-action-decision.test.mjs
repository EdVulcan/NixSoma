import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeEngineeringWorkViewActionDecision,
  NATIVE_ENGINEERING_WORK_VIEW_ACTION_DECISION_REGISTRY,
} from "../src/native-engineering-work-view-action-decision.mjs";

function readyInput(overrides = {}) {
  return {
    task: { id: "semantic-task-1", status: "queued" },
    binding: { status: "bound", sessionMatched: true, workViewMatched: true },
    authority: { identityStatus: "authoritative", actionAuthority: "active", leaseMatched: true },
    observation: {
      status: "ready",
      freshness: "fresh",
      sequence: 8,
      visualFrame: { available: true, fresh: true, sequence: 8, sha256: "a".repeat(64) },
      semanticTargets: {
        available: true,
        itemCount: 2,
        truncated: false,
        inventorySha256: "b".repeat(64),
        frameSequence: 8,
        frameSha256: "a".repeat(64),
      },
    },
    now: () => "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

test("semantic action decision allows only target selection after matching fresh observation", () => {
  const decision = buildNativeEngineeringWorkViewActionDecision(readyInput());

  assert.equal(decision.ok, true);
  assert.equal(decision.registry, NATIVE_ENGINEERING_WORK_VIEW_ACTION_DECISION_REGISTRY);
  assert.equal(decision.status, "ready_for_target_selection");
  assert.equal(decision.decision, "allow_target_selection");
  assert.equal(decision.readyForTargetSelection, true);
  assert.deepEqual(decision.allowedActionKinds, ["browser.semantic_click"]);
  assert.equal(decision.recommendation.operatorReviewRequired, true);
  assert.equal(decision.recommendation.automaticSelection, false);
  assert.equal(decision.recommendation.automaticDispatch, false);
  assert.equal(decision.governance.selectsTarget, false);
  assert.equal(decision.governance.dispatchesAction, false);
  assert.equal(decision.governance.exposesSemanticTargetItems, false);
});

test("semantic action decision recommends refreshing stale observation without dispatch", () => {
  const decision = buildNativeEngineeringWorkViewActionDecision(readyInput({
    observation: {
      ...readyInput().observation,
      freshness: "stale",
    },
  }));

  assert.equal(decision.status, "blocked");
  assert.equal(decision.reason, "observation_not_fresh");
  assert.equal(decision.readyForTargetSelection, false);
  assert.equal(decision.recommendation.action, "refresh_work_view_observation");
  assert.equal(decision.recommendation.existingObserverControlId, "engineering-context-packet-build-button");
  assert.equal(decision.governance.dispatchesAction, false);
  assert.equal(decision.governance.createsTask, false);
});

test("semantic action decision rejects an inventory that is not bound to the visual frame", () => {
  const decision = buildNativeEngineeringWorkViewActionDecision(readyInput({
    observation: {
      ...readyInput().observation,
      semanticTargets: {
        ...readyInput().observation.semanticTargets,
        frameSequence: 7,
      },
    },
  }));

  assert.equal(decision.status, "blocked");
  assert.equal(decision.reason, "semantic_target_frame_mismatch");
  assert.equal(decision.recommendation.action, "none");
  assert.equal(decision.observation.semanticTargets.itemsExposed, false);
  assert.equal(decision.governance.networkEgress, false);
});
