import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
  FIXED_UNIT_INCIDENT_TASK_TYPE,
  hashFixedUnitIncidentObservation,
} from "../src/fixed-unit-incident-scheduler.mjs";
import { createFixedUnitIncidentTriageBuilders } from "../src/fixed-unit-incident-triage.mjs";
import {
  createFixedUnitIncidentApprovedDispatcher,
  reconcileFixedUnitIncidentDispatchesAtStartup,
} from "../src/fixed-unit-incident-approved-dispatch.mjs";

const REAL_EXECUTION_REGISTRY = "openclaw-systemd-next-repair-real-execution-v0";
const TARGET = {
  unit: "openclaw-system-heal.service",
  healthServiceKey: "systemHeal",
};

async function createHarness({ executeTaskWithRecovery, publishAuditEvent } = {}) {
  const health = {
    unit: {
      unit: TARGET.unit,
      systemdObserved: true,
      loadState: "loaded",
      activeState: "failed",
      subState: "failed",
      observation: "dbus_properties_read_only",
    },
    service: { key: TARGET.healthServiceKey, ok: false, status: "unhealthy" },
    healthy: false,
  };
  const observation = {
    registry: FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
    mode: "automatic_local_read_only",
    observedAt: "2026-07-19T00:45:00.000Z",
    fingerprint: hashFixedUnitIncidentObservation({ target: TARGET, health }),
    target: TARGET,
    health,
    governance: {
      callsProvider: false,
      authorizesRepair: false,
      invokesHostd: false,
    },
  };
  const sourceTask = {
    id: "incident-task-1",
    type: FIXED_UNIT_INCIDENT_TASK_TYPE,
    status: "completed",
    systemdIncidentObservation: observation,
  };
  const tasks = new Map([[sourceTask.id, sourceTask]]);
  const approvals = new Map();
  const schedulerState = {
    units: {
      [TARGET.unit]: {
        status: "unhealthy",
        fingerprint: observation.fingerprint,
        latestTaskId: sourceTask.id,
      },
    },
  };
  let taskSequence = 0;
  const builders = createFixedUnitIncidentTriageBuilders({
    tasks,
    approvals,
    schedulerState,
    buildSystemdRepairExecutionTaskDraft: async () => ({
      registry: "openclaw-systemd-repair-execution-task-v0",
      sourceRegistry: "openclaw-systemd-repair-dry-run-v0",
      target: { unit: TARGET.unit },
      governance: {
        createsTask: false,
        createsApproval: false,
        hostMutation: false,
      },
    }),
    createSystemdNextRepairTaskShell: async (input) => {
      await input.validateBeforeCreate();
      const task = {
        id: `repair-task-${++taskSequence}`,
        type: "systemd_next_repair_task",
        status: "queued",
        systemdNextRepair: {
          registry: REAL_EXECUTION_REGISTRY,
          target: { unit: TARGET.unit },
          capability: {
            registry: "openclaw-hostd-restart-capability-v1",
            operation: "restart_system_heal",
            capabilityId: "hostd.restart_system_heal",
          },
          command: { command: "systemctl", args: ["restart", TARGET.unit] },
          execution: {
            realExecutionEnabled: true,
            executed: false,
            hostMutation: false,
          },
        },
        systemdIncidentRepairPromotion: input.sourceIncidentRepairPromotion,
        approval: { requestId: `approval-${taskSequence}`, status: "pending" },
      };
      const approval = {
        id: `approval-${taskSequence}`,
        taskId: task.id,
        status: "pending",
      };
      tasks.set(task.id, task);
      approvals.set(approval.id, approval);
      return {
        task,
        approval,
        governance: { executed: false, hostMutation: false },
      };
    },
    evaluatePolicyIntent: () => ({ decision: "audit_only", approved: false }),
    createTask: (input) => {
      const task = { id: `triage-task-${++taskSequence}`, status: "queued", ...input };
      tasks.set(task.id, task);
      return task;
    },
    completeTask: (task, details) => {
      task.status = "completed";
      task.outcome = { kind: "completed", details };
      return task;
    },
    publishEvent: async () => ({ ok: true }),
  });
  const triage = await builders.createAutomaticFixedUnitIncidentTriageTask({ sourceTaskId: sourceTask.id });
  schedulerState.units[TARGET.unit].latestTriageTaskId = triage.task.id;
  const promotion = await builders.createAutomaticFixedUnitIncidentRepairTask({ triageTaskId: triage.task.id });
  schedulerState.units[TARGET.unit].latestRepairTaskId = promotion.task.id;
  schedulerState.units[TARGET.unit].latestRepairApprovalId = promotion.approval.id;
  schedulerState.units[TARGET.unit].repairApprovalStatus = "pending";
  promotion.approval.status = "approved";
  promotion.task.approval.status = "approved";

  let persistenceCount = 0;
  const auditEvents = [];
  let executionCount = 0;
  const dispatcher = createFixedUnitIncidentApprovedDispatcher({
    tasks,
    approvals,
    schedulerState,
    realExecutionRegistry: REAL_EXECUTION_REGISTRY,
    executeTaskWithRecovery: async (task, options) => {
      executionCount += 1;
      if (executeTaskWithRecovery) return executeTaskWithRecovery(task, options, schedulerState);
      assert.deepEqual(options, { autoRecover: false, maxRecoveryAttempts: 0 });
      assert.equal(schedulerState.units[TARGET.unit].repairDispatchStatus, "reserved");
      task.status = "completed";
      return {
        finalExecution: {
          task,
          execution: { hostMutationAttempted: true },
        },
      };
    },
    persistState: () => { persistenceCount += 1; },
    publishAuditEvent: async (name, payload) => {
      auditEvents.push({ name, payload });
      return publishAuditEvent ? publishAuditEvent(name, payload) : { ok: true };
    },
    now: () => "2026-07-19T00:50:00.000Z",
  });
  return {
    dispatcher,
    tasks,
    approvals,
    schedulerState,
    sourceTask,
    triage,
    promotion,
    auditEvents,
    persistenceCount: () => persistenceCount,
    executionCount: () => executionCount,
  };
}

test("approved automatic fixed-unit repair dispatches once without recovery", async () => {
  const harness = await createHarness();
  const input = { task: harness.promotion.task, approval: harness.promotion.approval };

  const [first, concurrent] = await Promise.all([
    harness.dispatcher(input),
    harness.dispatcher(input),
  ]);
  const replay = await harness.dispatcher(input);

  assert.equal(first.dispatched, true);
  assert.equal(first.taskStatus, "completed");
  assert.equal(first.automaticRecovery, false);
  assert.deepEqual(concurrent, first);
  assert.equal(replay.code, "repair_task_not_queued");
  assert.equal(harness.executionCount(), 1);
  assert.equal(harness.schedulerState.units[TARGET.unit].repairDispatchStatus, "completed");
  assert.equal(harness.schedulerState.units[TARGET.unit].repairDispatchOutcomeStatus, "completed");
  assert.deepEqual(harness.auditEvents.map((event) => event.name), [
    "systemd.fixed_unit_incident_repair_dispatch_authorized",
    "systemd.fixed_unit_incident_repair_dispatch_completed",
  ]);
  assert.ok(harness.persistenceCount() >= 2);
});

test("fixed-unit repair dispatcher ignores unrelated approvals and blocks stale source evidence", async () => {
  const harness = await createHarness();
  const unrelated = await harness.dispatcher({
    task: { id: "generic-task", type: "generic_task", status: "queued" },
    approval: { id: "generic-approval", taskId: "generic-task", status: "approved" },
  });
  assert.equal(unrelated, null);

  harness.schedulerState.units[TARGET.unit].fingerprint = `sha256:${"f".repeat(64)}`;
  const stale = await harness.dispatcher({
    task: harness.promotion.task,
    approval: harness.promotion.approval,
  });
  assert.equal(stale.dispatched, false);
  assert.equal(stale.code, "source_incident_not_current");
  assert.equal(harness.executionCount(), 0);
  assert.equal(harness.auditEvents.length, 0);
});

test("fixed-unit repair dispatcher fails closed when required pre-dispatch audit is unavailable", async () => {
  const harness = await createHarness({
    publishAuditEvent: async (name) => name.endsWith("_authorized") ? null : { ok: true },
  });

  const result = await harness.dispatcher({
    task: harness.promotion.task,
    approval: harness.promotion.approval,
  });

  assert.equal(result.code, "repair_dispatch_audit_failed");
  assert.equal(harness.executionCount(), 0);
  assert.equal(harness.schedulerState.units[TARGET.unit].repairDispatchStatus, undefined);
});

test("fixed-unit repair dispatcher persists only a compact failure after Executor rejection", async () => {
  const harness = await createHarness({
    executeTaskWithRecovery: async () => {
      throw new Error("private executor failure detail");
    },
  });

  const result = await harness.dispatcher({
    task: harness.promotion.task,
    approval: harness.promotion.approval,
  });

  assert.equal(result.code, "automatic_repair_dispatch_failed");
  assert.equal(harness.executionCount(), 1);
  assert.deepEqual(harness.schedulerState.units[TARGET.unit].repairDispatchFailure, {
    code: "automatic_repair_dispatch_failed",
    at: "2026-07-19T00:50:00.000Z",
  });
  assert.doesNotMatch(JSON.stringify(harness.schedulerState), /private executor failure detail/u);
});

test("startup reconciliation fails a reserved queued dispatch closed without replay", async () => {
  const harness = await createHarness();
  const unitState = harness.schedulerState.units[TARGET.unit];
  Object.assign(unitState, {
    repairDispatchTaskId: harness.promotion.task.id,
    repairDispatchStatus: "reserved",
    repairDispatchAt: "2026-07-19T00:50:00.000Z",
  });
  let failedDetails = null;

  const result = reconcileFixedUnitIncidentDispatchesAtStartup({
    tasks: harness.tasks,
    schedulerState: harness.schedulerState,
    failTask: (task, _reason, details) => {
      task.status = "failed";
      failedDetails = details;
    },
    now: () => "2026-07-19T01:00:00.000Z",
  });

  assert.equal(result.reconciledCount, 1);
  assert.equal(result.automaticReplay, false);
  assert.equal(harness.promotion.task.status, "failed");
  assert.equal(failedDetails.code, "automatic_repair_dispatch_interrupted");
  assert.equal(unitState.repairDispatchStatus, "failed");
  assert.deepEqual(unitState.repairDispatchFailure, {
    code: "automatic_repair_dispatch_interrupted",
    at: "2026-07-19T01:00:00.000Z",
  });
  assert.equal(harness.executionCount(), 0);
});

test("startup reconciliation aligns a terminal reserved dispatch without failing it again", async () => {
  const harness = await createHarness();
  const unitState = harness.schedulerState.units[TARGET.unit];
  harness.promotion.task.status = "completed";
  Object.assign(unitState, {
    repairDispatchTaskId: harness.promotion.task.id,
    repairDispatchStatus: "reserved",
    repairDispatchAt: "2026-07-19T00:50:00.000Z",
  });
  let failCalls = 0;

  const result = reconcileFixedUnitIncidentDispatchesAtStartup({
    tasks: harness.tasks,
    schedulerState: harness.schedulerState,
    failTask: () => { failCalls += 1; },
    now: () => "2026-07-19T01:00:00.000Z",
  });

  assert.equal(result.items[0].outcome, "terminal_state_reconciled");
  assert.equal(failCalls, 0);
  assert.equal(unitState.repairDispatchStatus, "completed");
  assert.equal(unitState.repairDispatchOutcomeStatus, "completed");
  assert.equal(unitState.repairDispatchFailure, null);
  assert.equal(harness.executionCount(), 0);
});
