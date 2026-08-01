import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKernelProcessExitReadback,
  createKernelProcessExitReadback,
} from "../src/kernel-process-exit-readback.mjs";

test("kernel process-exit readback keeps bounded counts without names or raw events", () => {
  const readback = buildKernelProcessExitReadback({
    events: [
      { timestampNs: "1", pid: 1, uid: 1000, comm: "worker" },
      { timestampNs: "2", pid: 2, uid: 1000, comm: "worker" },
    ],
    captureWindowMs: 1000,
    eventLimit: 128,
  });
  assert.equal(readback.registry, "openclaw-kernel-process-exit-readback-v0");
  assert.equal(readback.eventCount, 2);
  assert.equal(readback.uniqueCommCount, 1);
  assert.equal(readback.uniquePidCount, 2);
  assert.equal(readback.persisted, false);
  assert.equal("commCounts" in readback, false);
  assert.equal("events" in readback, false);
});

test("kernel process-exit continuity reports bounded activity without exposing names", () => {
  const build = createKernelProcessExitReadback();
  const first = build({
    events: [{ timestampNs: "1", pid: 1, uid: 1000, comm: "worker" }],
    captureStatus: "captured",
  });
  const second = build({ events: [], captureStatus: "captured" });
  assert.equal(first.continuity.currentActivity, "process_exits_observed");
  assert.equal(first.continuity.newCommCount, 1);
  assert.equal(second.continuity.status, "continued");
  assert.equal(second.continuity.currentActivity, "no_process_exits_observed");
  assert.equal(second.continuity.newCommNamesIncluded, false);
  assert.equal("newCommNames" in second.continuity, false);
});
