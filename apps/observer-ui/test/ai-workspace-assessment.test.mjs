import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientAuthScript } from "../src/client-script-auth.mjs";
import { observerClientRuntimeAiWorkspaceProjectionScript } from "../src/client-script-runtime-ai-workspace-projection.mjs";

test("Observer exposes one task-bound AI workspace assessment command", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="ai-workspace-assessment-status"'), true);
  assert.equal(panel.includes('id="assess-ai-workspace-button"'), true);

  const script = observerClientRuntimeAiWorkspaceProjectionScript;
  for (const token of [
    'capabilityId: "sense.ai.workspace.assessment"',
    'result.registry !== "nixsoma-ai-workspace-task-assessment-v0"',
    'new Set(["complete", "incomplete", "blocked", "unknown"])',
    "governance.maximumProviderCalls !== 1",
    "governance.maximumActions !== 0",
    "governance.actionExecuted !== false",
    "governance.taskMutated !== false",
    "governance.automaticContinuation !== false",
    "governance.semanticSceneBound !== true",
    "governance.currentBrowserSurfaceBound !== true",
    "governance.taskObjectiveBound !== true",
    "result.evidence?.completionAudit !== true",
    "aiWorkspaceAssessmentTaskId !== taskId",
    'clearAiWorkspaceAssessment("operator auth required")',
  ]) {
    const source = token.includes("operator auth") ? observerClientAuthScript : script;
    assert.equal(source.includes(token), true, `assessment UI is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("sense.ai.workspace.assessment"), true);
});
