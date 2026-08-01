import { randomUUID } from "node:crypto";

export const BOUNDED_OPERATOR_SCHEDULER_REGISTRY =
  "nixsoma-bounded-operator-scheduler-v0";

const MAX_SCHEDULES = 8;
const MAX_STEPS = 20;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["armed", "running"]);

function boundedId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u.test(value)
    ? value
    : null;
}

function boundedSteps(value) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, MAX_STEPS) : null;
}

function boundedDelay(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_DELAY_MS ? value : null;
}

function compactResult(result) {
  return {
    ran: result?.ran === true,
    count: Number.isInteger(result?.steps?.length) ? result.steps.length : 0,
    blocked: result?.blocked === true,
    reason: typeof result?.reason === "string" ? result.reason.slice(0, 120) : null,
  };
}

function publicSchedule(schedule) {
  if (!schedule) return null;
  return {
    registry: BOUNDED_OPERATOR_SCHEDULER_REGISTRY,
    id: schedule.id,
    status: schedule.status,
    maxSteps: schedule.maxSteps,
    dueAt: schedule.dueAt,
    createdAt: schedule.createdAt,
    startedAt: schedule.startedAt ?? null,
    endedAt: schedule.endedAt ?? null,
    updatedAt: schedule.updatedAt,
    stopReason: schedule.stopReason ?? null,
    lastResult: schedule.lastResult ?? null,
    governance: {
      explicitOperatorArm: true,
      finiteStepBudget: true,
      maximumSteps: MAX_STEPS,
      oneShot: true,
      automaticRepeat: false,
      automaticRetry: false,
      automaticTaskCreation: false,
      automaticPlanning: false,
      providerAuthority: false,
      mutatesHost: false,
    },
  };
}

export function createBoundedOperatorScheduler({
  records = new Map(),
  persistState = () => {},
  run = async () => ({ ran: false, steps: [], reason: "scheduler_runner_unavailable" }),
  now = () => new Date().toISOString(),
  setTimer = setInterval,
  clearTimer = clearInterval,
  intervalMs = 30_000,
  enabled = false,
} = {}) {
  if (!(records instanceof Map)) throw new Error("Bounded operator scheduler requires a Map.");
  let timer = null;

  function touch(schedule) {
    schedule.updatedAt = now();
  }

  function persist() {
    persistState();
  }

  function trim() {
    while (records.size > MAX_SCHEDULES) {
      const removable = [...records.values()]
        .filter((schedule) => !ACTIVE_STATUSES.has(schedule.status))
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (!removable) break;
      records.delete(removable.id);
    }
  }

  function activeSchedule() {
    return [...records.values()].find((schedule) => ACTIVE_STATUSES.has(schedule.status)) ?? null;
  }

  function arm({ maxSteps, delayMs = 0, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Bounded schedule requires confirm=true.");
    const boundedMaxSteps = boundedSteps(maxSteps);
    const boundedDelayMs = boundedDelay(delayMs);
    if (!boundedMaxSteps || boundedDelayMs === null) {
      throw new Error("Bounded schedule accepts 1-20 steps and a delay from 0 to 86400000 ms.");
    }
    if (activeSchedule()) throw new Error("A bounded operator schedule is already active.");
    if ([...records.values()].some((schedule) => schedule.status === "paused")) {
      throw new Error("A paused schedule requires explicit re-arm.");
    }
    const timestamp = now();
    const schedule = {
      registry: BOUNDED_OPERATOR_SCHEDULER_REGISTRY,
      id: randomUUID(),
      status: "armed",
      maxSteps: boundedMaxSteps,
      dueAt: new Date(Date.parse(timestamp) + boundedDelayMs).toISOString(),
      createdAt: timestamp,
      startedAt: null,
      endedAt: null,
      updatedAt: timestamp,
      stopReason: null,
      lastResult: null,
    };
    records.set(schedule.id, schedule);
    trim();
    persist();
    return publicSchedule(schedule);
  }

  function cancel(scheduleId, confirm = false) {
    if (confirm !== true) throw new Error("Bounded schedule cancellation requires confirm=true.");
    const id = boundedId(scheduleId);
    const schedule = id ? records.get(id) : null;
    if (!schedule) throw new Error("Bounded operator schedule was not found.");
    if (schedule.status !== "armed") throw new Error("Only an armed schedule can be cancelled.");
    schedule.status = "cancelled";
    schedule.stopReason = "operator_cancelled";
    schedule.endedAt = now();
    touch(schedule);
    persist();
    return publicSchedule(schedule);
  }

  function rearm(scheduleId, { delayMs = 0, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Bounded schedule re-arm requires confirm=true.");
    const id = boundedId(scheduleId);
    const schedule = id ? records.get(id) : null;
    const boundedDelayMs = boundedDelay(delayMs);
    if (!schedule) throw new Error("Bounded operator schedule was not found.");
    if (schedule.status !== "paused") {
      throw new Error("Only a paused schedule can be re-armed.");
    }
    if (boundedDelayMs === null) {
      throw new Error("Bounded schedule re-arm accepts a delay from 0 to 86400000 ms.");
    }
    if (activeSchedule()) throw new Error("A bounded operator schedule is already active.");
    const timestamp = now();
    schedule.status = "armed";
    schedule.dueAt = new Date(Date.parse(timestamp) + boundedDelayMs).toISOString();
    schedule.startedAt = null;
    schedule.endedAt = null;
    schedule.stopReason = null;
    touch(schedule);
    persist();
    return publicSchedule(schedule);
  }

  function reconcileAtStartup() {
    let changed = false;
    for (const schedule of records.values()) {
      if (schedule.status === "running") {
        schedule.status = "blocked";
        schedule.stopReason = "core_restart_during_scheduled_run";
        schedule.endedAt = now();
        touch(schedule);
        changed = true;
      } else if (schedule.status === "armed") {
        schedule.status = "paused";
        schedule.stopReason = "core_restart_requires_explicit_rearm";
        schedule.endedAt = now();
        touch(schedule);
        changed = true;
      }
    }
    if (changed) persist();
    return listPublic();
  }

  async function tick() {
    const schedule = [...records.values()]
      .filter((candidate) => candidate.status === "armed" && Date.parse(candidate.dueAt) <= Date.parse(now()))
      .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)))[0] ?? null;
    if (!schedule) return { ok: true, ran: false, reason: "no_due_schedule", schedule: null };
    if (activeSchedule() && activeSchedule().id !== schedule.id) {
      return { ok: true, ran: false, reason: "another_schedule_active", schedule: publicSchedule(schedule) };
    }

    schedule.status = "running";
    schedule.startedAt = now();
    schedule.stopReason = null;
    touch(schedule);
    persist();
    try {
      const result = await run({ maxSteps: schedule.maxSteps, scheduleId: schedule.id });
      schedule.lastResult = compactResult(result);
      schedule.status = result?.blocked === true ? "blocked" : "completed";
      schedule.stopReason = result?.blocked === true
        ? result.reason ?? "scheduled_run_blocked"
        : "one_shot_schedule_consumed";
      schedule.endedAt = now();
      touch(schedule);
      persist();
      return { ok: true, ran: true, reason: schedule.stopReason, schedule: publicSchedule(schedule) };
    } catch (error) {
      schedule.status = "blocked";
      schedule.stopReason = "scheduled_run_failed";
      schedule.lastResult = { ran: false, count: 0, blocked: true, reason: "scheduled_run_failed" };
      schedule.endedAt = now();
      touch(schedule);
      persist();
      return { ok: false, ran: false, reason: "scheduled_run_failed", schedule: publicSchedule(schedule) };
    }
  }

  function listPublic() {
    return [...records.values()]
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, MAX_SCHEDULES)
      .map(publicSchedule);
  }

  function state() {
    return {
      registry: BOUNDED_OPERATOR_SCHEDULER_REGISTRY,
      enabled: enabled === true,
      timerActive: timer !== null,
      active: Boolean(activeSchedule()),
      governance: publicSchedule({ id: "state", status: "idle", maxSteps: MAX_STEPS, dueAt: now(), createdAt: now(), updatedAt: now() }).governance,
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
