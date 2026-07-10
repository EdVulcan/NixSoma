import { buildPlanTodoNextGovernedActionSuggestion } from "./native-engineering-plan-todo-next-action.mjs";

export const NATIVE_ENGINEERING_PLAN_TODO_SUGGESTION_LINK_REGISTRY =
  "openclaw-native-engineering-plan-todo-suggestion-link-v0";

function boundedIdentifier(value, label, maxChars = 160) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Native engineering plan/todo suggestion link requires ${label}.`);
  }
  return text.slice(0, maxChars);
}

function requireRecord(records, taskId) {
  const record = records?.get?.(taskId) ?? null;
  if (!record) {
    throw new Error("Native engineering plan/todo suggestion link requires persisted workbench state.");
  }
  return record;
}

export function buildNativeEngineeringPlanTodoSuggestionLink({
  input = null,
  records = new Map(),
  tasks = new Map(),
  expectedActionId,
  now = () => new Date().toISOString(),
} = {}) {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Native engineering plan/todo suggestion link must be an object.");
  }

  const sourceTaskId = boundedIdentifier(input.sourceTaskId, "sourceTaskId");
  const sourceTask = tasks?.get?.(sourceTaskId) ?? null;
  if (!sourceTask?.id) {
    throw new Error("Native engineering plan/todo suggestion link source task does not exist.");
  }
  const record = requireRecord(records, sourceTaskId);
  const derived = buildPlanTodoNextGovernedActionSuggestion({
    todos: record.todos ?? [],
    todoSource: "workbench_storage",
    workbenchStatePersisted: true,
  });
  const currentTodo = derived.currentTodo;
  const action = derived.suggestion;
  if (!currentTodo?.id || !action?.actionId) {
    throw new Error("Native engineering plan/todo suggestion link has no current governed action.");
  }

  const requestedActionId = boundedIdentifier(input.actionId, "actionId", 80);
  const requiredActionId = boundedIdentifier(expectedActionId, "expectedActionId", 80);
  if (requestedActionId !== requiredActionId || action.actionId !== requiredActionId) {
    throw new Error("Native engineering plan/todo suggestion link action does not match the governed task path.");
  }
  if (input.sourceRegistry !== derived.registry) {
    throw new Error("Native engineering plan/todo suggestion link source registry mismatch.");
  }
  if (input.currentTodoId !== currentTodo.id || input.currentTodoStatus !== currentTodo.status) {
    throw new Error("Native engineering plan/todo suggestion link current todo mismatch.");
  }
  if (input.expectedObserverControlId !== action.existingObserverControlId) {
    throw new Error("Native engineering plan/todo suggestion link Observer control mismatch.");
  }
  if (input.existingCapabilityId !== action.existingCapabilityId) {
    throw new Error("Native engineering plan/todo suggestion link capability mismatch.");
  }
  if (
    input.sourceWorkbenchRevision !== undefined
    && input.sourceWorkbenchRevision !== record.revision
  ) {
    throw new Error("Native engineering plan/todo suggestion link workbench revision mismatch.");
  }

  return {
    registry: NATIVE_ENGINEERING_PLAN_TODO_SUGGESTION_LINK_REGISTRY,
    mode: "governed-suggestion-task-provenance",
    generatedAt: now(),
    source: {
      taskId: sourceTaskId,
      taskStatus: sourceTask.status ?? null,
      workbenchRecordId: record.recordId ?? null,
      workbenchRevision: record.revision ?? 0,
      todoId: currentTodo.id,
      todoStatus: currentTodo.status ?? null,
      todoSha256: record.todoSha256 ?? null,
      evidenceRoute: `/plugins/native-adapter/engineering-plan-todo/evidence?taskId=${encodeURIComponent(sourceTaskId)}&limit=8`,
    },
    action: {
      suggestionRegistry: derived.registry,
      actionId: action.actionId,
      capabilityId: action.existingCapabilityId,
      expectedObserverControlId: action.existingObserverControlId,
      requiresApproval: action.requiresApproval === true,
    },
    governance: {
      runtimeOwner: "openclaw_on_nixos",
      sourceRecomputedFromPersistedWorkbench: true,
      arbitraryEndpointAllowed: false,
      automaticApprovalAllowed: false,
      automaticExecutionAllowed: false,
      providerCallAllowed: false,
      resultEnvelopeAllowed: false,
      todoDescriptionExposed: false,
      workspaceContentExposed: false,
      commandPayloadExposed: false,
    },
  };
}
