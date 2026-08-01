import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY,
  createBoundedOperatorWindowLease,
} from "../src/bounded-operator-window-lease.mjs";

function createHarness({ run = async () => ({ ran: true, steps: [{}], blocked: false }) } = {}) {
  const records = new Map();
  let persistCount = 0;
  let timestamp = "2026-08-01T13:00:00.000Z";
  const manager = createBoundedOperatorWindowLease({
    records,
    run,
    persistState: () => { persistCount += 1; },
    now: () => timestamp,
    enabled: false,
  });
  return {
    manager,
    records,
    setTimestamp: (value) => { timestamp = value; },
    get persistCount() { return persistCount; },
  };
}

test("window lease requires explicit finite budget and deadline", () => {
  const { manager } = createHarness();
  assert.throws(() => manager.arm({ windowCount: 2, maxStepsPerWindow: 1, deadlineMs: 60_000 }), /confirm=true/u);
  const lease = manager.arm({
    windowCount: 8,
    maxStepsPerWindow: 20,
    intervalMs: 10_000,
    deadlineMs: 60_000,
    confirm: true,
  });
  assert.equal(lease.registry, BOUNDED_OPERATOR_WINDOW_LEASE_REGISTRY);
  assert.equal(lease.status, "armed");
  assert.equal(lease.windowCount, 8);
  assert.equal(lease.maxStepsPerWindow, 20);
  assert.equal(lease.governance.automaticContinuationWithinLease, true);
  assert.equal(lease.governance.automaticRepeat, false);
  assert.equal(lease.governance.mutatesHost, false);
});
test("window lease continues only within its finite window budget", async () => {
  const calls = [];
  const harness = createHarness({
    run: async (input) => {
      calls.push(input);
      return { ran: true, steps: [{}], blocked: false, runSessionId: `run-${input.windowIndex}` };
    },
  });
  const lease = harness.manager.arm({
    windowCount: 2,
    maxStepsPerWindow: 3,
    intervalMs: 0,
    deadlineMs: 60_000,
    confirm: true,
  });

  const first = await harness.manager.tick();
  assert.equal(first.ran, true);
  assert.equal(first.continued, true);
  assert.equal(first.lease.status, "armed");
  assert.equal(first.lease.windowsCompleted, 1);
  assert.equal(first.lease.lastRunSessionId, "run-1");

  const second = await harness.manager.tick();
  assert.equal(second.lease.status, "completed");
  assert.equal(second.lease.stopReason, "window_budget_consumed");
  assert.equal(second.lease.remainingWindows, 0);
  assert.equal((await harness.manager.tick()).reason, "no_due_window");
  assert.deepEqual(calls, [
    { maxSteps: 3, leaseId: lease.id, windowIndex: 1 },
    { maxSteps: 3, leaseId: lease.id, windowIndex: 2 },
  ]);
});

test("restart pauses a lease and re-arm preserves budget without extending deadline", () => {
  const harness = createHarness();
  const lease = harness.manager.arm({
    windowCount: 3,
    maxStepsPerWindow: 2,
    intervalMs: 1000,
    deadlineMs: 60_000,
    confirm: true,
  });
  const paused = harness.manager.reconcileAtStartup().find((item) => item.id === lease.id);
  assert.equal(paused.status, "paused");
  assert.equal(paused.stopReason, "core_restart_requires_explicit_rearm");
  assert.throws(() => harness.manager.rearm(lease.id), /confirm=true/u);

  const rearmed = harness.manager.rearm(lease.id, { confirm: true });
  assert.equal(rearmed.status, "armed");
  assert.equal(rearmed.windowCount, 3);
  assert.equal(rearmed.windowsCompleted, 0);
  assert.equal(rearmed.deadlineAt, lease.deadlineAt);
  assert.equal(rearmed.governance.explicitRearmAfterRestart, true);
});

test("blocked window execution closes the lease without retry", async () => {
  const harness = createHarness({
    run: async () => ({ ran: false, steps: [], blocked: true, reason: "runtime_paused" }),
  });
  const lease = harness.manager.arm({
    windowCount: 4,
    maxStepsPerWindow: 1,
    deadlineMs: 60_000,
    confirm: true,
  });
  const result = await harness.manager.tick();
  assert.equal(result.ok, true);
  assert.equal(result.ran, true);
  assert.equal(result.lease.id, lease.id);
  assert.equal(result.lease.status, "blocked");
  assert.equal(result.lease.stopReason, "runtime_paused");
  assert.equal(result.lease.governance.automaticRetry, false);
  assert.equal(harness.persistCount > 0, true);
});
