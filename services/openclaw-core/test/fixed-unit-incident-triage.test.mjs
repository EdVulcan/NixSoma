import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
  FIXED_UNIT_INCIDENT_TASK_TYPE,
  hashFixedUnitIncidentObservation,
} from "../src/fixed-unit-incident-scheduler.mjs";
import {
  FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY,
  FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE,
  createFixedUnitIncidentTriageBuilders,
} from "../src/fixed-unit-incident-triage.mjs";

const SOURCE_TASK_ID = "scheduled-incident-task-1";
const TARGET = {
  unit: "openclaw-system-heal.service",
  healthServiceKey: "systemHeal",
};

function incidentObservation() {
  const health = {
    unit: {
      unit: TARGET.unit,
      systemdObserved: true,
      loadState: "loaded",
      activeState: "failed",
      subState: "failed",
      observation: "dbus_properties_read_only",
    },
    service: { key: "systemHeal", ok: false, status: "unhealthy" },
    healthy: false,
  };
  return {
    registry: FIXED_UNIT_INCIDENT_OBSERVATION_REGISTRY,
    mode: "automatic_local_read_only",
    observedAt: "2026-07-18T14:30:00.000Z",
    fingerprint: hashFixedUnitIncidentObservation({ target: TARGET, health }),
    target: TARGET,
    health,
    governance: {
      callsProvider: false,
      authorizesRepair: false,
      invokesHostd: false,
    },
  };
}

function repairDraft() {
  return {
    registry: "openclaw-systemd-repair-execution-task-v0",
    sourceRegistry: "openclaw-systemd-repair-dry-run-v0",
    target: { unit: TARGET.unit },
    draft: { policy: { decision: { decision: "require_approval" } } },
    governance: {
      createsTask: false,
      createsApproval: false,
      hostMutation: false,
    },
  };
}

function createHarness({
  audit = async () => ({ ok: true }),
  beforeRepairCreate = async () => {},
} = {}) {
  const observation = incidentObservation();
  const sourceTask = {
    id: SOURCE_TASK_ID,
    type: FIXED_UNIT_INCIDENT_TASK_TYPE,
    status: "completed",
    systemdIncidentObservation: observation,
  };
  const tasks = new Map([[sourceTask.id, sourceTask]]);
  const calls = [];
  const events = [];
  const approvals = new Map();
  let sequence = 0;
  const schedulerState = {
    units: {
      [TARGET.unit]: {
        status: "unhealthy",
        fingerprint: observation.fingerprint,
        latestTaskId: sourceTask.id,
      },
    },
  };
  const builders = createFixedUnitIncidentTriageBuilders({
    tasks,
    schedulerState,
    buildSystemdRepairExecutionTaskDraft: async (input) => {
      calls.push({ name: "buildDraft", input });
      return repairDraft();
    },
    createSystemdNextRepairTaskShell: async (input) => {
      calls.push({ name: "createRepairTask", input });
      await beforeRepairCreate({ tasks, schedulerState });
      await input.validateBeforeCreate();
      const task = {
        id: `repair-task-${++sequence}`,
        type: "systemd_next_repair_task",
        status: "queued",
        systemdNextRepair: { target: { unit: input.targetUnit } },
        systemdIncidentRepairPromotion: input.sourceIncidentRepairPromotion,
        approval: { requestId: `approval-${sequence}`, status: "pending" },
      };
      const approval = { id: `approval-${sequence}`, taskId: task.id, status: "pending" };
      tasks.set(task.id, task);
      approvals.set(approval.id, approval);
      return {
        task,
        approval,
        governance: { executed: false, hostMutation: false },
      };
    },
    approvals,
    evaluatePolicyIntent: (_input, context) => ({
      decision: "audit_only",
      domain: "body_internal",
      risk: "low",
      reason: "body_internal_audit",
      approved: false,
      autonomous: false,
      context,
    }),
    createTask: (input, options) => {
      calls.push({ name: "createTask", input, options });
      const task = { id: `triage-task-${++sequence}`, status: "queued", ...input };
      tasks.set(task.id, task);
      return task;
    },
    completeTask: (task, details) => {
      calls.push({ name: "completeTask", taskId: task.id, details });
      task.status = "completed";
      task.outcome = { kind: "completed", details };
      return task;
    },
    persistState: () => calls.push({ name: "persistState" }),
    publishEvent: async (name, payload) => {
      events.push({ name, payload });
      if (name === "systemd.fixed_unit_incident_triage_recorded"
        || name === "systemd.fixed_unit_incident_repair_promoted") return audit(name);
      return { ok: true };
    },
    serialiseTask: (task) => task,
    now: () => "2026-07-18T15:00:00.000Z",
  });
  return { builders, tasks, approvals, schedulerState, sourceTask, observation, calls, events };
}

test("fixed-unit incident triage creates one completed plan-only task without approval", async () => {
  const harness = createHarness();

  const result = await harness.builders.createFixedUnitIncidentTriageTask({
    sourceTaskId: SOURCE_TASK_ID,
    confirm: true,
  });

  assert.equal(result.registry, FIXED_UNIT_INCIDENT_TRIAGE_REGISTRY);
  assert.equal(result.task.type, FIXED_UNIT_INCIDENT_TRIAGE_TASK_TYPE);
  assert.equal(result.task.status, "completed");
  assert.equal(result.task.approval, undefined);
  assert.equal(result.task.policy.decision.decision, "audit_only");
  assert.equal(result.task.policy.decision.approved, false);
  assert.equal(result.triage.source.taskId, SOURCE_TASK_ID);
  assert.equal(result.triage.target.unit, TARGET.unit);
  assert.equal(result.triage.repairPlanningBoundary.policyDecision, "require_approval");
  assert.match(result.triage.binding.bindingHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.governance.createsApproval, false);
  assert.equal(result.governance.executesRepair, false);
  assert.equal(result.governance.invokesHostd, false);
  assert.equal(result.governance.callsProvider, false);
  assert.equal(result.task.plan.steps.some((step) => step.capabilityId || step.command), false);
  assert.deepEqual(harness.calls.map((call) => call.name), [
    "buildDraft",
    "createTask",
    "completeTask",
    "persistState",
  ]);
  assert.deepEqual(harness.events.map((event) => event.name), [
    "systemd.fixed_unit_incident_triage_recorded",
    "task.created",
    "task.completed",
  ]);
});

test("fixed-unit incident triage is idempotent for the same source fingerprint", async () => {
  const harness = createHarness();
  const input = { sourceTaskId: SOURCE_TASK_ID, confirm: true };

  const first = await harness.builders.createFixedUnitIncidentTriageTask(input);
  const second = await harness.builders.createFixedUnitIncidentTriageTask(input);

  assert.equal(second.task.id, first.task.id);
  assert.equal(second.governance.createdTask, false);
  assert.equal(second.governance.reusedExistingTask, true);
  assert.equal(harness.calls.filter((call) => call.name === "createTask").length, 1);
});

test("fixed-unit incident triage coalesces concurrent requests for the same source", async () => {
  const harness = createHarness();
  const input = { sourceTaskId: SOURCE_TASK_ID, confirm: true };

  const [first, second] = await Promise.all([
    harness.builders.createFixedUnitIncidentTriageTask(input),
    harness.builders.createFixedUnitIncidentTriageTask(input),
  ]);

  assert.equal(second.task.id, first.task.id);
  assert.equal(harness.calls.filter((call) => call.name === "buildDraft").length, 1);
  assert.equal(harness.calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(harness.events.filter((event) => event.name === "systemd.fixed_unit_incident_triage_recorded").length, 1);
});

test("fixed-unit incident triage rejects stale scheduler state and changed source evidence", async () => {
  const stale = createHarness();
  stale.sourceTask.systemdIncidentObservation.fingerprint = `sha256:${"a".repeat(64)}`;
  await assert.rejects(
    () => stale.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true }),
    /source_incident_fingerprint_mismatch/u,
  );
  assert.equal(stale.calls.length, 0);

  const recovered = createHarness();
  recovered.sourceTask.systemdIncidentObservation.health.healthy = true;
  await assert.rejects(
    () => recovered.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true }),
    /source_incident_observation_invalid/u,
  );
  assert.equal(recovered.calls.length, 0);
});

test("fixed-unit incident triage fails closed before task creation when audit fails", async () => {
  const harness = createHarness({
    audit: async () => { throw new Error("event hub unavailable"); },
  });

  await assert.rejects(
    () => harness.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true }),
    /event hub unavailable/u,
  );

  assert.equal(harness.calls.some((call) => call.name === "createTask"), false);
  assert.equal(harness.tasks.size, 1);
});

test("fixed-unit incident triage requires explicit confirmation and a current source task", async () => {
  const harness = createHarness();
  await assert.rejects(
    () => harness.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID }),
    /requires confirm=true/u,
  );
  await assert.rejects(
    () => harness.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: "missing", confirm: true }),
    /source_not_completed_fixed_unit_incident/u,
  );
});

test("automatic fixed-unit incident triage reuses the same no-authority owner without confirmation", async () => {
  const harness = createHarness();

  const result = await harness.builders.createAutomaticFixedUnitIncidentTriageTask({
    sourceTaskId: SOURCE_TASK_ID,
  });

  assert.equal(result.mode, "automatic_local_triage");
  assert.equal(result.triage.mode, "automatic_local_plan");
  assert.equal(result.triage.trigger, "scheduler");
  assert.equal(result.task.status, "completed");
  assert.equal(result.task.approval, undefined);
  assert.equal(result.task.plan.steps.some((step) => step.capabilityId || step.command), false);
  assert.equal(result.governance.createsApproval, false);
  assert.equal(result.governance.executesRepair, false);
  assert.equal(result.governance.invokesHostd, false);
  assert.equal(result.governance.callsProvider, false);
  const audit = harness.events.find((event) => event.name === "systemd.fixed_unit_incident_triage_recorded");
  assert.equal(audit.payload.trigger, "scheduler");
});

test("fixed-unit incident repair promotion creates one pending fixed-target approval without execution", async () => {
  const harness = createHarness();
  const triage = await harness.builders.createFixedUnitIncidentTriageTask({
    sourceTaskId: SOURCE_TASK_ID,
    confirm: true,
  });

  const result = await harness.builders.createFixedUnitIncidentRepairTask({
    triageTaskId: triage.task.id,
    confirm: true,
  });

  assert.equal(result.task.type, "systemd_next_repair_task");
  assert.equal(result.task.systemdNextRepair.target.unit, TARGET.unit);
  assert.equal(result.approval.status, "pending");
  assert.equal(result.promotion.triageTaskId, triage.task.id);
  assert.equal(result.promotion.sourceTaskId, SOURCE_TASK_ID);
  assert.match(result.promotion.bindingHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.governance.createsApproval, true);
  assert.equal(result.governance.executesRepair, false);
  assert.equal(result.governance.invokesHostd, false);
  const createCall = harness.calls.find((call) => call.name === "createRepairTask");
  assert.equal(createCall.input.execute, true);
  assert.equal(createCall.input.targetUnit, TARGET.unit);
  assert.equal(createCall.input.supersedeExistingTasks, true);
  assert.equal(typeof createCall.input.validateBeforeCreate, "function");
  assert.equal(harness.events.some((event) => event.name === "systemd.fixed_unit_incident_repair_promoted"), true);
});

test("automatic fixed-unit repair promotion creates only one pending approval without confirmation", async () => {
  const harness = createHarness();
  const triage = await harness.builders.createAutomaticFixedUnitIncidentTriageTask({
    sourceTaskId: SOURCE_TASK_ID,
  });

  const result = await harness.builders.createAutomaticFixedUnitIncidentRepairTask({
    triageTaskId: triage.task.id,
  });

  assert.equal(result.mode, "automatic_approval_gated_repair_promotion");
  assert.equal(result.promotion.mode, "automatic_approval_gated_repair_task_creation");
  assert.equal(result.promotion.trigger, "scheduler");
  assert.equal(result.task.status, "queued");
  assert.equal(result.approval.status, "pending");
  assert.equal(result.governance.createsApproval, true);
  assert.equal(result.governance.executesRepair, false);
  assert.equal(result.governance.invokesHostd, false);
  assert.equal(result.governance.callsProvider, false);
  const createCall = harness.calls.find((call) => call.name === "createRepairTask");
  assert.equal(createCall.input.supersedeExistingTasks, false);
  const audit = harness.events.find((event) => event.name === "systemd.fixed_unit_incident_repair_promoted");
  assert.equal(audit.payload.trigger, "scheduler");
});

test("fixed-unit incident repair promotion reuses the same task across repeated requests", async () => {
  const harness = createHarness();
  const triage = await harness.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true });
  const input = { triageTaskId: triage.task.id, confirm: true };

  const [first, second] = await Promise.all([
    harness.builders.createFixedUnitIncidentRepairTask(input),
    harness.builders.createFixedUnitIncidentRepairTask(input),
  ]);
  const third = await harness.builders.createFixedUnitIncidentRepairTask(input);

  assert.equal(second.task.id, first.task.id);
  assert.equal(third.task.id, first.task.id);
  assert.equal(third.governance.reusedExistingTask, true);
  assert.equal(harness.calls.filter((call) => call.name === "createRepairTask").length, 1);
});

test("fixed-unit incident repair promotion rejects changed triage evidence and audit failure", async () => {
  const tampered = createHarness();
  const triage = await tampered.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true });
  triage.task.systemdIncidentTriage.binding.bindingHash = `sha256:${"a".repeat(64)}`;
  await assert.rejects(
    () => tampered.builders.createFixedUnitIncidentRepairTask({ triageTaskId: triage.task.id, confirm: true }),
    /source_triage_hash_mismatch/u,
  );
  assert.equal(tampered.calls.some((call) => call.name === "createRepairTask"), false);

  const auditFailure = createHarness({
    audit: async (name) => {
      if (name === "systemd.fixed_unit_incident_repair_promoted") throw new Error("event hub unavailable");
      return { ok: true };
    },
  });
  const validTriage = await auditFailure.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true });
  await assert.rejects(
    () => auditFailure.builders.createFixedUnitIncidentRepairTask({ triageTaskId: validTriage.task.id, confirm: true }),
    /event hub unavailable/u,
  );
  assert.equal([...auditFailure.tasks.values()].some((task) => task.type === "systemd_next_repair_task"), false);
  assert.equal(auditFailure.approvals.size, 0);
});

test("fixed-unit incident repair promotion rejects recovery during route-gate preparation", async () => {
  const harness = createHarness({
    beforeRepairCreate: async ({ schedulerState }) => {
      schedulerState.units[TARGET.unit] = {
        status: "healthy",
        fingerprint: null,
        latestTaskId: SOURCE_TASK_ID,
      };
    },
  });
  const triage = await harness.builders.createFixedUnitIncidentTriageTask({ sourceTaskId: SOURCE_TASK_ID, confirm: true });

  await assert.rejects(
    () => harness.builders.createFixedUnitIncidentRepairTask({ triageTaskId: triage.task.id, confirm: true }),
    /source changed before task creation: source_incident_not_current/u,
  );
  assert.equal([...harness.tasks.values()].some((task) => task.type === "systemd_next_repair_task"), false);
  assert.equal(harness.approvals.size, 0);
});
