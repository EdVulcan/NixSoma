import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientRuntimeEngineeringLoopControlsScript } from "../src/client-script-runtime-engineering-loop-controls.mjs";
import { observerClientRuntimeEngineeringLspTargetSelectionScript } from "../src/client-script-runtime-engineering-lsp-target-selection.mjs";
import { observerOperationsPanels } from "../src/observer-panels-operations.mjs";

function element({ hidden = false } = {}) {
  return {
    disabled: false,
    hidden,
    textContent: "",
    value: "",
  };
}

function selectElement() {
  const node = element({ hidden: true });
  node.options = [];
  node.listeners = new Map();
  node._innerHTML = "";
  Object.defineProperty(node, "innerHTML", {
    get() {
      return node._innerHTML;
    },
    set(value) {
      node._innerHTML = value;
      node.options = [];
    },
  });
  node.append = (option) => node.options.push(option);
  node.addEventListener = (name, handler) => node.listeners.set(name, handler);
  return node;
}

function createContext() {
  const messages = [];
  const select = selectElement();
  const context = {
    engineeringLoopStateKind: element(),
    engineeringLoopStateTask: element(),
    engineeringLoopStateApproval: element(),
    engineeringLoopStateNext: element(),
    engineeringLoopStateEvidence: element(),
    engineeringLoopStateCompletion: element(),
    engineeringLoopStateJson: element(),
    engineeringLspTargetSelectionPanel: element({ hidden: true }),
    engineeringLspTargetSelect: select,
    engineeringLspTargetSelectionStatus: element(),
    document: {
      createElement() {
        return { value: "", textContent: "" };
      },
    },
    setControlMessage: (message) => messages.push(message),
  };
  vm.runInNewContext(observerClientRuntimeEngineeringLoopControlsScript, context);
  vm.runInNewContext(observerClientRuntimeEngineeringLspTargetSelectionScript, context);
  return { context, select, messages };
}

function symbolResponse() {
  return {
    observed: true,
    targetCount: 2,
    targets: [
      {
        uri: "file:///workspace/src/first.ts",
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 8 } },
      },
      {
        uri: "file:///workspace/src/second.ts",
        range: { start: { line: 4, character: 2 }, end: { line: 4, character: 10 } },
      },
    ],
    selectedTarget: {
      uri: "file:///workspace/src/first.ts",
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 8 } },
    },
  };
}

test("Observer exposes bounded explicit LSP target selection and forwards the selected index", () => {
  const fixture = createContext();
  fixture.context.renderEngineeringLspLifecycleLoopTaskState({
    task: { id: "task-lsp-targets" },
    approval: { id: "approval-lsp-targets" },
    engineeringLspLifecycle: { lifecycleAction: "symbol_request", language: "typescript" },
  });
  fixture.context.renderEngineeringLspTargetSelection(symbolResponse());

  assert.equal(fixture.context.engineeringLspTargetSelectionPanel.hidden, false);
  assert.equal(fixture.select.disabled, false);
  assert.equal(fixture.select.options.length, 2);
  assert.match(fixture.select.options[1].textContent, /second\.ts/u);
  assert.match(fixture.context.engineeringLspTargetSelectionStatus.textContent, /Target 1\/2/u);

  fixture.select.value = "1";
  fixture.select.listeners.get("change")();

  assert.match(fixture.context.engineeringLspTargetSelectionStatus.textContent, /Target 2\/2/u);
  assert.match(fixture.context.engineeringLoopStateJson.textContent, /index=1 total=2/u);
  assert.match(fixture.messages.at(-1), /Selected LSP response target 2/u);
  assert.match(fixture.context.engineeringLspSelectedTargetReadBridgeRoute("task-lsp-targets", "typescript"), /targetIndex=1/u);
  assert.match(fixture.context.engineeringLspSelectedTargetEditProposalSeedRoute("task-lsp-targets", "typescript"), /targetIndex=1/u);
});

test("Observer hides the target selector when no completed symbol target exists", () => {
  const fixture = createContext();
  fixture.context.renderEngineeringLspTargetSelection(null);

  assert.equal(fixture.context.engineeringLspTargetSelectionPanel.hidden, true);
  assert.equal(fixture.select.disabled, true);
  assert.equal(fixture.select.options.length, 0);
  assert.match(fixture.context.engineeringLspTargetSelectionStatus.textContent, /No completed LSP symbol response target/u);
});

test("Operations panel contains the explicit LSP response target control", () => {
  const panel = observerOperationsPanels();
  for (const token of [
    "engineering-lsp-target-selection-panel",
    "engineering-lsp-target-select",
    "engineering-lsp-target-selection-status",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
});
