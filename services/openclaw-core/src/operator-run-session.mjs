import { randomUUID } from "node:crypto";

export const OPERATOR_RUN_SESSION_REGISTRY = "nixsoma-bounded-operator-run-session-v0";
export const OPERATOR_RUN_RESUME_REQUEST_REGISTRY = "nixsoma-bounded-operator-run-resume-request-v0";
export const OPERATOR_RUN_SESSION_MAXIMUM_STEPS = 20;
export const OPERATOR_RUN_SESSION_MAX_ENTRIES = 20;

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const VALID_STATUSES = new Set(["running", "interrupted", "blocked", "paused", "completed"]);
const RESUMABLE_STATUSES = new Set(["interrupted", "blocked", "paused"]);

function nowIso(now) {
  const value = now();
  return typeof value === "string" && value ? value : new Date().toISOString();
}

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function safeText(value, maxLength = 120) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function emptyRecovery() {
  return {
    required: false,
    recoverable: false,
    sourceTaskId: null,
    recoveredTaskId: null,
    phase: null,
    action: null,
    automaticReplay: false,
  };
}

function normaliseRecovery(recovery) {
  if (!recovery || typeof recovery !== "object" || Array.isArray(recovery)) {
    return emptyRecovery();
  }
  const required = recovery.required === true;
  const recoverable = recovery.recoverable === true;
  return {
    required,
    recoverable,
    sourceTaskId: safeId(recovery.sourceTaskId),
    recoveredTaskId: safeId(recovery.recoveredTaskId),
    phase: safeText(recovery.phase),
    action: required
      ? (recoverable ? "recover_task_after_core_restart" : "review_interrupted_task")
      : null,
    automaticReplay: false,
  };
}

function canResume(session) {
  return RESUMABLE_STATUSES.has(session.status)
    && session.stepsCompleted < session.requestedSteps
    && session.recovery?.required !== true;
}

function boundedSteps(value, fallback = 1) {
  return Number.isInteger(value)
    ? Math.max(1, Math.min(OPERATOR_RUN_SESSION_MAXIMUM_STEPS, value))
    : fallback;
}

function governance() {
  return {
    explicitOperatorTrigger: true,
    explicitResumeRequired: true,
    automaticResume: false,
    backgroundScheduling: false,
    automaticRepeat: false,
    automaticRetry: false,
    createsTask: false,
    createsApproval: false,
    callsProvider: false,
    mutatesHost: false,
  };
}

function publicSession(session) {
  if (!session) return null;
  return {
    registry: OPERATOR_RUN_SESSION_REGISTRY,
    id: session.id,
    status: session.status,
    requestedSteps: session.requestedSteps,
    stepsCompleted: session.stepsCompleted,
    remainingSteps: session.remainingSteps,
    resumeCount: session.resumeCount,
    lastTaskId: session.lastTaskId,
    stopReason: session.stopReason,
    startedAt: session.startedAt,
    resumedAt: session.resumedAt,
    interruptedAt: session.interruptedAt,
    endedAt: session.endedAt,
    updatedAt: session.updatedAt,
    recovery: session.recovery ?? emptyRecovery(),
    resumeAvailable: session.resumeAvailable === true,
    governance: governance(),
  };
}

function normaliseStoredSession(session, now) {
  const id = safeId(session?.id);
  if (!id) return null;
  const requestedSteps = boundedSteps(session.requestedSteps);
  const stepsCompleted = Math.max(0, Math.min(requestedSteps, Number.isInteger(session.stepsCompleted)
    ? session.stepsCompleted
    : 0));
  const status = VALID_STATUSES.has(session.status) ? session.status : "interrupted";
  const recovery = normaliseRecovery(session.recovery);
  const updatedAt = typeof session.updatedAt === "string" && session.updatedAt
    ? session.updatedAt
    : nowIso(now);
  return {
    registry: OPERATOR_RUN_SESSION_REGISTRY,
    id,
    status,
    requestedSteps,
    stepsCompleted,
    remainingSteps: Math.max(0, requestedSteps - stepsCompleted),
    resumeCount: Number.isInteger(session.resumeCount) && session.resumeCount >= 0
      ? Math.min(session.resumeCount, 100)
      : 0,
    lastTaskId: safeId(session.lastTaskId),
    completedTaskCheckpointId: safeId(session.completedTaskCheckpointId),
    stopReason: typeof session.stopReason === "string" ? session.stopReason.slice(0, 120) : null,
    startedAt: typeof session.startedAt === "string" && session.startedAt ? session.startedAt : updatedAt,
    resumedAt: typeof session.resumedAt === "string" ? session.resumedAt : null,
    interruptedAt: typeof session.interruptedAt === "string" ? session.interruptedAt : null,
    endedAt: typeof session.endedAt === "string" ? session.endedAt : null,
    updatedAt,
    recovery,
    resumeAvailable: canResume({ status, requestedSteps, stepsCompleted, recovery }),
  };
}

export function buildBoundedOperatorRunResumeRequest(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Bounded operator resume requires an object body.");
  }
  const allowedFields = new Set(["sessionId", "confirm"]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new Error("Bounded operator resume does not accept task or execution override fields.");
  }
  if (!safeId(body.sessionId)) {
    throw new Error("Bounded operator resume requires a valid sessionId.");
  }
  if (body.confirm !== true) {
    throw new Error("Bounded operator resume requires confirm=true.");
  }
  return {
    request: {
      sessionId: body.sessionId,
      confirm: true,
    },
    resume: {
      registry: OPERATOR_RUN_RESUME_REQUEST_REGISTRY,
      status: "resume_requested",
      sessionId: body.sessionId,
      governance: {
        explicitOperatorTrigger: true,
        explicitResumeRequired: true,
        automaticResume: false,
        automaticRepeat: false,
        automaticRetry: false,
        taskOverridesAccepted: false,
        createsTask: false,
        createsApproval: false,
        mutatesHost: false,
      },
    },
  };
}

export function createOperatorRunSessionManager({
  records = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  function persistDurably() {
    if (typeof persistState.flush === "function") {
      persistState.flush();
    } else {
      persistState();
    }
  }

  function touch(session) {
    session.updatedAt = nowIso(now);
  }

  function trimRecords() {
    while (records.size > OPERATOR_RUN_SESSION_MAX_ENTRIES) {
      const removable = [...records.values()]
        .filter((session) => session.status !== "running")
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (!removable) return;
      records.delete(removable.id);
    }
  }

  function activeSession() {
    return [...records.values()].find((session) => session?.status === "running") ?? null;
  }

  function create({ maxSteps } = {}) {
    const boundedMaxSteps = boundedSteps(maxSteps);
    if (activeSession()) {
      throw new Error("A bounded operator run is already active.");
    }
    const timestamp = nowIso(now);
    const session = {
      registry: OPERATOR_RUN_SESSION_REGISTRY,
      id: randomUUID(),
      status: "running",
      requestedSteps: boundedMaxSteps,
      stepsCompleted: 0,
      remainingSteps: boundedMaxSteps,
      resumeCount: 0,
      lastTaskId: null,
      completedTaskCheckpointId: null,
      stopReason: null,
      startedAt: timestamp,
      resumedAt: null,
      interruptedAt: null,
      endedAt: null,
      updatedAt: timestamp,
      recovery: emptyRecovery(),
      resumeAvailable: false,
    };
    records.set(session.id, session);
    trimRecords();
    persistDurably();
    return session;
  }

  function get(sessionId) {
    return records.get(safeId(sessionId)) ?? null;
  }

  function markStep(sessionId, taskId) {
    const session = get(sessionId);
    if (!session || session.status !== "running") return null;
    session.stepsCompleted = Math.min(session.requestedSteps, session.stepsCompleted + 1);
    session.remainingSteps = Math.max(0, session.requestedSteps - session.stepsCompleted);
    session.lastTaskId = safeId(taskId);
    session.completedTaskCheckpointId = null;
    touch(session);
    persistDurably();
    return session;
  }

  function markTaskStarted(sessionId, task) {
    const session = get(sessionId);
    const taskId = safeId(task?.id);
    if (!session || !taskId || session.status !== "running") return null;
    session.lastTaskId = taskId;
    session.completedTaskCheckpointId = null;
    session.stopReason = null;
    touch(session);
    persistDurably();
    return publicSession(session);
  }

  function reconcileCompletedTaskCheckpoint(sessionId, task) {
    const session = get(sessionId);
    const taskId = safeId(task?.id);
    if (!session || !taskId || task?.status !== "completed"
      || session.lastTaskId !== taskId
      || session.completedTaskCheckpointId === taskId) return null;
    session.stepsCompleted = Math.min(session.requestedSteps, session.stepsCompleted + 1);
    session.remainingSteps = Math.max(0, session.requestedSteps - session.stepsCompleted);
    session.completedTaskCheckpointId = taskId;
    session.status = "interrupted";
    session.stopReason = "core_restart_after_task_completion";
    session.interruptedAt = session.interruptedAt ?? nowIso(now);
    session.resumeAvailable = canResume(session) && session.remainingSteps > 0;
    touch(session);
    persistDurably();
    return publicSession(session);
  }

  function finish(sessionId, result = {}) {
    const session = get(sessionId);
    if (!session || session.status !== "running") return null;
    if (result.blocked === true) {
      session.status = result.reason === "runtime_paused" ? "paused" : "blocked";
      session.stopReason = result.reason ?? "blocked";
    } else {
      session.status = "completed";
      session.stopReason = session.remainingSteps === 0
        ? "step_limit_reached"
        : result.reason ?? "no_queued_task";
    }
    session.endedAt = nowIso(now);
    session.resumeAvailable = canResume(session) && session.remainingSteps > 0;
    touch(session);
    persistDurably();
    return session;
  }

  function interrupt(sessionId, reason = "run_interrupted") {
    const session = get(sessionId);
    if (!session || session.status !== "running") return null;
    session.status = "interrupted";
    session.stopReason = reason;
    session.interruptedAt = nowIso(now);
    session.resumeAvailable = canResume(session);
    touch(session);
    persistDurably();
    return session;
  }

  function reconcileInterruptedAtStartup() {
    let changed = false;
    for (const [id, rawSession] of records.entries()) {
      const session = normaliseStoredSession(rawSession, now);
      if (!session) {
        records.delete(id);
        changed = true;
        continue;
      }
      if (session.status === "running") {
        session.status = "interrupted";
        session.stopReason = "core_restart";
        session.interruptedAt = nowIso(now);
        session.resumeAvailable = canResume(session);
        session.updatedAt = nowIso(now);
        changed = true;
      }
      if (JSON.stringify(rawSession) !== JSON.stringify(session)) changed = true;
      records.set(session.id, session);
    }
    if (changed) persistDurably();
    return listPublic();
  }

  function markTaskInterrupted(task, { recoverable = false } = {}) {
    const taskId = safeId(task?.id);
    if (!taskId) return [];
    const changed = [];
    for (const session of records.values()) {
      if (session.lastTaskId !== taskId) continue;
      session.status = "interrupted";
      session.stopReason = "task_execution_interrupted";
      session.interruptedAt = session.interruptedAt ?? nowIso(now);
      session.endedAt = session.endedAt ?? nowIso(now);
      session.recovery = {
        required: true,
        recoverable: recoverable === true || task.restorable === true,
        sourceTaskId: taskId,
        recoveredTaskId: null,
        phase: safeText(task.executionPhase) ?? "running",
        action: recoverable === true || task.restorable === true
          ? "recover_task_after_core_restart"
          : "review_interrupted_task",
        automaticReplay: false,
      };
      session.resumeAvailable = false;
      touch(session);
      changed.push(session);
    }
    if (changed.length > 0) persistDurably();
    return changed.map(publicSession);
  }

  function markTaskRecovered(sourceTaskId, recoveredTaskId) {
    const sourceId = safeId(sourceTaskId);
    const recoveredId = safeId(recoveredTaskId);
    if (!sourceId || !recoveredId) return [];
    const changed = [];
    for (const session of records.values()) {
      if (session.recovery?.sourceTaskId !== sourceId || session.recovery.required !== true) continue;
      session.recovery = {
        ...session.recovery,
        required: false,
        recoveredTaskId: recoveredId,
        action: null,
        automaticReplay: false,
      };
      session.lastTaskId = recoveredId;
      session.stopReason = "task_recovery_ready";
      session.resumeAvailable = canResume(session) && session.remainingSteps > 0;
      touch(session);
      changed.push(session);
    }
    if (changed.length > 0) persistDurably();
    return changed.map(publicSession);
  }

  function interruptedTaskIds() {
    return [...records.values()]
      .filter((session) => session.status === "interrupted" && safeId(session.lastTaskId))
      .map((session) => session.lastTaskId);
  }

  function beginResume(sessionId) {
    if (activeSession()) {
      throw new Error("A bounded operator run is already active.");
    }
    const session = get(sessionId);
    if (!session || !RESUMABLE_STATUSES.has(session.status) || session.remainingSteps < 1) {
      throw new Error("Bounded operator session is not resumable.");
    }
    if (session.recovery?.required === true) {
      throw new Error("Bounded operator session requires explicit task recovery first.");
    }
    session.status = "running";
    session.resumeCount += 1;
    session.resumedAt = nowIso(now);
    session.interruptedAt = null;
    session.endedAt = null;
    session.stopReason = null;
    session.resumeAvailable = false;
    touch(session);
    persistDurably();
    return session;
  }

  function executionHooks(sessionId) {
    return {
      onTaskStart: async (task) => {
        markTaskStarted(sessionId, task);
      },
      onStep: async (step) => {
        markStep(sessionId, step?.task?.id);
      },
    };
  }

  function publicById(sessionId) {
    return publicSession(get(sessionId));
  }

  function listPublic(limit = OPERATOR_RUN_SESSION_MAX_ENTRIES) {
    const boundedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(OPERATOR_RUN_SESSION_MAX_ENTRIES, limit)) : 10;
    return [...records.values()]
      .map((session) => normaliseStoredSession(session, now))
      .filter(Boolean)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, boundedLimit)
      .map(publicSession);
  }

  return {
    create,
    get,
    markStep,
    markTaskStarted,
    reconcileCompletedTaskCheckpoint,
    finish,
    interrupt,
    reconcileInterruptedAtStartup,
    markTaskInterrupted,
    markTaskRecovered,
    interruptedTaskIds,
    beginResume,
    executionHooks,
    publicById,
    listPublic,
  };
}
