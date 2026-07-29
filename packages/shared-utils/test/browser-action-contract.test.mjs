import test from "node:test";
import assert from "node:assert/strict";

import {
  BROWSER_CURRENT_TAB_CLOSE_ACTION,
  BROWSER_CURRENT_TAB_CLOSE_REGISTRY,
  BROWSER_NEW_TAB_ACTION,
  browserActionDescriptor,
  buildBrowserCurrentTabCloseEffect,
} from "../src/browser-action-contract.mjs";

test("browser action descriptors bind fixed runtime and screen-act routes", () => {
  assert.equal(browserActionDescriptor("browser.new_tab"), BROWSER_NEW_TAB_ACTION);
  assert.equal(browserActionDescriptor("browser.current_tab.close"), BROWSER_CURRENT_TAB_CLOSE_ACTION);
  assert.equal(browserActionDescriptor("browser.close_tab"), null);
  assert.equal(BROWSER_CURRENT_TAB_CLOSE_ACTION.runtimeEndpoint, "/browser/current-tab/close");
  assert.equal(BROWSER_CURRENT_TAB_CLOSE_ACTION.screenActEndpoint, "/act/browser/current-tab/close");
});

test("current-tab close evidence proves one bounded reduction without target authority", () => {
  const effect = buildBrowserCurrentTabCloseEffect({ tabCountBefore: 3, tabCountAfter: 2 });
  assert.equal(effect.registry, BROWSER_CURRENT_TAB_CLOSE_REGISTRY);
  assert.equal(effect.status, "closed");
  assert.equal(effect.currentTabClosed, true);
  assert.equal(effect.lastTabPreserved, true);
  assert.equal(effect.callerSelectedTab, false);
  assert.equal(effect.automaticCleanup, false);
  assert.equal(effect.browserProcessControlled, false);
  assert.equal(effect.browserWindowControlled, false);
  assert.equal("tabId" in effect, false);
  assert.equal("url" in effect, false);
  assert.throws(
    () => buildBrowserCurrentTabCloseEffect({ tabCountBefore: 1, tabCountAfter: 0 }),
    /one tab preserved/u,
  );
  assert.throws(
    () => buildBrowserCurrentTabCloseEffect({ tabCountBefore: 3, tabCountAfter: 1 }),
    /exact one-tab reduction/u,
  );
});
