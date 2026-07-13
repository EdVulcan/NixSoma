import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKernelProcessExecReadback,
  KERNEL_PROCESS_EXEC_READBACK_REGISTRY,
} from "../src/kernel-process-exec-readback.mjs";

test("kernel process exec readback summarizes bounded identity fields", () => {
  const readback = buildKernelProcessExecReadback({
    events: [
      { timestampNs: "10", pid: 10, uid: 1000, comm: "node" },
      { timestampNs: "11", pid: 11, uid: 1000, comm: "true" },
      { timestampNs: "12", pid: 12, uid: 1001, comm: "node" },
    ],
    captureWindowMs: 1000,
    eventLimit: 128,
  });

  assert.equal(readback.registry, KERNEL_PROCESS_EXEC_READBACK_REGISTRY);
  assert.equal(readback.mode, "bounded_in_memory_summary");
  assert.equal(readback.source, "current_capture");
  assert.equal(readback.persisted, false);
  assert.equal(readback.eventCount, 3);
  assert.equal(readback.uniqueCommCount, 2);
  assert.equal(readback.uniquePidCount, 3);
  assert.equal(readback.uniqueUidCount, 2);
  assert.deepEqual(readback.commCounts, [
    { comm: "node", count: 2 },
    { comm: "true", count: 1 },
  ]);
  assert.equal(readback.commCountsTruncated, false);
  assert.equal(readback.firstTimestampNs, "10");
  assert.equal(readback.lastTimestampNs, "12");
  assert.equal(readback.captureWindowMs, 1000);
  assert.equal(readback.eventLimit, 128);
});

test("kernel process exec readback caps command summary entries", () => {
  const events = Array.from({ length: 17 }, (_, index) => ({
    timestampNs: String(index + 1),
    pid: index + 1,
    uid: 1000,
    comm: "proc-" + String(index).padStart(2, "0"),
  }));

  const readback = buildKernelProcessExecReadback({ events });

  assert.equal(readback.uniqueCommCount, 17);
  assert.equal(readback.commCounts.length, 16);
  assert.equal(readback.commCountsTruncated, true);
  assert.equal(readback.persisted, false);
});
