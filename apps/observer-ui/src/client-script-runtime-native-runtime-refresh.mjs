export const observerClientNativeRuntimeRefreshTasksScript = `async function createNativePluginRuntimeRefreshTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-refresh-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native runtime refresh task \${result.task?.id ?? "unknown"}; review and approve it before operator execution.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginRuntimeRefreshEvidence();
}

`;
