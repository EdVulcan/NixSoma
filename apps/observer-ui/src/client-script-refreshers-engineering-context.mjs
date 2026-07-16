export const observerClientEngineeringContextRefreshersScript = `async function refreshEngineeringContextPacket() {
  if (!engineeringContextPacketBuildButton) {
    return;
  }

  engineeringContextPacketBuildButton.disabled = true;
  try {
    const taskId = typeof taskDetailIdInput?.value === "string" && taskDetailIdInput.value.trim()
      ? taskDetailIdInput.value.trim()
      : null;
    const sourceTaskId = typeof engineeringContextPacketSourceTaskIdInput?.value === "string"
      && engineeringContextPacketSourceTaskIdInput.value.trim()
      ? engineeringContextPacketSourceTaskIdInput.value.trim()
      : null;
    const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "sense.openclaw.engineering_context.packet",
        params: {
          taskId,
          sourceTaskId,
          limit: 8,
          maxOutputChars: 2000,
          thresholdChars: 2000,
          protectRecentAssistantTurns: 3,
          includeWorkView: true,
          includeWorkViewObservation: true,
          includePlanTodo: true,
        },
      }),
    });
    if (response.invoked !== true) {
      throw new Error("Engineering context packet capability was not invoked.");
    }
    const data = response.result ?? {};
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

function useEngineeringContextTaskDetailAsSource() {
  const taskId = typeof taskDetailIdInput?.value === "string" && taskDetailIdInput.value.trim()
    ? taskDetailIdInput.value.trim()
    : null;
  if (!taskId) {
    setControlMessage("Select a task detail before using it as the context packet source.");
    return;
  }

  engineeringContextPacketSourceTaskIdInput.value = taskId;
  setControlMessage(\`Using task detail \${taskId} as the read-only context packet source.\`);
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
  const rebind = ["stale_session_binding", "stale_work_view_binding"]
    .includes(engineeringContextPacketBinding?.textContent ?? "");
  try {
    const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.openclaw.engineering_context.work_view_bind",
        taskId,
        params: { confirm: true, rebind },
      }),
    });
    if (response.invoked !== true) {
      throw new Error("Trusted work-view bind capability was not invoked.");
    }
    await refreshEngineeringContextPacket();
    setControlMessage(\`\${rebind ? "Rebound" : "Bound"} task \${taskId} to the current trusted work view; task execution was not started.\`);
    return response.result ?? {};
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

engineeringContextPacketUseTaskDetailButton?.addEventListener("click", () => {
  useEngineeringContextTaskDetailAsSource();
});

engineeringContextPacketBindWorkViewButton?.addEventListener("click", () => {
  void bindEngineeringContextTaskToWorkView().catch(() => {});
});

engineeringContextPacketRecoveryButton?.addEventListener("click", () => {
  void prepareEngineeringContextWorkView().catch(() => {});
});

`;
