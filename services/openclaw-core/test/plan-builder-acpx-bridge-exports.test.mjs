import test from "node:test";
import assert from "node:assert/strict";

import { createPlanBuilder } from "../src/plan-builder.mjs";

function createPlanBuilderHarness({
  acpxDraft,
  createStandingProviderAdvisoryImpl,
  createAiWorkspaceAssessmentImpl,
  createAiWorkspaceOcrAssessmentImpl,
  createAiWorkspaceOcrClickImpl,
  createAiWorkspaceOcrFocusTypeImpl,
  createAiWorkspaceOcrTypeImpl,
  createAiWorkspaceSingleStepImpl,
  createAiWorkspaceRunCoordinatorImpl,
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
    createAiWorkspaceAssessmentImpl,
    createAiWorkspaceOcrAssessmentImpl,
    createAiWorkspaceOcrClickImpl,
    createAiWorkspaceOcrFocusTypeImpl,
    createAiWorkspaceOcrTypeImpl,
    createAiWorkspaceSingleStepImpl,
    createAiWorkspaceRunCoordinatorImpl,
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

test("plan builder assembles AI workspace single-step with the shared provider and actuator owners", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceSingleStepImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async () => ({
          ok: true,
          registry: "nixsoma-ai-workspace-single-step-v0",
          status: "no_op",
          decision: { actionId: "no_op", reason: "transient", confidence: 1 },
          evidence: {
            taskId: "task-reviewed-1",
            objectiveContentHash: "a".repeat(64),
            taskVersionHash: "b".repeat(64),
            contextContentHash: "c".repeat(64),
            requestContentHash: "d".repeat(64),
            responseContentHash: "e".repeat(64),
            sceneContentHash: "f".repeat(64),
            sceneItemCount: 1,
            actionExecuted: false,
          },
          governance: {
            providerCalled: true,
            actionExecuted: false,
            maximumActions: 1,
            automaticRepeat: false,
          },
        }),
      };
    },
  });

  const result = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.single_step",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });

  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(assembly[0].screenSenseUrl, "http://127.0.0.1:4104");
  assert.equal(assembly[0].screenActUrl, "http://127.0.0.1:4105");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(typeof assembly[0].postJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.single_step");
  assert.equal(result.response.invocation.summary.actionId, "no_op");

  const bounded = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.bounded_run",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });
  assert.equal(bounded.statusCode, 200);
  assert.equal(bounded.response.invocation.summary.kind, "ai.workspace.bounded_run");
  assert.equal(bounded.response.invocation.summary.stepCount, 1);
  assert.equal(bounded.response.invocation.summary.steps[0].actionId, "no_op");
});

test("plan builder assembles read-only AI workspace assessment with shared authority", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceAssessmentImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async ({ taskId }) => ({
          ok: true,
          registry: "nixsoma-ai-workspace-task-assessment-v0",
          status: "assessed",
          assessment: { outcome: "incomplete", confidence: 0.7 },
          evidence: {
            taskId,
            taskStatus: "running",
            objectiveContentHash: "a".repeat(64),
            taskVersionHash: "b".repeat(64),
            contextContentHash: "c".repeat(64),
            requestContentHash: "d".repeat(64),
            responseContentHash: "e".repeat(64),
            sceneContentHash: "f".repeat(64),
            sceneItemCount: 1,
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            semanticSceneBound: true,
            currentBrowserSurfaceBound: true,
            taskObjectiveBound: true,
            taskObjectiveProviderEgress: true,
            rawTaskGoalProviderEgress: false,
            pixelsProviderEgress: false,
            urlsProviderEgress: false,
            inputValuesProviderEgress: false,
          },
        }),
        localFallback: () => ({ status: "local_fallback" }),
      };
    },
  });

  const result = await planBuilder.invokeCapability({
    capabilityId: "sense.ai.workspace.assessment",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });

  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(assembly[0].screenSenseUrl, "http://127.0.0.1:4104");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.assessment");
  assert.equal(result.response.invocation.summary.outcome, "incomplete");
});

test("plan builder exports the reviewed-cycle coordinator through capability runtime", async () => {
  let reviewedInvocations = 0;
  let semanticFormInvocations = 0;
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: async () => ({ ok: true }),
    createStandingProviderAdvisoryImpl: () => ({
      restoreState: () => ({ ok: true }),
      requestDecision: async () => ({ ok: false, reason: "disabled" }),
    }),
    createAiWorkspaceRunCoordinatorImpl: (owners) => ({
      singleStep: owners.singleStep,
      assessment: owners.assessment,
      ocrAssessment: owners.ocrAssessment,
      ocrClick: owners.ocrClick,
      boundedRun: { invoke: async () => ({ ok: true }) },
      reviewedCycle: {
        invoke: async ({ taskId }) => {
          reviewedInvocations += 1;
          return {
            ok: true,
            status: "assessed",
            terminalReason: "assessment_terminal",
            run: {
              status: "stopped_after_first",
              steps: [],
              evidence: { runCompletionAudit: true, outcomeUnknown: false },
            },
            assessment: {
              status: "assessed",
              assessment: { outcome: "incomplete", confidence: 0.7 },
              evidence: {
                taskId,
                objectiveContentHash: "a".repeat(64),
                taskVersionHash: "b".repeat(64),
                completionAudit: true,
              },
              governance: {
                providerCalled: true,
                semanticSceneBound: true,
                currentBrowserSurfaceBound: true,
                taskObjectiveBound: true,
                taskObjectiveProviderEgress: true,
                maximumActions: 0,
                actionExecuted: false,
                taskMutated: false,
                automaticContinuation: false,
              },
            },
            evidence: {
              taskId,
              objectiveContentHash: "a".repeat(64),
              taskVersionHash: "b".repeat(64),
              providerCallCount: 2,
              providerCallCountMinimum: 2,
              actionCount: 0,
              actionCountMinimum: 0,
              runCompletionAudit: true,
              assessmentContinuationAudit: true,
              assessmentCompletionAudit: true,
              cycleCompletionAudit: true,
              assessmentReceiptEligible: false,
              outcomeUnknown: false,
            },
          };
        },
      },
      semanticFormWorkflow: {
        invoke: async ({ taskId }) => {
          semanticFormInvocations += 1;
          return {
            ok: true,
            status: "completed",
            terminalReason: "verified_type_then_submit",
            steps: [],
            evidence: {
              taskId,
              objectiveContentHash: "a".repeat(64),
              taskVersionHash: "b".repeat(64),
              stepCount: 2,
              providerCallCount: 2,
              providerCallCountMinimum: 2,
              actionCount: 2,
              actionCountMinimum: 2,
              continuationAudit: true,
              workflowCompletionAudit: true,
              outcomeUnknown: false,
            },
            governance: {
              continuationAfterVerifiedTypeOnly: true,
              continuedAfterVerifiedType: true,
              boundedAutomaticContinuation: true,
            },
          };
        },
      },
    }),
  });

  const result = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.reviewed_cycle",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.reviewed_cycle");
  assert.equal(result.response.invocation.summary.assessment.outcome, "incomplete");
  assert.equal(reviewedInvocations, 1);

  const semanticForm = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.semantic_form_workflow",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });
  assert.equal(semanticForm.statusCode, 200);
  assert.equal(semanticForm.response.invocation.summary.kind,
    "ai.workspace.semantic_form_workflow");
  assert.equal(semanticForm.response.invocation.summary.workflowCompletionAudit, true);
  assert.equal(semanticFormInvocations, 1);
});

test("plan builder assembles task-bound OCR assessment with shared provider authority", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceOcrAssessmentImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async ({ taskId }) => ({
          ok: true,
          registry: "nixsoma-ai-workspace-ocr-assessment-v0",
          status: "assessed",
          assessment: { outcome: "complete", confidence: 0.9 },
          evidence: {
            taskId,
            taskStatus: "running",
            objectiveContentHash: "a".repeat(64),
            taskVersionHash: "b".repeat(64),
            contextContentHash: "c".repeat(64),
            requestContentHash: "d".repeat(64),
            responseContentHash: "e".repeat(64),
            frameContentHash: "f".repeat(64),
            ocrSceneContentHash: "1".repeat(64),
            ocrBindingHash: "2".repeat(64),
            ocrItemCount: 1,
            ocrCharacterCount: 21,
            verificationFrameContentHash: "3".repeat(64),
            verificationOcrSceneContentHash: "4".repeat(64),
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            localOcrBound: true,
            localOcrRevalidated: true,
            currentActiveSurfaceBound: true,
            taskObjectiveBound: true,
            taskObjectiveProviderEgress: true,
            rawTaskGoalProviderEgress: false,
            ocrTextProviderEgress: true,
            ocrTextPersistedLocally: false,
            pixelsProviderEgress: false,
          },
        }),
        localFallback: () => ({ status: "local_fallback" }),
      };
    },
  });

  const result = await planBuilder.invokeCapability({
    capabilityId: "sense.ai.workspace.ocr_assessment",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });

  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.ocr_assessment");
  assert.equal(result.response.invocation.summary.ocrTextProviderEgress, true);
  assert.equal(result.response.invocation.summary.pixelsProviderEgress, false);
});

test("plan builder assembles OCR click with shared provider and screen action owners", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceOcrClickImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async ({ taskId }) => ({
          ok: true,
          registry: "nixsoma-ai-workspace-ocr-click-v0",
          status: "executed",
          decision: { actionId: "click_item", itemOrdinal: 1, confidence: 0.9 },
          action: { actionId: "click_item", itemOrdinal: 1, surfaceId: 42,
            inventorySequence: 9, executed: true },
          evidence: {
            taskId,
            actionExecuted: true,
            receiptMatched: true,
            frameChanged: true,
            postActionVerified: true,
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            localOcrBound: true,
            localOcrRevalidated: true,
            currentFrameBound: true,
            currentActiveSurfaceBound: true,
            ocrItemOrdinalBound: true,
            taskObjectiveBound: true,
            taskObjectiveProviderEgress: true,
            rawTaskGoalProviderEgress: false,
            ocrTextProviderEgress: true,
            ocrTextPersistedLocally: false,
            pixelsProviderEgress: false,
            arbitraryPointerInput: false,
            providerRetentionControlledExternally: true,
          },
        }),
        localFallback: () => ({ status: "local_fallback" }),
      };
    },
  });
  const result = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.ocr_click",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });
  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(assembly[0].screenActUrl, "http://127.0.0.1:4105");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(typeof assembly[0].postJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.ocr_click");
  assert.equal(result.response.invocation.summary.actionExecuted, true);
  assert.equal(result.response.invocation.summary.postActionVerified, true);
});

test("plan builder assembles OCR type with shared provider and screen action owners", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const inputEvidence = {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 6,
    byteLength: 6,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceOcrTypeImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async ({ taskId }) => ({
          ok: true,
          registry: "nixsoma-ai-workspace-ocr-type-v0",
          status: "executed",
          decision: { actionId: "type_text", inputEvidence, confidence: 0.9 },
          action: { actionId: "type_text", inputEvidence, surfaceId: 42,
            inventorySequence: 9, executed: true },
          evidence: {
            taskId,
            inputEvidence,
            actionExecuted: true,
            receiptMatched: true,
            frameChanged: true,
            postActionVerified: true,
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            localOcrBound: true,
            localOcrRevalidated: true,
            currentFrameBound: true,
            currentActiveSurfaceBound: true,
            taskObjectiveInputBound: true,
            providerGeneratedInput: true,
            keyboardInput: true,
            hotkeyInput: false,
            enterKeyInput: false,
            inputTextExposed: false,
            inputTextPersisted: false,
            taskObjectiveBound: true,
            taskObjectiveProviderEgress: true,
            rawTaskGoalProviderEgress: false,
            ocrTextProviderEgress: true,
            ocrTextPersistedLocally: false,
            pixelsProviderEgress: false,
            arbitraryKeyboardInput: false,
            providerRetentionControlledExternally: true,
          },
        }),
        localFallback: () => ({ status: "local_fallback" }),
      };
    },
  });
  const result = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.ocr_type",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });
  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(assembly[0].screenActUrl, "http://127.0.0.1:4105");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(typeof assembly[0].postJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.ocr_type");
  assert.equal(result.response.invocation.summary.inputEvidence.charCount, 6);
  assert.equal(result.response.invocation.summary.postActionVerified, true);
});

test("plan builder assembles OCR focus type through the shared one-call coordinator", async () => {
  const assembly = [];
  const standingOwner = {
    restoreState: () => ({ ok: true }),
    requestDecision: async () => ({ ok: false, reason: "disabled" }),
  };
  const requiredAudit = async () => ({ ok: true });
  const inputEvidence = {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 6,
    byteLength: 6,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
  const planBuilder = createPlanBuilderHarness({
    acpxDraft: () => ({ ok: true }),
    publishAuditEvent: requiredAudit,
    createStandingProviderAdvisoryImpl: () => standingOwner,
    createAiWorkspaceOcrFocusTypeImpl: (deps) => {
      assembly.push(deps);
      return {
        invoke: async ({ taskId }) => ({
          ok: true,
          registry: "nixsoma-ai-workspace-ocr-focus-type-v0",
          status: "executed",
          decision: { actionId: "focus_and_type", itemOrdinal: 7, inputEvidence, confidence: 0.9 },
          actions: [
            { index: 1, actionId: "focus_item", itemOrdinal: 7, surfaceId: 42, executed: true },
            { index: 2, actionId: "type_text", inputEvidence, surfaceId: 42, executed: true },
          ],
          evidence: {
            taskId,
            itemOrdinal: 7,
            inputEvidence,
            actionCount: 2,
            focusActionExecuted: true,
            focusActionVerified: true,
            typeActionExecuted: true,
            postActionVerified: true,
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            localOcrBound: true,
            localOcrRevalidated: true,
            focusRevalidated: true,
            currentFrameBound: true,
            currentActiveSurfaceBound: true,
            ocrItemOrdinalBound: true,
            taskObjectiveInputBound: true,
            providerGeneratedInput: true,
            pointerInput: true,
            keyboardInput: true,
            hotkeyInput: false,
            enterKeyInput: false,
            inputTextExposed: false,
            inputTextPersisted: false,
            taskObjectiveBound: true,
            taskObjectiveProviderEgress: true,
            rawTaskGoalProviderEgress: false,
            ocrTextProviderEgress: true,
            ocrTextPersistedLocally: false,
            pixelsProviderEgress: false,
            arbitraryPointerInput: false,
            arbitraryKeyboardInput: false,
            providerRetentionControlledExternally: true,
          },
        }),
        localFallback: () => ({ status: "local_fallback" }),
      };
    },
  });
  const result = await planBuilder.invokeCapability({
    capabilityId: "act.ai.workspace.ocr_focus_type",
    taskId: "task-reviewed-1",
    params: { confirm: true },
  });
  assert.equal(assembly.length, 1);
  assert.equal(assembly[0].standingAdvisory, standingOwner);
  assert.equal(assembly[0].publishAuditEvent, requiredAudit);
  assert.equal(assembly[0].sessionManagerUrl, "http://127.0.0.1:4102");
  assert.equal(assembly[0].screenActUrl, "http://127.0.0.1:4105");
  assert.equal(typeof assembly[0].getTaskById, "function");
  assert.equal(typeof assembly[0].fetchJson, "function");
  assert.equal(typeof assembly[0].postJson, "function");
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invocation.summary.kind, "ai.workspace.ocr_focus_type");
  assert.equal(result.response.invocation.summary.actionCount, 2);
  assert.equal(result.response.invocation.summary.maximumActions, 2);
  assert.equal(result.response.invocation.summary.postActionVerified, true);
});
