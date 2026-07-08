import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBodyEvidenceTaskBuilders } from "../src/body-evidence-task-builders.mjs";
import { createCloudConsciousnessHandoffBuilders } from "../src/cloud-consciousness-handoff-builders.mjs";
import { createLongTermMemoryBuilders } from "../src/long-term-memory-builders.mjs";
import { createSystemdTaskBuilders } from "../src/systemd-task-builders.mjs";

function createTaskLifecycleHarness(overrides = {}) {
  const calls = [];
  const events = [];
  const fetchUrls = [];
  let taskCounter = 0;
  const deps = {
    fetchJson: async (url) => {
      fetchUrls.push(url);
      return overrides.fetchJson ? overrides.fetchJson(url) : {};
    },
    postJson: async (url, body) => {
      calls.push({ name: "postJson", url, body });
      return overrides.postJson ? overrides.postJson(url, body) : {};
    },
    systemSenseUrl: "http://127.0.0.1:4106",
    evaluatePolicyIntent: (input, context) => ({
      id: `policy-${context.stage}`,
      decision: "require_approval",
      domain: input.policy?.domain ?? "body_internal",
      risk: input.policy?.risk ?? "medium",
      reason: "approval_required",
      approved: false,
      autonomyMode: "guardian",
      autonomous: false,
      input,
      context,
    }),
    createTask: (input, options) => {
      calls.push({ name: "createTask", input, options });
      taskCounter += 1;
      return {
        id: `task-${taskCounter}`,
        phase: "queued",
        ...input,
      };
    },
    createApprovalRequestForTask: (task, policy) => {
      calls.push({ name: "createApprovalRequestForTask", taskId: task.id, policy });
      const approval = {
        id: `approval-${task.id}`,
        status: "pending",
        required: true,
      };
      task.approval = approval;
      return approval;
    },
    supersedeOtherActiveTasks: () => {
      calls.push({ name: "supersedeOtherActiveTasks" });
      return [{ id: "reclaimed-task", type: "old_task", phase: "superseded" }];
    },
    reconcileRuntimeState: () => {
      calls.push({ name: "reconcileRuntimeState" });
    },
    persistState: () => {
      calls.push({ name: "persistState" });
    },
    completeTask: (task, details) => {
      calls.push({ name: "completeTask", taskId: task.id, details });
      return {
        ...task,
        status: "completed",
        outcome: {
          kind: details?.executor ?? "completed",
          details,
        },
      };
    },
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
    publishTaskApprovalIfPending: async (task) => {
      events.push({ name: "approval.pending", body: { taskId: task.id } });
    },
    serialiseTask: (task) => ({
      id: task.id,
      type: task.type,
      goal: task.goal,
      phase: task.phase,
      approval: task.approval ?? null,
      policy: task.policy ?? null,
      plan: task.plan ?? null,
      systemdRepair: task.systemdRepair ?? null,
      systemdNextRepair: task.systemdNextRepair ?? null,
      longTermMemoryWrite: task.longTermMemoryWrite ?? null,
      cloudConsciousnessHandoff: task.cloudConsciousnessHandoff ?? null,
      bodyEvidenceLedgerDirectory: task.bodyEvidenceLedgerDirectory ?? null,
      bodyEvidenceLedgerFirstRecord: task.bodyEvidenceLedgerFirstRecord ?? null,
      bodyEvidenceLedgerFollowupRecord: task.bodyEvidenceLedgerFollowupRecord ?? null,
    }),
    serialisePlanForPublic: (plan) => plan,
    setTaskPhase: async (task, phase, patch = {}) => {
      calls.push({ name: "setTaskPhase", taskId: task.id, phase, patch });
      task.phase = phase;
      task.status = patch.status ?? task.status;
    },
    isTaskPolicyApproved: (task) => task.approval?.status === "approved",
    buildPhase6Exit: async () => ({
      ok: true,
      registry: "openclaw-phase-6-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-long-term-memory-write-plan" },
    }),
    buildPhase6ConsciousnessContextEnvelope: async () => ({
      ok: true,
      registry: "openclaw-phase-6-consciousness-context-envelope-v0",
      summary: { memoryPointers: 3 },
      envelope: {
        bodyState: {
          healthOk: true,
          serviceCount: 8,
          alerts: [],
        },
      },
    }),
    buildLongTermMemoryExit: async () => ({
      ok: true,
      registry: "openclaw-long-term-memory-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-cloud-consciousness-context-review" },
    }),
    buildLongTermMemoryReadback: () => ({
      ok: true,
      registry: "openclaw-long-term-memory-readback-v0",
      ledger: {
        latest: {
          id: "long-term-memory-record",
          memoryType: "operational_lesson",
          contentHash: "hash-long-term-memory",
        },
      },
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "long-term-memory-record",
        latestContentHash: "hash-long-term-memory",
      },
    }),
    buildTaskSummary: () => ({
      counts: { queued: 1, completed: 2 },
      currentTaskId: null,
      currentTaskStatus: null,
    }),
    compactCloudConsciousnessEvidenceRef: (evidence) => ({
      registry: evidence?.registry ?? null,
      status: evidence?.status ?? null,
      summary: evidence?.summary ?? null,
    }),
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY: "openclaw-systemd-repair-execution-task-v0",
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY: "openclaw-systemd-next-repair-task-shell-v0",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY: "openclaw-systemd-next-repair-real-execution-v0",
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT: "openclaw-browser-runtime.service",
    SYSTEMD_REPAIR_RESTART_HELPER: "/run/current-system/sw/bin/openclaw-systemd-restart-openclaw-browser-runtime",
    SYSTEMD_REPAIR_AUTH_DELEGATION: "sudo-nopasswd-fixed-helper",
    LONG_TERM_MEMORY_TASK_REGISTRY: "openclaw-long-term-memory-write-task-v0",
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH: ".artifacts/openclaw-long-term-memory",
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH: ".artifacts/openclaw-long-term-memory/long-term-memory.jsonl",
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY: "openclaw-cloud-consciousness-handoff-task-v0",
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/context-handoff.jsonl",
    ...overrides.deps,
  };

  return { deps, calls, events, fetchUrls };
}

function createSystemdDryRunEnvelope(unit = "openclaw-browser-runtime.service") {
  return {
    ok: true,
    registry: "openclaw-systemd-repair-dry-run-v0",
    target: { unit },
    source: {
      inventoryRegistry: "openclaw-systemd-unit-inventory-v0",
      planRegistry: "openclaw-systemd-repair-plan-v0",
    },
    plan: {
      registry: "openclaw-systemd-repair-plan-v0",
      source: { inventoryRegistry: "openclaw-systemd-unit-inventory-v0" },
    },
    dryRun: {
      command: "systemctl",
      args: ["restart", unit],
    },
  };
}

test("systemd task builders create draft envelopes and preserve real-execution guard", async () => {
  const { deps, fetchUrls } = createTaskLifecycleHarness({
    fetchJson: () => createSystemdDryRunEnvelope(),
  });
  const builders = createSystemdTaskBuilders(deps);

  const draft = await builders.buildSystemdRepairExecutionTaskDraft({
    unit: "openclaw-browser-runtime",
  });

  assert.equal(fetchUrls[0], "http://127.0.0.1:4106/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service");
  assert.equal(draft.registry, "openclaw-systemd-repair-execution-task-v0");
  assert.equal(draft.mode, "operator-reviewed-execution-task-draft");
  assert.equal(draft.draft.policy.decision.context.stage, "systemd_repair_execution_task.draft");
  assert.equal(draft.draft.systemdRepair.execution.shellOnly, true);
  assert.equal(draft.draft.plan.steps[1].capabilityId, "act.system.heal");

  await assert.rejects(
    () => builders.buildSystemdRepairExecutionTaskDraft({
      unit: "openclaw-system-sense.service",
      execute: true,
    }),
    /Real systemd repair execution is limited/,
  );
});

test("systemd task builders enforce confirm gates and publish task lifecycle events", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness({
    fetchJson: () => createSystemdDryRunEnvelope(),
  });
  const builders = createSystemdTaskBuilders(deps);

  await assert.rejects(
    () => builders.createSystemdRepairExecutionTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createSystemdRepairExecutionTask({
    unit: "openclaw-browser-runtime.service",
    confirm: true,
  });

  assert.equal(result.task.type, "systemd_repair_execution_task");
  assert.equal(result.approval.status, "pending");
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "createTask",
      "createApprovalRequestForTask",
      "supersedeOtherActiveTasks",
      "reconcileRuntimeState",
      "persistState",
    ],
  );
  assert.deepEqual(
    events.map((event) => event.name),
    ["task.created", "approval.pending", "task.planned", "task.phase_changed"],
  );
});

test("long-term memory builders preserve Phase 7 plan and route-review contracts", async () => {
  const { deps } = createTaskLifecycleHarness();
  const builders = createLongTermMemoryBuilders(deps);

  const plan = await builders.buildLongTermMemoryWritePlan();
  const schema = await builders.buildLongTermMemorySchema();
  const proposal = await builders.buildLongTermMemoryProposal();
  const routeReview = await builders.buildLongTermMemoryWriteRouteReview();

  assert.equal(plan.registry, "openclaw-long-term-memory-write-plan-v0");
  assert.equal(plan.summary.ready, true);
  assert.equal(schema.schema.id, "openclaw.long_term_memory.v0");
  assert.equal(proposal.proposal.sourceRegistry, "openclaw-phase-6-consciousness-context-envelope-v0");
  assert.equal(routeReview.decision.selectedSlice, "openclaw-long-term-memory-write-task");
  assert.equal(routeReview.governance.callsCloudModel, false);
});

test("long-term memory builders create approval-gated write tasks", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness();
  const builders = createLongTermMemoryBuilders(deps);

  await assert.rejects(
    () => builders.createLongTermMemoryWriteTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createLongTermMemoryWriteTask({ confirm: true });

  assert.equal(result.registry, "openclaw-long-term-memory-write-task-v0");
  assert.equal(result.task.type, "long_term_memory_write_task");
  assert.equal(result.task.longTermMemoryWrite.recordAppended, false);
  assert.equal(result.governance.createsApproval, true);
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "createTask",
      "createApprovalRequestForTask",
      "supersedeOtherActiveTasks",
      "reconcileRuntimeState",
      "persistState",
    ],
  );
  assert.deepEqual(
    events.map((event) => event.name),
    ["task.created", "approval.pending", "task.planned", "task.phase_changed"],
  );
});

test("long-term memory builders execute approved appends through system-sense", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-ltm-test-"));
  const ledgerFile = path.join(tempDir, "long-term-memory.jsonl");
  const { deps, calls, events } = createTaskLifecycleHarness({
    deps: {
      LONG_TERM_MEMORY_DIR_DISPLAY_PATH: tempDir,
      LONG_TERM_MEMORY_FILE_DISPLAY_PATH: ledgerFile,
    },
    postJson: (url, body) => ({
      ok: true,
      mode: "append_text",
      path: body.path,
      root: tempDir,
      created: true,
      createIfMissing: body.createIfMissing,
      contentBytes: Buffer.byteLength(body.content, "utf8"),
      previousBytes: 0,
      totalBytes: Buffer.byteLength(body.content, "utf8"),
    }),
  });
  const builders = createLongTermMemoryBuilders(deps);
  const task = {
    id: "task-long-term-memory",
    type: "long_term_memory_write_task",
    status: "queued",
    approval: { requestId: "approval-long-term-memory", status: "approved" },
    longTermMemoryWrite: {
      registry: "openclaw-long-term-memory-write-task-v0",
    },
  };

  try {
    assert.equal(builders.isLongTermMemoryWriteTask(task), true);

    const result = await builders.executeLongTermMemoryWriteTask(task);

    assert.equal(result.execution.registry, "openclaw-long-term-memory-approved-write-v0");
    assert.equal(result.execution.hostMutation, true);
    assert.equal(result.execution.cloudCall, false);
    assert.equal(result.task.longTermMemoryWrite.recordAppended, true);
    assert.equal(calls.find((call) => call.name === "postJson")?.url, "http://127.0.0.1:4106/system/files/append-text");
    assert.equal(calls.some((call) => call.name === "setTaskPhase" && call.phase === "long_term_memory_record_append"), true);
    assert.equal(calls.at(-1).name, "completeTask");
    assert.equal(events.at(-1).name, "long_term_memory.record_appended");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("cloud consciousness handoff builders preserve local-only route-review contracts", async () => {
  const { deps } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessHandoffBuilders(deps);

  const contextReview = await builders.buildCloudConsciousnessContextReview();
  const contextPackage = await builders.buildCloudConsciousnessContextPackage();
  const routeReview = await builders.buildCloudConsciousnessTransmissionRouteReview();

  assert.equal(contextReview.registry, "openclaw-cloud-consciousness-context-review-v0");
  assert.equal(contextReview.summary.ready, true);
  assert.equal(contextPackage.package.memoryContext.latestContentHash, "hash-long-term-memory");
  assert.equal(contextPackage.package.transmission.networkCall, false);
  assert.equal(routeReview.decision.selectedSlice, "openclaw-cloud-consciousness-handoff-task");
  assert.equal(routeReview.decision.canCallCloudProviderNow, false);
});

test("cloud consciousness handoff builders create approval-gated local handoff tasks", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessHandoffBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessHandoffTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createCloudConsciousnessHandoffTask({ confirm: true });

  assert.equal(result.registry, "openclaw-cloud-consciousness-handoff-task-v0");
  assert.equal(result.task.type, "cloud_consciousness_handoff_task");
  assert.equal(result.task.cloudConsciousnessHandoff.artifactWritten, false);
  assert.equal(result.governance.createsApproval, true);
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "createTask",
      "createApprovalRequestForTask",
      "supersedeOtherActiveTasks",
      "reconcileRuntimeState",
      "persistState",
    ],
  );
  assert.deepEqual(
    events.map((event) => event.name),
    ["task.created", "approval.pending", "task.planned", "task.phase_changed"],
  );
});

test("cloud consciousness handoff builders execute approved local handoffs without transmission", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-cloud-handoff-test-"));
  const handoffFile = path.join(tempDir, "context-handoff.jsonl");
  const { deps, calls, events } = createTaskLifecycleHarness({
    deps: {
      CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH: handoffFile,
    },
    postJson: (url, body) => ({
      ok: true,
      mode: "append_text",
      path: body.path,
      root: tempDir,
      created: true,
      createIfMissing: body.createIfMissing,
      contentBytes: Buffer.byteLength(body.content, "utf8"),
      previousBytes: 0,
      totalBytes: Buffer.byteLength(body.content, "utf8"),
    }),
  });
  const builders = createCloudConsciousnessHandoffBuilders(deps);
  const task = {
    id: "task-cloud-handoff",
    type: "cloud_consciousness_handoff_task",
    status: "queued",
    approval: { requestId: "approval-cloud-handoff", status: "approved" },
    cloudConsciousnessHandoff: {
      registry: "openclaw-cloud-consciousness-handoff-task-v0",
    },
  };

  try {
    assert.equal(builders.isCloudConsciousnessHandoffTask(task), true);

    const result = await builders.executeCloudConsciousnessHandoffTask(task);

    assert.equal(result.execution.registry, "openclaw-cloud-consciousness-approved-handoff-v0");
    assert.equal(result.execution.hostMutation, true);
    assert.equal(result.execution.transmittedExternally, false);
    assert.equal(result.execution.cloudCallExecuted, false);
    assert.equal(result.task.cloudConsciousnessHandoff.artifactWritten, true);
    assert.equal(calls.find((call) => call.name === "postJson")?.url, "http://127.0.0.1:4106/system/files/append-text");
    assert.equal(calls.some((call) => call.name === "setTaskPhase" && call.phase === "cloud_consciousness_local_handoff_write"), true);
    assert.equal(calls.at(-1).name, "completeTask");
    assert.equal(events.at(-1).name, "cloud_consciousness.local_handoff_written");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("systemd candidate task shell preserves route-review failure boundary", async () => {
  const { deps } = createTaskLifecycleHarness({
    fetchJson: () => ({
      ok: true,
      registry: "openclaw-systemd-repair-candidate-task-route-v0",
      routeDecision: {
        existingRouteAvailable: false,
      },
    }),
  });
  const builders = createSystemdTaskBuilders(deps);

  await assert.rejects(
    () => builders.createSystemdRepairCandidateTaskShell({ confirm: true }),
    /not covered by an existing operator-reviewed task route/,
  );
});

test("body evidence task builders enforce confirm and route-review gates", async () => {
  const { deps } = createTaskLifecycleHarness({
    fetchJson: () => ({
      ok: true,
      registry: "openclaw-body-evidence-ledger-storage-root-route-review-v0",
      decision: { selectedSlice: "wrong-slice" },
      evidence: { rootInsideWorkspace: false },
    }),
  });
  const builders = createBodyEvidenceTaskBuilders(deps);

  await assert.rejects(
    () => builders.createBodyEvidenceLedgerDirectoryTaskShell({ confirm: false }),
    /requires confirm=true/,
  );
  await assert.rejects(
    () => builders.createBodyEvidenceLedgerDirectoryTaskShell({ confirm: true }),
    /requires a workspace-bounded storage-root route review/,
  );
});

test("body evidence task builders create ledger directory task shells with lifecycle events", async () => {
  const { deps, calls, events, fetchUrls } = createTaskLifecycleHarness({
    fetchJson: () => ({
      ok: true,
      registry: "openclaw-body-evidence-ledger-storage-root-route-review-v0",
      decision: { selectedSlice: "openclaw-body-evidence-ledger-directory-task" },
      evidence: {
        selectedRootId: "workspace-artifacts",
        selectedDisplayPath: ".artifacts/openclaw-body-evidence-ledger",
        rootInsideWorkspace: true,
      },
    }),
  });
  const builders = createBodyEvidenceTaskBuilders(deps);

  const result = await builders.createBodyEvidenceLedgerDirectoryTaskShell({ confirm: true });

  assert.equal(fetchUrls[0], "http://127.0.0.1:4106/system/route/body-evidence-ledger-storage-root-route-review");
  assert.equal(result.registry, "openclaw-body-evidence-ledger-directory-task-v0");
  assert.equal(result.task.type, "body_evidence_ledger_directory_task");
  assert.equal(result.ledgerDirectory.rootInsideWorkspace, true);
  assert.equal(result.governance.canCreateDirectory, false);
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "createTask",
      "createApprovalRequestForTask",
      "supersedeOtherActiveTasks",
      "reconcileRuntimeState",
      "persistState",
    ],
  );
  assert.deepEqual(
    events.map((event) => event.name),
    ["task.created", "approval.pending", "task.planned", "task.phase_changed"],
  );
});
