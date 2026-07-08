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
