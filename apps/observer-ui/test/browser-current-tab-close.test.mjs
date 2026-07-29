import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientRuntimeActionsScript } from "../src/client-script-runtime-actions.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

test("Observer exposes only the governed current AI-browser tab close", () => {
  const panel = observerOperationsPanels();
  assert.equal(panel.includes('id="close-current-tab-action-button"'), true);
  assert.equal(panel.includes("Close Current Tab"), true);
  assert.equal(panel.includes("tabId"), false);

  const script = observerClientRuntimeActionsScript;
  for (const token of [
    'capabilityId: "act.browser.current_tab.close"',
    'operation: "browser.current_tab.close"',
    "params: { confirm: true }",
    "summary.browserRuntimeExecuted !== true",
    "summary.currentTabOnly !== true",
    "summary.noCallerTabSelection !== true",
    "summary.noAutomaticCleanup !== true",
    "summary.minimumTabPreserved !== true",
    "summary.noProcessOrWindowControl !== true",
  ]) {
    assert.equal(script.includes(token), true, `current-tab close UI is missing ${token}`);
  }
  assert.equal(script.includes("tabId:"), false);
  assert.equal(script.includes("tabIndex:"), false);
  assert.equal(script.includes("automaticCleanup: true"), false);
  const assembled = clientScript();
  assert.equal(assembled.includes("closeCurrentTabActionButton.addEventListener"), true);
  assert.equal(assembled.includes("runBrowserCurrentTabCloseCapability()"), true);
});
