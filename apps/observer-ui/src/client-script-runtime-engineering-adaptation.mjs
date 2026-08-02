export const observerClientRuntimeEngineeringAdaptationScript = `let engineeringAdaptationCurrentExperiment = null;
let engineeringAdaptationCurrentProfile = null;

function engineeringAdaptationTaskType() {
  const taskType = engineeringAdaptationTaskTypeInput?.value?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(taskType)) {
    throw new Error("Task type is invalid.");
  }
  return taskType;
}

function renderEngineeringAdaptation(data) {
  const experiment = Array.isArray(data.experiments) ? data.experiments[0] ?? null : null;
  const profile = Array.isArray(data.profiles) ? data.profiles[0] ?? null : null;
  engineeringAdaptationCurrentExperiment = experiment;
  engineeringAdaptationCurrentProfile = profile;
  const analysis = experiment?.analysis ?? null;
  const assignments = Array.isArray(experiment?.assignments) ? experiment.assignments : [];

  engineeringAdaptationStatus.textContent = experiment?.status ?? "idle";
  engineeringAdaptationAssignments.textContent = experiment
    ? String(assignments.length) + " / " + String(experiment.trialLimit ?? 0)
    : "0 / 0";
  engineeringAdaptationCandidate.textContent = analysis?.candidateRankingMode ?? "none";
  engineeringAdaptationProfile.textContent = profile?.rankingMode ?? "baseline";
  engineeringAdaptationRearmButton.disabled = experiment?.status !== "paused_after_restart";
  engineeringAdaptationCancelButton.disabled = !["armed", "collecting", "paused_after_restart"].includes(
    experiment?.status,
  );
  engineeringAdaptationActivateButton.disabled = !(
    experiment?.status === "completed"
    && analysis?.evidenceSupportsRankingChange === true
    && typeof analysis?.evidenceHash === "string"
    && experiment?.activatedProfileId !== profile?.id
  );
  engineeringAdaptationRevokeButton.disabled = !profile;
  engineeringAdaptationJson.textContent = JSON.stringify({
    registry: data.registry ?? null,
    experiment,
    profile,
    bounds: data.bounds ?? null,
    governance: data.governance ?? null,
  }, null, 2);
}

async function refreshEngineeringAdaptation() {
  const taskType = engineeringAdaptationTaskType();
  const data = await fetchJson(
    observerConfig.coreUrl + "/plugins/native-adapter/engineering-context/experience-adaptation?taskType=" + encodeURIComponent(taskType),
  );
  if (data.registry !== "nixsoma-controlled-experience-adaptation-v0"
    || data.governance?.pairedRandomAssignment !== true
    || data.governance?.callerSelectsArm !== false
    || data.governance?.changesExecutionPolicy !== false
    || data.governance?.changesAuthority !== false) {
    throw new Error("Controlled experience adaptation readback is invalid.");
  }
  renderEngineeringAdaptation(data);
  return data;
}

async function armEngineeringAdaptation() {
  const trialLimit = Number.parseInt(engineeringAdaptationTrialLimitInput?.value ?? "", 10);
  const durationMinutes = Number.parseInt(engineeringAdaptationDurationInput?.value ?? "", 10);
  engineeringAdaptationArmButton.disabled = true;
  try {
    const response = await fetchJson(
      observerConfig.coreUrl + "/plugins/native-adapter/engineering-context/experience-adaptation/experiments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          taskType: engineeringAdaptationTaskType(),
          trialLimit,
          durationMinutes,
        }),
      },
    );
    if (response.ok !== true
      || response.experiment?.registry !== "nixsoma-experience-ranking-experiment-v0"
      || response.experiment?.status !== "armed"
      || response.experiment?.governance?.callerSelectsArm !== false) {
      throw new Error("Experience comparison arm receipt is invalid.");
    }
    await refreshEngineeringAdaptation();
    setControlMessage("Armed finite experience comparison " + response.experiment.id + ".");
  } finally {
    engineeringAdaptationArmButton.disabled = false;
  }
}

async function changeEngineeringAdaptationExperiment(action) {
  const experiment = engineeringAdaptationCurrentExperiment;
  if (!experiment?.id || !["rearm", "cancel"].includes(action)) {
    throw new Error("No controlled comparison is selected.");
  }
  const response = await fetchJson(
    observerConfig.coreUrl + "/plugins/native-adapter/engineering-context/experience-adaptation/experiments/"
      + encodeURIComponent(experiment.id) + "/" + action,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    },
  );
  if (response.ok !== true || response.experiment?.id !== experiment.id) {
    throw new Error("Experience comparison transition receipt is invalid.");
  }
  await refreshEngineeringAdaptation();
  setControlMessage((action === "rearm" ? "Re-armed" : "Cancelled") + " experience comparison " + experiment.id + ".");
}

async function activateEngineeringAdaptationCandidate() {
  const experiment = engineeringAdaptationCurrentExperiment;
  if (experiment?.status !== "completed"
    || experiment.analysis?.evidenceSupportsRankingChange !== true
    || typeof experiment.analysis?.evidenceHash !== "string") {
    throw new Error("No completed evidence-backed ranking candidate is available.");
  }
  const response = await fetchJson(
    observerConfig.coreUrl + "/plugins/native-adapter/engineering-context/experience-adaptation/profiles/activate",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        experimentId: experiment.id,
        evidenceHash: experiment.analysis.evidenceHash,
      }),
    },
  );
  if (response.ok !== true
    || response.profile?.registry !== "nixsoma-experience-ranking-profile-v0"
    || response.profile?.sourceExperimentId !== experiment.id
    || response.profile?.governance?.recallOrderingOnly !== true
    || response.profile?.governance?.changesExecutionPolicy !== false
    || response.profile?.governance?.changesAuthority !== false) {
    throw new Error("Experience ranking activation receipt is invalid.");
  }
  await refreshEngineeringAdaptation();
  setControlMessage("Activated " + response.profile.rankingMode + " recall ordering for " + response.profile.taskType + ".");
}

async function revokeEngineeringAdaptationProfile() {
  const profile = engineeringAdaptationCurrentProfile;
  if (!profile?.taskType) throw new Error("No experience ranking profile is active.");
  const response = await fetchJson(
    observerConfig.coreUrl + "/plugins/native-adapter/engineering-context/experience-adaptation/profiles/"
      + encodeURIComponent(profile.taskType) + "/revoke",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    },
  );
  if (response.ok !== true || response.profile?.status !== "revoked") {
    throw new Error("Experience ranking revocation receipt is invalid.");
  }
  await refreshEngineeringAdaptation();
  setControlMessage("Revoked experience ranking profile for " + profile.taskType + ".");
}

engineeringAdaptationRefreshButton?.addEventListener("click", () => {
  void refreshEngineeringAdaptation().catch((error) => {
    engineeringAdaptationJson.textContent = "Unable to read experience adaptation: " + formatError(error);
  });
});
engineeringAdaptationArmButton?.addEventListener("click", () => {
  void armEngineeringAdaptation().catch((error) => setControlMessage("Experience comparison was not armed: " + formatError(error) + "."));
});
engineeringAdaptationRearmButton?.addEventListener("click", () => {
  void changeEngineeringAdaptationExperiment("rearm").catch((error) => setControlMessage("Experience comparison was not re-armed: " + formatError(error) + "."));
});
engineeringAdaptationCancelButton?.addEventListener("click", () => {
  void changeEngineeringAdaptationExperiment("cancel").catch((error) => setControlMessage("Experience comparison was not cancelled: " + formatError(error) + "."));
});
engineeringAdaptationActivateButton?.addEventListener("click", () => {
  void activateEngineeringAdaptationCandidate().catch((error) => setControlMessage("Experience ranking was not activated: " + formatError(error) + "."));
});
engineeringAdaptationRevokeButton?.addEventListener("click", () => {
  void revokeEngineeringAdaptationProfile().catch((error) => setControlMessage("Experience ranking was not revoked: " + formatError(error) + "."));
});
`;
