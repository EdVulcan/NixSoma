import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createTaskExecutor } from "../src/task-executor.mjs";
import { buildCapabilityApprovalBinding } from "../src/capability-runtime-approval-binding.mjs";
import { buildBrowserTaskExecutionBinding } from "../src/browser-task-execution-binding.mjs";
import { DELEGATED_PLAN_TASK_HANDLER_DESCRIPTORS } from "../src/task-executor-delegated-plan-handlers.mjs";
import { CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE } from "../src/cloud-live-provider-runtime-context-packet.mjs";

const DELEGATED_NON_RECOVERABLE_TASK_HANDLERS = DELEGATED_PLAN_TASK_HANDLER_DESCRIPTORS.map(
  ({ name, predicate, execute }) => [name, predicate, execute],
);

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
  {
    name: "native engineering LSP lifecycle approval gate",
    task: {
      type: "native_engineering_lsp_lifecycle",
      engineeringLspLifecycle: {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        lifecycleAction: "start",
        language: "typescript",
        server: { serverBinary: "typescript-language-server" },
      },
    },
    expectedReason: "policy_requires_approval",
    expectedMode: "native_engineering_lsp_lifecycle_waiting_for_approval",
  },
];

function buildDefaultPlanBuilder() {
  const planBuilder = {
    refreshNativePluginRuntimeRegistry: () => ({
      ok: true,
      swapped: true,
      previous: { id: "native-registry-generation-1", sequence: 1, hash: "hash-1" },
      active: { id: "native-registry-generation-2", sequence: 2, hash: "hash-2" },
    }),
  };
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
    nativeEngineeringLspLifecycleRecords: new Map(),
    runtimeState: {},
    getCurrentTask: () => state.tasks.get(state.runtimeState.currentTaskId) ?? null,
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
      getNextQueuedTask: () => [...state.tasks.values()].find((task) => task.status === "queued") ?? null,
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

function buildSemanticClickExecutionFixture({
  captureFreshness = "fresh",
  stateInventorySha256 = "b".repeat(64),
  runtimeActionReason = null,
} = {}) {
  const targetUrl = "https://example.com/semantic-click";
  const frameSha256 = "a".repeat(64);
  const frameSequence = 7;
  const workViewResponse = {
    ok: true,
    session: { sessionId: "session-1", status: "ready" },
    workView: {
      workViewId: "work-view-primary",
      status: "ready",
      visibility: "visible",
      mode: "foreground-observable",
      helperStatus: "active",
      browserStatus: "running",
      activeUrl: targetUrl,
      displayTarget: "workspace-2",
    },
  };
  const stateData = {
    ...workViewResponse,
    trustedSession: {
      sessionIdentity: { status: "authoritative" },
      helperRuntime: {
        status: "active",
        actionAuthority: "active",
        leaseMatched: true,
        sidecar: {
          captureSourceStatus: "ready",
          captureFreshness,
          captureObservation: {
            sequence: 12,
            visualFrame: {
              available: true,
              fresh: captureFreshness === "fresh",
              sha256: frameSha256,
              sequence: frameSequence,
            },
            semanticTargets: {
              available: true,
              itemCount: 1,
              truncated: false,
              inventorySha256: stateInventorySha256,
              frameSequence,
              frameSha256,
            },
          },
        },
      },
    },
  };
  const screenResponse = {
    ok: true,
    screen: {
      readiness: "ready",
      focusedWindow: { title: "AI work view", pid: 4103 },
      visualFrame: {
        available: true,
        fresh: true,
        sha256: frameSha256,
        sequence: frameSequence,
      },
      semanticTargets: {
        available: true,
        truncated: false,
        inventorySha256: "b".repeat(64),
        frame: { sha256: frameSha256, sequence: frameSequence },
        items: [{
          targetId: `frame-${frameSequence}-target-1`,
          role: "button",
          name: "Inspect",
          visible: true,
          disabled: false,
        }],
      },
      workViewSummary: {
        url: targetUrl,
        visibleTextBlocks: [targetUrl],
        summaryText: targetUrl,
      },
    },
  };
  const postCalls = [];
  let screenActCalls = 0;
  const client = {
    sessionManagerUrl: "http://session-manager",
    screenSenseUrl: "http://screen-sense",
    screenActUrl: "http://screen-act",
    systemSenseUrl: "http://system-sense",
    fetchJson: async (url) => {
      if (url === "http://screen-sense/screen/current") return screenResponse;
      if (url === "http://session-manager/work-view/state") return stateData;
      return { ok: true };
    },
    postJson: async (url, body) => {
      postCalls.push({ url, body });
      if (url === "http://screen-act/act/mouse/click") {
        screenActCalls += 1;
        if (runtimeActionReason) {
          return {
            ok: true,
            action: {
              id: "semantic-click-rejected-action",
              kind: "mouse.click",
              params: body,
              degraded: true,
              result: "blocked-or-degraded",
              mediation: {
                accepted: false,
                reason: runtimeActionReason,
              },
            },
          };
        }
        return {
          ok: true,
          action: {
            id: "semantic-click-action",
            kind: "mouse.click",
            params: body,
            degraded: false,
            result: "executed-browser-runtime",
            mediation: {
              accepted: true,
              transport: "trusted-sidecar-ipc",
              effect: { url: targetUrl },
              visualGrounding: {
                registry: "openclaw-trusted-work-view-visual-action-grounding-v0",
                required: true,
                status: "grounded",
                before: {
                  registry: "openclaw-browser-visual-frame-v0",
                  sha256: frameSha256,
                  sequence: frameSequence,
                  fresh: true,
                },
                after: {
                  registry: "openclaw-browser-visual-frame-v0",
                  sha256: "c".repeat(64),
                  sequence: frameSequence + 1,
                  fresh: true,
                },
                sequenceAdvanced: true,
              },
            },
          },
        };
      }
      return workViewResponse;
    },
  };
  return {
    targetUrl,
    stateData,
    client,
    postCalls,
    get screenActCalls() {
      return screenActCalls;
    },
    readWorkViewState: async () => ({ ok: true, data: stateData }),
    taskManager: {
      buildWorkViewAttachPayload: () => ({
        workViewId: "work-view-primary",
        sessionId: "session-1",
        status: "ready",
        visibility: "visible",
        mode: "foreground-observable",
        helperStatus: "active",
        displayTarget: "workspace-2",
        activeUrl: targetUrl,
      }),
      attachTaskToWorkView: (task, workView) => {
        task.workView = workView;
        return task;
      },
    },
  };
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

test("native plugin runtime refresh task waits for approval before execution", async () => {
  const { executor, state, events } = createExecutorHarness();
  state.approvals.set("approval-runtime-refresh", {
    id: "approval-runtime-refresh",
    status: "pending",
    taskId: "runtime-refresh-waiting",
  });
  const task = {
    id: "runtime-refresh-waiting",
    type: "native_plugin_runtime_refresh",
    goal: "Refresh native plugin runtime read model",
    status: "queued",
    approval: {
      requestId: "approval-runtime-refresh",
      status: "pending",
      required: true,
    },
    policy: {
      request: { intent: "plugin.runtime_refresh", requiresApproval: true },
      decision: { decision: "require_approval", approved: false, reason: "approval_required" },
    },
    plan: {
      strategy: "native-plugin-runtime-refresh-v0",
    },
    nativePluginRuntimeRefresh: {
      registry: "openclaw-native-plugin-runtime-refresh-task-v0",
      capabilityId: "act.plugin.capability.invoke",
    },
  };

  const result = await executor.executeTaskWithRecovery(task);

  assert.equal(result.finalExecution.blocked, true);
  assert.equal(result.finalExecution.reason, "policy_requires_approval");
  assert.equal(result.finalExecution.task.status, "queued");
  assert.equal(result.finalExecution.governance.mode, "native_plugin_runtime_refresh_waiting_for_approval");
  assert.equal(result.finalExecution.governance.canImportModule, false);
  assert(events.some((event) => event.name === "task.blocked"));
});

test("approved native plugin runtime refresh task completes with read-model evidence", async () => {
  const refreshEvidenceInputs = [];
  const { executor, state, events } = createExecutorHarness({
    planBuilder: {
      buildNativePluginRuntimeRefreshEvidence: (...args) => {
        refreshEvidenceInputs.push(args);
        return {
          ok: true,
          registry: "openclaw-native-plugin-runtime-refresh-evidence-v0",
          mode: "governed-runtime-refresh-evidence-only",
          generatedAt: "2026-07-10T00:00:00.000Z",
          capability: {
            id: "sense.openclaw.plugin_runtime.refresh_evidence",
            risk: "medium",
          },
          runtimeState: {
            readModelRefreshed: true,
            validationOk: true,
            activeGenerationId: "native-registry-generation-2",
            activeGenerationSequence: 2,
            activeGenerationHash: "hash-2",
            activeLoader: false,
            loadedPluginModules: 0,
            moduleCacheInvalidated: false,
          },
          summary: {
            readModelRefreshed: true,
            validationOk: true,
            canImportModule: false,
            canExecutePluginCode: false,
            canActivateRuntime: false,
          },
          governance: {
            canRefreshReadModel: true,
            canInvalidateModuleCache: false,
            canImportModule: false,
            canExecutePluginCode: false,
            canActivateRuntime: false,
          },
          auditEvidence: {
            operation: "plugin_runtime_refresh_evidence",
          },
          deferredExecutionBoundaries: ["no plugin module import"],
        };
      },
    },
  });
  state.approvals.set("approval-runtime-refresh-approved", {
    id: "approval-runtime-refresh-approved",
    status: "approved",
    taskId: "runtime-refresh-approved",
  });
  const task = {
    id: "runtime-refresh-approved",
    type: "native_plugin_runtime_refresh",
    goal: "Refresh native plugin runtime read model",
    status: "queued",
    approval: {
      requestId: "approval-runtime-refresh-approved",
      status: "approved",
      required: false,
    },
    policy: {
      request: { intent: "plugin.runtime_refresh", requiresApproval: true, approved: true },
      decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
    },
    plan: {
      strategy: "native-plugin-runtime-refresh-v0",
    },
    nativePluginRuntimeRefresh: {
      registry: "openclaw-native-plugin-runtime-refresh-task-v0",
      packagePath: null,
      capabilityId: "act.plugin.capability.invoke",
    },
  };

  const result = await executor.executeTaskWithRecovery(task);
  const execution = result.finalExecution.execution;

  assert.equal(result.finalExecution.blocked, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(execution.registry, "openclaw-native-plugin-runtime-refresh-task-execution-v0");
  assert.equal(execution.readModelRefreshed, true);
  assert.equal(execution.generation.previousId, "native-registry-generation-1");
  assert.equal(execution.generation.currentId, "native-registry-generation-2");
  assert.equal(execution.generation.swapped, true);
  assert.equal(execution.governance.canImportModule, false);
  assert.equal(execution.governance.canExecutePluginCode, false);
  assert.equal(execution.governance.canActivateRuntime, false);
  assert.equal(result.finalExecution.task.nativePluginRuntimeRefresh.execution.registry, execution.registry);
  assert.equal(result.finalExecution.task.outcome.details.verification.ok, true);
  assert.deepEqual(refreshEvidenceInputs, [[]]);
  assert(events.some((event) => event.name === "task.completed"));
});

test("ACPX/Codex bridge wrapper task waits for approval before deferred execution", async () => {
  const { executor, state, events } = createExecutorHarness();
  state.approvals.set("approval-acpx-wrapper", {
    id: "approval-acpx-wrapper",
    status: "pending",
    taskId: "acpx-wrapper-waiting",
  });
  const task = {
    id: "acpx-wrapper-waiting",
    type: "native_acpx_codex_bridge_wrapper_action",
    goal: "Approve ACPX/Codex wrapper boundary",
    status: "queued",
    approval: {
      requestId: "approval-acpx-wrapper",
      status: "pending",
      required: true,
    },
    policy: {
      request: { intent: "acpx_codex_bridge.wrapper_action", requiresApproval: true },
      decision: { decision: "require_approval", approved: false, reason: "approval_required" },
    },
    plan: {
      strategy: "acpx-codex-bridge-wrapper-action-v0",
    },
    nativeAcpxCodexBridgeWrapper: {
      registry: "openclaw-native-acpx-codex-bridge-wrapper-task-v0",
      sessionKey: "agent:codex:one",
    },
  };

  const result = await executor.executeTaskWithRecovery(task);

  assert.equal(result.finalExecution.blocked, true);
  assert.equal(result.finalExecution.reason, "policy_requires_approval");
  assert.equal(result.finalExecution.task.status, "queued");
  assert.equal(result.finalExecution.governance.mode, "acpx_codex_bridge_wrapper_waiting_for_approval");
  assert.equal(result.finalExecution.governance.canWriteWrapper, false);
  assert.equal(result.finalExecution.governance.canSpawnCodexAcp, false);
  assert(events.some((event) => event.name === "task.blocked"));
});

test("approved ACPX/Codex bridge wrapper task records deferred boundary without wrapper write or spawn", async () => {
  const { executor, state, events } = createExecutorHarness({
    planBuilder: {
      buildNativeAcpxCodexBridgeWrapperDraft: () => ({
        ok: true,
        registry: "openclaw-native-acpx-codex-bridge-wrapper-draft-v0",
        mode: "proposal-only-acpx-codex-bridge-wrapper-action-draft",
        proposal: {
          id: "acpx-draft-one",
          status: "ready_for_approval_bridge",
          wrapper: {
            relativePath: ".openclaw/acpx/codex-bridge/codex-acp-one.sh",
          },
          command: {
            command: "npx.cmd",
            args: ["@openai/codex", "acp"],
          },
        },
        summary: {
          readyForApprovalBridge: true,
        },
      }),
    },
  });
  state.approvals.set("approval-acpx-wrapper-approved", {
    id: "approval-acpx-wrapper-approved",
    status: "approved",
    taskId: "acpx-wrapper-approved",
  });
  const task = {
    id: "acpx-wrapper-approved",
    type: "native_acpx_codex_bridge_wrapper_action",
    goal: "Approve ACPX/Codex wrapper boundary",
    status: "queued",
    approval: {
      requestId: "approval-acpx-wrapper-approved",
      status: "approved",
      required: false,
    },
    policy: {
      request: { intent: "acpx_codex_bridge.wrapper_action", requiresApproval: true, approved: true },
      decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
    },
    plan: {
      strategy: "acpx-codex-bridge-wrapper-action-v0",
    },
    nativeAcpxCodexBridgeWrapper: {
      registry: "openclaw-native-acpx-codex-bridge-wrapper-task-v0",
      sessionKey: "agent:codex:one",
      command: "npx.cmd",
      wrapperName: "codex-acp-one",
    },
  };

  const result = await executor.executeTaskWithRecovery(task);
  const execution = result.finalExecution.execution;

  assert.equal(result.finalExecution.blocked, false);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(execution.registry, "openclaw-native-acpx-codex-bridge-wrapper-task-execution-v0");
  assert.equal(execution.approved, true);
  assert.equal(execution.wrapper.wrapperWritten, false);
  assert.equal(execution.command.commandExecuted, false);
  assert.equal(execution.command.processSpawned, false);
  assert.equal(execution.governance.canReadCredentialValue, false);
  assert.equal(execution.governance.canCopyAuthMaterial, false);
  assert.equal(execution.governance.canWriteWrapper, false);
  assert.equal(execution.governance.canUseNetwork, false);
  assert.equal(result.finalExecution.task.nativeAcpxCodexBridgeWrapper.execution.registry, execution.registry);
  assert.equal(result.finalExecution.task.outcome.details.verification.ok, true);
  assert(events.some((event) => event.name === "task.completed"));
});

test("ACPX/Codex process-spawn task waits for approval before preflight", async () => {
  const { executor, state, events } = createExecutorHarness();
  state.approvals.set("approval-acpx-spawn-pending", {
    id: "approval-acpx-spawn-pending",
    status: "pending",
    taskId: "acpx-spawn-pending",
  });
  const task = {
    id: "acpx-spawn-pending",
    type: "native_acpx_codex_bridge_process_spawn",
    goal: "Approve ACPX/Codex process spawn preflight",
    status: "queued",
    approval: {
      requestId: "approval-acpx-spawn-pending",
      status: "pending",
      required: true,
    },
    policy: {
      request: { intent: "acpx_codex_bridge.process_spawn_preflight", requiresApproval: true },
      decision: { decision: "require_approval", approved: false, reason: "unit_test" },
    },
    plan: {
      strategy: "acpx-codex-bridge-process-spawn-v0",
    },
    nativeAcpxCodexBridgeProcessSpawn: {
      registry: "openclaw-native-acpx-codex-bridge-process-spawn-task-v0",
      processSpawnProposal: {
        proposal: {
          wrapper: {
            relativePath: ".openclaw/acpx/codex-bridge/codex-acp-one.sh",
          },
        },
      },
    },
  };

  const result = await executor.executeTaskWithRecovery(task);

  assert.equal(result.finalExecution.blocked, true);
  assert.equal(result.finalExecution.reason, "policy_requires_approval");
  assert.equal(result.finalExecution.governance.mode, "acpx_codex_bridge_process_spawn_waiting_for_approval");
  assert.equal(result.finalExecution.governance.canExecuteWrapper, false);
  assert.equal(result.finalExecution.governance.canSpawnCodexAcp, false);
  assert(events.some((event) => event.name === "task.blocked"));
});

test("approved ACPX/Codex process-spawn task records preflight without spawning", async () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "openclaw-acpx-spawn-"));
  try {
    const wrapperPath = path.join(fixtureDir, ".openclaw/acpx/codex-bridge/codex-acp-one.sh");
    mkdirSync(path.dirname(wrapperPath), { recursive: true });
    const wrapperContent = "#!/usr/bin/env node\nconsole.log('preflight only');\n";
    writeFileSync(wrapperPath, wrapperContent);
    const wrapperHash = `sha256:${createHash("sha256").update(wrapperContent).digest("hex")}`;
    const { executor, state, events } = createExecutorHarness();
    state.approvals.set("approval-acpx-spawn-approved", {
      id: "approval-acpx-spawn-approved",
      status: "approved",
      taskId: "acpx-spawn-approved",
    });
    const task = {
      id: "acpx-spawn-approved",
      type: "native_acpx_codex_bridge_process_spawn",
      goal: "Approve ACPX/Codex process spawn preflight",
      status: "queued",
      approval: {
        requestId: "approval-acpx-spawn-approved",
        status: "approved",
        required: false,
      },
      policy: {
        request: { intent: "acpx_codex_bridge.process_spawn_preflight", requiresApproval: true, approved: true },
        decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
      },
      plan: {
        strategy: "acpx-codex-bridge-process-spawn-v0",
      },
      nativeAcpxCodexBridgeProcessSpawn: {
        registry: "openclaw-native-acpx-codex-bridge-process-spawn-task-v0",
        processSpawnProposal: {
          registry: "openclaw-native-acpx-codex-bridge-process-spawn-proposal-v0",
          proposal: {
            id: "spawn-proposal-one",
            status: "ready_for_spawn_approval_design",
            wrapper: {
              relativePath: ".openclaw/acpx/codex-bridge/codex-acp-one.sh",
              ledgerPath: wrapperPath,
              contentHash: wrapperHash,
              contentPreviewExposed: false,
            },
            commandContract: {
              futureCapabilityId: "act.system.command.execute",
              commandName: "node",
              argsCount: 1,
              argsExposed: false,
              commandExecuted: false,
              processSpawned: false,
            },
          },
          summary: {
            readyForSpawnApprovalDesign: true,
          },
        },
      },
    };

    const result = await executor.executeTaskWithRecovery(task);
    const execution = result.finalExecution.execution;

    assert.equal(result.finalExecution.blocked, false);
    assert.equal(result.finalExecution.task.status, "completed");
    assert.equal(execution.registry, "openclaw-native-acpx-codex-bridge-process-spawn-preflight-v0");
    assert.equal(execution.wrapper.exists, true);
    assert.equal(execution.wrapper.hashMatches, true);
    assert.equal(execution.command.argsExposed, false);
    assert.equal(execution.command.commandExecuted, false);
    assert.equal(execution.command.processSpawned, false);
    assert.equal(execution.governance.canExecuteWrapper, false);
    assert.equal(execution.governance.canSpawnCodexAcp, false);
    assert.equal(execution.governance.canUseNetwork, false);
    assert.equal(result.finalExecution.task.nativeAcpxCodexBridgeProcessSpawn.execution.registry, execution.registry);
    assert.equal(result.finalExecution.task.outcome.details.verification.ok, true);
    assert(events.some((event) => event.name === "task.completed"));
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("capability plan task dispatches to capability invocation handler", async () => {
  const invocationBodies = [];
  const task = {
    id: "capability-plan-dispatch-1",
    type: "system_task",
    goal: "Run one safe capability plan step",
    status: "queued",
    policy: {
      decision: { decision: "allow", reason: "unit_test", approved: true },
    },
    approval: {
      requestId: "approval-capability-plan-1",
      status: "approved",
    },
    plan: {
      planId: "plan-capability-dispatch-1",
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
  const approval = {
    id: "approval-capability-plan-1",
    taskId: task.id,
    status: "approved",
    binding: buildCapabilityApprovalBinding({ task }),
  };
  const { executor, events } = createExecutorHarness({
    state: {
      approvals: new Map([[approval.id, approval]]),
    },
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

test("approved native engineering LSP lifecycle task records missing binary recovery evidence", async () => {
  const { executor, state, events } = createExecutorHarness();
  state.approvals.set("approval-lsp", {
    id: "approval-lsp",
    status: "approved",
    taskId: "lsp-lifecycle-missing-binary",
  });
  const task = {
    id: "lsp-lifecycle-missing-binary",
    type: "native_engineering_lsp_lifecycle",
    goal: "Start TypeScript LSP lifecycle",
    status: "queued",
    approval: {
      requestId: "approval-lsp",
      status: "approved",
      required: false,
    },
    policy: {
      request: { approved: true },
      decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
    },
    engineeringLspLifecycle: {
      registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
      lifecycleAction: "start",
      language: "typescript",
      workspace: { id: "fixture", path: "/tmp/openclaw" },
      server: {
        serverBinary: "openclaw-definitely-missing-lsp-server",
        serverArgs: ["--stdio"],
        binaryChecked: false,
        processStarted: false,
        jsonRpcHandshakeSent: false,
      },
    },
  };

  const result = await executor.executeTaskWithRecovery(task);

  assert.equal(result.finalExecution.task.status, "failed");
  assert.equal(result.finalExecution.reason, "lsp_server_binary_missing");
  assert.equal(result.finalExecution.execution.server.binaryFound, false);
  assert.equal(result.finalExecution.execution.server.processStarted, false);
  assert.equal(result.finalExecution.execution.server.jsonRpcHandshakeSent, false);
  assert.equal(result.finalExecution.execution.processSupervision.attempted, false);
  assert.equal(result.finalExecution.execution.lifecycleState.status, "recovery_required_server_binary_missing");
  assert.equal(state.nativeEngineeringLspLifecycleRecords.size, 1);
  assert.equal(result.finalExecution.execution.governance.approved, true);
  assert.equal(result.finalExecution.execution.governance.processStarted, false);
  assert.equal(result.finalExecution.execution.governance.jsonRpcEnabled, false);
  assert.equal(result.finalExecution.task.engineeringLspLifecycle.server.binaryChecked, true);
  assert.equal(result.finalExecution.task.outcome.details.recoveryEvidence.kind, "lsp_lifecycle_recovery");
  assert.equal(result.finalExecution.task.outcome.details.recoveryEvidence.recoverable, true);
  assert(events.some((event) => event.name === "task.failed"));
});

test("approved native engineering LSP lifecycle task records supervised process probe when binary exists", async () => {
  const fakeBinDir = mkdtempSync(path.join(tmpdir(), "openclaw-lsp-bin-"));
  const fakeBinary = path.join(fakeBinDir, "typescript-language-server");
  writeFileSync(fakeBinary, "#!/usr/bin/env bash\nprintf 'fake-lsp-ready\\n' >&2\nsleep 2\n", "utf8");
  chmodSync(fakeBinary, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDir}${path.delimiter}${previousPath ?? ""}`;

  try {
    const { executor, state, events } = createExecutorHarness({
      state: { workspaceRoots: [fakeBinDir] },
    });
    state.approvals.set("approval-lsp-process", {
      id: "approval-lsp-process",
      status: "approved",
      taskId: "lsp-lifecycle-process-probe",
    });
    const task = {
      id: "lsp-lifecycle-process-probe",
      type: "native_engineering_lsp_lifecycle",
      goal: "Start TypeScript LSP lifecycle",
      status: "queued",
      approval: {
        requestId: "approval-lsp-process",
        status: "approved",
        required: false,
      },
      policy: {
        request: { approved: true },
        decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
      },
      engineeringLspLifecycle: {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        lifecycleAction: "start",
        language: "typescript",
        workspace: { id: "fixture", path: fakeBinDir },
        server: {
          serverBinary: "typescript-language-server",
          serverArgs: ["--stdio"],
          binaryChecked: false,
          processStarted: false,
          jsonRpcHandshakeSent: false,
        },
      },
    };

    const result = await executor.executeTaskWithRecovery(task);
    const execution = result.finalExecution.execution;

    assert.equal(result.finalExecution.task.status, "completed");
    assert.equal(execution.result.state, "process_supervision_probe_completed_json_rpc_deferred");
    assert.equal(execution.server.binaryFound, true);
    assert.equal(execution.server.processStarted, true);
    assert.equal(execution.server.processAliveAtProbe, true);
    assert.equal(execution.server.processTerminated, true);
    assert.equal(execution.server.jsonRpcHandshakeSent, false);
    assert.equal(execution.processSupervision.attempted, true);
    assert.equal(execution.processSupervision.started, true);
    assert.equal(execution.processSupervision.terminationSent, true);
    assert.equal(execution.processSupervision.cwd, fakeBinDir);
    assert.match(execution.processSupervision.stderr.text, /fake-lsp-ready/);
    assert.equal(execution.lifecycleState.status, "probe_completed_no_live_process");
    assert.equal(execution.lifecycleState.process.longLivedProcessActive, false);
    assert.match(execution.lifecycleState.output.stderr.preview, /fake-lsp-ready/);
    assert.equal(state.nativeEngineeringLspLifecycleRecords.size, 1);
    assert.equal(execution.governance.approved, true);
    assert.equal(execution.governance.processStarted, true);
    assert.equal(execution.governance.jsonRpcEnabled, false);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.server.processStarted, true);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.server.jsonRpcHandshakeSent, false);
    assert(events.some((event) => event.name === "task.completed"));
  } finally {
    process.env.PATH = previousPath;
    rmSync(fakeBinDir, { recursive: true, force: true });
  }
});

test("approved native engineering LSP lifecycle stop records persistent state without binary gate", async () => {
  const { executor, state, events } = createExecutorHarness();
  state.approvals.set("approval-lsp-stop", {
    id: "approval-lsp-stop",
    status: "approved",
    taskId: "lsp-lifecycle-stop",
  });
  const task = {
    id: "lsp-lifecycle-stop",
    type: "native_engineering_lsp_lifecycle",
    goal: "Stop TypeScript LSP lifecycle",
    status: "queued",
    approval: {
      requestId: "approval-lsp-stop",
      status: "approved",
      required: false,
    },
    policy: {
      request: { approved: true },
      decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
    },
    engineeringLspLifecycle: {
      registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
      lifecycleAction: "stop",
      language: "typescript",
      workspace: { id: "fixture", path: "/tmp/openclaw-lsp-stop-fixture" },
      server: {
        serverBinary: "typescript-language-server",
        serverArgs: ["--stdio"],
        binaryChecked: false,
        processStarted: false,
        jsonRpcHandshakeSent: false,
      },
    },
  };

  const result = await executor.executeTaskWithRecovery(task);
  const execution = result.finalExecution.execution;

  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(execution.result.state, "stop_recorded_no_live_process");
  assert.equal(execution.server.binaryChecked, false);
  assert.equal(execution.server.processStarted, false);
  assert.equal(execution.server.jsonRpcHandshakeSent, false);
  assert.equal(execution.processSupervision.reason, "stop_recorded_no_live_process");
  assert.equal(execution.lifecycleState.status, "stopped_no_live_process");
  assert.equal(execution.lifecycleState.boundaries.jsonRpcEnabled, false);
  assert.equal(result.finalExecution.task.engineeringLspLifecycle.lifecycleState.status, "stopped_no_live_process");
  assert.equal(state.nativeEngineeringLspLifecycleRecords.size, 1);
  assert(events.some((event) => event.name === "task.completed"));
});

test("approved native engineering LSP lifecycle handshake records initialize shutdown evidence", async () => {
  const fakeBinDir = mkdtempSync(path.join(tmpdir(), "openclaw-lsp-handshake-bin-"));
  const fakeBinary = path.join(fakeBinDir, "typescript-language-server");
  writeFileSync(fakeBinary, `#!/usr/bin/env node
process.stderr.write("fake-lsp-handshake-ready\\n");
let input = "";
let sentInitialize = false;
let sentShutdown = false;
function frame(message) {
  const body = JSON.stringify(message);
  process.stdout.write(\`Content-Length: \${Buffer.byteLength(body, "utf8")}\\r\\n\\r\\n\${body}\`);
}
process.stdin.on("data", (chunk) => {
  input += chunk.toString("utf8");
  if (!sentInitialize && input.includes('"method":"initialize"')) {
    sentInitialize = true;
    frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } });
  }
  if (!sentShutdown && input.includes('"method":"shutdown"')) {
    sentShutdown = true;
    frame({ jsonrpc: "2.0", id: 2, result: null });
  }
  if (input.includes('"method":"exit"')) {
    setTimeout(() => process.exit(0), 10);
  }
});
setTimeout(() => process.exit(3), 5000);
`, "utf8");
  chmodSync(fakeBinary, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDir}${path.delimiter}${previousPath ?? ""}`;

  try {
    const { executor, state, events } = createExecutorHarness({
      state: { workspaceRoots: [fakeBinDir] },
    });
    state.approvals.set("approval-lsp-handshake", {
      id: "approval-lsp-handshake",
      status: "approved",
      taskId: "lsp-lifecycle-handshake",
    });
    const task = {
      id: "lsp-lifecycle-handshake",
      type: "native_engineering_lsp_lifecycle",
      goal: "Handshake TypeScript LSP lifecycle",
      status: "queued",
      approval: {
        requestId: "approval-lsp-handshake",
        status: "approved",
        required: false,
      },
      policy: {
        request: { approved: true },
        decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
      },
      engineeringLspLifecycle: {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        lifecycleAction: "handshake",
        language: "typescript",
        workspace: { id: "fixture", path: fakeBinDir },
        server: {
          serverBinary: "typescript-language-server",
          serverArgs: ["--stdio"],
          binaryChecked: false,
          processStarted: false,
          jsonRpcHandshakeSent: false,
        },
      },
    };

    const result = await executor.executeTaskWithRecovery(task);
    const execution = result.finalExecution.execution;

    assert.equal(result.finalExecution.task.status, "completed");
    assert.equal(execution.result.state, "initialize_shutdown_handshake_completed_source_content_deferred");
    assert.equal(execution.server.processStarted, true);
    assert.equal(execution.server.jsonRpcHandshakeSent, true);
    assert.equal(execution.processSupervision.protocolHandshake.ok, true);
    assert.deepEqual(execution.processSupervision.protocolHandshake.messagesSent, ["initialize", "shutdown", "exit"]);
    assert.equal(execution.processSupervision.protocolHandshake.didOpenSent, false);
    assert.equal(execution.processSupervision.protocolHandshake.symbolRequestsSent, false);
    assert.equal(execution.processSupervision.protocolHandshake.sourceContentTransferred, false);
    assert.equal(execution.lifecycleState.status, "initialize_shutdown_handshake_completed");
    assert.equal(execution.lifecycleState.boundaries.jsonRpcInitializeShutdownOnly, true);
    assert.equal(execution.lifecycleState.boundaries.jsonRpcOperationalRequestsEnabled, false);
    assert.equal(execution.lifecycleState.boundaries.sourceContentTransferred, false);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.server.jsonRpcHandshakeSent, true);
    assert.equal(state.nativeEngineeringLspLifecycleRecords.size, 1);
    assert(events.some((event) => event.name === "task.completed"));
  } finally {
    process.env.PATH = previousPath;
    rmSync(fakeBinDir, { recursive: true, force: true });
  }
});

test("approved native engineering LSP source-transfer task sends didOpen without symbol requests", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-lsp-source-transfer-"));
  const fakeBinDir = path.join(root, "bin");
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(fakeBinDir, { recursive: true });
  const sourceText = "export const openclawSourceTransfer = 42;\n";
  writeFileSync(path.join(root, "src", "app.ts"), sourceText, "utf8");
  const sourceHash = createHash("sha256").update(sourceText, "utf8").digest("hex");
  const fakeBinary = path.join(fakeBinDir, "typescript-language-server");
  writeFileSync(fakeBinary, `#!/usr/bin/env node
process.stderr.write("fake-lsp-source-transfer-ready\\n");
let input = "";
let sentInitialize = false;
let sentShutdown = false;
let sawDidOpen = false;
function frame(message) {
  const body = JSON.stringify(message);
  process.stdout.write(\`Content-Length: \${Buffer.byteLength(body, "utf8")}\\r\\n\\r\\n\${body}\`);
}
process.stdin.on("data", (chunk) => {
  input += chunk.toString("utf8");
  if (!sentInitialize && input.includes('"method":"initialize"')) {
    sentInitialize = true;
    frame({ jsonrpc: "2.0", id: 1, result: { capabilities: { textDocumentSync: 1 } } });
  }
  if (input.includes('"method":"textDocument/didOpen"') && input.includes("openclawSourceTransfer")) {
    sawDidOpen = true;
  }
  if (sawDidOpen && !sentShutdown && input.includes('"method":"shutdown"')) {
    sentShutdown = true;
    frame({ jsonrpc: "2.0", id: 2, result: null });
  }
  if (input.includes('"method":"exit"')) {
    setTimeout(() => process.exit(0), 10);
  }
});
setTimeout(() => process.exit(3), 5000);
`, "utf8");
  chmodSync(fakeBinary, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDir}${path.delimiter}${previousPath ?? ""}`;

  try {
    const { executor, state, events } = createExecutorHarness({
      state: { workspaceRoots: [root] },
    });
    state.approvals.set("approval-lsp-source-transfer", {
      id: "approval-lsp-source-transfer",
      status: "approved",
      taskId: "lsp-source-transfer",
    });
    const task = {
      id: "lsp-source-transfer",
      type: "native_engineering_lsp_lifecycle",
      goal: "Transfer source to TypeScript LSP",
      status: "queued",
      approval: {
        requestId: "approval-lsp-source-transfer",
        status: "approved",
        required: false,
      },
      policy: {
        request: { approved: true },
        decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
      },
      engineeringLspLifecycle: {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        lifecycleAction: "source_transfer",
        language: "typescript",
        workspace: { id: "fixture", path: root },
        server: {
          serverBinary: "typescript-language-server",
          serverArgs: ["--stdio"],
          binaryChecked: false,
          processStarted: false,
          jsonRpcHandshakeSent: false,
          didOpenSent: false,
          sourceContentTransferred: false,
        },
        sourceTransfer: {
          registry: "openclaw-native-engineering-lsp-source-transfer-proposal-v0",
          relativePath: "src/app.ts",
          languageId: "typescript",
          textBytes: Buffer.byteLength(sourceText, "utf8"),
          lineCount: 2,
          textSha256: sourceHash,
          maxFileSizeBytes: 128 * 1024,
          maxPreviewChars: 8_000,
          didOpenSent: false,
          sourceContentTransferred: false,
          symbolRequestsSent: false,
        },
      },
    };

    const result = await executor.executeTaskWithRecovery(task);
    const execution = result.finalExecution.execution;

    assert.equal(result.finalExecution.task.status, "completed");
    assert.equal(execution.result.state, "didopen_source_transfer_completed_symbol_requests_deferred");
    assert.equal(execution.server.processStarted, true);
    assert.equal(execution.server.jsonRpcHandshakeSent, true);
    assert.equal(execution.server.didOpenSent, true);
    assert.equal(execution.server.sourceContentTransferred, true);
    assert.equal(execution.processSupervision.protocolHandshake.ok, true);
    assert.deepEqual(execution.processSupervision.protocolHandshake.messagesSent, ["initialize", "textDocument/didOpen", "shutdown", "exit"]);
    assert.equal(execution.processSupervision.protocolHandshake.didOpenSent, true);
    assert.equal(execution.processSupervision.protocolHandshake.symbolRequestsSent, false);
    assert.equal(execution.processSupervision.protocolHandshake.sourceContentTransferred, true);
    assert.equal(execution.processSupervision.protocolHandshake.sourceTransfer.textSha256, sourceHash);
    assert.equal(execution.lifecycleState.status, "didopen_source_transfer_completed");
    assert.equal(execution.lifecycleState.boundaries.jsonRpcOperationalRequestsEnabled, false);
    assert.equal(execution.lifecycleState.boundaries.sourceContentTransferred, true);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.sourceTransfer.didOpenSent, true);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.sourceTransfer.sourceContentTransferred, true);
    assert.equal(JSON.stringify(execution).includes("openclawSourceTransfer = 42"), false);
    assert.equal(state.nativeEngineeringLspLifecycleRecords.size, 1);
    assert(events.some((event) => event.name === "task.completed"));
  } finally {
    process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test("approved native engineering LSP symbol request task sends one operational request", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-lsp-symbol-request-"));
  const fakeBinDir = path.join(root, "bin");
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(fakeBinDir, { recursive: true });
  const sourceText = "export const openclawSymbolRequest = 7;\n";
  writeFileSync(path.join(root, "src", "app.ts"), sourceText, "utf8");
  const sourceHash = createHash("sha256").update(sourceText, "utf8").digest("hex");
  const fakeBinary = path.join(fakeBinDir, "typescript-language-server");
  writeFileSync(fakeBinary, `#!/usr/bin/env node
process.stderr.write("fake-lsp-symbol-request-ready\\n");
let input = "";
let sentInitialize = false;
let sentSymbol = false;
let sentShutdown = false;
function frame(message) {
  const body = JSON.stringify(message);
  process.stdout.write(\`Content-Length: \${Buffer.byteLength(body, "utf8")}\\r\\n\\r\\n\${body}\`);
}
process.stdin.on("data", (chunk) => {
  input += chunk.toString("utf8");
  if (!sentInitialize && input.includes('"method":"initialize"')) {
    sentInitialize = true;
    frame({ jsonrpc: "2.0", id: 1, result: { capabilities: { definitionProvider: true } } });
  }
  if (!sentSymbol && input.includes('"method":"textDocument/definition"') && input.includes("openclawSymbolRequest")) {
    sentSymbol = true;
    process.stderr.write("fake-lsp-symbol-request-observed\\n");
    frame({ jsonrpc: "2.0", id: 3, result: [{ uri: "file:///workspace/src/app.ts", range: { start: { line: 0, character: 13 }, end: { line: 0, character: 34 } } }] });
  }
  if (sentSymbol && !sentShutdown && input.includes('"method":"shutdown"')) {
    sentShutdown = true;
    frame({ jsonrpc: "2.0", id: 4, result: null });
  }
  if (input.includes('"method":"exit"')) {
    setTimeout(() => process.exit(0), 10);
  }
});
setTimeout(() => process.exit(3), 5000);
`, "utf8");
  chmodSync(fakeBinary, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDir}${path.delimiter}${previousPath ?? ""}`;

  try {
    const { executor, state } = createExecutorHarness({
      state: { workspaceRoots: [root] },
    });
    state.approvals.set("approval-lsp-symbol", {
      id: "approval-lsp-symbol",
      status: "approved",
      taskId: "lsp-symbol-request",
    });
    const task = {
      id: "lsp-symbol-request",
      type: "native_engineering_lsp_lifecycle",
      goal: "Run TypeScript LSP definition request",
      status: "queued",
      approval: { requestId: "approval-lsp-symbol", status: "approved", required: false },
      policy: {
        request: { approved: true },
        decision: { decision: "audit_only", approved: true, reason: "approved_unit_test" },
      },
      engineeringLspLifecycle: {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        lifecycleAction: "symbol_request",
        language: "typescript",
        workspace: { id: "fixture", path: root },
        server: {
          serverBinary: "typescript-language-server",
          serverArgs: ["--stdio"],
          binaryChecked: false,
          processStarted: false,
          jsonRpcHandshakeSent: false,
          didOpenSent: false,
          sourceContentTransferred: false,
          symbolRequestSent: false,
        },
        sourceTransfer: {
          relativePath: "src/app.ts",
          languageId: "typescript",
          textBytes: Buffer.byteLength(sourceText, "utf8"),
          textSha256: sourceHash,
          maxFileSizeBytes: 128 * 1024,
          maxPreviewChars: 8_000,
        },
        symbolRequest: {
          registry: "openclaw-native-engineering-lsp-symbol-request-proposal-v0",
          action: "definition",
          method: "textDocument/definition",
          params: {
            textDocument: { uri: `file://${path.join(root, "src", "app.ts")}` },
            position: { line: 0, character: 13 },
          },
          sent: false,
        },
      },
    };

    const result = await executor.executeTaskWithRecovery(task);
    const execution = result.finalExecution.execution;

    assert.equal(result.finalExecution.task.status, "completed");
    assert.equal(execution.result.state, "symbol_request_completed_long_lived_pool_deferred");
    assert.equal(execution.server.didOpenSent, true);
    assert.equal(execution.server.sourceContentTransferred, true);
    assert.equal(execution.server.symbolRequestSent, true);
    assert.equal(execution.server.symbolRequestMethod, "textDocument/definition");
    assert.equal(execution.processSupervision.protocolHandshake.symbolResponseObserved, true);
    assert.deepEqual(execution.server.symbolResponseSummary, {
      observed: true,
      requestId: 3,
      method: "textDocument/definition",
      hasError: false,
      resultKind: "array",
      resultCount: 1,
      uriCount: 1,
      rangeCount: 1,
      hoverContentKind: "none",
      hoverContentChars: 0,
      targetCount: 1,
      targetLimit: 8,
      targetsTruncated: false,
      targets: [
        {
          uri: "file:///workspace/src/app.ts",
          range: { start: { line: 0, character: 13 }, end: { line: 0, character: 34 } },
        },
      ],
      selectedTarget: {
        uri: "file:///workspace/src/app.ts",
        range: { start: { line: 0, character: 13 }, end: { line: 0, character: 34 } },
      },
      rawResultIncluded: false,
      rawTargetsIncluded: false,
    });
    assert.equal(execution.lifecycleState.status, "symbol_request_completed");
    assert.equal(execution.lifecycleState.server.symbolResponseObserved, true);
    assert.equal(execution.lifecycleState.server.symbolResponseSummary.resultCount, 1);
    assert.equal(execution.lifecycleState.boundaries.jsonRpcOperationalRequestsEnabled, true);
    assert.equal(execution.lifecycleState.boundaries.longLivedProcessActive, false);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.symbolRequest.sent, true);
    assert.equal(result.finalExecution.task.engineeringLspLifecycle.symbolRequest.responseSummary.resultCount, 1);
    assert.equal(JSON.stringify(execution).includes("openclawSymbolRequest = 7"), false);
  } finally {
    process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
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

test("approved next systemd repair executes only through the fixed hostd boundary", async () => {
  let inventoryCalls = 0;
  const { executor, events } = createExecutorHarness({
    state: {
      SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS: 3000,
      SYSTEMD_REPAIR_POST_VERIFICATION_ATTEMPTS: 3,
      SYSTEMD_REPAIR_POST_VERIFICATION_POLL_MS: 1,
      HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock",
      SYSTEMD_REPAIR_AUTH_DELEGATION: "polkit-dbus-fixed-unit",
    },
    deps: {
      client: {
        sessionManagerUrl: "http://127.0.0.1:4102",
        screenSenseUrl: "http://127.0.0.1:4104",
        screenActUrl: "http://127.0.0.1:4105",
        systemSenseUrl: "http://127.0.0.1:4106",
        fetchJson: async (url) => {
          if (url.endsWith("/system/systemd/units")) {
            inventoryCalls += 1;
            if (inventoryCalls === 2) {
              throw new Error("service endpoint restarting");
            }
            return {
              registry: "openclaw-systemd-unit-inventory-v0",
              observedAt: new Date().toISOString(),
              units: [{
                unit: "openclaw-system-sense.service",
                loadState: "loaded",
                activeState: "active",
                subState: "running",
                mainPid: 200,
                systemdObserved: true,
                observation: "dbus_properties_read_only",
              }],
            };
          }
          return {
            system: {
              timestamp: new Date().toISOString(),
              alerts: [],
              network: { online: true, checkedTargets: 7 },
              services: { browserRuntime: { name: "browserRuntime", ok: true } },
            },
          };
        },
        postJson: async () => ({ ok: true }),
      },
      hostdControlClient: async ({ socketPath, timeoutMs, targetUnit, operation }) => {
        assert.equal(socketPath, "/run/openclaw/hostd.sock");
        assert.equal(timeoutMs, 3000);
        assert.equal(targetUnit, "openclaw-system-sense.service");
        assert.equal(operation, "restart_system_sense");
        return {
          ok: true,
          registry: "openclaw-hostd-systemd-restart-response-v0",
          protocolVersion: 1,
          requestId: "hostd-request-1",
          owner: "openclaw-hostd",
          transport: "unix_socket",
          method: "org.freedesktop.systemd1.Manager.RestartUnit",
          unit: "openclaw-system-sense.service",
          capability: {
            registry: "openclaw-hostd-restart-capability-v1",
            operation: "restart_system_sense",
            capabilityId: "hostd.restart_system_sense",
          },
          governance: {
            callerBoundary: "kernel_so_peercred",
            socketPeerIdentityVerified: true,
            socketPeerIdentityMatched: true,
          },
          nativeMutation: {
            ok: true,
            owner: "openclaw-hostd",
            transport: "dbus_native",
            method: "org.freedesktop.systemd1.Manager.RestartUnit",
            unit: "openclaw-system-sense.service",
            capability: {
              registry: "openclaw-hostd-restart-capability-v1",
              operation: "restart_system_sense",
              capabilityId: "hostd.restart_system_sense",
            },
            jobPath: "/org/freedesktop/systemd1/job/42",
            before: { activeState: "active", subState: "running", mainPid: 100 },
            after: { activeState: "active", subState: "running", mainPid: 200 },
          },
        };
      },
    },
  });
  const task = {
    id: "systemd-next-native-repair-1",
    type: "systemd_next_repair_task",
    goal: "Execute approved native systemd repair",
    status: "queued",
    systemdNextRepair: {
      registry: "openclaw-systemd-next-repair-real-execution-v0",
      target: { unit: "openclaw-system-sense.service" },
      command: { command: "systemctl", args: ["restart", "openclaw-system-sense.service"] },
      execution: { realExecutionEnabled: true },
    },
  };

  const result = await executor.executeTaskWithRecovery(task, { autoRecover: false });
  const finalTask = result.finalExecution.task;
  const transcript = finalTask.outcome.details.commandTranscript[0];

  assert.equal(finalTask.outcome.kind, "systemd_next_repair_execution_completed");
  assert.equal(transcript.actualCommand, "openclaw-hostd");
  assert.equal(transcript.transport, "dbus_native");
  assert.equal(transcript.method, "org.freedesktop.systemd1.Manager.RestartUnit");
  assert.deepEqual(transcript.nativeCapability, {
    registry: "openclaw-hostd-restart-capability-v1",
    operation: "restart_system_sense",
    capabilityId: "hostd.restart_system_sense",
  });
  assert.equal(transcript.jobPath, "/org/freedesktop/systemd1/job/42");
  assert.equal(transcript.beforeMainPid, 100);
  assert.equal(transcript.afterMainPid, 200);
  assert.equal(transcript.authDelegation.mode, "polkit-dbus-fixed-unit");
  assert.equal(transcript.authDelegation.transport, "unix_socket");
  assert.equal(transcript.authDelegation.sudo, null);
  assert.deepEqual(transcript.peerIdentity, {
    boundary: "kernel_so_peercred",
    verified: true,
    matched: true,
  });
  assert.equal(finalTask.outcome.details.postExecutionVerification.summary.targetHealthy, true);
  assert.equal(finalTask.outcome.details.postExecutionVerification.summary.nativeMutationVerified, true);
  assert.equal(finalTask.outcome.details.postExecutionVerification.summary.restoredHealthy, true);
  assert.equal(finalTask.outcome.details.postExecutionVerification.recoveryRecommendation, null);
  assert.equal(finalTask.outcome.details.postExecutionVerification.after.readinessAttempts, 2);
  assert.equal(inventoryCalls, 3);
  assert(events.some((event) => event.name === "systemd.next_repair.execution_completed"));
});

test("approved event-hub repair stays on the fixed hostd capability", async () => {
  let inventoryCalls = 0;
  let hostdTarget = null;
  const { executor } = createExecutorHarness({
    state: {
      SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS: 3000,
      SYSTEMD_REPAIR_POST_VERIFICATION_ATTEMPTS: 2,
      SYSTEMD_REPAIR_POST_VERIFICATION_POLL_MS: 1,
      HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock",
      SYSTEMD_REPAIR_AUTH_DELEGATION: "polkit-dbus-fixed-unit",
    },
    deps: {
      client: {
        sessionManagerUrl: "http://127.0.0.1:4102",
        screenSenseUrl: "http://127.0.0.1:4104",
        screenActUrl: "http://127.0.0.1:4105",
        systemSenseUrl: "http://127.0.0.1:4106",
        fetchJson: async (url) => {
          if (url.endsWith("/system/systemd/units")) {
            inventoryCalls += 1;
            return {
              registry: "openclaw-systemd-unit-inventory-v0",
              observedAt: new Date().toISOString(),
              units: [{
                unit: "openclaw-event-hub.service",
                loadState: "loaded",
                activeState: "active",
                subState: "running",
                mainPid: inventoryCalls === 1 ? 300 : 400,
                systemdObserved: true,
              }],
            };
          }
          return { system: { timestamp: new Date().toISOString(), alerts: [], network: {} } };
        },
        postJson: async () => ({ ok: true }),
      },
      hostdControlClient: async ({ targetUnit, operation }) => {
        hostdTarget = { targetUnit, operation };
        return {
          ok: true,
          registry: "openclaw-hostd-systemd-restart-response-v0",
          protocolVersion: 1,
          requestId: "hostd-event-hub-request-1",
          owner: "openclaw-hostd",
          transport: "unix_socket",
          method: "org.freedesktop.systemd1.Manager.RestartUnit",
          unit: "openclaw-event-hub.service",
          capability: {
            registry: "openclaw-hostd-restart-capability-v1",
            operation: "restart_event_hub",
            capabilityId: "hostd.restart_event_hub",
          },
          governance: {
            callerBoundary: "kernel_so_peercred",
            socketPeerIdentityVerified: true,
            socketPeerIdentityMatched: true,
          },
          nativeMutation: {
            ok: true,
            owner: "openclaw-hostd",
            transport: "dbus_native",
            method: "org.freedesktop.systemd1.Manager.RestartUnit",
            unit: "openclaw-event-hub.service",
            capability: {
              registry: "openclaw-hostd-restart-capability-v1",
              operation: "restart_event_hub",
              capabilityId: "hostd.restart_event_hub",
            },
            jobPath: "/org/freedesktop/systemd1/job/44",
            before: { activeState: "active", subState: "running", mainPid: 300 },
            after: { activeState: "active", subState: "running", mainPid: 400 },
          },
        };
      },
    },
  });
  const task = {
    id: "systemd-event-hub-repair-1",
    type: "systemd_next_repair_task",
    goal: "Execute approved event-hub recovery",
    status: "queued",
    systemdNextRepair: {
      registry: "openclaw-systemd-next-repair-real-execution-v0",
      target: { unit: "openclaw-event-hub.service" },
      command: { command: "systemctl", args: ["restart", "openclaw-event-hub.service"] },
      execution: { realExecutionEnabled: true },
    },
  };

  const result = await executor.executeTaskWithRecovery(task, { autoRecover: false });
  assert.equal(result.finalExecution.task.outcome.kind, "systemd_next_repair_execution_completed");
  assert.deepEqual(hostdTarget, {
    targetUnit: "openclaw-event-hub.service",
    operation: "restart_event_hub",
  });
  assert.deepEqual(result.finalExecution.commandTranscript[0].nativeCapability, {
    registry: "openclaw-hostd-restart-capability-v1",
    operation: "restart_event_hub",
    capabilityId: "hostd.restart_event_hub",
  });
  assert.equal(inventoryCalls, 2);
});

test("failed native systemd repair recommends operator recovery without fallback or retry", async () => {
  const { executor } = createExecutorHarness({
    state: {
      HOSTD_SOCKET_PATH: null,
      SYSTEMD_REPAIR_AUTH_DELEGATION: null,
    },
    deps: {
      client: {
        sessionManagerUrl: "http://127.0.0.1:4102",
        screenSenseUrl: "http://127.0.0.1:4104",
        screenActUrl: "http://127.0.0.1:4105",
        systemSenseUrl: "http://127.0.0.1:4106",
        fetchJson: async (url) => url.endsWith("/system/systemd/units")
          ? {
              units: [{
                unit: "openclaw-system-sense.service",
                loadState: "loaded",
                activeState: "active",
                subState: "running",
                mainPid: 100,
                systemdObserved: true,
              }],
            }
          : { system: { timestamp: new Date().toISOString(), alerts: [], network: {} } },
        postJson: async () => ({ ok: true }),
      },
    },
  });
  const task = {
    id: "systemd-next-native-repair-failure-1",
    type: "systemd_next_repair_task",
    goal: "Reject an unavailable native systemd repair helper",
    status: "queued",
    systemdNextRepair: {
      registry: "openclaw-systemd-next-repair-real-execution-v0",
      target: { unit: "openclaw-system-sense.service" },
      command: { command: "systemctl", args: ["restart", "openclaw-system-sense.service"] },
      execution: { realExecutionEnabled: true },
    },
  };

  const result = await executor.executeTaskWithRecovery(task, { autoRecover: true });
  const finalTask = result.finalExecution.task;
  const verification = finalTask.outcome.details.postExecutionVerification;

  assert.equal(finalTask.status, "failed");
  assert.equal(finalTask.outcome.kind, "systemd_next_repair_execution_failed");
  assert.equal(finalTask.outcome.details.commandTranscript[0].actualCommand, "not-executed");
  assert.equal(finalTask.outcome.details.commandTranscript[0].authDelegation.mode, "hostd-control-required");
  assert.equal(verification.summary.targetHealthy, true);
  assert.equal(verification.summary.nativeMutationVerified, false);
  assert.equal(verification.summary.restoredHealthy, false);
  assert.equal(verification.recoveryRecommendation.strategy, "inspect_unit_and_restore_declarative_generation");
  assert.equal(verification.recoveryRecommendation.automaticRestart, false);
  assert.equal(verification.governance.triggersRecovery, false);
  assert.equal(result.recovery.attempted, false);
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

test("browser task executor prepares once and retries an in-flight capture interruption", async () => {
  const targetUrl = "https://example.com/capture-origin";
  const recoveredUrl = "https://example.com/capture-recovered";
  const postCalls = [];
  let screenActionCalls = 0;
  let observedUrl = targetUrl;
  const { executor } = createExecutorHarness({
    taskManager: {
      buildWorkViewAttachPayload: (reveal, fallbackUrl) => ({
        sessionId: reveal.session?.sessionId ?? null,
        status: "ready",
        activeUrl: reveal.workView?.activeUrl ?? fallbackUrl,
      }),
      attachTaskToWorkView: (candidate, workView) => {
        candidate.workView = workView;
        return candidate;
      },
    },
    deps: {
      client: {
        sessionManagerUrl: "http://session-manager",
        screenSenseUrl: "http://screen-sense",
        screenActUrl: "http://screen-act",
        systemSenseUrl: "http://system-sense",
        fetchJson: async (url) => {
          if (url === "http://screen-sense/screen/current") {
            return {
              ok: true,
              screen: {
                readiness: "ready",
                focusedWindow: { title: "AI work view", pid: 4103 },
                workViewSummary: {
                  url: observedUrl,
                  visibleTextBlocks: [observedUrl],
                  summaryText: observedUrl,
                },
              },
            };
          }
          if (url === "http://session-manager/work-view/state") {
            return {
              ok: true,
              workView: {
                status: "ready",
                visibility: "visible",
                helperStatus: "active",
                browserStatus: "running",
                activeUrl: targetUrl,
              },
            };
          }
          return { ok: true };
        },
        postJson: async (url, body) => {
          postCalls.push({ url, body });
          if (url === "http://screen-act/act/browser/new-tab") {
            screenActionCalls += 1;
            if (screenActionCalls === 1) {
              return {
                ok: true,
                action: {
                  kind: "browser.new_tab",
                  params: body,
                  degraded: true,
                  result: "blocked-or-degraded",
                  mediation: { accepted: false, reason: "trusted_sidecar_capture_source_unavailable" },
                },
              };
            }
            observedUrl = recoveredUrl;
            return {
              ok: true,
              action: {
                kind: "browser.new_tab",
                params: body,
                degraded: false,
                result: "executed-browser-runtime",
                mediation: {
                  accepted: true,
                  transport: "trusted-sidecar-ipc",
                  effect: { url: recoveredUrl, tabCount: 2 },
                  visualGrounding: {
                    registry: "openclaw-trusted-work-view-visual-action-grounding-v0",
                    required: true,
                    status: "grounded",
                    before: {
                      registry: "openclaw-browser-visual-frame-v0",
                      sha256: "a".repeat(64),
                      sequence: 1,
                      pageUrl: targetUrl,
                      capturedAt: "2026-07-11T01:00:00.000Z",
                      fresh: true,
                      width: 960,
                      height: 540,
                      byteLength: 12000,
                      sourceScope: "ai_owned_active_page_only",
                      dataUrl: "data:image/jpeg;base64,forbidden-before",
                    },
                    after: {
                      registry: "openclaw-browser-visual-frame-v0",
                      sha256: "b".repeat(64),
                      sequence: 2,
                      pageUrl: recoveredUrl,
                      capturedAt: "2026-07-11T01:00:01.000Z",
                      fresh: true,
                      width: 960,
                      height: 540,
                      byteLength: 13000,
                      sourceScope: "ai_owned_active_page_only",
                      dataUrl: "data:image/jpeg;base64,forbidden-after",
                    },
                    sequenceAdvanced: true,
                    imageDataRetained: false,
                  },
                },
              },
            };
          }
          return {
            ok: true,
            session: { sessionId: "session-recovered" },
            workView: {
              status: "ready",
              visibility: "visible",
              mode: "foreground-observable",
              helperStatus: "active",
              browserStatus: "running",
              activeUrl: targetUrl,
              displayTarget: "workspace-2",
            },
          };
        },
      },
    },
  });
  const task = {
    id: "browser-capture-recovery-task",
    type: "browser_task",
    goal: "Recover an interrupted browser action",
    status: "queued",
    targetUrl,
  };

  const result = await executor.executeTaskWithRecovery(task, {
    expectedUrl: recoveredUrl,
    actions: [{ kind: "browser.new_tab", params: { url: recoveredUrl } }],
    hideOnComplete: false,
  });

  const evidenceAction = result.finalExecution.verification.actionEvidence.actions[0];
  const recoveryPrepare = postCalls.find((call) => call.body?.operatorActionSource === "task_capture_interruption_recovery");
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(screenActionCalls, 2);
  assert.equal(recoveryPrepare.url, "http://session-manager/work-view/prepare");
  assert.equal(evidenceAction.recovery.attempted, true);
  assert.equal(evidenceAction.recovery.boundedAttempts, 1);
  assert.equal(evidenceAction.mediation.effect.url, recoveredUrl);
  assert.equal(evidenceAction.mediation.visualGrounding.status, "grounded");
  assert.equal(evidenceAction.mediation.visualGrounding.before.sequence, 1);
  assert.equal(evidenceAction.mediation.visualGrounding.after.sequence, 2);
  assert.equal(evidenceAction.mediation.visualGrounding.imageDataRetained, false);
  assert.equal(JSON.stringify(evidenceAction).includes("data:image/"), false);
  assert.equal(result.finalExecution.verification.activeUrl, recoveredUrl);
});

test("browser task executor dispatches one semantic click after trusted handoff revalidation", async () => {
  const fixture = buildSemanticClickExecutionFixture();
  const { executor } = createExecutorHarness({
    taskManager: fixture.taskManager,
    deps: {
      client: fixture.client,
      readWorkViewState: fixture.readWorkViewState,
    },
  });
  const task = {
    id: "semantic-click-executor-task",
    type: "browser_task",
    goal: "Dispatch one reviewed semantic click",
    status: "queued",
    targetUrl: fixture.targetUrl,
  };

  const result = await executor.executeTaskWithRecovery(task, {
    actions: [{ kind: "browser.semantic_click", params: { target: { name: "Inspect", role: "button" } } }],
    expectedUrl: fixture.targetUrl,
    hideOnComplete: false,
    autoRecover: true,
    maxRecoveryAttempts: 1,
  });

  const actionCall = fixture.postCalls.find((call) => call.url === "http://screen-act/act/mouse/click");
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(result.finalExecution.semanticActionHandoff.status, "ready_for_dispatch");
  assert.equal(result.finalExecution.task.outcome.details.semanticActionHandoff.ok, true);
  assert.equal(fixture.screenActCalls, 1);
  assert.equal(actionCall.body.semanticTarget.targetId, "frame-7-target-1");
  assert.equal(actionCall.body.semanticTarget.inventorySha256, "b".repeat(64));
  assert.equal(actionCall.body.semanticTarget.frame.sequence, 7);
});

test("browser task executor blocks stale semantic click handoff without automatic redispatch", async () => {
  const fixture = buildSemanticClickExecutionFixture({ captureFreshness: "stale" });
  const { executor } = createExecutorHarness({
    taskManager: fixture.taskManager,
    deps: {
      client: fixture.client,
      readWorkViewState: fixture.readWorkViewState,
    },
  });
  const task = {
    id: "semantic-click-stale-task",
    type: "browser_task",
    goal: "Block a stale semantic click",
    status: "queued",
    targetUrl: fixture.targetUrl,
  };

  const result = await executor.executeTaskWithRecovery(task, {
    actions: [{ kind: "browser.semantic_click", params: { target: { name: "Inspect", role: "button" } } }],
    expectedUrl: fixture.targetUrl,
    hideOnComplete: false,
    autoRecover: true,
    maxRecoveryAttempts: 1,
  });

  assert.equal(result.finalExecution.task.status, "failed");
  assert.equal(result.finalExecution.semanticActionHandoff.reason, "observation_not_fresh");
  assert.equal(result.recovery.attempted, false);
  assert.equal(result.recovery.suppressed, true);
  assert.equal(fixture.screenActCalls, 0);
});

test("browser task executor blocks semantic click when current inventory digest mismatches", async () => {
  const fixture = buildSemanticClickExecutionFixture({ runtimeActionReason: "semantic_target_capture_mismatch" });
  const { executor } = createExecutorHarness({
    taskManager: fixture.taskManager,
    deps: {
      client: fixture.client,
      readWorkViewState: fixture.readWorkViewState,
    },
  });
  const task = {
    id: "semantic-click-mismatch-task",
    type: "browser_task",
    goal: "Block a mismatched semantic click",
    status: "queued",
    targetUrl: fixture.targetUrl,
  };

  const result = await executor.executeTaskWithRecovery(task, {
    actions: [{ kind: "browser.semantic_click", params: { target: { name: "Inspect", role: "button" } } }],
    expectedUrl: fixture.targetUrl,
    hideOnComplete: false,
  });

  assert.equal(result.finalExecution.task.status, "failed");
  assert.equal(result.finalExecution.semanticActionHandoff.reason, "semantic_target_capture_mismatch");
  assert.equal(result.finalExecution.task.outcome.details.semanticActionHandoff.runtimeOwnerRevalidation.accepted, false);
  assert.equal(result.recovery.suppressed, true);
  assert.equal(fixture.screenActCalls, 1);
});

test("browser task executor returns recoverable evidence when session authority is unavailable", async () => {
  const { executor } = createExecutorHarness({
    deps: {
      client: {
        sessionManagerUrl: "http://session-manager",
        screenSenseUrl: "http://screen-sense",
        screenActUrl: "http://screen-act",
        systemSenseUrl: "http://system-sense",
        fetchJson: async () => ({ ok: true }),
        postJson: async (url) => {
          if (url === "http://session-manager/work-view/prepare") {
            throw new Error("connect ECONNREFUSED");
          }
          return { ok: true };
        },
      },
    },
  });
  const task = {
    id: "browser-authority-interruption-task",
    type: "browser_task",
    goal: "Preserve task state across authority loss",
    status: "queued",
    targetUrl: "https://example.com/authority-loss",
  };

  const result = await executor.executeTaskWithRecovery(task);
  const failed = result.finalExecution;

  assert.equal(failed.task.status, "failed");
  assert.equal(failed.authorityInterruption.stage, "prepare");
  assert.equal(failed.authorityInterruption.automaticRestart, false);
  assert.equal(failed.task.outcome.details.authorityInterruption.recoveryAction, "restore_trusted_work_view_then_recover_task");
});

test("operator step blocks a browser action or target that is outside the task binding", async () => {
  const { executor, state, events } = createExecutorHarness();
  const task = {
    id: "operator-binding-task",
    type: "browser_task",
    goal: "Keep operator execution bound to the reviewed plan",
    status: "queued",
    targetUrl: "https://example.com/reviewed",
    plan: {
      strategy: "rule-v1",
      steps: [{
        phase: "acting_on_target",
        kind: "mouse.click",
        status: "pending",
        params: { x: 10, y: 20, button: "left" },
      }],
    },
  };
  task.operatorExecutionBinding = buildBrowserTaskExecutionBinding(task);
  state.tasks.set(task.id, task);

  const result = await executor.runOperatorStep({
    targetUrl: "https://example.com/unapproved",
    actions: [{ kind: "browser.new_tab", params: { url: "https://example.com/unapproved" } }],
  });

  assert.equal(result.ran, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "operator_execution_target_mismatch");
  assert.equal(task.status, "queued");
  assert.equal(events.at(-1)?.name, "task.blocked");
  assert.equal(events.at(-1)?.payload?.operatorExecutionBinding?.actionShapeValidated, undefined);
});

test("operator options retain only a transient write-only input override", async () => {
  const { executor } = createExecutorHarness();
  const task = {
    id: "operator-input-binding-task",
    type: "browser_task",
    targetUrl: "https://example.com/reviewed",
    plan: {
      strategy: "rule-v1",
      steps: [
        {
          phase: "acting_on_target",
          kind: "keyboard.type",
          status: "pending",
          params: { text: "planned transient value" },
        },
        {
          phase: "acting_on_target",
          kind: "mouse.click",
          status: "pending",
          params: { x: 10, y: 20, button: "left" },
        },
      ],
    },
  };
  task.operatorExecutionBinding = buildBrowserTaskExecutionBinding(task);

  const options = await executor.buildOperatorOptions(task, {
    actions: [
      { kind: "keyboard.type", params: { text: "operator supplied transient value" } },
      { kind: "mouse.click", params: { x: 10, y: 20, button: "left" } },
    ],
  });

  assert.equal(options.operatorExecutionBindingError, undefined);
  assert.equal(options.targetUrl, task.targetUrl);
  assert.equal(options.operatorExecutionBinding.source, "task_plan_with_transient_input");
  assert.equal(options.actions[0].params.text, "operator supplied transient value");
  assert.doesNotMatch(JSON.stringify(options.operatorExecutionBinding), /operator supplied transient value/u);
});

test("operator options materialise the existing context packet for live provider execution", async () => {
  const { executor, state } = createExecutorHarness();
  const task = {
    id: "provider-context-task",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    goal: "Use local engineering evidence for one approved provider call",
    status: "completed",
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [{
          invocationId: "provider-context-invocation",
          command: "npm test",
          exitCode: 0,
          timedOut: false,
          stdout: "provider context evidence",
          stderr: "",
        }],
      },
    },
  };
  state.tasks.set(task.id, task);

  const options = await executor.buildOperatorOptions(task, {
    liveProviderExecution: {
      requested: true,
      taskId: task.id,
      contextPacket: {
        requested: true,
        taskId: task.id,
        instruction: "Recommend the next bounded verification step.",
      },
    },
  });

  assert.equal(options.operator, "loop-v1");
  assert.equal(options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE].contextContentIncluded, false);
  assert.equal(options.liveProviderExecution.requestEnvelope.messages.length, 1);
  assert.match(options.liveProviderExecution.requestEnvelope.messages[0].content, /npm test/);
  assert.match(options.liveProviderExecution.requestEnvelope.messages[0].content, /provider context evidence/);
});

test("operator options carry explicitly requested work-view observation and plan/todo context", async () => {
  const workViewId = "work-view-provider-context";
  const taskId = "provider-context-work-view-task";
  const { executor, state } = createExecutorHarness({
    state: {
      runtimeState: { currentTaskId: taskId },
      nativeEngineeringPlanTodoWorkbenchRecords: new Map([[taskId, {
        key: taskId,
        recordId: "provider-context-workbench",
        taskId,
        revision: 1,
        todos: [{ id: "todo-provider", description: "Review bounded provider context", status: "pending" }],
      }]]),
    },
    deps: {
      readWorkViewState: async () => ({
        ok: true,
        data: {
          ok: true,
          workView: {
            workViewId,
            status: "ready",
            visibility: "visible",
            helperStatus: "active",
            browserStatus: "running",
          },
          session: { sessionId: "provider-context-session", status: "ready" },
          trustedSession: {
            sessionIdentity: { status: "authoritative" },
            helperRuntime: {
              status: "active",
              actionAuthority: "active",
              leaseMatched: true,
              captureSourceStatus: "ready",
              captureFreshness: "fresh",
              sidecar: {
                captureObservation: {
                  registry: "capture-v0",
                  sequence: 4,
                  visualFrame: {
                    available: true,
                    fresh: true,
                    sequence: 4,
                    sha256: "c".repeat(64),
                    width: 960,
                    height: 540,
                    byteLength: 9000,
                    sourceScope: "ai_owned_active_page_only",
                  },
                  semanticTargets: {
                    available: true,
                    itemCount: 1,
                    inventorySha256: "d".repeat(64),
                    frameSequence: 4,
                    frameSha256: "c".repeat(64),
                  },
                },
              },
            },
          },
        },
      }),
    },
  });
  const task = {
    id: taskId,
    type: "cloud_consciousness_live_provider_egress_execution_task",
    goal: "Use a bounded trusted context",
    status: "queued",
    workView: { sessionId: "provider-context-session", workViewId },
    plan: {
      steps: [{ id: "provider-step", phase: "verify", title: "Review provider context", status: "pending" }],
    },
  };
  const sourceTask = {
    id: "provider-context-source-task",
    type: "source_command_task",
    goal: "Review the source verification evidence",
    status: "completed",
    workView: { sessionId: "provider-context-session", workViewId },
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [{
          invocationId: "provider-context-source-invocation",
          command: "npm test",
          exitCode: 0,
          timedOut: false,
          stdout: "source verification passed",
          stderr: "",
        }],
      },
    },
    plan: {
      steps: [{ id: "source-step", phase: "verify", title: "Inspect source verification", status: "done" }],
    },
  };
  state.tasks.set(task.id, task);
  state.tasks.set(sourceTask.id, sourceTask);

  const options = await executor.buildOperatorOptions(task, {
    liveProviderExecution: {
      requested: true,
      taskId,
      contextPacket: {
        requested: true,
        taskId,
        sourceTaskId: sourceTask.id,
        includeWorkView: true,
        includeWorkViewObservation: true,
        includePlanTodo: true,
      },
    },
  });

  assert.equal(options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE].workViewObservationIncluded, true);
  assert.equal(options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE].executionTaskId, taskId);
  assert.equal(options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE].sourceTaskId, sourceTask.id);
  assert.equal(options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE].planTodoEvidenceIncluded, true);
  assert.equal(options.liveProviderExecution.contextPacket.includeWorkView, true);
  assert.equal(options.liveProviderExecution.contextPacket.includePlanTodo, true);
  assert.match(options.liveProviderExecution.requestEnvelope.messages[0].content, /work-view-provider-context/);
  assert.match(options.liveProviderExecution.requestEnvelope.messages[0].content, /source verification passed/);
  assert.equal(options.liveProviderExecution.contextPacket.sourceTaskId, sourceTask.id);
});

test("execution serializer exposes transient recommendation separately from compact task evidence", () => {
  const { executor } = createExecutorHarness();
  const recommendation = {
    registry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
    contract: "engineering_recommendation_v0",
    actionId: "create_verification_task",
    reason: "Transient operator-facing recommendation reason.",
    requiresOperatorReview: true,
  };
  const evidence = {
    registry: recommendation.registry,
    contract: recommendation.contract,
    status: "valid_recommendation",
    valid: true,
    reason: null,
    actionId: recommendation.actionId,
    reasonIncluded: false,
  };

  const serialized = executor.serialiseExecutionResult({
    finalExecution: {
      task: {
        outcome: { details: { recommendation: evidence } },
      },
      recommendation,
      summary: { recommendation: evidence },
    },
  });

  assert.deepEqual(serialized.recommendation, recommendation);
  assert.deepEqual(serialized.recommendationEvidence, evidence);
});

test("approved declarative evolution staging executes only the hash-bound candidate", async () => {
  const candidateHash = "b".repeat(64);
  const candidateText = "validated candidate body";
  let executionCalls = 0;
  const approval = {
    id: "approval-declarative",
    status: "approved",
    binding: {
      kind: "native_declarative_evolution_candidate",
      candidateHash,
    },
  };
  const task = {
    id: "task-declarative",
    type: "native_declarative_evolution_staging",
    goal: "Stage a managed Nix candidate",
    status: "queued",
    policy: { request: { requiresApproval: true }, decision: { decision: "audit_only", reason: "approved_and_audited" } },
    approval: { requestId: approval.id, status: "approved" },
    plan: { strategy: "native-declarative-evolution-staging-v0" },
    nativeDeclarativeEvolution: {
      candidate: {
        candidateHash,
        changes: [{ operation: "enable_component", component: "core" }],
      },
      approvalBinding: approval.binding,
      governance: { writesManagedConfig: false, switchesGeneration: false, executesRollback: false },
      execution: null,
    },
  };
  const { executor, state, events } = createExecutorHarness({
    state: { approvals: new Map([[approval.id, approval]]) },
    planBuilder: {
      buildNativeDeclarativeEvolutionCandidate: async ({ changes }) => ({
        candidateStatus: "validated",
        candidateHash,
        candidateText,
        changes,
        validation: { status: "passed" },
      }),
      executeNativeDeclarativeEvolutionCandidate: async ({ candidateText: text, candidateHash: hash }) => {
        executionCalls += 1;
        assert.equal(text, candidateText);
        assert.equal(hash, candidateHash);
        return {
          status: "passed",
          candidateHash,
          staging: { status: "staged", path: `/var/lib/openclaw/managed-config-staging/${candidateHash}.nix` },
          evaluation: { status: "passed", mode: "nix-eval" },
          build: { status: "passed", mode: "nix-build-dry-run" },
          governance: { writesManagedConfig: false, switchesGeneration: false, executesRollback: false },
        };
      },
    },
  });

  const result = await executor.executeTaskWithRecovery(task);
  assert.equal(result.finalExecution.task.status, "completed");
  assert.equal(executionCalls, 1);
  assert.equal(result.finalExecution.task.nativeDeclarativeEvolution.execution.candidateHash, candidateHash);
  assert.equal(result.finalExecution.task.nativeDeclarativeEvolution.governance.approvalBoundToCandidateHash, true);
  assert.equal(JSON.stringify(events).includes(candidateText), false);
  assert.equal(events.some((event) => event.name === "task.completed"), true);
  assert.equal(state.approvals.get(approval.id).binding.candidateHash, candidateHash);
});

test("approved declarative evolution staging refuses a changed candidate before staging", async () => {
  const expectedHash = "c".repeat(64);
  const observedHash = "d".repeat(64);
  let executionCalls = 0;
  const approval = {
    id: "approval-declarative-mismatch",
    status: "approved",
    binding: { kind: "native_declarative_evolution_candidate", candidateHash: expectedHash },
  };
  const task = {
    id: "task-declarative-mismatch",
    type: "native_declarative_evolution_staging",
    goal: "Stage a managed Nix candidate",
    status: "queued",
    policy: { request: { requiresApproval: true }, decision: { decision: "audit_only" } },
    approval: { requestId: approval.id, status: "approved" },
    plan: { strategy: "native-declarative-evolution-staging-v0" },
    nativeDeclarativeEvolution: {
      candidate: { candidateHash: expectedHash, changes: [{ operation: "enable_component", component: "core" }] },
      approvalBinding: approval.binding,
      governance: {},
    },
  };
  const { executor } = createExecutorHarness({
    state: { approvals: new Map([[approval.id, approval]]) },
    planBuilder: {
      buildNativeDeclarativeEvolutionCandidate: async () => ({
        candidateStatus: "validated",
        candidateHash: observedHash,
        candidateText: "changed candidate",
        validation: { status: "passed" },
      }),
      executeNativeDeclarativeEvolutionCandidate: async () => {
        executionCalls += 1;
        return { status: "passed" };
      },
    },
  });

  const result = await executor.executeTaskWithRecovery(task);
  assert.equal(result.finalExecution.task.status, "failed");
  assert.match(result.finalExecution.task.outcome.summary, /candidate changed after approval/);
  assert.equal(executionCalls, 0);
});
