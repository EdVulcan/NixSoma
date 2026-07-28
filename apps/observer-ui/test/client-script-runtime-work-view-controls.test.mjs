import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeWorkViewControlsScript } from "../src/client-script-runtime-work-view-controls.mjs";

function createContext(recommendedAction = "none") {
  const fetchCalls = [];
  const controlCalls = [];
  const sidecarProbeCalls = [];
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
        return { workView: { trustedSession: { recoveryRecommendation: { action: recommendedAction } } } };
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
    postControl: async (path) => controlCalls.push(path),
    startTrustedSidecarLifecycleProbe: async () => sidecarProbeCalls.push("start-probe"),
    setControlMessage: (message) => messages.push(message),
    updateTaskPhase: async () => {},
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("tasks"),
    refreshTaskHistoryDetail: async () => refreshes.push("history"),
    refreshWorkView: async () => refreshes.push("work-view"),
    refreshScreen: async () => refreshes.push("screen"),
  };
  vm.runInNewContext(observerClientRuntimeWorkViewControlsScript, context);
  return { context, fetchCalls, controlCalls, sidecarProbeCalls, messages, refreshes };
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

test("Observer routes fixed workbench start and stop through the governed work-view capability", async () => {
  const fixture = createContext();
  await fixture.context.postWorkView("/work-view/application/start", {}, { refresh: false });
  await fixture.context.postWorkView("/work-view/application/stop", {}, { refresh: false });

  assert.deepEqual(fixture.fetchCalls.map(({ url, options }) => ({
    url,
    body: JSON.parse(options.body),
  })), [
    {
      url: "http://core.invalid/capabilities/invoke",
      body: {
        capabilityId: "act.work_view.control",
        operation: "work_view.application.start",
        params: {},
      },
    },
    {
      url: "http://core.invalid/capabilities/invoke",
      body: {
        capabilityId: "act.work_view.control",
        operation: "work_view.application.stop",
        params: {},
      },
    },
  ]);
  assert.equal(fixture.fetchCalls.some(({ url }) => url.includes("session.invalid/work-view/application")), false);
});

test("Observer binds numeric surface activation to the common work-view capability", async () => {
  const fixture = createContext();
  await fixture.context.postWorkView(
    "/work-view/surface/activate",
    { surfaceId: 44, inventorySequence: 19 },
    { refresh: false },
  );
  assert.deepEqual(JSON.parse(fixture.fetchCalls[0].options.body), {
    capabilityId: "act.work_view.control",
    operation: "work_view.surface.activate",
    params: { surfaceId: 44, inventorySequence: 19 },
  });
  assert.equal(fixture.fetchCalls[0].url, "http://core.invalid/capabilities/invoke");
  assert.equal(fixture.fetchCalls.some(({ url }) => url.includes("session.invalid/work-view/surface")), false);
});

test("Observer maps explicit recovery recommendations to existing owner controls", async () => {
  const resume = createContext("resume_ai_action_authority");
  await resume.context.runRecommendedWorkViewAction();
  assert.deepEqual(resume.controlCalls, ["/control/resume"]);
  assert.deepEqual(resume.sidecarProbeCalls, []);
  assert.deepEqual(resume.refreshes, ["work-view", "screen"]);

  const restart = createContext("restart_approved_trusted_sidecar");
  await restart.context.runRecommendedWorkViewAction();
  assert.deepEqual(restart.controlCalls, []);
  assert.deepEqual(restart.sidecarProbeCalls, ["start-probe"]);
  assert.deepEqual(restart.refreshes, ["work-view", "screen"]);

  const hide = createContext("hide_work_view");
  await hide.context.runRecommendedWorkViewAction();
  assert.equal(hide.fetchCalls[1].url, "http://core.invalid/capabilities/invoke");
  assert.equal(JSON.parse(hide.fetchCalls[1].options.body).operation, "work_view.hide");
});
