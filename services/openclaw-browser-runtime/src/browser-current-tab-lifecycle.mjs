import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";
import {
  BROWSER_CURRENT_TAB_CLOSE_ACTION,
  buildBrowserCurrentTabCloseEffect,
} from "../../../packages/shared-utils/src/browser-action-contract.mjs";

function closeSimulatedCurrentTab(browserState, updateBrowserState) {
  const tabCountBefore = browserState.tabs.length;
  if (tabCountBefore < 2) throw new Error("current_tab_close_requires_multiple_tabs");
  let currentIndex = -1;
  for (let index = browserState.tabs.length - 1; index >= 0; index -= 1) {
    if (browserState.tabs[index].url === browserState.activeUrl) {
      currentIndex = index;
      break;
    }
  }
  if (currentIndex < 0) currentIndex = browserState.tabs.length - 1;
  const tabs = browserState.tabs.filter((_, index) => index !== currentIndex);
  const activeTab = tabs.at(-1);
  updateBrowserState({
    tabs,
    activeUrl: activeTab.url,
    activeTitle: activeTab.title,
  });
  return buildBrowserCurrentTabCloseEffect({
    tabCountBefore,
    tabCountAfter: tabs.length,
  });
}

export function createBrowserCurrentTabCloseRoute({
  browserState,
  getBrowserEngine,
  validateBrowserActionMediation,
  applyEngineSnapshot,
  updateBrowserState,
  persistWorkspace,
  serialiseBrowserState,
  publishEvent,
} = {}) {
  return async function handleBrowserCurrentTabClose(req, res) {
    let mediation = null;
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some((key) => key !== "trustedHelperLease")) {
        throw new Error("current_tab_close_rejects_caller_target");
      }
      if (!browserState.running) throw new Error("current_tab_close_browser_not_running");
      mediation = validateBrowserActionMediation(body);
      if (!mediation.accepted) {
        sendJson(res, 409, { ok: false, error: mediation.reason, mediation });
        return;
      }

      const browserEngine = getBrowserEngine();
      let effect;
      if (browserEngine) {
        const result = await browserEngine.closeCurrentTab();
        applyEngineSnapshot(result.snapshot);
        effect = result.effect;
      } else {
        effect = closeSimulatedCurrentTab(browserState, updateBrowserState);
      }
      persistWorkspace();
      const browser = serialiseBrowserState();
      await publishEvent(createEventName("browser.updated"), {
        browser,
        action: BROWSER_CURRENT_TAB_CLOSE_ACTION.kind,
        effect,
      });
      sendJson(res, 200, { ok: true, browser, effect, mediation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "current_tab_close_failed";
      const conflict = message.startsWith("current_tab_close_")
        && message !== "current_tab_close_rejects_caller_target";
      sendJson(res, conflict ? 409 : 400, {
        ok: false,
        error: message,
        mediation: mediation ? {
          ...mediation,
          accepted: false,
          status: "blocked",
          reason: message,
        } : null,
      });
    }
  };
}
