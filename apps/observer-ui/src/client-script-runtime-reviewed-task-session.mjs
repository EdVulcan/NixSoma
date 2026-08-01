export const observerClientRuntimeReviewedTaskSessionScript = `async function runSelectedReviewedWorkspaceCycleFromUi() {
  const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Select a reviewed task before running its workspace cycle.");
  }

  selectedHistoryTaskId = taskId;
  taskDetailIdInput.value = taskId;
  await runAiWorkspaceReviewedCycle();
}

async function rebindSelectedReviewedTaskFromUi() {
  const taskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
  if (!taskId) {
    throw new Error("Select a reviewed task before rebinding its work view.");
  }

  selectedHistoryTaskId = taskId;
  taskDetailIdInput.value = taskId;
  rebindSelectedReviewedTaskButton.disabled = true;
  try {
    const response = await fetchJson(observerConfig.coreUrl + "/capabilities/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.openclaw.engineering_context.work_view_bind",
        taskId,
        params: { confirm: true, rebind: true },
      }),
    });
    const result = response.result ?? {};
    const bind = result.bind ?? {};
    const summary = bind.summary ?? {};
    const governance = bind.governance ?? {};
    const invocationSummary = response.invocation?.summary ?? {};
    if (response.invoked !== true
      || response.capability?.id !== "act.openclaw.engineering_context.work_view_bind"
      || result.registry !== "openclaw-native-engineering-work-view-bind-v0"
      || !["bound", "already_bound"].includes(summary.status)
      || !["bind", "rebind", "noop"].includes(summary.operation)
      || invocationSummary.kind !== "engineering.work_view_bind"
      || governance.changesTaskStatus !== false
      || governance.callsProvider !== false
      || governance.networkEgress !== false
      || governance.createsTask !== false
      || governance.createsApproval !== false
      || governance.executesAction !== false) {
      throw new Error("Reviewed task work-view rebind result was invalid.");
    }

    await Promise.all([
      refreshRuntime(),
      refreshTaskList(),
      refreshTaskHistoryDetail(),
      refreshWorkView(),
      refreshScreen(),
    ]);
    const message = summary.operation === "noop"
      ? "Selected reviewed task is already bound to the current trusted work view."
      : "Rebound selected reviewed task to the current trusted work view; execution remains explicit.";
    setControlMessage(message);
    return result;
  } finally {
    rebindSelectedReviewedTaskButton.disabled = false;
  }
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
