import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceProjectionScript } from "../src/client-script-runtime-ai-workspace-projection.mjs";

test("Observer exposes one transient local OCR command for the active AI surface", () => {
  const panel = observerAiWorkViewPanel();
  for (const token of [
    'id="ai-workspace-local-ocr-status"',
    'id="run-ai-workspace-local-ocr-button"',
    'id="ai-workspace-local-ocr-output"',
  ]) {
    assert.equal(panel.includes(token), true, `local OCR panel is missing ${token}`);
  }

  const script = observerClientRuntimeAiWorkspaceProjectionScript;
  for (const token of [
    'capabilityId: "sense.ai.workspace.local_ocr"',
    'result.registry !== "nixsoma-ai-workspace-local-ocr-v0"',
    'result.status !== "observed"',
    'result.surface?.surfaceId !== binding.surfaceId',
    'result.inventorySequence !== binding.inventorySequence',
    'items.length > 64',
    'result.characterCount > 4096',
    'governance.providerCalled !== false',
    'governance.maximumProviderCalls !== 0',
    'governance.maximumActions !== 0',
    'governance.textTransient !== true',
    'governance.textPersisted !== false',
    'governance.browserStorage !== false',
    'Object.prototype.hasOwnProperty.call(result.frame ?? {}, "dataUrl")',
    'aiWorkspaceLocalOcrOutput.textContent = items.length > 0',
    'clearAiWorkspaceLocalOcr(reason)',
  ]) {
    assert.equal(script.includes(token), true, `local OCR runtime is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("sense.ai.workspace.local_ocr"), true);
});
