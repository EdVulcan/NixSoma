const REGISTRY = "openclaw-kernel-process-lifecycle-snapshot-v0";

function compactContinuity(readback) {
  const continuity = readback?.continuity ?? {};
  return {
    status: continuity.status ?? "not_available",
    captureSequence: Number.isInteger(continuity.captureSequence) ? continuity.captureSequence : null,
    currentActivity: continuity.currentActivity ?? null,
    newCommCount: Number.isInteger(continuity.newCommCount) ? continuity.newCommCount : 0,
  };
}

function compactLane(capture) {
  const readback = capture?.readback ?? {};
  return {
    registry: typeof capture?.registry === "string" ? capture.registry : null,
    status: typeof capture?.status === "string" ? capture.status : "unavailable",
    available: capture?.available === true,
    eventCount: Number.isInteger(capture?.eventCount) ? capture.eventCount : 0,
    uniqueCommCount: Number.isInteger(readback.uniqueCommCount) ? readback.uniqueCommCount : 0,
    uniquePidCount: Number.isInteger(readback.uniquePidCount) ? readback.uniquePidCount : 0,
    uniqueUidCount: Number.isInteger(readback.uniqueUidCount) ? readback.uniqueUidCount : 0,
    continuity: compactContinuity(readback),
    rawEventsIncluded: false,
    processNamesIncluded: false,
    executableIdentityIncluded: false,
  };
}

function envelope({ status, lanes = null }) {
  const values = lanes ? Object.values(lanes) : [];
  return {
    ok: true,
    registry: REGISTRY,
    mode: "explicit_bounded_read_only",
    status,
    laneCount: 2,
    availableLaneCount: values.filter((lane) => lane.available).length,
    eventCount: values.reduce((total, lane) => total + lane.eventCount, 0),
    lanes,
    boundary: {
      simultaneousCapture: true,
      singleFlight: true,
      rawEventsIncluded: false,
      processNamesIncluded: false,
      pidValuesIncluded: false,
      uidValuesIncluded: false,
      executableIdentityIncluded: false,
      persisted: false,
      automaticRepeat: false,
      providerActivity: false,
      browserActivity: false,
      policyExecution: false,
      hostMutation: false,
    },
  };
}

export function createKernelProcessLifecycleSnapshot({ captureProcessExec, captureProcessExit } = {}) {
  if (typeof captureProcessExec !== "function" || typeof captureProcessExit !== "function") {
    throw new Error("Kernel process lifecycle snapshot requires process-exec and process-exit capture owners.");
  }
  let active = null;

  async function captureNow() {
    const [processExec, processExit] = await Promise.all([captureProcessExec(), captureProcessExit()]);
    const lanes = { processExec: compactLane(processExec), processExit: compactLane(processExit) };
    const availableLaneCount = Object.values(lanes).filter((lane) => lane.available).length;
    return envelope({
      status: availableLaneCount === 2 ? "complete" : availableLaneCount > 0 ? "partial" : "unavailable",
      lanes,
    });
  }

  async function capture() {
    if (active) return envelope({ status: "busy" });
    active = captureNow();
    try { return await active; } finally { active = null; }
  }

  return { capture };
}

export const KERNEL_PROCESS_LIFECYCLE_SNAPSHOT_REGISTRY = REGISTRY;
