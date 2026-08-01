import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeOperatorWindowScript } from "../src/client-script-runtime-operator-window.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function element(value = "") {
  return { value, textContent: "", disabled: false, dataset: {} };
}

function createFixture({ response = {} } = {}) {
  const calls = [];
  const messages = [];
  const elements = {
    count: element("2"),
    steps: element("3"),
    interval: element("10"),
    deadline: element("5"),
    arm: element(),
    rearm: element(),
    cancel: element(),
    refresh: element(),
    enabled: element(),
    timer: element(),
    status: element(),
    id: element(),
    progress: element(),
    next: element(),
    deadlineValue: element(),
    json: element(),
  };
  const selectors = {
    "#operator-window-count-input": elements.count,
    "#operator-window-steps-input": elements.steps,
    "#operator-window-interval-input": elements.interval,
    "#operator-window-deadline-input": elements.deadline,
    "#operator-window-arm-button": elements.arm,
    "#operator-window-rearm-button": elements.rearm,
    "#operator-window-cancel-button": elements.cancel,
    "#operator-window-refresh-button": elements.refresh,
    "#operator-window-enabled": elements.enabled,
    "#operator-window-timer": elements.timer,
    "#operator-window-status": elements.status,
    "#operator-window-id": elements.id,
    "#operator-window-progress": elements.progress,
    "#operator-window-next": elements.next,
    "#operator-window-deadline": elements.deadlineValue,
    "#operator-window-json": elements.json,
  };
  const context = {
    document: { querySelector: (selector) => selectors[selector] ?? null },
    observerConfig: { coreUrl: "http://core.invalid" },
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        leaseManager: { registry: "nixsoma-bounded-operator-window-lease-v0", enabled: true, timerActive: true, active: false },
        leases: [],
        ...response,
      };
    },
    formatTimestamp: (value) => value,
    setControlMessage: (message) => messages.push(message),
    refreshOperatorState: async () => {},
    Error,
    encodeURIComponent,
    JSON,
  };
  vm.runInNewContext(observerClientRuntimeOperatorWindowScript, context);
  return { context, calls, messages, elements };
}

test("Observer arms a bounded window lease with milliseconds and no task overrides", async () => {
  const fixture = createFixture({
    response: {
      lease: { id: "lease-1", status: "armed", windowCount: 2, windowsCompleted: 0, deadlineAt: "2026-08-01T13:05:00.000Z" },
      leases: [{ id: "lease-1", status: "armed", windowCount: 2, windowsCompleted: 0, deadlineAt: "2026-08-01T13:05:00.000Z" }],
    },
  });

  await fixture.context.armOperatorWindowFromUi();

  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/window");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    windowCount: 2,
    maxStepsPerWindow: 3,
    intervalMs: 10_000,
    deadlineMs: 300_000,
    confirm: true,
  });
  assert.equal(fixture.elements.id.textContent, "lease-1");
  assert.match(fixture.messages.at(-1), /Armed operator window lease lease-1/u);
});
test("Observer re-arms and cancels only the Core-returned lease id", async () => {
  const fixture = createFixture({
    response: {
      leases: [{ id: "lease-2", status: "paused", windowCount: 2, windowsCompleted: 1 }],
    },
  });
  fixture.context.renderOperatorWindow({ leaseManager: { enabled: true, timerActive: true }, leases: [{ id: "lease-2", status: "paused", windowCount: 2, windowsCompleted: 1 }] });

  await fixture.context.rearmOperatorWindowFromUi();
  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/window/lease-2/rearm");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { confirm: true });

  fixture.context.renderOperatorWindow({ leaseManager: { enabled: true, timerActive: true }, leases: [{ id: "lease-2", status: "armed", windowCount: 2 }] });
  await fixture.context.cancelOperatorWindowFromUi();
  assert.equal(fixture.calls[1].url, "http://core.invalid/operator/window/lease-2/cancel");
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { confirm: true });
});

test("Observer rejects out-of-range window parameters before contacting Core", async () => {
  const fixture = createFixture();
  fixture.elements.count.value = "9";
  await assert.rejects(() => fixture.context.armOperatorWindowFromUi(), /Window count must be between 1 and 8/u);
  assert.equal(fixture.calls.length, 0);
});

test("Observer panel exposes finite window lease controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "operator-window-count-input",
    "operator-window-steps-input",
    "operator-window-interval-input",
    "operator-window-deadline-input",
    "operator-window-arm-button",
    "operator-window-rearm-button",
    "operator-window-cancel-button",
    "Windowed Operator Lease",
    "Arm Window Lease",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
