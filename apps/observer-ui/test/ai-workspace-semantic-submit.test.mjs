import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceSemanticSubmitScript } from
  "../src/client-script-runtime-ai-workspace-semantic-submit.mjs";

test("Observer exposes semantic submit only after one verified type receipt", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-semantic-submit-status"'), true);
  assert.equal(panel.includes('id="run-ai-workspace-semantic-submit-button"'), true);
  assert.equal(panel.includes('id="ai-workspace-semantic-submit-input"'), false);

  const script = observerClientRuntimeAiWorkspaceSemanticSubmitScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.semantic_submit"',
    'typeInvocationId: receipt.typeInvocationId',
    'result.registry !== "nixsoma-ai-workspace-semantic-submit-v0"',
    'evidence.priorTypeReceiptBound !== true',
    'evidence.authorizationAudit !== true',
    'governance.priorTypeReceiptRequired !== true',
    'governance.semanticSubmitTargetBound !== true',
    'governance.automaticTaskCompletion !== false',
    'governance.keyboardInput !== false',
    'JSON.stringify(result).includes(\'"inputText"\')',
    'aiWorkspaceSemanticTypeReceipt = null',
  ]) {
    assert.equal(script.includes(token), true, `semantic submit UI is missing ${token}`);
  }
  assert.equal(script.includes("itemOrdinal:"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.semantic_submit"), true);
});
