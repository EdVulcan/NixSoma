export const observerClientRuntimeOperatorMissionWorklistScript = `const operatorMissionWorklistAddButton = document.querySelector("#operator-mission-worklist-add-button");
const operatorMissionWorklistClearButton = document.querySelector("#operator-mission-worklist-clear-button");
const operatorMissionWorklistBindButton = document.querySelector("#operator-mission-worklist-bind-button");
const operatorMissionWorklistDraft = document.querySelector("#operator-mission-worklist-draft");
const operatorMissionWorklistProgressBar = document.querySelector("#operator-mission-worklist-progress-bar");
const operatorMissionWorklistStatus = document.querySelector("#operator-mission-worklist-status");
const operatorMissionWorklistId = document.querySelector("#operator-mission-worklist-id");
const operatorMissionWorklistMission = document.querySelector("#operator-mission-worklist-mission");
const operatorMissionWorklistItems = document.querySelector("#operator-mission-worklist-items");
const operatorMissionWorklistIssued = document.querySelector("#operator-mission-worklist-issued");
const operatorMissionWorklistCompleted = document.querySelector("#operator-mission-worklist-completed");
const operatorMissionWorklistCurrentTask = document.querySelector("#operator-mission-worklist-current-task");
const operatorMissionWorklistNext = document.querySelector("#operator-mission-worklist-next");
const operatorMissionWorklistStopReason = document.querySelector("#operator-mission-worklist-stop-reason");
const operatorMissionWorklistJson = document.querySelector("#operator-mission-worklist-json");
const operatorMissionWorklistDraftItems = [];

function currentOperatorMissionWorklist(data, mission) {
  const worklists = Array.isArray(data?.worklists) ? data.worklists : [];
  return mission?.id ? worklists.find((worklist) => worklist?.missionId === mission.id) ?? null : null;
}

function renderOperatorMissionWorklistDraft() {
  const remainingEpochs = Number.parseInt(operatorMissionWorklistBindButton.dataset.remainingEpochs ?? "", 10);
  const missionEligible = operatorMissionWorklistBindButton.dataset.bindEligible === "true";
  const draftFitsAuthority = Number.isInteger(remainingEpochs)
    && operatorMissionWorklistDraftItems.length <= remainingEpochs;
  operatorMissionWorklistDraft.replaceChildren();
  if (operatorMissionWorklistDraftItems.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No reviewed items.";
    operatorMissionWorklistDraft.append(empty);
  } else {
    operatorMissionWorklistDraftItems.forEach((item, index) => {
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = String(index + 1) + ". " + item.goal + " | " + item.targetUrl;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary mission-worklist-remove";
      remove.dataset.worklistDraftIndex = String(index);
      remove.textContent = "Remove";
      row.append(label, remove);
      operatorMissionWorklistDraft.append(row);
    });
  }
  operatorMissionWorklistClearButton.disabled = operatorMissionWorklistDraftItems.length === 0;
  operatorMissionWorklistAddButton.disabled = operatorMissionWorklistDraftItems.length >= 16
    || operatorMissionWorklistBindButton.dataset.worklistBound === "true"
    || (missionEligible && Number.isInteger(remainingEpochs)
      && operatorMissionWorklistDraftItems.length >= remainingEpochs);
  operatorMissionWorklistBindButton.disabled = !missionEligible
    || operatorMissionWorklistDraftItems.length === 0
    || !draftFitsAuthority;
}

function renderOperatorMissionWorklist(data, mission) {
  const worklist = data?.worklist ?? currentOperatorMissionWorklist(data, mission);
  const progress = Number.isInteger(worklist?.progressPercent) ? worklist.progressPercent : 0;
  const bindEligible = Boolean(mission)
    && ["armed", "paused"].includes(mission.status)
    && mission.epochsConsumed === 0
    && !mission.childLeaseId
    && !worklist;
  operatorMissionWorklistStatus.textContent = worklist?.status ?? "none";
  operatorMissionWorklistId.textContent = worklist?.id ?? "none";
  operatorMissionWorklistMission.textContent = worklist?.missionId ?? mission?.id ?? "none";
  operatorMissionWorklistItems.textContent = String(worklist?.itemCount ?? 0);
  operatorMissionWorklistIssued.textContent = String(worklist?.issuedCount ?? 0);
  operatorMissionWorklistCompleted.textContent = String(worklist?.completedCount ?? 0);
  operatorMissionWorklistCurrentTask.textContent = worklist?.currentTaskId ?? "none";
  operatorMissionWorklistNext.textContent = worklist?.nextItemOrdinal ? String(worklist.nextItemOrdinal) : "none";
  operatorMissionWorklistStopReason.textContent = worklist?.blockedReason ?? "none";
  operatorMissionWorklistProgressBar.value = Math.max(0, Math.min(100, progress));
  operatorMissionWorklistBindButton.dataset.missionId = mission?.id ?? "";
  operatorMissionWorklistBindButton.dataset.bindEligible = bindEligible ? "true" : "false";
  operatorMissionWorklistBindButton.dataset.worklistBound = worklist ? "true" : "false";
  operatorMissionWorklistBindButton.dataset.remainingEpochs = Number.isInteger(mission?.remainingEpochs)
    ? String(mission.remainingEpochs)
    : "";
  operatorMissionWorklistJson.textContent = JSON.stringify(worklist ?? {
    registry: "nixsoma-reviewed-finite-mission-worklist-v0",
    missionId: mission?.id ?? null,
    status: "not_bound",
    draftItemCount: operatorMissionWorklistDraftItems.length,
  }, null, 2);
  renderOperatorMissionWorklistDraft();
}

function renderOperatorMissionWorklistOffline() {
  operatorMissionWorklistStatus.textContent = "offline";
  operatorMissionWorklistId.textContent = "unknown";
  operatorMissionWorklistMission.textContent = "unknown";
  operatorMissionWorklistItems.textContent = "0";
  operatorMissionWorklistIssued.textContent = "0";
  operatorMissionWorklistCompleted.textContent = "0";
  operatorMissionWorklistCurrentTask.textContent = "unknown";
  operatorMissionWorklistNext.textContent = "unknown";
  operatorMissionWorklistStopReason.textContent = "unknown";
  operatorMissionWorklistProgressBar.value = 0;
  operatorMissionWorklistBindButton.dataset.bindEligible = "false";
  operatorMissionWorklistBindButton.disabled = true;
  operatorMissionWorklistJson.textContent = "Unable to read reviewed mission worklist.";
}

function addOperatorMissionWorklistDraftItem() {
  if (operatorMissionWorklistDraftItems.length >= 16) {
    throw new Error("Reviewed mission worklist accepts at most 16 items.");
  }
  const remainingEpochs = Number.parseInt(operatorMissionWorklistBindButton.dataset.remainingEpochs ?? "", 10);
  if (operatorMissionWorklistBindButton.dataset.bindEligible === "true"
    && Number.isInteger(remainingEpochs)
    && operatorMissionWorklistDraftItems.length >= remainingEpochs) {
    throw new Error("Reviewed mission worklist must fit the mission's remaining epoch authority.");
  }
  const item = {
    goal: reviewedBrowserTaskGoal(),
    targetUrl: getDesiredWorkViewUrl(),
  };
  if (operatorMissionWorklistDraftItems.some((candidate) => (
    candidate.goal === item.goal && candidate.targetUrl === item.targetUrl
  ))) {
    throw new Error("This reviewed mission worklist item is already in the draft.");
  }
  operatorMissionWorklistDraftItems.push(item);
  renderOperatorMissionWorklistDraft();
  setControlMessage("Added reviewed worklist item " + String(operatorMissionWorklistDraftItems.length) + ".");
}

function clearOperatorMissionWorklistDraft() {
  operatorMissionWorklistDraftItems.splice(0, operatorMissionWorklistDraftItems.length);
  renderOperatorMissionWorklistDraft();
  setControlMessage("Cleared the reviewed mission worklist draft.");
}

function removeOperatorMissionWorklistDraftItem(index) {
  if (!Number.isInteger(index) || index < 0 || index >= operatorMissionWorklistDraftItems.length) return;
  operatorMissionWorklistDraftItems.splice(index, 1);
  renderOperatorMissionWorklistDraft();
}

async function bindOperatorMissionWorklistFromUi() {
  const missionId = operatorMissionWorklistBindButton.dataset.missionId ?? "";
  if (!missionId || operatorMissionWorklistBindButton.dataset.bindEligible !== "true") {
    throw new Error("An unstarted renewable mission is required before binding its worklist.");
  }
  if (operatorMissionWorklistDraftItems.length === 0) {
    throw new Error("Add at least one reviewed worklist item before binding.");
  }
  const remainingEpochs = Number.parseInt(operatorMissionWorklistBindButton.dataset.remainingEpochs ?? "", 10);
  if (!Number.isInteger(remainingEpochs)
    || operatorMissionWorklistDraftItems.length > remainingEpochs) {
    throw new Error("Reviewed mission worklist must fit the mission's remaining epoch authority.");
  }
  const result = await fetchJson(observerConfig.coreUrl + "/operator/mission/" + encodeURIComponent(missionId) + "/worklist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: operatorMissionWorklistDraftItems.map((item) => ({ ...item })),
      confirm: true,
    }),
  });
  operatorMissionWorklistDraftItems.splice(0, operatorMissionWorklistDraftItems.length);
  renderOperatorMission(result);
  setControlMessage("Bound reviewed worklist " + (result.worklist?.id ?? "unknown") + " to mission " + missionId + ".");
  await refreshTaskList();
  await refreshOperatorState();
}

renderOperatorMissionWorklistDraft();
`;
