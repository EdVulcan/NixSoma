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

async function refreshEngineeringExperienceEffectiveness() {
  if (!engineeringExperienceEffectivenessRefreshButton) return;
  engineeringExperienceEffectivenessRefreshButton.disabled = true;
  try {
    const response = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-context/experience-effectiveness\`);
    engineeringExperienceEffectivenessGroups.textContent = String(response.summary?.groupCount ?? 0);
    engineeringExperienceEffectivenessRecords.textContent = String(response.summary?.terminalRecords ?? 0);
    engineeringExperienceEffectivenessRate.textContent = response.summary?.completionRate == null
      ? "none"
      : String(response.summary.completionRate);
    if (engineeringExperienceFeedbackStatus) {
      engineeringExperienceFeedbackStatus.textContent = \`\${response.summary?.operatorFeedbackRecorded ?? 0} recorded\`;
    }
    engineeringExperienceEffectivenessPolicy.textContent = String(
      response.governance?.policyInfluence ?? response.summary?.policyInfluence ?? false,
    );
    engineeringExperienceEffectivenessJson.textContent = JSON.stringify({
      registry: response.registry ?? null,
      mode: response.mode ?? null,
      groups: response.groups ?? [],
      deferred: response.deferred ?? [],
      governance: response.governance ?? null,
    }, null, 2);
    setControlMessage("Read bounded experience effectiveness; no execution policy was changed.");
  } catch (error) {
    engineeringExperienceEffectivenessJson.textContent = \`Unable to read experience effectiveness: \${formatError(error)}\`;
    setControlMessage("Experience effectiveness was unavailable.");
  } finally {
    engineeringExperienceEffectivenessRefreshButton.disabled = false;
  }
}

async function recordEngineeringExperienceFeedback() {
  if (!engineeringExperienceFeedbackButton) return;
  const taskId = typeof taskDetailIdInput?.value === "string" && taskDetailIdInput.value.trim()
    ? taskDetailIdInput.value.trim()
    : null;
  const rating = engineeringExperienceFeedbackRating?.value ?? "";
  if (!taskId) {
    throw new Error("Select a terminal recommendation task before recording feedback.");
  }
  if (!["helpful", "not_helpful", "uncertain"].includes(rating)) {
    throw new Error("Recommendation feedback rating is not supported.");
  }

  engineeringExperienceFeedbackButton.disabled = true;
  try {
    const response = await fetchJson(
      \`\${observerConfig.coreUrl}/tasks/\${encodeURIComponent(taskId)}/recommendation-feedback\`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, rating }),
      },
    );
    if (response.ok !== true
      || response.feedback?.registry !== "openclaw-native-engineering-recommendation-feedback-v0"
      || response.feedback?.taskId !== taskId
      || response.feedback?.rating !== rating
      || response.feedback?.governance?.causalAttribution !== false
      || response.feedback?.governance?.changesRanking !== false
      || response.feedback?.governance?.changesPolicy !== false) {
      throw new Error("Recommendation feedback receipt was invalid.");
    }
    if (engineeringExperienceFeedbackStatus) {
      engineeringExperienceFeedbackStatus.textContent = \`\${response.status ?? "recorded"}/\${rating}\`;
    }
    await Promise.all([
      refreshTaskHistoryDetail(),
      refreshEngineeringExperienceEffectiveness(),
    ]);
    setControlMessage(\`Recorded \${rating} feedback for task \${taskId}; execution policy was unchanged.\`);
  } finally {
    engineeringExperienceFeedbackButton.disabled = false;
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

if (typeof engineeringExperienceEffectivenessRefreshButton !== "undefined"
  && engineeringExperienceEffectivenessRefreshButton) {
  engineeringExperienceEffectivenessRefreshButton.addEventListener("click", () => {
    void refreshEngineeringExperienceEffectiveness();
  });
}

if (typeof engineeringExperienceFeedbackButton !== "undefined"
  && engineeringExperienceFeedbackButton) {
  engineeringExperienceFeedbackButton.addEventListener("click", () => {
    void recordEngineeringExperienceFeedback().catch((error) => {
      setControlMessage(\`Recommendation feedback was not recorded: \${formatError(error)}.\`);
    });
  });
}

`;
