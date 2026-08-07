import { randomUUID } from "node:crypto";

export const RENEWABLE_OPERATOR_MISSION_REGISTRY =
  "nixsoma-renewable-operator-mission-v0";

const MAX_MISSIONS = 8;
const MAX_INITIAL_EPOCHS = 32;
const MAX_RENEWAL_EPOCHS = 32;
const MAX_TOTAL_EPOCHS = 256;
const MAX_STEPS_PER_EPOCH = 20;
const MAX_EPOCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_AUTHORITY_MS = 1000;
const MAX_AUTHORITY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RENEWED_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NO_PROGRESS_EPOCHS = 5;
const ACTIVE_STATUSES = new Set(["armed", "running", "pausing", "cancelling"]);
const VALID_STATUSES = new Set([
  "armed",
  "running",
  "pausing",
  "paused",
  "cancelling",
  "blocked",
  "completed",
  "cancelled",
  "expired",
]);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function boundedPositiveInteger(value, maximum) {
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : null;
}

function boundedNonNegativeInteger(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : null;
}

function validTimestamp(value, fallback) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function addMilliseconds(timestamp, milliseconds) {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

function governance() {
  return {
    explicitOperatorArm: true,
    finiteEpochAuthority: true,
    renewableAuthority: true,
    maximumInitialEpochs: MAX_INITIAL_EPOCHS,
    maximumRenewalEpochs: MAX_RENEWAL_EPOCHS,
    maximumTotalEpochs: MAX_TOTAL_EPOCHS,
    maximumStepsPerEpoch: MAX_STEPS_PER_EPOCH,
    maximumAuthorityMs: MAX_AUTHORITY_MS,
    maximumRenewedHorizonMs: MAX_RENEWED_HORIZON_MS,
    oneBoundedWindowPerEpoch: true,
    checkpointBeforeExecution: true,
    explicitResumeAfterRestart: true,
    noProgressCircuitBreaker: true,
    automaticTaskCreation: false,
    reviewedWorklistTaskIssuance: true,
    openEndedTaskCreation: false,
    automaticPlanning: false,
    automaticRetry: false,
    providerAuthority: false,
    mutatesHost: false,
  };
}

function compactCheckpoint(value) {
  if (!value || typeof value !== "object") return null;
  return {
    epoch: boundedPositiveInteger(value.epoch, MAX_TOTAL_EPOCHS),
    status: typeof value.status === "string" ? value.status.slice(0, 40) : "unknown",
    stepCount: boundedNonNegativeInteger(value.stepCount, MAX_STEPS_PER_EPOCH) ?? 0,
    runSessionId: safeId(value.runSessionId),
    leaseId: safeId(value.leaseId),
    at: validTimestamp(value.at, null),
  };
}

function normaliseStoredMission(raw, now) {
  const id = safeId(raw?.id);
  if (!id) return null;
  const timestamp = now();
  const updatedAt = validTimestamp(raw.updatedAt, timestamp);
  const epochsAuthorized = boundedPositiveInteger(raw.epochsAuthorized, MAX_TOTAL_EPOCHS) ?? 1;
  const epochsConsumed = Math.max(
    0,
    Math.min(epochsAuthorized, Number.isInteger(raw.epochsConsumed) ? raw.epochsConsumed : 0),
  );
  const epochsCompleted = Math.max(
    0,
    Math.min(epochsConsumed, Number.isInteger(raw.epochsCompleted) ? raw.epochsCompleted : 0),
  );
  const maxStepsPerEpoch = boundedPositiveInteger(raw.maxStepsPerEpoch, MAX_STEPS_PER_EPOCH) ?? 1;
  const epochIntervalMs = boundedNonNegativeInteger(raw.epochIntervalMs, MAX_EPOCH_INTERVAL_MS) ?? 0;
  const maxNoProgressEpochs = boundedPositiveInteger(raw.maxNoProgressEpochs, MAX_NO_PROGRESS_EPOCHS) ?? 1;
  const noProgressStreak = Math.max(
    0,
    Math.min(maxNoProgressEpochs, Number.isInteger(raw.noProgressStreak) ? raw.noProgressStreak : 0),
  );
  const fallbackDeadline = addMilliseconds(updatedAt, MIN_AUTHORITY_MS);
  const status = VALID_STATUSES.has(raw.status) ? raw.status : "blocked";
  return {
    registry: RENEWABLE_OPERATOR_MISSION_REGISTRY,
    id,
    status,
    epochsAuthorized,
    epochsConsumed,
    epochsCompleted,
    remainingEpochs: Math.max(0, epochsAuthorized - epochsConsumed),
    maxStepsPerEpoch,
    epochIntervalMs,
    maxNoProgressEpochs,
    noProgressStreak,
    deadlineAt: validTimestamp(raw.deadlineAt, fallbackDeadline),
    nextEpochAt: validTimestamp(raw.nextEpochAt, updatedAt),
    childLeaseId: safeId(raw.childLeaseId),
    lastLeaseId: safeId(raw.lastLeaseId),
    renewalCount: Math.max(0, Math.min(1000, Number.isInteger(raw.renewalCount) ? raw.renewalCount : 0)),
    createdAt: validTimestamp(raw.createdAt, updatedAt),
    startedAt: validTimestamp(raw.startedAt, null),
    pausedAt: validTimestamp(raw.pausedAt, null),
    renewedAt: validTimestamp(raw.renewedAt, null),
    endedAt: validTimestamp(raw.endedAt, null),
    updatedAt,
    stopReason: typeof raw.stopReason === "string" ? raw.stopReason.slice(0, 120) : null,
    lastCheckpoint: compactCheckpoint(raw.lastCheckpoint),
  };
}

function publicMission(mission) {
  if (!mission) return null;
  const normalised = normaliseStoredMission(mission, () => mission.updatedAt);
  const progressPercent = normalised.epochsAuthorized > 0
    ? Math.floor((normalised.epochsConsumed / normalised.epochsAuthorized) * 100)
    : 0;
  return {
    ...normalised,
    progressPercent,
    governance: governance(),
  };
}

export function createRenewableOperatorMissionSupervisor({
  records = new Map(),
  persistState = () => {},
  windowLease,
  now = () => new Date().toISOString(),
  setTimer = setInterval,
  clearTimer = clearInterval,
  intervalMs = 30_000,
  enabled = false,
  missionWorklist = null,
} = {}) {
  if (!(records instanceof Map)) throw new Error("Renewable operator mission supervisor requires a Map.");
  if (!windowLease || typeof windowLease.armForMission !== "function" || typeof windowLease.tick !== "function") {
    throw new Error("Renewable operator mission supervisor requires the bounded window lease owner.");
  }
  if (missionWorklist && (typeof missionWorklist.prepareEpoch !== "function"
    || typeof missionWorklist.refreshForMission !== "function")) {
    throw new Error("Renewable operator mission supervisor received an invalid reviewed worklist owner.");
  }
  let timer = null;

  function persist() {
    if (typeof persistState.flush === "function") persistState.flush();
    else persistState();
  }

  function touch(mission) {
    mission.updatedAt = now();
  }

  function get(missionId) {
    const id = safeId(missionId);
    const raw = id ? records.get(id) : null;
    return raw ? normaliseStoredMission(raw, now) : null;
  }

  function save(mission) {
    touch(mission);
    records.set(mission.id, mission);
    persist();
    return publicMission(mission);
  }

  function activeMission() {
    return [...records.values()]
      .map((raw) => normaliseStoredMission(raw, now))
      .find((mission) => mission && ACTIVE_STATUSES.has(mission.status)) ?? null;
  }

  function trim() {
    while (records.size > MAX_MISSIONS) {
      const removable = [...records.values()]
        .map((raw) => normaliseStoredMission(raw, now))
        .filter((mission) => mission && !ACTIVE_STATUSES.has(mission.status))
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (!removable) break;
      records.delete(removable.id);
    }
  }

  function arm({
    epochCount,
    maxStepsPerEpoch,
    epochIntervalMs = 0,
    deadlineMs,
    maxNoProgressEpochs = 2,
    confirm = false,
  } = {}) {
    if (confirm !== true) throw new Error("Renewable operator mission requires confirm=true.");
    const boundedEpochs = boundedPositiveInteger(epochCount, MAX_INITIAL_EPOCHS);
    const boundedSteps = boundedPositiveInteger(maxStepsPerEpoch, MAX_STEPS_PER_EPOCH);
    const boundedInterval = boundedNonNegativeInteger(epochIntervalMs, MAX_EPOCH_INTERVAL_MS);
    const boundedDeadline = boundedPositiveInteger(deadlineMs, MAX_AUTHORITY_MS);
    const boundedNoProgress = boundedPositiveInteger(maxNoProgressEpochs, MAX_NO_PROGRESS_EPOCHS);
    if (!boundedEpochs || !boundedSteps || boundedInterval === null || !boundedDeadline || !boundedNoProgress) {
      throw new Error("Mission accepts 1-32 epochs, 1-20 steps per epoch, a 0-86400000 ms interval, a 1000-604800000 ms authority, and a 1-5 epoch no-progress limit.");
    }
    if (boundedDeadline < MIN_AUTHORITY_MS || boundedInterval > boundedDeadline) {
      throw new Error("Mission interval must fit within its authority deadline.");
    }
    if (activeMission()) throw new Error("A renewable operator mission is already active.");
    if ([...records.values()].some((raw) => normaliseStoredMission(raw, now)?.status === "paused")) {
      throw new Error("A paused renewable operator mission requires explicit re-arm or cancellation.");
    }
    const timestamp = now();
    const mission = {
      registry: RENEWABLE_OPERATOR_MISSION_REGISTRY,
      id: randomUUID(),
      status: "armed",
      epochsAuthorized: boundedEpochs,
      epochsConsumed: 0,
      epochsCompleted: 0,
      remainingEpochs: boundedEpochs,
      maxStepsPerEpoch: boundedSteps,
      epochIntervalMs: boundedInterval,
      maxNoProgressEpochs: boundedNoProgress,
      noProgressStreak: 0,
      deadlineAt: addMilliseconds(timestamp, boundedDeadline),
      nextEpochAt: timestamp,
      childLeaseId: null,
      lastLeaseId: null,
      renewalCount: 0,
      createdAt: timestamp,
      startedAt: null,
      pausedAt: null,
      renewedAt: null,
      endedAt: null,
      updatedAt: timestamp,
      stopReason: null,
      lastCheckpoint: null,
    };
    records.set(mission.id, mission);
    trim();
    persist();
    return publicMission(mission);
  }

  function renew(missionId, { additionalEpochs, extensionMs, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Mission renewal requires confirm=true.");
    const mission = get(missionId);
    const boundedEpochs = boundedPositiveInteger(additionalEpochs, MAX_RENEWAL_EPOCHS);
    const boundedExtension = boundedPositiveInteger(extensionMs, MAX_AUTHORITY_MS);
    if (!mission) throw new Error("Renewable operator mission was not found.");
    if (!boundedEpochs || !boundedExtension || boundedExtension < MIN_AUTHORITY_MS) {
      throw new Error("Mission renewal accepts 1-32 epochs and a 1000-604800000 ms extension.");
    }
    if (["cancelled", "cancelling"].includes(mission.status)) {
      throw new Error("A cancelled renewable operator mission cannot be renewed.");
    }
    if (mission.epochsAuthorized + boundedEpochs > MAX_TOTAL_EPOCHS) {
      throw new Error("Mission renewal would exceed the 256-epoch lifetime cap.");
    }
    const timestamp = now();
    const extensionBase = Math.max(Date.parse(timestamp), Date.parse(mission.deadlineAt));
    const renewedDeadlineMs = extensionBase + boundedExtension;
    if (renewedDeadlineMs > Date.parse(timestamp) + MAX_RENEWED_HORIZON_MS) {
      throw new Error("Mission renewal would exceed the 30-day authority horizon.");
    }
    mission.epochsAuthorized += boundedEpochs;
    mission.remainingEpochs = mission.epochsAuthorized - mission.epochsConsumed;
    mission.deadlineAt = new Date(renewedDeadlineMs).toISOString();
    mission.renewalCount += 1;
    mission.renewedAt = timestamp;
    if (["completed", "expired"].includes(mission.status)) {
      mission.status = "armed";
      mission.nextEpochAt = timestamp;
      mission.endedAt = null;
      mission.stopReason = null;
      mission.noProgressStreak = 0;
    }
    return save(mission);
  }

  function pause(missionId, confirm = false) {
    if (confirm !== true) throw new Error("Mission pause requires confirm=true.");
    const mission = get(missionId);
    if (!mission) throw new Error("Renewable operator mission was not found.");
    if (!["armed", "running"].includes(mission.status)) {
      throw new Error("Only an armed or running mission can be paused.");
    }
    const child = mission.childLeaseId ? windowLease.get(mission.childLeaseId) : null;
    if (child?.status === "running") {
      mission.status = "pausing";
      mission.stopReason = "operator_pause_requested";
      return save(mission);
    }
    if (child) windowLease.releaseForMission(child.id, mission.id);
    mission.childLeaseId = null;
    mission.status = "paused";
    mission.pausedAt = now();
    mission.stopReason = "operator_paused";
    return save(mission);
  }

  function cancel(missionId, confirm = false) {
    if (confirm !== true) throw new Error("Mission cancellation requires confirm=true.");
    const mission = get(missionId);
    if (!mission) throw new Error("Renewable operator mission was not found.");
    if (["completed", "cancelled", "expired"].includes(mission.status)) {
      throw new Error("Only an unfinished mission can be cancelled.");
    }
    const child = mission.childLeaseId ? windowLease.get(mission.childLeaseId) : null;
    if (child?.status === "running") {
      mission.status = "cancelling";
      mission.stopReason = "operator_cancel_requested";
      missionWorklist?.closeForMission?.(mission.id, "mission_cancelled");
      return save(mission);
    }
    if (child) windowLease.releaseForMission(child.id, mission.id);
    mission.childLeaseId = null;
    mission.status = "cancelled";
    mission.stopReason = "operator_cancelled";
    mission.endedAt = now();
    missionWorklist?.closeForMission?.(mission.id, "mission_cancelled");
    return save(mission);
  }

  function rearm(missionId, { resetCircuit = false, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Mission re-arm requires confirm=true.");
    const mission = get(missionId);
    if (!mission) throw new Error("Renewable operator mission was not found.");
    const circuitBlocked = mission.status === "blocked" && mission.stopReason === "no_progress_circuit_open";
    if (mission.status !== "paused" && !(circuitBlocked && resetCircuit === true)) {
      throw new Error("Only a paused mission or an explicitly reset no-progress circuit can be re-armed.");
    }
    if (Date.parse(mission.deadlineAt) <= Date.parse(now())) {
      throw new Error("Mission authority expired and must be renewed before re-arm.");
    }
    if (mission.remainingEpochs <= 0) throw new Error("Mission epoch authority is exhausted.");
    const other = activeMission();
    if (other && other.id !== mission.id) throw new Error("Another renewable operator mission is already active.");
    if (mission.childLeaseId) {
      const child = windowLease.get(mission.childLeaseId);
      if (child) windowLease.releaseForMission(child.id, mission.id);
    }
    mission.childLeaseId = null;
    mission.status = "armed";
    mission.nextEpochAt = now();
    mission.pausedAt = null;
    mission.endedAt = null;
    mission.stopReason = null;
    if (resetCircuit === true) mission.noProgressStreak = 0;
    return save(mission);
  }

  function finishAfterChild(mission, child) {
    const stepCount = child?.lastResult?.count ?? 0;
    mission.childLeaseId = null;
    mission.lastLeaseId = child?.id ?? mission.lastLeaseId;
    mission.lastCheckpoint = {
      epoch: mission.epochsConsumed,
      status: child?.status ?? "unknown",
      stepCount,
      runSessionId: child?.lastRunSessionId ?? null,
      leaseId: child?.id ?? null,
      at: now(),
    };
    if (child?.status !== "completed") {
      const authorityExpired = mission.status === "cancelling"
        && mission.stopReason === "authority_expired_during_epoch";
      mission.status = authorityExpired
        ? "expired"
        : mission.status === "cancelling"
          ? "cancelled"
          : "blocked";
      mission.stopReason = authorityExpired
        ? "authority_deadline_reached_with_child_failure"
        : mission.status === "cancelled"
          ? "operator_cancelled"
          : `child_lease_${child?.status ?? "missing"}`;
      mission.endedAt = now();
      return;
    }
    mission.epochsCompleted += 1;
    mission.noProgressStreak = stepCount > 0 ? 0 : mission.noProgressStreak + 1;
    if (mission.status === "cancelling") {
      const authorityExpired = mission.stopReason === "authority_expired_during_epoch";
      mission.status = authorityExpired ? "expired" : "cancelled";
      mission.stopReason = authorityExpired
        ? "authority_deadline_reached_at_epoch_boundary"
        : "operator_cancelled_at_epoch_boundary";
      mission.endedAt = now();
    } else if (mission.status === "pausing") {
      mission.status = "paused";
      mission.stopReason = "operator_paused_at_epoch_boundary";
      mission.pausedAt = now();
    } else if (mission.noProgressStreak >= mission.maxNoProgressEpochs) {
      mission.status = "blocked";
      mission.stopReason = "no_progress_circuit_open";
      mission.endedAt = now();
    } else if (mission.remainingEpochs <= 0) {
      mission.status = "completed";
      mission.stopReason = "epoch_authority_consumed";
      mission.endedAt = now();
    } else if (Date.parse(mission.deadlineAt) <= Date.parse(now())) {
      mission.status = "expired";
      mission.stopReason = "authority_deadline_reached";
      mission.endedAt = now();
    } else {
      mission.status = "armed";
      mission.stopReason = null;
      mission.nextEpochAt = addMilliseconds(now(), mission.epochIntervalMs);
    }
  }

  async function tick() {
    const mission = activeMission();
    let worklistState = null;
    if (!mission) return { ok: true, ran: false, reason: "no_active_mission", mission: null };
    if (["pausing", "cancelling"].includes(mission.status) && !mission.childLeaseId) {
      mission.status = mission.status === "pausing" ? "paused" : "cancelled";
      mission.stopReason = mission.status === "paused" ? "operator_paused" : "operator_cancelled";
      if (mission.status === "paused") mission.pausedAt = now();
      else {
        mission.endedAt = now();
        missionWorklist?.closeForMission?.(mission.id, "mission_cancelled");
      }
      return { ok: true, ran: false, reason: mission.stopReason, mission: save(mission) };
    }
    if (Date.parse(mission.deadlineAt) <= Date.parse(now())) {
      const child = mission.childLeaseId ? windowLease.get(mission.childLeaseId) : null;
      if (child && child.status !== "running") windowLease.releaseForMission(child.id, mission.id);
      mission.childLeaseId = child?.status === "running" ? child.id : null;
      mission.status = child?.status === "running" ? "cancelling" : "expired";
      mission.stopReason = child?.status === "running" ? "authority_expired_during_epoch" : "authority_deadline_reached";
      if (mission.status === "expired") mission.endedAt = now();
      return { ok: true, ran: false, reason: mission.stopReason, mission: save(mission) };
    }
    if (!mission.childLeaseId && Date.parse(mission.nextEpochAt) > Date.parse(now())) {
      return { ok: true, ran: false, reason: "next_epoch_not_due", mission: publicMission(mission) };
    }
    if (!mission.childLeaseId) {
      if (mission.remainingEpochs <= 0) {
        mission.status = "completed";
        mission.stopReason = "epoch_authority_consumed";
        mission.endedAt = now();
        return { ok: true, ran: false, reason: mission.stopReason, mission: save(mission) };
      }
      const remainingAuthorityMs = Date.parse(mission.deadlineAt) - Date.parse(now());
      if (remainingAuthorityMs < MIN_AUTHORITY_MS) {
        mission.status = "expired";
        mission.stopReason = "insufficient_authority_for_next_epoch";
        mission.endedAt = now();
        return { ok: true, ran: false, reason: mission.stopReason, mission: save(mission) };
      }
      if (missionWorklist) {
        let supply;
        try {
          supply = await missionWorklist.prepareEpoch(mission);
        } catch {
          supply = { ok: false, managed: true, ready: false, reason: "owner_unavailable", worklist: null };
        }
        worklistState = supply.worklist ?? null;
        if (supply.managed === true && supply.ready !== true) {
          const acceptanceRequired = supply.reason === "workflow_acceptance_required";
          mission.status = supply.reason === "worklist_completed"
            ? "completed"
            : acceptanceRequired ? "paused" : "blocked";
          mission.stopReason = supply.reason === "worklist_completed"
            ? "reviewed_worklist_completed"
            : `reviewed_worklist_${supply.reason ?? "blocked"}`;
          if (mission.status === "paused") {
            mission.pausedAt = now();
          } else {
            mission.endedAt = now();
          }
          return {
            ok: supply.ok !== false && mission.status !== "blocked",
            ran: false,
            reason: mission.stopReason,
            mission: save(mission),
            worklist: worklistState,
          };
        }
      }
      try {
        const child = windowLease.armForMission({
          missionId: mission.id,
          maxStepsPerWindow: mission.maxStepsPerEpoch,
          deadlineMs: Math.min(remainingAuthorityMs, 24 * 60 * 60 * 1000),
        });
        mission.epochsConsumed += 1;
        mission.remainingEpochs = mission.epochsAuthorized - mission.epochsConsumed;
        mission.childLeaseId = child.id;
        mission.lastLeaseId = child.id;
        mission.status = "running";
        mission.startedAt = mission.startedAt ?? now();
        mission.lastCheckpoint = {
          epoch: mission.epochsConsumed,
          status: "checkpointed",
          stepCount: 0,
          runSessionId: null,
          leaseId: child.id,
          at: now(),
        };
        save(mission);
      } catch {
        mission.status = "blocked";
        mission.stopReason = "window_lease_owner_unavailable";
        mission.endedAt = now();
        return { ok: false, ran: false, reason: mission.stopReason, mission: save(mission) };
      }
    }
    const childResult = await windowLease.tick({ missionId: mission.id });
    const currentMission = get(mission.id) ?? mission;
    const child = currentMission.childLeaseId ? windowLease.get(currentMission.childLeaseId) : null;
    if (!child || ["armed", "running"].includes(child.status)) {
      return {
        ok: childResult?.ok !== false,
        ran: childResult?.ran === true,
        reason: child?.status === "running" ? "epoch_running" : "epoch_window_not_due",
        mission: publicMission(currentMission),
        worklist: worklistState,
      };
    }
    finishAfterChild(currentMission, child);
    if (currentMission.status === "cancelled") {
      missionWorklist?.closeForMission?.(currentMission.id, "mission_cancelled");
    }
    worklistState = missionWorklist?.refreshForMission(currentMission.id) ?? worklistState;
    if (worklistState?.status === "blocked"
      && !["cancelled", "expired"].includes(currentMission.status)) {
      currentMission.status = "blocked";
      currentMission.stopReason = `reviewed_worklist_${worklistState.blockedReason ?? "blocked"}`;
      currentMission.endedAt = now();
    } else if (worklistState?.status === "completed"
      && ["armed", "completed"].includes(currentMission.status)) {
      currentMission.status = "completed";
      currentMission.stopReason = "reviewed_worklist_completed";
      currentMission.endedAt = now();
    }
    return {
      ok: childResult?.ok !== false && currentMission.status !== "blocked",
      ran: childResult?.ran === true,
      reason: currentMission.stopReason,
      mission: save(currentMission),
      worklist: worklistState,
    };
  }

  function reconcileAtStartup() {
    let changed = false;
    for (const [id, raw] of records.entries()) {
      const mission = normaliseStoredMission(raw, now);
      if (!mission) {
        records.delete(id);
        changed = true;
        continue;
      }
      if (ACTIVE_STATUSES.has(mission.status)) {
        const child = mission.childLeaseId ? windowLease.get(mission.childLeaseId) : null;
        let childReleased = true;
        if (child && child.status !== "running") {
          try {
            windowLease.releaseForMission(child.id, mission.id);
          } catch {
            childReleased = false;
          }
        }
        mission.childLeaseId = null;
        if (!childReleased) {
          mission.status = "blocked";
          mission.stopReason = "core_restart_child_ownership_mismatch";
          mission.endedAt = now();
        } else if (mission.status === "cancelling") {
          const authorityExpired = mission.stopReason === "authority_expired_during_epoch";
          mission.status = authorityExpired ? "expired" : "cancelled";
          mission.stopReason = authorityExpired
            ? "authority_deadline_reached_during_restart"
            : "operator_cancelled_during_restart";
          mission.endedAt = now();
          if (!authorityExpired) missionWorklist?.closeForMission?.(mission.id, "mission_cancelled");
        } else {
          mission.status = "paused";
          mission.stopReason = "core_restart_requires_explicit_rearm";
          mission.pausedAt = now();
        }
        changed = true;
      }
      if (JSON.stringify(raw) !== JSON.stringify(mission)) changed = true;
      records.set(mission.id, mission);
    }
    if (changed) persist();
    return listPublic();
  }

  function listPublic() {
    return [...records.values()]
      .map((raw) => normaliseStoredMission(raw, now))
      .filter(Boolean)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, MAX_MISSIONS)
      .map(publicMission);
  }

  function state() {
    return {
      registry: RENEWABLE_OPERATOR_MISSION_REGISTRY,
      enabled: enabled === true,
      timerActive: timer !== null,
      active: Boolean(activeMission()),
      governance: governance(),
    };
  }

  function start() {
    if (!enabled || timer !== null) return false;
    timer = setTimer(() => { void tick(); }, Math.max(1_000, Number(intervalMs) || 30_000));
    return true;
  }

  function stop() {
    if (timer === null) return false;
    clearTimer(timer);
    timer = null;
    return true;
  }

  return {
    arm,
    renew,
    pause,
    cancel,
    rearm,
    tick,
    reconcileAtStartup,
    listPublic,
    state,
    start,
    stop,
  };
}
