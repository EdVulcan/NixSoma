import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import {
  observerClientRuntimeAiWorkspaceSemanticFormWorkflowScript,
} from "../src/client-script-runtime-ai-workspace-semantic-form-workflow.mjs";

test("Observer exposes one bounded semantic type and submit workflow", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-semantic-form-workflow-status"'), true);
  assert.equal(panel.includes('id="run-ai-workspace-semantic-form-workflow-button"'), true);
  assert.equal(panel.includes("Type + Submit"), true);
  assert.equal(panel.includes("semantic-form-input"), false);

  const script = observerClientRuntimeAiWorkspaceSemanticFormWorkflowScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.semantic_form_workflow"',
    'result.registry !== "nixsoma-ai-workspace-semantic-form-workflow-v0"',
    'steps[0]?.actionId !== "type_item"',
    'steps[1]?.actionId !== "click_item"',
    'steps[1]?.semanticSubmitTargetBound !== true',
    'evidence.continuationAudit !== true',
    'evidence.workflowCompletionAudit !== true',
    'governance.continuationAfterVerifiedTypeOnly !== true',
    'governance.automaticTaskCompletion !== false',
    'governance.inputTextPersisted !== false',
    'JSON.stringify(response).includes(\'"inputText"\')',
  ]) {
    assert.equal(script.includes(token), true, `semantic form workflow UI is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.semantic_form_workflow"), true);
});
