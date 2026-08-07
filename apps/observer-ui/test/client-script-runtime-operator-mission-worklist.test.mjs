import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeOperatorMissionWorklistScript } from "../src/client-script-runtime-operator-mission-worklist.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function element() {
  return {
    value: 0,
    textContent: "",
    disabled: false,
    dataset: {},
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    contains(candidate) { return this.children.some((child) => child === candidate || child.children?.includes(candidate)); },
  };
}

function createFixture() {
  const calls = [];
  const messages = [];
  const rendered = [];
  let goal = "Inspect reviewed item one";
  let targetUrl = "https://example.com/one";
  const elements = {
    add: element(),
    clear: element(),
    bind: element(),
    workflow: element(),
    draft: element(),
    progress: element(),
    status: element(),
    id: element(),
    mission: element(),
    items: element(),
    issued: element(),
    completed: element(),
    currentTask: element(),
    next: element(),
    stopReason: element(),
    json: element(),
  };
  const selectors = {
    "#operator-mission-worklist-add-button": elements.add,
    "#operator-mission-worklist-clear-button": elements.clear,
    "#operator-mission-worklist-bind-button": elements.bind,
    "#operator-mission-worklist-workflow": elements.workflow,
    "#operator-mission-worklist-draft": elements.draft,
    "#operator-mission-worklist-progress-bar": elements.progress,
    "#operator-mission-worklist-status": elements.status,
    "#operator-mission-worklist-id": elements.id,
    "#operator-mission-worklist-mission": elements.mission,
    "#operator-mission-worklist-items": elements.items,
    "#operator-mission-worklist-issued": elements.issued,
    "#operator-mission-worklist-completed": elements.completed,
    "#operator-mission-worklist-current-task": elements.currentTask,
    "#operator-mission-worklist-next": elements.next,
    "#operator-mission-worklist-stop-reason": elements.stopReason,
    "#operator-mission-worklist-json": elements.json,
  };
  const context = {
    document: {
      querySelector: (selector) => selectors[selector] ?? null,
      createElement: () => element(),
    },
    observerConfig: { coreUrl: "http://core.invalid" },
    reviewedBrowserTaskGoal: () => goal,
    getDesiredWorkViewUrl: () => targetUrl,
    fetchJson: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        mission: { id: "mission-1", status: "armed", epochsConsumed: 0, remainingEpochs: 2 },
        missions: [{ id: "mission-1", status: "armed", epochsConsumed: 0, remainingEpochs: 2 }],
        worklist: {
          id: "worklist-1",
          missionId: "mission-1",
          status: "bound",
          itemCount: 1,
          issuedCount: 0,
          completedCount: 0,
          progressPercent: 0,
        },
        workflowRecipes: [
          { workflowId: "bounded_run" },
          { workflowId: "semantic_form_workflow" },
        ],
      };
    },
    renderOperatorMission: (data) => rendered.push(data),
    setControlMessage: (message) => messages.push(message),
    refreshTaskList: async () => {},
    refreshOperatorState: async () => {},
    encodeURIComponent,
    Error,
    JSON,
    Math,
    Number,
  };
  vm.runInNewContext(observerClientRuntimeOperatorMissionWorklistScript, context);
  return {
    context,
    calls,
    messages,
    rendered,
    elements,
    setGoal(value) { goal = value; },
    setTargetUrl(value) { targetUrl = value; },
  };
}

test("Observer drafts and binds a finite reviewed worklist to the exact mission", async () => {
  const fixture = createFixture();
  fixture.elements.workflow.value = "semantic_form_workflow";
  fixture.context.addOperatorMissionWorklistDraftItem();
  fixture.context.renderOperatorMissionWorklist({}, {
    id: "mission-1",
    status: "armed",
    epochsConsumed: 0,
    remainingEpochs: 2,
    childLeaseId: null,
  });
  assert.equal(fixture.elements.bind.disabled, false);

  await fixture.context.bindOperatorMissionWorklistFromUi();
  assert.equal(fixture.calls[0].url, "http://core.invalid/operator/mission/mission-1/worklist");
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    items: [{
      goal: "Inspect reviewed item one",
      targetUrl: "https://example.com/one",
      workflowId: "semantic_form_workflow",
    }],
    confirm: true,
  });
  assert.equal(fixture.rendered[0].worklist.id, "worklist-1");
  assert.match(fixture.messages.at(-1), /Bound reviewed worklist worklist-1/u);
});

test("Observer rejects duplicate draft items and renders durable worklist progress", () => {
  const fixture = createFixture();
  fixture.context.addOperatorMissionWorklistDraftItem();
  assert.throws(
    () => fixture.context.addOperatorMissionWorklistDraftItem(),
    /already in the draft/u,
  );
  fixture.setGoal("Inspect reviewed item two");
  fixture.setTargetUrl("https://example.com/two");
  fixture.context.addOperatorMissionWorklistDraftItem();

  fixture.context.renderOperatorMissionWorklist({
    worklists: [{
      id: "worklist-2",
      missionId: "mission-2",
      status: "active",
      itemCount: 2,
      issuedCount: 1,
      completedCount: 1,
      currentTaskId: "task-2",
      nextItemOrdinal: 2,
      progressPercent: 50,
      blockedReason: null,
    }],
  }, {
    id: "mission-2",
    status: "running",
    epochsConsumed: 1,
    remainingEpochs: 1,
  });
  assert.equal(fixture.elements.status.textContent, "active");
  assert.equal(fixture.elements.completed.textContent, "1");
  assert.equal(fixture.elements.currentTask.textContent, "task-2");
  assert.equal(fixture.elements.progress.value, 50);
  assert.equal(fixture.elements.bind.disabled, true);
});

test("Observer caps an eligible draft at the mission's remaining epoch authority", () => {
  const fixture = createFixture();
  fixture.context.renderOperatorMissionWorklist({}, {
    id: "mission-1",
    status: "armed",
    epochsConsumed: 0,
    remainingEpochs: 1,
    childLeaseId: null,
  });
  fixture.context.addOperatorMissionWorklistDraftItem();
  assert.equal(fixture.elements.add.disabled, true);
  assert.equal(fixture.elements.bind.disabled, false);

  fixture.setGoal("Inspect reviewed item two");
  fixture.setTargetUrl("https://example.com/two");
  assert.throws(
    () => fixture.context.addOperatorMissionWorklistDraftItem(),
    /remaining epoch authority/u,
  );
  assert.equal(fixture.elements.draft.children.length, 1);
});

test("Observer panel exposes reviewed worklist draft, bind, and progress controls", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "Reviewed Mission Worklist",
    "operator-mission-worklist-add-button",
    "operator-mission-worklist-clear-button",
    "operator-mission-worklist-bind-button",
    "operator-mission-worklist-workflow",
    "operator-mission-worklist-draft",
    "operator-mission-worklist-progress-bar",
    "operator-mission-worklist-current-task",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
