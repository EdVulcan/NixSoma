export const observerClientRuntimeOperatorSessionScript = `function boundedOperatorRunLimit() {
  const value = operatorRunLimitInput.value.trim();
  const maxSteps = Number(value);
  if (!value || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 20) {
    throw new Error("Operator run limit must be between 1 and 20.");
  }
  return maxSteps;
}

async function runOperatorStepFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/step\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  renderOperatorPanel(result);
  renderEngineeringRecommendationFromOperatorResult(result);
  renderEngineeringPlanFromOperatorResult(result);
  taskHistoryFocus = result.task?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = result.task?.id ?? selectedHistoryTaskId;
  if (result.task?.id) taskDetailIdInput.value = result.task.id;
  setControlMessage(result.ran
    ? \`Operator completed task \${result.task?.id ?? "unknown"}.\`
    : "Operator step found no queued task.");
  await refreshAfterOperatorSession();
}

async function runOperatorLoopFromUi({ dryRun = false } = {}) {
  const maxSteps = boundedOperatorRunLimit();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/run\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxSteps, dryRun }),
  });

  renderOperatorPanel(result);
  renderEngineeringRecommendationFromOperatorResult(result);
  renderEngineeringPlanFromOperatorResult(result);
  const lastTask = dryRun
    ? result.nextTask ?? null
    : [...(result.steps ?? [])].reverse().find((step) => step.task?.id)?.task ?? null;
  taskHistoryFocus = lastTask?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = lastTask?.id ?? selectedHistoryTaskId;
  if (lastTask?.id) taskDetailIdInput.value = lastTask.id;
  setControlMessage(dryRun
    ? result.nextTask?.id
      ? \`Previewed queued task \${result.nextTask.id}; no task executed.\`
      : "Preview found no queued task."
    : result.ran
      ? \`Operator run completed \${result.count ?? result.steps?.length ?? 0} task(s).\`
      : "Operator run found no queued tasks.");
  await refreshAfterOperatorSession();
}

async function refreshAfterOperatorSession() {
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
  await refreshOperatorState();
  await refreshPolicyState();
  await refreshCapabilityHistory();
  await refreshCommandLedger();
}
`;
