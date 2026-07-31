import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKernelNetworkConnectReadback,
  createKernelNetworkConnectReadback,
  KERNEL_NETWORK_CONNECT_CONTINUITY_REGISTRY,
  KERNEL_NETWORK_CONNECT_READBACK_REGISTRY,
} from "../src/kernel-network-connect-readback.mjs";

test("kernel network-connect readback summarizes process and address-family metadata", () => {
  const readback = buildKernelNetworkConnectReadback({
    events: [
      { timestampNs: "10", pid: 10, uid: 1000, comm: "curl", family: 2, addressLength: 16 },
      { timestampNs: "11", pid: 11, uid: 1000, comm: "curl", family: 2, addressLength: 16 },
      { timestampNs: "12", pid: 12, uid: 1001, comm: "node", family: 10, addressLength: 28 },
    ],
    captureWindowMs: 1000,
    eventLimit: 128,
  });

  assert.equal(readback.registry, KERNEL_NETWORK_CONNECT_READBACK_REGISTRY);
  assert.equal(readback.mode, "bounded_in_memory_summary");
  assert.equal(readback.persisted, false);
  assert.equal(readback.eventCount, 3);
  assert.equal(readback.uniqueCommCount, 2);
  assert.equal(readback.uniqueFamilyCount, 2);
  assert.equal(readback.uniquePidCount, 3);
  assert.equal(readback.uniqueUidCount, 2);
  assert.deepEqual(readback.commCounts, [
    { comm: "curl", count: 2 },
    { comm: "node", count: 1 },
  ]);
  assert.deepEqual(readback.familyCounts, [
    { family: 2, count: 2 },
    { family: 10, count: 1 },
  ]);
  assert.equal(readback.destinationCaptured, false);
  assert.equal(readback.portCaptured, false);
  assert.equal(readback.networkPayloadCaptured, false);
});

test("kernel network-connect readback continuity stays in memory", () => {
  const buildReadback = createKernelNetworkConnectReadback();
  const first = buildReadback({
    events: [{ timestampNs: "10", pid: 10, uid: 1000, comm: "curl", family: 2, addressLength: 16 }],
    captureStatus: "captured",
  });
  const second = buildReadback({
    events: [{ timestampNs: "11", pid: 11, uid: 1000, comm: "node", family: 10, addressLength: 28 }],
    captureStatus: "captured",
  });
  const unavailable = buildReadback({
    events: [],
    captureStatus: "permission_denied",
  });

  assert.equal(first.continuity.registry, KERNEL_NETWORK_CONNECT_CONTINUITY_REGISTRY);
  assert.equal(first.continuity.status, "first_capture");
  assert.equal(first.continuity.currentActivity, "connect_attempts_observed");
  assert.deepEqual(first.continuity.newCommNames, ["curl"]);
  assert.equal(second.continuity.status, "continued");
  assert.deepEqual(second.continuity.newCommNames, ["node"]);
  assert.equal(unavailable.continuity.status, "not_available");
  assert.equal(unavailable.continuity.reason, "permission_denied");
  assert.equal(unavailable.continuity.lastCaptureSequence, 2);
});
