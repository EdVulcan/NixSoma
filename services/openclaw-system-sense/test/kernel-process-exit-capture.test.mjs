import assert from "node:assert/strict";
import test from "node:test";

import { createKernelProcessExitCapture } from "../src/kernel-process-exit-capture.mjs";

const event = { timestampNs: "100", pid: 42, uid: 1000, comm: "worker" };

test("kernel process-exit capture stays disabled without invoking a probe", async () => {
  let called = false;
  const capture = createKernelProcessExitCapture({ enabled: false, execFile: async () => { called = true; } });
  const result = await capture.capture();
  assert.equal(called, false);
  assert.equal(result.status, "disabled");
  assert.equal(result.available, false);
  assert.equal(result.readback.persisted, false);
});

test("kernel process-exit capture validates the bounded event contract", async () => {
  const capture = createKernelProcessExitCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exit",
    durationMs: 50,
    maxEvents: 4,
    execFile: async () => ({ stdout: `${JSON.stringify(event)}\n` }),
  });
  const result = await capture.capture();
  assert.equal(result.status, "captured");
  assert.equal(result.eventCount, 1);
  assert.deepEqual(result.events, [event]);
  assert.equal(result.source.tracepoint, "sched_process_exit");
  assert.equal(result.source.executableCaptured, false);
  assert.equal(result.readback.uniqueCommCount, 1);
  assert.equal(result.readback.continuity.status, "first_capture");
});

test("kernel process-exit capture rejects extra output fields without exposing probe details", async () => {
  const capture = createKernelProcessExitCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exit",
    execFile: async () => ({ stdout: `${JSON.stringify({ ...event, executable: "/private/bin" })}\n` }),
  });
  const result = await capture.capture();
  assert.equal(result.status, "invalid_output");
  assert.equal(result.available, false);
  assert.equal(result.events.length, 0);
  assert.equal(result.error.message, "Kernel process-exit probe returned invalid event data.");
  assert.doesNotMatch(JSON.stringify(result), /private\/bin/u);
});

test("kernel process-exit capture serialises concurrent requests as busy", async () => {
  let resolveProbe;
  const pending = new Promise((resolve) => { resolveProbe = resolve; });
  const capture = createKernelProcessExitCapture({
    enabled: true,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-process-exit",
    execFile: async () => pending,
  });
  const first = capture.capture();
  const second = await capture.capture();
  assert.equal(second.status, "busy");
  resolveProbe({ stdout: "" });
  assert.equal((await first).status, "captured");
});
