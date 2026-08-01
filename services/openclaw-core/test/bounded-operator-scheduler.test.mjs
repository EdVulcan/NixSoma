import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_OPERATOR_SCHEDULER_REGISTRY,
  createBoundedOperatorScheduler,
} from "../src/bounded-operator-scheduler.mjs";

function createHarness({ run = async () => ({ ran: true, steps: [{}], blocked: false }) } = {}) {
  const records = new Map();
  let persistCount = 0;
  const scheduler = createBoundedOperatorScheduler({
    records,
    run,
    persistState: () => { persistCount += 1; },
    now: () => "2026-08-01T13:00:00.000Z",
    enabled: false,
  });
  return { scheduler, records, get persistCount() { return persistCount; } };
}

test("bounded scheduler requires explicit finite one-shot authorization", () => {
  const { scheduler } = createHarness();
  assert.throws(() => scheduler.arm({ maxSteps: 2 }), /confirm=true/u);
  const schedule = scheduler.arm({ maxSteps: 20, delayMs: 0, confirm: true });
  assert.equal(schedule.registry, BOUNDED_OPERATOR_SCHEDULER_REGISTRY);
  assert.equal(schedule.status, "armed");
  assert.equal(schedule.maxSteps, 20);
  assert.equal(schedule.governance.oneShot, true);
  assert.equal(schedule.governance.automaticRepeat, false);
  assert.equal(schedule.governance.automaticTaskCreation, false);
});

test("bounded scheduler consumes one due run and never retries it", async () => {
  let calls = 0;
  let received = null;
  const harness = createHarness({
    run: async (input) => {
      calls += 1;
      received = input;
      return { ran: true, steps: [{}, {}], blocked: false };
    },
  });
  const armed = harness.scheduler.arm({ maxSteps: 3, confirm: true });
  const result = await harness.scheduler.tick();
  assert.equal(result.ran, true);
  assert.equal(result.schedule.status, "completed");
  assert.equal(result.schedule.stopReason, "one_shot_schedule_consumed");
  assert.deepEqual(received, { maxSteps: 3, scheduleId: armed.id });
  assert.equal(calls, 1);
  const second = await harness.scheduler.tick();
  assert.equal(second.reason, "no_due_schedule");
  assert.equal(calls, 1);
});

test("Core restart blocks an in-flight schedule and pauses armed work for re-arm", () => {
  const harness = createHarness();
  harness.records.set("running-schedule", {
    id: "running-schedule",
    status: "running",
    maxSteps: 2,
    dueAt: "2026-08-01T12:59:00.000Z",
    createdAt: "2026-08-01T12:58:00.000Z",
    updatedAt: "2026-08-01T12:59:00.000Z",
  });
  harness.records.set("armed-schedule", {
    id: "armed-schedule",
    status: "armed",
    maxSteps: 2,
    dueAt: "2026-08-01T13:01:00.000Z",
    createdAt: "2026-08-01T12:58:00.000Z",
    updatedAt: "2026-08-01T12:59:00.000Z",
  });
  const restored = harness.scheduler.reconcileAtStartup();
  assert.equal(restored.find((item) => item.id === "running-schedule").status, "blocked");
  assert.equal(restored.find((item) => item.id === "armed-schedule").status, "paused");
  assert.equal(restored.find((item) => item.id === "armed-schedule").stopReason, "core_restart_requires_explicit_rearm");
});

test("failed scheduled execution closes without retry or automatic continuation", async () => {
  const harness = createHarness({ run: async () => { throw new Error("runner failed"); } });
  const armed = harness.scheduler.arm({ maxSteps: 1, confirm: true });
  const result = await harness.scheduler.tick();
  assert.equal(result.ok, false);
  assert.equal(result.schedule.id, armed.id);
  assert.equal(result.schedule.status, "blocked");
  assert.equal(result.schedule.governance.automaticRetry, false);
  assert.equal(harness.persistCount > 0, true);
});
