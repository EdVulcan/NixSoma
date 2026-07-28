import assert from "node:assert/strict";
import test from "node:test";

import {
  WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS,
  buildProviderWorkViewSemanticScene,
  buildWorkViewSemanticScene,
  normaliseWorkViewSemanticScene,
  resolveWorkViewSemanticSceneClick,
  resolveWorkViewSemanticSceneType,
} from "../src/work-view-semantic-scene.mjs";

const NOW = "2026-07-28T11:00:00.000Z";

function capture(name = "Learn more", count = 1, role = "link") {
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
        role,
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

test("semantic scene resolves a provider ordinal to the exact local target reference", () => {
  const browser = { running: true, browserPid: 8123 };
  const currentCapture = capture("First", 2);
  const scene = buildWorkViewSemanticScene({
    browser,
    capture: currentCapture,
    now: Date.parse(NOW),
  });
  const resolution = resolveWorkViewSemanticSceneClick({
    browser,
    capture: currentCapture,
    expectedSceneContentSha256: scene.sceneContentSha256,
    expectedBrowserPid: scene.browserPid,
    expectedFrame: scene.frame,
    itemOrdinal: 2,
    now: Date.parse(NOW),
  });

  assert.equal(resolution.ok, true);
  assert.equal(resolution.itemOrdinal, 2);
  assert.equal(resolution.semanticTarget.targetId, "frame-7-target-2");
  assert.match(resolution.semanticTarget.inventorySha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(resolution.evidence).includes("frame-7-target-2"), false);
});

test("semantic scene resolves type only for the exact current textbox ordinal", () => {
  const browser = { running: true, browserPid: 8123 };
  const currentCapture = capture("Search", 1, "textbox");
  const scene = buildWorkViewSemanticScene({ browser, capture: currentCapture, now: Date.parse(NOW) });
  const resolution = resolveWorkViewSemanticSceneType({
    browser,
    capture: currentCapture,
    expectedSceneContentSha256: scene.sceneContentSha256,
    expectedBrowserPid: scene.browserPid,
    expectedFrame: scene.frame,
    itemOrdinal: 1,
    now: Date.parse(NOW),
  });

  assert.equal(resolution.ok, true);
  assert.equal(resolution.semanticTarget.operation, "type");
  assert.equal(JSON.stringify(resolution.evidence).includes(resolution.semanticTarget.targetId), false);

  const linkCapture = capture("Learn more", 1, "link");
  const linkScene = buildWorkViewSemanticScene({ browser, capture: linkCapture, now: Date.parse(NOW) });
  assert.equal(resolveWorkViewSemanticSceneType({
    browser,
    capture: linkCapture,
    expectedSceneContentSha256: linkScene.sceneContentSha256,
    expectedBrowserPid: linkScene.browserPid,
    expectedFrame: linkScene.frame,
    itemOrdinal: 1,
    now: Date.parse(NOW),
  }).reason, "semantic_scene_item_not_textbox");
});

test("semantic scene click resolution fails closed for invalid, disabled, or changed selections", () => {
  const browser = { running: true, browserPid: 8123 };
  const currentCapture = capture("First", 2);
  const scene = buildWorkViewSemanticScene({ browser, capture: currentCapture, now: Date.parse(NOW) });
  const resolve = (overrides = {}) => resolveWorkViewSemanticSceneClick({
    browser,
    capture: currentCapture,
    expectedSceneContentSha256: scene.sceneContentSha256,
    expectedBrowserPid: scene.browserPid,
    expectedFrame: scene.frame,
    itemOrdinal: 1,
    now: Date.parse(NOW),
    ...overrides,
  });

  assert.equal(resolve({ itemOrdinal: 3 }).reason, "semantic_scene_item_ordinal_invalid");
  assert.equal(resolve({ expectedSceneContentSha256: "b".repeat(64) }).reason, "semantic_scene_changed");
  assert.equal(resolve({ expectedFrame: { ...scene.frame, sequence: 8 } }).reason, "semantic_scene_frame_changed");

  currentCapture.semanticTargets.items[0].disabled = true;
  const disabledScene = buildWorkViewSemanticScene({ browser, capture: currentCapture, now: Date.parse(NOW) });
  assert.equal(resolve({
    expectedSceneContentSha256: disabledScene.sceneContentSha256,
  }).reason, "semantic_scene_item_disabled");
});
