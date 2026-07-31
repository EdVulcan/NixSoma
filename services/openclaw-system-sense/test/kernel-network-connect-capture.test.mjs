import test from "node:test";
import assert from "node:assert/strict";

import { createKernelNetworkConnectCapture } from "../src/kernel-network-connect-capture.mjs";

const event = {
  timestampNs: "123456789",
  pid: 42,
  uid: 1000,
  comm: "curl",
  family: 2,
  addressLength: 16,
};

test("kernel network-connect capture stays disabled without invoking a probe", async () => {
  let invoked = false;
  const capture = createKernelNetworkConnectCapture({
    execFile: async () => {
      invoked = true;
      return { stdout: "" };
    },
  });

  const result = await capture.capture();

  assert.equal(invoked, false);
  assert.equal(result.status, "disabled");
  assert.equal(result.mode, "read_only");
  assert.deepEqual(result.events, []);
  assert.equal(result.readback.mode, "bounded_in_memory_summary");
  assert.equal(result.readback.continuity.status, "not_available");
  assert.equal(result.readback.continuity.reason, "disabled");
  assert.equal(result.source.destinationCaptured, false);
  assert.equal(result.source.portCaptured, false);
  assert.equal(result.source.networkPayloadCaptured, false);
});

test("kernel network-connect capture validates the bounded metadata contract", async () => {
  let observed = null;
  const capture = createKernelNetworkConnectCapture({
    enabled: true,
    durationMs: 9000,
    maxEvents: 5000,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-network-connect",
    execFile: async (...args) => {
      observed = args;
      return { stdout: JSON.stringify(event) + "\n" };
    },
  });

  const result = await capture.capture();

  assert.equal(result.status, "captured");
  assert.equal(result.available, true);
  assert.equal(result.source.attachment, "fentry");
  assert.equal(result.source.tracepoint, "__sys_connect");
  assert.equal(result.source.familyCaptured, true);
  assert.deepEqual(result.events, [event]);
  assert.deepEqual(result.readback.familyCounts, [{ family: 2, count: 1 }]);
  assert.deepEqual(result.readback.commCounts, [{ comm: "curl", count: 1 }]);
  assert.equal(result.readback.continuity.currentActivity, "connect_attempts_observed");
  assert.equal(result.readback.persisted, false);
  assert.equal(result.readback.destinationCaptured, false);
  assert.equal(result.readback.portCaptured, false);
  assert.equal(result.readback.networkPayloadCaptured, false);
  assert.deepEqual(observed[1], ["--duration-ms", "5000", "--max-events", "4096"]);
  assert.equal(observed[2].timeout, 6000);
});

test("kernel network-connect capture rejects addresses and extra fields", async () => {
  const capture = createKernelNetworkConnectCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-network-connect",
    execFile: async () => ({
      stdout: JSON.stringify({ ...event, destination: "127.0.0.1", port: 4100 }) + "\n",
    }),
  });

  const result = await capture.capture();

  assert.equal(result.status, "invalid_output");
  assert.equal(result.error.code, "invalid_output");
  assert.equal(JSON.stringify(result).includes("127.0.0.1"), false);
  assert.equal(JSON.stringify(result).includes("4100"), false);
});

test("kernel network-connect capture exposes permission failures without probe details", async () => {
  const error = new Error("spawn /secret/network-probe EPERM: operation not permitted");
  error.code = "EPERM";
  error.stderr = "credential-like network diagnostics";
  const capture = createKernelNetworkConnectCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-network-connect",
    execFile: async () => {
      throw error;
    },
  });

  const result = await capture.capture();

  assert.equal(result.status, "permission_denied");
  assert.deepEqual(result.error, {
    code: "permission_denied",
    message: "Kernel network-connect probe permission was denied.",
  });
  assert.equal(JSON.stringify(result).includes("credential-like"), false);
  assert.equal(JSON.stringify(result).includes("/secret/network-probe"), false);
});

test("kernel network-connect capture serialises concurrent requests as busy", async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const capture = createKernelNetworkConnectCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-network-connect",
    execFile: async () => {
      await pending;
      return { stdout: "" };
    },
  });

  const first = capture.capture();
  const second = await capture.capture();
  release();
  const firstResult = await first;

  assert.equal(second.status, "busy");
  assert.equal(second.readback.continuity.reason, "busy");
  assert.equal(firstResult.status, "captured");
});
