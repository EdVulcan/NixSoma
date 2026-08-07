import assert from "node:assert/strict";
import test from "node:test";

import { createBoundedOperatorWindowLease } from "../src/bounded-operator-window-lease.mjs";
import { createRenewableOperatorMissionSupervisor } from "../src/renewable-operator-mission.mjs";

function createHarness(results = [], { missionWorklist = null } = {}) {
  let currentMs = Date.parse("2026-08-01T14:00:00.000Z");
  const now = () => new Date(currentMs).toISOString();
  const leases = new Map();
  const missions = new Map();
  const queue = [...results];
  const windowLease = createBoundedOperatorWindowLease({
    records: leases,
    persistState: () => {},
    now,
    run: async () => queue.shift() ?? {
      ran: false,
      steps: [],
      blocked: false,
      reason: "queue_empty",
    },
  });
  const supervisor = createRenewableOperatorMissionSupervisor({
    records: missions,
    persistState: () => {},
    windowLease,
    now,
    missionWorklist,
  });
  return {
    supervisor,
    windowLease,
    leases,
    missions,
    advance(milliseconds) {
      currentMs += milliseconds;
    },
  };
}

function arm(supervisor, overrides = {}) {
  return supervisor.arm({
    epochCount: 2,
    maxStepsPerEpoch: 3,
    epochIntervalMs: 0,
    deadlineMs: 60_000,
    maxNoProgressEpochs: 2,
    confirm: true,
    ...overrides,
  });
}

test("mission consumes checkpointed one-window epochs through the existing owner", async () => {
  const harness = createHarness([
    { ran: true, steps: [{ task: { id: "task-1" } }], blocked: false, runSessionId: "run-1" },
    { ran: true, steps: [{ task: { id: "task-2" } }], blocked: false, runSessionId: "run-2" },
  ]);
  const created = arm(harness.supervisor);

  const first = await harness.supervisor.tick();
  assert.equal(first.ran, true);
  assert.equal(first.mission.status, "armed");
  assert.equal(first.mission.epochsConsumed, 1);
  assert.equal(first.mission.epochsCompleted, 1);
  assert.equal(first.mission.remainingEpochs, 1);
  assert.equal(first.mission.lastCheckpoint.runSessionId, "run-1");

  const second = await harness.supervisor.tick();
  assert.equal(second.mission.status, "completed");
  assert.equal(second.mission.stopReason, "epoch_authority_consumed");
  assert.equal(second.mission.progressPercent, 100);
  assert.equal(second.mission.lastCheckpoint.runSessionId, "run-2");
  assert.equal(harness.windowLease.listPublic().length, 2);
  assert.ok(harness.windowLease.listPublic().every((lease) => (
    lease.windowCount === 1
      && lease.owner.kind === "renewable_operator_mission"
      && lease.owner.missionId === created.id
  )));
});

test("mission renewal extends finite epoch and deadline authority explicitly", async () => {
  const harness = createHarness([
    { ran: true, steps: [{ task: { id: "task-1" } }], blocked: false },
  ]);
  const created = arm(harness.supervisor, { epochCount: 1 });
  const completed = await harness.supervisor.tick();
  assert.equal(completed.mission.status, "completed");
  const oldDeadline = completed.mission.deadlineAt;

  const renewed = harness.supervisor.renew(created.id, {
    additionalEpochs: 2,
    extensionMs: 120_000,
    confirm: true,
  });
  assert.equal(renewed.status, "armed");
  assert.equal(renewed.epochsAuthorized, 3);
  assert.equal(renewed.remainingEpochs, 2);
  assert.equal(renewed.renewalCount, 1);
  assert.ok(Date.parse(renewed.deadlineAt) > Date.parse(oldDeadline));
  assert.throws(
    () => harness.supervisor.renew(created.id, { additionalEpochs: 33, extensionMs: 1000, confirm: true }),
    /1-32 epochs/u,
  );
});

test("mission pause requested during an epoch settles at the boundary", async () => {
  let releaseRun;
  let runStarted;
  const started = new Promise((resolve) => { runStarted = resolve; });
  const result = new Promise((resolve) => { releaseRun = resolve; });
  const harness = createHarness([result]);
  const originalTick = harness.windowLease.tick;
  harness.windowLease.tick = async (options) => {
    runStarted();
    return originalTick(options);
  };
  const created = arm(harness.supervisor);

  const pendingTick = harness.supervisor.tick();
  await started;
  const pausing = harness.supervisor.pause(created.id, true);
  assert.equal(pausing.status, "pausing");
  releaseRun({ ran: true, steps: [{ task: { id: "task-1" } }], blocked: false });

  const settled = await pendingTick;
  assert.equal(settled.mission.status, "paused");
  assert.equal(settled.mission.stopReason, "operator_paused_at_epoch_boundary");
  assert.equal(settled.mission.epochsConsumed, 1);
  assert.equal(settled.mission.epochsCompleted, 1);
  assert.equal(harness.supervisor.rearm(created.id, { confirm: true }).status, "armed");
  assert.equal(harness.supervisor.cancel(created.id, true).status, "cancelled");
});

test("mission opens a no-progress circuit without automatic retry", async () => {
  const harness = createHarness([
    { ran: false, steps: [], blocked: false, reason: "queue_empty" },
    { ran: false, steps: [], blocked: false, reason: "queue_empty" },
    { ran: true, steps: [{ task: { id: "task-3" } }], blocked: false },
  ]);
  const created = arm(harness.supervisor, { epochCount: 3, maxNoProgressEpochs: 2 });

  assert.equal((await harness.supervisor.tick()).mission.status, "armed");
  const blocked = await harness.supervisor.tick();
  assert.equal(blocked.mission.status, "blocked");
  assert.equal(blocked.mission.stopReason, "no_progress_circuit_open");
  assert.equal(blocked.mission.remainingEpochs, 1);
  assert.equal((await harness.supervisor.tick()).reason, "no_active_mission");
  assert.throws(
    () => harness.supervisor.rearm(created.id, { confirm: true }),
    /explicitly reset/u,
  );
  assert.equal(harness.supervisor.rearm(created.id, { resetCircuit: true, confirm: true }).status, "armed");
  assert.equal((await harness.supervisor.tick()).mission.status, "completed");
});

test("startup pauses remaining authority and exact re-arm never restores consumed epochs", async () => {
  const harness = createHarness([
    { ran: true, steps: [{ task: { id: "task-1" } }], blocked: false },
  ]);
  const created = arm(harness.supervisor, { epochCount: 3, epochIntervalMs: 1000 });
  const first = await harness.supervisor.tick();
  assert.equal(first.mission.epochsConsumed, 1);
  assert.equal(first.mission.status, "armed");

  harness.windowLease.reconcileAtStartup();
  const [paused] = harness.supervisor.reconcileAtStartup();
  assert.equal(paused.status, "paused");
  assert.equal(paused.epochsConsumed, 1);
  assert.equal(paused.remainingEpochs, 2);
  assert.equal(paused.stopReason, "core_restart_requires_explicit_rearm");
  assert.equal(harness.supervisor.rearm(created.id, { confirm: true }).status, "armed");
});

test("mission starts no epoch with less than one second of authority", async () => {
  const harness = createHarness();
  const created = arm(harness.supervisor, { epochCount: 1, deadlineMs: 1000 });
  harness.advance(1);

  const result = await harness.supervisor.tick();
  assert.equal(result.ran, false);
  assert.equal(result.mission.status, "expired");
  assert.equal(result.mission.stopReason, "insufficient_authority_for_next_epoch");
  assert.equal(result.mission.epochsConsumed, 0);
  assert.equal(harness.windowLease.listPublic().length, 0);
  assert.equal(result.mission.id, created.id);
});

test("mission authority expiring during a running epoch settles as expired", async () => {
  let releaseRun;
  let runStarted;
  const started = new Promise((resolve) => { runStarted = resolve; });
  const result = new Promise((resolve) => { releaseRun = resolve; });
  const harness = createHarness([result]);
  const originalTick = harness.windowLease.tick;
  harness.windowLease.tick = async (options) => {
    runStarted();
    return originalTick(options);
  };
  arm(harness.supervisor, { epochCount: 2, deadlineMs: 1000 });

  const pendingTick = harness.supervisor.tick();
  await started;
  harness.advance(1000);
  const expiring = await harness.supervisor.tick();
  assert.equal(expiring.mission.status, "cancelling");
  assert.equal(expiring.mission.stopReason, "authority_expired_during_epoch");
  releaseRun({ ran: true, steps: [{ task: { id: "task-1" } }], blocked: false });

  const settled = await pendingTick;
  assert.equal(settled.mission.status, "expired");
  assert.equal(settled.mission.stopReason, "authority_deadline_reached_at_epoch_boundary");
  assert.equal(settled.mission.epochsConsumed, 1);
  assert.equal(settled.mission.epochsCompleted, 1);
});

test("mission authority expiry remains expired when the child later blocks", async () => {
  let releaseRun;
  let runStarted;
  const started = new Promise((resolve) => { runStarted = resolve; });
  const result = new Promise((resolve) => { releaseRun = resolve; });
  const harness = createHarness([result]);
  const originalTick = harness.windowLease.tick;
  harness.windowLease.tick = async (options) => {
    runStarted();
    return originalTick(options);
  };
  arm(harness.supervisor, { epochCount: 2, deadlineMs: 1000 });

  const pendingTick = harness.supervisor.tick();
  await started;
  harness.advance(1000);
  await harness.supervisor.tick();
  releaseRun({ ran: false, steps: [], blocked: true, reason: "runtime_paused" });

  const settled = await pendingTick;
  assert.equal(settled.mission.status, "expired");
  assert.equal(settled.mission.stopReason, "authority_deadline_reached_with_child_failure");
});

test("startup preserves cancellation and expiry as terminal decisions", () => {
  const cancelledHarness = createHarness();
  const cancelled = arm(cancelledHarness.supervisor);
  cancelledHarness.missions.get(cancelled.id).status = "cancelling";
  cancelledHarness.missions.get(cancelled.id).stopReason = "operator_cancel_requested";
  const [cancelledAfterRestart] = cancelledHarness.supervisor.reconcileAtStartup();
  assert.equal(cancelledAfterRestart.status, "cancelled");
  assert.equal(cancelledAfterRestart.stopReason, "operator_cancelled_during_restart");

  const expiredHarness = createHarness();
  const expired = arm(expiredHarness.supervisor);
  expiredHarness.missions.get(expired.id).status = "cancelling";
  expiredHarness.missions.get(expired.id).stopReason = "authority_expired_during_epoch";
  const [expiredAfterRestart] = expiredHarness.supervisor.reconcileAtStartup();
  assert.equal(expiredAfterRestart.status, "expired");
  assert.equal(expiredAfterRestart.stopReason, "authority_deadline_reached_during_restart");
});

test("mission rejects unbounded authority and starts no timer by default", () => {
  const harness = createHarness();
  assert.throws(() => arm(harness.supervisor, { epochCount: 33 }), /1-32 epochs/u);
  assert.throws(() => arm(harness.supervisor, { deadlineMs: 604_800_001 }), /1000-604800000/u);
  assert.equal(harness.supervisor.start(), false);
  assert.deepEqual(harness.supervisor.state(), {
    registry: "nixsoma-renewable-operator-mission-v0",
    enabled: false,
    timerActive: false,
    active: false,
    governance: harness.supervisor.state().governance,
  });
  assert.equal(harness.supervisor.state().governance.automaticRetry, false);
});

test("mission issues reviewed work only before opening an epoch and closes on worklist completion", async () => {
  const calls = [];
  let worklistStatus = "active";
  const worklist = {
    async prepareEpoch(mission) {
      calls.push({ action: "prepare", consumed: mission.epochsConsumed });
      return {
        ok: true,
        managed: true,
        ready: true,
        issued: true,
        taskId: "task-reviewed-1",
        worklist: { id: "worklist-1", status: "active" },
      };
    },
    refreshForMission(missionId) {
      calls.push({ action: "refresh", missionId });
      return { id: "worklist-1", status: worklistStatus, blockedReason: null };
    },
  };
  const harness = createHarness([
    { ran: true, steps: [{ task: { id: "task-reviewed-1" } }], blocked: false },
  ], { missionWorklist: worklist });
  arm(harness.supervisor, { epochCount: 2 });
  worklistStatus = "completed";

  const result = await harness.supervisor.tick();
  assert.equal(result.ran, true);
  assert.equal(result.mission.status, "completed");
  assert.equal(result.mission.stopReason, "reviewed_worklist_completed");
  assert.equal(result.mission.epochsConsumed, 1);
  assert.equal(result.worklist.status, "completed");
  assert.deepEqual(calls[0], { action: "prepare", consumed: 0 });
  assert.equal(calls[1].action, "refresh");
});

test("mission blocks before consuming epoch authority when reviewed work supply fails", async () => {
  const worklist = {
    async prepareEpoch() {
      return {
        ok: false,
        managed: true,
        ready: false,
        reason: "unrelated_active_task",
        worklist: { id: "worklist-1", status: "blocked", blockedReason: "unrelated_active_task" },
      };
    },
    refreshForMission: () => null,
  };
  const harness = createHarness([], { missionWorklist: worklist });
  arm(harness.supervisor);

  const result = await harness.supervisor.tick();
  assert.equal(result.ran, false);
  assert.equal(result.ok, false);
  assert.equal(result.mission.status, "blocked");
  assert.equal(result.mission.stopReason, "reviewed_worklist_unrelated_active_task");
  assert.equal(result.mission.epochsConsumed, 0);
  assert.equal(harness.windowLease.listPublic().length, 0);
});

test("mission pauses before opening another epoch while a workflow awaits acceptance", async () => {
  const worklist = {
    prepareEpoch: async () => ({
      ok: true,
      managed: true,
      ready: false,
      reason: "workflow_acceptance_required",
      worklist: {
        id: "worklist-1",
        status: "active",
        currentWorkflowAcceptanceRequired: true,
      },
    }),
    refreshForMission: () => ({ id: "worklist-1", status: "active" }),
  };
  const harness = createHarness([], { missionWorklist: worklist });
  const mission = arm(harness.supervisor, { epochCount: 2 });

  const result = await harness.supervisor.tick();
  assert.equal(result.ran, false);
  assert.equal(result.ok, true);
  assert.equal(result.mission.status, "paused");
  assert.equal(result.mission.stopReason, "reviewed_worklist_workflow_acceptance_required");
  assert.equal(result.mission.epochsConsumed, 0);
  assert.equal(result.mission.id, mission.id);
  assert.equal(harness.windowLease.listPublic().length, 0);
});

test("mission cancellation closes its reviewed worklist", () => {
  const closed = [];
  const worklist = {
    prepareEpoch: async () => ({ ok: true, managed: false, ready: true }),
    refreshForMission: () => null,
    closeForMission: (missionId, reason) => { closed.push({ missionId, reason }); },
  };
  const harness = createHarness([], { missionWorklist: worklist });
  const mission = arm(harness.supervisor);

  assert.equal(harness.supervisor.cancel(mission.id, true).status, "cancelled");
  assert.deepEqual(closed, [{ missionId: mission.id, reason: "mission_cancelled" }]);
});
