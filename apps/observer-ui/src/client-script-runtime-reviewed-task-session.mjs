export const observerClientRuntimeReviewedTaskSessionScript = `async function runSelectedReviewedWorkspaceCycleFromUi() {
  const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Select a reviewed task before running its workspace cycle.");
  }

  selectedHistoryTaskId = taskId;
  taskDetailIdInput.value = taskId;
  await runAiWorkspaceReviewedCycle();
}

async function acceptSelectedReviewedWorkspaceAssessmentFromUi() {
  const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Select a reviewed task before accepting its assessment.");
  }

  selectedHistoryTaskId = taskId;
  taskDetailIdInput.value = taskId;
  await acceptAiWorkspaceAssessment();
}
`;
