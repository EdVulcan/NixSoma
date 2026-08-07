export const observerClientRuntimeOperatorMissionScript = `const operatorMissionEpochInput = document.querySelector("#operator-mission-epoch-input");
const operatorMissionStepsInput = document.querySelector("#operator-mission-steps-input");
const operatorMissionIntervalInput = document.querySelector("#operator-mission-interval-input");
const operatorMissionAuthorityInput = document.querySelector("#operator-mission-authority-input");
const operatorMissionCircuitInput = document.querySelector("#operator-mission-circuit-input");
const operatorMissionResidentContinuationInput = document.querySelector("#operator-mission-resident-continuation-input");
const operatorMissionArmButton = document.querySelector("#operator-mission-arm-button");
const operatorMissionRenewButton = document.querySelector("#operator-mission-renew-button");
const operatorMissionPauseButton = document.querySelector("#operator-mission-pause-button");
const operatorMissionRearmButton = document.querySelector("#operator-mission-rearm-button");
const operatorMissionCancelButton = document.querySelector("#operator-mission-cancel-button");
const operatorMissionRefreshButton = document.querySelector("#operator-mission-refresh-button");
const operatorMissionProgressBar = document.querySelector("#operator-mission-progress-bar");
const operatorMissionEnabled = document.querySelector("#operator-mission-enabled");
const operatorMissionTimer = document.querySelector("#operator-mission-timer");
const operatorMissionStatus = document.querySelector("#operator-mission-status");
const operatorMissionId = document.querySelector("#operator-mission-id");
const operatorMissionProgress = document.querySelector("#operator-mission-progress");
const operatorMissionCompleted = document.querySelector("#operator-mission-completed");
const operatorMissionCheckpoint = document.querySelector("#operator-mission-checkpoint");
const operatorMissionNext = document.querySelector("#operator-mission-next");
const operatorMissionDeadline = document.querySelector("#operator-mission-deadline");
const operatorMissionCircuit = document.querySelector("#operator-mission-circuit");
const operatorMissionRenewals = document.querySelector("#operator-mission-renewals");
const operatorMissionStopReason = document.querySelector("#operator-mission-stop-reason");
const operatorMissionJson = document.querySelector("#operator-mission-json");

function boundedMissionInteger(input, minimum, maximum, label) {
  const value = input.value.trim();
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(label + " must be between " + minimum + " and " + maximum + ".");
  }
  return parsed;
}

function missionEpochCount() {
  return boundedMissionInteger(operatorMissionEpochInput, 1, 32, "Mission epochs");
}

function missionStepsPerEpoch() {
  return boundedMissionInteger(operatorMissionStepsInput, 1, 20, "Mission steps per epoch");
}

function missionIntervalMs() {
  return boundedMissionInteger(operatorMissionIntervalInput, 0, 86400, "Mission interval") * 1000;
}

function missionAuthorityMs() {
  return boundedMissionInteger(operatorMissionAuthorityInput, 1, 168, "Mission authority") * 60 * 60 * 1000;
}

function missionNoProgressLimit() {
  return boundedMissionInteger(operatorMissionCircuitInput, 1, 5, "Mission no-progress circuit");
}

function currentOperatorMission(data) {
  const missions = Array.isArray(data?.missions) ? data.missions : [];
  return missions.find((mission) => ["armed", "running", "pausing", "paused", "cancelling"].includes(mission?.status))
    ?? missions[0]
    ?? null;
}

function renderOperatorMission(data) {
  const supervisor = data?.supervisor ?? {};
  const mission = data?.mission ?? currentOperatorMission(data);
  const status = mission?.status ?? "none";
  const active = Boolean(supervisor.active) || ["armed", "running", "pausing", "cancelling"].includes(status);
  const circuitReset = status === "blocked" && mission?.stopReason === "no_progress_circuit_open";
  const progress = Number.isInteger(mission?.progressPercent) ? mission.progressPercent : 0;
  const checkpoint = mission?.lastCheckpoint;
  const checkpointText = checkpoint
    ? "epoch " + String(checkpoint.epoch ?? 0) + " / " + String(checkpoint.status ?? "unknown") + " / " + String(checkpoint.stepCount ?? 0) + " steps"
    : "none";
  operatorMissionEnabled.textContent = supervisor.enabled === true ? "enabled" : supervisor.enabled === false ? "disabled" : "unknown";
  operatorMissionTimer.textContent = supervisor.timerActive === true ? "active" : "inactive";
  operatorMissionStatus.textContent = status;
  operatorMissionId.textContent = mission?.id ?? "none";
  operatorMissionProgress.textContent = mission
    ? String(mission.epochsConsumed ?? 0) + " / " + String(mission.epochsAuthorized ?? 0) + " (" + progress + "%)"
    : "0 / 0 (0%)";
  operatorMissionProgressBar.value = Math.max(0, Math.min(100, progress));
  operatorMissionCompleted.textContent = String(mission?.epochsCompleted ?? 0);
  operatorMissionCheckpoint.textContent = checkpointText;
  operatorMissionNext.textContent = mission?.nextEpochAt ? formatTimestamp(mission.nextEpochAt) : "none";
  operatorMissionDeadline.textContent = mission?.deadlineAt ? formatTimestamp(mission.deadlineAt) : "none";
  operatorMissionCircuit.textContent = mission
    ? String(mission.noProgressStreak ?? 0) + " / " + String(mission.maxNoProgressEpochs ?? 0)
    : "0 / 0";
  operatorMissionRenewals.textContent = String(mission?.renewalCount ?? 0);
  operatorMissionStopReason.textContent = mission?.stopReason ?? "none";
  if (operatorMissionResidentContinuationInput) {
    operatorMissionResidentContinuationInput.checked = mission?.residentContinuation === true;
    operatorMissionResidentContinuationInput.disabled = active || status === "paused";
  }
  operatorMissionArmButton.disabled = active || status === "paused";
  operatorMissionRenewButton.disabled = !mission || ["cancelled", "cancelling"].includes(status);
  operatorMissionPauseButton.disabled = !["armed", "running"].includes(status);
  operatorMissionRearmButton.disabled = status !== "paused" && !circuitReset;
  operatorMissionCancelButton.disabled = !mission || ["completed", "cancelled", "expired"].includes(status);
  operatorMissionRenewButton.dataset.missionId = mission?.id ?? "";
  operatorMissionPauseButton.dataset.missionId = mission?.id ?? "";
  operatorMissionRearmButton.dataset.missionId = mission?.id ?? "";
  operatorMissionRearmButton.dataset.resetCircuit = circuitReset ? "true" : "false";
  operatorMissionCancelButton.dataset.missionId = mission?.id ?? "";
  operatorMissionJson.textContent = JSON.stringify({
    registry: supervisor.registry ?? mission?.registry ?? "nixsoma-renewable-operator-mission-v0",
    supervisor,
    mission,
  }, null, 2);
  renderOperatorMissionWorklist(data, mission);
}

function renderOperatorMissionOffline() {
  operatorMissionEnabled.textContent = "offline";
  operatorMissionTimer.textContent = "unknown";
  operatorMissionStatus.textContent = "offline";
  operatorMissionId.textContent = "unknown";
  operatorMissionProgress.textContent = "0 / 0 (0%)";
  operatorMissionProgressBar.value = 0;
  operatorMissionCompleted.textContent = "0";
  operatorMissionCheckpoint.textContent = "unknown";
  operatorMissionNext.textContent = "unknown";
  operatorMissionDeadline.textContent = "unknown";
  operatorMissionCircuit.textContent = "0 / 0";
  operatorMissionRenewals.textContent = "0";
  operatorMissionStopReason.textContent = "unknown";
  for (const button of [operatorMissionArmButton, operatorMissionRenewButton, operatorMissionPauseButton, operatorMissionRearmButton, operatorMissionCancelButton]) {
    button.disabled = true;
  }
  if (operatorMissionResidentContinuationInput) {
    operatorMissionResidentContinuationInput.checked = false;
    operatorMissionResidentContinuationInput.disabled = true;
  }
  operatorMissionJson.textContent = "Unable to read renewable operator mission.";
  renderOperatorMissionWorklistOffline();
}

async function refreshOperatorMission() {
  try {
    renderOperatorMission(await fetchJson(observerConfig.coreUrl + "/operator/mission"));
  } catch {
    renderOperatorMissionOffline();
  }
}

async function armOperatorMissionFromUi() {
  const epochCount = missionEpochCount();
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      epochCount,
      maxStepsPerEpoch: missionStepsPerEpoch(),
      epochIntervalMs: missionIntervalMs(),
      deadlineMs: missionAuthorityMs(),
      maxNoProgressEpochs: missionNoProgressLimit(),
      residentContinuation: operatorMissionResidentContinuationInput?.checked === true,
      confirm: true,
    }),
  });
  renderOperatorMission(result);
  setControlMessage("Armed renewable mission " + (result.mission?.id ?? "unknown") + " for " + epochCount + " epoch(s).");
  await refreshOperatorState();
}

function missionActionId(button) {
  const missionId = button.dataset.missionId ?? "";
  if (!missionId) throw new Error("No renewable operator mission is available for this action.");
  return missionId;
}

async function renewOperatorMissionFromUi() {
  const missionId = missionActionId(operatorMissionRenewButton);
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission/" + encodeURIComponent(missionId) + "/renew", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ additionalEpochs: missionEpochCount(), extensionMs: missionAuthorityMs(), confirm: true }),
  });
  renderOperatorMission(result);
  setControlMessage("Renewed mission authority " + missionId + ".");
}

async function pauseOperatorMissionFromUi() {
  const missionId = missionActionId(operatorMissionPauseButton);
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission/" + encodeURIComponent(missionId) + "/pause", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  renderOperatorMission(result);
  setControlMessage("Paused renewable mission " + missionId + ".");
}

async function rearmOperatorMissionFromUi() {
  const missionId = missionActionId(operatorMissionRearmButton);
  const resetCircuit = operatorMissionRearmButton.dataset.resetCircuit === "true";
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission/" + encodeURIComponent(missionId) + "/rearm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resetCircuit, confirm: true }),
  });
  renderOperatorMission(result);
  setControlMessage("Resumed renewable mission " + missionId + ".");
}

async function cancelOperatorMissionFromUi() {
  const missionId = missionActionId(operatorMissionCancelButton);
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission/" + encodeURIComponent(missionId) + "/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  renderOperatorMission(result);
  setControlMessage("Cancelled renewable mission " + missionId + ".");
}
`;
