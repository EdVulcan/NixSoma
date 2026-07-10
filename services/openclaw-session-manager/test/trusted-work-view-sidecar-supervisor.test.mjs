import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createTrustedWorkViewSidecarSupervisor } from "../src/trusted-work-view-sidecar-supervisor.mjs";

function createSocketDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "openclaw-sidecar-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function lifecycleInput(overrides = {}) {
  return {
    sessionId: "session-sidecar",
    workViewId: "work-view-primary",
    leaseId: "lease-sidecar",
    taskId: "task-sidecar",
    approvalId: "approval-sidecar",
    approvalStatus: "approved",
    ...overrides,
  };
}

test("trusted work-view sidecar supervisor starts one bounded user-session process and stops it", async (t) => {
  const heartbeats = [];
  const supervisor = createTrustedWorkViewSidecarSupervisor({
    socketDirectory: createSocketDirectory(t),
    heartbeatIntervalMs: 25,
    onHeartbeat: (message) => heartbeats.push(message),
  });

  const running = await supervisor.start(lifecycleInput());
  assert.equal(running.status, "running");
  assert.equal(running.running, true);
  assert.equal(running.sessionManagerOwned, false);
  assert.equal(running.userSessionOwned, true);
  assert.equal(running.authorityConnected, true);
  assert.equal(running.reconnectable, true);
  assert.equal(running.boundedProcess, true);
  assert.equal(running.credentialEnvironmentInherited, false);
  assert.equal(running.rootRequired, false);
  assert.equal(running.providerEgress, false);
  assert.equal(heartbeats.length >= 1, true);

  const stopped = await supervisor.stop({ taskId: "task-sidecar" });
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.running, false);
  assert.equal(stopped.stopped, true);
  assert.equal(stopped.exitCode, 0);
});

test("trusted work-view sidecar survives authority disconnect and explicitly rebinds a fresh session", async (t) => {
  const socketDirectory = createSocketDirectory(t);
  const firstSupervisor = createTrustedWorkViewSidecarSupervisor({ socketDirectory, heartbeatIntervalMs: 25 });
  const first = await firstSupervisor.start(lifecycleInput());

  const disconnected = await firstSupervisor.disconnectAuthority({ taskId: "task-sidecar" });
  assert.equal(disconnected.status, "recovery_required");
  assert.equal(disconnected.running, false);
  assert.equal(disconnected.authorityConnected, false);
  assert.equal(disconnected.pid, first.pid);

  const mismatchedSupervisor = createTrustedWorkViewSidecarSupervisor({ socketDirectory, heartbeatIntervalMs: 25 });
  await assert.rejects(
    () => mismatchedSupervisor.start(lifecycleInput({ approvalId: "approval-mismatch" })),
    /lifecycle identity mismatch/u,
  );
  await new Promise((resolve) => setTimeout(resolve, 25));

  const restartedSupervisor = createTrustedWorkViewSidecarSupervisor({ socketDirectory, heartbeatIntervalMs: 25 });
  const rebound = await restartedSupervisor.start(lifecycleInput({
    sessionId: "session-sidecar-restarted",
    workViewId: "work-view-restarted",
    leaseId: "lease-sidecar-restarted",
  }));
  assert.equal(rebound.status, "running");
  assert.equal(rebound.reconnected, true);
  assert.equal(rebound.pid, first.pid);
  assert.equal(rebound.sessionId, "session-sidecar-restarted");
  assert.equal(rebound.workViewId, "work-view-restarted");

  await restartedSupervisor.stop({ taskId: "task-sidecar" });
});

test("trusted work-view sidecar rejects unapproved process start", async (t) => {
  const supervisor = createTrustedWorkViewSidecarSupervisor({ socketDirectory: createSocketDirectory(t) });
  await assert.rejects(
    () => supervisor.start(lifecycleInput({ approvalStatus: "pending" })),
    /approved lifecycle authority/u,
  );
  assert.equal(supervisor.snapshot().running, false);
});

test("trusted work-view sidecar reports heartbeat timeout without automatic reconnect", async (t) => {
  let resolveFailure;
  const failed = new Promise((resolve) => {
    resolveFailure = resolve;
  });
  const supervisor = createTrustedWorkViewSidecarSupervisor({
    socketDirectory: createSocketDirectory(t),
    heartbeatIntervalMs: 1_000,
    heartbeatTimeoutMs: 50,
    onFailure: resolveFailure,
  });
  const running = await supervisor.start(lifecycleInput({ taskId: "task-timeout", approvalId: "approval-timeout" }));
  const failure = await failed;
  assert.equal(failure.status, "degraded");
  assert.equal(failure.degradedReason, "trusted_sidecar_heartbeat_timeout");
  assert.equal(failure.running, false);
  assert.equal(failure.pid, running.pid);

  await new Promise((resolve) => setTimeout(resolve, 50));
  const explicitlyReconnected = await supervisor.start(lifecycleInput({
    taskId: "task-timeout",
    approvalId: "approval-timeout",
    sessionId: "session-timeout-reconnected",
    workViewId: "work-view-timeout-reconnected",
    leaseId: "lease-timeout-reconnected",
  }));
  assert.equal(explicitlyReconnected.reconnected, true);
  assert.equal(explicitlyReconnected.pid, running.pid);
  await supervisor.stop({ taskId: "task-timeout" });
});

test("trusted work-view sidecar process exit fails closed until explicit replacement", async (t) => {
  let resolveFailure;
  const failed = new Promise((resolve) => {
    resolveFailure = resolve;
  });
  const supervisor = createTrustedWorkViewSidecarSupervisor({
    socketDirectory: createSocketDirectory(t),
    heartbeatIntervalMs: 25,
    onFailure: resolveFailure,
  });
  const running = await supervisor.start(lifecycleInput({ taskId: "task-exit", approvalId: "approval-exit" }));

  process.kill(running.pid, "SIGTERM");
  const failure = await failed;
  assert.equal(failure.running, false);
  assert.match(failure.degradedReason, /trusted_sidecar_stopped_sigterm|trusted_sidecar_exited/u);

  await new Promise((resolve) => setTimeout(resolve, 50));
  const replacement = await supervisor.start(lifecycleInput({
    taskId: "task-exit",
    approvalId: "approval-exit",
    leaseId: "lease-exit-replacement",
  }));
  assert.equal(replacement.reconnected, false);
  assert.notEqual(replacement.pid, running.pid);
  assert.equal(replacement.status, "running");
  await supervisor.stop({ taskId: "task-exit" });
});
