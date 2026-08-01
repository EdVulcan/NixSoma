import assert from "node:assert/strict";
import test from "node:test";

import { createKernelProcessLifecycleSnapshot } from "../src/kernel-process-lifecycle-snapshot.mjs";

function capture(registry, eventCount, status = "captured") {
  return {
    registry,
    status,
    available: status === "captured",
    eventCount,
    events: [{ pid: 7, uid: 1000, comm: "private-name" }],
    readback: {
      uniqueCommCount: 1,
      uniquePidCount: 1,
      uniqueUidCount: 1,
      continuity: {
        status: "first_capture",
        captureSequence: 1,
        currentActivity: "events_observed",
        newCommCount: 1,
      },
    },
  };
}

test("process lifecycle snapshot combines start and exit lanes without raw metadata", async () => {
  const snapshot = createKernelProcessLifecycleSnapshot({
    captureProcessExec: async () => capture("openclaw-kernel-process-exec-v0", 3),
    captureProcessExit: async () => capture("openclaw-kernel-process-exit-v0", 2),
  });
  const result = await snapshot.capture();
  assert.equal(result.registry, "openclaw-kernel-process-lifecycle-snapshot-v0");
  assert.equal(result.status, "complete");
  assert.equal(result.laneCount, 2);
  assert.equal(result.availableLaneCount, 2);
  assert.equal(result.eventCount, 5);
  assert.equal(result.lanes.processExec.eventCount, 3);
  assert.equal(result.lanes.processExit.eventCount, 2);
  assert.equal(result.boundary.rawEventsIncluded, false);
  assert.equal(result.boundary.processNamesIncluded, false);
  assert.equal(result.boundary.pidValuesIncluded, false);
  assert.equal(result.boundary.hostMutation, false);
  assert.equal("events" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /private-name|"pid"|"uid"/u);
});

test("process lifecycle snapshot reports partial lanes and serialises requests", async () => {
  let resolveExec;
  const pendingExec = new Promise((resolve) => { resolveExec = resolve; });
  const snapshot = createKernelProcessLifecycleSnapshot({
    captureProcessExec: async () => pendingExec,
    captureProcessExit: async () => capture("openclaw-kernel-process-exit-v0", 1, "captured"),
  });
  const first = snapshot.capture();
  const second = await snapshot.capture();
  assert.equal(second.status, "busy");
  resolveExec(capture("openclaw-kernel-process-exec-v0", 0, "unavailable"));
  const result = await first;
  assert.equal(result.status, "partial");
  assert.equal(result.availableLaneCount, 1);
  assert.equal(result.lanes.processExec.available, false);
});
