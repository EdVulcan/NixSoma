export const observerClientRuntimeReviewedBrowserTaskScript = `function reviewedBrowserTaskGoal() {
  const goal = taskGoalInput.value.trim();
  if (!goal) {
    throw new Error("Enter a task goal.");
  }
  return goal;
}

async function createReviewedBrowserTask({ includePlan = false } = {}) {
  const goal = reviewedBrowserTaskGoal();
  const targetUrl = getDesiredWorkViewUrl();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/reviewed-browser\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal, targetUrl, includePlan }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  if (includePlan) {
    renderPlanPanel(result.task ?? { plan: result.plan });
  } else {
    await launchTaskIntoWorkView(result.task?.id, targetUrl);
  }
  setControlMessage(includePlan
    ? \`Created reviewed plan \${result.task?.id ?? "unknown"}. Execution remains explicit.\`
    : \`Created reviewed task \${result.task?.id ?? "unknown"} and bound its work view.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
  return result;
}
`;
