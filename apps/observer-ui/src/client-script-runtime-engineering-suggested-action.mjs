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

  await control.run();
}

`;
