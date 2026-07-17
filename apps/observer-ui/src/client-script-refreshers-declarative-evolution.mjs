export const observerClientDeclarativeEvolutionRefreshersScript = `function clearDeclarativeEvolutionActivationReview(message = "Enter a completed staging task ID to review the health boundary.") {
  declarativeEvolutionActivationRegistry.textContent = "unknown";
  declarativeEvolutionHealthGateStatus.textContent = "not selected";
  declarativeEvolutionHostHealthStatus.textContent = "not selected";
  declarativeEvolutionActivationReady.textContent = "false";
  declarativeEvolutionReviewJson.textContent = message;
}

async function refreshDeclarativeEvolutionActivationDecision() {
  if (!declarativeEvolutionSourceTaskIdInput) {
    return;
  }

  const taskId = declarativeEvolutionSourceTaskIdInput.value.trim();
  if (!taskId) {
    clearDeclarativeEvolutionActivationReview();
    return;
  }

  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/declarative-evolution/activation-decision?taskId=\${encodeURIComponent(taskId)}\`);
    renderDeclarativeEvolutionActivationReview(data);
  } catch (error) {
    declarativeEvolutionHealthGateStatus.textContent = "offline";
    declarativeEvolutionHostHealthStatus.textContent = "unknown";
    declarativeEvolutionActivationReady.textContent = "false";
    declarativeEvolutionReviewJson.textContent = \`Unable to read the activation decision review: \${formatError(error)}\`;
  }
}

async function createDeclarativeEvolutionActivationDecision() {
  if (!declarativeEvolutionSourceTaskIdInput || !declarativeEvolutionDecisionButton) {
    return;
  }

  const taskId = declarativeEvolutionSourceTaskIdInput.value.trim();
  const decision = declarativeEvolutionDecision?.value ?? "reject_activation";
  if (!taskId) {
    setControlMessage("Enter a completed staging task ID before queueing an activation decision.");
    declarativeEvolutionSourceTaskIdInput.focus();
    return;
  }

  declarativeEvolutionDecisionButton.disabled = true;
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/declarative-evolution/activation-decisions\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, decision, confirm: true }),
    });
    renderDeclarativeEvolutionActivationReview(data.review ?? {});
    renderDeclarativeEvolutionActivationDecision(data);
    const task = data.task ?? {};
    setControlMessage(\`Queued declarative-evolution decision task \${task.id ?? "unknown"}; approval and execution remain explicit.\`);
    await Promise.all([
      refreshRuntime(),
      refreshTaskList(),
      refreshTaskHistoryDetail(),
      refreshApprovalState(),
    ]);
  } catch (error) {
    declarativeEvolutionDecisionJson.textContent = \`Unable to queue the activation decision: \${formatError(error)}\`;
    setControlMessage("Declarative-evolution activation decision was not queued.");
  } finally {
    declarativeEvolutionDecisionButton.disabled = false;
  }
}

async function createDeclarativeEvolutionActivation() {
  if (!declarativeEvolutionDecisionTaskIdInput || !declarativeEvolutionActivationButton) {
    return;
  }
  const activationDecisionTaskId = declarativeEvolutionDecisionTaskIdInput.value.trim();
  if (!activationDecisionTaskId) {
    setControlMessage("Enter a completed approved decision task ID before queueing activation.");
    declarativeEvolutionDecisionTaskIdInput.focus();
    return;
  }
  declarativeEvolutionActivationButton.disabled = true;
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/declarative-evolution/activation-tasks\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activationDecisionTaskId, confirm: true }),
    });
    renderDeclarativeEvolutionActivationExecution(data);
    setControlMessage(\`Queued activation task \${data.task?.id ?? "unknown"}; host mutation still requires approval and fixed hostd.\`);
    await Promise.all([
      refreshRuntime(),
      refreshTaskList(),
      refreshTaskHistoryDetail(),
      refreshApprovalState(),
    ]);
  } catch (error) {
    declarativeEvolutionExecutionJson.textContent = \`Unable to queue managed-config activation: \${formatError(error)}\`;
    setControlMessage("Managed-config activation was not queued.");
  } finally {
    declarativeEvolutionActivationButton.disabled = false;
  }
}

declarativeEvolutionRefreshButton?.addEventListener("click", () => {
  void refreshDeclarativeEvolutionActivationDecision();
});

declarativeEvolutionDecisionButton?.addEventListener("click", () => {
  void createDeclarativeEvolutionActivationDecision();
});

declarativeEvolutionActivationButton?.addEventListener("click", () => {
  void createDeclarativeEvolutionActivation();
});

`;
