export const observerClientEngineeringProviderHandoffRefreshersScript = `function syncEngineeringProviderIncidentMode() {
  const incidentMode = engineeringProviderHandoffIncludeSystemdIncident?.checked === true;
  if (engineeringProviderHandoffPromptInput) {
    engineeringProviderHandoffPromptInput.disabled = incidentMode;
  }
  if (engineeringProviderHandoffResponseContract) {
    engineeringProviderHandoffResponseContract.disabled = incidentMode;
    if (incidentMode) {
      engineeringProviderHandoffResponseContract.value = "engineering_recommendation_v0";
    }
  }
}

async function createEngineeringProviderHandoffTask() {
  if (!engineeringProviderHandoffCreateButton || !engineeringProviderHandoffPromptInput) {
    return;
  }

  const prompt = engineeringProviderHandoffPromptInput.value.trim();
  const sourceTaskId = engineeringProviderHandoffSourceTaskIdInput?.value.trim() ?? "";
  const includeSystemdIncidentReceipt = engineeringProviderHandoffIncludeSystemdIncident?.checked === true;
  const responseContract = !includeSystemdIncidentReceipt
    && engineeringProviderHandoffResponseContract?.value === "engineering_plan_v0"
    ? "engineering_plan_v0"
    : "engineering_recommendation_v0";
  if (!includeSystemdIncidentReceipt && !prompt) {
    setControlMessage("Enter a bounded provider request before creating the handoff task.");
    engineeringProviderHandoffPromptInput.focus();
    return;
  }
  if (includeSystemdIncidentReceipt && !sourceTaskId) {
    setControlMessage("Select a completed systemd repair task before creating the incident handoff.");
    engineeringProviderHandoffSourceTaskIdInput?.focus();
    return;
  }

  engineeringProviderHandoffCreateButton.disabled = true;
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.openclaw.engineering_context.provider_handoff_task",
        approved: true,
        params: {
          confirm: true,
          liveProviderExecution: {
            credentialReference: "openclaw://credential/deepseek-api-key",
            ...(!includeSystemdIncidentReceipt
              ? {
                  requestEnvelope: {
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: prompt }],
                  },
                }
              : {}),
            responseContract,
            ...((sourceTaskId || responseContract === "engineering_plan_v0" || includeSystemdIncidentReceipt)
              ? {
                  contextPacket: {
                    requested: true,
                    ...(sourceTaskId ? { sourceTaskId } : {}),
                    ...(responseContract === "engineering_plan_v0" ? { includePlanTodo: true } : {}),
                    ...(includeSystemdIncidentReceipt ? { includeSystemdIncidentReceipt: true } : {}),
                  },
                }
              : {}),
          },
        },
      }),
    });
    renderEngineeringProviderHandoff(data);
    const taskId = data?.result?.task?.id ?? "unknown";
    setControlMessage(includeSystemdIncidentReceipt
      ? \`Created pending systemd incident diagnosis task \${taskId}; approval remains required before provider contact.\`
      : \`Created pending DeepSeek handoff task \${taskId}; approval and operator execution remain separate.\`);
  } catch (error) {
    engineeringProviderHandoffStatus.textContent = "blocked";
    engineeringProviderHandoffJson.textContent = \`Unable to create the provider handoff task: \${formatError(error)}\`;
    setControlMessage("Provider handoff task was not created.");
  } finally {
    engineeringProviderHandoffCreateButton.disabled = false;
  }
}

engineeringProviderHandoffCreateButton?.addEventListener("click", () => {
  void createEngineeringProviderHandoffTask();
});
engineeringProviderHandoffIncludeSystemdIncident?.addEventListener("change", syncEngineeringProviderIncidentMode);
syncEngineeringProviderIncidentMode();

`;
