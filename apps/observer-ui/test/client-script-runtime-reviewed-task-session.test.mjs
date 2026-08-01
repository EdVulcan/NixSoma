import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeReviewedTaskSessionScript } from "../src/client-script-runtime-reviewed-task-session.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function createContext({ selectedTaskId = null } = {}) {
  const calls = [];
  const context = {
    selectedHistoryTaskId: selectedTaskId,
    taskDetailIdInput: { value: "" },
    getSelectedHistoryTaskId: () => "loaded-task",
    runAiWorkspaceReviewedCycle: async () => calls.push("reviewed-cycle"),
    Error,
  };
  vm.runInNewContext(observerClientRuntimeReviewedTaskSessionScript, context);
  return { context, calls };
}

test("reviewed task bridge forwards the selected task to the existing cycle owner", async () => {
  const fixture = createContext({ selectedTaskId: "created-task" });

  await fixture.context.runSelectedReviewedWorkspaceCycleFromUi();

  assert.equal(fixture.context.selectedHistoryTaskId, "created-task");
  assert.equal(fixture.context.taskDetailIdInput.value, "created-task");
  assert.deepEqual(fixture.calls, ["reviewed-cycle"]);
});

test("reviewed task bridge can use the current task selector without sending a request", async () => {
  const fixture = createContext();

  await fixture.context.runSelectedReviewedWorkspaceCycleFromUi();

  assert.equal(fixture.context.selectedHistoryTaskId, "loaded-task");
  assert.equal(fixture.context.taskDetailIdInput.value, "loaded-task");
  assert.deepEqual(fixture.calls, ["reviewed-cycle"]);
});

test("reviewed task bridge fails locally without a selected task", async () => {
  const fixture = createContext();
  fixture.context.getSelectedHistoryTaskId = () => null;

  await assert.rejects(
    () => fixture.context.runSelectedReviewedWorkspaceCycleFromUi(),
    /Select a reviewed task/u,
  );
  assert.deepEqual(fixture.calls, []);
});

test("Operations panel exposes the explicit reviewed-task cycle bridge", () => {
  const panel = observerOperationsPanels();
  assert.equal(panel.includes('id="run-selected-reviewed-cycle-button"'), true);
  assert.equal(panel.includes("Run + Assess Selected Task"), true);
});
