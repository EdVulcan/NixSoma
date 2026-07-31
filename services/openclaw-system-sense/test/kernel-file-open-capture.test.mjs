import assert from "node:assert/strict";
import test from "node:test";

import { createKernelFileOpenCapture } from "../src/kernel-file-open-capture.mjs";

const event = { timestampNs: "123", pid: 42, uid: 1000, comm: "touch", flags: "577", mode: "420" };

test("kernel file-open capture stays disabled without invoking a probe", async () => {
  let invoked = false;
  const capture = createKernelFileOpenCapture({ execFile: async () => { invoked = true; return { stdout: "" }; } });
  const result = await capture.capture();
  assert.equal(invoked, false);
  assert.equal(result.status, "disabled");
  assert.equal(result.source.pathCaptured, false);
  assert.equal(result.source.contentCaptured, false);
  assert.equal(result.readback.continuity.reason, "disabled");
});

test("kernel file-open capture validates only bounded non-path metadata", async () => {
  let observed;
  const capture = createKernelFileOpenCapture({
    enabled: true,
    durationMs: 9000,
    maxEvents: 5000,
    probeCommand: "/nix/store/probe/bin/openclaw-kernel-file-open",
    execFile: async (...args) => { observed = args; return { stdout: `${JSON.stringify(event)}\n` }; },
  });
  const result = await capture.capture();
  assert.equal(result.status, "captured");
  assert.deepEqual(result.events, [event]);
  assert.equal(result.source.tracepoint, "do_sys_openat2");
  assert.equal(result.readback.continuity.currentActivity, "file_open_attempts_observed");
  assert.deepEqual(observed[1], ["--duration-ms", "5000", "--max-events", "4096"]);
});

test("kernel file-open capture rejects path, content, and numeric widening", async () => {
  for (const changed of [
    { ...event, path: "/private/value" },
    { ...event, content: "private-value" },
    { ...event, flags: 577 },
    { ...event, mode: "18446744073709551616" },
  ]) {
    const capture = createKernelFileOpenCapture({
      enabled: true,
      probeCommand: "/nix/store/probe/bin/openclaw-kernel-file-open",
      execFile: async () => ({ stdout: `${JSON.stringify(changed)}\n` }),
    });
    const result = await capture.capture();
    assert.equal(result.status, "invalid_output");
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("kernel file-open capture redacts probe failures and serialises requests", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const capture = createKernelFileOpenCapture({
    enabled: true,
    probeCommand: "/nix/store/private/probe",
    execFile: async () => { await pending; return { stdout: "" }; },
  });
  const first = capture.capture();
  const busy = await capture.capture();
  release();
  assert.equal(busy.status, "busy");
  assert.equal((await first).status, "captured");

  const denied = createKernelFileOpenCapture({
    enabled: true,
    probeCommand: "/nix/store/private/probe",
    execFile: async () => { const error = new Error("private path EPERM"); error.code = "EPERM"; throw error; },
  });
  const result = await denied.capture();
  assert.equal(result.status, "permission_denied");
  assert.equal(JSON.stringify(result).includes("private"), false);
});
