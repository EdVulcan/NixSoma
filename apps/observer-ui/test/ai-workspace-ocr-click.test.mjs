import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceOcrClickScript } from
  "../src/client-script-runtime-ai-workspace-ocr-click.mjs";

test("Observer exposes one task-bound OCR ordinal click without arbitrary coordinates", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-ocr-click-status"'), true);
  assert.equal(panel.includes('id="ocr-click-ai-workspace-button"'), true);

  const script = observerClientRuntimeAiWorkspaceOcrClickScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.ocr_click"',
    'result.registry !== "nixsoma-ai-workspace-ocr-click-v0"',
    'governance.localOcrRevalidated !== true',
    'governance.currentActiveSurfaceBound !== true',
    'governance.ocrItemOrdinalBound !== true',
    'governance.ocrTextPersistedLocally !== false',
    'governance.pixelsProviderEgress !== false',
    'governance.arbitraryPointerInput !== false',
    'evidence.postActionVerified !== true',
    'clearAiWorkspaceOcrClick("unavailable")',
  ]) {
    assert.equal(script.includes(token), true, `OCR click UI is missing ${token}`);
  }
  assert.equal(script.includes("targetX"), false);
  assert.equal(script.includes("targetY"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.ocr_click"), true);
});
