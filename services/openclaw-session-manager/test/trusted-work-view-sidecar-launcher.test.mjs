import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createTrustedWorkViewSidecarLauncher,
  serializeTrustedSidecarEnvironment,
} from "../src/trusted-work-view-sidecar-launcher.mjs";

function createDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "openclaw-sidecar-launcher-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function boundedEnvironment() {
  return {
    NODE_NO_WARNINGS: "1",
    OPENCLAW_SIDECAR_SOCKET_PATH: "/run/user/1000/openclaw-sidecars/sidecar.sock",
    OPENCLAW_SIDECAR_TASK_ID: "task-sidecar",
    OPENCLAW_SIDECAR_APPROVAL_ID: "approval-sidecar",
    OPENCLAW_SIDECAR_HEARTBEAT_INTERVAL_MS: "250",
    OPENCLAW_SIDECAR_CAPTURE_INTERVAL_MS: "1000",
    OPENCLAW_SIDECAR_RECONNECT_TIMEOUT_MS: "30000",
  };
}

test("systemd user launcher writes one bounded environment and stops the same unit", async (t) => {
  const socketDirectory = createDirectory(t);
  const calls = [];
  const launcher = createTrustedWorkViewSidecarLauncher({
    mode: "systemd-user",
    unitInstance: "primary",
    socketDirectory,
    execFileAsync: async (command, args) => calls.push({ command, args }),
  });

  const launched = await launcher.launch({
    command: process.execPath,
    args: ["ignored-by-fixed-unit.mjs"],
    environment: boundedEnvironment(),
  });
  const contents = readFileSync(launched.environmentFilePath, "utf8");
  assert.equal(launched.launcherMode, "systemd-user");
  assert.equal(launched.unitInstance, "primary");
  assert.equal(launched.unitName, "openclaw-trusted-sidecar@primary.service");
  assert.equal(launched.userManagerOwned, true);
  assert.equal(statSync(launched.environmentFilePath).mode & 0o777, 0o600);
  assert.match(contents, /OPENCLAW_SIDECAR_TASK_ID="task-sidecar"/u);
  assert.match(contents, /OPENCLAW_SIDECAR_APPROVAL_ID="approval-sidecar"/u);
  for (const forbidden of ["SESSION", "LEASE", "CREDENTIAL", "PROVIDER", "BROWSER_RUNTIME_URL", "BROWSER_RUNTIME_AUTH_TOKEN"]) {
    assert.equal(contents.includes(forbidden), false);
  }
  assert.deepEqual(calls, [{
    command: "systemctl",
    args: ["--user", "start", "openclaw-trusted-sidecar@primary.service"],
  }]);

  await launcher.stop();
  assert.equal(calls[1].command, "systemctl");
  assert.deepEqual(calls[1].args, ["--user", "stop", "openclaw-trusted-sidecar@primary.service"]);
  assert.throws(() => statSync(launched.environmentFilePath), /ENOENT/u);
});

test("trusted sidecar launcher rejects authority values outside its environment contract", () => {
  assert.throws(
    () => serializeTrustedSidecarEnvironment({
      ...boundedEnvironment(),
      OPENCLAW_SIDECAR_LEASE_ID: "lease-must-not-persist",
    }),
    /environment key is not allowed/u,
  );
  assert.throws(
    () => serializeTrustedSidecarEnvironment({
      ...boundedEnvironment(),
      OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN: "credential-must-not-persist",
    }),
    /environment key is not allowed/u,
  );
  assert.throws(
    () => serializeTrustedSidecarEnvironment({
      ...boundedEnvironment(),
      OPENCLAW_SIDECAR_TASK_ID: "task\ninvalid",
    }),
    /single-line text/u,
  );
});
