import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkViewSemanticScene } from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import { createSemanticSceneClickDispatch } from "../src/semantic-scene-click-dispatch.mjs";

const NOW = "2026-07-28T12:00:00.000Z";

function capture({
  frameSha256 = "a".repeat(64),
  frameSequence = 7,
  disabled = false,
  name = "Continue",
} = {}) {
  const visualFrame = {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: 120,
    sha256: frameSha256,
    capturedAt: NOW,
    sequence: frameSequence,
  };
  return {
    visualFrame,
    semanticTargets: {
      available: true,
      frame: visualFrame,
      items: [
        {
          role: "button",
          name: "Back",
          disabled: false,
          bounds: { x: 20, y: 30, width: 60, height: 24 },
        },
        {
          role: "button",
          name,
          disabled,
          bounds: { x: 120, y: 180, width: 90, height: 24 },
        },
      ],
    },
  };
}

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function harness({ changedScene = false, disabled = false, postCaptureUnavailable = false } = {}) {
  const browser = { running: true, browserPid: 8123 };
  const beforeCapture = capture({ disabled });
  const scene = buildWorkViewSemanticScene({
    browser,
    capture: beforeCapture,
    now: Date.parse(NOW),
  });
  const calls = [];
  const dispatch = createSemanticSceneClickDispatch({
    browserRuntimeUrl: "http://browser-runtime",
    browserRuntimeHeaders: () => ({ authorization: "Bearer private" }),
    now: () => Date.parse(NOW),
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/browser/capture?visual=metadata&semantic=items")) {
        const captureCallCount = calls.filter((call) => call.url.includes("/browser/capture")).length;
        if (captureCallCount > 1 && postCaptureUnavailable) {
          return response({ ok: false }, { ok: false, status: 503 });
        }
        const currentCapture = captureCallCount === 1
          ? capture({ disabled, name: changedScene ? "Changed" : "Continue" })
          : capture({ frameSha256: "b".repeat(64), frameSequence: 8 });
        return response({ ok: true, running: true, browser, capture: currentCapture });
      }
      if (url.endsWith("/browser/click")) {
        const body = JSON.parse(options.body);
        return response({
          ok: true,
          mediation: { accepted: true, leaseMatched: true },
          effect: {
            operation: "click",
            status: "executed",
            targetId: body.semanticTarget.targetId,
            inventorySha256: body.semanticTarget.inventorySha256,
            frame: body.semanticTarget.frame,
          },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });
  const action = {
    sceneContentSha256: scene.sceneContentSha256,
    itemOrdinal: 2,
    browserPid: scene.browserPid,
    semanticFrame: {
      sha256: scene.frame.sha256,
      sequence: scene.frame.sequence,
    },
  };
  return { action, calls, dispatch };
}

test("semantic scene click resolves one ordinal locally and verifies the post-action frame", async () => {
  const { action, calls, dispatch } = harness();
  const result = await dispatch({ action, trustedHelperLease: { leaseId: "lease-1" } });

  assert.equal(result.accepted, true);
  assert.equal(result.status, "executed");
  assert.equal(result.semanticClick.itemOrdinal, 2);
  assert.equal(result.semanticClick.actionExecuted, true);
  assert.equal(result.semanticClick.postActionVerified, true);
  assert.equal(result.semanticClick.postFrameSequenceAdvanced, true);
  assert.equal(calls.filter((call) => call.url.endsWith("/browser/click")).length, 1);
  const clickBody = JSON.parse(calls.find((call) => call.url.endsWith("/browser/click")).options.body);
  assert.equal(clickBody.semanticTarget.targetId, "frame-7-target-2");
  assert.equal(clickBody.semanticTarget.operation, "click");
  assert.equal(JSON.stringify(result).includes("frame-7-target-2"), false);
  assert.equal(JSON.stringify(result).includes("inventorySha256"), false);
});

test("semantic scene click fails before action for an invalid ordinal or disabled item", async () => {
  const invalid = harness();
  const invalidResult = await invalid.dispatch({
    action: { ...invalid.action, itemOrdinal: 3 },
    trustedHelperLease: {},
  });
  assert.equal(invalidResult.reason, "semantic_scene_item_ordinal_invalid");
  assert.equal(invalid.calls.some((call) => call.url.endsWith("/browser/click")), false);

  const disabled = harness({ disabled: true });
  const disabledResult = await disabled.dispatch({ action: disabled.action, trustedHelperLease: {} });
  assert.equal(disabledResult.reason, "semantic_scene_item_disabled");
  assert.equal(disabled.calls.some((call) => call.url.endsWith("/browser/click")), false);
});

test("semantic scene click rejects changed scene or semantic frame before action", async () => {
  const changed = harness({ changedScene: true });
  const changedResult = await changed.dispatch({ action: changed.action, trustedHelperLease: {} });
  assert.equal(changedResult.reason, "semantic_scene_changed");
  assert.equal(changed.calls.some((call) => call.url.endsWith("/browser/click")), false);

  const changedFrame = harness();
  const changedFrameResult = await changedFrame.dispatch({
    action: {
      ...changedFrame.action,
      semanticFrame: { ...changedFrame.action.semanticFrame, sequence: 8 },
    },
    trustedHelperLease: {},
  });
  assert.equal(changedFrameResult.reason, "semantic_scene_frame_changed");
  assert.equal(changedFrame.calls.some((call) => call.url.endsWith("/browser/click")), false);
});

test("semantic scene click records execution once when post-action capture is unavailable", async () => {
  const { action, calls, dispatch } = harness({ postCaptureUnavailable: true });
  const result = await dispatch({ action, trustedHelperLease: {} });

  assert.equal(result.accepted, true);
  assert.equal(result.status, "executed_post_capture_unavailable");
  assert.equal(result.semanticClick.actionExecuted, true);
  assert.equal(result.semanticClick.postActionVerified, false);
  assert.equal(calls.filter((call) => call.url.endsWith("/browser/click")).length, 1);
});
