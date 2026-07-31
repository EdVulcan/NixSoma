const REGISTRY = "openclaw-kernel-activity-snapshot-v0";

function compactContinuity(readback) {
  const continuity = readback?.continuity ?? {};
  return {
    status: continuity.status ?? "not_available",
    captureSequence: Number.isInteger(continuity.captureSequence) ? continuity.captureSequence : null,
    currentActivity: continuity.currentActivity ?? null,
    newCommCount: Number.isInteger(continuity.newCommCount) ? continuity.newCommCount : 0,
  };
}

function compactLane(capture, kind) {
  const readback = capture?.readback ?? {};
  const lane = {
    registry: typeof capture?.registry === "string" ? capture.registry : null,
    status: typeof capture?.status === "string" ? capture.status : "unavailable",
    available: capture?.available === true,
    eventCount: Number.isInteger(capture?.eventCount) ? capture.eventCount : 0,
    uniqueCommCount: Number.isInteger(readback.uniqueCommCount) ? readback.uniqueCommCount : 0,
    uniquePidCount: Number.isInteger(readback.uniquePidCount) ? readback.uniquePidCount : 0,
    uniqueUidCount: Number.isInteger(readback.uniqueUidCount) ? readback.uniqueUidCount : 0,
    continuity: compactContinuity(readback),
    rawEventsIncluded: false,
  };
  if (kind === "processExec") {
    lane.executableIdentityIncluded = false;
  } else if (kind === "networkConnect") {
    lane.uniqueFamilyCount = Number.isInteger(readback.uniqueFamilyCount) ? readback.uniqueFamilyCount : 0;
    lane.destinationIncluded = false;
    lane.portIncluded = false;
    lane.networkPayloadIncluded = false;
  } else if (kind === "fileOpen") {
    lane.uniqueFlagCount = Number.isInteger(readback.uniqueFlagCount) ? readback.uniqueFlagCount : 0;
    lane.pathIncluded = false;
    lane.filenameIncluded = false;
    lane.contentIncluded = false;
    lane.resultIncluded = false;
  }
  return lane;
}

function snapshotEnvelope({ status, lanes = null }) {
  const values = lanes ? Object.values(lanes) : [];
  return {
    ok: true,
    registry: REGISTRY,
    mode: "explicit_bounded_read_only",
    status,
    laneCount: 3,
    availableLaneCount: values.filter((lane) => lane.available).length,
    eventCount: values.reduce((total, lane) => total + lane.eventCount, 0),
    lanes,
    boundary: {
      simultaneousCapture: true,
      singleFlight: true,
      rawEventsIncluded: false,
      commNamesIncluded: false,
      executableIdentityIncluded: false,
      networkDestinationIncluded: false,
      networkPortIncluded: false,
      networkPayloadIncluded: false,
      filePathIncluded: false,
      fileNameIncluded: false,
      fileContentIncluded: false,
      fileResultIncluded: false,
      persisted: false,
      automaticRepeat: false,
      providerActivity: false,
      browserActivity: false,
      policyExecution: false,
      hostMutation: false,
    },
  };
}

export function createKernelActivitySnapshot({
  captureProcessExec,
  captureNetworkConnect,
  captureFileOpen,
} = {}) {
  for (const capture of [captureProcessExec, captureNetworkConnect, captureFileOpen]) {
    if (typeof capture !== "function") throw new Error("Kernel activity snapshot requires all three capture owners.");
  }
  let active = null;

  async function captureNow() {
    const [processExec, networkConnect, fileOpen] = await Promise.all([
      captureProcessExec(),
      captureNetworkConnect(),
      captureFileOpen(),
    ]);
    const lanes = {
      processExec: compactLane(processExec, "processExec"),
      networkConnect: compactLane(networkConnect, "networkConnect"),
      fileOpen: compactLane(fileOpen, "fileOpen"),
    };
    const availableLaneCount = Object.values(lanes).filter((lane) => lane.available).length;
    return snapshotEnvelope({
      status: availableLaneCount === 3 ? "complete" : availableLaneCount > 0 ? "partial" : "unavailable",
      lanes,
    });
  }

  async function capture() {
    if (active) return snapshotEnvelope({ status: "busy" });
    active = captureNow();
    try { return await active; } finally { active = null; }
  }

  return { capture };
}

export const KERNEL_ACTIVITY_SNAPSHOT_REGISTRY = REGISTRY;
