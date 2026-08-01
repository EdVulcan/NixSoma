export const observerClientRuntimeOperatorScheduleScript = `const operatorScheduleDelayInput = document.querySelector("#operator-schedule-delay-input");
const operatorScheduleArmButton = document.querySelector("#operator-schedule-arm-button");
const operatorScheduleRearmButton = document.querySelector("#operator-schedule-rearm-button");
const operatorScheduleCancelButton = document.querySelector("#operator-schedule-cancel-button");
const operatorScheduleRefreshButton = document.querySelector("#operator-schedule-refresh-button");
const operatorScheduleEnabled = document.querySelector("#operator-schedule-enabled");
const operatorScheduleTimer = document.querySelector("#operator-schedule-timer");
const operatorScheduleStatus = document.querySelector("#operator-schedule-status");
const operatorScheduleId = document.querySelector("#operator-schedule-id");
const operatorScheduleDue = document.querySelector("#operator-schedule-due");
const operatorScheduleSteps = document.querySelector("#operator-schedule-steps");
const operatorScheduleJson = document.querySelector("#operator-schedule-json");

function boundedOperatorScheduleDelayMs() {
  const value = operatorScheduleDelayInput.value.trim();
  const minutes = Number(value);
  if (!value || !Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw new Error("Schedule delay must be between 0 and 1440 minutes.");
  }
  return minutes * 60 * 1000;
}

function currentOperatorSchedule(data) {
  const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
  return schedules.find((schedule) => ["armed", "running", "paused"].includes(schedule?.status))
    ?? schedules[0]
    ?? null;
}

function renderOperatorSchedule(data) {
  const scheduler = data?.scheduler ?? {};
  const schedule = currentOperatorSchedule(data);
  const hasActiveSchedule = Boolean(scheduler.active) || ["armed", "running"].includes(schedule?.status);
  operatorScheduleEnabled.textContent = scheduler.enabled === true ? "enabled" : scheduler.enabled === false ? "disabled" : "unknown";
  operatorScheduleTimer.textContent = scheduler.timerActive === true ? "active" : "inactive";
  operatorScheduleStatus.textContent = schedule?.status ?? "none";
  operatorScheduleId.textContent = schedule?.id ?? "none";
  operatorScheduleDue.textContent = schedule?.dueAt ? formatTimestamp(schedule.dueAt) : "none";
  operatorScheduleSteps.textContent = String(schedule?.maxSteps ?? 0);
  operatorScheduleArmButton.disabled = hasActiveSchedule || schedule?.status === "paused";
  operatorScheduleRearmButton.disabled = schedule?.status !== "paused";
  operatorScheduleCancelButton.disabled = schedule?.status !== "armed";
  operatorScheduleRearmButton.dataset.scheduleId = schedule?.status === "paused" ? schedule.id : "";
  operatorScheduleCancelButton.dataset.scheduleId = schedule?.status === "armed" ? schedule.id : "";
  operatorScheduleJson.textContent = JSON.stringify({
    registry: scheduler.registry ?? schedule?.registry ?? "nixsoma-bounded-operator-scheduler-v0",
    scheduler,
    schedule,
  }, null, 2);
}

async function refreshOperatorSchedule() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/operator/schedule\`);
    renderOperatorSchedule(data);
  } catch {
    operatorScheduleEnabled.textContent = "offline";
    operatorScheduleTimer.textContent = "unknown";
    operatorScheduleStatus.textContent = "offline";
    operatorScheduleId.textContent = "unknown";
    operatorScheduleDue.textContent = "unknown";
    operatorScheduleSteps.textContent = "0";
    operatorScheduleArmButton.disabled = true;
    operatorScheduleRearmButton.disabled = true;
    operatorScheduleCancelButton.disabled = true;
    operatorScheduleJson.textContent = "Unable to read operator schedule.";
  }
}

async function scheduleOperatorRunFromUi() {
  const maxSteps = boundedOperatorRunLimit();
  const delayMs = boundedOperatorScheduleDelayMs();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/schedule\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxSteps, delayMs, confirm: true }),
  });
  renderOperatorSchedule(result);
  setControlMessage(\`Scheduled operator queue \${result.schedule?.id ?? "unknown"} for \${maxSteps} step(s).\`);
  await refreshOperatorState();
}

async function cancelOperatorScheduleFromUi() {
  const scheduleId = operatorScheduleCancelButton.dataset.scheduleId ?? "";
  if (!scheduleId) throw new Error("No armed operator schedule is available to cancel.");
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/schedule/\${encodeURIComponent(scheduleId)}/cancel\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  renderOperatorSchedule(result);
  setControlMessage(\`Cancelled operator schedule \${scheduleId}.\`);
  await refreshOperatorState();
}

async function rearmOperatorScheduleFromUi() {
  const scheduleId = operatorScheduleRearmButton.dataset.scheduleId ?? "";
  if (!scheduleId) throw new Error("No paused operator schedule is available to re-arm.");
  const delayMs = boundedOperatorScheduleDelayMs();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/schedule/\${encodeURIComponent(scheduleId)}/rearm\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ delayMs, confirm: true }),
  });
  renderOperatorSchedule(result);
  setControlMessage(\`Re-armed operator schedule \${scheduleId}.\`);
  await refreshOperatorState();
}
`;
