import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerClientRuntimeAiWorkspaceReviewedCycleScript } from
  "../src/client-script-runtime-ai-workspace-reviewed-cycle.mjs";

test("Observer runs one reviewed cycle and reuses explicit assessment acceptance", () => {
  const panel = observerAiWorkViewPanel();
  assert.equal(panel.includes('id="run-ai-workspace-reviewed-cycle-button"'), true);
  assert.equal(panel.includes('id="ai-workspace-reviewed-cycle-status"'), true);
  assert.equal(panel.includes("Run + Assess"), true);

  const script = observerClientRuntimeAiWorkspaceReviewedCycleScript;
  for (const token of [
    'capabilityId: "act.ai.workspace.reviewed_cycle"',
    'result.registry !== "nixsoma-ai-workspace-reviewed-cycle-v0"',
    'assessmentResult.registry !== "nixsoma-ai-workspace-task-assessment-v0"',
    'run.registry !== "nixsoma-ai-workspace-bounded-run-v0"',
    'invocation.authorization?.policyId !== "ai-workspace-explicit-reviewed-cycle"',
    'summary.kind !== "ai.workspace.reviewed_cycle"',
    "evidence.assessmentContinuationAudit !== true",
    "evidence.cycleCompletionAudit !== true",
    "summary.assessmentReceiptEligible === true",
    "governance.automaticTaskCompletion !== false",
    "governance.requiresOperatorAcceptance !== true",
    "governance.providerTriggeredCompletion !== false",
    "assessmentInvocationId: invocation.id",
  ]) {
    assert.equal(script.includes(token), true, `reviewed-cycle UI is missing ${token}`);
  }
  assert.equal(script.includes("acceptAiWorkspaceAssessment()"), false);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("act.ai.workspace.reviewed_cycle"), true);
  assert.equal(clientScript().includes("act.ai.workspace.accept_assessment"), true);
});
