import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeOperatorMissionScript } from "../src/client-script-runtime-operator-mission.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function element(value = "") {
  return { value, textContent: "", disabled: false, checked: false, dataset: {} };
}

function mission(id = "mission-1", overrides = {}) {
  return {
    id,
    status: "armed",
    epochsAuthorized: 8,
    epochsConsumed: 2,
    epochsCompleted: 2,
    progressPercent: 25,
    maxNoProgressEpochs: 2,
    noProgressStreak: 0,
    renewalCount: 0,
    deadlineAt: "2026-08-02T14:00:00.000Z",
    nextEpochAt: "2026-08-01T14:05:00.000Z",
    lastCheckpoint: { epoch: 2, status: "completed", stepCount: 3 },
    ...overrides,
  };
}

function createFixture({ response = {} } = {}) {
  const calls = [];
  const messages = [];
  const elements = {
    epochs: element("8"),
    steps: element("3"),
    interval: element("300"),
    authority: element("24"),
    circuitInput: element("2"),
    resident: element(),
    arm: element(),
    renew: element(),
    pause: element(),
    rearm: element(),
    cancel: element(),
    refresh: element(),
    progressBar: element(0),
    enabled: element(),
    timer: element(),
    status: element(),
    id: element(),
    progress: element(),
    completed: element(),
    checkpoint: element(),
    next: element(),
    deadline: element(),
    circuit: element(),
    renewals: element(),
    stopReason: element(),
    json: element(),
  };
  const selectors = {
    "#operator-mission-epoch-input": elements.epochs,
    "#operator-mission-steps-input": elements.steps,
    "#operator-mission-interval-input": elements.interval,
    "#operator-mission-authority-input": elements.authority,
    "#operator-mission-circuit-input": elements.circuitInput,
    "#operator-mission-resident-continuation-input": elements.resident,
    "#operator-mission-arm-button": elements.arm,
    "#operator-mission-renew-button": elements.renew,
    "#operator-mission-pause-button": elements.pause,
    "#operator-mission-rearm-button": elements.rearm,
    "#operator-mission-cancel-button": elements.cancel,
    "#operator-mission-refresh-button": elements.refresh,
    "#operator-mission-progress-bar": elements.progressBar,
    "#operator-mission-enabled": elements.enabled,
    "#operator-mission-timer": elements.timer,
    "#operator-mission-status": elements.status,
    "#operator-mission-id": elements.id,
    "#operator-mission-progress": elements.progress,
    "#operator-mission-completed": elements.completed,
    "#operator-mission-checkpoint": elements.checkpoint,
    "#operator-mission-next": elements.next,
    "#operator-mission-deadline": elements.deadline,
    "#operator-mission-circuit": elements.circuit,
    "#operator-mission-renewals": elements.renewals,
    "#operator-mission-stop-reason": elements.stopReason,
    "#operator-mission-json": elements.json,
  };
  const context = {
    document: { querySelector: (selector) => selectors[selector] ?? null },
    observerConfig: { coreUrl: "http://core.invalid" },
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        supervisor: { registry: "nixsoma-renewable-operator-mission-v0", enabled: true, timerActive: true, active: false },
        missions: [],
        ...response,
      };
    },
    formatTimestamp: (value) => value,
    setControlMessage: (message) => messages.push(message),
    renderOperatorMissionWorklist: () => {},
    renderOperatorMissionWorklistOffline: () => {},
    refreshOperatorState: async () => {},
    Error,
    encodeURIComponent,
    JSON,
    Math,
  };
  vm.runInNewContext(observerClientRuntimeOperatorMissionScript, context);
  return { context, calls, messages, elements };
}

test("Observer arms a finite renewable mission and renders checkpoint progress", async () => {
  const current = mission();
  const fixture = createFixture({ response: { mission: current, missions: [current] } });

  await fixture.context.armOperatorMissionFromUi();

  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/mission");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    epochCount: 8,
    maxStepsPerEpoch: 3,
    epochIntervalMs: 300_000,
    deadlineMs: 86_400_000,
    maxNoProgressEpochs: 2,
    residentContinuation: false,
    confirm: true,
  });
  assert.equal(fixture.elements.id.textContent, "mission-1");
  assert.equal(fixture.elements.progress.textContent, "2 / 8 (25%)");
  assert.equal(fixture.elements.progressBar.value, 25);
  assert.equal(fixture.elements.checkpoint.textContent, "epoch 2 / completed / 3 steps");
  assert.match(fixture.messages.at(-1), /Armed renewable mission mission-1/u);
});

test("Observer explicitly arms resident continuation for a bound worklist", async () => {
  const current = mission("mission-resident", { residentContinuation: true });
  const fixture = createFixture({ response: { mission: current, missions: [current] } });
  fixture.elements.resident.checked = true;

  await fixture.context.armOperatorMissionFromUi();

  assert.equal(JSON.parse(fixture.calls[0].options.body).residentContinuation, true);
  assert.equal(fixture.elements.resident.checked, true);
  assert.equal(fixture.elements.resident.disabled, true);
});

test("Observer binds renew, pause, resume, and cancel to the Core-returned mission id", async () => {
  const current = mission("mission-2", { status: "paused" });
  const fixture = createFixture({ response: { mission: current, missions: [current] } });
  fixture.context.renderOperatorMission({ supervisor: { active: false }, missions: [current] });

  await fixture.context.renewOperatorMissionFromUi();
  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/mission/mission-2/renew");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    additionalEpochs: 8,
    extensionMs: 86_400_000,
    confirm: true,
  });
  await fixture.context.rearmOperatorMissionFromUi();
  assert.equal(fixture.calls[1].url, "http://core.invalid/operator/mission/mission-2/rearm");
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { resetCircuit: false, confirm: true });

  const active = mission("mission-2", { status: "running" });
  fixture.context.renderOperatorMission({ supervisor: { active: true }, missions: [active] });
  await fixture.context.pauseOperatorMissionFromUi();
  assert.equal(fixture.calls[2].url, "http://core.invalid/operator/mission/mission-2/pause");
  await fixture.context.cancelOperatorMissionFromUi();
  assert.equal(fixture.calls[3].url, "http://core.invalid/operator/mission/mission-2/cancel");
});

test("Observer exposes explicit no-progress circuit reset only for the blocked mission", async () => {
  const blocked = mission("mission-3", { status: "blocked", stopReason: "no_progress_circuit_open" });
  const fixture = createFixture({ response: { mission: blocked, missions: [blocked] } });
  fixture.context.renderOperatorMission({ supervisor: { active: false }, missions: [blocked] });
  assert.equal(fixture.elements.rearm.disabled, false);

  await fixture.context.rearmOperatorMissionFromUi();
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { resetCircuit: true, confirm: true });
});

test("Observer rejects out-of-range mission authority before contacting Core", async () => {
  const fixture = createFixture();
  fixture.elements.epochs.value = "33";
  await assert.rejects(() => fixture.context.armOperatorMissionFromUi(), /Mission epochs must be between 1 and 32/u);
  assert.equal(fixture.calls.length, 0);
});

test("Observer panel exposes mission authority and progress controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "Renewable Operator Mission",
    "operator-mission-epoch-input",
    "operator-mission-steps-input",
    "operator-mission-authority-input",
    "operator-mission-resident-continuation-input",
    "operator-mission-arm-button",
    "operator-mission-renew-button",
    "operator-mission-pause-button",
    "operator-mission-rearm-button",
    "operator-mission-cancel-button",
    "operator-mission-progress-bar",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
