const REGISTRY = "openclaw-kernel-file-open-readback-v0";
const CONTINUITY_REGISTRY = "openclaw-kernel-file-open-continuity-v0";

function counts(events, key, outputKey) {
  const values = new Map();
  for (const event of events) values.set(event[key], (values.get(event[key]) ?? 0) + 1);
  return [...values.entries()]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .slice(0, 16)
    .map(([value, count]) => ({ [outputKey]: value, count }));
}

export function buildKernelFileOpenReadback({
  events = [],
  captureWindowMs = 0,
  eventLimit = 0,
  captureStatus = "captured",
  previous = null,
} = {}) {
  const commCounts = counts(events, "comm", "comm");
  const flagCounts = counts(events, "flags", "flags");
  const previousComms = new Set(previous?.commCounts?.map((item) => item.comm) ?? []);
  const newCommCount = commCounts.filter((item) => !previousComms.has(item.comm)).length;
  const available = captureStatus === "captured";
  return {
    registry: REGISTRY,
    mode: "bounded_in_memory_summary",
    eventCount: events.length,
    uniqueCommCount: commCounts.length,
    uniqueFlagCount: flagCounts.length,
    uniquePidCount: new Set(events.map((event) => event.pid)).size,
    uniqueUidCount: new Set(events.map((event) => event.uid)).size,
    commCounts,
    flagCounts,
    captureWindowMs,
    eventLimit,
    pathCaptured: false,
    filenameCaptured: false,
    contentCaptured: false,
    inodeCaptured: false,
    mountCaptured: false,
    resultCaptured: false,
    persisted: false,
    continuity: {
      registry: CONTINUITY_REGISTRY,
      status: available ? (previous ? "compared" : "baseline") : "not_available",
      reason: available ? null : captureStatus,
      captureSequence: (previous?.continuity?.captureSequence ?? 0) + (available ? 1 : 0),
      currentActivity: events.length > 0 ? "file_open_attempts_observed" : "no_file_open_attempts_observed",
      newCommCount,
    },
  };
}

export function createKernelFileOpenReadback() {
  let previous = null;
  return (input) => {
    const readback = buildKernelFileOpenReadback({ ...input, previous });
    if (input.captureStatus === "captured") previous = readback;
    return readback;
  };
}

export const KERNEL_FILE_OPEN_READBACK_REGISTRY = REGISTRY;
export const KERNEL_FILE_OPEN_CONTINUITY_REGISTRY = CONTINUITY_REGISTRY;
