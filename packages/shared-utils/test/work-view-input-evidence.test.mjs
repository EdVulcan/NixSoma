import test from "node:test";
import assert from "node:assert/strict";

import {
  WORK_VIEW_INPUT_MAX_CHARS,
  buildWriteOnlyInputEvidence,
  hasRedactedWriteOnlyInputAction,
  redactWriteOnlyInputActionTree,
} from "../src/work-view-input-evidence.mjs";

test("write-only input evidence bounds text and exposes metadata only", () => {
  const secret = `credential-${"x".repeat(WORK_VIEW_INPUT_MAX_CHARS)}`;
  const bounded = buildWriteOnlyInputEvidence(secret);
  assert.equal(bounded.text.length, WORK_VIEW_INPUT_MAX_CHARS);
  assert.equal(bounded.evidence.charCount, WORK_VIEW_INPUT_MAX_CHARS);
  assert.equal(bounded.evidence.truncated, true);
  assert.equal(bounded.evidence.textExposed, false);
  assert.equal(JSON.stringify(bounded.evidence).includes("credential"), false);
});

test("write-only input action projection removes nested type payloads", () => {
  const projected = redactWriteOnlyInputActionTree({
    plan: {
      steps: [{ kind: "keyboard.type", params: { text: "private-input", target: "focused" } }],
    },
  });
  const params = projected.plan.steps[0].params;
  assert.equal("text" in params, false);
  assert.equal(params.target, "focused");
  assert.equal(params.inputEvidence.charCount, 13);
  assert.equal(JSON.stringify(projected).includes("private-input"), false);
  assert.equal(hasRedactedWriteOnlyInputAction(projected), true);
});
