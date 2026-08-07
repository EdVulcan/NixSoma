import { createHash } from "node:crypto";

export const REVIEWED_WORKFLOW_SELECTION_REGISTRY =
  "nixsoma-reviewed-workflow-selection-v0";
export const REVIEWED_WORKFLOW_ACCEPTANCE_REGISTRY =
  "nixsoma-reviewed-workflow-acceptance-v0";

const RECIPE_VERSION = 0;
const ACCEPTANCE_VERSION = 0;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const NATIVE_INTAKE_GOAL = /^Type exact text "[A-Za-z0-9 .,_-]{1,32}" into the active surface$/u;
const MULTI_APPLICATION_GOAL = /^Enter exact text "[A-Za-z0-9 .,_-]{1,32}" in the current browser form, submit it, then type it into the fixed native intake$/u;

const RECIPES = Object.freeze([
  Object.freeze({
    workflowId: "bounded_run",
    capabilityId: "act.ai.workspace.bounded_run",
    workflowRegistry: "nixsoma-ai-workspace-bounded-run-v0",
    completionAuditField: "runCompletionAudit",
    maximumProviderCalls: 2,
    maximumActions: 2,
    maximumLifecycleActions: 0,
  }),
  Object.freeze({
    workflowId: "semantic_form_workflow",
    capabilityId: "act.ai.workspace.semantic_form_workflow",
    workflowRegistry: "nixsoma-ai-workspace-semantic-form-workflow-v0",
    completionAuditField: "workflowCompletionAudit",
    maximumProviderCalls: 2,
    maximumActions: 2,
    maximumLifecycleActions: 0,
  }),
  Object.freeze({
    workflowId: "native_intake_workflow",
    capabilityId: "act.ai.workspace.native_intake_workflow",
    workflowRegistry: "nixsoma-ai-workspace-native-intake-workflow-v0",
    completionAuditField: "workflowCompletionAudit",
    maximumProviderCalls: 1,
    maximumActions: 1,
    maximumLifecycleActions: 2,
    goalPattern: NATIVE_INTAKE_GOAL,
  }),
  Object.freeze({
    workflowId: "reviewed_multi_application_mission",
    capabilityId: "act.ai.workspace.reviewed_multi_application_mission",
    workflowRegistry: "nixsoma-ai-workspace-reviewed-multi-application-mission-v0",
    completionAuditField: "missionCompletionAudit",
    maximumProviderCalls: 3,
    maximumActions: 3,
    maximumLifecycleActions: 2,
    goalPattern: MULTI_APPLICATION_GOAL,
    fixedApplicationOrder: ["fixed_browser_form", "fixed_native_intake"],
  }),
]);

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function boundedHash(value) {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function canonicalRecipe(recipe) {
  return JSON.stringify({
    registry: REVIEWED_WORKFLOW_SELECTION_REGISTRY,
    version: RECIPE_VERSION,
    workflowId: recipe.workflowId,
    capabilityId: recipe.capabilityId,
    workflowRegistry: recipe.workflowRegistry,
    completionAuditField: recipe.completionAuditField,
    maximumProviderCalls: recipe.maximumProviderCalls,
    maximumActions: recipe.maximumActions,
    maximumLifecycleActions: recipe.maximumLifecycleActions,
    fixedApplicationOrder: recipe.fixedApplicationOrder ?? [],
  });
}

function recipeHash(recipe) {
  return createHash("sha256").update(canonicalRecipe(recipe), "utf8").digest("hex");
}

function publicRecipe(recipe) {
  return {
    registry: REVIEWED_WORKFLOW_SELECTION_REGISTRY,
    version: RECIPE_VERSION,
    workflowId: recipe.workflowId,
    capabilityId: recipe.capabilityId,
    workflowRegistry: recipe.workflowRegistry,
    selectionHash: recipeHash(recipe),
    completionAuditField: recipe.completionAuditField,
    maximumProviderCalls: recipe.maximumProviderCalls,
    maximumActions: recipe.maximumActions,
    maximumLifecycleActions: recipe.maximumLifecycleActions,
    fixedApplicationOrder: recipe.fixedApplicationOrder ?? [],
  };
}

function recipeFor(value) {
  const workflowId = typeof value === "string"
    ? value
    : value?.workflowId;
  const id = safeId(workflowId);
  return id ? RECIPES.find((recipe) => recipe.workflowId === id) ?? null : null;
}

export function listReviewedWorkflowRecipes() {
  return RECIPES.map(publicRecipe);
}

export function resolveReviewedWorkflowRecipe(workflowId = "bounded_run", goal = null) {
  const recipe = recipeFor(workflowId);
  if (!recipe) return null;
  if (recipe.goalPattern && goal !== null
    && (typeof goal !== "string" || !recipe.goalPattern.test(goal))) {
    return null;
  }
  return publicRecipe(recipe);
}

export function buildReviewedWorkflowSelection({ workflowId = "bounded_run", goal = null } = {}) {
  const selection = resolveReviewedWorkflowRecipe(workflowId, goal);
  if (!selection) {
    throw new Error("Reviewed worklist workflow must be one fixed recipe compatible with its goal.");
  }
  return selection;
}

export function normaliseReviewedWorkflowSelection(value, goal = null) {
  const selection = buildReviewedWorkflowSelection({
    workflowId: value?.workflowId ?? "bounded_run",
    goal,
  });
  if (value?.registry !== undefined
    && value.registry !== REVIEWED_WORKFLOW_SELECTION_REGISTRY) return null;
  if (value?.version !== undefined && value.version !== RECIPE_VERSION) return null;
  if (value?.selectionHash !== undefined && value.selectionHash !== selection.selectionHash) return null;
  if (value?.capabilityId !== undefined && value.capabilityId !== selection.capabilityId) return null;
  if (value?.workflowRegistry !== undefined && value.workflowRegistry !== selection.workflowRegistry) return null;
  return selection;
}

export function sameReviewedWorkflowSelection(left, right) {
  return left?.registry === REVIEWED_WORKFLOW_SELECTION_REGISTRY
    && left?.version === RECIPE_VERSION
    && right?.registry === REVIEWED_WORKFLOW_SELECTION_REGISTRY
    && right?.version === RECIPE_VERSION
    && left.workflowId === right.workflowId
    && left.selectionHash === right.selectionHash
    && left.capabilityId === right.capabilityId
    && left.workflowRegistry === right.workflowRegistry;
}

function summaryAudit(summary, selection) {
  return summary?.[selection.completionAuditField] === true
    || (selection.completionAuditField === "runCompletionAudit" && summary?.runCompletionAudit === true)
    || (selection.completionAuditField === "workflowCompletionAudit" && summary?.workflowCompletionAudit === true)
    || (selection.completionAuditField === "missionCompletionAudit" && summary?.missionCompletionAudit === true);
}

export function compactReviewedWorkflowOutcome({ selection, response } = {}) {
  const summary = response?.summary ?? {};
  return {
    registry: REVIEWED_WORKFLOW_SELECTION_REGISTRY,
    version: RECIPE_VERSION,
    workflowId: selection?.workflowId ?? null,
    capabilityId: selection?.capabilityId ?? null,
    workflowRegistry: selection?.workflowRegistry ?? null,
    selectionHash: selection?.selectionHash ?? null,
    capabilityInvocationId: safeId(response?.invocation?.id),
    ok: response?.ok === true && response?.invoked === true && response?.blocked !== true,
    status: typeof summary.status === "string" ? summary.status.slice(0, 80) : null,
    terminalReason: typeof summary.terminalReason === "string"
      ? summary.terminalReason.slice(0, 120)
      : null,
    taskId: safeId(summary.taskId),
    objectiveContentHash: boundedHash(summary.objectiveContentHash),
    taskVersionHash: boundedHash(summary.taskVersionHash),
    stepCount: Number.isInteger(summary.stepCount) ? summary.stepCount : null,
    applicationCount: Number.isInteger(summary.applicationCount) ? summary.applicationCount : null,
    providerCallCount: Number.isInteger(summary.providerCallCount) || summary.providerCallCount === null
      ? summary.providerCallCount
      : null,
    actionCount: Number.isInteger(summary.actionCount) || summary.actionCount === null
      ? summary.actionCount
      : null,
    lifecycleActionCount: Number.isInteger(summary.lifecycleActionCount)
      || summary.lifecycleActionCount === null
      ? summary.lifecycleActionCount
      : null,
    completionAudit: summaryAudit(summary, selection),
    continuationAudit: summary.continuationAudit === true,
    outcomeUnknown: summary.outcomeUnknown === true,
  };
}

export function reviewedWorkflowOutcomeComplete(outcome, selection, taskId) {
  return outcome?.registry === REVIEWED_WORKFLOW_SELECTION_REGISTRY
    && sameReviewedWorkflowSelection(outcome, selection)
    && outcome.ok === true
    && outcome.status === "completed"
    && outcome.completionAudit === true
    && outcome.outcomeUnknown === false
    && outcome.taskId === taskId;
}

export function normaliseReviewedWorkflowOutcome(value, selection, taskId = null) {
  const outcome = compactReviewedWorkflowOutcome({ selection, response: { summary: value } });
  if (value?.registry !== REVIEWED_WORKFLOW_SELECTION_REGISTRY
    || value.workflowId !== selection?.workflowId
    || value.capabilityId !== selection?.capabilityId
    || value.workflowRegistry !== selection?.workflowRegistry
    || value.selectionHash !== selection?.selectionHash
    || (taskId !== null && value.taskId !== taskId)) return null;
  return {
    ...outcome,
    capabilityInvocationId: safeId(value.capabilityInvocationId),
    ok: value.ok === true,
    status: typeof value.status === "string" ? value.status.slice(0, 80) : null,
    terminalReason: typeof value.terminalReason === "string" ? value.terminalReason.slice(0, 120) : null,
    taskId: safeId(value.taskId),
    objectiveContentHash: boundedHash(value.objectiveContentHash),
    taskVersionHash: boundedHash(value.taskVersionHash),
    completionAudit: value.completionAudit === true,
    continuationAudit: value.continuationAudit === true,
    outcomeUnknown: value.outcomeUnknown === true,
  };
}

export function reviewedWorkflowOutcomeHash(outcome) {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) return null;
  return createHash("sha256").update(JSON.stringify(outcome), "utf8").digest("hex");
}

function canonicalWorkflowAcceptance({
  worklistId,
  missionId,
  itemId,
  itemOrdinal,
  taskId,
  workflowSelection,
  outcomeHash,
  acceptedAt,
} = {}) {
  return JSON.stringify({
    registry: REVIEWED_WORKFLOW_ACCEPTANCE_REGISTRY,
    version: ACCEPTANCE_VERSION,
    worklistId,
    missionId,
    itemId,
    itemOrdinal,
    taskId,
    workflowId: workflowSelection.workflowId,
    selectionHash: workflowSelection.selectionHash,
    outcomeHash,
    acceptedAt,
  });
}

export function buildReviewedWorkflowAcceptance({
  worklistId,
  missionId,
  itemId,
  itemOrdinal,
  taskId,
  workflowSelection,
  outcomeHash,
  acceptedAt,
} = {}) {
  const canonicalSelection = normaliseReviewedWorkflowSelection(workflowSelection);
  if (![worklistId, missionId, itemId, taskId].every(safeId)
    || !Number.isInteger(itemOrdinal)
    || itemOrdinal < 1
    || !canonicalSelection
    || !sameReviewedWorkflowSelection(workflowSelection, canonicalSelection)
    || !boundedHash(outcomeHash)
    || typeof acceptedAt !== "string"
    || !Number.isFinite(Date.parse(acceptedAt))) {
    throw new Error("Reviewed workflow acceptance requires the exact current receipt binding.");
  }
  const canonical = canonicalWorkflowAcceptance({
    worklistId,
    missionId,
    itemId,
    itemOrdinal,
    taskId,
    workflowSelection: canonicalSelection,
    outcomeHash,
    acceptedAt,
  });
  return {
    registry: REVIEWED_WORKFLOW_ACCEPTANCE_REGISTRY,
    version: ACCEPTANCE_VERSION,
    worklistId,
    missionId,
    itemId,
    itemOrdinal,
    taskId,
    workflowId: canonicalSelection.workflowId,
    selectionHash: canonicalSelection.selectionHash,
    outcomeHash,
    acceptanceHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
    acceptedAt,
    explicitOperatorConfirmation: true,
    providerCalled: false,
    actionExecuted: false,
    mutatesHost: false,
  };
}

export function normaliseReviewedWorkflowAcceptance(value, expected = {}) {
  try {
    const receipt = buildReviewedWorkflowAcceptance(expected);
    if (!value || typeof value !== "object" || Array.isArray(value)
      || value.registry !== REVIEWED_WORKFLOW_ACCEPTANCE_REGISTRY
      || value.version !== ACCEPTANCE_VERSION
      || value.worklistId !== receipt.worklistId
      || value.missionId !== receipt.missionId
      || value.itemId !== receipt.itemId
      || value.itemOrdinal !== receipt.itemOrdinal
      || value.taskId !== receipt.taskId
      || value.workflowId !== receipt.workflowId
      || value.selectionHash !== receipt.selectionHash
      || value.outcomeHash !== receipt.outcomeHash
      || value.acceptedAt !== receipt.acceptedAt
      || value.acceptanceHash !== receipt.acceptanceHash
      || value.explicitOperatorConfirmation !== true
      || value.providerCalled !== false
      || value.actionExecuted !== false
      || value.mutatesHost !== false) return null;
    return receipt;
  } catch {
    return null;
  }
}

export function reviewedWorkflowSelectionGovernance() {
  return {
    registry: REVIEWED_WORKFLOW_SELECTION_REGISTRY,
    version: RECIPE_VERSION,
    explicitOperatorSelection: true,
    immutableAfterBinding: true,
    fixedServerRecipeAllowlist: true,
    providerCanSelectWorkflow: false,
    providerCanChangeWorkflow: false,
    providerCanExtendWorklist: false,
    arbitraryApplicationSelection: false,
    automaticRetry: false,
    automaticSkip: false,
    automaticRepeat: false,
    explicitWorkflowAcceptance: true,
    automaticWorkflowAcceptance: false,
    mutatesHost: false,
  };
}
