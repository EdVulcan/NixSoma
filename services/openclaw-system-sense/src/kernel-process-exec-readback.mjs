const REGISTRY = "openclaw-kernel-process-exec-readback-v0";
const MAX_COMMAND_SUMMARY_ENTRIES = 16;

export function buildKernelProcessExecReadback({
  events = [],
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
  };
}

export const KERNEL_PROCESS_EXEC_READBACK_REGISTRY = REGISTRY;
