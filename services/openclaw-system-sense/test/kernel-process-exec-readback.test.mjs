import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKernelProcessExecReadback,
  buildKernelProcessExecExecutableIdentityReadback,
  createKernelProcessExecReadback,
  KERNEL_PROCESS_EXEC_CONTINUITY_REGISTRY,
  KERNEL_PROCESS_EXEC_EXECUTABLE_IDENTITY_REGISTRY,
  KERNEL_PROCESS_EXEC_READBACK_REGISTRY,
} from "../src/kernel-process-exec-readback.mjs";

test("kernel process exec readback summarizes bounded identity fields", () => {
  const readback = buildKernelProcessExecReadback({
    events: [
      { timestampNs: "10", pid: 10, uid: 1000, comm: "node" },
      { timestampNs: "11", pid: 11, uid: 1000, comm: "true" },
      { timestampNs: "12", pid: 12, uid: 1001, comm: "node" },
    ],
    executableIdentities: [
      { timestampNs: "10", pid: 10, uid: 1000, comm: "node", executable: "/usr/bin/node" },
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
  assert.equal(readback.executableIdentity.registry, KERNEL_PROCESS_EXEC_EXECUTABLE_IDENTITY_REGISTRY);
  assert.equal(readback.executableIdentity.identityCount, 1);
  assert.deepEqual(readback.executableIdentity.entries, [
    { timestampNs: "10", pid: 10, uid: 1000, comm: "node", executable: "/usr/bin/node" },
  ]);
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

test("kernel process exec executable identity readback stays bounded and in memory", () => {
  const identities = Array.from({ length: 17 }, (_, index) => ({
    timestampNs: String(index + 1),
    pid: index + 1,
    uid: 1000,
    comm: "proc",
    executable: "/nix/store/proc-" + String(index),
  }));
  const readback = buildKernelProcessExecExecutableIdentityReadback({ identities });

  assert.equal(readback.registry, KERNEL_PROCESS_EXEC_EXECUTABLE_IDENTITY_REGISTRY);
  assert.equal(readback.mode, "bounded_in_memory_executable_identity");
  assert.equal(readback.persisted, false);
  assert.equal(readback.identityCount, 17);
  assert.equal(readback.entries.length, 16);
  assert.equal(readback.entriesTruncated, true);
});

test("kernel process exec continuity reports new comm activity without persistence", () => {
  const buildReadback = createKernelProcessExecReadback();

  const first = buildReadback({
    events: [
      { timestampNs: "10", pid: 10, uid: 1000, comm: "node" },
      { timestampNs: "11", pid: 11, uid: 1000, comm: "node" },
    ],
    captureStatus: "captured",
  });
  const second = buildReadback({
    events: [
      { timestampNs: "12", pid: 12, uid: 1000, comm: "node" },
      { timestampNs: "13", pid: 13, uid: 1000, comm: "true" },
    ],
    captureStatus: "captured",
  });
  const unavailable = buildReadback({
    events: [],
    captureStatus: "permission_denied",
  });

  assert.equal(first.continuity.registry, KERNEL_PROCESS_EXEC_CONTINUITY_REGISTRY);
  assert.equal(first.continuity.status, "first_capture");
  assert.equal(first.continuity.captureSequence, 1);
  assert.equal(first.continuity.currentActivity, "events_observed");
  assert.deepEqual(first.continuity.newCommNames, ["node"]);
  assert.equal(first.continuity.persisted, false);
  assert.equal(second.continuity.status, "continued");
  assert.equal(second.continuity.captureSequence, 2);
  assert.equal(second.continuity.previousCaptureSequence, 1);
  assert.deepEqual(second.continuity.newCommNames, ["true"]);
  assert.equal(second.continuity.newCommCount, 1);
  assert.equal(second.continuity.persisted, false);
  assert.equal(unavailable.continuity.status, "not_available");
  assert.equal(unavailable.continuity.reason, "permission_denied");
  assert.equal(unavailable.continuity.captureSequence, null);
  assert.equal(unavailable.continuity.lastCaptureSequence, 2);
});
