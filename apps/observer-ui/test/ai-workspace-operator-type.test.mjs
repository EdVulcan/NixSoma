import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import {
  normaliseAiWorkspaceOperatorTypeText,
  observerClientRuntimeAiWorkspaceOperatorTypeScript,
} from "../src/client-script-runtime-ai-workspace-operator-type.mjs";
import { observerSnapshotPreviewPanel } from "../src/observer-panel-snapshot-preview.mjs";

test("Observer exposes one explicit short native type command", () => {
  const panel = observerSnapshotPreviewPanel();
  for (const token of [
    'id="ai-workspace-operator-type-input"',
    'id="ai-workspace-operator-type-button"',
    'id="ai-workspace-operator-type-status"',
    'maxlength="32"',
    "Type",
  ]) {
    assert.equal(panel.includes(token), true, `operator type panel is missing ${token}`);
  }
});

test("operator native type accepts only the fixed short character set", () => {
  assert.equal(normaliseAiWorkspaceOperatorTypeText("NixSoma input 27"), "NixSoma input 27");
  assert.equal(normaliseAiWorkspaceOperatorTypeText("short_value-1.2"), "short_value-1.2");
  assert.equal(normaliseAiWorkspaceOperatorTypeText(""), null);
  assert.equal(normaliseAiWorkspaceOperatorTypeText("x".repeat(33)), null);
  assert.equal(normaliseAiWorkspaceOperatorTypeText("submit\n"), null);
  assert.equal(normaliseAiWorkspaceOperatorTypeText("ctrl+alt"), null);
});

test("operator native type reuses current authority and clears plaintext", () => {
  const script = observerClientRuntimeAiWorkspaceOperatorTypeScript;
  for (const token of [
    "currentAiSurfaceActionBinding()",
    'capabilityId: "act.screen.pointer_keyboard"',
    'operation: "keyboard.type"',
    'result.registry !== "openclaw-screen-keyboard-capability-v0"',
    "result.governance?.nativeTextInput !== true",
    "result.governance?.currentActiveSurfaceBound !== true",
    "visual.inputTextPersisted !== false",
    "visual.hotkeyInput !== false",
    "visual.enterKeyInput !== false",
    'aiWorkspaceOperatorTypeInput.value = ""',
    'text = ""',
    'event.key === "Enter"',
  ]) {
    assert.equal(script.includes(token), true, `operator type runtime is missing ${token}`);
  }
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
  assert.equal(clientScript().includes("write-only characters into AI surface"), true);
});
