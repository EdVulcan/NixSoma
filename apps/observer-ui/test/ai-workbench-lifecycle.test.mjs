import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";
import { observerClientRuntimeRefreshersScript } from "../src/client-script-refreshers-runtime.mjs";
import { observerClientRuntimeBindingsScript } from "../src/client-script-runtime-bindings.mjs";

test("Observer exposes bounded fixed workbench lifecycle state and controls", () => {
  const panel = observerAiWorkViewPanel();
  for (const token of [
    'id="ai-workbench-status"',
    'id="ai-workbench-surface"',
    'id="ai-surface-count"',
    'id="ai-surface-select"',
    'id="start-ai-workbench-button"',
    'id="stop-ai-workbench-button"',
    'id="activate-ai-surface-button"',
    'id="scroll-ai-surface-up-button"',
    'id="scroll-ai-surface-down-button"',
    'id="run-ai-workspace-single-step-button"',
    'id="run-ai-workspace-bounded-run-button"',
    'id="assess-ai-workspace-button"',
    'id="ai-workspace-assessment-status"',
  ]) {
    assert.equal(panel.includes(token), true, `AI work-view panel is missing ${token}`);
  }
  assert.equal(observerOperationsPanels().includes(panel), true);

  for (const token of [
    "applicationLifecycle.status",
    "applicationLifecycle.surfaceAttached",
    "surfaceInventory.count",
    "surfaceInventory.boundary?.titleExposed",
    "surfaceInventory.boundary?.pixelsExposed",
    "startAiWorkbenchButton.disabled",
    "stopAiWorkbenchButton.disabled",
    "activateAiSurfaceButton.disabled",
    "aiSurfaceSelect.dataset.sequence",
    "updateAiSurfaceScrollControls()",
  ]) {
    assert.equal(observerClientRuntimeRefreshersScript.includes(token), true, `refresh projection is missing ${token}`);
  }
  assert.equal(observerClientRuntimeBindingsScript.includes('/work-view/application/start'), true);
  assert.equal(observerClientRuntimeBindingsScript.includes('/work-view/application/stop'), true);
  assert.equal(observerClientRuntimeBindingsScript.includes('/work-view/surface/activate'), true);
  const script = clientScript();
  assert.equal(script.includes('operation: "mouse.scroll"'), true);
  assert.equal(script.includes('result.governance?.currentActiveSurfaceBound !== true'), true);
  assert.equal(script.includes('params: { ...binding, direction }'), true);
  assert.equal(script.includes('capabilityId: "act.ai.workspace.single_step"'), true);
  assert.equal(script.includes('capabilityId: "act.ai.workspace.bounded_run"'), true);
  assert.equal(script.includes('capabilityId: "sense.ai.workspace.assessment"'), true);
  assert.equal(script.includes("taskId,"), true);
  assert.equal(script.includes('params: { confirm: true }'), true);
  assert.equal(script.includes("currentAiWorkspaceTaskId()"), true);
  assert.equal(script.includes('binding.mode === "operator_reviewed"'), true);
  assert.equal(script.includes("governance.taskObjectiveBound !== true"), true);
  assert.equal(script.includes('["click_item", "type_item"].includes(actionId)'), true);
  assert.equal(script.includes('JSON.stringify(result).includes(\'"inputText"\')'), true);
  assert.equal(script.includes("governance.providerGeneratedInput !== true"), true);
  assert.equal(script.includes("governance.inputTextPersisted !== false"), true);
  assert.equal(script.includes('result.action?.itemOrdinal'), true);
  assert.equal(script.includes("governance.continuationAfterVerifiedScrollOnly !== true"), true);
  assert.equal(script.includes("governance.terminalAfterSecondStep !== true"), true);
  assert.equal(script.includes('steps[0].actionId'), true);
});

test("production Observer client assembles workbench controls through Core only", () => {
  const script = clientScript();
  assert.equal(script.includes('"/work-view/application/start": "work_view.application.start"'), true);
  assert.equal(script.includes('"/work-view/application/stop": "work_view.application.stop"'), true);
  assert.equal(script.includes('"/work-view/surface/activate": "work_view.surface.activate"'), true);
  assert.equal(script.includes("observerConfig.sessionManagerUrl}/work-view/application"), false);
  assert.equal(script.includes("capabilityId: \"act.work_view.control\""), true);
});
