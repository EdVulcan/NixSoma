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

engineeringContextPacketBuildButton?.addEventListener("click", () => {
  void refreshEngineeringContextPacket();
});

`;
