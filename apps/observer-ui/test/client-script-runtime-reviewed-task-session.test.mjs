import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeReviewedTaskSessionScript } from "../src/client-script-runtime-reviewed-task-session.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function createContext({
  selectedTaskId = null,
  bindStatus = "bound",
  bindOperation = "rebind",
} = {}) {
  const calls = [];
  const context = {
    selectedHistoryTaskId: selectedTaskId,
    taskDetailIdInput: { value: "" },
    rebindSelectedReviewedTaskButton: { disabled: false },
    observerConfig: { coreUrl: "http://core.invalid" },
    getSelectedHistoryTaskId: () => "loaded-task",
    runAiWorkspaceReviewedCycle: async () => calls.push("reviewed-cycle"),
    acceptAiWorkspaceAssessment: async () => calls.push("accept-assessment"),
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      return {
        invoked: true,
        capability: { id: "act.openclaw.engineering_context.work_view_bind" },
        result: {
          ok: true,
          registry: "openclaw-native-engineering-work-view-bind-v0",
          bind: {
            summary: { status: bindStatus, operation: bindOperation },
            governance: {
              changesTaskStatus: false,
              callsProvider: false,
              networkEgress: false,
              createsTask: false,
              createsApproval: false,
              executesAction: false,
            },
          },
        },
        invocation: { summary: { kind: "engineering.work_view_bind" } },
      };
    },
    refreshRuntime: async () => calls.push("refresh-runtime"),
    refreshTaskList: async () => calls.push("refresh-task-list"),
    refreshTaskHistoryDetail: async () => calls.push("refresh-task-detail"),
    refreshWorkView: async () => calls.push("refresh-work-view"),
    refreshScreen: async () => calls.push("refresh-screen"),
    setControlMessage: (message) => calls.push(["message", message]),
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

test("reviewed task bridge explicitly rebinds the selected task through the existing owner", async () => {
  const fixture = createContext({ selectedTaskId: "stale-reviewed-task" });

  await fixture.context.rebindSelectedReviewedTaskFromUi();

  assert.equal(fixture.context.taskDetailIdInput.value, "stale-reviewed-task");
  const request = fixture.calls.find((call) => Array.isArray(call) && call[0] === "fetch");
  assert.equal(request[1], "http://core.invalid/capabilities/invoke");
  const body = JSON.parse(request[2].body);
  assert.deepEqual(body, {
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId: "stale-reviewed-task",
    params: { confirm: true, rebind: true },
  });
  assert.equal(fixture.context.rebindSelectedReviewedTaskButton.disabled, false);
  assert.deepEqual(fixture.calls.slice(1, 6), [
    "refresh-runtime",
    "refresh-task-list",
    "refresh-task-detail",
    "refresh-work-view",
    "refresh-screen",
  ]);
  assert.match(fixture.calls.at(-1)[1], /execution remains explicit/u);
});

test("reviewed task rebind accepts an existing binding as an explicit no-op", async () => {
  const fixture = createContext({
    selectedTaskId: "current-reviewed-task",
    bindStatus: "already_bound",
    bindOperation: "noop",
  });

  await fixture.context.rebindSelectedReviewedTaskFromUi();

  assert.deepEqual(fixture.calls.slice(1, 6), [
    "refresh-runtime",
    "refresh-task-list",
    "refresh-task-detail",
    "refresh-work-view",
    "refresh-screen",
  ]);
  assert.match(fixture.calls.at(-1)[1], /already bound/u);
});

test("reviewed task rebind fails locally without a selected task", async () => {
  const fixture = createContext();
  fixture.context.getSelectedHistoryTaskId = () => null;

  await assert.rejects(
    () => fixture.context.rebindSelectedReviewedTaskFromUi(),
    /Select a reviewed task/u,
  );
  assert.equal(fixture.calls.some((call) => Array.isArray(call) && call[0] === "fetch"), false);
});

test("reviewed task bridge forwards the selected task to the existing acceptance owner", async () => {
  const fixture = createContext({ selectedTaskId: "completed-task" });

  await fixture.context.acceptSelectedReviewedWorkspaceAssessmentFromUi();

  assert.equal(fixture.context.selectedHistoryTaskId, "completed-task");
  assert.equal(fixture.context.taskDetailIdInput.value, "completed-task");
  assert.deepEqual(fixture.calls, ["accept-assessment"]);
});

test("reviewed task acceptance bridge fails locally without a selected task", async () => {
  const fixture = createContext();
  fixture.context.getSelectedHistoryTaskId = () => null;

  await assert.rejects(
    () => fixture.context.acceptSelectedReviewedWorkspaceAssessmentFromUi(),
    /Select a reviewed task/u,
  );
  assert.deepEqual(fixture.calls, []);
});

test("Operations panel exposes the explicit reviewed-task cycle bridge", () => {
  const panel = observerOperationsPanels();
  assert.equal(panel.includes('id="run-selected-reviewed-cycle-button"'), true);
  assert.equal(panel.includes("Run + Assess Selected Task"), true);
  assert.equal(panel.includes('id="accept-selected-reviewed-assessment-button"'), true);
  assert.equal(panel.includes("Accept Selected Assessment"), true);
  assert.equal(panel.includes('id="rebind-selected-reviewed-task-button"'), true);
  assert.equal(panel.includes("Rebind Selected Task"), true);
});
