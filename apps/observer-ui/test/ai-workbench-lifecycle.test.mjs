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
    'id="start-ai-workbench-button"',
    'id="stop-ai-workbench-button"',
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
  ]) {
    assert.equal(observerClientRuntimeRefreshersScript.includes(token), true, `refresh projection is missing ${token}`);
  }
  assert.equal(observerClientRuntimeBindingsScript.includes('/work-view/application/start'), true);
  assert.equal(observerClientRuntimeBindingsScript.includes('/work-view/application/stop'), true);
});

test("production Observer client assembles workbench controls through Core only", () => {
  const script = clientScript();
  assert.equal(script.includes('"/work-view/application/start": "work_view.application.start"'), true);
  assert.equal(script.includes('"/work-view/application/stop": "work_view.application.stop"'), true);
  assert.equal(script.includes("observerConfig.sessionManagerUrl}/work-view/application"), false);
  assert.equal(script.includes("capabilityId: \"act.work_view.control\""), true);
});
