import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceOcrAssessmentScript } from
  "../src/client-script-runtime-ai-workspace-ocr-assessment.mjs";

test("Observer exposes one task-bound OCR assessment command without assessment acceptance", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-ocr-assessment-status"'), true);
  assert.equal(panel.includes('id="ocr-assess-ai-workspace-button"'), true);

  const script = observerClientRuntimeAiWorkspaceOcrAssessmentScript;
  for (const token of [
    'capabilityId: "sense.ai.workspace.ocr_assessment"',
    'result.registry !== "nixsoma-ai-workspace-ocr-assessment-v0"',
    'governance.localOcrBound !== true',
    'governance.localOcrRevalidated !== true',
    'governance.ocrTextProviderEgress !== true',
    'governance.ocrTextPersistedLocally !== false',
    'governance.pixelsProviderEgress !== false',
    'evidence.ocrItemCount > 24',
    'evidence.ocrCharacterCount > 1200',
    'Object.prototype.hasOwnProperty.call(result, "items")',
    'clearAiWorkspaceOcrAssessment("unavailable")',
  ]) {
    assert.equal(script.includes(token), true, `OCR assessment UI is missing ${token}`);
  }
  assert.equal(script.includes("accept_assessment"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("sense.ai.workspace.ocr_assessment"), true);
});
