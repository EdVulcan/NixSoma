import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import {
  observerClientRuntimeAiWorkspaceReviewedMultiApplicationMissionScript,
} from "../src/client-script-runtime-ai-workspace-reviewed-multi-application-mission.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";

test("Observer exposes one fixed-order reviewed multi-application mission", () => {
  const panel = observerAiWorkViewPanel();
  for (const token of [
    'id="ai-workspace-reviewed-multi-application-mission-status"',
    'id="run-ai-workspace-reviewed-multi-application-mission-button"',
    "Browser + Native",
  ]) {
    assert.equal(panel.includes(token), true, `multi-app panel is missing ${token}`);
  }
  for (const token of [
    "multi-application-order-input",
    "multi-application-value-input",
    "multi-application-budget-input",
    "multi-application-unit-input",
  ]) {
    assert.equal(panel.includes(token), false);
  }

  const workflow = observerClientRuntimeAiWorkspaceReviewedMultiApplicationMissionScript;
  for (const token of [
    "aiWorkspaceActionInFlight()",
    'capabilityId: "act.ai.workspace.reviewed_multi_application_mission"',
    'params: { confirm: true }',
    'result.registry !== "nixsoma-ai-workspace-reviewed-multi-application-mission-v0"',
    'JSON.stringify(["fixed_browser_form", "fixed_native_intake"])',
    'browser.actionSequence) !== JSON.stringify(["type_item", "click_item"])',
    'native.actionSequence) !== JSON.stringify(["type_text"])',
    "evidence.providerCallCount !== 3",
    "evidence.actionCount !== 3",
    "evidence.lifecycleActionCount !== 2",
    "evidence.fixedActionCount !== 5",
    "evidence.missionCompletionAudit !== true",
    "governance.sameReviewedTaskAcrossApplications !== true",
    "governance.sameExactObjectiveInputAcrossApplications !== true",
    "governance.arbitraryApplicationSelection !== false",
    "governance.inputTextPersisted !== false",
    "JSON.stringify(response).includes('\"expectedInputText\"')",
    "JSON.stringify(response).includes('\"inputText\"')",
  ]) {
    assert.equal(workflow.includes(token), true,
      `multi-app workflow UI is missing ${token}`);
  }
  assert.equal(workflow.includes("localStorage"), false);
  assert.equal(workflow.includes("sessionStorage"), false);
  assert.equal(workflow.includes("expectedInputText:"), false);
  assert.equal(workflow.includes("inputText:"), false);

  const assembled = clientScript();
  assert.equal(assembled.includes("runAiWorkspaceReviewedMultiApplicationMission"), true);
  assert.equal(assembled.includes("act.ai.workspace.reviewed_multi_application_mission"), true);
});
