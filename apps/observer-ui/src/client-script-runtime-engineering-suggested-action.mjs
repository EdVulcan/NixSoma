export const observerClientRuntimeEngineeringSuggestedActionScript = `const GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS = Object.freeze({
  review_current_todo: {
    controlId: "engineering-plan-todo-bridge-button",
    run: bridgeEngineeringPlanningWorkbenchState,
  },
  save_workbench_state: {
    controlId: "engineering-plan-todo-save-button",
    run: saveEngineeringPlanningWorkbenchState,
  },
  create_edit_proposal_task: {
    controlId: "engineering-edit-proposal-task-button",
    run: createEngineeringEditLoopApprovalTask,
  },
  create_write_proposal_task: {
    controlId: "engineering-write-proposal-task-button",
    run: createEngineeringWriteLoopApprovalTask,
  },
  create_verification_task: {
    controlId: "engineering-verification-task-button",
    run: createEngineeringVerificationLoopApprovalTask,
  },
});

function currentEngineeringPlanTodoSuggestion() {
  return latestEngineeringPlanTodoWorkbenchState?.nextGovernedActionSuggestion
    ?? latestEngineeringPlanTodoEvidence?.nextGovernedActionSuggestion
    ?? null;
}

function buildEngineeringPlanTodoSuggestionLinkInput(suggestion, control) {
  const workbench = latestEngineeringPlanTodoWorkbenchState;
  const currentTodo = suggestion?.currentTodo ?? null;
  if (workbench?.todoSource !== "workbench_storage") {
    throw new Error("Save the visible workbench state before creating a task from its suggestion.");
  }
  if (!workbench.taskId || !currentTodo?.id || !currentTodo?.status) {
    throw new Error("The governed plan/todo suggestion is missing durable source state.");
  }
  return {
    sourceRegistry: suggestion.registry,
    sourceTaskId: workbench.taskId,
    sourceWorkbenchRevision: latestEngineeringPlanTodoEvidence?.workbenchStorage?.revision ?? undefined,
    currentTodoId: currentTodo.id,
    currentTodoStatus: currentTodo.status,
    actionId: suggestion.suggestion.actionId,
    expectedObserverControlId: control.controlId,
    existingCapabilityId: suggestion.suggestion.existingCapabilityId,
  };
}

function engineeringPlanTodoSuggestionLinkLines(link) {
  if (!link?.source?.taskId || !link?.action?.actionId) {
    return [];
  }
  return [
    "Suggestion Link: " + link.action.actionId + " capability=" + (link.action.capabilityId ?? "unknown"),
    "Suggestion Source: task=" + link.source.taskId + " todo=" + (link.source.todoId ?? "none") + " status=" + (link.source.todoStatus ?? "unknown") + " revision=" + (link.source.workbenchRevision ?? 0),
    "Suggestion Evidence: " + (link.source.evidenceRoute ?? "none"),
    "Suggestion Governance: arbitraryEndpoint=" + Boolean(link.governance?.arbitraryEndpointAllowed) + " autoApproval=" + Boolean(link.governance?.automaticApprovalAllowed) + " autoExecution=" + Boolean(link.governance?.automaticExecutionAllowed) + " provider=" + Boolean(link.governance?.providerCallAllowed) + " resultEnvelope=" + Boolean(link.governance?.resultEnvelopeAllowed),
  ];
}

async function useEngineeringPlanningSuggestedAction() {
  if (!currentEngineeringPlanTodoSuggestion()) {
    await bridgeEngineeringPlanningWorkbenchState();
  }
  const suggestion = currentEngineeringPlanTodoSuggestion();
  const actionId = suggestion?.suggestion?.actionId ?? "none";
  if (suggestion?.governance?.guidanceOnly !== true) {
    throw new Error("No governed plan/todo suggestion is available.");
  }
  const control = GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS[actionId];
  if (!control) {
    throw new Error(\`Unsupported governed plan/todo suggestion: \${actionId}\`);
  }
  const suggestedControlId = suggestion?.suggestion?.existingObserverControlId ?? "";
  if (suggestedControlId !== control.controlId) {
    throw new Error(\`Governed plan/todo suggestion control mismatch: \${suggestedControlId || "none"}\`);
  }

  if (actionId === "review_current_todo") {
    await control.run();
    setControlMessage("Reviewed current plan/todo suggestion; choose an existing governed control explicitly.");
    return;
  }

  const suggestionLink = actionId === "save_workbench_state"
    ? null
    : buildEngineeringPlanTodoSuggestionLinkInput(suggestion, control);
  await control.run(suggestionLink);
}

`;
