import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientRuntimeRefreshersScript } from "../src/client-script-refreshers-runtime.mjs";
import {
  observerClientRuntimeAiWorkspaceNativeIntakeWorkflowScript,
} from "../src/client-script-runtime-ai-workspace-native-intake-workflow.mjs";
import { observerClientRuntimeWorkViewControlsScript } from
  "../src/client-script-runtime-work-view-controls.mjs";
import { observerAiWorkViewPanel } from "../src/observer-panel-ai-work-view.mjs";

test("Observer exposes the fixed native intake lifecycle and one task-bound workflow", () => {
  const panel = observerAiWorkViewPanel();
  for (const token of [
    'id="ai-native-intake-status"',
    'id="ai-native-intake-surface"',
    'id="start-ai-native-intake-button"',
    'id="stop-ai-native-intake-button"',
    'id="ai-workspace-native-intake-workflow-status"',
    'id="run-ai-workspace-native-intake-workflow-button"',
  ]) {
    assert.equal(panel.includes(token), true, `native intake panel is missing ${token}`);
  }
  assert.equal(panel.includes("native-intake-unit-input"), false);
  assert.equal(panel.includes("native-intake-value-input"), false);

  for (const token of [
    "nativeIntakeLifecycle.status",
    "nativeIntakeLifecycle.surfaceAttached",
    "nativeIntakeLifecycle.matchingSurface?.surfaceId",
    "startAiNativeIntakeButton.disabled",
    "stopAiNativeIntakeButton.disabled",
  ]) {
    assert.equal(observerClientRuntimeRefreshersScript.includes(token), true,
      `native intake refresh projection is missing ${token}`);
  }

  for (const token of [
    '"/work-view/application/native-intake/start": "work_view.native_intake.start"',
    '"/work-view/application/native-intake/stop": "work_view.native_intake.stop"',
    'result.application.registry === "nixsoma-ai-native-intake-lifecycle-v0"',
  ]) {
    assert.equal(observerClientRuntimeWorkViewControlsScript.includes(token), true,
      `native intake work-view control is missing ${token}`);
  }

  const workflow = observerClientRuntimeAiWorkspaceNativeIntakeWorkflowScript;
  for (const token of [
    "aiWorkspaceActionInFlight()",
    'capabilityId: "act.ai.workspace.native_intake_workflow"',
    'params: { confirm: true }',
    'result.registry !== "nixsoma-ai-workspace-native-intake-workflow-v0"',
    'started.unitName !== "nixsoma-ai-native-intake.service"',
    'typeStep.actionId !== "type_text"',
    "typeStep.expectedSurfaceBound !== true",
    "evidence.lifecycleStartVerified !== true",
    "evidence.lifecycleStopVerified !== true",
    "evidence.workflowCompletionAudit !== true",
    "governance.maximumLifecycleActions !== 2",
    "governance.arbitraryProcessLaunch !== false",
    "governance.inputTextPersisted !== false",
    "JSON.stringify(response).includes('\"inputText\"')",
  ]) {
    assert.equal(workflow.includes(token), true,
      `native intake workflow UI is missing ${token}`);
  }
  assert.equal(workflow.includes("localStorage"), false);
  assert.equal(workflow.includes("sessionStorage"), false);
  assert.equal(workflow.includes("inputText:"), false);

  const assembled = clientScript();
  assert.equal(assembled.includes("act.ai.workspace.native_intake_workflow"), true);
  assert.equal(assembled.includes("work_view.native_intake.start"), true);
  assert.equal(assembled.includes("work_view.native_intake.stop"), true);
  assert.equal(assembled.includes("observerConfig.sessionManagerUrl}/work-view/application/native-intake"), false);
});
