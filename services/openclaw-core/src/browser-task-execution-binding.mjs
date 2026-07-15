import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  browserTaskActionsFromPlan,
  normaliseBrowserTaskActions,
} from "./browser-task-action-contract.mjs";
import { WORK_VIEW_INPUT_MAX_CHARS } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";

export const BROWSER_TASK_EXECUTION_BINDING_REGISTRY =
  "openclaw-browser-task-execution-binding-v0";

const WRITE_ONLY_INPUT_ACTIONS = new Set(["keyboard.type", "browser.semantic_type"]);

function normaliseTargetUrl(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalise(value[key])]),
  );
}

function stripTransientInput(action) {
  const params = { ...(action?.params ?? {}) };
  if (WRITE_ONLY_INPUT_ACTIONS.has(action?.kind)) {
    delete params.text;
    delete params.inputEvidence;
  }
  return {
    kind: action?.kind ?? null,
    params,
  };
}

function actionShapeHash({ targetUrl, actions }) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalise({
      targetUrl: normaliseTargetUrl(targetUrl),
      actions: actions.map(stripTransientInput),
    })), "utf8")
    .digest("hex");
}

function bindingForTask(task, allActions) {
  const targetUrl = normaliseTargetUrl(task?.targetUrl);
  return {
    registry: BROWSER_TASK_EXECUTION_BINDING_REGISTRY,
    targetUrl,
    actionCount: allActions.length,
    actionShapeHash: actionShapeHash({ targetUrl, actions: allActions }),
    transientInputKinds: [...new Set(allActions
      .filter((action) => WRITE_ONLY_INPUT_ACTIONS.has(action.kind))
      .map((action) => action.kind))],
    inputTextBound: false,
    persisted: true,
  };
}

function reject(reason, binding = null) {
  return {
    ok: false,
    reason,
    binding,
  };
}

function validateAction(expected, candidate) {
  if (expected.kind !== candidate.kind) return "operator_execution_action_kind_mismatch";
  if (WRITE_ONLY_INPUT_ACTIONS.has(expected.kind)) {
    if (typeof candidate.params?.text !== "string"
      || candidate.params.text.length > WORK_VIEW_INPUT_MAX_CHARS) {
      return "operator_execution_write_only_input_required";
    }
    return isDeepStrictEqual(stripTransientInput(expected), stripTransientInput(candidate))
      ? null
      : "operator_execution_action_parameters_mismatch";
  }
  return isDeepStrictEqual(expected.params, candidate.params)
    ? null
    : "operator_execution_action_parameters_mismatch";
}

export function buildBrowserTaskExecutionBinding(task) {
  const allActions = browserTaskActionsFromPlan(task, { pendingOnly: false });
  return allActions ? bindingForTask(task, allActions) : null;
}

export function validateBrowserTaskOperatorInputs({
  task,
  requestedTargetUrl,
  requestedActions,
} = {}) {
  const allActions = browserTaskActionsFromPlan(task, { pendingOnly: false });
  const storedBinding = task?.operatorExecutionBinding ?? null;
  if (!allActions) {
    return reject("operator_execution_plan_binding_required");
  }

  const derivedBinding = bindingForTask(task, allActions);
  if (!storedBinding) {
    return reject("operator_execution_binding_required", derivedBinding);
  }
  if (
    storedBinding.registry !== derivedBinding.registry
    || storedBinding.targetUrl !== derivedBinding.targetUrl
    || storedBinding.actionCount !== derivedBinding.actionCount
    || storedBinding.actionShapeHash !== derivedBinding.actionShapeHash
    || !isDeepStrictEqual(storedBinding.transientInputKinds, derivedBinding.transientInputKinds)
    || storedBinding.inputTextBound !== false
    || storedBinding.persisted !== true
  ) {
    return reject("operator_execution_binding_stale", derivedBinding);
  }

  if (requestedTargetUrl !== undefined && requestedTargetUrl !== null
    && normaliseTargetUrl(requestedTargetUrl) !== derivedBinding.targetUrl) {
    return reject("operator_execution_target_mismatch", derivedBinding);
  }

  const pendingActions = browserTaskActionsFromPlan(task);
  const evidence = {
    ...derivedBinding,
    source: "task_plan",
    pendingActionCount: pendingActions.length,
    actionShapeValidated: true,
  };

  if (!Array.isArray(requestedActions) || requestedActions.length === 0) {
    return {
      ok: true,
      targetUrl: derivedBinding.targetUrl,
      actions: null,
      binding: evidence,
    };
  }

  const candidateActions = normaliseBrowserTaskActions(requestedActions);
  if (candidateActions.length !== pendingActions.length) {
    return reject("operator_execution_action_count_mismatch", evidence);
  }

  for (let index = 0; index < pendingActions.length; index += 1) {
    const reason = validateAction(pendingActions[index], candidateActions[index]);
    if (reason) return reject(reason, evidence);
  }

  return {
    ok: true,
    targetUrl: derivedBinding.targetUrl,
    actions: candidateActions,
    binding: {
      ...evidence,
      source: "task_plan_with_transient_input",
      transientInputProvided: candidateActions.some((action) => WRITE_ONLY_INPUT_ACTIONS.has(action.kind)),
    },
  };
}
