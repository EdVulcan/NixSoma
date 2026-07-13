const REGISTRY = "openclaw-kernel-process-exec-readback-v0";
const CONTINUITY_REGISTRY = "openclaw-kernel-process-exec-continuity-v0";
const EXECUTABLE_IDENTITY_REGISTRY = "openclaw-kernel-process-exec-executable-identity-v0";
const MAX_COMMAND_SUMMARY_ENTRIES = 16;
const MAX_EXECUTABLE_IDENTITY_ENTRIES = 16;
const MAX_NEW_COMM_NAMES = 16;
const MAX_TRACKED_COMM_NAMES = 64;

export function buildKernelProcessExecReadback({
  events = [],
  executableIdentities = [],
  captureWindowMs = null,
  eventLimit = null,
} = {}) {
  const commCounts = new Map();
  const pids = new Set();
  const uids = new Set();

  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }
    if (typeof event.comm === "string") {
      commCounts.set(event.comm, (commCounts.get(event.comm) ?? 0) + 1);
    }
    if (Number.isInteger(event.pid)) {
      pids.add(event.pid);
    }
    if (Number.isInteger(event.uid)) {
      uids.add(event.uid);
    }
  }

  const sortedCommCounts = [...commCounts.entries()]
    .sort(([leftComm, leftCount], [rightComm, rightCount]) => (
      rightCount - leftCount || (leftComm < rightComm ? -1 : leftComm > rightComm ? 1 : 0)
    ));

  return {
    registry: REGISTRY,
    mode: "bounded_in_memory_summary",
    source: "current_capture",
    persisted: false,
    eventCount: events.length,
    uniqueCommCount: commCounts.size,
    uniquePidCount: pids.size,
    uniqueUidCount: uids.size,
    commCounts: sortedCommCounts
      .slice(0, MAX_COMMAND_SUMMARY_ENTRIES)
      .map(([comm, count]) => ({ comm, count })),
    commCountsTruncated: sortedCommCounts.length > MAX_COMMAND_SUMMARY_ENTRIES,
    firstTimestampNs: events[0]?.timestampNs ?? null,
    lastTimestampNs: events.at(-1)?.timestampNs ?? null,
    captureWindowMs,
    eventLimit,
    executableIdentity: buildKernelProcessExecExecutableIdentityReadback({
      identities: executableIdentities,
    }),
  };
}

function sortedUniqueCommNames(events) {
  return [...new Set(events
    .filter((event) => event && typeof event.comm === "string")
    .map((event) => event.comm))]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function buildKernelProcessExecExecutableIdentityReadback({ identities = [] } = {}) {
  const boundedIdentities = Array.isArray(identities)
    ? identities.slice(0, MAX_EXECUTABLE_IDENTITY_ENTRIES)
    : [];
  return {
    registry: EXECUTABLE_IDENTITY_REGISTRY,
    mode: "bounded_in_memory_executable_identity",
    persisted: false,
    identityCount: Array.isArray(identities) ? identities.length : 0,
    entries: boundedIdentities,
    entriesTruncated: Array.isArray(identities) && identities.length > MAX_EXECUTABLE_IDENTITY_ENTRIES,
    entryLimit: MAX_EXECUTABLE_IDENTITY_ENTRIES,
  };
}

function buildUnavailableContinuity({ captureStatus, previous }) {
  return {
    registry: CONTINUITY_REGISTRY,
    mode: "bounded_in_memory_continuity",
    status: "not_available",
    reason: captureStatus,
    persisted: false,
    captureSequence: null,
    lastCaptureSequence: previous?.sequence ?? null,
    previousCaptureSequence: previous?.sequence ?? null,
    currentActivity: null,
    previousActivity: previous?.activity ?? null,
    activityChanged: null,
    currentEventCount: 0,
    previousEventCount: previous?.eventCount ?? null,
    newCommNames: [],
    newCommCount: 0,
    newCommNamesTruncated: false,
    trackedCommCount: previous?.commNames.size ?? 0,
    trackedCommLimit: MAX_TRACKED_COMM_NAMES,
    trackingTruncated: false,
  };
}

export function createKernelProcessExecReadback({
  maxTrackedCommNames = MAX_TRACKED_COMM_NAMES,
} = {}) {
  const boundedTrackedCommNames = Math.max(
    1,
    Math.min(Number.parseInt(String(maxTrackedCommNames), 10) || MAX_TRACKED_COMM_NAMES, MAX_TRACKED_COMM_NAMES),
  );
  let captureSequence = 0;
  let previous = null;

  return ({
    events = [],
    executableIdentities = [],
    captureWindowMs = null,
    eventLimit = null,
    captureStatus = "captured",
  } = {}) => {
    const readback = buildKernelProcessExecReadback({
      events,
      executableIdentities,
      captureWindowMs,
      eventLimit,
    });
    if (captureStatus !== "captured") {
      return {
        ...readback,
        continuity: buildUnavailableContinuity({ captureStatus, previous }),
      };
    }

    captureSequence += 1;
    const currentCommNames = sortedUniqueCommNames(events);
    const currentActivity = events.length > 0 ? "events_observed" : "quiet";
    const newCommNames = previous
      ? currentCommNames.filter((comm) => !previous.commNames.has(comm))
      : currentCommNames;
    const continuity = {
      registry: CONTINUITY_REGISTRY,
      mode: "bounded_in_memory_continuity",
      status: previous ? "continued" : "first_capture",
      reason: null,
      persisted: false,
      captureSequence,
      lastCaptureSequence: captureSequence,
      previousCaptureSequence: previous?.sequence ?? null,
      currentActivity,
      previousActivity: previous?.activity ?? null,
      activityChanged: previous ? previous.activity !== currentActivity : null,
      currentEventCount: events.length,
      previousEventCount: previous?.eventCount ?? null,
      newCommNames: newCommNames.slice(0, MAX_NEW_COMM_NAMES),
      newCommCount: newCommNames.length,
      newCommNamesTruncated: newCommNames.length > MAX_NEW_COMM_NAMES,
      trackedCommCount: Math.min(currentCommNames.length, boundedTrackedCommNames),
      trackedCommLimit: boundedTrackedCommNames,
      trackingTruncated: currentCommNames.length > boundedTrackedCommNames,
    };
    previous = {
      sequence: captureSequence,
      activity: currentActivity,
      eventCount: events.length,
      commNames: new Set(currentCommNames.slice(0, boundedTrackedCommNames)),
    };
    return { ...readback, continuity };
  };
}

export const KERNEL_PROCESS_EXEC_READBACK_REGISTRY = REGISTRY;
export const KERNEL_PROCESS_EXEC_CONTINUITY_REGISTRY = CONTINUITY_REGISTRY;
export const KERNEL_PROCESS_EXEC_EXECUTABLE_IDENTITY_REGISTRY = EXECUTABLE_IDENTITY_REGISTRY;
