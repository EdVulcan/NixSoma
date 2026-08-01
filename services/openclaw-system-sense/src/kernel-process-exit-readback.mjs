const REGISTRY = "openclaw-kernel-process-exit-readback-v0";
const CONTINUITY_REGISTRY = "openclaw-kernel-process-exit-continuity-v0";
const MAX_NEW_COMM_NAMES = 16;
const MAX_TRACKED_COMM_NAMES = 64;

function sortedUniqueCommNames(events) {
  return [...new Set(events
    .filter((event) => event && typeof event.comm === "string")
    .map((event) => event.comm))]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function buildKernelProcessExitReadback({
  events = [],
  captureWindowMs = null,
  eventLimit = null,
} = {}) {
  const comms = new Set();
  const pids = new Set();
  const uids = new Set();
  for (const event of events) {
    if (typeof event?.comm === "string") comms.add(event.comm);
    if (Number.isInteger(event?.pid)) pids.add(event.pid);
    if (Number.isInteger(event?.uid)) uids.add(event.uid);
  }
  return {
    registry: REGISTRY,
    mode: "bounded_in_memory_summary",
    source: "current_capture",
    persisted: false,
    eventCount: events.length,
    uniqueCommCount: comms.size,
    uniquePidCount: pids.size,
    uniqueUidCount: uids.size,
    captureWindowMs,
    eventLimit,
  };
}

function unavailableContinuity(captureStatus, previous) {
  return {
    registry: CONTINUITY_REGISTRY,
    mode: "bounded_in_memory_continuity",
    status: "not_available",
    reason: captureStatus,
    persisted: false,
    captureSequence: null,
    previousCaptureSequence: previous?.sequence ?? null,
    currentActivity: null,
    previousActivity: previous?.activity ?? null,
    activityChanged: null,
    currentEventCount: 0,
    previousEventCount: previous?.eventCount ?? null,
    newCommCount: 0,
    trackedCommCount: previous?.commNames.size ?? 0,
    trackedCommLimit: MAX_TRACKED_COMM_NAMES,
    trackingTruncated: false,
  };
}

export function createKernelProcessExitReadback({
  maxTrackedCommNames = MAX_TRACKED_COMM_NAMES,
} = {}) {
  const trackedLimit = Math.max(
    1,
    Math.min(Number.parseInt(String(maxTrackedCommNames), 10) || MAX_TRACKED_COMM_NAMES, MAX_TRACKED_COMM_NAMES),
  );
  let captureSequence = 0;
  let previous = null;

  return ({
    events = [],
    captureWindowMs = null,
    eventLimit = null,
    captureStatus = "captured",
  } = {}) => {
    const readback = buildKernelProcessExitReadback({ events, captureWindowMs, eventLimit });
    if (captureStatus !== "captured") {
      return { ...readback, continuity: unavailableContinuity(captureStatus, previous) };
    }

    captureSequence += 1;
    const currentCommNames = sortedUniqueCommNames(events);
    const currentActivity = events.length > 0 ? "process_exits_observed" : "no_process_exits_observed";
    const newCommCount = previous
      ? currentCommNames.filter((comm) => !previous.commNames.has(comm)).length
      : currentCommNames.length;
    const continuity = {
      registry: CONTINUITY_REGISTRY,
      mode: "bounded_in_memory_continuity",
      status: previous ? "continued" : "first_capture",
      reason: null,
      persisted: false,
      captureSequence,
      previousCaptureSequence: previous?.sequence ?? null,
      currentActivity,
      previousActivity: previous?.activity ?? null,
      activityChanged: previous ? previous.activity !== currentActivity : null,
      currentEventCount: events.length,
      previousEventCount: previous?.eventCount ?? null,
      newCommCount,
      newCommNamesIncluded: false,
      newCommNamesLimit: MAX_NEW_COMM_NAMES,
      trackedCommCount: Math.min(currentCommNames.length, trackedLimit),
      trackedCommLimit: trackedLimit,
      trackingTruncated: currentCommNames.length > trackedLimit,
    };
    previous = {
      sequence: captureSequence,
      activity: currentActivity,
      eventCount: events.length,
      commNames: new Set(currentCommNames.slice(0, trackedLimit)),
    };
    return { ...readback, continuity };
  };
}

export const KERNEL_PROCESS_EXIT_READBACK_REGISTRY = REGISTRY;
export const KERNEL_PROCESS_EXIT_CONTINUITY_REGISTRY = CONTINUITY_REGISTRY;
