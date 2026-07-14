export const observerClientEngineeringContextRefreshersScript = `async function refreshEngineeringContextPacket() {
  if (!engineeringContextPacketBuildButton) {
    return;
  }

  engineeringContextPacketBuildButton.disabled = true;
  try {
    const taskId = typeof taskDetailIdInput?.value === "string" && taskDetailIdInput.value.trim()
      ? taskDetailIdInput.value.trim()
      : null;
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-context/packet\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId,
        limit: 8,
        maxOutputChars: 2000,
        thresholdChars: 2000,
        protectRecentAssistantTurns: 3,
        includeWorkView: true,
      }),
    });
    renderEngineeringContextPacket(data);
    setControlMessage(\`Built local engineering context packet with \${data.summary?.messageCount ?? 0} message(s).\`);
  } catch (error) {
    engineeringContextPacketAudit.textContent = "unavailable";
    engineeringContextPacketJson.textContent = \`Unable to build local engineering context packet: \${formatError(error)}\`;
    setControlMessage("Engineering context packet was not built.");
  } finally {
    engineeringContextPacketBuildButton.disabled = false;
  }
}

async function bindEngineeringContextTaskToWorkView() {
  const taskId = typeof taskDetailIdInput?.value === "string" && taskDetailIdInput.value.trim()
    ? taskDetailIdInput.value.trim()
    : null;
  if (!taskId) {
    setControlMessage("Select a task before binding it to the trusted work view.");
    return;
  }

  engineeringContextPacketBindWorkViewButton.disabled = true;
  try {
    const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-context/work-view/bind\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, confirm: true }),
    });
    await refreshEngineeringContextPacket();
    setControlMessage(\`Bound task \${taskId} to the current trusted work view; task execution was not started.\`);
    return result;
  } catch (error) {
    engineeringContextPacketBinding.textContent = "blocked";
    setControlMessage(\`Trusted work-view bind was blocked: \${formatError(error)}.\`);
    throw error;
  } finally {
    engineeringContextPacketBindWorkViewButton.disabled = false;
  }
}

async function prepareEngineeringContextWorkView() {
  if (!engineeringContextPacketRecoveryButton) {
    return;
  }

  engineeringContextPacketRecoveryButton.disabled = true;
  try {
    await runRecommendedWorkViewAction();
    await refreshEngineeringContextPacket();
    setControlMessage("Completed the trusted work-view recovery action from the context packet recommendation.");
  } catch (error) {
    setControlMessage(\`Trusted work-view recovery was blocked: \${formatError(error)}.\`);
    throw error;
  } finally {
    engineeringContextPacketRecoveryButton.disabled = false;
  }
}

engineeringContextPacketBuildButton?.addEventListener("click", () => {
  void refreshEngineeringContextPacket();
});

engineeringContextPacketBindWorkViewButton?.addEventListener("click", () => {
  void bindEngineeringContextTaskToWorkView().catch(() => {});
});

engineeringContextPacketRecoveryButton?.addEventListener("click", () => {
  void prepareEngineeringContextWorkView().catch(() => {});
});

`;
