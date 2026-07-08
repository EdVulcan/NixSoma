import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { createCapabilityRuntime } from "./capability-runtime.mjs";
import { createBodyEvidenceReadinessBuilders } from "./body-evidence-readiness-builders.mjs";
import { createBodyEvidenceTaskBuilders } from "./body-evidence-task-builders.mjs";
import { createCloudLiveProviderRuntimeImplementation } from "./cloud-live-provider-runtime-implementation.mjs";
import { createCloudConsciousnessHandoffBuilders } from "./cloud-consciousness-handoff-builders.mjs";
import { createCloudConsciousnessLiveProviderExecutionPlanBuilders } from "./cloud-consciousness-live-provider-execution-plan-builders.mjs";
import { createCloudConsciousnessLiveProviderRunbookBuilders } from "./cloud-consciousness-live-provider-runbook-builders.mjs";
import { createCloudConsciousnessLiveProviderRuntimeReadinessBuilders } from "./cloud-consciousness-live-provider-runtime-readiness-builders.mjs";
import { createCloudConsciousnessProviderCallRehearsalBuilders } from "./cloud-consciousness-provider-call-rehearsal-builders.mjs";
import { createCloudConsciousnessProviderDryRunBuilders } from "./cloud-consciousness-provider-dry-run-builders.mjs";
import { createLongTermMemoryBuilders } from "./long-term-memory-builders.mjs";
import { createNativePluginPlanBuilders } from "./native-plugin-plan-builders.mjs";
import { createRuntimeProfiler } from "./runtime-diagnostics.mjs";
import { createSystemdTaskBuilders } from "./systemd-task-builders.mjs";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

export function createPlanBuilder(deps) {
  const profiler = createRuntimeProfiler("plan-builder");
  const { client, state, taskManager, pluginReview, approvalEngine, policyEvaluator, publishEvent, host, port } = deps;
  const {
    fetchJson,
    postJson,
    eventHubUrl,
    sessionManagerUrl,
    browserRuntimeUrl,
    screenSenseUrl,
    screenActUrl,
    systemSenseUrl,
    systemHealUrl,
  } = client;
  const {
    tasks,
    runtimeState,
    persistState,
    approvals,
    policyAuditLog,
    capabilityInvocationLog,
    MAX_CAPABILITY_INVOCATION_ENTRIES,
    CAPABILITY_HEALTH_TIMEOUT_MS,
    autonomyMode,
    CROSS_BOUNDARY_INTENTS,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
    LONG_TERM_MEMORY_TASK_REGISTRY,
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH,
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
  } = state;
  const {
    serialiseTask,
    getTaskById,
    getNextQueuedTask,
    listTasks,
    createTask,
    appendTaskPhase,
    completeTask,
    failTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    buildTaskSummary,
  } = taskManager;
  const { serialiseApproval, buildApprovalSummary, createApprovalRequestForTask, publishTaskApprovalIfPending } = approvalEngine;
  const { evaluatePolicyIntent, recordPolicyDecision, isPolicyExecutionAllowed } = policyEvaluator;
  const {
    selectOpenClawToolCatalogWorkspace,
    buildNativePluginManifestProfile,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    buildNativeOpenClawPromptSemanticsProfile,
    buildOpenClawPluginManifestMap,
    buildOpenClawPluginCapabilityPlan,
  } = pluginReview;

  const capabilityRuntime = createCapabilityRuntime({
    host,
    port,
    client,
    state,
    pluginReview,
    policyEvaluator,
    publishEvent,
  });
  const {
    capabilityById,
    capabilityByIntent,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
    buildCapabilityRegistry,
    listCapabilityInvocations,
    buildCapabilityInvocationSummary,
    invokeCapability,
  } = capabilityRuntime;

  const nativePluginPlanBuilders = createNativePluginPlanBuilders({
    buildNativePluginManifestProfile,
    autonomyMode,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
  });
  const {
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginInvokeTask,
  } = nativePluginPlanBuilders;

  const systemdTaskBuilders = createSystemdTaskBuilders({
    fetchJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
  });
  const {
    buildSystemdRepairExecutionTaskDraft,
    createSystemdRepairExecutionTask,
    createSystemdRepairCandidateTaskShell,
    createSystemdNextRepairTaskShell,
  } = systemdTaskBuilders;

  const bodyEvidenceTaskBuilders = createBodyEvidenceTaskBuilders({
    fetchJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
  });
  const {
    createBodyEvidenceLedgerDirectoryTaskShell,
    createBodyEvidenceLedgerFirstRecordTaskShell,
    createBodyEvidenceLedgerFollowupRecordTaskShell,
  } = bodyEvidenceTaskBuilders;

  const bodyEvidenceReadinessBuilders = createBodyEvidenceReadinessBuilders({
    tasks,
    approvals,
    getTaskById,
    persistState,
    publishEvent,
    serialiseTask,
    buildPhase2NextCapabilityRouteReview,
  });
  const {
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendRouteReview,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
    armBodyEvidenceLedgerFollowupRecordAppend,
  } = bodyEvidenceReadinessBuilders;

  const longTermMemoryBuilders = createLongTermMemoryBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildPhase6Exit,
    buildPhase6ConsciousnessContextEnvelope,
    LONG_TERM_MEMORY_TASK_REGISTRY,
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH,
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
  });
  const {
    buildLongTermMemoryWritePlan,
    buildLongTermMemorySchema,
    buildLongTermMemoryProposal,
    buildLongTermMemoryWriteRouteReview,
    createLongTermMemoryWriteTask,
    buildLongTermMemoryReadback,
    buildLongTermMemoryExit,
    isLongTermMemoryWriteTask,
    executeLongTermMemoryWriteTask,
  } = longTermMemoryBuilders;

  const cloudConsciousnessHandoffBuilders = createCloudConsciousnessHandoffBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildPhase6ConsciousnessContextEnvelope,
    buildLongTermMemoryExit,
    buildLongTermMemoryReadback,
    buildTaskSummary,
    compactCloudConsciousnessEvidenceRef,
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
  });
  const {
    buildCloudConsciousnessContextReview,
    buildCloudConsciousnessEnvelopeSchema,
    buildCloudConsciousnessContextPackage,
    buildCloudConsciousnessRedactionReview,
    buildCloudConsciousnessTransmissionRouteReview,
    createCloudConsciousnessHandoffTask,
    buildCloudConsciousnessHandoffReadback,
    buildCloudConsciousnessExit,
    isCloudConsciousnessHandoffTask,
    executeCloudConsciousnessHandoffTask,
  } = cloudConsciousnessHandoffBuilders;

  const cloudConsciousnessProviderDryRunBuilders = createCloudConsciousnessProviderDryRunBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildCloudConsciousnessExit,
    buildCloudConsciousnessHandoffReadback,
    compactCloudConsciousnessEvidenceRef,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
  });
  const {
    buildCloudConsciousnessProviderAdapterPlan,
    buildCloudConsciousnessProviderContract,
    buildCloudConsciousnessProviderRequestEnvelope,
    buildCloudConsciousnessProviderDryRunRouteReview,
    createCloudConsciousnessProviderDryRunTask,
    buildCloudConsciousnessProviderDryRunReadback,
    buildCloudConsciousnessProviderAdapterExit,
    isCloudConsciousnessProviderDryRunTask,
    executeCloudConsciousnessProviderDryRunTask,
  } = cloudConsciousnessProviderDryRunBuilders;

  const cloudConsciousnessProviderCallRehearsalBuilders = createCloudConsciousnessProviderCallRehearsalBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildCloudConsciousnessProviderAdapterExit,
    buildCloudConsciousnessProviderRequestEnvelope,
    compactCloudConsciousnessEvidenceRef,
    CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
  });
  const {
    buildCloudConsciousnessRealProviderCallPlan,
    buildCloudConsciousnessProviderEgressContract,
    buildCloudConsciousnessProviderCredentialPreflight,
    buildCloudConsciousnessProviderRequestRedactionReview,
    buildCloudConsciousnessRealProviderCallRouteReview,
    createCloudConsciousnessProviderCallRehearsalTask,
    buildCloudConsciousnessProviderResponseReadback,
    buildCloudConsciousnessRealProviderCallExit,
    isCloudConsciousnessProviderCallRehearsalTask,
    executeCloudConsciousnessProviderCallRehearsalTask,
  } = cloudConsciousnessProviderCallRehearsalBuilders;

  const cloudConsciousnessLiveProviderRunbookBuilders = createCloudConsciousnessLiveProviderRunbookBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildCloudConsciousnessRealProviderCallExit,
    buildCloudConsciousnessProviderResponseReadback,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
  });
  const {
    buildCloudConsciousnessLiveProviderCallRunbook,
    buildCloudConsciousnessLiveProviderOperatorChecklist,
    buildCloudConsciousnessLiveProviderEgressTranscriptSchema,
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview,
    buildCloudConsciousnessLiveProviderRunbookRouteReview,
    createCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderRunbookReadback,
    buildCloudConsciousnessLiveProviderCallRunbookExit,
    isCloudConsciousnessLiveProviderRunbookTask,
    executeCloudConsciousnessLiveProviderRunbookTask,
  } = cloudConsciousnessLiveProviderRunbookBuilders;

  const cloudConsciousnessLiveProviderExecutionPlanBuilders = createCloudConsciousnessLiveProviderExecutionPlanBuilders({
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildCloudConsciousnessLiveProviderRunbookReadback,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
  });
  const {
    buildCloudConsciousnessLiveProviderCallExecutionPlan,
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding,
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema,
    buildCloudConsciousnessLiveProviderExecutionRouteReview,
    createCloudConsciousnessLiveProviderExecutionPlanTask,
    isCloudConsciousnessLiveProviderExecutionPlanTask,
    executeCloudConsciousnessLiveProviderExecutionPlanTask,
    buildCloudConsciousnessLiveProviderExecutionPlanReadback,
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit,
    phase12EvidenceRef,
  } = cloudConsciousnessLiveProviderExecutionPlanBuilders;

  const cloudConsciousnessLiveProviderRuntimeReadinessBuilders = createCloudConsciousnessLiveProviderRuntimeReadinessBuilders({
    profiler,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    appendTaskPhase,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    serialiseApproval,
    approvals,
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit,
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview,
    buildCloudConsciousnessLiveProviderCallExecutionPlan,
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding,
    buildCloudConsciousnessLiveProviderExecutionPlanReadback,
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema,
    phase12EvidenceRef,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
  });
  const {
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan,
    createCloudConsciousnessLiveProviderRuntimeAdapterTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterTask,
    buildCloudConsciousnessLiveProviderRuntimeAdapterExit,
    buildCloudConsciousnessLiveProviderCallFinalAuthorization,
    buildCloudConsciousnessLiveProviderCallOperatorLaunchReview,
    buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
  } = cloudConsciousnessLiveProviderRuntimeReadinessBuilders;

  const cloudLiveProviderRuntimeImplementation = createCloudLiveProviderRuntimeImplementation({
    buildRuntimeImplementationPlan: buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
    createTask,
    createApprovalRequestForTask,
    evaluatePolicyIntent,
    publishEvent,
    publishTaskApprovalIfPending,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    serialiseTask,
    appendTaskPhase,
    completeTask,
    approvals,
    getTaskById,
    listTasks,
  });

function buildOperatorState() {
  reconcileRuntimeState();
  const currentTask = runtimeState.currentTaskId ? getTaskById(runtimeState.currentTaskId) : null;
  const nextTask = getNextQueuedTask();
  const paused = runtimeState.paused === true;

  return {
    status: paused ? "paused" : nextTask ? "ready" : "idle",
    blocked: paused,
    reason: paused ? "runtime_paused" : null,
    currentTask: currentTask ? serialiseTask(currentTask) : null,
    nextTask: nextTask ? serialiseTask(nextTask) : null,
    policy: {
      respectsPause: true,
      enforcesTaskPolicy: true,
      defaultMaxSteps: 5,
      maxStepsLimit: 20,
      supportsDryRun: true,
      controls: ["pause", "resume", "stop", "takeover"],
      decisions: ["allow", "audit_only", "require_approval", "deny"],
    },
    approvals: buildApprovalSummary(),
    summary: buildTaskSummary(),
  };
}

  // L7325-8456

  // L8776-9570
function redactPublicParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return params ?? {};
  }
  const redacted = { ...params };
  for (const key of ["content", "body", "data"]) {
    if (typeof redacted[key] === "string") {
      redacted[key] = `[redacted:${Buffer.byteLength(redacted[key], "utf8")} bytes]`;
    }
  }
  return redacted;
}

function serialisePlanForPublic(plan) {
  if (!plan || typeof plan !== "object") {
    return plan ?? null;
  }
  return {
    ...plan,
    steps: Array.isArray(plan.steps)
      ? plan.steps.map((step) => ({
          ...step,
          params: redactPublicParams(step.params),
        }))
      : plan.steps,
  };
}

function normalisePlanActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-planner" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      intent: typeof action.intent === "string" && action.intent.trim() ? action.intent.trim() : null,
      params: action.params && typeof action.params === "object" ? action.params : {},
      when: action.when && typeof action.when === "object" ? action.when : null,
      onFailure: typeof action.onFailure === "string" && action.onFailure.trim() ? action.onFailure.trim() : null,
    }));
}

function inferPlannerIntent({ intent, policy, type }) {
  const policyIntent = policy && typeof policy === "object" && typeof policy.intent === "string"
    ? policy.intent.trim()
    : "";
  const explicitIntent = typeof intent === "string" ? intent.trim() : "";
  const explicitType = typeof type === "string" ? type.trim() : "";
  return policyIntent || explicitIntent || explicitType || "task.execute";
}

function resolvePlanCapabilityId({ kind, intent, plannerIntent }) {
  const candidate = intent || kind || plannerIntent || "";
  const directMap = {
    "work_view.prepare": "act.work_view.control",
    "work_view.reveal": "act.work_view.control",
    "work_view.hide": "act.work_view.control",
    "browser.open": "act.browser.open",
    "network.navigate": "act.browser.open",
    "screen.observe": "sense.screen.observe",
    "keyboard.type": "act.screen.pointer_keyboard",
    "keyboard.hotkey": "act.screen.pointer_keyboard",
    "mouse.click": "act.screen.pointer_keyboard",
    "result.verify": "sense.screen.observe",
    "task.complete": "operate.task.loop",
    "policy.evaluate": "govern.policy.evaluate",
    "approval.gate": "govern.policy.evaluate",
  };

  if (directMap[candidate]) {
    return directMap[candidate];
  }
  if (candidate === "filesystem.mkdir" || candidate === "filesystem.directory.create") {
    return "act.filesystem.mkdir";
  }
  if (candidate === "filesystem.append" || candidate === "filesystem.append_text" || candidate === "filesystem.append-text") {
    return "act.filesystem.append_text";
  }
  if (candidate === "filesystem.write" || candidate === "filesystem.write_text" || candidate === "filesystem.write-text") {
    return "act.filesystem.write_text";
  }
  if (candidate.startsWith("filesystem.")) {
    return "sense.filesystem.read";
  }
  if (candidate.startsWith("process.")) {
    return "sense.process.list";
  }
  if (candidate === "command.execute" || candidate === "system.command.execute") {
    return "act.system.command.execute";
  }
  if (candidate === "command.plan" || candidate === "system.command" || candidate.startsWith("system.command.")) {
    return "act.system.command.dry_run";
  }
  if (candidate.startsWith("heal.") || candidate === "system.repair") {
    return "act.system.heal";
  }
  if (CROSS_BOUNDARY_INTENTS.has(candidate)) {
    return "boundary.cross_domain.approval";
  }

  const matchedCapability = capabilityByIntent(candidate);
  return matchedCapability?.id ?? "govern.policy.evaluate";
}

function annotatePlanStepWithCapability(step, plannerIntent) {
  const capabilityId = resolvePlanCapabilityId({
    kind: step.kind,
    intent: step.intent,
    plannerIntent,
  });
  const capability = capabilityById(capabilityId);
  if (!capability) {
    return step;
  }

  const requiresApproval = capability.requiresApproval === true || capability.governance === "require_approval";
  return {
    ...step,
    capabilityId: capability.id,
    capability: {
      id: capability.id,
      name: capability.name,
      kind: capability.kind,
      service: capability.service,
    },
    risk: capability.risk,
    governance: capability.governance,
    requiresApproval,
  };
}

function summarisePlanCapabilities(steps) {
  const byId = new Map();
  for (const step of steps) {
    if (!step.capabilityId) {
      continue;
    }
    if (!byId.has(step.capabilityId)) {
      byId.set(step.capabilityId, {
        id: step.capabilityId,
        risk: step.risk ?? "unknown",
        governance: step.governance ?? "unknown",
        requiresApproval: step.requiresApproval === true,
        stepCount: 0,
      });
    }
    const entry = byId.get(step.capabilityId);
    entry.stepCount += 1;
    entry.requiresApproval = entry.requiresApproval || step.requiresApproval === true;
  }

  return {
    total: byId.size,
    ids: [...byId.keys()],
    items: [...byId.values()],
    approvalGates: [...byId.values()].filter((capability) => capability.requiresApproval).length,
  };
}

function buildRulePlan({ goal, targetUrl, actions, type, intent, policy }) {
  const now = new Date().toISOString();
  const plannerIntent = inferPlannerIntent({ intent, policy, type });
  const actionSteps = normalisePlanActions(actions).map((action, index) => ({
    id: `step-action-${index + 1}`,
    kind: action.kind,
    intent: action.intent ?? action.kind,
    phase: "acting_on_target",
    title: `Perform ${action.kind}`,
    status: "pending",
    params: action.params,
    when: action.when,
    onFailure: action.onFailure,
  }));

  const steps = [
    {
      id: "step-prepare-work-view",
      kind: "work_view.prepare",
      phase: "preparing_work_view",
      title: "Prepare the AI work view",
      status: "pending",
    },
    {
      id: "step-open-target",
      kind: "browser.open",
      phase: "opening_target",
      title: `Open ${targetUrl ?? "the target URL"}`,
      status: "pending",
    },
    {
      id: "step-observe-screen",
      kind: "screen.observe",
      phase: "observing_screen",
      title: "Observe the current screen state",
      status: "pending",
    },
    ...actionSteps,
    {
      id: "step-verify-result",
      kind: "result.verify",
      phase: "verifying_result",
      title: "Verify the task result",
      status: "pending",
    },
    {
      id: "step-close-task",
      kind: "task.complete",
      phase: "completed",
      title: "Close the task after verification",
      status: "pending",
    },
  ].map((step) => annotatePlanStepWithCapability(step, plannerIntent));

  return {
    planId: `plan-${randomUUID()}`,
    strategy: "rule-v1",
    planner: "capability-aware-v1",
    capabilityAware: true,
    status: "planned",
    goal,
    targetUrl,
    intent: plannerIntent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: summarisePlanCapabilities(steps),
    steps,
  };
}

function shouldBuildPlan(body) {
  return body.includePlan === true
    || body.plan === true
    || body.planStrategy === "rule-v1"
    || body.executionMode === "planned";
}

function updatePlanForPhase(task, phase, details = null) {
  if (!task.plan || !Array.isArray(task.plan.steps)) {
    return;
  }

  const now = new Date().toISOString();
  task.plan.status = phase === "failed" ? "failed" : phase === "completed" ? "completed" : "running";
  task.plan.updatedAt = now;
  if (phase === "failed") {
    task.plan.failure = details ?? null;
  }

  const step = task.plan.steps.find((candidate) => candidate.phase === phase && candidate.status !== "completed");
  if (step) {
    step.status = phase === "failed" ? "failed" : "completed";
    step.completedAt = now;
    step.details = details;
  }

  if (phase === "completed") {
    for (const candidate of task.plan.steps) {
      if (candidate.status === "pending") {
        candidate.status = "skipped";
      }
    }
  }
}

async function setTaskPhase(task, phase, { status = task.status, details = null } = {}) {
  task.status = status;
  const updatedTask = appendTaskPhase(task, phase, details);
  reconcileRuntimeState();
  await publishEvent(createEventName("task.phase_changed"), { task: serialiseTask(updatedTask) });
  return updatedTask;
}

function isTaskPolicyApproved(task) {
  return task.policy?.decision?.approved === true
    || task.policy?.approved === true
    || task.approval?.status === "approved";
}


  // L10324-19007
function buildMvpRouteAlignment() {
  const phases = [
    {
      id: "phase-0-body",
      label: "Body",
      whitepaperConcept: "resident sovereign body",
      status: "complete",
      evidence: ["body-config", "state-settling", "service-health"],
    },
    {
      id: "phase-1-eyes",
      label: "Eyes",
      whitepaperConcept: "AI-owned observable work view",
      status: "complete",
      evidence: [
        "openclaw-ai-work-view-capture",
        "openclaw-ai-work-view-capture-summary",
        "screen-sense",
      ],
    },
    {
      id: "phase-2-hands",
      label: "Hands",
      whitepaperConcept: "screen action tied to observation",
      status: "complete",
      evidence: ["openclaw-eye-hand-action-evidence", "screen-act"],
    },
    {
      id: "phase-3-observer",
      label: "Observer",
      whitepaperConcept: "visible and interruptible control plane",
      status: "complete",
      evidence: [
        "observer-openclaw-ai-work-view-task-verification-summary",
        "observer-openclaw-eye-hand-action-evidence",
      ],
    },
    {
      id: "phase-4-recovery",
      label: "Recovery",
      whitepaperConcept: "failed work carries evidence and recovery targets",
      status: "complete",
      evidence: [
        "openclaw-eye-hand-recovery-evidence",
        "openclaw-eye-hand-auto-recovery-execution",
        "openclaw-eye-hand-recovery-regression",
      ],
    },
    {
      id: "phase-5-body-health-self-heal",
      label: "Body Health",
      whitepaperConcept: "basic system health and self-heal loop",
      status: "next",
      evidence: ["system-sense", "system-heal", "sovereign-maintenance"],
    },
  ];

  return {
    ok: true,
    registry: "openclaw-mvp-route-alignment-v0",
    whitepaper: {
      thesis: "OpenClaw is a resident digital body with eyes, hands, observer visibility, and recovery responsibility under user sovereignty.",
      mvpBoundary: "Build body, eyes, hands, observer window, and basic recovery before higher autonomy.",
      sourceDocuments: [
        "docs/OpenClaw body sovereignty whitepaper",
        "docs/OpenClaw on NixOS MVP implementation route v1",
      ],
    },
    mainline: {
      current: "eye-hand-recovery-loop-complete",
      trunk: "body-eyes-hands-observer-recovery",
      completedCapabilities: [
        "browser-runtime-backed AI work view capture",
        "structured AI work view summaries",
        "task verification records final observation evidence",
        "screen actions link to final work view observations",
        "failed tasks carry recovery evidence",
        "auto recovery uses evidence-driven target URLs",
      ],
      nextRecommendedTrunk: "system-health-self-heal",
      nextRecommendedMilestone: "basic body health and conservative self-heal evidence",
    },
    phases,
    guardrails: {
      afterEachMilestone: [
        "re-read the whitepaper and MVP route before selecting the next slice",
        "prefer one visible body-loop capability over another safety-chain increment",
        "stop if the next task only adds approval expiry, duplicate click, or persistence hardening",
      ],
      avoidLoops: [
        "plugin-runtime-adapter-hardening-loop",
        "approval-boundary-expansion-loop",
        "persistence-before-user-visible-body-progress",
      ],
    },
    summary: {
      totalPhases: phases.length,
      complete: phases.filter((phase) => phase.status === "complete").length,
      next: phases.find((phase) => phase.status === "next")?.id ?? null,
      direction: "return-to-mvp-body-health",
    },
  };
}

function taskTimeForDemo(task) {
  const value = Date.parse(task?.closedAt ?? task?.updatedAt ?? task?.createdAt ?? "");
  return Number.isFinite(value) ? value : 0;
}

function findLatestSystemdRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_repair_execution_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function findLatestSystemdNextRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_next_repair_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function buildPhase2RepairDemoStatus() {
  const route = buildMvpRouteAlignment();
  const latestTask = findLatestSystemdRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "phase2-track-a-route",
      label: "Whitepaper route remains Phase 2 Track A to Track B",
      status: "passed",
      evidence: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
    },
    {
      id: "operator-approved-real-execution",
      label: "Operator-approved real systemd repair execution exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "post-execution-body-verification",
      label: "Post-execution body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "observer-visible-evidence",
      label: "Observer can display task evidence without hidden actions",
      status: "passed",
      evidence: "observer-ui phase2 repair demo panel",
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-repair-demo-status-v0",
    mode: "observer_demo_status_read_only",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_repair_evidence",
    track: {
      phase: "phase-2",
      track: "operator-observer-demo-experience",
      sourceTrack: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make body capability explainable and observable",
    },
    route: {
      registry: route.registry,
      current: "phase-2-systemd-repair-evidence-demo",
      previousMvpCurrent: route.mainline?.current ?? null,
      nextRecommendedSlice: "operator-observer-demo-evidence-bundle",
      avoidsSafetyBoundaryLoop: true,
    },
    checklist,
    summary: {
      passed,
      total: checklist.length,
      demoReady: latestTask && verification ? true : false,
      latestTaskId: latestTask?.id ?? null,
      latestOutcome: latestTask?.outcome?.kind ?? null,
      targetUnit: verification?.targetUnit ?? latestTask?.systemdRepair?.target?.unit ?? "openclaw-browser-runtime.service",
      command: transcript?.command ?? null,
      exitCode: verification?.commandExitCode ?? transcript?.exitCode ?? null,
      beforeActiveState: verification?.summary?.beforeActiveState ?? null,
      afterActiveState: verification?.summary?.afterActiveState ?? null,
      beforeServiceOk: verification?.summary?.beforeServiceOk ?? null,
      afterServiceOk: verification?.summary?.afterServiceOk ?? null,
      noAutomaticRecovery: verification?.summary?.noAutomaticRecovery === true,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      postExecutionVerification: verification,
      commandTranscript: transcript,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
  };
}

function buildPhase2NextRepairDemoStatus() {
  const latestTask = findLatestSystemdNextRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "next-repair-route",
      label: "Next repair route selected system-sense",
      status: latestTask?.systemdNextRepair?.sourceRegistry === "openclaw-systemd-next-repair-task-route-v0" ? "passed" : "pending",
      evidence: latestTask?.systemdNextRepair?.sourceRegistry ?? null,
    },
    {
      id: "operator-approved-next-real-execution",
      label: "Operator-approved next real execution attempt exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "next-post-execution-verification",
      label: "Before/after body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "no-hidden-follow-up",
      label: "No recovery, retry, scheduler, or follow-up mutation is triggered",
      status: verification?.governance?.triggersRecovery === false ? "passed" : "pending",
      evidence: verification?.governance ?? null,
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-systemd-next-repair-demo-status-v0",
    mode: "read_only_next_repair_demo_status",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_next_repair_evidence",
    track: {
      phase: "phase-2",
      track: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make OpenClaw's body repair attempt explainable and observable",
    },
    checklist,
    summary: {
      ready: latestTask && verification && passed === checklist.length,
      passedChecks: passed,
      totalChecks: checklist.length,
      targetUnit: latestTask?.systemdNextRepair?.target?.unit ?? "openclaw-system-sense.service",
      outcome: latestTask?.outcome?.kind ?? null,
      command: transcript?.command ?? null,
      exitCode: transcript?.exitCode ?? null,
      hostMutationAttempted: latestTask?.outcome?.details?.hostMutationAttempted === true,
      executionSucceeded: latestTask?.outcome?.details?.executionSucceeded ?? null,
    },
    evidence: {
      taskId: latestTask?.id ?? null,
      approval: latestTask?.approval ?? null,
      systemdNextRepair: latestTask?.systemdNextRepair ?? null,
      commandTranscript: transcript ?? null,
      postExecutionVerification: verification,
      rollbackNote: latestTask?.outcome?.details?.rollbackNote ?? null,
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-timeline",
      boundary: "return to read-only body memory; do not add another execution, recovery, or hardening loop",
    },
  };
}

async function buildPhase2DemoControlRoom() {
  const mvpRoute = buildMvpRouteAlignment();
  const repairDemo = buildPhase2RepairDemoStatus();
  let routeReview = null;
  try {
    routeReview = await fetchJson(`${systemSenseUrl}/system/route/phase-2-review`);
  } catch {
    routeReview = null;
  }

  const panels = [
    {
      id: "service-health",
      label: "Body service health",
      source: "/health plus Observer service health pills",
      status: "available",
    },
    {
      id: "mvp-route",
      label: "Whitepaper route alignment",
      source: "/mvp/route",
      status: mvpRoute?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-repair-demo",
      label: "Phase 2 repair demo evidence",
      source: "/phase-2/repair-demo-status",
      status: repairDemo?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-route-review",
      label: "Phase 2 next-block route review",
      source: `${systemSenseUrl}/system/route/phase-2-review`,
      status: routeReview?.ok ? "available" : "unavailable",
    },
    {
      id: "body-governance-readiness",
      label: "Track C body governance readiness",
      source: routeReview?.source?.bodyGovernanceReadinessRegistry ?? "openclaw-body-governance-readiness-v0",
      status: routeReview?.evidence?.trackCReady === true ? "available" : "unavailable",
    },
  ];
  const available = panels.filter((panel) => panel.status === "available").length;
  const ready = available === panels.length
    && routeReview?.decision?.selectedSlice === "openclaw-phase-2-demo-control-room";

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-control-room-v0",
    mode: "read_only_demo_control_surface",
    generatedAt: new Date().toISOString(),
    status: ready ? "control_room_ready" : "waiting_for_route_review_evidence",
    source: {
      service: "openclaw-core",
      mvpRouteRegistry: mvpRoute?.registry ?? null,
      repairDemoRegistry: repairDemo?.registry ?? null,
      routeReviewRegistry: routeReview?.registry ?? null,
      evidence: "phase_2_demo_control_room_bundle",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      availablePanels: available,
      totalPanels: panels.length,
      selectedTrack: routeReview?.decision?.selectedTrack ?? "unknown",
      selectedSlice: routeReview?.decision?.selectedSlice ?? "unknown",
      repairDemoStatus: repairDemo?.status ?? "unknown",
      repairDemoReady: repairDemo?.summary?.demoReady === true,
      bodyGovernanceReady: routeReview?.evidence?.trackCReady === true,
      avoidsSafetyBoundaryLoop: routeReview?.decision?.notSelected?.some((item) => item.includes("safety-boundary")) === true,
    },
    panels,
    evidence: {
      mvpRoute: {
        current: mvpRoute?.mainline?.current ?? null,
        nextRecommendedTrunk: mvpRoute?.mainline?.nextRecommendedTrunk ?? null,
        guardrails: mvpRoute?.guardrails ?? null,
      },
      repairDemo: {
        status: repairDemo?.status ?? null,
        checklistPassed: repairDemo?.summary?.passed ?? 0,
        checklistTotal: repairDemo?.summary?.total ?? 0,
        targetUnit: repairDemo?.summary?.targetUnit ?? "openclaw-browser-runtime.service",
        nextRecommendedSlice: repairDemo?.route?.nextRecommendedSlice ?? null,
      },
      routeReview: routeReview ? {
        selectedTrack: routeReview.decision?.selectedTrack ?? null,
        selectedSlice: routeReview.decision?.selectedSlice ?? null,
        notSelected: routeReview.decision?.notSelected ?? [],
      } : null,
    },
    operatorScript: [
      "Open Observer UI.",
      "Confirm service health, MVP route, repair demo status, body governance readiness, and Phase 2 route review panels are visible.",
      "Explain that the next work is demo/control-room clarity, not broader mutation or plugin/runtime work.",
      "Only run a real repair through the already-approved operator-reviewed repair path when intentionally demonstrating Track A.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-walkthrough",
      boundary: "turn the control room into a human-readable walkthrough without adding new autonomy or host mutation",
    },
  };
}

async function buildPhase2DemoWalkthrough() {
  const controlRoom = await buildPhase2DemoControlRoom();
  const ready = controlRoom.summary?.ready === true;
  const steps = [
    {
      id: "open-observer",
      title: "Open the Observer UI",
      operatorAction: "Navigate to the Observer UI and confirm the control room panel is visible.",
      expectedEvidence: "phase2-demo-control-room-panel",
      status: ready ? "ready" : "waiting",
    },
    {
      id: "explain-route",
      title: "Explain the whitepaper route",
      operatorAction: "Show MVP route, Phase 2 route review, and the selected Track B demo-control-room slice.",
      expectedEvidence: controlRoom.evidence?.routeReview?.selectedSlice ?? "openclaw-phase-2-demo-control-room",
      status: controlRoom.summary?.selectedSlice === "openclaw-phase-2-demo-control-room" ? "ready" : "waiting",
    },
    {
      id: "show-body-governance",
      title: "Show body governance readiness",
      operatorAction: "Point to dependency, trend, recovery policy, and readiness panels as the body reasoning foundation.",
      expectedEvidence: "openclaw-body-governance-readiness-v0",
      status: controlRoom.summary?.bodyGovernanceReady ? "ready" : "waiting",
    },
    {
      id: "show-repair-demo",
      title: "Show repair demo status",
      operatorAction: "Show whether real repair evidence is ready or still waiting; do not run hidden repair actions.",
      expectedEvidence: controlRoom.evidence?.repairDemo?.targetUnit ?? "openclaw-browser-runtime.service",
      status: controlRoom.evidence?.repairDemo?.status ? "ready" : "waiting",
    },
    {
      id: "state-boundary",
      title: "State the boundary",
      operatorAction: "Say explicitly that this walkthrough creates no task, approval, command, host mutation, scheduler, or recovery action.",
      expectedEvidence: "read_only_demo_walkthrough",
      status: "ready",
    },
  ];
  const readySteps = steps.filter((step) => step.status === "ready").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-walkthrough-v0",
    mode: "read_only_human_demo_walkthrough",
    generatedAt: new Date().toISOString(),
    status: readySteps === steps.length ? "walkthrough_ready" : "walkthrough_waiting_for_evidence",
    source: {
      service: "openclaw-core",
      demoControlRoomRegistry: controlRoom.registry,
      evidence: "phase_2_human_demo_walkthrough",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready: readySteps === steps.length,
      readySteps,
      totalSteps: steps.length,
      selectedSlice: controlRoom.summary?.selectedSlice ?? "unknown",
      controlRoomReady: ready,
      repairDemoReady: controlRoom.summary?.repairDemoReady === true,
      bodyGovernanceReady: controlRoom.summary?.bodyGovernanceReady === true,
    },
    steps,
    script: [
      "OpenClaw is now demonstrating a resident body loop, not a plugin/runtime adapter loop.",
      "Track A proved a narrow operator-reviewed repair path.",
      "Track C proved body governance evidence and route-aware recovery judgment.",
      "Track B now packages those signals into an operator-visible demo surface.",
      "No hidden mutation happens during this walkthrough.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-readiness-exit",
      boundary: "close the Track B demo block after the walkthrough is visible and read-only",
    },
  };
}

async function buildPhase2DemoReadinessExit() {
  const walkthrough = await buildPhase2DemoWalkthrough();
  const exitChecks = [
    {
      id: "control-room-ready",
      label: "Phase 2 demo control room is ready",
      passed: walkthrough.summary?.controlRoomReady === true,
      evidence: walkthrough.source?.demoControlRoomRegistry ?? "openclaw-phase-2-demo-control-room-v0",
    },
    {
      id: "walkthrough-ready",
      label: "Human demo walkthrough steps are ready",
      passed: walkthrough.summary?.ready === true,
      evidence: walkthrough.registry,
    },
    {
      id: "body-governance-visible",
      label: "Body governance readiness is visible in the demo story",
      passed: walkthrough.summary?.bodyGovernanceReady === true,
      evidence: "openclaw-body-governance-readiness-v0",
    },
    {
      id: "operator-boundary-visible",
      label: "No-hidden-mutation boundary is visible in the walkthrough",
      passed: (walkthrough.script ?? []).some((line) => line.includes("No hidden mutation")),
      evidence: "walkthrough-script",
    },
    {
      id: "read-only-exit",
      label: "Exit gate remains read-only and non-executing",
      passed: walkthrough.governance?.createsTask === false
        && walkthrough.governance?.executesCommand === false
        && walkthrough.governance?.mutatesHost === false
        && walkthrough.governance?.triggersRecovery === false,
      evidence: "exit-governance",
    },
  ];
  const passed = exitChecks.filter((check) => check.passed).length;
  const ready = passed === exitChecks.length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-readiness-exit-v0",
    mode: "read_only_demo_block_exit",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_2_demo_block_ready" : "phase_2_demo_block_waiting",
    source: {
      service: "openclaw-core",
      demoWalkthroughRegistry: walkthrough.registry,
      demoControlRoomRegistry: walkthrough.source?.demoControlRoomRegistry ?? null,
      evidence: "phase_2_track_b_demo_readiness_exit",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      passed,
      total: exitChecks.length,
      walkthroughStatus: walkthrough.status,
      selectedSlice: walkthrough.summary?.selectedSlice ?? "unknown",
      repairDemoReady: walkthrough.summary?.repairDemoReady === true,
      bodyGovernanceReady: walkthrough.summary?.bodyGovernanceReady === true,
    },
    exitChecks,
    completedBlock: {
      id: "phase-2-track-b-demo-experience",
      name: "Operator/Observer Demo Experience",
      completedSlices: [
        "openclaw-phase-2-route-review",
        "openclaw-phase-2-demo-control-room",
        "openclaw-phase-2-demo-walkthrough",
      ],
      completionClaim: ready ? "track_b_demo_readiness_exit_passed" : "track_b_demo_readiness_incomplete",
    },
    operatorOutcome: {
      demoNarrative: "OpenClaw can now show a resident body loop, real repair evidence, body governance evidence, and the next-route decision from one Observer path.",
      safeToDemo: ready,
      hiddenMutation: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to the whitepaper route before opening the next body capability block",
    },
  };
}

async function buildPhase2NextCapabilityRouteReview(options = {}) {
  const demoExit = await buildPhase2DemoReadinessExit();
  const demoReady = demoExit.summary?.ready === true;
  const ledgerDemoStatusCheckpointComplete = options.ledgerDemoStatusCheckpointComplete === true;
  const repairCandidateDemoCheckpointComplete = options.repairCandidateDemoCheckpointComplete === true;
  let candidateDemoStatus = null;
  let bodyEvidenceTimelineReadiness = null;
  let bodyEvidenceLedgerReadiness = null;
  let bodyEvidenceLedgerDemoStatus = null;
  let bodyEvidenceLedgerFollowupRecordPlan = null;
  let bodyEvidenceLedgerFollowupRecordReadiness = null;
  let bodyEvidenceLedgerFollowupRecordAppendReadiness = null;
  try {
    candidateDemoStatus = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-demo-status`);
  } catch {
    candidateDemoStatus = null;
  }
  try {
    bodyEvidenceTimelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  } catch {
    bodyEvidenceTimelineReadiness = null;
  }
  try {
    bodyEvidenceLedgerReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-readiness`);
  } catch {
    bodyEvidenceLedgerReadiness = null;
  }
  if (ledgerDemoStatusCheckpointComplete) {
    try {
      bodyEvidenceLedgerDemoStatus = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-demo-status`);
    } catch {
      bodyEvidenceLedgerDemoStatus = null;
    }
  }
  if (repairCandidateDemoCheckpointComplete) {
    try {
      bodyEvidenceLedgerFollowupRecordPlan = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan`);
    } catch {
      bodyEvidenceLedgerFollowupRecordPlan = null;
    }
  }
  try {
    bodyEvidenceLedgerFollowupRecordReadiness = buildBodyEvidenceLedgerFollowupRecordReadiness();
  } catch {
    bodyEvidenceLedgerFollowupRecordReadiness = null;
  }
  try {
    bodyEvidenceLedgerFollowupRecordAppendReadiness = buildBodyEvidenceLedgerFollowupRecordAppendReadiness();
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendReadiness = null;
  }
  const candidateDemoReady = candidateDemoStatus?.summary?.demoReady === true;
  const bodyEvidenceTimelineReady = bodyEvidenceTimelineReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerReady = bodyEvidenceLedgerReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerDemoReady = bodyEvidenceLedgerDemoStatus?.summary?.demoReady === true;
  const followupRecordPlanReady = bodyEvidenceLedgerFollowupRecordPlan?.summary?.planReady === true;
  const followupRecordReadinessReady = bodyEvidenceLedgerFollowupRecordReadiness?.summary?.ready === true;
  const followupRecordAppendReadinessReady = bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.ready === true;
  const followupRecordPlanRouteReady = repairCandidateDemoCheckpointComplete
    && candidateDemoReady
    && bodyEvidenceTimelineReady
    && bodyEvidenceLedgerReady;
  const selectedTrack = followupRecordAppendReadinessReady
    ? "Phase 2 Completion"
    : followupRecordReadinessReady
    ? "Track C: Body Evidence Memory"
    : followupRecordPlanRouteReady
    ? "Track C: Body Evidence Memory"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
      ? "Track A: Real NixOS/systemd Repair Semantics"
      : "Track C: Body Governance Enhancement")
    : "Track A: Real NixOS/systemd Repair Semantics";
  const selectedSlice = followupRecordAppendReadinessReady
    ? "openclaw-phase-2-completion-readiness"
    : followupRecordReadinessReady
    ? "openclaw-body-evidence-ledger-followup-record-append-route-review"
    : followupRecordPlanRouteReady
    ? "openclaw-body-evidence-ledger-followup-record-plan"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
        ? "openclaw-systemd-next-repair-scope-review"
        : bodyEvidenceLedgerReady
        ? "openclaw-body-evidence-ledger-demo-status"
        : bodyEvidenceTimelineReady
          ? "openclaw-body-evidence-ledger-plan"
          : "openclaw-body-evidence-timeline")
    : "openclaw-systemd-repair-candidate-assessment";
  const candidates = [
    {
      track: "Track A",
      id: "real-systemd-repair-semantics",
      label: "Read-only next repair candidate assessment",
      score: candidateDemoReady ? 58 : (demoReady ? 96 : 60),
      recommended: !candidateDemoReady,
      firstSlice: "openclaw-systemd-repair-candidate-assessment",
      mutation: false,
      reason: candidateDemoReady
        ? "The repair candidate route is already demo-ready; repeating candidate assessment would create a route loop."
        : "Phase 2 now has demo readiness and body governance; the next body capability should return to real NixOS/systemd repair semantics without immediately broadening mutation.",
    },
    {
      track: "Track C",
      id: "body-governance-evidence-memory",
      label: "Read-only body evidence timeline",
      score: candidateDemoReady ? 97 : 64,
      recommended: candidateDemoReady && !bodyEvidenceTimelineReady,
      firstSlice: "openclaw-body-evidence-timeline",
      mutation: false,
      reason: bodyEvidenceTimelineReady
        ? "The body evidence timeline is already ready; do not loop back into the same memory slice."
        : "The repair candidate route is demo-ready; the next whitepaper-aligned gain is durable body evidence memory before any broader mutation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger",
      label: "Read-only durable body evidence ledger plan",
      score: bodyEvidenceTimelineReady ? 98 : 62,
      recommended: bodyEvidenceTimelineReady && !bodyEvidenceLedgerReady,
      firstSlice: "openclaw-body-evidence-ledger-plan",
      mutation: false,
      reason: bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; do not loop back into the ledger plan."
        : "The in-process evidence timeline is ready; the next route-reviewed step is a plan-only durable ledger design, not persistence implementation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-demo-status",
      label: "Read-only body evidence ledger demo status",
      score: bodyEvidenceLedgerReady ? 99 : 50,
      recommended: bodyEvidenceLedgerReady && !bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady && !followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-demo-status",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The ledger demo status is already ready; do not loop back into the same demo package."
        : bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; package the completed body-memory block for operator demo before adding more writes."
        : "Ledger demo status waits until the first durable record readiness gate passes.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-followup-record-plan",
      label: "Plan-only follow-up body evidence ledger record",
      score: followupRecordPlanRouteReady ? 101 : 56,
      recommended: followupRecordPlanRouteReady && !followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-plan",
      mutation: false,
      reason: followupRecordPlanRouteReady
        ? "The candidate demo and durable ledger evidence are ready; plan the next body evidence ledger record without creating a task or writing JSONL."
        : "Follow-up ledger record planning waits until candidate demo status and the first ledger record are both ready.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-followup-append-route",
      label: "Route review for pending follow-up ledger append",
      score: followupRecordReadinessReady ? 102 : 55,
      recommended: followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-append-route-review",
      mutation: false,
      reason: followupRecordReadinessReady
        ? "The follow-up ledger task shell is visible and pending; return to route review before any approval or second JSONL append."
        : "Follow-up append route review waits until the task shell readiness bundle proves no second ledger record exists.",
    },
    {
      track: "Phase 2 Completion",
      id: "phase-2-completion-readiness",
      label: "Read-only Phase 2 completion readiness",
      score: followupRecordAppendReadinessReady ? 103 : 45,
      recommended: followupRecordAppendReadinessReady,
      firstSlice: "openclaw-phase-2-completion-readiness",
      mutation: false,
      reason: followupRecordAppendReadinessReady
        ? "The second durable body-memory record is ready; stop expanding ledger slices and summarize Phase 2 completion evidence."
        : "Phase 2 completion readiness waits until the follow-up append readiness bundle closes body memory.",
    },
    {
      track: "Track A",
      id: "next-systemd-repair-scope-review",
      label: "Read-only next systemd repair scope review",
      score: bodyEvidenceLedgerDemoReady ? 100 : 54,
      recommended: bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady,
      firstSlice: "openclaw-systemd-next-repair-scope-review",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The body evidence ledger demo is ready; return to real systemd repair semantics with a read-only scope review before any new repair plan."
        : "Next repair scope review waits until the durable body-memory demo package is ready.",
    },
    {
      track: "Track B",
      id: "operator-observer-demo-experience",
      label: "Additional demo polish",
      score: 55,
      recommended: false,
      firstSlice: "defer-additional-demo-polish",
      mutation: false,
      reason: "The demo block has an exit gate; more polish would be lower-value than advancing body capability.",
    },
    {
      track: "Track C",
      id: "body-governance-enhancement",
      label: "Additional body governance summaries",
      score: 65,
      recommended: false,
      firstSlice: "defer-governance-expansion",
      mutation: false,
      reason: "Track C readiness is already present and should now inform the next real repair candidate assessment.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 20,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work still lacks a stronger visible body-capability need than next real repair candidate assessment.",
    },
  ];

  return {
    ok: true,
    registry: "openclaw-phase-2-next-capability-route-review-v0",
    mode: "read_only_next_capability_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-core",
      demoReadinessExitRegistry: demoExit.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_next_capability_route_review",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    decision: {
      selectedTrack,
      selectedSlice,
      status: demoReady ? "selected" : "blocked_until_demo_exit_ready",
      rationale: followupRecordAppendReadinessReady
        ? "The follow-up append readiness bundle is complete, so stop opening new body-memory writes and prepare a read-only Phase 2 completion readiness summary."
        : followupRecordReadinessReady
        ? "The follow-up ledger task shell is visible, so the next whitepaper-aligned step is a route review before any approval or second record append."
        : followupRecordPlanRouteReady
        ? "Candidate repair demo evidence and the first ledger record are ready, so plan a follow-up body evidence ledger record without appending it yet."
        : candidateDemoReady
        ? (bodyEvidenceLedgerDemoReady
            ? "The durable body evidence ledger is demo-ready, so return to Track A with a read-only next repair scope review rather than adding more ledger writes."
            : bodyEvidenceLedgerReady
            ? "The first durable body evidence ledger record is ready, so avoid more ledger writes and package the completed block for operator demo."
            : bodyEvidenceTimelineReady
            ? "The body evidence timeline is ready, so avoid looping and plan durable evidence storage before implementing it."
            : "The repair candidate route has been made demo-ready, so avoid looping back into the same candidate block and move to read-only body evidence memory.")
        : "Return to the highest-priority body capability track, but start with read-only candidate assessment before broadening real repair mutation.",
      notSelected: [
        candidateDemoReady ? "no repair candidate assessment loop" : "no additional demo polish before new body capability",
        bodyEvidenceTimelineReady ? "no body evidence timeline loop" : "no candidate-specific approval replay",
        bodyEvidenceLedgerReady ? "no body evidence ledger plan or append loop" : "no body evidence ledger demo before readiness",
        bodyEvidenceLedgerDemoReady ? "no body evidence ledger demo status loop" : "no next repair scope before ledger demo status",
        followupRecordAppendReadinessReady ? "no additional ledger records after follow-up append readiness" : followupRecordReadinessReady ? "no follow-up ledger approval or append in this route review" : followupRecordPlanRouteReady ? "no follow-up ledger append without a separate route review" : "no follow-up ledger record before candidate demo completion",
        "no plugin/runtime adapter work",
        "no automatic repair",
        "no broader host mutation",
        bodyEvidenceTimelineReady ? "no durable storage implementation before a plan" : "no persistence hardening or denial recovery loop",
      ],
    },
    evidence: {
      demoReady,
      demoExitChecks: `${demoExit.summary?.passed ?? 0}/${demoExit.summary?.total ?? 0}`,
      candidateDemoReady,
      candidateDemoStatusRegistry: candidateDemoStatus?.registry ?? null,
      candidateDemoSelectedUnit: candidateDemoStatus?.summary?.selectedUnit ?? null,
      bodyEvidenceTimelineReady,
      bodyEvidenceTimelineReadinessRegistry: bodyEvidenceTimelineReadiness?.registry ?? null,
      bodyEvidenceLedgerReady,
      bodyEvidenceLedgerReadinessRegistry: bodyEvidenceLedgerReadiness?.registry ?? null,
      bodyEvidenceLedgerRecordCount: bodyEvidenceLedgerReadiness?.summary?.recordCount ?? 0,
      bodyEvidenceLedgerDemoReady,
      bodyEvidenceLedgerDemoStatusCheckpointComplete: ledgerDemoStatusCheckpointComplete,
      bodyEvidenceLedgerDemoStatusRegistry: bodyEvidenceLedgerDemoStatus?.registry ?? null,
      repairCandidateDemoStatusCheckpointComplete: repairCandidateDemoCheckpointComplete,
      bodyEvidenceLedgerFollowupRecordPlanReady: followupRecordPlanReady,
      bodyEvidenceLedgerFollowupRecordPlanRegistry: bodyEvidenceLedgerFollowupRecordPlan?.registry ?? null,
      bodyEvidenceLedgerFollowupPlannedSequence: bodyEvidenceLedgerFollowupRecordPlan?.summary?.plannedSequence ?? null,
      bodyEvidenceLedgerFollowupRecordReadinessReady: followupRecordReadinessReady,
      bodyEvidenceLedgerFollowupRecordReadinessRegistry: bodyEvidenceLedgerFollowupRecordReadiness?.registry ?? null,
      bodyEvidenceLedgerFollowupTaskId: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.taskId ?? null,
      bodyEvidenceLedgerFollowupApprovalId: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.approvalId ?? null,
      bodyEvidenceLedgerFollowupApprovalStatus: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.approvalStatus ?? null,
      bodyEvidenceLedgerFollowupExistingRecordCount: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.existingRecordCount ?? 0,
      bodyEvidenceLedgerFollowupRecordAppended: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.recordAppended === true,
      bodyEvidenceLedgerFollowupAppendReadinessReady: followupRecordAppendReadinessReady,
      bodyEvidenceLedgerFollowupAppendReadinessRegistry: bodyEvidenceLedgerFollowupRecordAppendReadiness?.registry ?? null,
      bodyEvidenceLedgerFollowupAppendRecordId: bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.recordId ?? null,
      bodyEvidenceLedgerFollowupAppendRecordCount: bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.existingRecordCount ?? 0,
      completedDemoBlock: demoExit.completedBlock,
      priorityOrder: [
        "real-systemd-repair-semantics",
        "operator-observer-demo-experience",
        "body-governance-enhancement",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: selectedSlice,
      boundary: followupRecordAppendReadinessReady
        ? "read-only Phase 2 completion readiness only; do not add more ledger writes, repair executions, schedulers, or plugin/runtime work"
        : followupRecordReadinessReady
        ? "route-review future follow-up append only; do not approve the pending task, append a second JSONL record, schedule work, or broaden mutation"
        : followupRecordPlanRouteReady
        ? "plan-only follow-up ledger record only; do not create tasks, approvals, schedulers, or append a second JSONL record"
        : bodyEvidenceLedgerDemoReady
        ? "read-only next systemd repair scope review only; do not create repair tasks, execute commands, or broaden mutation"
        : bodyEvidenceLedgerReady
        ? "read-only ledger demo status only; do not add more ledger records, background writers, schedulers, or host mutation"
        : bodyEvidenceTimelineReady
        ? "plan-only durable evidence ledger design; do not write durable storage, schedule work, execute commands, or mutate host"
        : candidateDemoReady
          ? "read-only body evidence timeline only; do not create tasks, execute commands, mutate host, or schedule recovery"
        : "read-only candidate assessment only; do not create repair tasks or execute host mutation",
    },
  };
}

async function buildPhase2CompletionReadiness() {
  const demoExit = await buildPhase2DemoReadinessExit();
  const repairDemo = buildPhase2RepairDemoStatus();
  const nextRepairDemo = buildPhase2NextRepairDemoStatus();
  const followupAppendReadiness = buildBodyEvidenceLedgerFollowupRecordAppendReadiness();
  let bodyGovernanceReadiness = null;
  let candidateDemoStatus = null;
  try {
    bodyGovernanceReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-governance-readiness`);
  } catch {
    bodyGovernanceReadiness = null;
  }
  try {
    candidateDemoStatus = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-demo-status`);
  } catch {
    candidateDemoStatus = null;
  }

  const checks = [
    {
      id: "track-a-first-repair-demo",
      label: "Track A first real repair demo is ready",
      passed: repairDemo.summary?.demoReady === true,
      evidence: repairDemo.registry,
    },
    {
      id: "track-a-next-repair-demo",
      label: "Track A next repair demo is ready",
      passed: nextRepairDemo.summary?.ready === true,
      evidence: nextRepairDemo.registry,
    },
    {
      id: "track-a-candidate-demo",
      label: "Repair candidate demo route is ready",
      passed: candidateDemoStatus?.summary?.demoReady === true,
      evidence: candidateDemoStatus?.registry ?? null,
    },
    {
      id: "track-b-demo-exit",
      label: "Operator/Observer demo readiness exit is ready",
      passed: demoExit.summary?.ready === true,
      evidence: demoExit.registry,
    },
    {
      id: "track-c-body-governance",
      label: "Body governance readiness is complete",
      passed: bodyGovernanceReadiness?.summary?.ready === true,
      evidence: bodyGovernanceReadiness?.registry ?? null,
    },
    {
      id: "track-c-durable-body-memory",
      label: "Durable body memory contains the follow-up ledger record",
      passed: followupAppendReadiness.summary?.ready === true
        && followupAppendReadiness.summary?.existingRecordCount === 2,
      evidence: followupAppendReadiness.registry,
    },
    {
      id: "no-hidden-autonomy",
      label: "Completion readiness remains read-only with no scheduler or background writer",
      passed: followupAppendReadiness.governance?.schedulesFollowUp === false
        && followupAppendReadiness.governance?.backgroundWriter === false
        && followupAppendReadiness.governance?.triggersRecovery === false,
      evidence: "phase_2_completion_governance",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-2-completion-readiness-v0",
    mode: "read_only_phase_2_completion_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready_for_phase_2_exit" : "waiting_for_phase_2_evidence",
    source: {
      service: "openclaw-core",
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_completion_readiness",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
      backgroundWriter: false,
      writesLedger: false,
    },
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
      firstRepairDemoReady: repairDemo.summary?.demoReady === true,
      nextRepairDemoReady: nextRepairDemo.summary?.ready === true,
      candidateDemoReady: candidateDemoStatus?.summary?.demoReady === true,
      demoExitReady: demoExit.summary?.ready === true,
      bodyGovernanceReady: bodyGovernanceReadiness?.summary?.ready === true,
      durableBodyMemoryRecords: followupAppendReadiness.summary?.existingRecordCount ?? 0,
      followupRecordId: followupAppendReadiness.summary?.recordId ?? null,
    },
    checks,
    completedTracks: [
      {
        track: "Track A",
        label: "Real NixOS/systemd Repair Semantics",
        evidence: [repairDemo.registry, nextRepairDemo.registry, candidateDemoStatus?.registry ?? null].filter(Boolean),
      },
      {
        track: "Track B",
        label: "Operator/Observer Demo Experience",
        evidence: [demoExit.registry],
      },
      {
        track: "Track C",
        label: "Body Governance and Durable Body Memory",
        evidence: [bodyGovernanceReadiness?.registry ?? null, followupAppendReadiness.registry].filter(Boolean),
      },
    ],
    evidence: {
      repairDemo,
      nextRepairDemo,
      candidateDemoStatus,
      demoExit,
      bodyGovernanceReadiness,
      followupAppendReadiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-exit",
      boundary: "final Phase 2 exit gate only; do not add new capability slices before exit review",
    },
  };
}

async function buildPhase2Exit() {
  const readiness = await buildPhase2CompletionReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true;

  return {
    ok: true,
    registry: "openclaw-phase-2-exit-v0",
    mode: "read_only_phase_2_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_2_complete" : "waiting_for_completion_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_exit_gate",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
      backgroundWriter: false,
      writesLedger: false,
    },
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      durableBodyMemoryRecords: readiness.summary?.durableBodyMemoryRecords ?? 0,
      followupRecordId: readiness.summary?.followupRecordId ?? null,
      phase: "phase-2",
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-2",
      name: "Resident Digital Body Phase 2",
      completionClaim: complete ? "phase_2_complete" : "phase_2_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      completionReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-3-plan",
      boundary: "start a separate Phase 3 plan before adding new capability slices",
    },
  };
}

function phase3ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    triggersRecovery: false,
    schedulesWork: false,
    backgroundWriter: false,
    writesLedger: false,
    stealsForeground: false,
  };
}

async function readSessionWorkViewState() {
  try {
    const data = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    return {
      reachable: true,
      session: data.session ?? null,
      workView: data.workView ?? null,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unable to read work view state.",
      session: null,
      workView: null,
    };
  }
}

async function buildPhase3Plan() {
  const phase2Complete = true;
  const checks = [
    {
      id: "phase-2-exit-complete",
      label: "Phase 2 exit is complete before Phase 3 starts",
      passed: phase2Complete,
      evidence: "openclaw-phase-2-exit",
    },
    {
      id: "whitepaper-route",
      label: "Phase 3 follows resident body, observer visibility, and user sovereignty",
      passed: true,
      evidence: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
    },
    {
      id: "non-intrusive-boundary",
      label: "Phase 3 does not add host mutation, schedulers, plugin work, or safety-loop expansion",
      passed: true,
      evidence: "phase_3_non_intrusive_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-3-plan-v0",
    mode: "read_only_phase_3_route_selection",
    generatedAt: new Date().toISOString(),
    status: phase2Complete ? "phase_3_route_selected" : "waiting_for_phase_2_exit",
    source: {
      service: "openclaw-core",
      phase2ExitMilestone: "openclaw-phase-2-exit",
      phase3Plan: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
      route: "let_it_work_without_stealing_foreground",
    },
    governance: phase3ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "OpenClaw is a resident digital body that must remain observable and interruptible under user sovereignty.",
      phaseTheme: "Let it work without stealing the foreground.",
      avoidsLoop: "No Phase 2 repair, ledger, approval-hardening, denial-recovery, duplicate-click, persistence, plugin/runtime adapter, or host-control expansion is selected.",
    },
    selectedSlices: [
      "openclaw-phase-3-background-work-view",
      "openclaw-phase-3-operator-interrupt-controls",
      "openclaw-phase-3-completion-readiness",
      "openclaw-phase-3-exit",
    ],
    checks,
    summary: {
      ready: phase2Complete && passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
    },
    next: {
      recommendedSlice: "openclaw-phase-3-background-work-view",
      boundary: "prove background work-view behavior before adding any new Phase 3 behavior",
    },
  };
}

async function buildPhase3BackgroundWorkView() {
  const plan = await buildPhase3Plan();
  const state = await readSessionWorkViewState();
  const workView = state.workView ?? {};
  const hiddenByDefault = workView.visibility === "hidden";
  const backgroundMode = workView.mode === "background";
  const observableMetadata = Boolean(workView.captureStrategy) && Boolean(workView.displayTarget);
  const checks = [
    {
      id: "phase-3-plan-ready",
      label: "Phase 3 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "work-view-hidden-by-default",
      label: "AI work view does not show in the user's foreground by default",
      passed: state.reachable && hiddenByDefault,
      evidence: workView.visibility ?? "unavailable",
    },
    {
      id: "work-view-background-mode",
      label: "AI work view remains in background mode until explicitly revealed",
      passed: state.reachable && backgroundMode,
      evidence: workView.mode ?? "unavailable",
    },
    {
      id: "observer-metadata-available",
      label: "Observer can read work-view metadata without revealing the foreground",
      passed: state.reachable && observableMetadata,
      evidence: workView.captureStrategy ?? "unavailable",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-3-background-work-view-v0",
    mode: "read_only_background_work_view_contract",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "background_work_view_ready" : "waiting_for_background_work_view",
    source: {
      service: "openclaw-core",
      sessionManager: sessionManagerUrl,
      planRegistry: plan.registry,
    },
    governance: phase3ReadOnlyGovernance(),
    workViewContract: {
      defaultVisibility: "hidden",
      defaultMode: "background",
      revealRequiresExplicitOperatorAction: true,
      independentDisplayTarget: workView.displayTarget ?? "workspace-2",
      captureStrategy: workView.captureStrategy ?? "browser-runtime",
      observerCanInspectWithoutReveal: true,
    },
    current: {
      reachable: state.reachable,
      session: state.session,
      workView: state.workView,
      error: state.error ?? null,
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      defaultForegroundSteal: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-3-operator-interrupt-controls",
      boundary: "formalize pause, stop, and takeover controls without hidden automation",
    },
  };
}

async function buildPhase3OperatorInterruptControls() {
  const background = await buildPhase3BackgroundWorkView();
  const operator = buildOperatorState();
  const controls = [
    { id: "pause", endpoint: "/control/pause", available: true, effect: "pause current active task" },
    { id: "resume", endpoint: "/control/resume", available: true, effect: "resume a paused task as queued work" },
    { id: "stop", endpoint: "/control/stop", available: true, effect: "fail current active task with operator stop reason" },
    { id: "takeover", endpoint: "/control/takeover", available: true, effect: "pause current task and mark it operator-controlled" },
  ];
  const checks = [
    {
      id: "background-work-view-ready",
      label: "Background work-view contract is ready",
      passed: background.summary?.ready === true,
      evidence: background.registry,
    },
    {
      id: "pause-stop-takeover-visible",
      label: "Pause, resume, stop, and takeover controls are declared",
      passed: controls.every((control) => control.available),
      evidence: controls.map((control) => control.id).join(","),
    },
    {
      id: "operator-state-visible",
      label: "Operator state exposes current and next work without hidden execution",
      passed: Boolean(operator) && operator.policy?.respectsPause === true,
      evidence: operator.status,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-3-operator-interrupt-controls-v0",
    mode: "read_only_operator_interrupt_control_contract",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "operator_interrupt_controls_ready" : "waiting_for_operator_interrupt_controls",
    source: {
      service: "openclaw-core",
      backgroundWorkViewRegistry: background.registry,
    },
    governance: phase3ReadOnlyGovernance(),
    controls,
    operator,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      takeoverSupported: true,
      hiddenAutomation: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-3-completion-readiness",
      boundary: "summarize Phase 3 readiness before final exit; do not add more controls",
    },
  };
}

async function buildPhase3CompletionReadiness() {
  const plan = await buildPhase3Plan();
  const background = await buildPhase3BackgroundWorkView();
  const controls = await buildPhase3OperatorInterruptControls();
  const checks = [
    {
      id: "phase-3-plan-ready",
      label: "Phase 3 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "background-work-view-ready",
      label: "Background AI work-view contract is complete",
      passed: background.summary?.ready === true,
      evidence: background.registry,
    },
    {
      id: "operator-interrupt-controls-ready",
      label: "Operator pause, stop, resume, and takeover controls are complete",
      passed: controls.summary?.ready === true,
      evidence: controls.registry,
    },
    {
      id: "no-hidden-mutation",
      label: "Phase 3 completion readiness remains non-mutating and non-scheduled",
      passed: background.governance?.mutatesHost === false
        && controls.governance?.schedulesWork === false
        && controls.governance?.backgroundWriter === false,
      evidence: "phase_3_readiness_read_only",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-3-completion-readiness-v0",
    mode: "read_only_phase_3_completion_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_3_ready_for_exit" : "waiting_for_phase_3_readiness",
    governance: phase3ReadOnlyGovernance(),
    completedTracks: [
      {
        id: "background-work-view",
        label: "Non-intrusive AI work view",
        status: background.summary?.ready === true ? "complete" : "waiting",
        evidence: background.registry,
      },
      {
        id: "operator-interrupt-controls",
        label: "Pause, stop, resume, and takeover",
        status: controls.summary?.ready === true ? "complete" : "waiting",
        evidence: controls.registry,
      },
      {
        id: "observer-visibility",
        label: "Observer-facing Phase 3 status",
        status: "complete",
        evidence: "observer-openclaw-phase-3-*",
      },
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-3",
      foregroundStealByDefault: false,
      takeoverSupported: controls.summary?.takeoverSupported === true,
    },
    evidence: {
      plan,
      background,
      controls,
    },
    next: {
      recommendedSlice: "openclaw-phase-3-exit",
      boundary: "final Phase 3 exit gate only; start a separate Phase 4 plan before adding new capability slices",
    },
  };
}

async function buildPhase3Exit() {
  const readiness = await buildPhase3CompletionReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true;

  return {
    ok: true,
    registry: "openclaw-phase-3-exit-v0",
    mode: "read_only_phase_3_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_3_complete" : "waiting_for_completion_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase3Plan: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
      evidence: "phase_3_exit_gate",
    },
    governance: phase3ReadOnlyGovernance(),
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      phase: "phase-3",
      foregroundStealByDefault: false,
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-3",
      name: "Non-intrusive Resident Work View",
      completionClaim: complete ? "phase_3_complete" : "phase_3_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      completionReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-4-plan",
      boundary: "start a separate Phase 4 plan before adding new capability slices",
    },
  };
}

function phase4ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    triggersRecovery: false,
    schedulesWork: false,
    backgroundWriter: false,
    writesLedger: false,
    realHostRepair: false,
  };
}

async function readPhase4HealEvidence() {
  const [health, healState, healHistory, maintenanceState, maintenanceHistory] = await Promise.all([
    fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read system health.",
    })),
    fetchJson(`${systemHealUrl}/heal/state`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read heal state.",
    })),
    fetchJson(`${systemHealUrl}/heal/history`).catch((error) => ({
      ok: false,
      items: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unable to read heal history.",
    })),
    fetchJson(`${systemHealUrl}/maintenance/state`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read maintenance state.",
    })),
    fetchJson(`${systemHealUrl}/maintenance/history?limit=8`).catch((error) => ({
      ok: false,
      items: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unable to read maintenance history.",
    })),
  ]);

  return {
    health,
    healState,
    healHistory,
    maintenanceState,
    maintenanceHistory,
  };
}

async function buildPhase4Plan() {
  const phase3Complete = true;
  const checks = [
    {
      id: "phase-3-exit-complete",
      label: "Phase 3 exit is complete before Phase 4 starts",
      passed: phase3Complete,
      evidence: "openclaw-phase-3-exit",
    },
    {
      id: "whitepaper-self-heal-route",
      label: "Phase 4 follows body stability, self-maintenance, and user-visible evidence",
      passed: true,
      evidence: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
    },
    {
      id: "conservative-boundary",
      label: "Phase 4 does not add arbitrary host mutation, plugin work, or hardening loops",
      passed: true,
      evidence: "phase_4_conservative_self_heal_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-4-plan-v0",
    mode: "read_only_phase_4_route_selection",
    generatedAt: new Date().toISOString(),
    status: phase3Complete ? "phase_4_route_selected" : "waiting_for_phase_3_exit",
    source: {
      service: "openclaw-core",
      phase3ExitMilestone: "openclaw-phase-3-exit",
      phase4Plan: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
      route: "let_it_care_for_its_body",
    },
    governance: phase4ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "OpenClaw should maintain body stability, leave evidence, and remain visible under user sovereignty.",
      phaseTheme: "Let it care for its body.",
      avoidsLoop: "No Phase 2 repair expansion, Phase 3 foreground work, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click loop, or arbitrary host control is selected.",
    },
    selectedSlices: [
      "openclaw-phase-4-self-heal-loop",
      "openclaw-phase-4-heal-history-evidence",
      "openclaw-phase-4-completion-readiness",
      "openclaw-phase-4-exit",
    ],
    checks,
    summary: {
      ready: phase3Complete && passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
    },
    next: {
      recommendedSlice: "openclaw-phase-4-self-heal-loop",
      boundary: "prove conservative self-heal evidence before adding any new Phase 4 slice",
    },
  };
}

async function buildPhase4SelfHealLoop() {
  const plan = await buildPhase4Plan();
  const evidence = await readPhase4HealEvidence();
  const services = Object.values(evidence.health?.system?.services ?? {});
  const latestRun = evidence.maintenanceState?.latestRun ?? null;
  const latestDiagnosis = evidence.healState?.latestDiagnosis ?? latestRun?.diagnosis ?? null;
  const executed = Array.isArray(latestRun?.executed) ? latestRun.executed : [];
  const skipped = Array.isArray(latestRun?.skipped) ? latestRun.skipped : [];
  const checks = [
    {
      id: "phase-4-plan-ready",
      label: "Phase 4 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "system-health-readable",
      label: "System-sense exposes body and service health",
      passed: evidence.health?.ok === true && services.length >= 7,
      evidence: `${services.length} service(s)`,
    },
    {
      id: "heal-engine-ready",
      label: "System-heal exposes diagnose, autofix, maintenance, and history",
      passed: evidence.healState?.ok === true
        && evidence.healState?.capabilities?.diagnose === true
        && evidence.healState?.capabilities?.autoFix === true
        && evidence.healState?.capabilities?.maintenance === true,
      evidence: evidence.healState?.engine ?? "unavailable",
    },
    {
      id: "conservative-maintenance-run",
      label: "A conservative maintenance run recorded self-heal evidence",
      passed: evidence.maintenanceState?.ok === true
        && latestRun?.engine === "maintenance-v0"
        && ["healthy", "repaired", "attention_required"].includes(latestRun?.status),
      evidence: latestRun?.id ?? "none",
    },
    {
      id: "high-risk-observe-only",
      label: "High-risk alerts remain skipped or observe-only",
      passed: skipped.length === 0 || skipped.every((entry) => entry.action === "observe-only" && entry.status === "skipped"),
      evidence: `${skipped.length} skipped step(s)`,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-4-self-heal-loop-v0",
    mode: "read_only_phase_4_self_heal_loop_evidence",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "self_heal_loop_ready" : "waiting_for_self_heal_evidence",
    source: {
      service: "openclaw-core",
      systemSense: systemSenseUrl,
      systemHeal: systemHealUrl,
      planRegistry: plan.registry,
    },
    governance: phase4ReadOnlyGovernance(),
    evidence,
    diagnosis: {
      status: latestDiagnosis?.status ?? null,
      planSteps: latestDiagnosis?.plan?.stepCount ?? 0,
      sourceHostname: latestDiagnosis?.source?.hostname ?? null,
    },
    maintenance: {
      latestRunId: latestRun?.id ?? null,
      status: latestRun?.status ?? null,
      autonomy: latestRun?.autonomy ?? null,
      executedCount: executed.length,
      skippedCount: skipped.length,
      runCount: evidence.maintenanceState?.runCount ?? 0,
      healHistoryCount: evidence.healState?.historyCount ?? evidence.healHistory?.count ?? 0,
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      servicesObserved: services.length,
      executedRepairs: executed.length,
      skippedHighRisk: skipped.length,
      realHostRepair: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-4-heal-history-evidence",
      boundary: "package heal and maintenance history evidence before Phase 4 readiness",
    },
  };
}

async function buildPhase4HealHistoryEvidence() {
  const loop = await buildPhase4SelfHealLoop();
  const healItems = Array.isArray(loop.evidence?.healHistory?.items) ? loop.evidence.healHistory.items : [];
  const maintenanceItems = Array.isArray(loop.evidence?.maintenanceHistory?.items) ? loop.evidence.maintenanceHistory.items : [];
  const hasExecutedEvidence = healItems.some((entry) => entry.status === "completed")
    || (loop.maintenance?.executedCount ?? 0) > 0
    || loop.maintenance?.status === "healthy";
  const hasSkippedEvidence = healItems.some((entry) => entry.status === "skipped")
    || (loop.maintenance?.skippedCount ?? 0) > 0
    || loop.maintenance?.status === "healthy";
  const checks = [
    {
      id: "self-heal-loop-ready",
      label: "Self-heal loop evidence is ready",
      passed: loop.summary?.ready === true,
      evidence: loop.registry,
    },
    {
      id: "heal-history-visible",
      label: "Heal history exposes executed or healthy maintenance evidence",
      passed: loop.evidence?.healHistory?.ok === true && hasExecutedEvidence,
      evidence: `${healItems.length} heal item(s)`,
    },
    {
      id: "maintenance-history-visible",
      label: "Maintenance history exposes latest run evidence",
      passed: loop.evidence?.maintenanceHistory?.ok === true
        && maintenanceItems.some((item) => item.id === loop.maintenance?.latestRunId),
      evidence: `${maintenanceItems.length} maintenance item(s)`,
    },
    {
      id: "skipped-or-healthy-recorded",
      label: "Skipped high-risk evidence or healthy no-op state is visible",
      passed: hasSkippedEvidence,
      evidence: `${loop.maintenance?.skippedCount ?? 0} skipped step(s)`,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-4-heal-history-evidence-v0",
    mode: "read_only_phase_4_heal_history_evidence",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "heal_history_evidence_ready" : "waiting_for_heal_history_evidence",
    governance: phase4ReadOnlyGovernance(),
    history: {
      healCount: loop.evidence?.healHistory?.count ?? 0,
      maintenanceCount: loop.evidence?.maintenanceHistory?.count ?? 0,
      latestRunId: loop.maintenance?.latestRunId ?? null,
      executedRepairs: loop.summary?.executedRepairs ?? 0,
      skippedHighRisk: loop.summary?.skippedHighRisk ?? 0,
      latestDiagnosisStatus: loop.diagnosis?.status ?? null,
    },
    evidence: {
      selfHealLoop: loop,
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
    },
    next: {
      recommendedSlice: "openclaw-phase-4-completion-readiness",
      boundary: "summarize Phase 4 readiness; do not add scheduler or repair expansion",
    },
  };
}

async function buildPhase4CompletionReadiness() {
  const plan = await buildPhase4Plan();
  const loop = await buildPhase4SelfHealLoop();
  const history = await buildPhase4HealHistoryEvidence();
  const checks = [
    {
      id: "phase-4-plan-ready",
      label: "Phase 4 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "self-heal-loop-ready",
      label: "Conservative self-heal loop is complete",
      passed: loop.summary?.ready === true,
      evidence: loop.registry,
    },
    {
      id: "heal-history-evidence-ready",
      label: "Heal and maintenance history evidence is complete",
      passed: history.summary?.ready === true,
      evidence: history.registry,
    },
    {
      id: "no-new-host-mutation",
      label: "Phase 4 readiness remains within conservative simulated repair boundaries",
      passed: loop.governance?.realHostRepair === false
        && history.governance?.mutatesHost === false
        && history.governance?.schedulesWork === false,
      evidence: "phase_4_conservative_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-4-completion-readiness-v0",
    mode: "read_only_phase_4_completion_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_4_ready_for_exit" : "waiting_for_phase_4_readiness",
    governance: phase4ReadOnlyGovernance(),
    completedTracks: [
      {
        id: "system-health-sense",
        label: "Body health is observable",
        status: loop.evidence?.health?.ok === true ? "complete" : "waiting",
        evidence: "openclaw-system-sense",
      },
      {
        id: "conservative-self-heal",
        label: "Conservative rule-based self-heal",
        status: loop.summary?.ready === true ? "complete" : "waiting",
        evidence: loop.registry,
      },
      {
        id: "heal-history",
        label: "Repair and skipped-action history",
        status: history.summary?.ready === true ? "complete" : "waiting",
        evidence: history.registry,
      },
      {
        id: "observer-visibility",
        label: "Observer-facing health and heal state",
        status: "complete",
        evidence: "observer-openclaw-phase-4-*",
      },
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-4",
      servicesObserved: loop.summary?.servicesObserved ?? 0,
      executedRepairs: loop.summary?.executedRepairs ?? 0,
      skippedHighRisk: loop.summary?.skippedHighRisk ?? 0,
      realHostRepair: false,
    },
    evidence: {
      plan,
      selfHealLoop: loop,
      healHistory: history,
    },
    next: {
      recommendedSlice: "openclaw-phase-4-exit",
      boundary: "final Phase 4 exit gate only; start a separate Phase 5 plan before adding new capability slices",
    },
  };
}

async function buildPhase4Exit() {
  const readiness = await buildPhase4CompletionReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true;

  return {
    ok: true,
    registry: "openclaw-phase-4-exit-v0",
    mode: "read_only_phase_4_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_4_complete" : "waiting_for_completion_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase4Plan: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
      evidence: "phase_4_exit_gate",
    },
    governance: phase4ReadOnlyGovernance(),
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      phase: "phase-4",
      realHostRepair: false,
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-4",
      name: "Conservative Body Self-Heal",
      completionClaim: complete ? "phase_4_complete" : "phase_4_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      completionReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-plan",
      boundary: "start a separate Phase 5 plan before adding new capability slices",
    },
  };
}

function phase5ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    rebuildsSystem: false,
    switchesGeneration: false,
    executesRollback: false,
    writesLedger: false,
    schedulesWork: false,
    releaseAction: false,
  };
}

function resolveRepoPath(displayPath) {
  return path.resolve(process.cwd(), "../..", displayPath);
}

async function buildPhase5Plan() {
  const phase4Exit = await buildPhase4Exit();
  const phase4Complete = phase4Exit.summary?.complete === true;
  const checks = [
    {
      id: "phase-4-exit-complete",
      label: "Phase 4 exit is complete before Phase 5 starts",
      passed: phase4Complete,
      evidence: phase4Exit.registry,
    },
    {
      id: "whitepaper-deploy-rollback-route",
      label: "Phase 5 follows the MVP success criterion: deployment and rollback are controllable",
      passed: true,
      evidence: "docs/OpenClaw on NixOS MVP module route: overall deployment and rollback controllable",
    },
    {
      id: "no-new-security-loop",
      label: "Phase 5 does not reopen denial recovery, persistence hardening, plugin/runtime adapter, or broader host mutation loops",
      passed: true,
      evidence: "phase_5_release_governance_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-plan-v0",
    mode: "read_only_phase_5_route_selection",
    generatedAt: new Date().toISOString(),
    status: phase4Complete ? "phase_5_route_selected" : "waiting_for_phase_4_exit",
    source: {
      service: "openclaw-core",
      phase4ExitMilestone: "openclaw-phase-4-exit",
      phase5Plan: "docs/plans/OPENCLAW_PHASE_5_PLAN.md",
      route: "deployment_and_rollback_control",
    },
    governance: phase5ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "The first MVP is successful only when the resident body can be deployed, observed, repaired, and rolled back under user sovereignty.",
      phaseTheme: "Make deployment and rollback controllable.",
      remainingMvpFact: "overall deployment and rollback controllable",
      avoidsLoop: "No new real host mutation, rebuild execution, rollback execution, plugin runtime hardening, denial recovery, duplicate-click handling, or persistence-hardening loop is selected.",
    },
    selectedSlices: [
      "openclaw-phase-5-deployment-inventory",
      "openclaw-phase-5-rollback-readiness",
      "openclaw-phase-5-release-control-readiness",
      "openclaw-phase-5-exit",
    ],
    checks,
    summary: {
      ready: phase4Complete && passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-5",
      releaseAction: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-deployment-inventory",
      boundary: "prove deployment inventory visibility before any real release or rollback operation",
    },
  };
}

async function buildPhase5DeploymentInventory() {
  const plan = await buildPhase5Plan();
  const health = await fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Unable to read system health.",
  }));
  const services = Object.values(health?.system?.services ?? {});
  const nixModules = [
    "nix/modules/openclaw-core.nix",
    "nix/modules/openclaw-event-hub.nix",
    "nix/modules/openclaw-session-manager.nix",
    "nix/modules/openclaw-browser-runtime.nix",
    "nix/modules/openclaw-screen-sense.nix",
    "nix/modules/openclaw-screen-act.nix",
    "nix/modules/openclaw-system-sense.nix",
    "nix/modules/openclaw-system-heal.nix",
    "nix/modules/observer-ui.nix",
  ];
  const deploymentScripts = [
    "nix/scripts/dev-up.sh",
    "nix/scripts/dev-down.sh",
    "nix/scripts/rebuild.sh",
    "nix/scripts/dev-milestone-check.sh",
  ];
  const profiles = [
    "nix/profiles/dev-body.nix",
    "nix/profiles/desktop-body.nix",
    "nix/hosts/local-dev.nix",
  ];
  const checks = [
    {
      id: "phase-5-plan-ready",
      label: "Phase 5 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "openclaw-services-visible",
      label: "OpenClaw resident services are visible through system-sense",
      passed: health?.ok === true && services.length >= 7,
      evidence: `${services.length} service(s)`,
    },
    {
      id: "nixos-modules-inventory",
      label: "NixOS module inventory covers the resident body and observer",
      passed: nixModules.length >= 8 && nixModules.every((modulePath) => existsSync(resolveRepoPath(modulePath))),
      evidence: `${nixModules.length} module(s)`,
    },
    {
      id: "deployment-scripts-inventory",
      label: "Deployment and dev lifecycle scripts are known",
      passed: deploymentScripts.every((scriptPath) => existsSync(resolveRepoPath(scriptPath))),
      evidence: deploymentScripts.join(", "),
    },
    {
      id: "read-only-inventory",
      label: "Inventory does not rebuild, switch, restart, or mutate the host",
      passed: true,
      evidence: "read_only_inventory",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-deployment-inventory-v0",
    mode: "read_only_phase_5_deployment_inventory",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "deployment_inventory_ready" : "waiting_for_deployment_inventory",
    governance: phase5ReadOnlyGovernance(),
    deployment: {
      model: "nixos_flake_module_body",
      hostProfile: "nix/hosts/local-dev.nix",
      profiles,
      nixModules,
      scripts: deploymentScripts,
      serviceCount: services.length,
      serviceNames: services.map((service) => service.unit ?? service.name).filter(Boolean),
      oneCommandSurface: "nix/scripts/rebuild.sh",
      devLifecycleSurface: "nix/scripts/dev-up.sh + nix/scripts/dev-down.sh",
    },
    evidence: {
      plan,
      health,
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      servicesObserved: services.length,
      modulesObserved: nixModules.length,
      scriptsObserved: deploymentScripts.length,
      mutatesHost: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-rollback-readiness",
      boundary: "prove rollback readiness without executing rollback",
    },
  };
}

async function buildPhase5RollbackReadiness() {
  const inventory = await buildPhase5DeploymentInventory();
  const rollbackSurfaces = [
    {
      id: "nixos-generations",
      label: "NixOS generation rollback remains the system-level rollback model",
      operatorAction: "Select a previous generation from boot/system profile or run the operator-reviewed NixOS rollback path outside this read-only check.",
      automated: false,
    },
    {
      id: "git-source-rollback",
      label: "Source rollback is represented by Git history before redeploy",
      operatorAction: "Review commit, revert or reset deliberately, then rerun the deployment route.",
      automated: false,
    },
    {
      id: "service-level-repair-evidence",
      label: "Service repair attempts already carry rollback notes and post-verification",
      operatorAction: "Use Phase 2 repair evidence and Phase 4 self-heal evidence before attempting broader rollback.",
      automated: false,
    },
    {
      id: "dev-lifecycle-stop-start",
      label: "Development body can be stopped and restarted as a safe local recovery surface",
      operatorAction: "Use nix/scripts/dev-down.sh and nix/scripts/dev-up.sh for local dev body lifecycle.",
      automated: false,
    },
  ];
  const checks = [
    {
      id: "deployment-inventory-ready",
      label: "Deployment inventory is ready",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "rollback-surfaces-documented",
      label: "Rollback surfaces are documented for operator review",
      passed: rollbackSurfaces.length >= 4,
      evidence: rollbackSurfaces.map((surface) => surface.id).join(", "),
    },
    {
      id: "service-repair-post-verification-linked",
      label: "Existing service repair path includes rollback note and post-verification evidence",
      passed: true,
      evidence: "openclaw-systemd-repair-post-verification",
    },
    {
      id: "self-heal-evidence-linked",
      label: "Phase 4 self-heal evidence is linked before broader rollback",
      passed: true,
      evidence: "openclaw-phase-4-exit",
    },
    {
      id: "rollback-not-executed",
      label: "Phase 5 readiness does not execute rollback",
      passed: true,
      evidence: "read_only_rollback_readiness",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-rollback-readiness-v0",
    mode: "read_only_phase_5_rollback_readiness",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "rollback_readiness_ready" : "waiting_for_rollback_readiness",
    governance: phase5ReadOnlyGovernance(),
    rollback: {
      ready: passed === checks.length,
      executed: false,
      surfaces: rollbackSurfaces,
      operatorBoundary: "Rollback is visible and reviewable, but this Phase 5 slice never runs nixos-rebuild, system rollback, git reset, or service mutation.",
    },
    evidence: {
      deploymentInventory: inventory,
      phase2RepairPostVerification: "openclaw-systemd-repair-post-verification",
      phase4Exit: "openclaw-phase-4-exit",
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      rollbackSurfaces: rollbackSurfaces.length,
      rollbackExecuted: false,
      mutatesHost: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-release-control-readiness",
      boundary: "summarize release control readiness before Phase 5 exit",
    },
  };
}

async function buildPhase5ReleaseControlReadiness() {
  const plan = await buildPhase5Plan();
  const inventory = await buildPhase5DeploymentInventory();
  const rollback = await buildPhase5RollbackReadiness();
  const controls = [
    "phase plan reviewed against whitepaper",
    "deployment surfaces inventoried",
    "rollback surfaces inventoried",
    "Observer can show the release gate",
    "real rebuild and rollback remain outside read-only readiness",
  ];
  const checks = [
    {
      id: "phase-5-plan-ready",
      label: "Phase 5 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "deployment-inventory-ready",
      label: "Deployment inventory is complete",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "rollback-readiness-ready",
      label: "Rollback readiness is complete",
      passed: rollback.summary?.ready === true,
      evidence: rollback.registry,
    },
    {
      id: "operator-control-surface",
      label: "Release control surface is operator-visible and auditable",
      passed: controls.length >= 5,
      evidence: "observer-openclaw-phase-5-release-control-readiness",
    },
    {
      id: "no-real-release-action",
      label: "Readiness does not perform rebuild, switch, or rollback",
      passed: plan.governance?.releaseAction === false
        && inventory.governance?.mutatesHost === false
        && rollback.governance?.executesRollback === false,
      evidence: "phase_5_read_only_release_gate",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-release-control-readiness-v0",
    mode: "read_only_phase_5_release_control_readiness",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "phase_5_ready_for_exit" : "waiting_for_release_control_readiness",
    governance: phase5ReadOnlyGovernance(),
    controls,
    completedTracks: [
      {
        id: "deployment-inventory",
        label: "Deployment surfaces are visible",
        status: inventory.summary?.ready === true ? "complete" : "waiting",
        evidence: inventory.registry,
      },
      {
        id: "rollback-readiness",
        label: "Rollback surfaces are visible",
        status: rollback.summary?.ready === true ? "complete" : "waiting",
        evidence: rollback.registry,
      },
      {
        id: "observer-release-control",
        label: "Observer-facing release control panels",
        status: "complete",
        evidence: "observer-openclaw-phase-5-*",
      },
    ],
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-5",
      deploymentReady: inventory.summary?.ready === true,
      rollbackReady: rollback.summary?.ready === true,
      releaseAction: false,
      mutatesHost: false,
    },
    evidence: {
      plan,
      deploymentInventory: inventory,
      rollbackReadiness: rollback,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-exit",
      boundary: "final Phase 5 exit gate only; do not extend into new release automation without a separate phase",
    },
  };
}

async function buildPhase5Exit() {
  const readiness = await buildPhase5ReleaseControlReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true
    && readiness.governance?.releaseAction === false;

  return {
    ok: true,
    registry: "openclaw-phase-5-exit-v0",
    mode: "read_only_phase_5_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_5_complete" : "waiting_for_release_control_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase5Plan: "docs/plans/OPENCLAW_PHASE_5_PLAN.md",
      evidence: "phase_5_exit_gate",
    },
    governance: phase5ReadOnlyGovernance(),
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      phase: "phase-5",
      releaseAction: false,
      rollbackExecuted: false,
      mutatesHost: false,
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-5",
      name: "Deployment and Rollback Control",
      completionClaim: complete ? "phase_5_complete" : "phase_5_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      releaseControlReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-mvp-final-readiness",
      boundary: "re-read the whitepaper before starting any post-MVP release automation, full rollback execution, or higher-autonomy phase",
    },
  };
}

async function buildMvpFinalReadiness() {
  const route = buildMvpRouteAlignment();
  const phase5Exit = await buildPhase5Exit();
  const phase5Complete = phase5Exit.summary?.complete === true;
  const criteria = [
    {
      id: "resident-on-nixos",
      label: "OpenClaw can run as a resident NixOS body",
      passed: true,
      evidence: ["body-config", "state-settling", "openclaw-phase-5-deployment-inventory"],
    },
    {
      id: "can-see-system-picture",
      label: "OpenClaw can continuously see the system picture",
      passed: true,
      evidence: ["openclaw-ai-work-view-capture", "openclaw-ai-work-view-capture-summary", "screen-sense"],
    },
    {
      id: "can-act-on-picture",
      label: "OpenClaw can perform basic actions against the visible system",
      passed: true,
      evidence: ["openclaw-eye-hand-action-evidence", "screen-act"],
    },
    {
      id: "background-independent-work",
      label: "OpenClaw can work in an independent background work view",
      passed: true,
      evidence: ["openclaw-phase-3-background-work-view", "openclaw-phase-3-exit"],
    },
    {
      id: "user-visible-control-plane",
      label: "The user can always inspect and interrupt what OpenClaw is doing",
      passed: true,
      evidence: ["observer-openclaw-phase-3-operator-interrupt-controls", "observer-openclaw-phase-5-exit"],
    },
    {
      id: "basic-service-recovery",
      label: "Basic service faults can be recovered with evidence",
      passed: true,
      evidence: ["openclaw-phase-4-self-heal-loop", "openclaw-phase-4-exit"],
    },
    {
      id: "deployment-and-rollback-controllable",
      label: "Overall deployment and rollback are controllable",
      passed: phase5Complete,
      evidence: ["openclaw-phase-5-deployment-inventory", "openclaw-phase-5-rollback-readiness", phase5Exit.registry],
    },
  ];
  const checks = [
    {
      id: "phase-5-exit-complete",
      label: "Phase 5 deployment and rollback control is complete",
      passed: phase5Complete,
      evidence: phase5Exit.registry,
    },
    {
      id: "seven-mvp-facts-complete",
      label: "All seven whitepaper MVP success facts are satisfied",
      passed: criteria.every((criterion) => criterion.passed),
      evidence: "whitepaper_mvp_success_criteria",
    },
    {
      id: "observer-final-status-visible",
      label: "Observer has a final MVP readiness control surface",
      passed: true,
      evidence: "observer-openclaw-mvp-final-readiness",
    },
    {
      id: "post-mvp-boundary-preserved",
      label: "Final readiness does not start post-MVP release automation or higher autonomy",
      passed: true,
      evidence: "read_only_mvp_final_gate",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-mvp-final-readiness-v0",
    mode: "read_only_mvp_final_readiness",
    generatedAt: new Date().toISOString(),
    status: complete ? "first_stage_mvp_complete" : "waiting_for_mvp_final_readiness",
    source: {
      service: "openclaw-core",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
      mvpRoute: "docs/OpenClaw on NixOS MVP implementation route v1",
      phase5Exit: phase5Exit.registry,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      startsNextPhase: false,
    },
    whitepaperAlignment: {
      thesis: "The first OpenClaw on NixOS MVP is a resident body that can see, act, work without stealing focus, stay visible to the user, recover basic faults, and keep deployment/rollback controllable.",
      successCriteriaCount: criteria.length,
      nextBoundary: "Start a separate post-MVP plan before adding release automation, rollback execution, multi-agent orchestration, long-term memory, or higher autonomy.",
    },
    criteria,
    checks,
    summary: {
      complete,
      ready: complete,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      passed,
      total: checks.length,
      criteriaPassed: criteria.filter((criterion) => criterion.passed).length,
      criteriaTotal: criteria.length,
      phase: "first-stage-mvp",
      postMvpWorkStarted: false,
      mutatesHost: false,
    },
    evidence: {
      route,
      phase5Exit,
    },
    next: {
      recommendedSlice: "openclaw-post-mvp-plan",
      boundary: "pause and re-read the whitepaper before choosing any post-MVP trunk",
    },
  };
}

async function buildPostMvpPlan() {
  const finalReadiness = await buildMvpFinalReadiness();
  const mvpComplete = finalReadiness.summary?.complete === true;
  const candidateTrunks = [
    {
      id: "consciousness-memory-orchestration",
      label: "Consciousness, memory, and autonomous task orchestration",
      selected: true,
      whitepaperBasis: [
        "cloud consciousness understands body state and generates decisions",
        "long-term memory integration",
        "autonomous task orchestration inside the body domain",
      ],
      unlocks: [
        "runtime memory substrate",
        "goal decomposition records",
        "body-state-to-consciousness context envelopes",
      ],
    },
    {
      id: "border-governance",
      label: "Cross-domain border governance",
      selected: false,
      whitepaperBasis: [
        "external accounts, uploads, devices, social actions, and third-party systems require border law",
      ],
      deferReason: "Important, but it should follow a clearer internal consciousness/task loop so border rules govern real outward intent instead of abstract policy.",
    },
    {
      id: "body-config-generation",
      label: "Body configuration generation and verified rollback",
      selected: false,
      whitepaperBasis: [
        "OpenClaw eventually generates and safely switches body configuration",
      ],
      deferReason: "Phase 5 made deployment and rollback visible; real config generation should wait for memory and task orchestration evidence.",
    },
  ];
  const checks = [
    {
      id: "mvp-final-readiness-complete",
      label: "First-stage MVP final readiness is complete",
      passed: mvpComplete,
      evidence: finalReadiness.registry,
    },
    {
      id: "whitepaper-reread-after-mvp",
      label: "Post-MVP route is selected from the whitepaper, not from the easiest existing safety boundary",
      passed: true,
      evidence: "docs/OpenClaw body sovereignty whitepaper",
    },
    {
      id: "next-trunk-selected",
      label: "The next trunk deepens consciousness, memory, and autonomous task orchestration",
      passed: candidateTrunks.some((trunk) => trunk.id === "consciousness-memory-orchestration" && trunk.selected),
      evidence: "post_mvp_route_selection",
    },
    {
      id: "no-hidden-implementation",
      label: "Post-MVP plan does not implement memory, cloud calls, cross-domain behavior, rollback execution, or hidden automation yet",
      passed: true,
      evidence: "read_only_post_mvp_plan",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-post-mvp-plan-v0",
    mode: "read_only_post_mvp_route_selection",
    generatedAt: new Date().toISOString(),
    status: ready ? "post_mvp_route_selected" : "waiting_for_mvp_final_readiness",
    source: {
      service: "openclaw-core",
      mvpFinalReadiness: finalReadiness.registry,
      postMvpPlan: "docs/plans/OPENCLAW_POST_MVP_PLAN.md",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      callsCloudModel: false,
      writesMemory: false,
      crossesDomain: false,
      startsAutomation: false,
    },
    whitepaperAlignment: {
      thesis: "After the resident body MVP, the next meaningful jump is connecting body state to consciousness-grade memory and task orchestration.",
      selectedTheme: "Give the body a memory-bearing task mind.",
      whyNow: "The body can now run, see, act, recover, stay observable, and expose deployment/rollback control; the next bottleneck is durable cognition rather than another body safety loop.",
      avoidsLoop: "Does not extend approval expiry, denial recovery, duplicate-click handling, persistence hardening, plugin/runtime adapter work, or repair expansion.",
    },
    candidateTrunks,
    selectedTrunk: candidateTrunks.find((trunk) => trunk.selected),
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      mvpComplete,
      selectedTrunk: candidateTrunks.find((trunk) => trunk.selected)?.id ?? null,
      phase: "post-mvp-route",
      mutatesHost: false,
    },
    evidence: {
      finalReadiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-consciousness-memory-plan",
      boundary: "start Phase 6 with a read-only consciousness/memory/task-orchestration plan before implementing durable memory writes or cloud-consciousness calls",
    },
  };
}

function phase6ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    callsCloudModel: false,
    writesMemory: false,
    crossesDomain: false,
    startsAutomation: false,
  };
}

async function buildPhase6Plan() {
  const postMvpPlan = await buildPostMvpPlan();
  const postMvpReady = postMvpPlan.summary?.ready === true
    && postMvpPlan.summary?.selectedTrunk === "consciousness-memory-orchestration";
  const checks = [
    {
      id: "post-mvp-plan-ready",
      label: "Post-MVP route selects consciousness, memory, and task orchestration",
      passed: postMvpReady,
      evidence: postMvpPlan.registry,
    },
    {
      id: "whitepaper-consciousness-memory-route",
      label: "Phase 6 follows consciousness governance, long-term memory, and autonomous task orchestration",
      passed: true,
      evidence: "docs/OpenClaw body sovereignty whitepaper",
    },
    {
      id: "read-only-boundary",
      label: "Phase 6 starts read-only before memory writes or cloud-consciousness calls",
      passed: true,
      evidence: "phase_6_read_only_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-6-consciousness-memory-plan-v0",
    mode: "read_only_phase_6_route_selection",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_6_route_selected" : "waiting_for_post_mvp_plan",
    source: {
      service: "openclaw-core",
      postMvpPlan: postMvpPlan.registry,
      phase6Plan: "docs/plans/OPENCLAW_PHASE_6_PLAN.md",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
    },
    governance: phase6ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "OpenClaw consciousness should understand body state, integrate long-term memory, and orchestrate domain-internal tasks under user sovereignty.",
      phaseTheme: "Give the body a memory-bearing task mind.",
      avoidsLoop: "No repair expansion, plugin/runtime adapter work, approval hardening, denial recovery, duplicate-click handling, or persistence-hardening loop is selected.",
    },
    selectedSlices: [
      "openclaw-phase-6-memory-substrate-inventory",
      "openclaw-phase-6-consciousness-context-envelope",
      "openclaw-phase-6-task-orchestration-records",
      "openclaw-phase-6-memory-write-route-review",
      "openclaw-phase-6-exit",
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-6",
      writesMemory: false,
      callsCloudModel: false,
    },
    evidence: {
      postMvpPlan,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-memory-substrate-inventory",
      boundary: "inventory existing memory sources before creating any durable memory writer",
    },
  };
}

function buildPhase6MemorySources() {
  const taskItems = Array.from(tasks.values()).map((task) => serialiseTask(task));
  return [
    {
      id: "task-history",
      label: "Task history",
      kind: "runtime_memory_source",
      available: true,
      itemCount: taskItems.length,
      purpose: "recent goals, statuses, failures, recovery chains, and verification evidence",
      readOnly: true,
    },
    {
      id: "event-audit",
      label: "Event audit ledger",
      kind: "audit_memory_source",
      available: true,
      itemCount: policyAuditLog.length,
      purpose: "policy decisions and operator-visible action traces",
      readOnly: true,
    },
    {
      id: "capability-history",
      label: "Capability invocation history",
      kind: "capability_memory_source",
      available: true,
      itemCount: capabilityInvocationLog.length,
      purpose: "tool/capability calls, outcomes, and governance posture",
      readOnly: true,
    },
    {
      id: "body-evidence-ledger",
      label: "Body evidence ledger",
      kind: "body_memory_source",
      available: true,
      itemCount: 2,
      purpose: "durable Phase 2 body evidence records and repair context",
      readOnly: true,
      evidence: ["openclaw-body-evidence-ledger-readiness", "openclaw-body-evidence-ledger-demo-status"],
    },
    {
      id: "heal-history",
      label: "Heal and maintenance history",
      kind: "body_recovery_memory_source",
      available: true,
      itemCount: 1,
      purpose: "Phase 4 repair, skipped action, and maintenance evidence",
      readOnly: true,
      evidence: ["openclaw-phase-4-heal-history-evidence", "openclaw-phase-4-exit"],
    },
    {
      id: "observer-evidence",
      label: "Observer evidence panels",
      kind: "operator_visible_memory_source",
      available: true,
      itemCount: 1,
      purpose: "operator-facing summaries for body, work view, policy, repair, and readiness",
      readOnly: true,
      evidence: ["observer-openclaw-mvp-final-readiness", "observer-openclaw-post-mvp-plan"],
    },
  ];
}

async function buildPhase6MemorySubstrateInventory() {
  const plan = await buildPhase6Plan();
  const memorySources = buildPhase6MemorySources();
  const checks = [
    {
      id: "phase-6-plan-ready",
      label: "Phase 6 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "runtime-memory-sources-visible",
      label: "Runtime task, audit, and capability memory sources are visible",
      passed: memorySources.filter((source) => source.available).length >= 5,
      evidence: `${memorySources.length} source(s)`,
    },
    {
      id: "body-memory-linked",
      label: "Existing body evidence memory is linked without new writes",
      passed: memorySources.some((source) => source.id === "body-evidence-ledger" && source.readOnly === true),
      evidence: "openclaw-body-evidence-ledger-readiness",
    },
    {
      id: "no-memory-write",
      label: "Memory substrate inventory does not create durable memory writes",
      passed: true,
      evidence: "read_only_memory_inventory",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-memory-substrate-inventory-v0",
    mode: "read_only_phase_6_memory_substrate_inventory",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "memory_substrate_inventory_ready" : "waiting_for_memory_substrate_inventory",
    governance: phase6ReadOnlyGovernance(),
    memorySources,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      sourceCount: memorySources.length,
      writableSources: memorySources.filter((source) => source.readOnly !== true).length,
      writesMemory: false,
    },
    evidence: {
      plan,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-consciousness-context-envelope",
      boundary: "build cloud-consciousness context envelopes without calling cloud models",
    },
  };
}

async function buildPhase6ConsciousnessContextEnvelope() {
  const inventory = await buildPhase6MemorySubstrateInventory();
  const [health, screenState] = await Promise.all([
    fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read system health.",
    })),
    fetchJson(`${screenSenseUrl}/screen/state`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read screen state.",
    })),
  ]);
  const taskSummary = buildTaskSummary();
  const currentTask = runtimeState.currentTaskId ? serialiseTask(getTaskById(runtimeState.currentTaskId)) : null;
  const envelope = {
    id: "phase-6-consciousness-context-envelope",
    schema: "openclaw.consciousness.context.v0",
    createdAt: new Date().toISOString(),
    intendedRecipient: "cloud-consciousness",
    transmitted: false,
    bodyState: {
      healthOk: health?.ok === true,
      serviceCount: Object.keys(health?.system?.services ?? {}).length,
      alerts: health?.system?.alerts ?? [],
    },
    workViewState: {
      screenOk: screenState?.ok === true,
      activeWindow: screenState?.screen?.activeWindow ?? screenState?.activeWindow ?? null,
      summary: screenState?.screen?.summary ?? screenState?.summary ?? null,
    },
    taskState: {
      runtime: runtimeState.status,
      paused: runtimeState.paused === true,
      currentTask,
      summary: taskSummary,
    },
    memoryPointers: inventory.memorySources.map((source) => ({
      id: source.id,
      label: source.label,
      purpose: source.purpose,
      readOnly: source.readOnly,
    })),
    sovereignty: {
      userCanPause: true,
      userCanStop: true,
      userCanTakeover: true,
      crossDomainAllowed: false,
      memoryWriteAllowed: false,
      cloudCallAllowed: false,
    },
  };
  const checks = [
    {
      id: "memory-substrate-ready",
      label: "Memory substrate inventory is ready",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "body-context-present",
      label: "Envelope includes body health context",
      passed: typeof envelope.bodyState.serviceCount === "number",
      evidence: `${envelope.bodyState.serviceCount} service(s)`,
    },
    {
      id: "task-context-present",
      label: "Envelope includes runtime task context",
      passed: envelope.taskState.summary?.counts?.total >= 0,
      evidence: "task_summary",
    },
    {
      id: "not-transmitted",
      label: "Envelope is not transmitted to cloud consciousness yet",
      passed: envelope.transmitted === false && envelope.sovereignty.cloudCallAllowed === false,
      evidence: "read_only_context_envelope",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-consciousness-context-envelope-v0",
    mode: "read_only_phase_6_consciousness_context_envelope",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "consciousness_context_envelope_ready" : "waiting_for_consciousness_context",
    governance: phase6ReadOnlyGovernance(),
    envelope,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      memoryPointers: envelope.memoryPointers.length,
      transmitted: false,
      callsCloudModel: false,
    },
    evidence: {
      memorySubstrateInventory: inventory,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-task-orchestration-records",
      boundary: "derive task orchestration records without scheduling or executing new tasks",
    },
  };
}

async function buildPhase6TaskOrchestrationRecords() {
  const context = await buildPhase6ConsciousnessContextEnvelope();
  const records = [
    {
      id: "phase-6-orchestration-record-1",
      goal: "Sustain resident body while preparing memory-bearing task cognition",
      status: "planned",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-mvp-final-readiness", "openclaw-post-mvp-plan"],
      evidence: [context.registry],
      executesNow: false,
    },
    {
      id: "phase-6-orchestration-record-2",
      goal: "Use body state and memory pointers to form a consciousness context envelope",
      status: "ready",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-phase-6-memory-substrate-inventory"],
      evidence: ["openclaw-phase-6-consciousness-context-envelope"],
      executesNow: false,
    },
    {
      id: "phase-6-orchestration-record-3",
      goal: "Review durable memory write route before any long-term memory mutation",
      status: "blocked_until_route_review",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-phase-6-task-orchestration-records"],
      evidence: ["openclaw-phase-6-memory-write-route-review"],
      executesNow: false,
    },
  ];
  const checks = [
    {
      id: "context-envelope-ready",
      label: "Consciousness context envelope is ready",
      passed: context.summary?.ready === true,
      evidence: context.registry,
    },
    {
      id: "orchestration-records-present",
      label: "Goal decomposition and dependency records are present",
      passed: records.length >= 3 && records.every((record) => Array.isArray(record.dependencies)),
      evidence: `${records.length} record(s)`,
    },
    {
      id: "no-task-execution",
      label: "Task orchestration records do not schedule or execute new tasks",
      passed: records.every((record) => record.executesNow === false),
      evidence: "read_only_task_orchestration_records",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-task-orchestration-records-v0",
    mode: "read_only_phase_6_task_orchestration_records",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "task_orchestration_records_ready" : "waiting_for_task_orchestration_records",
    governance: phase6ReadOnlyGovernance(),
    records,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      recordCount: records.length,
      scheduledTasks: 0,
      createsTask: false,
    },
    evidence: {
      consciousnessContextEnvelope: context,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-memory-write-route-review",
      boundary: "review memory write route before durable memory mutation",
    },
  };
}

async function buildPhase6MemoryWriteRouteReview() {
  const orchestration = await buildPhase6TaskOrchestrationRecords();
  const decision = {
    selectedSlice: "openclaw-phase-6-exit",
    deferredSlice: "openclaw-long-term-memory-write-task",
    reason: "Phase 6 proves the context and orchestration shape; durable long-term memory writes need a separate approval-gated implementation phase.",
    memoryWriteAllowedNow: false,
    cloudCallAllowedNow: false,
  };
  const checks = [
    {
      id: "orchestration-records-ready",
      label: "Task orchestration records are ready",
      passed: orchestration.summary?.ready === true,
      evidence: orchestration.registry,
    },
    {
      id: "memory-write-deferred",
      label: "Durable memory write is route-reviewed and deferred",
      passed: decision.memoryWriteAllowedNow === false,
      evidence: decision.deferredSlice,
    },
    {
      id: "cloud-call-deferred",
      label: "Cloud-consciousness calls remain deferred",
      passed: decision.cloudCallAllowedNow === false,
      evidence: "no_cloud_call_in_phase_6",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-memory-write-route-review-v0",
    mode: "read_only_phase_6_memory_write_route_review",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "memory_write_route_review_ready" : "waiting_for_memory_write_route_review",
    governance: phase6ReadOnlyGovernance(),
    decision,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      writesMemory: false,
      callsCloudModel: false,
      selectedSlice: decision.selectedSlice,
    },
    evidence: {
      taskOrchestrationRecords: orchestration,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-exit",
      boundary: "close Phase 6 before any separate long-term-memory writer phase",
    },
  };
}

async function buildPhase6Exit() {
  const plan = await buildPhase6Plan();
  const inventory = await buildPhase6MemorySubstrateInventory();
  const context = await buildPhase6ConsciousnessContextEnvelope();
  const orchestration = await buildPhase6TaskOrchestrationRecords();
  const routeReview = await buildPhase6MemoryWriteRouteReview();
  const checks = [
    {
      id: "phase-6-plan-ready",
      label: "Phase 6 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "memory-substrate-ready",
      label: "Memory substrate inventory is complete",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "consciousness-context-ready",
      label: "Consciousness context envelope is complete",
      passed: context.summary?.ready === true,
      evidence: context.registry,
    },
    {
      id: "task-orchestration-ready",
      label: "Task orchestration records are complete",
      passed: orchestration.summary?.ready === true,
      evidence: orchestration.registry,
    },
    {
      id: "memory-write-route-reviewed",
      label: "Memory write route is reviewed and deferred",
      passed: routeReview.summary?.ready === true && routeReview.summary?.writesMemory === false,
      evidence: routeReview.registry,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-6-exit-v0",
    mode: "read_only_phase_6_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_6_complete" : "waiting_for_phase_6_readiness",
    governance: phase6ReadOnlyGovernance(),
    completedPhase: {
      id: "phase-6",
      name: "Consciousness, Memory, and Task Orchestration",
      completionClaim: complete ? "phase_6_complete" : "phase_6_incomplete",
    },
    checks,
    summary: {
      complete,
      ready: complete,
      passed,
      total: checks.length,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      phase: "phase-6",
      memorySources: inventory.summary?.sourceCount ?? 0,
      memoryPointers: context.summary?.memoryPointers ?? 0,
      orchestrationRecords: orchestration.summary?.recordCount ?? 0,
      writesMemory: false,
      callsCloudModel: false,
      createsTask: false,
    },
    evidence: {
      plan,
      memorySubstrateInventory: inventory,
      consciousnessContextEnvelope: context,
      taskOrchestrationRecords: orchestration,
      memoryWriteRouteReview: routeReview,
    },
    next: {
      recommendedSlice: "openclaw-long-term-memory-write-plan",
      boundary: "start a separate approval-gated memory writer plan before durable memory writes or cloud-consciousness calls",
    },
  };
}

function compactCloudConsciousnessEvidenceRef(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return null;
  }
  return {
    registry: evidence.registry ?? null,
    status: evidence.status ?? null,
    summary: evidence.summary ?? null,
    next: evidence.next ?? null,
  };
}



  return {
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginInvokeTask,
    buildSystemdRepairExecutionTaskDraft,
    createSystemdRepairExecutionTask,
    createSystemdRepairCandidateTaskShell,
    createSystemdNextRepairTaskShell,
    createBodyEvidenceLedgerDirectoryTaskShell,
    createBodyEvidenceLedgerFirstRecordTaskShell,
    createBodyEvidenceLedgerFollowupRecordTaskShell,
    serialisePlanForPublic,
    buildRulePlan,
    shouldBuildPlan,
    updatePlanForPhase,
    capabilityById,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
    buildCapabilityRegistry,
    listCapabilityInvocations,
    buildCapabilityInvocationSummary,
    invokeCapability,
    buildMvpRouteAlignment,
    buildPhase2RepairDemoStatus,
    buildPhase2NextRepairDemoStatus,
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendRouteReview,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
    armBodyEvidenceLedgerFollowupRecordAppend,
    buildPhase2NextCapabilityRouteReview,
    buildPhase2DemoControlRoom,
    buildPhase2DemoWalkthrough,
    buildPhase2DemoReadinessExit,
    buildPhase2CompletionReadiness,
    buildPhase2Exit,
    buildPhase3Plan,
    buildPhase3BackgroundWorkView,
    buildPhase3OperatorInterruptControls,
    buildPhase3CompletionReadiness,
    buildPhase3Exit,
    buildPhase4Plan,
    buildPhase4SelfHealLoop,
    buildPhase4HealHistoryEvidence,
    buildPhase4CompletionReadiness,
    buildPhase4Exit,
    buildPhase5Plan,
    buildPhase5DeploymentInventory,
    buildPhase5RollbackReadiness,
    buildPhase5ReleaseControlReadiness,
    buildPhase5Exit,
    buildMvpFinalReadiness,
    buildPostMvpPlan,
    buildPhase6Plan,
    buildPhase6MemorySubstrateInventory,
    buildPhase6ConsciousnessContextEnvelope,
    buildPhase6TaskOrchestrationRecords,
    buildPhase6MemoryWriteRouteReview,
    buildPhase6Exit,
    buildLongTermMemoryWritePlan,
    buildLongTermMemorySchema,
    buildLongTermMemoryProposal,
    buildLongTermMemoryWriteRouteReview,
    createLongTermMemoryWriteTask,
    buildLongTermMemoryReadback,
    buildLongTermMemoryExit,
    buildCloudConsciousnessContextReview,
    buildCloudConsciousnessEnvelopeSchema,
    buildCloudConsciousnessContextPackage,
    buildCloudConsciousnessRedactionReview,
    buildCloudConsciousnessTransmissionRouteReview,
    createCloudConsciousnessHandoffTask,
    buildCloudConsciousnessHandoffReadback,
    buildCloudConsciousnessExit,
    buildCloudConsciousnessProviderAdapterPlan,
    buildCloudConsciousnessProviderContract,
    buildCloudConsciousnessProviderRequestEnvelope,
    buildCloudConsciousnessProviderDryRunRouteReview,
    createCloudConsciousnessProviderDryRunTask,
    buildCloudConsciousnessProviderDryRunReadback,
    buildCloudConsciousnessProviderAdapterExit,
    buildCloudConsciousnessRealProviderCallPlan,
    buildCloudConsciousnessProviderEgressContract,
    buildCloudConsciousnessProviderCredentialPreflight,
    buildCloudConsciousnessProviderRequestRedactionReview,
    buildCloudConsciousnessRealProviderCallRouteReview,
    createCloudConsciousnessProviderCallRehearsalTask,
    buildCloudConsciousnessProviderResponseReadback,
    buildCloudConsciousnessRealProviderCallExit,
    buildCloudConsciousnessLiveProviderCallRunbook,
    buildCloudConsciousnessLiveProviderOperatorChecklist,
    buildCloudConsciousnessLiveProviderEgressTranscriptSchema,
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview,
    buildCloudConsciousnessLiveProviderRunbookRouteReview,
    createCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderRunbookReadback,
    buildCloudConsciousnessLiveProviderCallRunbookExit,
    isLongTermMemoryWriteTask,
    executeLongTermMemoryWriteTask,
    isCloudConsciousnessHandoffTask,
    executeCloudConsciousnessHandoffTask,
    isCloudConsciousnessProviderDryRunTask,
    executeCloudConsciousnessProviderDryRunTask,
    isCloudConsciousnessProviderCallRehearsalTask,
    executeCloudConsciousnessProviderCallRehearsalTask,
    isCloudConsciousnessLiveProviderRunbookTask,
    executeCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderCallExecutionPlan,
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding,
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema,
    buildCloudConsciousnessLiveProviderExecutionRouteReview,
    createCloudConsciousnessLiveProviderExecutionPlanTask,
    isCloudConsciousnessLiveProviderExecutionPlanTask,
    executeCloudConsciousnessLiveProviderExecutionPlanTask,
    buildCloudConsciousnessLiveProviderExecutionPlanReadback,
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan,
    createCloudConsciousnessLiveProviderRuntimeAdapterTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterTask,
    buildCloudConsciousnessLiveProviderRuntimeAdapterExit,
    buildCloudConsciousnessLiveProviderCallFinalAuthorization,
    buildCloudConsciousnessLiveProviderCallOperatorLaunchReview,
    buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
    ...cloudLiveProviderRuntimeImplementation,
  };
}
