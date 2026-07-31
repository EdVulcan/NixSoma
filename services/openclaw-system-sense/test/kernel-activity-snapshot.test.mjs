import assert from "node:assert/strict";
import test from "node:test";

import { createKernelActivitySnapshot } from "../src/kernel-activity-snapshot.mjs";

function capture(registry, overrides = {}) {
  return {
    registry,
    status: "captured",
    available: true,
    eventCount: 2,
    events: [{ comm: "private-name", path: "/private/path" }],
    readback: {
      uniqueCommCount: 1,
      uniquePidCount: 1,
      uniqueUidCount: 1,
      continuity: { status: "baseline", captureSequence: 1, currentActivity: "observed", newCommCount: 1 },
    },
    ...overrides,
  };
}

test("kernel activity snapshot combines three captures without raw metadata", async () => {
  const snapshot = createKernelActivitySnapshot({
    captureProcessExec: async () => capture("openclaw-kernel-process-exec-v0", {
      readback: { uniqueCommCount: 2, uniquePidCount: 2, uniqueUidCount: 1, executableIdentity: { entries: ["/private/bin"] }, continuity: { status: "first_capture", captureSequence: 1, currentActivity: "process_exec_observed", newCommCount: 2 } },
    }),
    captureNetworkConnect: async () => capture("openclaw-kernel-network-connect-v0", {
      readback: { uniqueCommCount: 1, uniquePidCount: 1, uniqueUidCount: 1, uniqueFamilyCount: 2, continuity: { status: "first_capture", captureSequence: 1, currentActivity: "connect_attempts_observed", newCommCount: 1 } },
    }),
    captureFileOpen: async () => capture("openclaw-kernel-file-open-v0", {
      readback: { uniqueCommCount: 1, uniquePidCount: 1, uniqueUidCount: 1, uniqueFlagCount: 3, continuity: { status: "baseline", captureSequence: 1, currentActivity: "file_open_attempts_observed", newCommCount: 1 } },
    }),
  });

  const result = await snapshot.capture();
  assert.equal(result.status, "complete");
  assert.equal(result.availableLaneCount, 3);
  assert.equal(result.eventCount, 6);
  assert.equal(result.lanes.networkConnect.uniqueFamilyCount, 2);
  assert.equal(result.lanes.fileOpen.uniqueFlagCount, 3);
  assert.equal(result.boundary.rawEventsIncluded, false);
  assert.equal(result.boundary.persisted, false);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes("events"), false);
  assert.deepEqual(Object.keys(result.lanes), ["processExec", "networkConnect", "fileOpen"]);
});

test("kernel activity snapshot reports partial and serialises aggregate requests", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const snapshot = createKernelActivitySnapshot({
    captureProcessExec: async () => { await pending; return capture("process"); },
    captureNetworkConnect: async () => capture("network", { status: "busy", available: false, eventCount: 0 }),
    captureFileOpen: async () => capture("file"),
  });

  const first = snapshot.capture();
  assert.equal((await snapshot.capture()).status, "busy");
  release();
  const result = await first;
  assert.equal(result.status, "partial");
  assert.equal(result.availableLaneCount, 2);
  assert.equal(result.lanes.networkConnect.status, "busy");
});
