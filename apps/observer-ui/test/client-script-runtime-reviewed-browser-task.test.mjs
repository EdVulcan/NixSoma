import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeReviewedBrowserTaskScript } from "../src/client-script-runtime-reviewed-browser-task.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function createContext({ goal = "Inspect the current page" } = {}) {
  const calls = [];
  const launches = [];
  const refreshes = [];
  const messages = [];
  const context = {
    taskGoalInput: { value: goal },
    observerConfig: { coreUrl: "http://core.invalid" },
    taskHistoryFocus: "current-task",
    selectedHistoryTaskId: null,
    taskDetailIdInput: { value: "" },
    getDesiredWorkViewUrl: () => "https://example.com/customer",
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      const body = JSON.parse(options.body);
      return {
        ok: true,
        task: { id: body.includePlan ? "plan-task-1" : "browser-task-1", status: "queued", plan: null },
        plan: body.includePlan ? { strategy: "rule-v1" } : null,
      };
    },
    launchTaskIntoWorkView: async (taskId, targetUrl) => launches.push({ taskId, targetUrl }),
    renderPlanPanel: (value) => {
      context.renderedPlan = value;
    },
    setControlMessage: (message) => messages.push(message),
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("task-list"),
    refreshTaskHistoryDetail: async () => refreshes.push("task-history"),
    refreshOperatorState: async () => refreshes.push("operator"),
    Error,
  };
  vm.runInNewContext(observerClientRuntimeReviewedBrowserTaskScript, context);
  return { context, calls, launches, refreshes, messages };
}

test("Observer creates and binds one reviewed browser task without action authority", async () => {
  const fixture = createContext();
  await fixture.context.createReviewedBrowserTask();

  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, "http://core.invalid/tasks/reviewed-browser");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    goal: "Inspect the current page",
    targetUrl: "https://example.com/customer",
    includePlan: false,
  });
  assert.deepEqual(fixture.launches, [{
    taskId: "browser-task-1",
    targetUrl: "https://example.com/customer",
  }]);
  assert.equal(fixture.context.taskDetailIdInput.value, "browser-task-1");
  assert.deepEqual(fixture.refreshes, ["runtime", "task-list", "task-history", "operator"]);
  assert.match(fixture.messages.at(-1), /bound its work view/u);
});

test("Observer creates a reviewed plan without navigation or execution", async () => {
  const fixture = createContext({ goal: "Plan customer inspection" });
  await fixture.context.createReviewedBrowserTask({ includePlan: true });

  assert.equal(JSON.parse(fixture.calls[0].options.body).includePlan, true);
  assert.deepEqual(fixture.launches, []);
  assert.equal(fixture.context.renderedPlan.id, "plan-task-1");
  assert.match(fixture.messages.at(-1), /Execution remains explicit/u);
});

test("Observer blocks an empty task goal before contacting Core", async () => {
  const fixture = createContext({ goal: "   " });
  await assert.rejects(() => fixture.context.createReviewedBrowserTask(), /Enter a task goal/u);
  assert.equal(fixture.calls.length, 0);
});

test("Operations panel exposes the reviewed task composer instead of demo controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "task-goal-input",
    "work-view-url-input",
    "Create Task",
    "Create Plan",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.equal(panel.includes("Create Demo Task"), false);
});
