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
import { createPhase3WorkViewBuilders } from "./phase3-work-view-builders.mjs";
import { createPhase4SelfHealBuilders } from "./phase4-self-heal-builders.mjs";
import { createPhase5MvpPhase6ReadinessBuilders } from "./phase5-mvp-phase6-readiness-builders.mjs";
import { createRuntimeProfiler } from "./runtime-diagnostics.mjs";
import { createRulePlanBuilders } from "./rule-plan-builders.mjs";
import { createSystemdTaskBuilders } from "./systemd-task-builders.mjs";

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

  const phase3WorkViewBuilders = createPhase3WorkViewBuilders({
    fetchJson,
    sessionManagerUrl,
    buildOperatorState,
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
