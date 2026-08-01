import { randomUUID } from "node:crypto";

export const BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY =
  "nixsoma-bounded-operator-window-lease-v0";

const MAX_LEASES = 8;
const MAX_WINDOWS = 8;
const MAX_STEPS_PER_WINDOW = 20;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_DEADLINE_MS = 1000;
const MAX_DEADLINE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["armed", "running"]);
const VALID_STATUSES = new Set([
  "armed",
  "running",
  "paused",
  "blocked",
  "completed",
  "cancelled",
  "expired",
]);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const MISSION_OWNER_KIND = "renewable_operator_mission";

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function boundedPositiveInteger(value, maximum) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, maximum) : null;
}

function boundedNonNegativeInteger(value, maximum) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, maximum) : null;
}

function validTimestamp(value, fallback) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function compactResult(result) {
  const count = Number.isInteger(result?.count)
    ? result.count
    : Number.isInteger(result?.steps?.length)
      ? result.steps.length
      : 0;
  return {
    ran: result?.ran === true,
    count: Math.max(0, Math.min(MAX_STEPS_PER_WINDOW, count)),
    blocked: result?.blocked === true,
    reason: typeof result?.reason === "string" ? result.reason.slice(0, 120) : null,
  };
}

function normaliseOwner(value) {
  const missionId = safeId(value?.missionId);
  if (value?.kind === MISSION_OWNER_KIND && missionId) {
    return { kind: MISSION_OWNER_KIND, missionId };
  }
  return { kind: "operator", missionId: null };
}

function governance() {
  return {
    explicitOperatorArm: true,
    finiteWindowBudget: true,
    hardDeadline: true,
    maximumWindows: MAX_WINDOWS,
    maximumStepsPerWindow: MAX_STEPS_PER_WINDOW,
    automaticContinuationWithinLease: true,
    explicitRearmAfterRestart: true,
    automaticRepeat: false,
    automaticRetry: false,
    automaticTaskCreation: false,
    automaticPlanning: false,
    providerAuthority: false,
    mutatesHost: false,
  };
}

function publicLease(lease) {
  if (!lease) return null;
  return {
    registry: BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY,
    id: lease.id,
    status: lease.status,
    windowCount: lease.windowCount,
    windowsCompleted: lease.windowsCompleted,
    remainingWindows: lease.remainingWindows,
    maxStepsPerWindow: lease.maxStepsPerWindow,
    intervalMs: lease.intervalMs,
    deadlineAt: lease.deadlineAt,
    nextWindowAt: lease.nextWindowAt,
    createdAt: lease.createdAt,
    startedAt: lease.startedAt ?? null,
    pausedAt: lease.pausedAt ?? null,
    endedAt: lease.endedAt ?? null,
    updatedAt: lease.updatedAt,
    stopReason: lease.stopReason ?? null,
    lastRunSessionId: safeId(lease.lastRunSessionId),
    lastResult: lease.lastResult ?? null,
    owner: normaliseOwner(lease.owner),
    governance: governance(),
  };
}

function normaliseStoredLease(raw, now) {
  const id = safeId(raw?.id);
  if (!id) return null;
  const updatedAt = validTimestamp(raw.updatedAt, now());
  const windowCount = boundedPositiveInteger(raw.windowCount, MAX_WINDOWS) ?? 1;
  const windowsCompleted = Math.max(
    0,
    Math.min(windowCount, Number.isInteger(raw.windowsCompleted) ? raw.windowsCompleted : 0),
  );
  const maxStepsPerWindow = boundedPositiveInteger(raw.maxStepsPerWindow, MAX_STEPS_PER_WINDOW) ?? 1;
  const intervalMs = boundedNonNegativeInteger(raw.intervalMs, MAX_INTERVAL_MS) ?? 0;
  const fallbackDeadline = new Date(Date.parse(updatedAt) + MIN_DEADLINE_MS).toISOString();
  const deadlineAt = validTimestamp(raw.deadlineAt, fallbackDeadline);
  const nextWindowAt = validTimestamp(raw.nextWindowAt, updatedAt);
  const status = VALID_STATUSES.has(raw.status) ? raw.status : "blocked";
  return {
    registry: BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY,
    id,
    status,
    windowCount,
    windowsCompleted,
    remainingWindows: Math.max(0, windowCount - windowsCompleted),
    maxStepsPerWindow,
    intervalMs,
    deadlineAt,
    nextWindowAt,
    createdAt: validTimestamp(raw.createdAt, updatedAt),
    startedAt: validTimestamp(raw.startedAt, null),
    pausedAt: validTimestamp(raw.pausedAt, null),
    endedAt: validTimestamp(raw.endedAt, null),
    updatedAt,
    stopReason: typeof raw.stopReason === "string" ? raw.stopReason.slice(0, 120) : null,
    lastRunSessionId: safeId(raw.lastRunSessionId),
    lastResult: raw.lastResult && typeof raw.lastResult === "object" ? compactResult(raw.lastResult) : null,
    owner: normaliseOwner(raw.owner),
  };
}

function addMilliseconds(timestamp, milliseconds) {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

export function createBoundedOperatorWindowLease({
  records = new Map(),
  persistState = () => {},
  run = async () => ({ ran: false, steps: [], reason: "window_runner_unavailable" }),
  now = () => new Date().toISOString(),
  setTimer = setInterval,
  clearTimer = clearInterval,
  intervalMs = 30_000,
  enabled = false,
} = {}) {
  if (!(records instanceof Map)) throw new Error("Bounded operator window lease requires a Map.");
  let timer = null;

  function persist() {
    if (typeof persistState.flush === "function") persistState.flush();
    else persistState();
  }

  function touch(lease) {
    lease.updatedAt = now();
  }

  function activeLease() {
    return [...records.values()].find((lease) => ACTIVE_STATUSES.has(lease?.status)) ?? null;
  }

  function trim() {
    while (records.size > MAX_LEASES) {
      const removable = [...records.values()]
        .filter((lease) => !ACTIVE_STATUSES.has(lease.status))
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (!removable) break;
      records.delete(removable.id);
    }
  }

  function armInternal({
    windowCount,
    maxStepsPerWindow,
    intervalMs: requestedIntervalMs = 0,
    deadlineMs,
    confirm = false,
  } = {}, owner = { kind: "operator", missionId: null }) {
    if (confirm !== true) throw new Error("Bounded window lease requires confirm=true.");
    const boundedWindowCount = boundedPositiveInteger(windowCount, MAX_WINDOWS);
    const boundedSteps = boundedPositiveInteger(maxStepsPerWindow, MAX_STEPS_PER_WINDOW);
    const boundedInterval = boundedNonNegativeInteger(requestedIntervalMs, MAX_INTERVAL_MS);
    const boundedDeadline = Number.isInteger(deadlineMs)
      && deadlineMs >= MIN_DEADLINE_MS
      && deadlineMs <= MAX_DEADLINE_MS
      ? deadlineMs
      : null;
    if (!boundedWindowCount || !boundedSteps || boundedInterval === null || boundedDeadline === null) {
      throw new Error("Bounded window lease accepts 1-8 windows, 1-20 steps per window, a 0-86400000 ms interval, and a 1000-86400000 ms deadline.");
    }
    if (boundedInterval > boundedDeadline) {
      throw new Error("Bounded window lease interval cannot exceed its deadline.");
    }
    if (activeLease()) throw new Error("A bounded operator window lease is already active.");
    if ([...records.values()].some((lease) => lease.status === "paused")) {
      throw new Error("A paused window lease requires explicit re-arm.");
    }

    const timestamp = now();
    const lease = {
      registry: BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY,
      id: randomUUID(),
      status: "armed",
      windowCount: boundedWindowCount,
      windowsCompleted: 0,
      remainingWindows: boundedWindowCount,
      maxStepsPerWindow: boundedSteps,
      intervalMs: boundedInterval,
      deadlineAt: addMilliseconds(timestamp, boundedDeadline),
      nextWindowAt: timestamp,
      createdAt: timestamp,
      startedAt: null,
      pausedAt: null,
      endedAt: null,
      updatedAt: timestamp,
      stopReason: null,
      lastRunSessionId: null,
      lastResult: null,
      owner: normaliseOwner(owner),
    };
    records.set(lease.id, lease);
    trim();
    persist();
    return publicLease(lease);
  }

  function arm(options = {}) {
    return armInternal(options, { kind: "operator", missionId: null });
  }

  function armForMission({ missionId, maxStepsPerWindow, deadlineMs } = {}) {
    const boundedMissionId = safeId(missionId);
    if (!boundedMissionId) throw new Error("Mission-owned window lease requires a valid mission id.");
    return armInternal({
      windowCount: 1,
      maxStepsPerWindow,
      intervalMs: 0,
      deadlineMs,
      confirm: true,
    }, {
      kind: MISSION_OWNER_KIND,
      missionId: boundedMissionId,
    });
  }

  function get(leaseId) {
    const id = safeId(leaseId);
    const raw = id ? records.get(id) : null;
    return raw ? normaliseStoredLease(raw, now) : null;
  }

  function cancel(leaseId, confirm = false) {
    if (confirm !== true) throw new Error("Bounded window lease cancellation requires confirm=true.");
    const lease = get(leaseId);
    if (!lease) throw new Error("Bounded operator window lease was not found.");
    if (lease.status !== "armed") throw new Error("Only an armed window lease can be cancelled.");
    lease.status = "cancelled";
    lease.stopReason = "operator_cancelled";
    lease.endedAt = now();
    touch(lease);
    records.set(lease.id, lease);
    persist();
    return publicLease(lease);
  }

  function releaseForMission(leaseId, missionId) {
    const boundedMissionId = safeId(missionId);
    const lease = get(leaseId);
    if (!lease || lease.owner.kind !== MISSION_OWNER_KIND || lease.owner.missionId !== boundedMissionId) {
      throw new Error("Mission-owned window lease was not found.");
    }
    if (lease.status === "running") {
      throw new Error("A running mission-owned window lease can stop only at its epoch boundary.");
    }
    if (["completed", "cancelled", "expired"].includes(lease.status)) return publicLease(lease);
    lease.status = "cancelled";
    lease.stopReason = "mission_released_child_lease";
    lease.endedAt = now();
    touch(lease);
    records.set(lease.id, lease);
    persist();
    return publicLease(lease);
  }

  function rearm(leaseId, { confirm = false } = {}) {
    if (confirm !== true) throw new Error("Bounded window lease re-arm requires confirm=true.");
    const lease = get(leaseId);
    if (!lease) throw new Error("Bounded operator window lease was not found.");
    if (lease.owner.kind !== "operator") {
      throw new Error("Mission-owned window leases can be resumed only through their mission owner.");
    }
    if (lease.status !== "paused") throw new Error("Only a paused window lease can be re-armed.");
    if (Date.parse(lease.deadlineAt) <= Date.parse(now())) {
      throw new Error("Bounded window lease deadline has expired and cannot be re-armed.");
    }
    if (activeLease()) throw new Error("A bounded operator window lease is already active.");
    lease.status = "armed";
    lease.nextWindowAt = now();
    lease.pausedAt = null;
    lease.stopReason = null;
    lease.endedAt = null;
    touch(lease);
    records.set(lease.id, lease);
    persist();
    return publicLease(lease);
  }

  function reconcileAtStartup() {
    let changed = false;
    for (const [id, raw] of records.entries()) {
      const lease = normaliseStoredLease(raw, now);
      if (!lease) {
        records.delete(id);
        changed = true;
        continue;
      }
      if (lease.status === "running") {
        lease.status = "blocked";
        lease.stopReason = "core_restart_during_window";
        lease.endedAt = now();
        changed = true;
      } else if (lease.status === "armed") {
        lease.status = "paused";
        lease.stopReason = "core_restart_requires_explicit_rearm";
        lease.pausedAt = now();
        changed = true;
      }
      if (JSON.stringify(raw) !== JSON.stringify(lease)) changed = true;
      records.set(lease.id, lease);
    }
    if (changed) persist();
    return listPublic();
  }

  async function tick({ missionId = null } = {}) {
    const boundedMissionId = missionId === null ? null : safeId(missionId);
    if (missionId !== null && !boundedMissionId) {
      throw new Error("Mission-owned window tick requires a valid mission id.");
    }
    const currentTime = now();
    const currentMs = Date.parse(currentTime);
    const lease = [...records.values()]
      .map((raw) => normaliseStoredLease(raw, now))
      .filter((candidate) => {
        if (candidate?.status !== "armed" || Date.parse(candidate.nextWindowAt) > currentMs) return false;
        return boundedMissionId
          ? candidate.owner.kind === MISSION_OWNER_KIND && candidate.owner.missionId === boundedMissionId
          : candidate.owner.kind === "operator";
      })[0] ?? null;
    if (!lease) return { ok: true, ran: false, reason: "no_due_window", lease: null };
    if (Date.parse(lease.deadlineAt) <= currentMs) {
      lease.status = "expired";
      lease.stopReason = "deadline_reached";
      lease.endedAt = currentTime;
      touch(lease);
      records.set(lease.id, lease);
      persist();
      return { ok: true, ran: false, reason: lease.stopReason, lease: publicLease(lease) };
    }
    if (activeLease() && activeLease().id !== lease.id) {
      return { ok: true, ran: false, reason: "another_window_lease_active", lease: publicLease(lease) };
    }

    lease.status = "running";
    lease.startedAt = lease.startedAt ?? currentTime;
    lease.stopReason = null;
    touch(lease);
    records.set(lease.id, lease);
    persist();

    try {
      const result = await run({
        maxSteps: lease.maxStepsPerWindow,
        leaseId: lease.id,
        windowIndex: lease.windowsCompleted + 1,
      });
      lease.lastResult = compactResult(result);
      lease.lastRunSessionId = safeId(result?.runSessionId);
      if (result?.blocked === true) {
        lease.status = "blocked";
        lease.stopReason = result.reason ?? "window_run_blocked";
        lease.endedAt = now();
      } else {
        lease.windowsCompleted = Math.min(lease.windowCount, lease.windowsCompleted + 1);
        lease.remainingWindows = Math.max(0, lease.windowCount - lease.windowsCompleted);
        const afterRun = now();
        if (lease.remainingWindows === 0) {
          lease.status = "completed";
          lease.stopReason = "window_budget_consumed";
          lease.endedAt = afterRun;
        } else if (Date.parse(lease.deadlineAt) <= Date.parse(afterRun)) {
          lease.status = "expired";
          lease.stopReason = "deadline_reached";
          lease.endedAt = afterRun;
        } else {
          lease.status = "armed";
          lease.nextWindowAt = addMilliseconds(afterRun, lease.intervalMs);
        }
      }
      touch(lease);
      records.set(lease.id, lease);
      persist();
      return {
        ok: true,
        ran: true,
        reason: lease.stopReason,
        continued: lease.status === "armed",
        lease: publicLease(lease),
      };
    } catch (error) {
      lease.status = "blocked";
      lease.stopReason = "window_run_failed";
      lease.lastResult = { ran: false, count: 0, blocked: true, reason: "window_run_failed" };
      lease.endedAt = now();
      touch(lease);
      records.set(lease.id, lease);
      persist();
      return { ok: false, ran: false, reason: lease.stopReason, lease: publicLease(lease) };
    }
  }

  function listPublic() {
    return [...records.values()]
      .map((raw) => normaliseStoredLease(raw, now))
      .filter(Boolean)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, MAX_LEASES)
      .map(publicLease);
  }

  function state() {
    return {
      registry: BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY,
      enabled: enabled === true,
      timerActive: timer !== null,
      active: Boolean(activeLease()),
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
    armForMission,
    cancel,
    releaseForMission,
    rearm,
    get,
    tick,
    reconcileAtStartup,
    listPublic,
    state,
    start,
    stop,
  };
}
