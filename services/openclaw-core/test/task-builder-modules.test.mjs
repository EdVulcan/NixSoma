import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBodyEvidenceTaskBuilders } from "../src/body-evidence-task-builders.mjs";
import { createCloudConsciousnessHandoffBuilders } from "../src/cloud-consciousness-handoff-builders.mjs";
import { createCloudConsciousnessLiveProviderRunbookBuilders } from "../src/cloud-consciousness-live-provider-runbook-builders.mjs";
import { createCloudConsciousnessProviderCallRehearsalBuilders } from "../src/cloud-consciousness-provider-call-rehearsal-builders.mjs";
import { createCloudConsciousnessProviderDryRunBuilders } from "../src/cloud-consciousness-provider-dry-run-builders.mjs";
import { createLongTermMemoryBuilders } from "../src/long-term-memory-builders.mjs";
import { createSystemdTaskBuilders } from "../src/systemd-task-builders.mjs";
import { createTaskLifecycleHarness, createSystemdDryRunEnvelope } from "./task-builder-harness.mjs";

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

test("cloud consciousness provider dry-run builders preserve no-network route-review contracts", async () => {
  const { deps } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessProviderDryRunBuilders(deps);

  const plan = await builders.buildCloudConsciousnessProviderAdapterPlan();
  const envelope = await builders.buildCloudConsciousnessProviderRequestEnvelope();
  const routeReview = await builders.buildCloudConsciousnessProviderDryRunRouteReview();

  assert.equal(plan.registry, "openclaw-cloud-consciousness-provider-adapter-plan-v0");
  assert.equal(plan.summary.ready, true);
  assert.equal(envelope.envelope.sourceHandoff.contentHash, "hash-cloud-handoff");
  assert.equal(envelope.envelope.governance.networkCall, false);
  assert.equal(routeReview.decision.selectedSlice, "openclaw-cloud-consciousness-provider-dry-run-task");
  assert.equal(routeReview.decision.canCallCloudProviderNow, false);
});

test("cloud consciousness provider dry-run builders create approval-gated dry-run tasks", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessProviderDryRunBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessProviderDryRunTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createCloudConsciousnessProviderDryRunTask({ confirm: true });

  assert.equal(result.registry, "openclaw-cloud-consciousness-provider-dry-run-task-v0");
  assert.equal(result.task.type, "cloud_consciousness_provider_dry_run_task");
  assert.equal(result.task.cloudConsciousnessProviderDryRun.artifactWritten, false);
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

test("cloud consciousness provider dry-run builders execute approved dry-runs without network", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-provider-dry-run-test-"));
  const dryRunFile = path.join(tempDir, "provider-dry-run.jsonl");
  const { deps, calls, events } = createTaskLifecycleHarness({
    deps: {
      CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH: dryRunFile,
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
  const builders = createCloudConsciousnessProviderDryRunBuilders(deps);
  const task = {
    id: "task-provider-dry-run",
    type: "cloud_consciousness_provider_dry_run_task",
    status: "queued",
    approval: { requestId: "approval-provider-dry-run", status: "approved" },
    cloudConsciousnessProviderDryRun: {
      registry: "openclaw-cloud-consciousness-provider-dry-run-task-v0",
    },
  };

  try {
    assert.equal(builders.isCloudConsciousnessProviderDryRunTask(task), true);

    const result = await builders.executeCloudConsciousnessProviderDryRunTask(task);

    assert.equal(result.execution.registry, "openclaw-cloud-consciousness-approved-provider-dry-run-v0");
    assert.equal(result.execution.hostMutation, true);
    assert.equal(result.execution.transmittedExternally, false);
    assert.equal(result.execution.cloudCallExecuted, false);
    assert.equal(result.execution.providerSdkLoaded, false);
    assert.equal(result.task.cloudConsciousnessProviderDryRun.artifactWritten, true);
    assert.equal(calls.find((call) => call.name === "postJson")?.url, "http://127.0.0.1:4106/system/files/append-text");
    assert.equal(calls.some((call) => call.name === "setTaskPhase" && call.phase === "cloud_consciousness_provider_dry_run_write"), true);
    assert.equal(calls.at(-1).name, "completeTask");
    assert.equal(events.at(-1).name, "cloud_consciousness.provider_dry_run_written");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("cloud consciousness provider call rehearsal builders preserve no-network preflight contracts", async () => {
  const { deps } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessProviderCallRehearsalBuilders(deps);

  const plan = await builders.buildCloudConsciousnessRealProviderCallPlan();
  const preflight = await builders.buildCloudConsciousnessProviderCredentialPreflight();
  const routeReview = await builders.buildCloudConsciousnessRealProviderCallRouteReview();

  assert.equal(plan.registry, "openclaw-cloud-consciousness-real-provider-call-plan-v0");
  assert.equal(plan.summary.ready, true);
  assert.equal(preflight.summary.providerCredentialRead, false);
  assert.equal(preflight.preflight.credentialValueRead, false);
  assert.equal(routeReview.decision.selectedSlice, "openclaw-cloud-consciousness-real-provider-call-task");
  assert.equal(routeReview.decision.canCallCloudProviderNow, false);
});

test("cloud consciousness provider call rehearsal builders create approval-gated tasks", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessProviderCallRehearsalBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessProviderCallRehearsalTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createCloudConsciousnessProviderCallRehearsalTask({ confirm: true });

  assert.equal(result.registry, "openclaw-cloud-consciousness-real-provider-call-task-v0");
  assert.equal(result.task.type, "cloud_consciousness_provider_call_rehearsal_task");
  assert.equal(result.task.cloudConsciousnessProviderCallRehearsal.artifactWritten, false);
  assert.equal(result.task.cloudConsciousnessProviderCallRehearsal.credentialRead, false);
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

test("cloud consciousness provider call rehearsal builders execute approved rehearsals without credentials or network", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-provider-call-rehearsal-test-"));
  const responseFile = path.join(tempDir, "provider-response-rehearsal.jsonl");
  const { deps, calls, events } = createTaskLifecycleHarness({
    deps: {
      CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH: responseFile,
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
  const builders = createCloudConsciousnessProviderCallRehearsalBuilders(deps);
  const task = {
    id: "task-provider-call-rehearsal",
    type: "cloud_consciousness_provider_call_rehearsal_task",
    status: "queued",
    approval: { requestId: "approval-provider-call-rehearsal", status: "approved" },
    cloudConsciousnessProviderCallRehearsal: {
      registry: "openclaw-cloud-consciousness-real-provider-call-task-v0",
    },
  };

  try {
    assert.equal(builders.isCloudConsciousnessProviderCallRehearsalTask(task), true);

    const result = await builders.executeCloudConsciousnessProviderCallRehearsalTask(task);

    assert.equal(result.execution.registry, "openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0");
    assert.equal(result.execution.hostMutation, true);
    assert.equal(result.execution.transmittedExternally, false);
    assert.equal(result.execution.cloudCallExecuted, false);
    assert.equal(result.execution.providerSdkLoaded, false);
    assert.equal(result.execution.credentialRead, false);
    assert.equal(result.task.cloudConsciousnessProviderCallRehearsal.artifactWritten, true);
    assert.equal(result.task.cloudConsciousnessProviderCallRehearsal.credentialRead, false);
    assert.equal(calls.find((call) => call.name === "postJson")?.url, "http://127.0.0.1:4106/system/files/append-text");
    assert.equal(calls.some((call) => call.name === "setTaskPhase" && call.phase === "cloud_consciousness_provider_response_rehearsal_write"), true);
    assert.equal(calls.at(-1).name, "completeTask");
    assert.equal(events.at(-1).name, "cloud_consciousness.provider_call_rehearsal_written");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("cloud consciousness live provider runbook builders preserve non-live route contracts", async () => {
  const { deps } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessLiveProviderRunbookBuilders(deps);

  const runbook = await builders.buildCloudConsciousnessLiveProviderCallRunbook();
  const authorization = await builders.buildCloudConsciousnessLiveProviderFinalAuthorizationReview();
  const routeReview = await builders.buildCloudConsciousnessLiveProviderRunbookRouteReview();

  assert.equal(runbook.registry, "openclaw-cloud-consciousness-live-provider-call-runbook-v0");
  assert.equal(runbook.summary.ready, true);
  assert.equal(authorization.summary.liveProviderCallEnabled, false);
  assert.equal(authorization.summary.providerCredentialRead, false);
  assert.equal(routeReview.decision.selectedSlice, "openclaw-cloud-consciousness-live-provider-runbook-task");
  assert.equal(routeReview.decision.canCallCloudProviderNow, false);
});

test("cloud consciousness live provider runbook builders create approval-gated tasks", async () => {
  const { deps, calls, events } = createTaskLifecycleHarness();
  const builders = createCloudConsciousnessLiveProviderRunbookBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderRunbookTask({ confirm: false }),
    /requires confirm=true/,
  );

  const result = await builders.createCloudConsciousnessLiveProviderRunbookTask({ confirm: true });

  assert.equal(result.registry, "openclaw-cloud-consciousness-live-provider-call-runbook-task-v0");
  assert.equal(result.task.type, "cloud_consciousness_live_provider_runbook_task");
  assert.equal(result.task.cloudConsciousnessLiveProviderRunbook.artifactWritten, false);
  assert.equal(result.task.cloudConsciousnessLiveProviderRunbook.liveProviderCallEnabled, false);
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

test("cloud consciousness live provider runbook builders execute approved runbooks without live egress", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-live-provider-runbook-test-"));
  const runbookFile = path.join(tempDir, "live-provider-call-runbook.jsonl");
  const { deps, calls, events } = createTaskLifecycleHarness({
    deps: {
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH: runbookFile,
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
  const builders = createCloudConsciousnessLiveProviderRunbookBuilders(deps);
  const task = {
    id: "task-live-provider-runbook",
    type: "cloud_consciousness_live_provider_runbook_task",
    status: "queued",
    approval: { requestId: "approval-live-provider-runbook", status: "approved" },
    cloudConsciousnessLiveProviderRunbook: {
      registry: "openclaw-cloud-consciousness-live-provider-call-runbook-task-v0",
    },
  };

  try {
    assert.equal(builders.isCloudConsciousnessLiveProviderRunbookTask(task), true);

    const result = await builders.executeCloudConsciousnessLiveProviderRunbookTask(task);

    assert.equal(result.execution.registry, "openclaw-cloud-consciousness-approved-live-provider-runbook-v0");
    assert.equal(result.execution.hostMutation, true);
    assert.equal(result.execution.transmittedExternally, false);
    assert.equal(result.execution.cloudCallExecuted, false);
    assert.equal(result.execution.providerSdkLoaded, false);
    assert.equal(result.execution.credentialRead, false);
    assert.equal(result.execution.liveProviderCallEnabled, false);
    assert.equal(result.task.cloudConsciousnessLiveProviderRunbook.artifactWritten, true);
    assert.equal(result.task.cloudConsciousnessLiveProviderRunbook.liveProviderCallEnabled, false);
    assert.equal(calls.find((call) => call.name === "postJson")?.url, "http://127.0.0.1:4106/system/files/append-text");
    assert.equal(calls.some((call) => call.name === "setTaskPhase" && call.phase === "cloud_consciousness_live_provider_runbook_write"), true);
    assert.equal(calls.at(-1).name, "completeTask");
    assert.equal(events.at(-1).name, "cloud_consciousness.live_provider_runbook_written");
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
