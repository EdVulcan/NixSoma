import assert from "node:assert/strict";
import test from "node:test";

import { projectBrowserSemanticActionEvidence } from "../src/browser-semantic-action-evidence.mjs";

test("browser semantic action audit evidence excludes local target authority", () => {
  const evidence = projectBrowserSemanticActionEvidence({
    registry: "openclaw-browser-semantic-target-action-v0",
    operation: "click",
    status: "executed",
    targetId: "frame-7-target-2",
    inventorySha256: "b".repeat(64),
    frame: { sha256: "a".repeat(64), sequence: 7 },
    position: { x: 100, y: 200 },
    selector: "#private",
  });

  assert.equal(evidence.operation, "click");
  assert.deepEqual(evidence.frame, { sha256: "a".repeat(64), sequence: 7 });
  assert.equal(JSON.stringify(evidence).includes("frame-7-target-2"), false);
  assert.equal(JSON.stringify(evidence).includes("inventorySha256"), false);
  assert.equal(JSON.stringify(evidence).includes("#private"), false);
  assert.equal(JSON.stringify(evidence).includes('"position"'), false);
});
