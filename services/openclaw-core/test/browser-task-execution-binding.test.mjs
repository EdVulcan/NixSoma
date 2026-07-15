import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrowserTaskExecutionBinding,
  BROWSER_TASK_EXECUTION_BINDING_REGISTRY,
  validateBrowserTaskOperatorInputs,
} from "../src/browser-task-execution-binding.mjs";

function task({ targetUrl = "https://example.com/work", binding = true } = {}) {
  const candidate = {
    id: "browser-binding-task",
    type: "browser_task",
    targetUrl,
    plan: {
      strategy: "rule-v1",
      steps: [
        {
          phase: "acting_on_target",
          kind: "keyboard.type",
          status: "pending",
          params: { text: "original transient value" },
        },
        {
          phase: "acting_on_target",
          kind: "mouse.click",
          status: "pending",
          params: { x: 10, y: 20, button: "left" },
        },
      ],
    },
  };
  if (binding) candidate.operatorExecutionBinding = buildBrowserTaskExecutionBinding(candidate);
  return candidate;
}

test("browser task execution binding covers target and action shape without input text", () => {
  const binding = buildBrowserTaskExecutionBinding(task({ binding: false }));

  assert.equal(binding.registry, BROWSER_TASK_EXECUTION_BINDING_REGISTRY);
  assert.equal(binding.targetUrl, "https://example.com/work");
  assert.equal(binding.actionCount, 2);
  assert.match(binding.actionShapeHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(binding.transientInputKinds, ["keyboard.type"]);
  assert.equal(binding.inputTextBound, false);
  assert.equal(binding.persisted, true);
  assert.doesNotMatch(JSON.stringify(binding), /original transient value/u);
});

test("operator input binding accepts a transient replacement value for the planned input", () => {
  const result = validateBrowserTaskOperatorInputs({
    task: task(),
    requestedActions: [
      { kind: "keyboard.type", params: { text: "new transient value" } },
      { kind: "mouse.click", params: { x: 10, y: 20, button: "left" } },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.binding.source, "task_plan_with_transient_input");
  assert.equal(result.binding.transientInputProvided, true);
  assert.equal(result.actions[0].params.text, "new transient value");
  assert.equal(result.binding.inputTextBound, false);
});

test("operator input binding accepts redacted plan metadata with a transient replacement", () => {
  const candidate = task();
  candidate.plan.steps[0].params = {
    inputEvidence: {
      registry: "openclaw-write-only-input-evidence-v0",
      charCount: 22,
      textExposed: false,
      persisted: false,
    },
  };
  candidate.operatorExecutionBinding = buildBrowserTaskExecutionBinding(candidate);

  const result = validateBrowserTaskOperatorInputs({
    task: candidate,
    requestedActions: [
      { kind: "keyboard.type", params: { text: "re-entered transient value" } },
      { kind: "mouse.click", params: { x: 10, y: 20, button: "left" } },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.actions[0].params.text, "re-entered transient value");
  assert.equal(result.binding.inputTextBound, false);
});

test("operator input binding rejects target or non-input action changes", () => {
  const targetMismatch = validateBrowserTaskOperatorInputs({
    task: task(),
    requestedTargetUrl: "https://example.com/other",
  });
  assert.equal(targetMismatch.ok, false);
  assert.equal(targetMismatch.reason, "operator_execution_target_mismatch");

  const actionMismatch = validateBrowserTaskOperatorInputs({
    task: task(),
    requestedActions: [
      { kind: "keyboard.type", params: { text: "new transient value" } },
      { kind: "browser.new_tab", params: { url: "https://example.com/other" } },
    ],
  });
  assert.equal(actionMismatch.ok, false);
  assert.equal(actionMismatch.reason, "operator_execution_action_kind_mismatch");
});

test("operator input binding fails closed for an unplanned browser task or stale plan", () => {
  const unplanned = validateBrowserTaskOperatorInputs({
    task: { type: "browser_task", targetUrl: "https://example.com/work", plan: null },
  });
  assert.equal(unplanned.ok, false);
  assert.equal(unplanned.reason, "operator_execution_plan_binding_required");

  const unboundPlan = task({ binding: false });
  const unbound = validateBrowserTaskOperatorInputs({ task: unboundPlan });
  assert.equal(unbound.ok, false);
  assert.equal(unbound.reason, "operator_execution_binding_required");

  const staleTask = task();
  staleTask.plan.steps[1].params.x = 99;
  const stale = validateBrowserTaskOperatorInputs({ task: staleTask });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "operator_execution_binding_stale");

  const malformedBindingTask = task();
  malformedBindingTask.operatorExecutionBinding.inputTextBound = true;
  const malformedBinding = validateBrowserTaskOperatorInputs({ task: malformedBindingTask });
  assert.equal(malformedBinding.ok, false);
  assert.equal(malformedBinding.reason, "operator_execution_binding_stale");
});
