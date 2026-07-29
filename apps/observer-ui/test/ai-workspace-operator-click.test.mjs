import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import {
  mapAiWorkspaceProjectionPoint,
  observerClientRuntimeAiWorkspaceOperatorClickScript,
} from "../src/client-script-runtime-ai-workspace-operator-click.mjs";
import { observerSnapshotPreviewPanel } from "../src/observer-panel-snapshot-preview.mjs";
import { observerStyles } from "../src/observer-styles.mjs";

test("Observer exposes an explicitly armed one-shot projected click control", () => {
  const panel = observerSnapshotPreviewPanel();
  for (const token of [
    'id="ai-workspace-operator-click-toggle"',
    'id="ai-workspace-operator-click-status"',
    'type="checkbox"',
    "One click",
  ]) {
    assert.equal(panel.includes(token), true, `operator click panel is missing ${token}`);
  }
  assert.equal(observerStyles().includes(".work-view-frame.operator-click-ready"), true);
});

test("projected click coordinates map exactly into the fixed native output", () => {
  const rect = { left: 100, top: 50, width: 640, height: 360 };
  assert.deepEqual(mapAiWorkspaceProjectionPoint({ clientX: 100, clientY: 50, rect }), { x: 0, y: 0 });
  assert.deepEqual(mapAiWorkspaceProjectionPoint({ clientX: 420, clientY: 230, rect }), { x: 640, y: 360 });
  assert.deepEqual(mapAiWorkspaceProjectionPoint({ clientX: 739.9, clientY: 409.9, rect }), { x: 1279, y: 719 });
  assert.throws(
    () => mapAiWorkspaceProjectionPoint({ clientX: 740, clientY: 410, rect }),
    /outside the projected output/u,
  );
  assert.throws(
    () => mapAiWorkspaceProjectionPoint({ clientX: 100, clientY: 50, rect: { ...rect, width: 0 } }),
    /geometry is invalid/u,
  );
});

test("projected click reuses the governed native owner and automatically disarms", () => {
  const script = observerClientRuntimeAiWorkspaceOperatorClickScript;
  for (const token of [
    "event.isTrusted !== true",
    "currentAiSurfaceActionBinding()",
    "aiWorkspaceProjectionFrame.clientWidth",
    'capabilityId: "act.screen.pointer_keyboard"',
    'operation: "mouse.click"',
    'button: "left"',
    'result.registry !== "openclaw-screen-pointer-capability-v0"',
    "result.governance?.currentFrameBound !== true",
    "result.governance?.currentActiveSurfaceBound !== true",
    "result.governance?.automaticDispatch !== false",
    "result.governance?.providerEgress !== false",
    "visual.receiptMatched !== true",
    "visual.inventoryMatched !== true",
    "visual.surfaceMatched !== true",
    'resetAiWorkspaceOperatorClick("clicking")',
    'aiWorkspaceOperatorClickStatus.textContent = "armed"',
  ]) {
    assert.equal(script.includes(token), true, `operator click runtime is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(script.includes("providerPrompt"), false);
  assert.equal(clientScript().includes("Clicked AI surface #"), true);
});
