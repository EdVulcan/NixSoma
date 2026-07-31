import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeOperatorSessionScript } from "../src/client-script-runtime-operator-session.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function createContext({ limit = "5", response = {} } = {}) {
  const calls = [];
  const refreshes = [];
  const messages = [];
  const context = {
    operatorRunLimitInput: { value: limit },
    observerConfig: { coreUrl: "http://core.invalid" },
    taskHistoryFocus: "current-task",
    selectedHistoryTaskId: null,
    taskDetailIdInput: { value: "" },
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, ran: false, count: 0, steps: [], nextTask: null, ...response };
    },
    renderOperatorPanel: (value) => { context.renderedOperator = value; },
    renderEngineeringRecommendationFromOperatorResult: () => {},
    renderEngineeringPlanFromOperatorResult: () => {},
    setControlMessage: (message) => messages.push(message),
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("task-list"),
    refreshTaskHistoryDetail: async () => refreshes.push("task-history"),
    refreshActionState: async () => refreshes.push("action"),
    refreshWorkView: async () => refreshes.push("work-view"),
    refreshScreen: async () => refreshes.push("screen"),
    refreshOperatorState: async () => refreshes.push("operator"),
    refreshPolicyState: async () => refreshes.push("policy"),
    refreshCapabilityHistory: async () => refreshes.push("capabilities"),
    refreshCommandLedger: async () => refreshes.push("commands"),
    Error,
  };
  vm.runInNewContext(observerClientRuntimeOperatorSessionScript, context);
  return { context, calls, refreshes, messages };
}

test("Observer previews an exact bounded queue without requesting execution", async () => {
  const fixture = createContext({
    limit: "12",
    response: { dryRun: true, nextTask: { id: "task-next", status: "queued" } },
  });

  await fixture.context.runOperatorLoopFromUi({ dryRun: true });

  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/run");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { maxSteps: 12, dryRun: true });
  assert.equal(fixture.context.selectedHistoryTaskId, "task-next");
  assert.equal(fixture.context.taskDetailIdInput.value, "task-next");
  assert.match(fixture.messages.at(-1), /no task executed/u);
  assert.deepEqual(fixture.refreshes, [
    "runtime", "task-list", "task-history", "action", "work-view",
    "screen", "operator", "policy", "capabilities", "commands",
  ]);
});

test("Observer runs an exact bounded queue and selects its last task", async () => {
  const fixture = createContext({
    limit: "2",
    response: {
      ran: true,
      count: 2,
      steps: [{ task: { id: "task-1" } }, { task: { id: "task-2" } }],
    },
  });

  await fixture.context.runOperatorLoopFromUi();

  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { maxSteps: 2, dryRun: false });
  assert.equal(fixture.context.selectedHistoryTaskId, "task-2");
  assert.match(fixture.messages.at(-1), /completed 2 task/u);
});

test("Observer rejects malformed or out-of-range limits before contacting Core", async () => {
  for (const limit of ["", "0", "21", "1.5", "5x"]) {
    const fixture = createContext({ limit });
    await assert.rejects(
      () => fixture.context.runOperatorLoopFromUi(),
      /Operator run limit must be between 1 and 20/u,
    );
    assert.equal(fixture.calls.length, 0);
  }
});

test("Operator panel exposes finite preview and run controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    'id="operator-run-limit-input"',
    'min="1"',
    'max="20"',
    "Run Next",
    "Preview Queue",
    "Run Queue",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
