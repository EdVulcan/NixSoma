import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeEngineeringWorkViewSemanticActionHandoff,
  NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY,
} from "../src/native-engineering-work-view-semantic-action-handoff.mjs";

const frameSha256 = "a".repeat(64);
const inventorySha256 = "b".repeat(64);
const sequence = 7;

function task() {
  return {
    id: "semantic-click-task",
    type: "browser_task",
    status: "running",
    workView: {
      sessionId: "session-1",
      workViewId: "work-view-primary",
    },
  };
}

function screenResponse({ screenInventorySha256 = inventorySha256 } = {}) {
  return {
    ok: true,
    screen: {
      visualFrame: {
        available: true,
        fresh: true,
        sha256: frameSha256,
        sequence,
      },
      semanticTargets: {
        available: true,
        truncated: false,
        inventorySha256: screenInventorySha256,
        frame: { sha256: frameSha256, sequence },
        items: [{
          targetId: `frame-${sequence}-target-1`,
          role: "button",
          name: "Inspect",
          visible: true,
          disabled: false,
        }],
      },
    },
  };
}

function workViewState({ stateInventorySha256 = inventorySha256, freshness = "fresh" } = {}) {
  return {
    ok: true,
    data: {
      workView: {
        workViewId: "work-view-primary",
        status: "ready",
        visibility: "visible",
      },
      session: { sessionId: "session-1", status: "ready" },
      trustedSession: {
        sessionIdentity: { status: "authoritative" },
        helperRuntime: {
          status: "active",
          actionAuthority: "active",
          leaseMatched: true,
          sidecar: {
            captureSourceStatus: "ready",
            captureFreshness: freshness,
            captureObservation: {
              sequence: 12,
              visualFrame: {
                available: true,
                fresh: freshness === "fresh",
                sha256: frameSha256,
                sequence,
              },
              semanticTargets: {
                available: true,
                itemCount: 1,
                truncated: false,
                inventorySha256: stateInventorySha256,
                frameSequence: sequence,
                frameSha256,
              },
            },
          },
        },
      },
    },
  };
}

function action() {
  return {
    kind: "browser.semantic_click",
    params: {
      semanticTarget: {
        registry: "openclaw-browser-semantic-target-reference-v0",
        operation: "click",
        targetId: `frame-${sequence}-target-1`,
        inventorySha256,
        frame: { sha256: frameSha256, sequence },
      },
    },
  };
}

test("semantic click handoff allows one current operator-selected target", () => {
  const handoff = buildNativeEngineeringWorkViewSemanticActionHandoff({
    task: task(),
    action: action(),
    workViewStateResult: workViewState(),
    screenResponse: screenResponse(),
    now: () => "2026-07-16T00:00:00.000Z",
  });

  assert.equal(handoff.ok, true);
  assert.equal(handoff.registry, NATIVE_ENGINEERING_WORK_VIEW_SEMANTIC_ACTION_HANDOFF_REGISTRY);
  assert.equal(handoff.status, "ready_for_dispatch");
  assert.equal(handoff.reason, null);
  assert.equal(handoff.revalidation.workViewAuthorityReady, true);
  assert.equal(handoff.revalidation.stateInventoryMatchesScreen, true);
  assert.equal(handoff.revalidation.screenVisualFrameMatchesReference, true);
  assert.equal(handoff.governance.automaticDispatch, false);
  assert.equal(JSON.stringify(handoff).includes("Inspect"), false);
});

test("semantic click handoff blocks stale trusted capture before dispatch", () => {
  const handoff = buildNativeEngineeringWorkViewSemanticActionHandoff({
    task: task(),
    action: action(),
    workViewStateResult: workViewState({ freshness: "stale" }),
    screenResponse: screenResponse(),
  });

  assert.equal(handoff.ok, false);
  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.reason, "observation_not_fresh");
  assert.equal(handoff.revalidation.workViewAuthorityReady, true);
});

test("semantic click handoff blocks a screen inventory digest mismatch", () => {
  const handoff = buildNativeEngineeringWorkViewSemanticActionHandoff({
    task: task(),
    action: action(),
    workViewStateResult: workViewState({ stateInventorySha256: "c".repeat(64) }),
    screenResponse: screenResponse({ screenInventorySha256: "c".repeat(64) }),
  });

  assert.equal(handoff.ok, false);
  assert.equal(handoff.reason, "semantic_target_capture_mismatch");
  assert.equal(handoff.revalidation.stateInventoryMatchesScreen, true);
  assert.equal(handoff.revalidation.screenInventoryMatchesReference, false);
  assert.equal(handoff.governance.pagePayloadExposed, false);
});
