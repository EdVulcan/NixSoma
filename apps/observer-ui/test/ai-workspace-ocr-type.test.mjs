import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceOcrTypeScript } from
  "../src/client-script-runtime-ai-workspace-ocr-type.mjs";

test("Observer exposes one task-bound OCR objective type without caller text", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-ocr-type-status"'), true);
  assert.equal(panel.includes('id="ocr-type-ai-workspace-button"'), true);
  assert.equal(panel.includes('id="ocr-type-ai-workspace-input"'), false);

  const script = observerClientRuntimeAiWorkspaceOcrTypeScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.ocr_type"',
    'result.registry !== "nixsoma-ai-workspace-ocr-type-v0"',
    'value?.registry === "openclaw-write-only-input-evidence-v0"',
    'governance.localOcrRevalidated !== true',
    'governance.currentActiveSurfaceBound !== true',
    'governance.taskObjectiveInputBound !== true',
    'governance.inputTextPersisted !== false',
    'governance.hotkeyInput !== false',
    'governance.enterKeyInput !== false',
    'governance.arbitraryKeyboardInput !== false',
    'evidence.postActionVerified !== true',
    'JSON.stringify(result).includes(\'"inputText"\')',
    'clearAiWorkspaceOcrType("unavailable")',
  ]) {
    assert.equal(script.includes(token), true, `OCR type UI is missing ${token}`);
  }
  assert.equal(script.includes("params: { confirm: true }"), true);
  assert.equal(script.includes("params: { text"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.ocr_type"), true);
});
