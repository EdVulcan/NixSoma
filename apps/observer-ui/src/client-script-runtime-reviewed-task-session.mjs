export const observerClientRuntimeReviewedTaskSessionScript = `async function runSelectedReviewedWorkspaceCycleFromUi() {
  const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Select a reviewed task before running its workspace cycle.");
  }

  selectedHistoryTaskId = taskId;
  taskDetailIdInput.value = taskId;
  await runAiWorkspaceReviewedCycle();
}
`;
