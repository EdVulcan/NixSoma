import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { registerRoutes } from "../src/route-handlers.mjs";

function createBaseDeps(overrides = {}) {
  const state = {
    tasks: new Map(),
    approvals: new Map(),
    runtimeState: {},
    policyAuditLog: [],
    capabilityInvocationLog: [],
    autonomyMode: "guardian",
    updateRuntimeState: () => {},
    persistState: () => {},
    loadPersistentState: () => {},
    ...overrides.state,
  };

  return {
    state,
    client: {
      fetchJson: async () => ({ ok: true }),
      postJson: async () => ({ ok: true }),
      readJsonFileIfPresent: () => null,
      buildSystemSenseUrl: (pathname) => `http://127.0.0.1:4106${pathname}`,
      ...overrides.client,
    },
    policyEvaluator: {
      ensureTaskPolicy: (task) => task.policy ?? null,
      buildPolicyState: () => ({}),
      evaluatePolicyIntent: () => ({}),
      recordPolicyDecision: (decision) => decision,
      ...overrides.policyEvaluator,
    },
    approvalEngine: {
      serialiseApproval: (approval) => approval,
      listApprovals: () => [],
      buildApprovalSummary: () => ({}),
      reconcileApprovalExpirations: () => {},
      ...overrides.approvalEngine,
    },
    taskManager: {
      serialiseTask: (task) => task,
      listTasks: () => [],
      getActiveTasks: () => [],
      buildTaskSummary: () => ({}),
      ...overrides.taskManager,
    },
    pluginReview: { ...overrides.pluginReview },
    workspaceOps: { ...overrides.workspaceOps },
    planBuilder: { ...overrides.planBuilder },
    executor: {
      listCommandTranscriptRecords: () => [],
      buildCommandTranscriptSummary: () => ({ total: 0, taskIds: new Set() }),
      serialiseCommandTranscriptSummary: (summary) => ({
        ...summary,
        taskIds: [...(summary.taskIds ?? [])],
        taskCount: summary.taskIds?.size ?? 0,
      }),
      listFilesystemChangeRecords: () => [],
      buildFilesystemChangeSummary: () => ({ total: 0, taskIds: new Set() }),
      serialiseFilesystemChangeSummary: (summary) => ({
        ...summary,
        taskIds: [...(summary.taskIds ?? [])],
        taskCount: summary.taskIds?.size ?? 0,
      }),
      listFilesystemReadRecords: () => [],
      buildFilesystemReadSummary: () => ({ total: 0, taskIds: new Set() }),
      serialiseFilesystemReadSummary: (summary) => ({
        ...summary,
        taskIds: [...(summary.taskIds ?? [])],
        taskCount: summary.taskIds?.size ?? 0,
      }),
      buildOperatorState: () => ({}),
      buildOperatorOptions: () => ({}),
      ...overrides.executor,
    },
    publishEvent: async () => {},
    host: "127.0.0.1",
    port: 4100,
    stateFilePath: "/tmp/openclaw-core-test-state.json",
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    browserRuntimeUrl: "http://127.0.0.1:4103",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    ...overrides.deps,
  };
}

async function invokeRoute(deps, method, path, body = null) {
  const handler = registerRoutes(deps);
  const chunks = body === null ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {};

  let statusCode = null;
  let headers = null;
  let payload = "";
  const res = {
    writeHead(code, responseHeaders) {
      statusCode = code;
      headers = responseHeaders;
    },
    end(chunk = "") {
      payload = String(chunk);
    },
  };

  await handler(req, res, new URL(path, "http://127.0.0.1:4100"));
  return {
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
  };
}

test("executor-backed transcript route clamps limits and returns the public read model", async () => {
  let observedLimit = null;
  const deps = createBaseDeps({
    executor: {
      listCommandTranscriptRecords: ({ limit }) => {
        observedLimit = limit;
        return [
          { taskId: "task-2", state: "failed" },
          { taskId: "task-1", state: "executed" },
        ];
      },
      buildCommandTranscriptSummary: () => ({
        total: 2,
        executed: 1,
        failed: 1,
        skipped: 0,
        taskIds: new Set(["task-2", "task-1"]),
      }),
      serialiseCommandTranscriptSummary: (summary) => ({
        total: summary.total,
        executed: summary.executed,
        failed: summary.failed,
        skipped: summary.skipped,
        taskIds: [...summary.taskIds],
        taskCount: summary.taskIds.size,
      }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/commands/transcripts?limit=999");

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.equal(observedLimit, 100);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.count, 2);
  assert.deepEqual(response.body.items.map((item) => item.taskId), ["task-2", "task-1"]);
  assert.deepEqual(response.body.summary, {
    total: 2,
    executed: 1,
    failed: 1,
    skipped: 0,
    taskIds: ["task-2", "task-1"],
    taskCount: 2,
  });
});

test("capability invocation route preserves fallback limit and summary contract", async () => {
  let observedQuery = null;
  const deps = createBaseDeps({
    state: {
      capabilityInvocationLog: [{ id: "entry-1" }, { id: "entry-2" }, { id: "entry-3" }],
    },
    planBuilder: {
      listCapabilityInvocations: (query) => {
        observedQuery = query;
        return [{ id: "entry-2", capabilityId: "sense.filesystem.read" }];
      },
      buildCapabilityInvocationSummary: () => ({
        total: 3,
        byCapability: { "sense.filesystem.read": 1 },
      }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/capabilities/invocations?limit=bad&capabilityId=sense.filesystem.read");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(observedQuery, { limit: 20, capabilityId: "sense.filesystem.read" });
  assert.equal(response.body.ok, true);
  assert.equal(response.body.count, 3);
  assert.deepEqual(response.body.items, [{ id: "entry-2", capabilityId: "sense.filesystem.read" }]);
  assert.deepEqual(response.body.summary, {
    total: 3,
    byCapability: { "sense.filesystem.read": 1 },
  });
});

test("filesystem change route clamps limits and returns serialised summary", async () => {
  let observedLimit = null;
  const deps = createBaseDeps({
    executor: {
      listFilesystemChangeRecords: ({ limit }) => {
        observedLimit = limit;
        return [{ taskId: "task-write", capabilityId: "act.filesystem.write_text" }];
      },
      buildFilesystemChangeSummary: () => ({
        total: 1,
        byCapability: { "act.filesystem.write_text": 1 },
        taskIds: new Set(["task-write"]),
      }),
      serialiseFilesystemChangeSummary: (summary) => ({
        total: summary.total,
        byCapability: summary.byCapability,
        taskIds: [...summary.taskIds],
        taskCount: summary.taskIds.size,
      }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/filesystem/changes?limit=999");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(observedLimit, 100);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.count, 1);
  assert.deepEqual(response.body.items, [{ taskId: "task-write", capabilityId: "act.filesystem.write_text" }]);
  assert.deepEqual(response.body.summary, {
    total: 1,
    byCapability: { "act.filesystem.write_text": 1 },
    taskIds: ["task-write"],
    taskCount: 1,
  });
});

test("filesystem read summary route returns serialised executor summary", async () => {
  const deps = createBaseDeps({
    executor: {
      buildFilesystemReadSummary: () => ({
        total: 2,
        byIntent: { "filesystem.read_text": 2 },
        taskIds: new Set(["task-read-a", "task-read-b"]),
      }),
      serialiseFilesystemReadSummary: (summary) => ({
        total: summary.total,
        byIntent: summary.byIntent,
        taskIds: [...summary.taskIds],
        taskCount: summary.taskIds.size,
      }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/filesystem/reads/summary");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.summary, {
    total: 2,
    byIntent: { "filesystem.read_text": 2 },
    taskIds: ["task-read-a", "task-read-b"],
    taskCount: 2,
  });
});

test("capability invoke POST remains on the mutable route path", async () => {
  let observedBody = null;
  const deps = createBaseDeps({
    planBuilder: {
      invokeCapability: async (body) => {
        observedBody = body;
        return {
          statusCode: 202,
          response: { ok: true, accepted: true, capabilityId: body.capabilityId },
        };
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/capabilities/invoke", { capabilityId: "sense.filesystem.read" });

  assert.equal(response.statusCode, 202, JSON.stringify(response.body));
  assert.deepEqual(observedBody, { capabilityId: "sense.filesystem.read" });
  assert.deepEqual(response.body, {
    ok: true,
    accepted: true,
    capabilityId: "sense.filesystem.read",
  });
});

test("approval route group filters inbox items and clamps limits", async () => {
  const deps = createBaseDeps({
    approvalEngine: {
      listApprovals: () => [
        { id: "approval-1", status: "pending" },
        { id: "approval-2", status: "pending" },
        { id: "approval-3", status: "approved" },
      ],
      buildApprovalSummary: () => ({
        counts: { total: 3, pending: 2, approved: 1, denied: 0, expired: 0 },
      }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/approvals?status=pending&limit=1");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true);
  assert.equal(response.body.count, 1);
  assert.deepEqual(response.body.items, [{ id: "approval-1", status: "pending" }]);
  assert.deepEqual(response.body.summary, {
    counts: { total: 3, pending: 2, approved: 1, denied: 0, expired: 0 },
  });
});

test("approval approve route publishes approval event and serialises contracts", async () => {
  const approval = { id: "approval-approve", status: "pending" };
  const task = { id: "task-approve", status: "queued" };
  const events = [];
  let approveInput = null;
  const deps = createBaseDeps({
    state: {
      approvals: new Map([[approval.id, approval]]),
    },
    approvalEngine: {
      serialiseApproval: (item) => ({ id: item.id, status: item.status, serialised: true }),
      buildApprovalSummary: () => ({ counts: { approved: 1, pending: 0 } }),
      markApprovalApproved: (item, input) => {
        approveInput = { item, input };
        item.status = "approved";
        return { approval: item, task };
      },
    },
    taskManager: {
      serialiseTask: (item) => ({ id: item.id, status: item.status, serialised: true }),
    },
    deps: {
      publishEvent: async (type, payload) => {
        events.push({ type, payload });
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/approvals/approval-approve/approve", {
    approvedBy: " operator ",
    reason: " approve route extraction ",
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(approveInput.item, approval);
  assert.deepEqual(approveInput.input, {
    approvedBy: "operator",
    reason: "approve route extraction",
  });
  assert.deepEqual(events, [{
    type: "approval.approved",
    payload: {
      approval: { id: "approval-approve", status: "approved", serialised: true },
      task: { id: "task-approve", status: "queued", serialised: true },
    },
  }]);
  assert.deepEqual(response.body, {
    ok: true,
    approval: { id: "approval-approve", status: "approved", serialised: true },
    task: { id: "task-approve", status: "queued", serialised: true },
    summary: { counts: { approved: 1, pending: 0 } },
  });
});

test("approval deny route publishes task failure when denial fails a task", async () => {
  const approval = { id: "approval-deny", status: "pending" };
  const task = { id: "task-deny", status: "queued" };
  const events = [];
  const deps = createBaseDeps({
    state: {
      approvals: new Map([[approval.id, approval]]),
    },
    approvalEngine: {
      serialiseApproval: (item) => ({ id: item.id, status: item.status, serialised: true }),
      buildApprovalSummary: () => ({ counts: { denied: 1, pending: 0 } }),
      markApprovalDenied: (item, input) => {
        assert.deepEqual(input, {
          deniedBy: "user",
          reason: "Denied by user.",
        });
        item.status = "denied";
        task.status = "failed";
        return { approval: item, task };
      },
    },
    taskManager: {
      serialiseTask: (item) => ({ id: item.id, status: item.status, serialised: true }),
    },
    deps: {
      publishEvent: async (type, payload) => {
        events.push({ type, payload });
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/approvals/approval-deny/deny", {});

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(events.map((event) => event.type), ["approval.denied", "task.failed"]);
  assert.deepEqual(events[1].payload, {
    task: { id: "task-deny", status: "failed", serialised: true },
    reason: "Approval denied by user.",
    approval: { id: "approval-deny", status: "denied", serialised: true },
  });
  assert.deepEqual(response.body, {
    ok: true,
    approval: { id: "approval-deny", status: "denied", serialised: true },
    task: { id: "task-deny", status: "failed", serialised: true },
    summary: { counts: { denied: 1, pending: 0 } },
  });
});

test("operator run route serialises loop steps and next task", async () => {
  let observedBody = null;
  const deps = createBaseDeps({
    executor: {
      runOperatorLoop: async (body) => {
        observedBody = body;
        return {
          ran: true,
          blocked: false,
          dryRun: true,
          nextTask: { id: "task-next", status: "queued" },
          steps: [{
            task: { id: "task-step", status: "completed", policy: { decision: "audit_only" } },
            execution: { id: "execution-step" },
          }],
          operator: { mode: "loop-test" },
          summary: { completed: 1 },
        };
      },
      serialiseExecutionResult: (result) => ({ id: result.id, serialised: true }),
    },
    taskManager: {
      serialiseTask: (task) => ({ id: task.id, status: task.status, serialised: true }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/operator/run", { maxSteps: 2, dryRun: true });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(observedBody, { maxSteps: 2, dryRun: true });
  assert.deepEqual(response.body, {
    ok: true,
    ran: true,
    count: 1,
    blocked: false,
    reason: null,
    dryRun: true,
    nextTask: { id: "task-next", status: "queued", serialised: true },
    steps: [{
      task: { id: "task-step", status: "completed", serialised: true },
      execution: { id: "execution-step", serialised: true },
      policy: "audit_only",
    }],
    operator: { mode: "loop-test" },
    summary: { completed: 1 },
  });
});

test("control stop route fails current task and emits task failed event", async () => {
  const task = { id: "task-stop", status: "running", updatedAt: "2026-07-08T00:00:00.000Z" };
  const phases = [];
  const events = [];
  let reconciled = false;
  const runtimeState = { currentTaskId: task.id };
  const deps = createBaseDeps({
    state: { runtimeState },
    taskManager: {
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      appendTaskPhase: (item, phase, details) => {
        phases.push({ item, phase, details });
        return item;
      },
      reconcileRuntimeState: () => {
        reconciled = true;
      },
      serialiseTask: (item) => ({
        id: item.id,
        status: item.status,
        outcome: item.outcome,
        closedAt: item.closedAt,
      }),
    },
    deps: {
      publishEvent: async (type, payload) => {
        events.push({ type, payload });
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/control/stop", {});

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(task.status, "failed");
  assert.deepEqual(phases, [{ item: task, phase: "failed", details: { reason: "Stopped by operator." } }]);
  assert.equal(reconciled, true);
  assert.deepEqual(events, [{
    type: "task.failed",
    payload: {
      task: {
        id: "task-stop",
        status: "failed",
        outcome: {
          kind: "failed",
          summary: "Stopped by operator.",
          reason: "Stopped by operator.",
          at: "2026-07-08T00:00:00.000Z",
        },
        closedAt: "2026-07-08T00:00:00.000Z",
      },
      reason: "Stopped by operator.",
    },
  }]);
  assert.deepEqual(response.body, {
    ok: true,
    task: {
      id: "task-stop",
      status: "failed",
      outcome: {
        kind: "failed",
        summary: "Stopped by operator.",
        reason: "Stopped by operator.",
        at: "2026-07-08T00:00:00.000Z",
      },
      closedAt: "2026-07-08T00:00:00.000Z",
    },
    runtime: { currentTaskId: "task-stop" },
  });
});

test("body evidence follow-up task route forwards confirm and serialises task shell contracts", async () => {
  const calls = [];
  const deps = createBaseDeps({
    planBuilder: {
      createBodyEvidenceLedgerFollowupRecordTaskShell: async (input) => {
        calls.push(input);
        return {
          registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
          mode: "approval-gated-ledger-followup-record-task-shell",
          generatedAt: "2026-07-08T00:00:00.000Z",
          sourceRegistry: "openclaw-body-evidence-ledger-followup-record-route-review-v0",
          routeReview: { selectedSlice: "openclaw-body-evidence-ledger-followup-record-task" },
          followupRecord: { plannedSequence: 2, recordAppended: false },
          task: { id: "task-followup", type: "body_evidence_ledger_followup_record_task" },
          approval: { id: "approval-followup", status: "pending" },
          governance: { createsTask: true, createsApproval: true, canWriteLedger: false },
        };
      },
    },
    taskManager: {
      serialiseTask: (task) => ({ id: task.id, serialised: true }),
      buildTaskSummary: () => ({ total: 1, queued: 1 }),
    },
    approvalEngine: {
      serialiseApproval: (approval) => ({ id: approval.id, status: approval.status, serialised: true }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/body/evidence-ledger/followup-record-tasks", { confirm: true });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.deepEqual(calls, [{ confirm: true }]);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.registry, "openclaw-body-evidence-ledger-followup-record-task-v0");
  assert.equal(response.body.mode, "approval-gated-ledger-followup-record-task-shell");
  assert.equal(response.body.sourceRegistry, "openclaw-body-evidence-ledger-followup-record-route-review-v0");
  assert.deepEqual(response.body.followupRecord, { plannedSequence: 2, recordAppended: false });
  assert.deepEqual(response.body.task, { id: "task-followup", serialised: true });
  assert.deepEqual(response.body.approval, { id: "approval-followup", status: "pending", serialised: true });
  assert.deepEqual(response.body.governance, { createsTask: true, createsApproval: true, canWriteLedger: false });
  assert.deepEqual(response.body.summary, { total: 1, queued: 1 });
});

test("credential post route group forwards confirm and serialises task approval contracts", async () => {
  const calls = [];
  const deps = createBaseDeps({
    planBuilder: {
      createCloudConsciousnessLiveProviderCredentialValueLocalReadTask: async (input) => {
        calls.push(input);
        return {
          registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0",
          mode: "approval-gated-local-read-task",
          generatedAt: "2026-07-08T00:00:00.000Z",
          sourceRegistry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route-v0",
          route: { selectedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task" },
          task: { id: "task-local-read", type: "cloud_consciousness_live_provider_credential_value_local_read_task" },
          approval: { id: "approval-local-read", status: "pending" },
          governance: { createsTask: true, createsApproval: true, credentialValueRead: false },
        };
      },
    },
    taskManager: {
      serialiseTask: (task) => ({ id: task.id, serialised: true }),
      buildTaskSummary: () => ({ total: 2, queued: 1 }),
    },
    approvalEngine: {
      serialiseApproval: (approval) => ({ id: approval.id, status: approval.status, serialised: true }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/cloud-consciousness/live-provider-credential-value-local-read-tasks", { confirm: true });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.deepEqual(calls, [{ confirm: true }]);
  assert.equal(response.body.registry, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0");
  assert.equal(response.body.sourceRegistry, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route-v0");
  assert.deepEqual(response.body.route, { selectedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task" });
  assert.deepEqual(response.body.task, { id: "task-local-read", serialised: true });
  assert.deepEqual(response.body.approval, { id: "approval-local-read", status: "pending", serialised: true });
  assert.deepEqual(response.body.governance, { createsTask: true, createsApproval: true, credentialValueRead: false });
  assert.deepEqual(response.body.summary, { total: 2, queued: 1 });
});

test("credential post route group preserves raw preflight task response contracts", async () => {
  const rawTask = { id: "preflight-task", raw: true };
  const deps = createBaseDeps({
    planBuilder: {
      recordCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight: async (input) => ({
        registry: "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0",
        mode: "credential_value_final_readiness_preflight",
        generatedAt: "2026-07-08T00:00:00.000Z",
        status: input.confirm ? "recorded" : "blocked",
        preflight: { ready: true },
        task: rawTask,
        governance: { createsTask: false, credentialValueRead: false },
      }),
    },
    taskManager: {
      serialiseTask: () => {
        throw new Error("raw preflight task should not be serialised");
      },
      buildTaskSummary: () => ({ total: 3 }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/cloud-consciousness/live-provider-credential-value-final-readiness-preflight", { confirm: true });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.equal(response.body.status, "recorded");
  assert.deepEqual(response.body.preflight, { ready: true });
  assert.deepEqual(response.body.task, rawTask);
  assert.deepEqual(response.body.summary, { total: 3 });
});

test("live provider task post route group forwards confirm and preserves task response extras", async () => {
  const calls = [];
  const deps = createBaseDeps({
    planBuilder: {
      createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask: async (input) => {
        calls.push(input);
        return {
          registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
          mode: "approval-gated-runtime-adapter-module-task",
          generatedAt: "2026-07-08T00:00:00.000Z",
          sourceRegistry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0",
          moduleContract: { module: "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs" },
          task: { id: "task-runtime-module", type: "cloud_consciousness_live_provider_runtime_adapter_module_task" },
          approval: { id: "approval-runtime-module", status: "pending" },
          governance: { createsTask: true, createsApproval: true, liveProviderCallEnabled: false },
        };
      },
    },
    taskManager: {
      serialiseTask: (task) => ({ id: task.id, serialised: true }),
      buildTaskSummary: () => ({ total: 4, queued: 1 }),
    },
    approvalEngine: {
      serialiseApproval: (approval) => ({ id: approval.id, status: approval.status, serialised: true }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/cloud-consciousness/live-provider-runtime-adapter-module-tasks", { confirm: true });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.deepEqual(calls, [{ confirm: true }]);
  assert.equal(response.body.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0");
  assert.equal(response.body.sourceRegistry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0");
  assert.deepEqual(response.body.moduleContract, { module: "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs" });
  assert.deepEqual(response.body.task, { id: "task-runtime-module", serialised: true });
  assert.deepEqual(response.body.approval, { id: "approval-runtime-module", status: "pending", serialised: true });
  assert.deepEqual(response.body.governance, { createsTask: true, createsApproval: true, liveProviderCallEnabled: false });
  assert.deepEqual(response.body.summary, { total: 4, queued: 1 });
});
