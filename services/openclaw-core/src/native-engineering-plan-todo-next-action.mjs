export const NATIVE_ENGINEERING_PLAN_TODO_NEXT_ACTION_REGISTRY =
  "openclaw-native-engineering-plan-todo-next-action-v0";

const ACTIONS = {
  review: {
    actionId: "review_current_todo",
    label: "Review current todo before selecting a governed action",
    existingObserverControlId: "engineering-plan-todo-bridge-button",
    existingCapabilityId: "sense.openclaw.engineering_context.plan_todo_evidence",
    requiresApproval: false,
  },
  save: {
    actionId: "save_workbench_state",
    label: "Save visible workbench state",
    existingObserverControlId: "engineering-plan-todo-save-button",
    existingCapabilityId: "act.openclaw.engineering_context.plan_todo_workbench_state",
    requiresApproval: false,
  },
  edit: {
    actionId: "create_edit_proposal_task",
    label: "Create governed edit proposal task",
    existingObserverControlId: "engineering-edit-proposal-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.edit_proposal_task",
    requiresApproval: true,
  },
  write: {
    actionId: "create_write_proposal_task",
    label: "Create governed write proposal task",
    existingObserverControlId: "engineering-write-proposal-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.write_proposal",
    requiresApproval: true,
  },
  verify: {
    actionId: "create_verification_task",
    label: "Create governed verification task",
    existingObserverControlId: "engineering-verification-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.verify",
    requiresApproval: true,
  },
  observe: {
    actionId: "observe_current_screen",
    label: "Observe the current trusted AI work view",
    existingObserverControlId: "invoke-screen-observation-button",
    existingCapabilityId: "sense.screen.observe",
    requiresApproval: false,
  },
  reviewSystemdIncident: {
    actionId: "review_systemd_incident_evidence",
    label: "Review the bound systemd incident receipt and recovery evidence",
    existingObserverControlId: "load-selected-task-button",
    existingCapabilityId: null,
    requiresApproval: false,
  },
  refreshSystemdIncident: {
    actionId: "refresh_systemd_incident_observation",
    label: "Refresh read-only health and journal observation for the bound systemd incident",
    existingObserverControlId: "refresh-systemd-journal-evidence-button",
    existingCapabilityId: "act.openclaw.systemd_incident.observation_receipt",
    requiresApproval: false,
  },
  semanticClick: {
    actionId: "create_semantic_click_task",
    label: "Create a reviewed semantic click task for the current trusted work view target",
    existingObserverControlId: "create-semantic-click-task-button",
    existingCapabilityId: "plan.openclaw.browser.semantic_click_task",
    requiresApproval: true,
  },
};

export function getNativeEngineeringPlanTodoActionById(actionId) {
  const action = Object.values(ACTIONS).find((candidate) => candidate.actionId === actionId);
  return action ? { ...action } : null;
}

export function listNativeEngineeringPlanTodoActions() {
  return Object.values(ACTIONS).map((action) => ({ ...action }));
}

function selectCurrentTodo(todos = []) {
  return todos.find((todo) => todo?.status === "in_progress")
    ?? todos.find((todo) => todo?.status === "pending")
    ?? todos[0]
    ?? null;
}

function classifyTodo(todo) {
  const text = `${todo?.id ?? ""} ${todo?.description ?? ""}`.toLowerCase();
  if (/(verify|test|check|validate|milestone|typecheck)/.test(text)) {
    return ACTIONS.verify;
  }
  if (/(semantic[ _-]*click|click[ _-]*target)/.test(text)) {
    return ACTIONS.semanticClick;
  }
  if (/(observe|screen|capture|visual|work.?view)/.test(text)) {
    return ACTIONS.observe;
  }
  if (/(save|store|persist)/.test(text)) {
    return ACTIONS.save;
  }
  if (/(edit|patch|replace|change|modify|update)/.test(text)) {
    return ACTIONS.edit;
  }
  if (/(write|create|new file|add file)/.test(text)) {
    return ACTIONS.write;
  }
  return ACTIONS.review;
}

function compactTodo(todo) {
  if (!todo) {
    return null;
  }
  return {
    id: todo.id ?? null,
    status: todo.status ?? null,
    source: todo.source ?? null,
    taskId: todo.taskId ?? null,
    descriptionPreview: todo.description ?? "",
  };
}

export function buildPlanTodoNextGovernedActionSuggestion({
  todos = [],
  todoSource = "unknown",
  workbenchStatePersisted = false,
} = {}) {
  const currentTodo = selectCurrentTodo(todos);
  const action = currentTodo ? classifyTodo(currentTodo) : null;

  return {
    registry: NATIVE_ENGINEERING_PLAN_TODO_NEXT_ACTION_REGISTRY,
    mode: "operator-guidance-only",
    status: currentTodo ? "suggested" : "none",
    todoSource,
    currentTodo: compactTodo(currentTodo),
    suggestion: action
      ? {
          ...action,
          reason: `Selected from ${currentTodo.status ?? "unknown"} todo ${currentTodo.id ?? "unknown"}.`,
          createsTaskAutomatically: false,
          createsApprovalAutomatically: false,
          executesAutomatically: false,
        }
      : null,
    stateRecommendation: workbenchStatePersisted
      ? "use persisted visible workbench state"
      : "save visible workbench state before relying on this suggestion across reloads",
    governance: {
      guidanceOnly: true,
      usesExistingObserverControlsOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesWorkspace: false,
      mutatesTaskState: false,
      writesTodoFile: false,
      callsProvider: false,
      resultEnvelopeCreated: false,
    },
  };
}
