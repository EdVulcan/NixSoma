import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeSemanticTargetTaskScript } from "../src/client-script-runtime-semantic-target-task.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function element() {
  return {
    disabled: false,
    textContent: "",
    value: "",
    listeners: new Map(),
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
    replaceChildren(...children) {
      this.options = children;
    },
    append(option) {
      this.options ??= [];
      this.options.push(option);
    },
  };
}

function createContext() {
  const calls = [];
  const messages = [];
  const refreshes = [];
  const select = element();
  select.options = [];
  const button = element();
  const taskJson = element();
  const context = {
    screenSemanticTargetSelect: select,
    createSemanticClickTaskButton: button,
    screenSemanticTargetTaskJson: taskJson,
    observerConfig: { coreUrl: "http://core.invalid" },
    taskDetailIdInput: { value: "" },
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      const request = JSON.parse(options.body);
      return {
        ok: true,
        task: {
          id: "task-semantic-click-1",
          status: "queued",
          plan: { strategy: "rule-v1" },
          engineeringRecommendationLink: request.engineeringRecommendationLink ?? null,
        },
      };
    },
    document: {
      createElement() {
        return { value: "", textContent: "" };
      },
    },
    URL,
    renderPlanPanel: (value) => {
      context.renderedPlan = value;
    },
    setControlMessage: (message) => messages.push(message),
    formatError: (error) => String(error?.message ?? error),
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("task-list"),
    refreshTaskHistoryDetail: async () => refreshes.push("task-history"),
    refreshOperatorState: async () => refreshes.push("operator"),
  };
  vm.runInNewContext(observerClientRuntimeSemanticTargetTaskScript, context);
  return { context, select, button, taskJson, calls, messages, refreshes };
}

function screen() {
  return {
    workView: { activeUrl: "https://example.com/work" },
    semanticTargets: {
      available: true,
      itemCount: 3,
      items: [
        {
          targetId: "frame-7-target-1",
          role: "link",
          name: "Inspect target",
          visible: true,
          disabled: false,
          bounds: { x: 1, y: 2, width: 10, height: 10 },
        },
        {
          targetId: "frame-7-target-2",
          role: "button",
          name: "Disabled target",
          visible: true,
          disabled: true,
          bounds: { x: 1, y: 2, width: 10, height: 10 },
        },
        {
          targetId: "frame-7-target-3",
          role: "textbox",
          name: "Work input",
          visible: false,
          disabled: false,
          bounds: { x: 1, y: 2, width: 10, height: 10 },
        },
      ],
    },
  };
}

test("Observer exposes only enabled named semantic targets for reviewed task planning", () => {
  const fixture = createContext();
  fixture.context.renderSemanticTargetSelection(screen());

  assert.equal(fixture.select.disabled, false);
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.select.options.length, 1);
  assert.equal(fixture.select.options[0].value, "frame-7-target-1");
  assert.match(fixture.select.options[0].textContent, /link: Inspect target/u);
  assert.match(fixture.taskJson.textContent, /operator step required/u);
});

test("Observer creates a queued semantic click plan without dispatching it", async () => {
  const fixture = createContext();
  fixture.context.renderSemanticTargetSelection(screen());

  await fixture.context.createOperatorReviewedSemanticClickTask();

  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, "http://core.invalid/tasks/plan");
  const request = JSON.parse(fixture.calls[0].options.body);
  assert.equal(request.type, "browser_task");
  assert.equal(request.targetUrl, "https://example.com/work");
  assert.equal(request.intent, "browser.semantic_click");
  assert.deepEqual(request.actions, [{
    kind: "browser.semantic_click",
    params: { target: { name: "Inspect target", role: "link" } },
  }]);
  assert.equal("targetId" in request.actions[0].params.target, false);
  assert.equal("bounds" in request.actions[0].params.target, false);
  assert.equal(fixture.context.taskDetailIdInput.value, "task-semantic-click-1");
  assert.deepEqual(fixture.refreshes, ["runtime", "task-list", "task-history", "operator"]);
  assert.match(fixture.taskJson.textContent, /executionStarted": false/u);
  assert.match(fixture.messages.at(-1), /execution remains explicit/u);
});

test("Observer forwards compact AI recommendation provenance into the queued semantic click plan", async () => {
  const fixture = createContext();
  fixture.context.renderSemanticTargetSelection(screen());
  const link = {
    registry: "openclaw-native-engineering-recommendation-link-v0",
    source: { taskId: "provider-task-42" },
    action: { actionId: "create_semantic_click_task" },
  };

  await fixture.context.createOperatorReviewedSemanticClickTask(link);

  const request = JSON.parse(fixture.calls[0].options.body);
  assert.deepEqual(request.engineeringRecommendationLink, link);
  assert.match(fixture.taskJson.textContent, /guidanceSourceTaskId": "provider-task-42"/u);
  assert.match(fixture.taskJson.textContent, /guidanceActionId": "create_semantic_click_task"/u);
});

test("Observer disables reviewed semantic task planning without a safe current work view", () => {
  const fixture = createContext();
  fixture.context.renderSemanticTargetSelection({ semanticTargets: { available: false } });

  assert.equal(fixture.select.disabled, true);
  assert.equal(fixture.button.disabled, true);
  assert.match(fixture.select.options[0].textContent, /Open an HTTP\(S\) work view/u);
});

test("Operations panel contains the reviewed semantic click task control", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "screen-semantic-target-select",
    "create-semantic-click-task-button",
    "screen-semantic-target-task-json",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
