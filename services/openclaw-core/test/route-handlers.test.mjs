import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { registerRoutes } from "../src/route-handlers.mjs";
import { buildEyeHandRecoveryEvidence } from "../src/task-recovery.mjs";
import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
} from "../src/cloud-live-provider-runtime-response-contract.mjs";

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
    publishEvent: overrides.publishEvent ?? (async () => {}),
    host: "127.0.0.1",
    port: 4100,
    stateFilePath: "/tmp/openclaw-core-test-state.json",
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    readWorkViewState: overrides.readWorkViewState,
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

function transientEngineeringRecommendation() {
  return {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    actionId: "create_verification_task",
    label: "Create governed verification task",
    reason: "Transient route fixture recommendation reason.",
    confidence: 0.87,
    existingObserverControlId: "engineering-verification-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.verify",
    requiresOperatorReview: true,
    requiresApproval: true,
    createsTaskAutomatically: false,
    createsApprovalAutomatically: false,
    executesAutomatically: false,
  };
}

test("core infrastructure health route preserves service configuration readback", async () => {
  const deps = createBaseDeps();

  const response = await invokeRoute(deps, "GET", "/health");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, "openclaw-core");
  assert.equal(response.body.stage, "active");
  assert.equal(response.body.host, "127.0.0.1");
  assert.equal(response.body.port, 4100);
  assert.equal(response.body.autonomyMode, "guardian");
  assert.equal(response.body.sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(response.body.systemHealUrl, "http://127.0.0.1:4107");
});

test("core infrastructure proxy route forwards JSON bodies to configured services", async () => {
  let observed = null;
  const deps = createBaseDeps({
    client: {
      postJson: async (url, body) => {
        observed = { url, body };
        return { ok: true, proxied: true };
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/proxy/session-manager/work-view/prepare", { url: "https://example.test" });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(observed, {
    url: "http://127.0.0.1:4102/work-view/prepare",
    body: { url: "https://example.test" },
  });
  assert.deepEqual(response.body, { ok: true, proxied: true });
});

test("core infrastructure proxy route forwards read-only system kernel event routes", async () => {
  let observedUrl = null;
  const deps = createBaseDeps({
    client: {
      fetchJson: async (url) => {
        observedUrl = url;
        return {
          ok: true,
          registry: "openclaw-kernel-process-exec-v0",
          status: "captured",
          mode: "read_only",
          events: [],
          readback: {
            registry: "openclaw-kernel-process-exec-readback-v0",
            mode: "bounded_in_memory_summary",
            persisted: false,
            continuity: {
              registry: "openclaw-kernel-process-exec-continuity-v0",
              status: "first_capture",
              persisted: false,
            },
          },
        };
      },
    },
  });

  const response = await invokeRoute(deps, "GET", "/proxy/system-sense/system/kernel/process-exec-events");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(observedUrl, "http://127.0.0.1:4106/system/kernel/process-exec-events");
  assert.equal(response.body.registry, "openclaw-kernel-process-exec-v0");
  assert.equal(response.body.mode, "read_only");
  assert.equal(response.body.readback.registry, "openclaw-kernel-process-exec-readback-v0");
  assert.equal(response.body.readback.persisted, false);
  assert.equal(response.body.readback.continuity.registry, "openclaw-kernel-process-exec-continuity-v0");
  assert.equal(response.body.readback.continuity.status, "first_capture");
});

test("core runtime read route reconciles and serialises current task", async () => {
  const task = { id: "task-current", status: "running" };
  let reconciled = false;
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
      runtimeState: { currentTaskId: task.id },
    },
    taskManager: {
      reconcileRuntimeState: () => {
        reconciled = true;
      },
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      serialiseTask: (item) => ({ id: item.id, status: item.status, serialised: true }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/state/runtime");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(reconciled, true);
  assert.equal(response.body.taskCount, 1);
  assert.deepEqual(response.body.currentTask, {
    id: "task-current",
    status: "running",
    serialised: true,
  });
});

test("systemd draft route forwards unit aliases and execute flag", async () => {
  let observedInput = null;
  const deps = createBaseDeps({
    planBuilder: {
      buildSystemdRepairExecutionTaskDraft: async (input) => {
        observedInput = input;
        return {
          registry: "openclaw-systemd-repair-execution-task-draft-v0",
          task: { type: "systemd_repair_execution" },
        };
      },
    },
  });

  const response = await invokeRoute(deps, "GET", "/system/systemd/repair-execution-task-draft?target=openclaw-core.service&execute=true");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(observedInput, {
    unit: "openclaw-core.service",
    execute: true,
  });
  assert.deepEqual(response.body, {
    ok: true,
    registry: "openclaw-systemd-repair-execution-task-draft-v0",
    task: { type: "systemd_repair_execution" },
  });
});

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

test("native engineering verification evidence route derives bounded command evidence", async () => {
  let observedTranscriptLimit = null;
  let observedInvocationQuery = null;
  const transcriptEntry = {
    invocationId: "invocation-verify-1",
    command: "npm",
    exitCode: 0,
    timedOut: false,
    stdout: "verify ok\n",
    stderr: "",
  };
  const task = {
    id: "task-verify-1",
    status: "completed",
    closedAt: "2026-07-09T06:00:00.000Z",
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [transcriptEntry],
      },
    },
    sourceCommand: { registry: "openclaw-source-command-task-v0" },
  };
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
    },
    executor: {
      listCommandTranscriptRecords: ({ limit }) => {
        observedTranscriptLimit = limit;
        return [{
          ...transcriptEntry,
          taskId: task.id,
          taskStatus: "completed",
          taskClosedAt: task.closedAt,
          sourceCommand: task.sourceCommand,
          taskOutcome: "completed",
          index: 0,
          state: "executed",
          capabilityId: "act.system.command.execute",
        }];
      },
    },
    planBuilder: {
      listCapabilityInvocations: (query) => {
        observedInvocationQuery = query;
        return [{
          id: "invocation-verify-1",
          capability: { id: "act.system.command.execute" },
          request: { taskId: task.id, command: "npm", cwd: "/tmp/openclaw" },
          summary: { exitCode: 0, timedOut: false },
        }];
      },
    },
  });

  const response = await invokeRoute(
    deps,
    "GET",
    "/plugins/native-adapter/engineering-verification/evidence?taskId=task-verify-1&limit=999&maxOutputChars=64",
  );

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(observedTranscriptLimit, 100);
  assert.deepEqual(observedInvocationQuery, { limit: 100, capabilityId: "act.system.command.execute" });
  assert.equal(response.body.registry, "openclaw-native-engineering-verification-evidence-v0");
  assert.equal(response.body.sourceCapability.sourceToolName, "cc_verify");
  assert.equal(response.body.summary.total, 1);
  assert.equal(response.body.summary.passed, 1);
  assert.equal(response.body.evidence[0].commandShape.cwd, "/tmp/openclaw");
  assert.equal(response.body.evidence[0].attachment.attachedToTaskCompletion, true);
  assert.equal(response.body.governance.canExecuteCommand, false);
});

test("native engineering recovery evidence route derives read-only recovery recommendations", async () => {
  let observedTranscriptLimit = null;
  let observedInvocationQuery = null;
  const transcriptEntry = {
    invocationId: "invocation-recovery-1",
    command: "npm",
    exitCode: 9,
    timedOut: false,
    stdout: "verify failed\n",
    stderr: "failure details\n",
  };
  const task = {
    id: "task-recovery-1",
    status: "failed",
    type: "system_task",
    closedAt: "2026-07-09T06:00:00.000Z",
    outcome: {
      kind: "failed",
      details: {
        commandTranscript: [transcriptEntry],
        failedCommand: transcriptEntry,
      },
    },
    sourceCommand: { registry: "openclaw-source-command-task-v0" },
    plan: {
      steps: [{
        phase: "acting_on_target",
        capabilityId: "act.system.command.execute",
      }],
    },
  };
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
    },
    executor: {
      listCommandTranscriptRecords: ({ limit }) => {
        observedTranscriptLimit = limit;
        return [{
          ...transcriptEntry,
          taskId: task.id,
          taskStatus: "failed",
          taskClosedAt: task.closedAt,
          sourceCommand: task.sourceCommand,
          taskOutcome: "failed",
          index: 0,
          state: "failed",
          capabilityId: "act.system.command.execute",
        }];
      },
    },
    planBuilder: {
      listCapabilityInvocations: (query) => {
        observedInvocationQuery = query;
        return [{
          id: "invocation-recovery-1",
          capability: { id: "act.system.command.execute" },
          request: { taskId: task.id, command: "npm", cwd: "/tmp/openclaw" },
          summary: { exitCode: 9, timedOut: false },
        }];
      },
    },
  });

  const response = await invokeRoute(
    deps,
    "GET",
    "/plugins/native-adapter/engineering-recovery/evidence?taskId=task-recovery-1&limit=999&maxOutputChars=64",
  );

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(observedTranscriptLimit, 100);
  assert.deepEqual(observedInvocationQuery, { limit: 100, capabilityId: "act.system.command.execute" });
  assert.equal(response.body.registry, "openclaw-native-engineering-recovery-evidence-v0");
  assert.equal(response.body.capability.id, "sense.openclaw.engineering_tool.recovery_evidence");
  assert.equal(response.body.summary.totalFailures, 1);
  assert.equal(response.body.summary.recoverableFailures, 1);
  assert.equal(response.body.failures[0].taskId, task.id);
  assert.equal(response.body.failures[0].kind, "verification_command_exit_nonzero");
  assert.equal(response.body.failures[0].recommendations.some((item) => item.id === "recover_task_after_review"), true);
  assert.equal(response.body.governance.canCreateRecoveryTask, false);
  assert.equal(response.body.governance.canExecuteCommand, false);
  assert.equal(response.body.bounds.noCommandExecution, true);
});

test("native engineering microcompact evidence route previews context budget without mutation", async () => {
  let observedTranscriptLimit = null;
  let observedInvocationQuery = null;
  const task = {
    id: "task-microcompact-1",
    status: "completed",
    type: "system_task",
    closedAt: "2026-07-09T06:00:00.000Z",
    outcome: {
      kind: "completed",
      details: {},
    },
  };
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
    },
    executor: {
      listCommandTranscriptRecords: ({ limit }) => {
        observedTranscriptLimit = limit;
        return [{
          invocationId: "invocation-microcompact-1",
          command: "npm",
          exitCode: 0,
          timedOut: false,
          stdout: "X".repeat(1_200),
          stderr: "",
          taskId: task.id,
          taskStatus: "completed",
          taskClosedAt: task.closedAt,
          taskOutcome: "completed",
          index: 0,
          state: "executed",
          capabilityId: "act.system.command.execute",
        }];
      },
    },
    planBuilder: {
      listCapabilityInvocations: (query) => {
        observedInvocationQuery = query;
        return [{
          id: "invocation-microcompact-1",
          capability: { id: "act.system.command.execute" },
          request: { taskId: task.id, command: "npm", cwd: "/tmp/openclaw" },
          summary: { exitCode: 0, timedOut: false },
        }];
      },
    },
  });

  const response = await invokeRoute(
    deps,
    "GET",
    "/plugins/native-adapter/engineering-microcompact/evidence?limit=999&thresholdChars=256&protectRecentItems=0",
  );

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(observedTranscriptLimit, 100);
  assert.deepEqual(observedInvocationQuery, { limit: 100, capabilityId: "act.system.command.execute" });
  assert.equal(response.body.registry, "openclaw-native-engineering-microcompact-evidence-v0");
  assert.equal(response.body.capability.id, "sense.openclaw.engineering_context.microcompact_evidence");
  assert.equal(response.body.summary.totalItems, 1);
  assert.equal(response.body.summary.compactableItems, 1);
  assert.equal(response.body.summary.reclaimedChars > 0, true);
  assert.equal(response.body.candidates[0].output.sourceTextExposed, false);
  assert.equal(response.body.governance.canMutatePersistedLogs, false);
  assert.equal(response.body.governance.canExecuteCommand, false);
  assert.equal(response.body.bounds.noRawOutputText, true);
});

test("native engineering microcompact projection route transforms a bounded request copy", async () => {
  const events = [];
  const response = await invokeRoute(
    createBaseDeps({
      deps: {
        publishEvent: async (name, payload) => events.push({ name, payload }),
      },
    }),
    "POST",
    "/plugins/native-adapter/engineering-microcompact/projection",
    {
      thresholdChars: 100,
      protectRecentAssistantTurns: 0,
      messages: [
        { role: "assistant", content: [{ type: "text", text: "old" }] },
        { role: "toolResult", toolName: "cc_read", content: [{ type: "text", text: "X".repeat(500) }] },
        { role: "assistant", content: [{ type: "text", text: "new" }] },
      ],
    },
  );

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.registry, "openclaw-native-engineering-microcompact-projection-v0");
  assert.equal(response.body.summary.compactedMessages, 1);
  assert.equal(response.body.governance.mutatesPersistedLogs, false);
  assert.equal(response.body.governance.callsProvider, false);
  assert.equal(events[0].name, "native_engineering.microcompact_projection_built");
  assert.equal(JSON.stringify(events).includes("XXXXX"), false);
});

test("native engineering plan/todo evidence route reads task workbench state without mutation", async () => {
  const task = {
    id: "task-plan-todo-1",
    type: "system_task",
    status: "running",
    goal: "Expose planning evidence",
    plan: {
      planner: "rule-v1",
      strategy: "native-engineering-plan-todo-evidence",
      status: "running",
      summary: "Expose current planning state.",
      steps: [
        { id: "read", title: "Inspect planning source", status: "completed", phase: "analysis" },
        { id: "route", title: "Wire evidence route", status: "running", phase: "implementation" },
        { id: "verify", title: "Validate milestone", status: "planned", phase: "validation" },
      ],
    },
  };
  const todosJson = encodeURIComponent(JSON.stringify([
    { id: "query-read", description: "Review plan mode migration", status: "done" },
    { id: "query-wire", description: "Expose task/workbench evidence", status: "in_progress" },
  ]));
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
      runtimeState: { currentTaskId: task.id },
    },
  });

  const response = await invokeRoute(
    deps,
    "GET",
    `/plugins/native-adapter/engineering-plan-todo/evidence?taskId=${task.id}&limit=999&planSummary=bounded-plan&confirmedPlan=bounded-confirmed-plan&todosJson=${todosJson}`,
  );

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.registry, "openclaw-native-engineering-plan-todo-evidence-v0");
  assert.equal(response.body.capability.id, "sense.openclaw.engineering_context.plan_todo_evidence");
  assert.equal(response.body.query.limit, 50);
  assert.equal(response.body.summary.taskPlanCount, 1);
  assert.equal(response.body.summary.queryTodoCount, 2);
  assert.equal(response.body.summary.evidenceTodoCounts.done, 1);
  assert.equal(response.body.summary.evidenceTodoCounts.in_progress, 1);
  assert.equal(response.body.taskPlanEvidence.selectedTaskId, task.id);
  assert.equal(response.body.taskPlanEvidence.items[0].plan.stepCount, 3);
  assert.equal(response.body.planningEvidence.enter.hiddenModeCreated, false);
  assert.equal(response.body.planningEvidence.exit.executionTransitionCreated, false);
  assert.equal(response.body.planningEvidence.todoWrite.todoPathWritten, false);
  assert.equal(response.body.governance.canSwitchHiddenAgentMode, false);
  assert.equal(response.body.governance.canWriteTodoFile, false);
  assert.equal(response.body.governance.canMutateTaskState, false);
  assert.equal(response.body.governance.canExecuteCommand, false);
  assert.equal(response.body.bounds.noTaskMutation, true);
});

test("native engineering plan/todo workbench storage route persists bounded core state without task mutation", async () => {
  let persistCount = 0;
  const task = {
    id: "task-plan-todo-storage-1",
    type: "system_task",
    status: "running",
    goal: "Persist visible planning workbench state",
    plan: {
      planner: "rule-v1",
      strategy: "native-engineering-plan-todo-workbench-storage",
      status: "running",
      summary: "Persist visible planning state.",
      steps: [
        { id: "fallback", title: "Fallback task plan todo", status: "planned" },
      ],
    },
  };
  const records = new Map();
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
      runtimeState: { currentTaskId: task.id },
      nativeEngineeringPlanTodoWorkbenchRecords: records,
      persistState: () => {
        persistCount += 1;
      },
    },
  });

  const saved = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-plan-todo/workbench-state", {
    confirm: true,
    taskId: task.id,
    source: "route_test",
    planSummary: "Stored route plan",
    confirmedPlan: "Stored route confirmed plan",
    todos: [
      { id: "stored-done", description: "Persist a governed todo", status: "done" },
      { id: "stored-next", description: "Verify storage through evidence", status: "pending" },
    ],
  });

  assert.equal(saved.statusCode, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.registry, "openclaw-native-engineering-plan-todo-workbench-storage-v0");
  assert.equal(saved.body.record.taskId, task.id);
  assert.equal(saved.body.record.counts.total, 2);
  assert.equal(saved.body.record.governance.persistedInCoreState, true);
  assert.equal(saved.body.record.governance.writesTodoFile, false);
  assert.equal(saved.body.record.governance.mutatesTaskState, false);
  assert.equal(saved.body.record.governance.executesCommand, false);
  assert.equal(persistCount, 1);
  assert.equal(records.has(task.id), true);
  assert.equal(task.status, "running");

  const evidence = await invokeRoute(
    deps,
    "GET",
    `/plugins/native-adapter/engineering-plan-todo/evidence?taskId=${task.id}`,
  );

  assert.equal(evidence.statusCode, 200, JSON.stringify(evidence.body));
  assert.equal(evidence.body.summary.todoSource, "workbench_storage");
  assert.equal(evidence.body.summary.workbenchTodoCount, 2);
  assert.equal(evidence.body.planningEvidence.todoWrite.workbenchStatePersisted, true);
  assert.equal(evidence.body.planningEvidence.todoWrite.todoPathWritten, false);
  assert.equal(evidence.body.planningEvidence.todoWrite.taskStateMutated, false);
  assert.equal(evidence.body.workbenchStorage.persisted, true);
  assert.equal(evidence.body.nextGovernedActionSuggestion.suggestion.actionId, "create_verification_task");
  assert.equal(evidence.body.nextGovernedActionSuggestion.suggestion.createsTaskAutomatically, false);
  assert.equal(evidence.body.nextGovernedActionSuggestion.suggestion.executesAutomatically, false);
  assert.equal(evidence.body.nextGovernedActionSuggestion.governance.createsApproval, false);
  assert.equal(evidence.body.nextGovernedActionSuggestion.governance.executesCommand, false);
  assert.equal(evidence.body.governance.canWriteTodoFile, false);
  assert.equal(evidence.body.governance.canMutateTaskState, false);
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
  const recommendation = transientEngineeringRecommendation();
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
            execution: {
              id: "execution-step",
              recommendation,
              recommendationEvidence: {
                status: "valid_recommendation",
                actionId: recommendation.actionId,
                reason: null,
              },
            },
          }],
          operator: { mode: "loop-test" },
          summary: { completed: 1 },
        };
      },
      serialiseExecutionResult: (result) => ({
        id: result.id,
        recommendation: result.recommendation,
        recommendationEvidence: result.recommendationEvidence,
        serialised: true,
      }),
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
      execution: {
        id: "execution-step",
        recommendation,
        recommendationEvidence: {
          status: "valid_recommendation",
          actionId: recommendation.actionId,
          reason: null,
        },
        serialised: true,
      },
      policy: "audit_only",
    }],
    operator: { mode: "loop-test" },
    summary: { completed: 1 },
  });
});

test("operator step route preserves transient recommendation and compact evidence boundaries", async () => {
  const recommendation = transientEngineeringRecommendation();
  const deps = createBaseDeps({
    executor: {
      runOperatorStep: async () => ({
        ran: true,
        blocked: false,
        task: { id: "task-step-recommendation", status: "completed" },
        execution: {
          recommendation,
          recommendationEvidence: {
            status: "valid_recommendation",
            actionId: recommendation.actionId,
            reason: null,
          },
        },
        summary: { completed: 1 },
      }),
      serialiseExecutionResult: (result) => ({
        recommendation: result.recommendation,
        recommendationEvidence: result.recommendationEvidence,
      }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/operator/step", { contextPacket: true });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.execution.recommendation, recommendation);
  assert.equal(response.body.execution.recommendationEvidence.reason, null);
  assert.doesNotMatch(JSON.stringify(response.body.execution.recommendationEvidence), /Transient route fixture recommendation reason/);
});

test("egress task route forwards only the allowlisted live provider binding input", async () => {
  let observedInput = null;
  const liveProviderExecution = {
    requested: true,
    credentialReference: "openclaw://credential/deepseek-api-key",
    requestEnvelope: {
      model: "deepseek-chat",
      messages: [{ role: "user", content: "A bounded approval request." }],
    },
  };
  const deps = createBaseDeps({
    planBuilder: {
      createCloudConsciousnessLiveProviderEgressExecutionTask: async (input) => {
        observedInput = input;
        return {
          registry: "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0",
          mode: "test",
          generatedAt: "2026-07-13T00:00:00.000Z",
          sourceRegistry: "source-registry",
          sourceTaskId: "source-task",
          preflight: { summary: { ready: true } },
          task: { id: "egress-task" },
          approval: { id: "egress-approval" },
          governance: {},
        };
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/cloud-consciousness/live-provider-egress-execution-tasks", {
    confirm: true,
    liveProviderExecution,
    ignored: "not forwarded",
  });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.deepEqual(observedInput, { confirm: true, liveProviderExecution });
  assert.equal(response.body.task.id, "egress-task");
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

test("control stop route suspends trusted work-view authority before failing the task", async () => {
  const task = {
    id: "task-stop-trusted",
    status: "running",
    updatedAt: "2026-07-08T00:00:00.000Z",
    workView: { sessionId: "session-stop-trusted", helperStatus: "active" },
  };
  const calls = [];
  const phases = [];
  const runtimeState = { currentTaskId: task.id };
  const deps = createBaseDeps({
    state: { runtimeState },
    client: {
      postJson: async (url, body) => {
        calls.push({ url, body });
        return {
          ok: true,
          authority: {
            registry: "openclaw-trusted-work-view-helper-runtime-v0",
            status: "suspended",
            actionAuthority: "suspended",
          },
          workView: {
            helperRuntime: {
              registry: "openclaw-trusted-work-view-helper-runtime-v0",
              status: "suspended",
              actionAuthority: "suspended",
            },
          },
        };
      },
    },
    taskManager: {
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      appendTaskPhase: (item, phase, details) => {
        phases.push({ item, phase, details });
        item.updatedAt = "2026-07-08T00:00:01.000Z";
        return item;
      },
      reconcileRuntimeState: () => {},
      buildEyeHandRecoveryEvidence,
      serialiseTask: (item) => ({
        id: item.id,
        status: item.status,
        outcome: item.outcome,
        closedAt: item.closedAt,
      }),
    },
  });

  const response = await invokeRoute(deps, "POST", "/control/stop", {});

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(calls, [{
    url: "http://127.0.0.1:4102/work-view/helper-authority/suspend",
    body: {
      reason: "operator_stop",
      operatorActionSource: "openclaw-core-control-stop",
      sessionId: "session-stop-trusted",
    },
  }]);
  assert.equal(task.status, "failed");
  assert.equal(phases[0].details.reason, "Stopped by operator.");
  assert.deepEqual(phases[0].details.trustedWorkViewAuthority, {
    registry: "openclaw-trusted-work-view-helper-runtime-v0",
    endpoint: "/work-view/helper-authority/suspend",
    actionAuthority: "suspended",
    helperStatus: "suspended",
    authorityRevoked: true,
  });
  assert.equal(phases[0].details.recoveryEvidence.kind, "work-view-authority-recovery-evidence");
  assert.equal(phases[0].details.recoveryEvidence.sourceTaskId, task.id);
  assert.equal(phases[0].details.recoveryEvidence.interruption.stage, "operator_stop");
  assert.equal(phases[0].details.recoveryEvidence.interruption.actionAuthority, "suspended");
  assert.equal(phases[0].details.recoveryEvidence.recommendation.strategy, "restore_trusted_work_view_then_recover_task");
  assert.equal(response.body.workViewAuthority.workView.helperRuntime.actionAuthority, "suspended");
  assert.equal(response.body.task.outcome.details.trustedWorkViewAuthority.authorityRevoked, true);
  assert.equal(response.body.task.outcome.details.recoveryEvidence.interruption.authorityRevoked, true);
});

test("control stop route fails closed when trusted authority cannot be revoked", async () => {
  const task = {
    id: "task-stop-trusted-error",
    status: "running",
    workView: { sessionId: "session-stop-trusted-error" },
  };
  const runtimeState = { currentTaskId: task.id };
  const deps = createBaseDeps({
    state: { runtimeState },
    client: {
      postJson: async () => {
        throw new Error("session-manager unavailable");
      },
    },
    taskManager: {
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      serialiseTask: (item) => ({ id: item.id, status: item.status }),
      reconcileRuntimeState: () => {},
    },
  });

  const response = await invokeRoute(deps, "POST", "/control/stop", {});

  assert.equal(response.statusCode, 409, JSON.stringify(response.body));
  assert.equal(task.status, "running");
  assert.equal(response.body.error, "session-manager unavailable");
});

test("operator authority transitions carry the bound work-view session", async () => {
  const task = {
    id: "task-operator-authority-session",
    status: "running",
    workView: { sessionId: "session-operator-authority" },
  };
  const calls = [];
  const runtimeState = { currentTaskId: task.id };
  const deps = createBaseDeps({
    state: {
      runtimeState,
      getCurrentTask: () => task,
    },
    client: {
      postJson: async (url, body) => {
        calls.push({ url, body });
        return {
          ok: true,
          workView: {
            helperRuntime: {
              actionAuthority: body.reason === "operator_takeover" ? "suspended" : "active",
            },
          },
        };
      },
    },
    taskManager: {
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      appendTaskPhase: () => {},
      reconcileRuntimeState: () => {},
      serialiseTask: (item) => ({
        id: item.id,
        status: item.status,
        operatorTakeover: item.operatorTakeover ?? null,
      }),
      compareTasksForDisplay: () => 0,
    },
  });

  const takeover = await invokeRoute(deps, "POST", "/control/takeover", {});
  const resume = await invokeRoute(deps, "POST", "/control/resume", {});

  assert.equal(takeover.statusCode, 200, JSON.stringify(takeover.body));
  assert.equal(resume.statusCode, 200, JSON.stringify(resume.body));
  assert.deepEqual(calls, [
    {
      url: "http://127.0.0.1:4102/work-view/helper-authority/suspend",
      body: {
        reason: "operator_takeover",
        operatorActionSource: "openclaw-core-control-takeover",
        sessionId: "session-operator-authority",
      },
    },
    {
      url: "http://127.0.0.1:4102/work-view/helper-authority/resume",
      body: {
        reason: "operator_resume",
        operatorActionSource: "openclaw-core-control-resume",
        sessionId: "session-operator-authority",
      },
    },
  ]);
  assert.equal(task.status, "queued");
  assert.equal(task.operatorTakeover.status, "resumed");
});

test("task list route returns capped items with total count and summary", async () => {
  const tasks = new Map([
    ["task-1", { id: "task-1", status: "queued" }],
    ["task-2", { id: "task-2", status: "running" }],
  ]);
  const deps = createBaseDeps({
    state: { tasks },
    taskManager: {
      listTasks: () => [...tasks.values()],
      buildTaskSummary: () => ({ total: 2, queued: 1, running: 1 }),
    },
  });

  const response = await invokeRoute(deps, "GET", "/tasks?limit=1");

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, {
    ok: true,
    count: 2,
    items: [{ id: "task-1", status: "queued" }],
    summary: { total: 2, queued: 1, running: 1 },
  });
});

test("task plan route publishes created, approval, planned, and reclaimed task events", async () => {
  const events = [];
  const approvalCalls = [];
  const createCalls = [];
  const task = {
    id: "task-plan",
    status: "queued",
    plan: { steps: [{ phase: "acting_on_target", kind: "keyboard.type", params: { text: "hello" } }] },
  };
  const reclaimedTask = { id: "task-old", status: "superseded" };
  const engineeringRecommendationLink = {
    sourceTaskId: "provider-task-42",
    sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_REGISTRY,
    contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    actionId: "create_semantic_click_task",
    expectedObserverControlId: "create-semantic-click-task-button",
    existingCapabilityId: "plan.openclaw.browser.semantic_click_task",
    requiresApproval: true,
    createsTaskAutomatically: false,
    createsApprovalAutomatically: false,
    executesAutomatically: false,
  };
  const deps = createBaseDeps({
    taskManager: {
      createTask: (input) => {
        createCalls.push(input);
        return task;
      },
      supersedeOtherActiveTasks: (taskId) => (taskId === task.id ? [reclaimedTask] : []),
      reconcileRuntimeState: () => {},
      serialiseTask: (item) => ({ id: item.id, status: item.status }),
      buildTaskSummary: () => ({ total: 2 }),
    },
    approvalEngine: {
      publishTaskApprovalIfPending: async (item) => {
        approvalCalls.push(item.id);
      },
    },
    planBuilder: {
      serialisePlanForPublic: (plan) => ({ stepCount: plan.steps.length }),
    },
    deps: {
      publishEvent: async (type, payload) => {
        events.push({ type, payload });
      },
    },
  });

  const response = await invokeRoute(deps, "POST", "/tasks/plan", {
    targetUrl: "https://example.test/work",
    engineeringRecommendationLink,
  });

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.deepEqual(createCalls, [{
    targetUrl: "https://example.test/work",
    goal: "Plan work for https://example.test/work",
    type: "browser_task",
    workViewStrategy: "ai-work-view",
    includePlan: true,
    engineeringRecommendationLink,
  }]);
  assert.deepEqual(approvalCalls, ["task-plan"]);
  assert.deepEqual(events.map((event) => event.type), ["task.created", "task.planned", "task.phase_changed"]);
  assert.deepEqual(response.body, {
    ok: true,
    task: { id: "task-plan", status: "queued" },
    plan: { stepCount: 1 },
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

test("engineering work-view bind route revalidates authority and preserves the task status", async () => {
  const task = { id: "task-bind-1", status: "completed", workView: null };
  const events = [];
  let stateReads = 0;
  let bindCalls = 0;
  const deps = createBaseDeps({
    state: {
      tasks: new Map([[task.id, task]]),
    },
    taskManager: {
      getTaskById: (taskId) => (taskId === task.id ? task : null),
      bindTaskToTrustedWorkView: (candidate, binding) => {
        bindCalls += 1;
        candidate.workView = { ...binding };
        return candidate;
      },
      serialiseTask: (candidate) => ({
        id: candidate.id,
        status: candidate.status,
        workView: candidate.workView,
      }),
      buildTaskSummary: () => ({ total: 1 }),
    },
    readWorkViewState: async () => {
      stateReads += 1;
      return {
        ok: true,
        data: {
          session: { sessionId: "session-current", status: "running" },
          workView: {
            workViewId: "work-view-primary",
            status: "ready",
            visibility: "hidden",
            mode: "background",
            displayTarget: "workspace-2",
            trustedSession: {
              sessionIdentity: { status: "authoritative" },
              helperRuntime: { status: "active", actionAuthority: "active", leaseMatched: true },
              recoveryRecommendation: { action: "none" },
            },
          },
        },
      };
    },
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  const unconfirmed = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-context/work-view/bind", {
    taskId: task.id,
  });
  assert.equal(unconfirmed.statusCode, 409);
  assert.equal(stateReads, 0);
  assert.equal(bindCalls, 0);

  const response = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-context/work-view/bind", {
    taskId: task.id,
    confirm: true,
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(stateReads, 1);
  assert.equal(bindCalls, 1);
  assert.equal(response.body.changed, true);
  assert.equal(response.body.bind.registry, "openclaw-native-engineering-work-view-bind-v0");
  assert.equal(response.body.bind.summary.status, "bound");
  assert.equal(response.body.association.summary.status, "bound");
  assert.deepEqual(response.body.task, { id: task.id, status: "completed" });
  assert.equal(events[0].name, "task.work_view_bound");
  assert.equal(JSON.stringify(response.body).includes("session-current"), false);
  assert.equal(JSON.stringify(response.body).includes("work-view-primary"), true);
  assert.equal(JSON.stringify(response.body.bind).includes("session-current"), false);
  assert.equal(JSON.stringify(response.body.bind).includes("leaseId"), false);
  assert.equal(JSON.stringify(response.body.bind).includes("activeUrl"), false);
});

test("engineering work-view bind route fails closed when the current authority is stale", async () => {
  const task = { id: "task-bind-stale", status: "queued", workView: null };
  let bindCalls = 0;
  const deps = createBaseDeps({
    state: { tasks: new Map([[task.id, task]]) },
    taskManager: {
      getTaskById: () => task,
      bindTaskToTrustedWorkView: () => {
        bindCalls += 1;
        return task;
      },
      serialiseTask: (candidate) => ({ id: candidate.id, status: candidate.status }),
      buildTaskSummary: () => ({ total: 1 }),
    },
    readWorkViewState: async () => ({
      ok: true,
      data: {
        session: { sessionId: "session-current", status: "running" },
        workView: {
          workViewId: "work-view-primary",
          status: "ready",
          trustedSession: {
            sessionIdentity: { status: "authoritative" },
            helperRuntime: { status: "active", actionAuthority: "suspended", leaseMatched: false },
          },
        },
      },
    }),
  });

  const response = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-context/work-view/bind", {
    taskId: task.id,
    confirm: true,
  });

  assert.equal(response.statusCode, 409, JSON.stringify(response.body));
  assert.equal(response.body.bind.summary.status, "authority_not_ready");
  assert.equal(bindCalls, 0);
});

test("engineering work-view bind route requires explicit rebind for a stale task association", async () => {
  const task = {
    id: "task-bind-rebind",
    status: "completed",
    workView: { sessionId: "session-old", workViewId: "work-view-primary" },
  };
  const events = [];
  let bindCalls = 0;
  const deps = createBaseDeps({
    state: { tasks: new Map([[task.id, task]]) },
    taskManager: {
      getTaskById: () => task,
      bindTaskToTrustedWorkView: (candidate, binding) => {
        bindCalls += 1;
        candidate.workView = { ...binding };
        return candidate;
      },
      serialiseTask: (candidate) => ({ id: candidate.id, status: candidate.status }),
      buildTaskSummary: () => ({ total: 1 }),
    },
    readWorkViewState: async () => ({
      ok: true,
      data: {
        session: { sessionId: "session-current", status: "running" },
        workView: {
          workViewId: "work-view-primary",
          status: "ready",
          visibility: "hidden",
          mode: "background",
          displayTarget: "workspace-2",
          trustedSession: {
            sessionIdentity: { status: "authoritative" },
            helperRuntime: { status: "active", actionAuthority: "active", leaseMatched: true },
            recoveryRecommendation: { action: "none" },
          },
        },
      },
    }),
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  const blocked = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-context/work-view/bind", {
    taskId: task.id,
    confirm: true,
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.bind.summary.status, "stale_session_binding");
  assert.equal(bindCalls, 0);

  const response = await invokeRoute(deps, "POST", "/plugins/native-adapter/engineering-context/work-view/bind", {
    taskId: task.id,
    confirm: true,
    rebind: true,
  });
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.changed, true);
  assert.equal(response.body.bind.summary.status, "bound");
  assert.equal(response.body.bind.summary.operation, "rebind");
  assert.equal(response.body.bind.governance.replacesExistingBinding, true);
  assert.equal(response.body.association.summary.status, "bound");
  assert.equal(bindCalls, 1);
  assert.equal(events[0].name, "task.work_view_bound");
  assert.equal(events[0].payload.reason, "operator_reviewed_trusted_work_view_rebind");
});
