import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientAuthScript } from "../src/client-script-auth.mjs";
import { observerClientRuntimeAiWorkspaceProjectionScript } from "../src/client-script-runtime-ai-workspace-projection.mjs";
import { observerClientRuntimeRefreshersScript } from "../src/client-script-refreshers-runtime.mjs";
import { observerSnapshotPreviewPanel } from "../src/observer-panel-snapshot-preview.mjs";

test("Observer exposes an explicit browser-page and AI-workspace projection mode", () => {
  const panel = observerSnapshotPreviewPanel();
  for (const token of [
    'role="tablist"',
    'id="browser-page-preview-tab"',
    'id="ai-workspace-preview-tab"',
    'id="browser-page-preview"',
    'id="ai-workspace-preview"',
    'id="ai-workspace-projection-status"',
    'id="ai-workspace-projection-frame"',
  ]) {
    assert.equal(panel.includes(token), true, `projection panel is missing ${token}`);
  }
});

test("Observer projection is operator-only, visible-tab bounded, validated, and transient", () => {
  const script = observerClientRuntimeAiWorkspaceProjectionScript;
  for (const token of [
    "/proxy/session-manager/work-view/compositor-frame",
    "operatorSession?.authenticated",
    'document.visibilityState !== "visible"',
    'aiWorkspaceProjectionMode !== "workspace"',
    "|| !operatorSession?.authenticated) return",
    "AI_WORKSPACE_PROJECTION_INTERVAL_MS = 5000",
    'frame.socketName !== "nixsoma-ai-0"',
    'frame.width !== 1280',
    'frame.height !== 720',
    'frame.byteLength > 262144',
    'frame.dataUrl.startsWith("data:image/png;base64,")',
    'crypto.subtle.digest("SHA-256", bytes)',
    'aiWorkspaceProjectionFrame.removeAttribute("src")',
    "boundary.serverPersistence !== false",
    "boundary.parentDisplayConnected !== false",
    "boundary.inputAuthorityExpanded !== false",
    "aiWorkspaceProjectionBinding = null",
    "currentAiSurfaceScrollBinding()",
    "Date.now() - capturedAtMs <= 2000",
    'operation: "mouse.scroll"',
    'runAiSurfaceScroll("up")',
    'runAiSurfaceScroll("down")',
    'capabilityId: "act.ai.workspace.single_step"',
    'capabilityId: "act.ai.workspace.bounded_run"',
    'capabilityId: "sense.ai.workspace.assessment"',
    'capabilityId: "sense.ai.workspace.local_ocr"',
    "currentAiWorkspaceTaskId()",
    "taskId,",
    "params: { confirm: true }",
    "aiWorkspaceSingleStepInFlight",
    "aiWorkspaceBoundedRunInFlight",
    "aiWorkspaceAssessmentInFlight",
    'governance.automaticRepeat !== false',
    'governance.currentActiveSurfaceBound !== true',
    "governance.taskObjectiveBound !== true",
    "governance.rawTaskGoalProviderEgress !== false",
  ]) {
    assert.equal(script.includes(token), true, `projection runtime is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(script.includes("callerPrompt"), false);
  assert.equal(observerClientAuthScript.includes('clearAiWorkspaceProjection("operator auth required")'), true);
  assert.equal(observerClientRuntimeRefreshersScript.includes("/work-view/compositor-frame"), false);
  assert.equal(clientScript().includes("nixsoma-ai-output-projection-v0"), true);
});
