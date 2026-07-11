import test from "node:test";
import assert from "node:assert/strict";

import {
  WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS,
  projectWorkViewSemanticTargets,
  summariseWorkViewSemanticTargets,
} from "../src/work-view-semantic-targets.mjs";

function inventory(items) {
  return {
    available: true,
    pageUrl: "http://127.0.0.1/work-view",
    frame: {
      sha256: "a".repeat(64),
      sequence: 7,
      capturedAt: "2026-07-11T02:00:00.000Z",
    },
    items,
  };
}

test("semantic targets bind bounded visible metadata to one visual frame", () => {
  const projected = projectWorkViewSemanticTargets(inventory([{
    role: "button",
    tag: "BUTTON",
    name: "  Run   bounded action  ",
    disabled: false,
    bounds: { x: 12.4, y: 18.8, width: 140.2, height: 32.1 },
    value: "must-not-survive",
    selector: "#must-not-survive",
  }]));
  assert.equal(projected.available, true);
  assert.equal(projected.itemCount, 1);
  assert.equal(projected.items[0].targetId, "frame-7-target-1");
  assert.equal(projected.items[0].name, "Run bounded action");
  assert.deepEqual(projected.items[0].bounds, { x: 12, y: 19, width: 140, height: 32 });
  assert.equal(projected.inputValuesExposed, false);
  assert.equal(projected.selectorsExposed, false);
  assert.equal(JSON.stringify(projected).includes("must-not-survive"), false);
  assert.match(projected.inventorySha256, /^[a-f0-9]{64}$/u);

  const summary = summariseWorkViewSemanticTargets(projected);
  assert.equal("items" in summary, false);
  assert.equal(summary.inventorySha256, projected.inventorySha256);
});

test("semantic targets enforce item, text, and viewport bounds", () => {
  const projected = projectWorkViewSemanticTargets(inventory(Array.from(
    { length: WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS + 4 },
    (_, index) => ({
      role: "button",
      tag: "button",
      name: `target-${index}-${"x".repeat(200)}`,
      bounds: { x: -10, y: -20, width: 2000, height: 900 },
    }),
  )));
  assert.equal(projected.itemCount, WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS);
  assert.equal(projected.truncated, true);
  assert.equal(projected.items[0].name.length <= 120, true);
  assert.deepEqual(projected.items[0].bounds, { x: 0, y: 0, width: 960, height: 540 });
});
