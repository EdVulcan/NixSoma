import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceOcrFocusTypeScript } from
  "../src/client-script-runtime-ai-workspace-ocr-focus-type.mjs";

test("Observer exposes one task-bound fixed OCR focus-and-type without caller fields", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-ocr-focus-type-status"'), true);
  assert.equal(panel.includes('id="ocr-focus-type-ai-workspace-button"'), true);
  assert.equal(panel.includes('id="ocr-focus-type-ai-workspace-input"'), false);

  const script = observerClientRuntimeAiWorkspaceOcrFocusTypeScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.ocr_focus_type"',
    'result.registry !== "nixsoma-ai-workspace-ocr-focus-type-v0"',
    'governance.maximumActions !== 2',
    'governance.fixedActionSequence !== true',
    'governance.focusRevalidated !== true',
    'governance.ocrItemOrdinalBound !== true',
    'governance.taskObjectiveInputBound !== true',
    'governance.inputTextPersisted !== false',
    'governance.enterKeyInput !== false',
    'governance.automaticRepeat !== false',
    'evidence.focusActionVerified !== true',
    'evidence.postActionVerified !== true',
    'JSON.stringify(result).includes(\'"inputText"\')',
    'clearAiWorkspaceOcrFocusType("unavailable")',
  ]) {
    assert.equal(script.includes(token), true, `OCR focus type UI is missing ${token}`);
  }
  assert.equal(script.includes("params: { confirm: true }"), true);
  assert.equal(script.includes("params: { text"), false);
  assert.equal(script.includes("targetText:"), false);
  assert.equal(script.includes("itemOrdinal:"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.ocr_focus_type"), true);
});
