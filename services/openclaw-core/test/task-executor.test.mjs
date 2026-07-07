import test from "node:test";
import assert from "node:assert/strict";

import { createTaskExecutor } from "../src/task-executor.mjs";

const DELEGATED_NON_RECOVERABLE_TASK_HANDLERS = [
  ["long-term-memory-write", "isLongTermMemoryWriteTask", "executeLongTermMemoryWriteTask"],
  ["cloud-consciousness-handoff", "isCloudConsciousnessHandoffTask", "executeCloudConsciousnessHandoffTask"],
  ["cloud-consciousness-provider-dry-run", "isCloudConsciousnessProviderDryRunTask", "executeCloudConsciousnessProviderDryRunTask"],
  ["cloud-consciousness-provider-call-rehearsal", "isCloudConsciousnessProviderCallRehearsalTask", "executeCloudConsciousnessProviderCallRehearsalTask"],
  ["cloud-consciousness-live-provider-runbook", "isCloudConsciousnessLiveProviderRunbookTask", "executeCloudConsciousnessLiveProviderRunbookTask"],
  ["cloud-consciousness-live-provider-execution-plan", "isCloudConsciousnessLiveProviderExecutionPlanTask", "executeCloudConsciousnessLiveProviderExecutionPlanTask"],
  ["cloud-consciousness-live-provider-runtime-adapter", "isCloudConsciousnessLiveProviderRuntimeAdapterTask", "executeCloudConsciousnessLiveProviderRuntimeAdapterTask"],
  ["cloud-consciousness-live-provider-runtime-implementation", "isCloudConsciousnessLiveProviderRuntimeImplementationTask", "executeCloudConsciousnessLiveProviderRuntimeImplementationTask"],
  ["cloud-consciousness-live-provider-runtime-adapter-implementation", "isCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask", "executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask"],
  ["cloud-consciousness-live-provider-runtime-adapter-module", "isCloudConsciousnessLiveProviderRuntimeAdapterModuleTask", "executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask"],
  ["cloud-consciousness-live-provider-request-builder", "isCloudConsciousnessLiveProviderRequestBuilderTask", "executeCloudConsciousnessLiveProviderRequestBuilderTask"],
  ["cloud-consciousness-live-provider-credential-reference-resolver", "isCloudConsciousnessLiveProviderCredentialReferenceResolverTask", "executeCloudConsciousnessLiveProviderCredentialReferenceResolverTask"],
  ["cloud-consciousness-live-provider-no-network-sender", "isCloudConsciousnessLiveProviderNoNetworkSenderTask", "executeCloudConsciousnessLiveProviderNoNetworkSenderTask"],
  ["cloud-consciousness-live-provider-egress-transcript-recorder", "isCloudConsciousnessLiveProviderEgressTranscriptRecorderTask", "executeCloudConsciousnessLiveProviderEgressTranscriptRecorderTask"],
  ["cloud-consciousness-live-provider-response-verifier", "isCloudConsciousnessLiveProviderResponseVerifierTask", "executeCloudConsciousnessLiveProviderResponseVerifierTask"],
  ["cloud-consciousness-live-provider-rollback-note", "isCloudConsciousnessLiveProviderRollbackNoteTask", "executeCloudConsciousnessLiveProviderRollbackNoteTask"],
  ["cloud-consciousness-live-provider-runtime-adapter-closure", "isCloudConsciousnessLiveProviderRuntimeAdapterClosureTask", "executeCloudConsciousnessLiveProviderRuntimeAdapterClosureTask"],
  ["cloud-consciousness-live-provider-real-launch", "isCloudConsciousnessLiveProviderRealLaunchTask", "executeCloudConsciousnessLiveProviderRealLaunchTask"],
  ["cloud-consciousness-live-provider-egress-execution", "isCloudConsciousnessLiveProviderEgressExecutionTask", "executeCloudConsciousnessLiveProviderEgressExecutionTask"],
  ["cloud-consciousness-live-provider-credential-value-authorization", "isCloudConsciousnessLiveProviderCredentialValueAuthorizationTask", "executeCloudConsciousnessLiveProviderCredentialValueAuthorizationTask"],
  ["cloud-consciousness-live-provider-credential-value-read", "isCloudConsciousnessLiveProviderCredentialValueReadTask", "executeCloudConsciousnessLiveProviderCredentialValueReadTask"],
  ["cloud-consciousness-live-provider-credential-value-access-authorization", "isCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask", "executeCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask"],
  ["cloud-consciousness-live-provider-credential-value-access-authorization-decision", "isCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTask", "executeCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read", "isCloudConsciousnessLiveProviderCredentialValueLocalReadTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask"],
  ["cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read", "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask", "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask"],
];

const INTERNAL_DEFERRED_TASK_CASES = [
  {
    name: "native plugin capability",
    task: {
      type: "native_plugin_capability",
      plan: {
        steps: [
          {
            kind: "plugin.capability.invoke",
            capabilityId: "act.plugin.capability.invoke",
            params: { pluginId: "local-plugin", packageName: "@openclaw/local-plugin" },
          },
        ],
      },
    },
    expectedReason: "runtime_adapter_deferred",
    expectedMode: "native_plugin_runtime_adapter_deferred",
  },
  {
    name: "native plugin runtime activation",
    task: {
      type: "native_plugin_runtime_activation",
      plan: {
        strategy: "native-plugin-runtime-activation-v0",
        steps: [
          {
            kind: "plugin.runtime_activation",
            params: { pluginId: "local-plugin", packageName: "@openclaw/local-plugin", blockedGateIds: ["runtime-adapter"] },
          },
        ],
      },
    },
    expectedReason: "native_plugin_runtime_activation_deferred",
    expectedMode: "native_plugin_runtime_activation_deferred",
  },
  {
    name: "native plugin runtime adapter implementation",
    task: {
      type: "native_plugin_runtime_adapter_implementation",
      plan: {
        strategy: "native-plugin-runtime-adapter-v0",
        steps: [
          {
            kind: "plugin.runtime_adapter_implementation",
            params: { contractId: "native-plugin-v0", pluginId: "local-plugin", blockedCheckIds: ["source-read"] },
          },
        ],
      },
    },
    expectedReason: "native_plugin_runtime_adapter_implementation_deferred",
    expectedMode: "native_plugin_runtime_adapter_implementation_deferred",
  },
  {
    name: "openclaw search web adapter",
    task: {
      type: "openclaw_search_web_adapter_invocation",
      plan: {
        strategy: "openclaw-search-web-adapter-v0",
        steps: [
          {
            kind: "plugin.search_web.invoke",
            params: { providerContractId: "search-provider-v0", operation: "search", queryDigest: "sha256:abc" },
          },
        ],
      },
    },
    expectedReason: "search_web_runtime_preflight_deferred",
    expectedMode: "openclaw_search_web_runtime_preflight_deferred",
  },
  {
    name: "openclaw search web runtime activation",
    task: {
      type: "openclaw_search_web_runtime_activation",
      plan: {
        strategy: "openclaw-search-web-runtime-activation-v0",
        steps: [
          {
            kind: "plugin.search_web.runtime_activation",
            params: { providerContractId: "search-provider-v0", operation: "search", blockedGateIds: ["egress"] },
          },
        ],
      },
    },
    expectedReason: "search_web_network_runtime_adapter_deferred",
    expectedMode: "openclaw_search_web_network_runtime_adapter_deferred",
  },
  {
    name: "openclaw search web provider runtime sandbox",
    task: {
      type: "openclaw_search_web_provider_runtime_sandbox",
      plan: {
        strategy: "openclaw-search-web-provider-runtime-sandbox-v0",
        steps: [
          {
            kind: "plugin.search_web.provider_runtime_sandbox",
            params: { providerContractId: "search-provider-v0", sandboxId: "sandbox-1", blockedCheckIds: ["network"] },
          },
        ],
      },
    },
    expectedReason: "search_web_provider_runtime_sandbox_deferred",
    expectedMode: "openclaw_search_web_provider_runtime_sandbox_deferred",
  },
];

function buildDefaultPlanBuilder() {
  const planBuilder = {};
  for (const [name, predicate, execute] of DELEGATED_NON_RECOVERABLE_TASK_HANDLERS) {
    planBuilder[predicate] = () => false;
    planBuilder[execute] = async () => {
      throw new Error(`Unexpected delegated task handler execution: ${name}`);
    };
  }
  return planBuilder;
}

function createExecutorHarness(overrides = {}) {
  const events = [];
  let persistCalls = 0;
  const state = {
    tasks: new Map(),
    approvals: new Map(),
    policyAuditLog: [],
    capabilityInvocationLog: [],
    runtimeState: {},
    persistState: () => {
      persistCalls += 1;
    },
    updateRuntimeState: (patch) => {
      Object.assign(state.runtimeState, patch);
    },
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY: "openclaw-systemd-repair-execution-task-v0",
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY: "openclaw-systemd-next-repair-task-shell-v0",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY: "openclaw-systemd-next-repair-real-execution-v0",
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT: "openclaw-browser-runtime.service",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT: "openclaw-system-sense.service",
    ...overrides.state,
  };

  function stampTask(task) {
    task.updatedAt = new Date().toISOString();
    return task;
  }

  function appendTaskPhase(task, phase, details = null) {
    stampTask(task);
    task.phaseHistory = [...(task.phaseHistory ?? []), { phase, at: task.updatedAt, details }];
    return task;
  }

  async function setTaskPhase(task, phase, { status = task.status, details = null } = {}) {
    task.status = status;
    const updatedTask = appendTaskPhase(task, phase, details);
    events.push({ name: "task.phase_changed", payload: { task: updatedTask } });
    return updatedTask;
  }

  function completeTask(task, details = null) {
    task.status = "completed";
    appendTaskPhase(task, "completed", details);
    task.outcome = {
      kind: "completed",
      summary: details?.summary ?? "completed",
      details,
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    return task;
  }

  function failTask(task, reason, details = null) {
    task.status = "failed";
    appendTaskPhase(task, "failed", { reason, details });
    task.outcome = {
      kind: "failed",
      summary: reason,
      reason,
      details,
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    return task;
  }

  const executor = createTaskExecutor({
    client: {
      sessionManagerUrl: "http://127.0.0.1:4102",
      screenSenseUrl: "http://127.0.0.1:4104",
      screenActUrl: "http://127.0.0.1:4105",
      systemSenseUrl: "http://127.0.0.1:4106",
      fetchJson: async () => ({ ok: true }),
      postJson: async () => ({ ok: true }),
    },
    state,
    taskManager: {
      serialiseTask: (task) => task,
      buildTaskSummary: () => ({ total: state.tasks.size }),
      appendTaskPhase,
      setTaskPhase,
      completeTask,
      failTask,
      isActiveTask: (task) => ["queued", "running", "paused"].includes(task?.status),
      reconcileRuntimeState: () => {},
      ...overrides.taskManager,
    },
    planBuilder: {
      ...buildDefaultPlanBuilder(),
      ...overrides.planBuilder,
    },
    approvalEngine: {
      serialiseApproval: (approval) => approval,
      buildApprovalSummary: () => ({ total: state.approvals.size }),
      createApprovalRequestForTask: () => null,
      publishTaskApprovalIfPending: async () => null,
      ...overrides.approvalEngine,
    },
    workspaceOps: {},
    policyEvaluator: {
      ensureTaskPolicy: (task, context = {}) => {
        const decision = task.policy?.decision ?? {
          decision: "allow",
          reason: "unit_test_default_allow",
          stage: context.stage ?? null,
        };
        task.policy = {
          ...(task.policy ?? {}),
          decision,
        };
        return { decision };
      },
      recordPolicyDecision: () => null,
      evaluatePolicyIntent: () => ({ decision: "allow", reason: "unit_test_default_allow" }),
      isPolicyExecutionAllowed: (decision) => decision?.decision !== "deny" && decision?.decision !== "require_approval",
      ...overrides.policyEvaluator,
    },
    publishEvent: async (name, payload) => {
      events.push({ name, payload });
    },
    ...overrides.deps,
  });

  return { executor, state, events, persistCalls: () => persistCalls };
}

test("command transcript read model sorts, classifies, and summarises task outcomes", () => {
  const { executor, state } = createExecutorHarness();
  state.tasks.set("task-old", {
    id: "task-old",
    goal: "Older transcript task",
    status: "completed",
    closedAt: "2026-07-08T00:00:00.000Z",
    sourceCommand: "openclaw old",
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [
          {
            stepId: "old-step",
            actionKind: "command",
            capabilityId: "act.command.exec",
            invocationId: "invoke-old",
            command: "echo old",
            exitCode: 0,
            stdout: "old\n",
          },
        ],
      },
    },
  });
  state.tasks.set("task-new", {
    id: "task-new",
    goal: "Newer transcript task",
    status: "failed",
    closedAt: "2026-07-08T01:00:00.000Z",
    outcome: {
      kind: "failed",
      details: {
        commandTranscript: [
          {
            stepId: "failed-step",
            actionKind: "command",
            capabilityId: "act.command.exec",
            command: "false",
            exitCode: 1,
            stderr: "failed\n",
          },
          {
            stepId: "skipped-step",
            command: "echo skipped",
            skipped: true,
            skipReason: "previous_exit_code_mismatch",
          },
        ],
      },
    },
  });

  const records = executor.listCommandTranscriptRecords({ limit: 10 });
  assert.deepEqual(records.map((record) => record.state), ["failed", "skipped", "executed"]);
  assert.deepEqual(records.map((record) => record.taskId), ["task-new", "task-new", "task-old"]);
  assert.equal(records[0].exitCode, 1);
  assert.equal(records[1].skipReason, "previous_exit_code_mismatch");

  const summary = executor.serialiseCommandTranscriptSummary(executor.buildCommandTranscriptSummary());
  assert.equal(summary.total, 3);
  assert.equal(summary.executed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.taskCount, 2);
  assert.deepEqual(summary.taskIds, ["task-new", "task-old"]);
  assert.equal(summary.byCommand.false, 1);
  assert.equal(summary.byCommand["echo skipped"], 1);
  assert.equal(summary.byTaskStatus.completed, 1);
  assert.equal(summary.byTaskStatus.failed, 2);
  assert.equal(summary.latestAt, "2026-07-08T01:00:00.000Z");
});

test("filesystem invocation read models ignore blocked entries and count policy/task ids", () => {
  const { executor, state } = createExecutorHarness();
  state.capabilityInvocationLog.push(
    {
      id: "mkdir-1",
      at: "2026-07-08T00:01:00.000Z",
      invoked: true,
      blocked: false,
      capability: { id: "act.filesystem.mkdir" },
      request: { taskId: "task-a", path: "/tmp/openclaw" },
      summary: { path: "/tmp/openclaw", created: true, recursive: true },
      policy: { decision: "audit_only" },
    },
    {
      id: "write-1",
      at: "2026-07-08T00:02:00.000Z",
      invoked: true,
      capability: { id: "act.filesystem.write_text" },
      request: { taskId: "task-b", path: "/tmp/openclaw/file.txt" },
      summary: { path: "/tmp/openclaw/file.txt", contentBytes: 7, overwrite: true },
      policy: { decision: "require_approval" },
    },
    {
      id: "append-blocked",
      at: "2026-07-08T00:03:00.000Z",
      invoked: true,
      blocked: true,
      capability: { id: "act.filesystem.append_text" },
      request: { taskId: "task-c", path: "/tmp/openclaw/file.txt" },
      policy: { decision: "deny" },
    },
    {
      id: "read-1",
      at: "2026-07-08T00:04:00.000Z",
      invoked: true,
      capability: { id: "sense.filesystem.read" },
      request: { taskId: "task-a", operation: "read-text", path: "/tmp/openclaw/file.txt" },
      summary: { path: "/tmp/openclaw/file.txt", contentBytes: 7, encoding: "utf8" },
      policy: { decision: "audit_only" },
    },
    {
      id: "read-blocked",
      at: "2026-07-08T00:05:00.000Z",
      invoked: true,
      blocked: true,
      capability: { id: "sense.filesystem.read" },
      request: { taskId: "task-d", operation: "metadata", path: "/tmp/openclaw/file.txt" },
      policy: { decision: "deny" },
    },
  );

  const changes = executor.listFilesystemChangeRecords({ limit: 10 });
  assert.deepEqual(changes.map((record) => record.id), ["write-1", "mkdir-1"]);
  assert.deepEqual(changes.map((record) => record.change), ["write_text", "mkdir"]);

  const changeSummary = executor.serialiseFilesystemChangeSummary(executor.buildFilesystemChangeSummary());
  assert.equal(changeSummary.total, 2);
  assert.equal(changeSummary.mkdir, 1);
  assert.equal(changeSummary.write_text, 1);
  assert.equal(changeSummary.append_text, 0);
  assert.equal(changeSummary.taskCount, 2);
  assert.deepEqual(changeSummary.taskIds, ["task-b", "task-a"]);
  assert.equal(changeSummary.byPolicy.audit_only, 1);
  assert.equal(changeSummary.byPolicy.require_approval, 1);

  const reads = executor.listFilesystemReadRecords({ limit: 10 });
  assert.equal(reads.length, 1);
  assert.equal(reads[0].id, "read-1");
  assert.equal(reads[0].operation, "read_text");

  const readSummary = executor.serialiseFilesystemReadSummary(executor.buildFilesystemReadSummary());
  assert.equal(readSummary.total, 1);
  assert.equal(readSummary.read_text, 1);
  assert.equal(readSummary.metadata, 0);
  assert.equal(readSummary.taskCount, 1);
  assert.deepEqual(readSummary.taskIds, ["task-a"]);
  assert.equal(readSummary.byCapability["sense.filesystem.read"], 1);
  assert.equal(readSummary.byPolicy.audit_only, 1);
});

for (const [name, predicateName, executeName] of DELEGATED_NON_RECOVERABLE_TASK_HANDLERS) {
  test(`delegated non-recoverable dispatch executes ${name}`, async () => {
    const predicateCalls = [];
    const executeCalls = [];
    const { executor } = createExecutorHarness({
      planBuilder: {
        [predicateName]: (candidate) => {
          predicateCalls.push(candidate.id);
          return true;
        },
        [executeName]: async (candidate, options) => {
          executeCalls.push({ taskId: candidate.id, marker: options.dispatchMarker });
          return {
            task: {
              ...candidate,
              status: "completed",
              outcome: {
                kind: `${name}-completed`,
                summary: `${name} handled`,
              },
            },
            actions: [],
            verification: null,
            execution: {
              mode: `${name}-handler`,
            },
          };
        },
      },
    });
    const task = {
      id: `delegated-dispatch-${name}`,
      type: "delegated_non_recoverable_task",
      status: "queued",
    };

    const result = await executor.executeTaskWithRecovery(task, {
      autoRecover: true,
      maxRecoveryAttempts: 2,
      dispatchMarker: `marker-${name}`,
    });

    assert.deepEqual(predicateCalls, [task.id]);
    assert.deepEqual(executeCalls, [{ taskId: task.id, marker: `marker-${name}` }]);
    assert.equal(result.recovery.attempted, false);
    assert.equal(result.finalExecution.task.outcome.kind, `${name}-completed`);
    assert.equal(result.finalExecution.execution.mode, `${name}-handler`);
    assert.deepEqual(result.attempts.map((attempt) => attempt.task.id), [task.id]);
  });
}

for (const { name, task: taskShape, expectedReason, expectedMode } of INTERNAL_DEFERRED_TASK_CASES) {
  test(`internal non-recoverable dispatch defers ${name}`, async () => {
    const { executor, events } = createExecutorHarness();
    const task = {
      id: `internal-deferred-${name.replaceAll(" ", "-")}`,
      goal: `Defer ${name}`,
      status: "queued",
      ...taskShape,
    };

    const result = await executor.executeTaskWithRecovery(task, {
      autoRecover: true,
      maxRecoveryAttempts: 2,
    });

    assert.equal(result.recovery.attempted, false);
    assert.equal(result.finalExecution.blocked, true);
    assert.equal(result.finalExecution.reason, expectedReason);
    assert.equal(result.finalExecution.task.status, "queued");
    assert.equal(result.finalExecution.governance.mode, expectedMode);
    assert.equal(result.finalExecution.governance.executed, false);
    assert.deepEqual(result.attempts.map((attempt) => attempt.task.id), [task.id]);
    assert(events.some((event) => event.name === "policy.evaluated"));
    assert(events.some((event) => event.name === "task.blocked"));
  });
}

test("capability plan task dispatches to capability invocation handler", async () => {
  const invocationBodies = [];
  const { executor, events } = createExecutorHarness({
    planBuilder: {
      capabilityById: (id) => ({ id, requiresApproval: false }),
      invokeCapability: async (body) => {
        invocationBodies.push(body);
        return {
          response: {
            capability: { id: body.capabilityId },
            invoked: true,
            blocked: false,
            invocation: {
              id: "invoke-capability-plan-1",
              request: { command: body.params.command },
            },
            summary: {
              exitCode: 0,
              timedOut: false,
              stdout: "ok\n",
              stderr: "",
            },
            policy: { decision: "allow" },
          },
        };
      },
    },
  });
  const task = {
    id: "capability-plan-dispatch-1",
    type: "system_task",
    goal: "Run one safe capability plan step",
    status: "queued",
    policy: {
      decision: { decision: "allow", reason: "unit_test", approved: true },
    },
    plan: {
      steps: [
        {
          id: "capability-step-1",
          phase: "acting_on_target",
          kind: "system.command.execute",
          capabilityId: "act.system.command.execute",
          intent: "system.command.execute",
          params: { command: "echo ok" },
        },
      ],
    },
  };

  const result = await executor.executeTaskWithRecovery(task, {
    autoRecover: true,
    maxRecoveryAttempts: 2,
  });

  assert.equal(result.recovery.attempted, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(result.finalExecution.task.outcome.details.executor, "capability-invoke-v1");
  assert.equal(result.finalExecution.verification.ok, true);
  assert.equal(result.finalExecution.commandTranscript[0].command, "echo ok");
  assert.equal(result.finalExecution.commandTranscript[0].exitCode, 0);
  assert.deepEqual(invocationBodies.map((body) => body.capabilityId), ["act.system.command.execute"]);
  assert.equal(invocationBodies[0].approved, true);
  assert(events.some((event) => event.name === "task.completed"));
});

test("systemd repair execution task dispatches to deferred non-recoverable handler", async () => {
  const { executor, events, persistCalls } = createExecutorHarness();
  const task = {
    id: "systemd-repair-dispatch-1",
    type: "systemd_repair_execution_task",
    goal: "Prepare operator-reviewed systemd repair execution",
    status: "queued",
    systemdRepair: {
      registry: "openclaw-systemd-repair-execution-task-v0",
      target: { unit: "openclaw-browser-runtime.service" },
      command: { command: "systemctl", args: ["restart", "openclaw-browser-runtime.service"] },
      execution: { realExecutionEnabled: false },
    },
  };

  const result = await executor.executeTaskWithRecovery(task, {
    autoRecover: true,
    maxRecoveryAttempts: 2,
  });

  assert.equal(result.recovery.attempted, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(result.finalExecution.task.outcome.kind, "systemd_repair_execution_deferred");
  assert.equal(result.finalExecution.execution.mode, "deferred_execution_shell");
  assert.equal(result.finalExecution.execution.executed, false);
  assert.equal(result.finalExecution.execution.hostMutation, false);
  assert.deepEqual(result.attempts.map((attempt) => attempt.task.id), ["systemd-repair-dispatch-1"]);
  assert(events.some((event) => event.name === "systemd.repair.execution_deferred"));
  assert(events.some((event) => event.name === "task.phase_changed"));
  assert(persistCalls() > 0);
});

test("systemd next repair task dispatches to deferred non-recoverable handler", async () => {
  const { executor, events } = createExecutorHarness();
  const task = {
    id: "systemd-next-repair-dispatch-1",
    type: "systemd_next_repair_task",
    goal: "Prepare next systemd repair task shell",
    status: "queued",
    systemdNextRepair: {
      registry: "openclaw-systemd-next-repair-task-shell-v0",
      target: { unit: "openclaw-system-sense.service" },
      command: { command: "systemctl", args: ["restart", "openclaw-system-sense.service"] },
      execution: { realExecutionEnabled: false },
    },
  };

  const result = await executor.executeTaskWithRecovery(task, {
    autoRecover: true,
    retryBudget: 3,
  });

  assert.equal(result.recovery.attempted, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(result.finalExecution.task.outcome.kind, "systemd_next_repair_execution_deferred");
  assert.equal(result.finalExecution.execution.mode, "next_repair_deferred_execution_shell");
  assert.equal(result.finalExecution.execution.executed, false);
  assert.equal(result.finalExecution.execution.hostMutation, false);
  assert.deepEqual(result.attempts.map((attempt) => attempt.task.id), ["systemd-next-repair-dispatch-1"]);
  assert(events.some((event) => event.name === "systemd.next_repair.execution_deferred"));
});

test("body evidence followup record task dispatches to deferred append shell when append is disabled", async () => {
  const { executor, events } = createExecutorHarness();
  const task = {
    id: "body-evidence-followup-dispatch-1",
    type: "body_evidence_ledger_followup_record_task",
    goal: "Prepare body evidence followup record append shell",
    status: "queued",
    bodyEvidenceLedgerFollowupRecord: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      plannedRecordType: "body_evidence_timeline_followup",
      plannedSequence: 2,
      appendExecutionEnabled: false,
    },
  };

  const result = await executor.executeTaskWithRecovery(task, {
    autoRecover: true,
    maxRecoveryAttempts: 1,
  });

  assert.equal(result.recovery.attempted, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(result.finalExecution.task.outcome.kind, "body_evidence_ledger_followup_record_deferred");
  assert.equal(result.finalExecution.execution.mode, "deferred_followup_record_append_shell");
  assert.equal(result.finalExecution.execution.recordAppended, false);
  assert.equal(result.finalExecution.execution.durableStorageWritten, false);
  assert.equal(result.finalExecution.task.bodyEvidenceLedgerFollowupRecord.appendExecutionEnabled, false);
  assert.equal(result.finalExecution.task.bodyEvidenceLedgerFollowupRecord.recordAppended, false);
  assert.deepEqual(result.attempts.map((attempt) => attempt.task.id), ["body-evidence-followup-dispatch-1"]);
  assert(events.some((event) => event.name === "body_evidence_ledger.followup_record_deferred"));
});
