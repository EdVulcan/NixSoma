import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { createOpenClawNativePluginRegistryGenerationStore } from "../../../packages/plugin-runtime/src/plugin-registry-generation-store.mjs";
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
import { createPhase2MvpReadinessBuilders } from "./phase2-mvp-readiness-builders.mjs";
import { createPhase3WorkViewBuilders } from "./phase3-work-view-builders.mjs";
import { createPhase4SelfHealBuilders } from "./phase4-self-heal-builders.mjs";
import { createPhase5MvpPhase6ReadinessBuilders } from "./phase5-mvp-phase6-readiness-builders.mjs";
import { createRuntimeProfiler } from "./runtime-diagnostics.mjs";
import { createRulePlanBuilders } from "./rule-plan-builders.mjs";
import { createSystemdTaskBuilders } from "./systemd-task-builders.mjs";

export function createPlanBuilder(deps) {
  const profiler = createRuntimeProfiler("plan-builder");
  const {
    client,
    state,
    taskManager,
    pluginReview,
    approvalEngine,
    policyEvaluator,
    publishEvent,
    host,
    port,
    listCommandTranscriptRecords = () => [],
    listFilesystemChangeRecords = () => [],
  } = deps;
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
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
    HOSTD_SOCKET_PATH,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
    BODY_EVIDENCE_LEDGER_FILE_PATH,
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
    buildNativeAcpxCodexBridgeWrapperDraft,
  } = pluginReview;

  const capabilityRuntime = createCapabilityRuntime({
    host,
    port,
    client,
    state,
    taskManager,
    pluginReview,
    policyEvaluator,
    publishEvent,
    listCommandTranscriptRecords,
    listFilesystemChangeRecords,
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

  const rulePlanBuilders = createRulePlanBuilders({
    CROSS_BOUNDARY_INTENTS,
    capabilityById,
    capabilityByIntent,
  });
  const {
    serialisePlanForPublic,
    buildRulePlan,
    shouldBuildPlan,
    updatePlanForPhase,
  } = rulePlanBuilders;
  const nativePluginRegistryStore = createOpenClawNativePluginRegistryGenerationStore({
    onStateChange: (generationState) => {
      runtimeState.nativePluginRegistryGeneration = generationState;
      persistState();
    },
  });

  function restoreNativePluginRuntimeState() {
    return nativePluginRegistryStore.restore(runtimeState.nativePluginRegistryGeneration);
  }

  const nativePluginPlanBuilders = createNativePluginPlanBuilders({
    nativePluginRegistryStore,
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
    refreshNativePluginRuntimeRegistry,
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeRefreshEvidence,
    buildNativePluginRuntimeRefreshTaskDraft,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginRuntimeRefreshTask,
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
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
    HOSTD_SOCKET_PATH,
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

  let buildMvpRouteAlignment;
  let buildPhase2RepairDemoStatus;
  let buildPhase2NextRepairDemoStatus;
  let buildPhase2DemoControlRoom;
  let buildPhase2DemoWalkthrough;
  let buildPhase2DemoReadinessExit;
  let buildPhase2NextCapabilityRouteReview;
  let buildPhase2CompletionReadiness;
  let buildPhase2Exit;

  const bodyEvidenceReadinessBuilders = createBodyEvidenceReadinessBuilders({
    tasks,
    approvals,
    getTaskById,
    persistState,
    publishEvent,
    serialiseTask,
    buildPhase2NextCapabilityRouteReview: (...args) => buildPhase2NextCapabilityRouteReview(...args),
    ...(BODY_EVIDENCE_LEDGER_FILE_PATH
      ? { resolveLedgerFilePath: () => BODY_EVIDENCE_LEDGER_FILE_PATH }
      : {}),
  });
  const {
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendRouteReview,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
    armBodyEvidenceLedgerFollowupRecordAppend,
  } = bodyEvidenceReadinessBuilders;

  const phase2MvpReadinessBuilders = createPhase2MvpReadinessBuilders({
    tasks,
    fetchJson,
    systemSenseUrl,
    serialiseTask,
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
  });
  ({
    buildMvpRouteAlignment,
    buildPhase2RepairDemoStatus,
    buildPhase2NextRepairDemoStatus,
    buildPhase2DemoControlRoom,
    buildPhase2DemoWalkthrough,
    buildPhase2DemoReadinessExit,
    buildPhase2NextCapabilityRouteReview,
    buildPhase2CompletionReadiness,
    buildPhase2Exit,
  } = phase2MvpReadinessBuilders);

  const phase3WorkViewBuilders = createPhase3WorkViewBuilders({
    fetchJson,
    sessionManagerUrl,
    buildOperatorState,
    tasks,
  });
  const {
    buildPhase3Plan,
    buildPhase3BackgroundWorkView,
    buildPhase3OperatorInterruptControls,
    buildPhase3CompletionReadiness,
    buildPhase3Exit,
  } = phase3WorkViewBuilders;

  const phase4SelfHealBuilders = createPhase4SelfHealBuilders({
    fetchJson,
    systemSenseUrl,
    systemHealUrl,
  });
  const {
    buildPhase4Plan,
    buildPhase4SelfHealLoop,
    buildPhase4HealHistoryEvidence,
    buildPhase4CompletionReadiness,
    buildPhase4Exit,
  } = phase4SelfHealBuilders;

  const phase5MvpPhase6ReadinessBuilders = createPhase5MvpPhase6ReadinessBuilders({
    fetchJson,
    systemSenseUrl,
    screenSenseUrl,
    tasks,
    runtimeState,
    policyAuditLog,
    capabilityInvocationLog,
    getTaskById,
    serialiseTask,
    buildTaskSummary,
    buildMvpRouteAlignment,
    buildPhase4Exit,
  });
  const {
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
  } = phase5MvpPhase6ReadinessBuilders;

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
    failTask,
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
    restoreNativePluginRuntimeState,
    refreshNativePluginRuntimeRegistry,
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeRefreshEvidence,
    buildNativePluginRuntimeRefreshTaskDraft,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginRuntimeRefreshTask,
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
    buildNativeAcpxCodexBridgeWrapperDraft,
    ...cloudLiveProviderRuntimeImplementation,
  };
}
