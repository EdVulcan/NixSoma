import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { clientScript } from "../src/client-script.mjs";
import { observerClientConfigDomEngineeringAdaptationScript } from "../src/client-script-config-dom-engineering-adaptation.mjs";
import { observerClientRuntimeEngineeringAdaptationScript } from "../src/client-script-runtime-engineering-adaptation.mjs";
import { observerHtml } from "../src/observer-html.mjs";
import { observerEngineeringAdaptationPanel } from "../src/observer-panel-engineering-adaptation.mjs";

function element(value = "") {
  return {
    value,
    textContent: "",
    disabled: false,
    listeners: new Map(),
    addEventListener(name, listener) { this.listeners.set(name, listener); },
  };
}

function state({ experiments = [], profiles = [] } = {}) {
  return {
    ok: true,
    registry: "nixsoma-controlled-experience-adaptation-v0",
    experiments,
    profiles,
    bounds: { minimumTrials: 8, maximumTrials: 32 },
    governance: {
      pairedRandomAssignment: true,
      callerSelectsArm: false,
      changesExecutionPolicy: false,
      changesAuthority: false,
    },
  };
}

function fixture(fetchJson) {
  const elements = {
    taskType: element("browser_task"),
    trialLimit: element("8"),
    duration: element("60"),
    status: element(),
    assignments: element(),
    candidate: element(),
    profile: element(),
    refresh: element(),
    arm: element(),
    rearm: element(),
    cancel: element(),
    activate: element(),
    revoke: element(),
    json: element(),
  };
  const messages = [];
  const context = {
    engineeringAdaptationTaskTypeInput: elements.taskType,
    engineeringAdaptationTrialLimitInput: elements.trialLimit,
    engineeringAdaptationDurationInput: elements.duration,
    engineeringAdaptationStatus: elements.status,
    engineeringAdaptationAssignments: elements.assignments,
    engineeringAdaptationCandidate: elements.candidate,
    engineeringAdaptationProfile: elements.profile,
    engineeringAdaptationRefreshButton: elements.refresh,
    engineeringAdaptationArmButton: elements.arm,
    engineeringAdaptationRearmButton: elements.rearm,
    engineeringAdaptationCancelButton: elements.cancel,
    engineeringAdaptationActivateButton: elements.activate,
    engineeringAdaptationRevokeButton: elements.revoke,
    engineeringAdaptationJson: elements.json,
    observerConfig: { coreUrl: "http://core.invalid" },
    fetchJson,
    setControlMessage: (message) => messages.push(message),
    formatError: (error) => error.message,
    encodeURIComponent,
    Number,
    JSON,
    Error,
  };
  vm.runInNewContext(observerClientRuntimeEngineeringAdaptationScript, context);
  return { context, elements, messages };
}

test("Observer renders completed randomized evidence and exact profile activation state", async () => {
  const experiment = {
    registry: "nixsoma-experience-ranking-experiment-v0",
    id: "experiment-1",
    status: "completed",
    trialLimit: 8,
    assignments: Array.from({ length: 8 }, (_, index) => ({ index: index + 1 })),
    analysis: {
      candidateRankingMode: "feedback_weighted",
      evidenceSupportsRankingChange: true,
      evidenceHash: "a".repeat(64),
    },
  };
  const profile = {
    registry: "nixsoma-experience-ranking-profile-v0",
    id: "profile-1",
    taskType: "browser_task",
    rankingMode: "feedback_weighted",
  };
  const view = fixture(async () => state({ experiments: [experiment], profiles: [profile] }));

  await view.context.refreshEngineeringAdaptation();
  assert.equal(view.elements.status.textContent, "completed");
  assert.equal(view.elements.assignments.textContent, "8 / 8");
  assert.equal(view.elements.candidate.textContent, "feedback_weighted");
  assert.equal(view.elements.profile.textContent, "feedback_weighted");
  assert.equal(view.elements.activate.disabled, false);
  assert.equal(view.elements.revoke.disabled, false);
  assert.match(view.elements.json.textContent, /pairedRandomAssignment/u);
});

test("Observer arms only the finite comparison parameters without selecting a ranking arm", async () => {
  const calls = [];
  const view = fixture(async (url, options) => {
    calls.push({ url, options });
    if (options?.method === "POST") {
      return {
        ok: true,
        experiment: {
          registry: "nixsoma-experience-ranking-experiment-v0",
          id: "experiment-2",
          taskType: "browser_task",
          status: "armed",
          governance: { callerSelectsArm: false },
        },
      };
    }
    return state();
  });

  await view.context.armEngineeringAdaptation();
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, {
    confirm: true,
    taskType: "browser_task",
    trialLimit: 8,
    durationMinutes: 60,
  });
  assert.equal("rankingMode" in body, false);
  assert.match(view.messages.at(-1), /Armed finite experience comparison experiment-2/u);
});

test("Observer serves the adaptation panel, DOM owner, and runtime owner", () => {
  const panel = observerEngineeringAdaptationPanel();
  const html = observerHtml();
  const script = clientScript();
  for (const token of [
    "Experience Adaptation",
    "engineering-adaptation-task-type-input",
    "engineering-adaptation-trial-limit-input",
    "engineering-adaptation-arm-button",
    "engineering-adaptation-activate-button",
    "engineering-adaptation-revoke-button",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
    assert.equal(html.includes(token), true, `served HTML is missing ${token}`);
  }
  assert.match(observerClientConfigDomEngineeringAdaptationScript, /engineeringAdaptationActivateButton/u);
  assert.match(script, /refreshEngineeringAdaptation/u);
  assert.match(script, /callerSelectsArm/u);
});
