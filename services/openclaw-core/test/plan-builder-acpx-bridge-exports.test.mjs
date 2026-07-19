import test from "node:test";
import assert from "node:assert/strict";

import { createPlanBuilder } from "../src/plan-builder.mjs";

function createPlanBuilderHarness({
  acpxDraft,
  createStandingProviderAdvisoryImpl,
  publishAuditEvent,
} = {}) {
  const tasks = new Map();
  const approvals = new Map();
  const runtimeState = {};
  const noop = () => {};
  const asyncNoop = async () => {};
  const serialiseTask = (task) => task;
  const serialisePlanForPublic = (plan) => plan;
  const taskManager = {
    serialiseTask,
    getTaskById: (id) => tasks.get(id) ?? null,
    getNextQueuedTask: () => null,
    listTasks: () => [],
    createTask: (task) => ({ id: "task-plan-builder-harness", status: "queued", ...task }),
    appendTaskPhase: (task) => task,
    completeTask: (task, details) => ({ ...task, status: "completed", outcome: { details } }),
    failTask: (task, reason, details) => ({ ...task, status: "failed", outcome: { reason, details } }),
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: noop,
    buildTaskSummary: () => ({ total: tasks.size }),
  };
  const pluginReview = {
    selectOpenClawToolCatalogWorkspace: () => null,
    buildNativePluginManifestProfile: () => ({ ok: true }),
    buildNativeOpenClawToolCatalogProfile: () => ({ ok: true }),
    buildNativeOpenClawWorkspaceSemanticIndex: () => ({ ok: true }),
    buildNativeOpenClawWorkspaceSymbolLookup: () => ({ ok: true }),
    buildNativeOpenClawWorkspaceEditTargetSelection: () => ({ ok: true }),
    buildNativeOpenClawPromptSemanticsProfile: () => ({ ok: true }),
    buildOpenClawPluginManifestMap: () => ({ ok: true }),
    buildOpenClawPluginCapabilityPlan: () => ({ ok: true }),
    buildNativeAcpxCodexBridgeWrapperDraft: acpxDraft,
  };
  return createPlanBuilder({
    client: {
      fetchJson: async () => ({ ok: true }),
      postJson: async () => ({ ok: true }),
      eventHubUrl: "http://127.0.0.1:4101",
      sessionManagerUrl: "http://127.0.0.1:4102",
      browserRuntimeUrl: "http://127.0.0.1:4103",
      screenSenseUrl: "http://127.0.0.1:4104",
      screenActUrl: "http://127.0.0.1:4105",
      systemSenseUrl: "http://127.0.0.1:4106",
      systemHealUrl: "http://127.0.0.1:4107",
    },
    state: {
      tasks,
      runtimeState,
      persistState: noop,
      approvals,
      policyAuditLog: [],
      capabilityInvocationLog: [],
      standingProviderAdvisoryState: {},
      MAX_CAPABILITY_INVOCATION_ENTRIES: 100,
      CAPABILITY_HEALTH_TIMEOUT_MS: 10,
      autonomyMode: "guardian",
      CROSS_BOUNDARY_INTENTS: [],
      SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY: "systemd-repair-execution",
      SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY: "systemd-next-repair-shell",
      SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY: "systemd-next-repair-real-execution",
      SYSTEMD_REPAIR_REAL_EXECUTION_UNIT: "openclaw-core.service",
      HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock",
      SYSTEMD_REPAIR_AUTH_DELEGATION: "polkit",
      LONG_TERM_MEMORY_TASK_REGISTRY: "long-term-memory-task",
      LONG_TERM_MEMORY_DIR_DISPLAY_PATH: ".openclaw/memory",
      LONG_TERM_MEMORY_FILE_DISPLAY_PATH: ".openclaw/memory/ledger.jsonl",
      CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY: "cloud-consciousness-handoff-task",
      CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY: "cloud-consciousness-provider-dry-run-task",
      CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY: "cloud-consciousness-provider-call-rehearsal-task",
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY: "cloud-consciousness-live-provider-runbook-task",
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY: "cloud-consciousness-live-provider-execution-plan-task",
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY: "cloud-consciousness-live-provider-runtime-adapter-task",
      CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH: ".openclaw/cloud/handoff.json",
      CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH: ".openclaw/cloud/dry-run.json",
      CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH: ".openclaw/cloud/response.json",
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH: ".openclaw/cloud/runbook.md",
      CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH: ".openclaw/cloud/execution-plan.json",
    },
    taskManager,
    pluginReview,
    approvalEngine: {
      serialiseApproval: (approval) => approval,
      buildApprovalSummary: () => ({ total: approvals.size }),
      createApprovalRequestForTask: (task) => ({ id: `approval-${task.id}`, status: "pending" }),
      publishTaskApprovalIfPending: asyncNoop,
    },
    policyEvaluator: {
      evaluatePolicyIntent: (input) => ({
        id: "policy-plan-builder-harness",
        decision: input.approved === true ? "audit_only" : "require_approval",
        domain: input.domain,
        risk: input.risk,
        reason: input.approved === true ? "approved_and_audited" : "approval_required",
        approved: input.approved === true,
        autonomyMode: "guardian",
        autonomous: false,
      }),
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: (decision) => decision?.decision === "audit_only",
    },
    publishEvent: asyncNoop,
    publishAuditEvent,
    createStandingProviderAdvisoryImpl,
    host: "127.0.0.1",
    port: 4100,
  });
}

test("plan builder exposes ACPX/Codex wrapper draft builder for executor handlers", () => {
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: (input) => ({
      ok: true,
      registry: "openclaw-native-acpx-codex-bridge-wrapper-draft-v0",
      input,
    }),
  });

  assert.equal(typeof planBuilder.buildNativeAcpxCodexBridgeWrapperDraft, "function");
  assert.equal(typeof planBuilder.createAutomaticFixedUnitIncidentTriageTask, "function");
  assert.equal(typeof planBuilder.createAutomaticFixedUnitIncidentRepairTask, "function");
  assert.deepEqual(
    planBuilder.buildNativeAcpxCodexBridgeWrapperDraft({
      sessionKey: "agent:codex:one",
      command: "npx.cmd",
      wrapperName: "codex-acp-one",
    }),
    {
      ok: true,
      registry: "openclaw-native-acpx-codex-bridge-wrapper-draft-v0",
      input: {
        sessionKey: "agent:codex:one",
        command: "npx.cmd",
        wrapperName: "codex-acp-one",
      },
    },
  );
});

test("plan builder assembles standing advisory with required audit and persistent budget state", async () => {
  const assembly = [];
  const requiredAudit = async () => ({ ok: true });
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: (deps) => {
      assembly.push(deps);
      return {
        restoreState: () => ({ ok: true, registry: "openclaw-standing-provider-advisory-v0" }),
        invoke: async () => ({
          ok: true,
          status: "local_fallback",
          fallback: { reason: "standing_advisory_disabled" },
          evidence: {
            actionId: "review_current_todo",
            budget: { callsUsed: 0, callsLimit: 3, tokensUsed: 0, tokensLimit: 4096 },
          },
          governance: { providerCalled: false },
        }),
      };
    },
  });

  const result = await planBuilder.invokeCapability({
    capabilityId: "sense.openclaw.system.standing_advisory",
    params: { confirm: true },
  });

  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(typeof assembly[0].persistState, "function");
  assert.equal(assembly[0].systemSenseUrl, "http://127.0.0.1:4106");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.policy.domain, "cross_boundary");
  assert.equal(result.response.invocation.authorization.registry, "openclaw-standing-capability-authorization-v0");
  assert.equal(result.response.summary.status, "local_fallback");
  assert.equal(planBuilder.restoreStandingProviderAdvisoryState().ok, true);
});
