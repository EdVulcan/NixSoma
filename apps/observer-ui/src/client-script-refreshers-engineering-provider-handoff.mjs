export const observerClientEngineeringProviderHandoffRefreshersScript = `async function createEngineeringProviderHandoffTask() {
  if (!engineeringProviderHandoffCreateButton || !engineeringProviderHandoffPromptInput) {
    return;
  }

  const prompt = engineeringProviderHandoffPromptInput.value.trim();
  if (!prompt) {
    setControlMessage("Enter a bounded provider request before creating the handoff task.");
    engineeringProviderHandoffPromptInput.focus();
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
            requestEnvelope: {
              model: "deepseek-chat",
              messages: [{ role: "user", content: prompt }],
            },
            responseContract: "engineering_recommendation_v0",
          },
        },
      }),
    });
    renderEngineeringProviderHandoff(data);
    const taskId = data?.result?.task?.id ?? "unknown";
    setControlMessage(\`Created pending DeepSeek handoff task \${taskId}; approval and operator execution remain separate.\`);
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

`;
