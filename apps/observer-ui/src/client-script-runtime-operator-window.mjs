export const observerClientRuntimeOperatorWindowScript = `const operatorWindowCountInput = document.querySelector("#operator-window-count-input");
const operatorWindowStepsInput = document.querySelector("#operator-window-steps-input");
const operatorWindowIntervalInput = document.querySelector("#operator-window-interval-input");
const operatorWindowDeadlineInput = document.querySelector("#operator-window-deadline-input");
const operatorWindowArmButton = document.querySelector("#operator-window-arm-button");
const operatorWindowRearmButton = document.querySelector("#operator-window-rearm-button");
const operatorWindowCancelButton = document.querySelector("#operator-window-cancel-button");
const operatorWindowRefreshButton = document.querySelector("#operator-window-refresh-button");
const operatorWindowEnabled = document.querySelector("#operator-window-enabled");
const operatorWindowTimer = document.querySelector("#operator-window-timer");
const operatorWindowStatus = document.querySelector("#operator-window-status");
const operatorWindowId = document.querySelector("#operator-window-id");
const operatorWindowProgress = document.querySelector("#operator-window-progress");
const operatorWindowNext = document.querySelector("#operator-window-next");
const operatorWindowDeadline = document.querySelector("#operator-window-deadline");
const operatorWindowJson = document.querySelector("#operator-window-json");

function boundedOperatorWindowCount() {
  const value = operatorWindowCountInput.value.trim();
  const windows = Number(value);
  if (!value || !Number.isInteger(windows) || windows < 1 || windows > 8) {
    throw new Error("Window count must be between 1 and 8.");
  }
  return windows;
}

function boundedOperatorWindowSteps() {
  const value = operatorWindowStepsInput.value.trim();
  const steps = Number(value);
  if (!value || !Number.isInteger(steps) || steps < 1 || steps > 20) {
    throw new Error("Steps per window must be between 1 and 20.");
  }
  return steps;
}

function boundedOperatorWindowIntervalMs() {
  const value = operatorWindowIntervalInput.value.trim();
  const seconds = Number(value);
  if (!value || !Number.isInteger(seconds) || seconds < 0 || seconds > 86400) {
    throw new Error("Window interval must be between 0 and 86400 seconds.");
  }
  return seconds * 1000;
}

function boundedOperatorWindowDeadlineMs() {
  const value = operatorWindowDeadlineInput.value.trim();
  const minutes = Number(value);
  if (!value || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("Window deadline must be between 1 and 1440 minutes.");
  }
  return minutes * 60 * 1000;
}

function currentOperatorWindow(data) {
  const leases = Array.isArray(data?.leases) ? data.leases : [];
  return leases.find((lease) => ["armed", "running", "paused"].includes(lease?.status))
    ?? leases[0]
    ?? null;
}

function renderOperatorWindow(data) {
  const leaseManager = data?.leaseManager ?? {};
  const lease = currentOperatorWindow(data);
  const hasActiveLease = Boolean(leaseManager.active) || ["armed", "running"].includes(lease?.status);
  operatorWindowEnabled.textContent = leaseManager.enabled === true ? "enabled" : leaseManager.enabled === false ? "disabled" : "unknown";
  operatorWindowTimer.textContent = leaseManager.timerActive === true ? "active" : "inactive";
  operatorWindowStatus.textContent = lease?.status ?? "none";
  operatorWindowId.textContent = lease?.id ?? "none";
  operatorWindowProgress.textContent = lease
    ? String(lease.windowsCompleted ?? 0) + " / " + String(lease.windowCount ?? 0)
    : "0 / 0";
  operatorWindowNext.textContent = lease?.nextWindowAt ? formatTimestamp(lease.nextWindowAt) : "none";
  operatorWindowDeadline.textContent = lease?.deadlineAt ? formatTimestamp(lease.deadlineAt) : "none";
  operatorWindowArmButton.disabled = hasActiveLease || lease?.status === "paused";
  operatorWindowRearmButton.disabled = lease?.status !== "paused";
  operatorWindowCancelButton.disabled = lease?.status !== "armed";
  operatorWindowRearmButton.dataset.leaseId = lease?.status === "paused" ? lease.id : "";
  operatorWindowCancelButton.dataset.leaseId = lease?.status === "armed" ? lease.id : "";
  operatorWindowJson.textContent = JSON.stringify({
    registry: leaseManager.registry ?? lease?.registry ?? "nixsoma-bounded-operator-window-lease-v0",
    leaseManager,
    lease,
  }, null, 2);
}

async function refreshOperatorWindow() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/operator/window");
    renderOperatorWindow(data);
  } catch {
    operatorWindowEnabled.textContent = "offline";
    operatorWindowTimer.textContent = "unknown";
    operatorWindowStatus.textContent = "offline";
    operatorWindowId.textContent = "unknown";
    operatorWindowProgress.textContent = "0 / 0";
    operatorWindowNext.textContent = "unknown";
    operatorWindowDeadline.textContent = "unknown";
    operatorWindowArmButton.disabled = true;
    operatorWindowRearmButton.disabled = true;
    operatorWindowCancelButton.disabled = true;
    operatorWindowJson.textContent = "Unable to read operator window lease.";
  }
}

async function armOperatorWindowFromUi() {
  const windowCount = boundedOperatorWindowCount();
  const maxStepsPerWindow = boundedOperatorWindowSteps();
  const intervalMs = boundedOperatorWindowIntervalMs();
  const deadlineMs = boundedOperatorWindowDeadlineMs();
  const result = await fetchJson(observerConfig.coreUrl + "/operator/window", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ windowCount, maxStepsPerWindow, intervalMs, deadlineMs, confirm: true }),
  });
  renderOperatorWindow(result);
  setControlMessage("Armed operator window lease " + (result.lease?.id ?? "unknown") + " for " + windowCount + " window(s).");
  await refreshOperatorState();
}

async function rearmOperatorWindowFromUi() {
  const leaseId = operatorWindowRearmButton.dataset.leaseId ?? "";
  if (!leaseId) throw new Error("No paused operator window lease is available to re-arm.");
  const result = await fetchJson(observerConfig.coreUrl + "/operator/window/" + encodeURIComponent(leaseId) + "/rearm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  renderOperatorWindow(result);
  setControlMessage("Re-armed operator window lease " + leaseId + ".");
  await refreshOperatorState();
}

async function cancelOperatorWindowFromUi() {
  const leaseId = operatorWindowCancelButton.dataset.leaseId ?? "";
  if (!leaseId) throw new Error("No armed operator window lease is available to cancel.");
  const result = await fetchJson(observerConfig.coreUrl + "/operator/window/" + encodeURIComponent(leaseId) + "/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  renderOperatorWindow(result);
  setControlMessage("Cancelled operator window lease " + leaseId + ".");
  await refreshOperatorState();
}
`;
