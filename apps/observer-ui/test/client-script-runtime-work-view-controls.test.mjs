import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeWorkViewControlsScript } from "../src/client-script-runtime-work-view-controls.mjs";

function createContext() {
  const fetchCalls = [];
  const messages = [];
  const refreshes = [];
  const context = {
    observerConfig: {
      coreUrl: "http://core.invalid",
      sessionManagerUrl: "http://session.invalid",
    },
    currentTaskState: null,
    latestWorkViewState: null,
    getDesiredWorkViewUrl: () => "https://example.com/work-view",
    fetchJson: async (url, options) => {
      fetchCalls.push({ url, options });
      if (url === "http://session.invalid/work-view/state") {
        return { workView: { trustedSession: { recoveryRecommendation: { action: "none" } } } };
      }
      return {
        invoked: true,
        result: {
          workView: {
            status: "ready",
            visibility: "visible",
            mode: "foreground-observable",
            recoveryAction: "none",
          },
        },
      };
    },
    setControlMessage: (message) => messages.push(message),
    updateTaskPhase: async () => {},
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("tasks"),
    refreshTaskHistoryDetail: async () => refreshes.push("history"),
    refreshWorkView: async () => refreshes.push("work-view"),
    refreshScreen: async () => refreshes.push("screen"),
  };
  vm.runInNewContext(observerClientRuntimeWorkViewControlsScript, context);
  return { context, fetchCalls, messages, refreshes };
}

test("Observer routes work-view prepare, reveal, and hide through the common capability owner", async () => {
  const fixture = createContext();

  await fixture.context.postWorkView("/work-view/prepare", {
    displayTarget: "workspace-2",
    entryUrl: "https://example.com/prepare",
  }, { refresh: false });
  await fixture.context.postWorkView("/work-view/reveal", {
    entryUrl: "https://example.com/reveal",
  }, { refresh: false });
  await fixture.context.postWorkView("/work-view/hide", {}, { refresh: false });

  assert.deepEqual(fixture.fetchCalls.map(({ url, options }) => ({
    url,
    body: JSON.parse(options.body),
  })), [
    {
      url: "http://core.invalid/capabilities/invoke",
      body: {
        capabilityId: "act.work_view.control",
        operation: "work_view.prepare",
        params: { displayTarget: "workspace-2", entryUrl: "https://example.com/prepare" },
      },
    },
    {
      url: "http://core.invalid/capabilities/invoke",
      body: {
        capabilityId: "act.work_view.control",
        operation: "work_view.reveal",
        params: { entryUrl: "https://example.com/reveal" },
      },
    },
    {
      url: "http://core.invalid/capabilities/invoke",
      body: {
        capabilityId: "act.work_view.control",
        operation: "work_view.hide",
        params: {},
      },
    },
  ]);
  assert.equal(fixture.fetchCalls.some(({ url }) => url.includes("/work-view/prepare") || url.includes("/work-view/reveal") || url.includes("/work-view/hide")), false);
  assert.equal(fixture.messages.length, 3);
  assert.deepEqual(fixture.refreshes, []);
  assert.doesNotMatch(observerClientRuntimeWorkViewControlsScript, /observerConfig\.sessionManagerUrl.*work-view\/(?:prepare|reveal|hide)/);
});
