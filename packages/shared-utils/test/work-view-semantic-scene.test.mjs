import assert from "node:assert/strict";
import test from "node:test";

import {
  WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS,
  buildProviderWorkViewSemanticScene,
  buildWorkViewSemanticScene,
  normaliseWorkViewSemanticScene,
} from "../src/work-view-semantic-scene.mjs";

const NOW = "2026-07-28T11:00:00.000Z";

function capture(name = "Learn more", count = 1) {
  const frame = {
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
    sha256: "a".repeat(64),
    capturedAt: NOW,
    sequence: 7,
  };
  return {
    visualFrame: frame,
    semanticTargets: {
      available: true,
      frame,
      items: Array.from({ length: count }, (_, index) => ({
        role: "link",
        tag: "a",
        name: index === 0 ? name : `Item ${index + 1}`,
        disabled: false,
        bounds: { x: 120, y: 180 + index, width: 90, height: 24 },
        value: "must-not-survive",
        selector: "#must-not-survive",
      })),
    },
  };
}

test("semantic scene projects bounded visible browser content without action authority", () => {
  const scene = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture(),
    now: Date.parse(NOW),
  });
  const normalised = normaliseWorkViewSemanticScene(scene, { now: Date.parse(NOW) });
  const provider = buildProviderWorkViewSemanticScene(scene);

  assert.equal(scene.available, true);
  assert.equal(scene.itemCount, 1);
  assert.equal(scene.items[0].name, "Learn more");
  assert.match(scene.sceneContentSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(normalised, scene);
  assert.equal(provider.items[0].name, "Learn more");
  assert.equal(JSON.stringify(provider).includes("8123"), false);
  assert.equal(JSON.stringify(provider).includes("sha256"), false);
  assert.equal(JSON.stringify(provider).includes("must-not-survive"), false);
  assert.equal("targetId" in provider.items[0], false);
  assert.equal(provider.exclusions.targetIds, true);
});

test("semantic scene bounds item count and changes its binding when content changes", () => {
  const first = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture("First scene", WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS + 5),
    now: Date.parse(NOW),
  });
  const second = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture("Changed scene", WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS + 5),
    now: Date.parse(NOW),
  });

  assert.equal(first.itemCount, WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS);
  assert.equal(first.truncated, true);
  assert.notEqual(first.sceneContentSha256, second.sceneContentSha256);

  const exact = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture("Same visible scene", WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS),
    now: Date.parse(NOW),
  });
  const truncated = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture("Same visible scene", WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS + 1),
    now: Date.parse(NOW),
  });
  assert.equal(exact.truncated, false);
  assert.equal(truncated.truncated, true);
  assert.deepEqual(exact.items, truncated.items);
  assert.notEqual(exact.sceneContentSha256, truncated.sceneContentSha256);
});

test("semantic scene rejects stale, frame-divergent, or widened contracts", () => {
  const stale = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture(),
    now: Date.parse(NOW) + 2_001,
  });
  assert.equal(stale.available, false);

  const divergentCapture = capture();
  divergentCapture.semanticTargets.frame = {
    ...divergentCapture.semanticTargets.frame,
    sha256: "b".repeat(64),
  };
  assert.equal(buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: divergentCapture,
    now: Date.parse(NOW),
  }).available, false);

  const valid = buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 8123 },
    capture: capture(),
    now: Date.parse(NOW),
  });
  assert.equal(normaliseWorkViewSemanticScene({
    ...valid,
    items: [{ ...valid.items[0], value: "forbidden" }],
  }, { now: Date.parse(NOW) }), null);
  assert.equal(normaliseWorkViewSemanticScene({
    ...valid,
    sceneContentSha256: "b".repeat(64),
  }, { now: Date.parse(NOW) }), null);
});
