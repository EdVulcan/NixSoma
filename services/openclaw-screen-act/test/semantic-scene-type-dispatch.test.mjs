import assert from "node:assert/strict";
import test from "node:test";

import { buildWriteOnlyInputEvidence } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";
import { buildWorkViewSemanticScene } from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import {
  createSemanticSceneTypeDispatch,
  normaliseSemanticSceneTypeAction,
} from "../src/semantic-scene-type-dispatch.mjs";

const NOW = "2026-07-28T12:30:00.000Z";
const PRIVATE_TEXT = "NixSoma private input";

function capture({
  frameSha256 = "a".repeat(64),
  frameSequence = 7,
  role = "textbox",
  name = "Search",
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
      items: [{
        role,
        name,
        disabled: false,
        bounds: { x: 120, y: 180, width: 180, height: 32 },
      }],
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

function harness({ role = "textbox", changedScene = false, postCaptureUnavailable = false } = {}) {
  const browser = { running: true, browserPid: 8123 };
  const beforeCapture = capture({ role });
  const scene = buildWorkViewSemanticScene({ browser, capture: beforeCapture, now: Date.parse(NOW) });
  const calls = [];
  const dispatch = createSemanticSceneTypeDispatch({
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
          ? capture({ role, name: changedScene ? "Changed" : "Search" })
          : capture({ role, frameSha256: "b".repeat(64), frameSequence: 8 });
        return response({ ok: true, running: true, browser, capture: currentCapture });
      }
      if (url.endsWith("/browser/input")) {
        const body = JSON.parse(options.body);
        const inputEvidence = buildWriteOnlyInputEvidence(body.text).evidence;
        return response({
          ok: true,
          mediation: { accepted: true, leaseMatched: true },
          inputEvidence,
          effect: {
            operation: "type",
            status: "executed",
            targetId: body.semanticTarget.targetId,
            inventorySha256: body.semanticTarget.inventorySha256,
            frame: body.semanticTarget.frame,
            inputEvidence,
          },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });
  const action = {
    sceneContentSha256: scene.sceneContentSha256,
    itemOrdinal: 1,
    browserPid: scene.browserPid,
    semanticFrame: {
      sha256: scene.frame.sha256,
      sequence: scene.frame.sequence,
    },
    text: PRIVATE_TEXT,
  };
  return { action, calls, dispatch };
}

test("semantic scene type resolves one textbox ordinal and keeps input write-only", async () => {
  const { action, calls, dispatch } = harness();
  const result = await dispatch({ action, trustedHelperLease: { leaseId: "lease-1" } });

  assert.equal(result.accepted, true);
  assert.equal(result.status, "executed");
  assert.equal(result.semanticType.itemOrdinal, 1);
  assert.equal(result.semanticType.actionExecuted, true);
  assert.equal(result.semanticType.postActionVerified, true);
  assert.equal(result.semanticType.inputEvidence.charCount, PRIVATE_TEXT.length);
  const inputCalls = calls.filter((call) => call.url.endsWith("/browser/input"));
  assert.equal(inputCalls.length, 1);
  const inputBody = JSON.parse(inputCalls[0].options.body);
  assert.equal(inputBody.text, PRIVATE_TEXT);
  assert.equal(inputBody.semanticTarget.operation, "type");
  assert.equal(JSON.stringify(result).includes(PRIVATE_TEXT), false);
  assert.equal(JSON.stringify(result).includes(inputBody.semanticTarget.targetId), false);
  assert.equal(JSON.stringify(result).includes("inventorySha256"), false);
});

test("semantic scene type rejects non-textboxes and changed scenes before input", async () => {
  const wrongRole = harness({ role: "link" });
  const wrongRoleResult = await wrongRole.dispatch({ action: wrongRole.action, trustedHelperLease: {} });
  assert.equal(wrongRoleResult.reason, "semantic_scene_item_not_textbox");
  assert.equal(wrongRole.calls.some((call) => call.url.endsWith("/browser/input")), false);

  const changed = harness({ changedScene: true });
  const changedResult = await changed.dispatch({ action: changed.action, trustedHelperLease: {} });
  assert.equal(changedResult.reason, "semantic_scene_changed");
  assert.equal(changed.calls.some((call) => call.url.endsWith("/browser/input")), false);
});

test("semantic scene type rejects invalid input and never retries after execution", async () => {
  const invalid = harness();
  assert.equal(normaliseSemanticSceneTypeAction({
    ...invalid.action,
    text: "x".repeat(2_001),
  }), null);

  const postUnavailable = harness({ postCaptureUnavailable: true });
  const result = await postUnavailable.dispatch({
    action: postUnavailable.action,
    trustedHelperLease: {},
  });
  assert.equal(result.accepted, true);
  assert.equal(result.status, "executed_post_capture_unavailable");
  assert.equal(result.semanticType.actionExecuted, true);
  assert.equal(result.semanticType.postActionVerified, false);
  assert.equal(postUnavailable.calls.filter((call) => call.url.endsWith("/browser/input")).length, 1);
  assert.equal(JSON.stringify(result).includes(PRIVATE_TEXT), false);
});
