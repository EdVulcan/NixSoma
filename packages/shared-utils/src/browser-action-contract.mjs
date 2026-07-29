export const BROWSER_NEW_TAB_ACTION = Object.freeze({
  kind: "browser.new_tab",
  runtimeEndpoint: "/browser/new-tab",
  screenActEndpoint: "/act/browser/new-tab",
});

export const BROWSER_CURRENT_TAB_CLOSE_ACTION = Object.freeze({
  kind: "browser.current_tab.close",
  runtimeEndpoint: "/browser/current-tab/close",
  screenActEndpoint: "/act/browser/current-tab/close",
});

export const BROWSER_CURRENT_TAB_CLOSE_REGISTRY =
  "openclaw-browser-current-tab-close-v0";

const ACTIONS = new Map([
  [BROWSER_NEW_TAB_ACTION.kind, BROWSER_NEW_TAB_ACTION],
  [BROWSER_CURRENT_TAB_CLOSE_ACTION.kind, BROWSER_CURRENT_TAB_CLOSE_ACTION],
]);

export function browserActionDescriptor(kind) {
  return ACTIONS.get(kind) ?? null;
}

export function buildBrowserCurrentTabCloseEffect({
  tabCountBefore,
  tabCountAfter,
} = {}) {
  if (!Number.isInteger(tabCountBefore)
    || !Number.isInteger(tabCountAfter)
    || tabCountBefore < 2
    || tabCountAfter !== tabCountBefore - 1) {
    throw new Error("Current-tab close effect requires an exact one-tab reduction with one tab preserved.");
  }
  return {
    registry: BROWSER_CURRENT_TAB_CLOSE_REGISTRY,
    operation: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
    status: "closed",
    tabCountBefore,
    tabCountAfter,
    currentTabClosed: true,
    activeTabChanged: true,
    lastTabPreserved: true,
    callerSelectedTab: false,
    automaticCleanup: false,
    browserProcessControlled: false,
    browserWindowControlled: false,
    desktopTakeover: false,
  };
}
