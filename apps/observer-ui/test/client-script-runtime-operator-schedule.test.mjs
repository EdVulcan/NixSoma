import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeOperatorSessionScript } from "../src/client-script-runtime-operator-session.mjs";
import { observerClientRuntimeOperatorScheduleScript } from "../src/client-script-runtime-operator-schedule.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function createElement(value = "") {
  return { value, textContent: "", disabled: false, dataset: {} };
}

function createContext({ response = {} } = {}) {
  const calls = [];
  const messages = [];
  const refreshes = [];
  const elements = {
    delay: createElement("2"),
    arm: createElement(),
    rearm: createElement(),
    cancel: createElement(),
    refresh: createElement(),
    enabled: createElement(),
    timer: createElement(),
    status: createElement(),
    id: createElement(),
    due: createElement(),
    steps: createElement(),
    json: createElement(),
    runLimit: createElement("3"),
    resume: createElement(),
    recovery: createElement(),
    taskDetail: createElement(),
  };
  const selectors = {
    "#operator-schedule-delay-input": elements.delay,
    "#operator-schedule-arm-button": elements.arm,
    "#operator-schedule-rearm-button": elements.rearm,
    "#operator-schedule-cancel-button": elements.cancel,
    "#operator-schedule-refresh-button": elements.refresh,
    "#operator-schedule-enabled": elements.enabled,
    "#operator-schedule-timer": elements.timer,
    "#operator-schedule-status": elements.status,
    "#operator-schedule-id": elements.id,
    "#operator-schedule-due": elements.due,
    "#operator-schedule-steps": elements.steps,
    "#operator-schedule-json": elements.json,
  };
  const context = {
    document: { querySelector: (selector) => selectors[selector] ?? null },
    observerConfig: { coreUrl: "http://core.invalid" },
    operatorRunLimitInput: elements.runLimit,
    operatorResumeButton: elements.resume,
    operatorRecoveryButton: elements.recovery,
    taskDetailIdInput: elements.taskDetail,
    taskHistoryFocus: "current-task",
    selectedHistoryTaskId: null,
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, scheduler: { registry: "nixsoma-bounded-operator-scheduler-v0", enabled: true, timerActive: true, active: false }, schedules: [], ...response };
    },
    formatTimestamp: (value) => value,
    setControlMessage: (message) => messages.push(message),
    refreshOperatorState: async () => refreshes.push("operator"),
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("task-list"),
    refreshTaskHistoryDetail: async () => refreshes.push("task-history"),
    refreshActionState: async () => refreshes.push("action"),
    refreshWorkView: async () => refreshes.push("work-view"),
    refreshScreen: async () => refreshes.push("screen"),
    refreshOperatorSchedule: async () => refreshes.push("schedule"),
    refreshPolicyState: async () => refreshes.push("policy"),
    refreshCapabilityHistory: async () => refreshes.push("capabilities"),
    refreshCommandLedger: async () => refreshes.push("commands"),
    renderEngineeringRecommendationFromOperatorResult: () => {},
    renderEngineeringPlanFromOperatorResult: () => {},
    Error,
    encodeURIComponent,
    JSON,
  };
  vm.runInNewContext(observerClientRuntimeOperatorSessionScript + observerClientRuntimeOperatorScheduleScript, context);
  return { context, calls, messages, refreshes, elements };
}

test("Observer schedules a bounded queue with minutes converted to milliseconds", async () => {
  const fixture = createContext({ response: { schedule: { id: "schedule-1", status: "armed", maxSteps: 3, dueAt: "2026-08-01T13:02:00.000Z" }, schedules: [{ id: "schedule-1", status: "armed", maxSteps: 3, dueAt: "2026-08-01T13:02:00.000Z" }] } });

  await fixture.context.scheduleOperatorRunFromUi();

  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/schedule");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { maxSteps: 3, delayMs: 120000, confirm: true });
  assert.equal(fixture.elements.id.textContent, "schedule-1");
  assert.match(fixture.messages.at(-1), /Scheduled operator queue schedule-1/u);
  assert.deepEqual(fixture.refreshes, ["operator"]);
});

test("Observer re-arms and cancels only the schedule id supplied by Core readback", async () => {
  const fixture = createContext({ response: { schedule: { id: "schedule-2", status: "paused", maxSteps: 4, dueAt: "2026-08-01T13:01:00.000Z" }, schedules: [{ id: "schedule-2", status: "paused", maxSteps: 4, dueAt: "2026-08-01T13:01:00.000Z" }] } });
  fixture.context.renderOperatorSchedule({ scheduler: { enabled: true, timerActive: true }, schedules: [{ id: "schedule-2", status: "paused", maxSteps: 4 }] });

  await fixture.context.rearmOperatorScheduleFromUi();
  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/schedule/schedule-2/rearm");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { delayMs: 120000, confirm: true });

  fixture.context.renderOperatorSchedule({ scheduler: { enabled: true, timerActive: true }, schedules: [{ id: "schedule-2", status: "armed", maxSteps: 4 }] });
  await fixture.context.cancelOperatorScheduleFromUi();
  assert.equal(fixture.calls[1].url, "http://core.invalid/operator/schedule/schedule-2/cancel");
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { confirm: true });
});

test("Observer rejects an oversized schedule delay before contacting Core", async () => {
  const fixture = createContext();
  fixture.elements.delay.value = "1441";
  await assert.rejects(
    () => fixture.context.scheduleOperatorRunFromUi(),
    /Schedule delay must be between 0 and 1440 minutes/u,
  );
  assert.equal(fixture.calls.length, 0);
});

test("Observer panel exposes schedule, cancel, re-arm, and bounded delay controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "operator-schedule-delay-input",
    'max="1440"',
    "operator-schedule-arm-button",
    "operator-schedule-rearm-button",
    "operator-schedule-cancel-button",
    "operator-schedule-refresh-button",
    "Schedule Queue",
    "Re-arm Paused Schedule",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
