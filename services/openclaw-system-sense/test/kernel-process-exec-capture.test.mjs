import test from "node:test";
import assert from "node:assert/strict";

import { createKernelProcessExecCapture } from "../src/kernel-process-exec-capture.mjs";

const event = {
  timestampNs: "123456789",
  pid: 42,
  uid: 1000,
  comm: "node",
  executable: "/nix/store/example/bin/node",
};

const rawEvent = {
  timestampNs: event.timestampNs,
  pid: event.pid,
  uid: event.uid,
  comm: event.comm,
};

test("kernel process exec capture stays disabled without invoking a probe", async () => {
  let invoked = false;
  const capture = createKernelProcessExecCapture({
    execFile: async () => {
      invoked = true;
      return { stdout: "" };
    },
  });

  const result = await capture.capture();

  assert.equal(invoked, false);
  assert.equal(result.ok, true);
  assert.equal(result.status, "disabled");
  assert.equal(result.mode, "read_only");
  assert.deepEqual(result.events, []);
  assert.equal(result.readback.mode, "bounded_in_memory_summary");
  assert.equal(result.readback.captureWindowMs, 1000);
  assert.equal(result.readback.eventLimit, 128);
  assert.equal(result.readback.continuity.status, "not_available");
  assert.equal(result.readback.continuity.reason, "disabled");
  assert.equal(result.source.commandLineCaptured, false);
  assert.equal(result.source.persisted, false);
});

test("kernel process exec capture validates bounded JSON Lines output", async () => {
  let observed = null;
  const capture = createKernelProcessExecCapture({
    enabled: true,
    durationMs: 9000,
    maxEvents: 5000,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exec",
    execFile: async (...args) => {
      observed = args;
      return { stdout: `${JSON.stringify(event)}\n` };
    },
  });

  const result = await capture.capture();

  assert.equal(result.status, "captured");
  assert.equal(result.available, true);
  assert.equal(result.eventCount, 1);
  assert.deepEqual(result.events, [rawEvent]);
  assert.equal(result.executableIdentityCount, 1);
  assert.deepEqual(result.readback.executableIdentity.entries, [event]);
  assert.equal(result.readback.executableIdentity.identityCount, 1);
  assert.deepEqual(result.readback.commCounts, [{ comm: "node", count: 1 }]);
  assert.equal(result.readback.persisted, false);
  assert.equal(result.readback.continuity.status, "first_capture");
  assert.equal(result.readback.continuity.captureSequence, 1);
  assert.equal(result.readback.continuity.currentActivity, "events_observed");
  assert.deepEqual(observed[1], ["--duration-ms", "5000", "--max-events", "4096"]);
  assert.equal(observed[2].timeout, 6000);
  assert.equal(observed[2].killSignal, "SIGTERM");
});

test("kernel process exec capture exposes permission failure without raw probe output", async () => {
  const error = new Error("spawn /secret/probe EPERM: operation not permitted");
  error.code = "EPERM";
  error.stderr = "credential-like probe diagnostics";
  const capture = createKernelProcessExecCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exec",
    execFile: async () => {
      throw error;
    },
  });

  const result = await capture.capture();

  assert.equal(result.status, "permission_denied");
  assert.equal(result.available, false);
  assert.deepEqual(result.error, {
    code: "permission_denied",
    message: "Kernel process-exec probe permission was denied.",
  });
  assert.equal(JSON.stringify(result).includes("credential-like"), false);
  assert.equal(JSON.stringify(result).includes("/secret/probe"), false);
});

test("kernel process exec capture rejects output outside the field contract", async () => {
  const capture = createKernelProcessExecCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exec",
    execFile: async () => ({
      stdout: `${JSON.stringify({ ...event, path: "/secret" })}\n`,
    }),
  });

  const result = await capture.capture();

  assert.equal(result.status, "invalid_output");
  assert.equal(result.error.code, "invalid_output");
  assert.equal(result.readback.eventCount, 0);
  assert.equal(result.readback.continuity.status, "not_available");
  assert.equal(result.readback.continuity.reason, "invalid_output");
});

test("kernel process exec capture serialises concurrent requests as busy", async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const capture = createKernelProcessExecCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exec",
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
  assert.equal(second.readback.continuity.status, "not_available");
  assert.equal(second.readback.continuity.reason, "busy");
  assert.equal(firstResult.status, "captured");
});
