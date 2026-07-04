import { corsHeaders, sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

export function registerRoutes(deps) {
  const { state, client, policyEvaluator, approvalEngine, taskManager, pluginReview, workspaceOps, planBuilder, executor, publishEvent, host, port, stateFilePath, eventHubUrl, sessionManagerUrl, browserRuntimeUrl, screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl } = deps;

  const { tasks, approvals, runtimeState, policyAuditLog, capabilityInvocationLog, autonomyMode, updateRuntimeState, persistState, loadPersistentState, getCurrentTask } = state;
  const { fetchJson, postJson, readJsonFileIfPresent, buildSystemSenseUrl } = client;
  const { ensureTaskPolicy, buildPolicyState, evaluatePolicyIntent, recordPolicyDecision } = policyEvaluator;
  const { serialiseApproval, listApprovals, buildApprovalSummary, createApprovalRequestForTask, markApprovalApproved, markApprovalDenied, markApprovalExpired, reconcileApprovalExpirations, findExistingApprovalForTask, publishTaskApprovalIfPending } = approvalEngine;
  const { createTask, getTaskById, appendTaskPhase, attachTaskToWorkView, completeTask, failTask, recoverTask, isRecoverableTask, supersedeOtherActiveTasks, compareTasksForDisplay, listTasks, getActiveTasks, getNextQueuedTask, getLatestFinishedTask, getLatestFailedTask, buildTaskSummary, serialiseTask, reconcileRuntimeState } = taskManager;
  const {
    buildOpenClawPluginSdkContractReview,
    buildOpenClawNativePluginContractRegistry,
    buildOpenClawNativePluginRegistryResponse,
    buildOpenClawFormalIntegrationReadiness,
    buildOpenClawNativePluginAdapterStatus,
    buildNativePluginManifestProfile,
    buildOpenClawToolCatalog,
    buildOpenClawPluginCapabilityPlan,
    buildOpenClawPluginCandidateContractTests,
    buildOpenClawPluginSearchWebAdapterContract,
    buildOpenClawPluginSearchWebAdapterTaskDraft,
    buildOpenClawPluginSearchWebAdapterRuntimePreflight,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft,
    createOpenClawPluginSearchWebAdapterTask,
    createOpenClawPluginSearchWebAdapterRuntimeActivationTask,
    createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask,
    buildWorkspaceRegistry,
    buildWorkspaceCommandProposals,
    buildOpenClawSourceCommandProposals,
    buildOpenClawMigrationMap,
    buildOpenClawMigrationPlan,
    buildOpenClawPluginSdkSourceReviewScope,
    buildOpenClawPluginSdkSourceContentReview,
    buildOpenClawPluginSdkNativeContractTests,
    buildOpenClawNativePluginSdkContractImplementation,
    buildNativeOpenClawToolCatalogProfile,
    buildOpenClawPluginManifestMap,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    selectReviewedPluginSdkPackage,
    selectOpenClawToolCatalogWorkspace,
  } = pluginReview;
  const { resolveOpenClawWorkspaceTarget, buildNativeOpenClawWorkspaceTextWriteDraft, createNativeOpenClawWorkspaceTextWriteTask, readBoundedWorkspaceTextFile, buildNativeOpenClawWorkspacePatchApplyDraft, createNativeOpenClawWorkspacePatchApplyTask, buildOpenClawSourceAuthoredEditDraft, createOpenClawSourceAuthoredEditTask, buildWorkspaceCommandPlanDraft, buildOpenClawSourceCommandPlanDraft, createWorkspaceCommandTask, createOpenClawSourceCommandTask } = workspaceOps;
  const { buildNativePluginCapabilityInvokePlan, buildNativePluginRuntimePreflight, buildNativePluginRuntimeActivationPlan, buildNativePluginRuntimeAdapterContract, buildNativePluginRuntimeAdapterTaskDraft, buildNativePluginRuntimeActivationTaskDraft, buildNativePluginInvokeTaskPlan, createNativePluginRuntimeActivationTask, createNativePluginRuntimeAdapterTask, createNativePluginInvokeTask, buildSystemdRepairExecutionTaskDraft, createSystemdRepairExecutionTask, createSystemdRepairCandidateTaskShell, createSystemdNextRepairTaskShell, createBodyEvidenceLedgerDirectoryTaskShell, createBodyEvidenceLedgerFirstRecordTaskShell, createBodyEvidenceLedgerFollowupRecordTaskShell, serialisePlanForPublic, buildRulePlan, shouldBuildPlan, updatePlanForPhase, buildCapabilityRegistry, listCapabilityInvocations, buildCapabilityInvocationSummary, invokeCapability, buildMvpRouteAlignment, buildPhase2RepairDemoStatus, buildPhase2NextRepairDemoStatus, buildBodyEvidenceLedgerFollowupRecordReadiness, buildBodyEvidenceLedgerFollowupRecordAppendRouteReview, buildBodyEvidenceLedgerFollowupRecordAppendReadiness, armBodyEvidenceLedgerFollowupRecordAppend, buildPhase2NextCapabilityRouteReview, buildPhase2DemoControlRoom, buildPhase2DemoWalkthrough, buildPhase2DemoReadinessExit, buildPhase2CompletionReadiness, buildPhase2Exit, buildPhase3Plan, buildPhase3BackgroundWorkView, buildPhase3OperatorInterruptControls, buildPhase3CompletionReadiness, buildPhase3Exit, buildPhase4Plan, buildPhase4SelfHealLoop, buildPhase4HealHistoryEvidence, buildPhase4CompletionReadiness, buildPhase4Exit, buildPhase5Plan, buildPhase5DeploymentInventory, buildPhase5RollbackReadiness, buildPhase5ReleaseControlReadiness, buildPhase5Exit, buildMvpFinalReadiness, buildPostMvpPlan, buildPhase6Plan, buildPhase6MemorySubstrateInventory, buildPhase6ConsciousnessContextEnvelope, buildPhase6TaskOrchestrationRecords, buildPhase6MemoryWriteRouteReview, buildPhase6Exit, buildLongTermMemoryWritePlan, buildLongTermMemorySchema, buildLongTermMemoryProposal, buildLongTermMemoryWriteRouteReview, createLongTermMemoryWriteTask, buildLongTermMemoryReadback, buildLongTermMemoryExit } = planBuilder;
  const {
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
    buildCloudConsciousnessLiveProviderCallExecutionPlan,
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding,
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema,
    buildCloudConsciousnessLiveProviderExecutionRouteReview,
    createCloudConsciousnessLiveProviderExecutionPlanTask,
    buildCloudConsciousnessLiveProviderExecutionPlanReadback,
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan,
    createCloudConsciousnessLiveProviderRuntimeAdapterTask,
    buildCloudConsciousnessLiveProviderRuntimeAdapterExit,
    buildCloudConsciousnessLiveProviderCallFinalAuthorization,
    buildCloudConsciousnessLiveProviderCallOperatorLaunchReview,
    buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
    createCloudConsciousnessLiveProviderRuntimeImplementationTask,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation,
    buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract,
    buildCloudConsciousnessLiveProviderRequestBuilder,
    buildCloudConsciousnessLiveProviderCredentialReferenceResolver,
    buildCloudConsciousnessLiveProviderNoNetworkSender,
    buildCloudConsciousnessLiveProviderEgressTranscriptRecorder,
    buildCloudConsciousnessLiveProviderResponseVerifier,
    buildCloudConsciousnessLiveProviderRollbackNote,
    buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion,
    buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit,
    buildCloudConsciousnessLiveProviderRealLaunchRouteReview,
    createCloudConsciousnessLiveProviderRealLaunchTask,
    buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight,
    recordCloudConsciousnessLiveProviderRealLaunchExecutionPreflight,
    buildCloudConsciousnessLiveProviderCredentialValueAccessGate,
    recordCloudConsciousnessLiveProviderCredentialValueAccessGate,
    buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate,
    recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate,
    buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight,
    recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight,
    createCloudConsciousnessLiveProviderEgressExecutionTask,
    buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred,
    buildCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute,
    createCloudConsciousnessLiveProviderCredentialValueAuthorizationTask,
    buildCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred,
    buildCloudConsciousnessLiveProviderCredentialValueReadinessPreflight,
    recordCloudConsciousnessLiveProviderCredentialValueReadinessPreflight,
    createCloudConsciousnessLiveProviderCredentialValueReadTask,
    buildCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred,
    buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute,
    createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask,
    buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred,
    buildCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight,
    recordCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight,
    createCloudConsciousnessLiveProviderNoNetworkSenderTask,
    createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask,
    createCloudConsciousnessLiveProviderResponseVerifierTask,
    createCloudConsciousnessLiveProviderRollbackNoteTask,
    createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask,
    createCloudConsciousnessLiveProviderCredentialReferenceResolverTask,
    createCloudConsciousnessLiveProviderRequestBuilderTask,
    createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
  } = planBuilder;
  const { executeTask, executeTaskWithRecovery, serialiseExecutionResult, listCommandTranscriptRecords, buildCommandTranscriptSummary, serialiseCommandTranscriptSummary, listFilesystemChangeRecords, buildFilesystemChangeSummary, serialiseFilesystemChangeSummary, listFilesystemReadRecords, buildFilesystemReadSummary, serialiseFilesystemReadSummary, buildOperatorState, buildOperatorOptions, runOperatorStep, runOperatorLoop } = executor;

  return async function handleRequest(req, res, requestUrl) {
    // ---- Generic Proxy Routing for observer-ui ----
    if (requestUrl.pathname.startsWith("/proxy/")) {
      const parts = requestUrl.pathname.split("/");
      const targetService = parts[2]; // e.g. "session-manager"
      const subpath = "/" + parts.slice(3).join("/"); // e.g. "/work-view/prepare"
      
      let targetUrlBase = null;
      if (targetService === "session-manager") targetUrlBase = sessionManagerUrl;
      else if (targetService === "event-hub") targetUrlBase = eventHubUrl;
      else if (targetService === "system-heal") targetUrlBase = systemHealUrl;
      else if (targetService === "screen-sense") targetUrlBase = screenSenseUrl;
      else if (targetService === "screen-act") targetUrlBase = screenActUrl;
      else if (targetService === "system-sense") targetUrlBase = systemSenseUrl;

      if (targetUrlBase) {
        try {
          if (req.method === "POST" || req.method === "PUT") {
            const body = await readJsonBody(req);
            const result = await postJson(`${targetUrlBase}${subpath}`, body);
            sendJson(res, 200, result);
          } else {
            const result = await fetchJson(`${targetUrlBase}${subpath}`);
            sendJson(res, 200, result);
          }
          return;
        } catch (error) {
          sendJson(res, 502, { ok: false, error: `Proxy failed: ${error.message}` });
          return;
        }
      }
    }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "openclaw-core",
      stage: "active",
      host,
      port,
      eventHubUrl,
      sessionManagerUrl,
      browserRuntimeUrl,
      screenSenseUrl,
      screenActUrl,
      systemSenseUrl,
      systemHealUrl,
      stateFilePath,
      autonomyMode,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/mvp/route") {
    sendJson(res, 200, buildMvpRouteAlignment());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/repair-demo-status") {
    sendJson(res, 200, buildPhase2RepairDemoStatus());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/next-repair-demo-status") {
    sendJson(res, 200, buildPhase2NextRepairDemoStatus());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/body-evidence-ledger-followup-record-readiness") {
    sendJson(res, 200, buildBodyEvidenceLedgerFollowupRecordReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/body-evidence-ledger-followup-record-append-route-review") {
    sendJson(res, 200, await buildBodyEvidenceLedgerFollowupRecordAppendRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/body-evidence-ledger-followup-record-append-readiness") {
    sendJson(res, 200, buildBodyEvidenceLedgerFollowupRecordAppendReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-control-room") {
    sendJson(res, 200, await buildPhase2DemoControlRoom());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-walkthrough") {
    sendJson(res, 200, await buildPhase2DemoWalkthrough());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-readiness-exit") {
    sendJson(res, 200, await buildPhase2DemoReadinessExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/next-capability-route-review") {
    sendJson(res, 200, await buildPhase2NextCapabilityRouteReview({
      ledgerDemoStatusCheckpointComplete: requestUrl.searchParams.get("afterLedgerDemoStatus") === "true",
      repairCandidateDemoCheckpointComplete: requestUrl.searchParams.get("afterRepairCandidateDemoStatus") === "true",
    }));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/completion-readiness") {
    sendJson(res, 200, await buildPhase2CompletionReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/exit") {
    sendJson(res, 200, await buildPhase2Exit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-3/plan") {
    sendJson(res, 200, await buildPhase3Plan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-3/background-work-view") {
    sendJson(res, 200, await buildPhase3BackgroundWorkView());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-3/operator-interrupt-controls") {
    sendJson(res, 200, await buildPhase3OperatorInterruptControls());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-3/completion-readiness") {
    sendJson(res, 200, await buildPhase3CompletionReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-3/exit") {
    sendJson(res, 200, await buildPhase3Exit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-4/plan") {
    sendJson(res, 200, await buildPhase4Plan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-4/self-heal-loop") {
    sendJson(res, 200, await buildPhase4SelfHealLoop());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-4/heal-history-evidence") {
    sendJson(res, 200, await buildPhase4HealHistoryEvidence());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-4/completion-readiness") {
    sendJson(res, 200, await buildPhase4CompletionReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-4/exit") {
    sendJson(res, 200, await buildPhase4Exit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-5/plan") {
    sendJson(res, 200, await buildPhase5Plan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-5/deployment-inventory") {
    sendJson(res, 200, await buildPhase5DeploymentInventory());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-5/rollback-readiness") {
    sendJson(res, 200, await buildPhase5RollbackReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-5/release-control-readiness") {
    sendJson(res, 200, await buildPhase5ReleaseControlReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-5/exit") {
    sendJson(res, 200, await buildPhase5Exit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/mvp/final-readiness") {
    sendJson(res, 200, await buildMvpFinalReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/post-mvp/plan") {
    sendJson(res, 200, await buildPostMvpPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/plan") {
    sendJson(res, 200, await buildPhase6Plan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/memory-substrate-inventory") {
    sendJson(res, 200, await buildPhase6MemorySubstrateInventory());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/consciousness-context-envelope") {
    sendJson(res, 200, await buildPhase6ConsciousnessContextEnvelope());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/task-orchestration-records") {
    sendJson(res, 200, await buildPhase6TaskOrchestrationRecords());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/memory-write-route-review") {
    sendJson(res, 200, await buildPhase6MemoryWriteRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-6/exit") {
    sendJson(res, 200, await buildPhase6Exit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/write-plan") {
    sendJson(res, 200, await buildLongTermMemoryWritePlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/schema") {
    sendJson(res, 200, await buildLongTermMemorySchema());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/proposal") {
    sendJson(res, 200, await buildLongTermMemoryProposal());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/write-route-review") {
    sendJson(res, 200, await buildLongTermMemoryWriteRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/readback") {
    sendJson(res, 200, buildLongTermMemoryReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/long-term-memory/exit") {
    sendJson(res, 200, await buildLongTermMemoryExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/context-review") {
    sendJson(res, 200, await buildCloudConsciousnessContextReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/envelope-schema") {
    sendJson(res, 200, await buildCloudConsciousnessEnvelopeSchema());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/context-package") {
    sendJson(res, 200, await buildCloudConsciousnessContextPackage());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/redaction-review") {
    sendJson(res, 200, await buildCloudConsciousnessRedactionReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/transmission-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessTransmissionRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/handoff-readback") {
    sendJson(res, 200, buildCloudConsciousnessHandoffReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/exit") {
    sendJson(res, 200, await buildCloudConsciousnessExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-adapter-plan") {
    sendJson(res, 200, await buildCloudConsciousnessProviderAdapterPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-contract") {
    sendJson(res, 200, await buildCloudConsciousnessProviderContract());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-request-envelope") {
    sendJson(res, 200, await buildCloudConsciousnessProviderRequestEnvelope());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-dry-run-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessProviderDryRunRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-dry-run-readback") {
    sendJson(res, 200, buildCloudConsciousnessProviderDryRunReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-adapter-exit") {
    sendJson(res, 200, await buildCloudConsciousnessProviderAdapterExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/real-provider-call-plan") {
    sendJson(res, 200, await buildCloudConsciousnessRealProviderCallPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-egress-contract") {
    sendJson(res, 200, await buildCloudConsciousnessProviderEgressContract());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-credential-preflight") {
    sendJson(res, 200, await buildCloudConsciousnessProviderCredentialPreflight());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-request-redaction-review") {
    sendJson(res, 200, await buildCloudConsciousnessProviderRequestRedactionReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/real-provider-call-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessRealProviderCallRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/provider-response-readback") {
    sendJson(res, 200, buildCloudConsciousnessProviderResponseReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/real-provider-call-exit") {
    sendJson(res, 200, await buildCloudConsciousnessRealProviderCallExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-runbook") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallRunbook());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-operator-checklist") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderOperatorChecklist());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-transcript-schema") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEgressTranscriptSchema());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-final-authorization-review") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderFinalAuthorizationReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runbook-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRunbookRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runbook-readback") {
    sendJson(res, 200, buildCloudConsciousnessLiveProviderRunbookReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-runbook-exit") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallRunbookExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-execution-plan") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallExecutionPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-endpoint-credential-binding") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEndpointCredentialBinding());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-execution-transcript-schema") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderExecutionTranscriptSchema());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-execution-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderExecutionRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-execution-plan-readback") {
    sendJson(res, 200, buildCloudConsciousnessLiveProviderExecutionPlanReadback());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-execution-plan-exit") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallExecutionPlanExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-runtime-adapter-plan") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-exit") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRuntimeAdapterExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-final-authorization") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallFinalAuthorization());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-operator-launch-review") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallOperatorLaunchReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-runtime-implementation-plan") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-call-runtime-adapter-implementation") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-module-contract") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-request-builder") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRequestBuilder());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-reference-resolver") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialReferenceResolver());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-no-network-sender") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderNoNetworkSender());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-transcript-recorder") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEgressTranscriptRecorder());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-response-verifier") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderResponseVerifier());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-rollback-note") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRollbackNote());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-completion") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-closure-exit") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-real-launch-route-review") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRealLaunchRouteReview());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-real-launch-execution-preflight") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-access-gate") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueAccessGate());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-endpoint-network-egress-gate") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-execution-route-task-preflight") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-execution-approved-deferred") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-authorization-route") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-authorization-approved-deferred") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-readiness-preflight") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueReadinessPreflight());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-read-approved-deferred") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-access-authorization-route") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-access-authorization-approved-deferred") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-final-readiness-preflight") {
    sendJson(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight());
    return;
  }

  reconcileApprovalExpirations();

  if (req.method === "GET" && requestUrl.pathname === "/state/runtime") {
    reconcileRuntimeState();
    sendJson(res, 200, {
      runtime: runtimeState,
      taskCount: tasks.size,
      currentTask: runtimeState.currentTaskId ? serialiseTask(getTaskById(runtimeState.currentTaskId)) : null,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/summary") {
    reconcileRuntimeState();
    sendJson(res, 200, {
      ok: true,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/active") {
    reconcileRuntimeState();
    const activeTasks = getActiveTasks();
    sendJson(res, 200, {
      ok: true,
      count: activeTasks.length,
      items: activeTasks.map((task) => serialiseTask(task)),
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/operator/state") {
    sendJson(res, 200, {
      ok: true,
      operator: buildOperatorState(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/policy/state") {
    sendJson(res, 200, {
      ok: true,
      policy: buildPolicyState(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces") {
    sendJson(res, 200, {
      ok: true,
      ...buildWorkspaceRegistry(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/summary") {
    const registry = buildWorkspaceRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      roots: registry.roots,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals") {
    sendJson(res, 200, {
      ok: true,
      ...buildWorkspaceCommandProposals(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals/summary") {
    const proposals = buildWorkspaceCommandProposals();
    sendJson(res, 200, {
      ok: true,
      registry: proposals.registry,
      mode: proposals.mode,
      generatedAt: proposals.generatedAt,
      roots: proposals.roots,
      summary: proposals.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals") {
    try {
      sendJson(res, 200, {
        ok: true,
        ...buildOpenClawSourceCommandProposals({
          workspacePath: requestUrl.searchParams.get("workspacePath"),
          query: requestUrl.searchParams.get("query") ?? "command",
          limit: requestUrl.searchParams.get("limit") ?? "12",
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-map") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawMigrationMap(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-map/summary") {
    const map = buildOpenClawMigrationMap();
    sendJson(res, 200, {
      ok: true,
      registry: map.registry,
      mode: map.mode,
      generatedAt: map.generatedAt,
      sourceRegistry: map.sourceRegistry,
      roots: map.roots,
      summary: map.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-plan") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawMigrationPlan(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-plan/summary") {
    const plan = buildOpenClawMigrationPlan();
    sendJson(res, 200, {
      ok: true,
      registry: plan.registry,
      mode: plan.mode,
      generatedAt: plan.generatedAt,
      sourceRegistry: plan.sourceRegistry,
      roots: plan.roots,
      summary: plan.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-contract-review") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawPluginSdkContractReview(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-contract-review/summary") {
    const review = buildOpenClawPluginSdkContractReview();
    sendJson(res, 200, {
      ok: true,
      registry: review.registry,
      mode: review.mode,
      generatedAt: review.generatedAt,
      sourceRegistry: review.sourceRegistry,
      roots: review.roots,
      summary: review.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-review-scope") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkSourceReviewScope({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-review-scope/summary") {
    try {
      const scope = buildOpenClawPluginSdkSourceReviewScope({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: true,
        registry: scope.registry,
        mode: scope.mode,
        generatedAt: scope.generatedAt,
        sourceRegistry: scope.sourceRegistry,
        sourceMode: scope.sourceMode,
        summary: scope.summary,
        governance: scope.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-content-review") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkSourceContentReview({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-content-review/summary") {
    try {
      const review = buildOpenClawPluginSdkSourceContentReview({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: true,
        registry: review.registry,
        mode: review.mode,
        generatedAt: review.generatedAt,
        sourceRegistry: review.sourceRegistry,
        sourceMode: review.sourceMode,
        summary: review.summary,
        governance: review.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-native-contract-tests") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkNativeContractTests({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-native-contract-tests/summary") {
    try {
      const report = buildOpenClawPluginSdkNativeContractTests({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: report.ok,
        registry: report.registry,
        mode: report.mode,
        generatedAt: report.generatedAt,
        sourceRegistries: report.sourceRegistries,
        summary: report.summary,
        governance: report.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-sdk-contract-implementation") {
    try {
      sendJson(res, 200, buildOpenClawNativePluginSdkContractImplementation({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-sdk-contract-implementation/summary") {
    try {
      const implementation = buildOpenClawNativePluginSdkContractImplementation({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: implementation.ok,
        registry: implementation.registry,
        mode: implementation.mode,
        generatedAt: implementation.generatedAt,
        sourceRegistries: implementation.sourceRegistries,
        summary: implementation.summary,
        governance: implementation.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-tool-catalog") {
    try {
      sendJson(res, 200, buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-tool-catalog/summary") {
    try {
      const catalog = buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      });
      sendJson(res, 200, {
        ok: catalog.ok,
        registry: catalog.registry,
        mode: catalog.mode,
        generatedAt: catalog.generatedAt,
        sourceRegistries: catalog.sourceRegistries,
        capability: catalog.capability,
        summary: catalog.summary,
        governance: catalog.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-plugin-manifest-map") {
    try {
      sendJson(res, 200, buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-plugin-manifest-map/summary") {
    try {
      const manifestMap = buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      });
      sendJson(res, 200, {
        ok: manifestMap.ok,
        registry: manifestMap.registry,
        mode: manifestMap.mode,
        generatedAt: manifestMap.generatedAt,
        sourceRegistries: manifestMap.sourceRegistries,
        capability: manifestMap.capability,
        summary: manifestMap.summary,
        governance: manifestMap.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-contract") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawNativePluginContractRegistry(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-contract/summary") {
    const registry = buildOpenClawNativePluginContractRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      sourceRegistry: registry.sourceRegistry,
      sourceMode: registry.sourceMode,
      summary: registry.summary,
      validation: registry.validation,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-registry") {
    sendJson(res, 200, buildOpenClawNativePluginRegistryResponse());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-registry/summary") {
    const registry = buildOpenClawNativePluginRegistryResponse();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      runtimeOwner: registry.runtimeOwner,
      activationMode: registry.activationMode,
      generatedAt: registry.generatedAt,
      validation: registry.validation,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-formal-integration-readiness") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawFormalIntegrationReadiness(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-formal-integration-readiness/summary") {
    const readiness = buildOpenClawFormalIntegrationReadiness();
    sendJson(res, 200, {
      ok: true,
      registry: readiness.registry,
      mode: readiness.mode,
      generatedAt: readiness.generatedAt,
      sourceRegistries: readiness.sourceRegistries,
      status: readiness.status,
      readyForFormalIntegration: readiness.readyForFormalIntegration,
      summary: readiness.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-adapter") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawNativePluginAdapterStatus(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/manifest-profile") {
    try {
      sendJson(res, 200, buildNativePluginManifestProfile({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/tool-catalog") {
    try {
      sendJson(res, 200, buildNativeOpenClawToolCatalogProfile({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-manifest-map") {
    try {
      sendJson(res, 200, buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-capability-plan") {
    try {
      sendJson(res, 200, buildOpenClawPluginCapabilityPlan({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-candidate-contract-tests") {
    try {
      sendJson(res, 200, buildOpenClawPluginCandidateContractTests({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category") ?? "search_and_web",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-contract") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterContract({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "openclaw native integration",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimePreflight({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterRuntimeActivationTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-semantic-index") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceSemanticIndex({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-symbol-lookup") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceSymbolLookup({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "tool",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-edit-target-selection") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceEditTargetSelection({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "edit",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/prompt-semantics") {
    try {
      sendJson(res, 200, buildNativeOpenClawPromptSemanticsProfile({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "edit",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write/draft") {
    try {
      const draft = buildNativeOpenClawWorkspaceTextWriteDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        relativePath: requestUrl.searchParams.get("relativePath") ?? "scratch/native-write.txt",
        content: "hello from openclaw native workspace text write\n",
        overwrite: requestUrl.searchParams.get("overwrite") !== "false",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativeOpenClawWorkspaceTextWriteTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        relativePath: typeof body.relativePath === "string" ? body.relativePath : "scratch/native-write.txt",
        content: typeof body.content === "string" ? body.content : "",
        overwrite: body.overwrite !== false,
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply/draft") {
    try {
      const editsParam = requestUrl.searchParams.get("edits");
      const edits = editsParam ? JSON.parse(editsParam) : null;
      const proposalParam = requestUrl.searchParams.get("proposal");
      const proposal = proposalParam ? JSON.parse(proposalParam) : null;
      const selectTargetFromSource = requestUrl.searchParams.get("selectTargetFromSource") === "true";
      const draft = buildNativeOpenClawWorkspacePatchApplyDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        relativePath: requestUrl.searchParams.get("relativePath") ?? null,
        search: requestUrl.searchParams.get("search") ?? "before",
        replacement: requestUrl.searchParams.get("replacement") ?? "after",
        occurrence: Number.parseInt(requestUrl.searchParams.get("occurrence") ?? "1", 10),
        edits,
        contextLines: Number.parseInt(requestUrl.searchParams.get("contextLines") ?? "1", 10),
        proposal,
        deriveProposalFromSource: requestUrl.searchParams.get("deriveProposalFromSource") === "true",
        proposalQuery: requestUrl.searchParams.get("proposalQuery") ?? "edit",
        selectTargetFromSource,
        targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativeOpenClawWorkspacePatchApplyTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        relativePath: typeof body.relativePath === "string" ? body.relativePath : null,
        search: typeof body.search === "string" ? body.search : "",
        replacement: typeof body.replacement === "string" ? body.replacement : "",
        occurrence: Number.isInteger(body.occurrence) ? body.occurrence : 1,
        edits: Array.isArray(body.edits) ? body.edits : null,
        contextLines: Number.isInteger(body.contextLines) ? body.contextLines : 1,
        proposal: body.proposal && typeof body.proposal === "object" ? body.proposal : null,
        deriveProposalFromSource: body.deriveProposalFromSource === true,
        proposalQuery: typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        selectTargetFromSource: body.selectTargetFromSource === true,
        targetSelectionQuery: typeof body.targetSelectionQuery === "string" ? body.targetSelectionQuery : typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionScope: typeof body.targetSelectionScope === "string" ? body.targetSelectionScope : "tools",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        validation: result.validation,
        proposal: result.proposal,
        proposalSourceSignals: result.proposalSourceSignals,
        targetSelection: result.targetSelection,
        edits: result.edits,
        diffPreview: result.diffPreview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit/draft") {
    try {
      const editsParam = requestUrl.searchParams.get("edits");
      const edits = editsParam ? JSON.parse(editsParam) : null;
      const draft = buildOpenClawSourceAuthoredEditDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        search: requestUrl.searchParams.get("search") ?? "before",
        replacement: requestUrl.searchParams.get("replacement") ?? "after",
        occurrence: Number.parseInt(requestUrl.searchParams.get("occurrence") ?? "1", 10),
        edits,
        contextLines: Number.parseInt(requestUrl.searchParams.get("contextLines") ?? "0", 10),
        proposalQuery: requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawSourceAuthoredEditTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        search: typeof body.search === "string" ? body.search : "",
        replacement: typeof body.replacement === "string" ? body.replacement : "",
        occurrence: Number.isInteger(body.occurrence) ? body.occurrence : 1,
        edits: Array.isArray(body.edits) ? body.edits : null,
        contextLines: Number.isInteger(body.contextLines) ? body.contextLines : 0,
        proposalQuery: typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionQuery: typeof body.targetSelectionQuery === "string" ? body.targetSelectionQuery : typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionScope: typeof body.targetSelectionScope === "string" ? body.targetSelectionScope : "tools",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceAuthoredEdit: result.sourceAuthoredEdit,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        validation: result.validation,
        proposal: result.proposal,
        proposalSourceSignals: result.proposalSourceSignals,
        targetSelection: result.targetSelection,
        edits: result.edits,
        diffPreview: result.diffPreview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/invoke-plan") {
    try {
      sendJson(res, 200, {
        ok: true,
        ...buildNativePluginCapabilityInvokePlan({
          packagePath: requestUrl.searchParams.get("packagePath"),
          capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-preflight") {
    try {
      sendJson(res, 200, buildNativePluginRuntimePreflight({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-plan") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeActivationPlan({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-contract") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeAdapterContract({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-task-draft") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeAdapterTaskDraft({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-task-draft") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeActivationTaskDraft({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/invoke-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginInvokeTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginRuntimeAdapterTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        adapterContract: result.adapterContract,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginRuntimeActivationTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        activationPlan: result.activationPlan,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals/plan") {
    try {
      const draft = buildWorkspaceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/plan") {
    try {
      const draft = buildOpenClawSourceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? "command",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawSourceCommandTask({
        proposalId: typeof body.proposalId === "string" ? body.proposalId : null,
        workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
        scriptName: typeof body.scriptName === "string" ? body.scriptName : null,
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        query: typeof body.query === "string" ? body.query : "command",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        sourceCommandProposal: result.sourceCommandProposal,
        sourceCommandSignals: result.sourceCommandSignals,
        sourceCommandPlan: result.sourceCommandPlan,
        sourceCommandTask: result.sourceCommandTask,
        workspaceCommandTask: result.workspaceCommandTask,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/workspaces/command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createWorkspaceCommandTask({
        proposalId: typeof body.proposalId === "string" ? body.proposalId : null,
        workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
        scriptName: typeof body.scriptName === "string" ? body.scriptName : null,
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        proposal: result.proposal,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-execution-task-draft") {
    try {
      const result = await buildSystemdRepairExecutionTaskDraft({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        execute: requestUrl.searchParams.get("execute") === "true",
      });
      sendJson(res, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/repair-execution-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdRepairExecutionTask({
        unit: typeof body.unit === "string" ? body.unit : null,
        confirm: body.confirm === true,
        execute: body.execute === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        target: result.target,
        repairPlan: result.repairPlan,
        dryRunEnvelope: result.dryRunEnvelope,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/repair-candidate-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdRepairCandidateTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeGate: result.routeGate,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/next-repair-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdNextRepairTaskShell({
        confirm: body.confirm === true,
        execute: body.execute === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeGate: result.routeGate,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/directory-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerDirectoryTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        ledgerDirectory: result.ledgerDirectory,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/first-record-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerFirstRecordTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        firstRecord: result.firstRecord,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/followup-record-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerFollowupRecordTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        followupRecord: result.followupRecord,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/followup-record-append") {
    try {
      const body = await readJsonBody(req);
      const result = await armBodyEvidenceLedgerFollowupRecordAppend({
        confirm: body.confirm === true,
        taskId: typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null,
      });
      sendJson(res, 200, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        routeReview: result.routeReview,
        task: serialiseTask(result.task),
        approval: result.approval ? serialiseApproval(result.approval) : null,
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/long-term-memory/write-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createLongTermMemoryWriteTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        proposal: result.proposal,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/handoff-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessHandoffTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        contextPackage: result.contextPackage,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/provider-dry-run-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessProviderDryRunTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        envelope: result.envelope,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/real-provider-call-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessProviderCallRehearsalTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        requestEnvelope: result.requestEnvelope,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runbook-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRunbookTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        authorizationReview: result.authorizationReview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-execution-plan-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderExecutionPlanTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        transcriptSchema: result.transcriptSchema,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRuntimeAdapterTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        adapterPlan: result.adapterPlan,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-implementation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRuntimeImplementationTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        implementationPlan: result.implementationPlan,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-implementation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        adapterImplementation: result.adapterImplementation,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-module-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        moduleContract: result.moduleContract,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-request-builder-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRequestBuilderTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        requestBuilder: result.requestBuilder,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-reference-resolver-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderCredentialReferenceResolverTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        credentialResolver: result.credentialResolver,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-no-network-sender-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderNoNetworkSenderTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        noNetworkSender: result.noNetworkSender,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-transcript-recorder-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        transcriptRecorder: result.transcriptRecorder,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-response-verifier-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderResponseVerifierTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        responseVerifier: result.responseVerifier,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-rollback-note-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRollbackNoteTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        rollbackNote: result.rollbackNote,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-runtime-adapter-closure-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        completion: result.completion,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-real-launch-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderRealLaunchTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-real-launch-execution-preflight") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderRealLaunchExecutionPreflight({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        preflight: result.preflight,
        task: serialiseTask(result.task),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-access-gate") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderCredentialValueAccessGate({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        gate: result.gate,
        task: serialiseTask(result.task),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-endpoint-network-egress-gate") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        gate: result.gate,
        task: serialiseTask(result.task),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-execution-route-task-preflight") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        preflight: result.preflight,
        task: serialiseTask(result.task),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-egress-execution-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderEgressExecutionTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceTaskId: result.sourceTaskId,
        preflight: result.preflight,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-readiness-preflight") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderCredentialValueReadinessPreflight({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        preflight: result.preflight,
        task: serialiseTask(result.task),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-final-readiness-preflight") {
    try {
      const body = await readJsonBody(req);
      const result = await recordCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        status: result.status,
        preflight: result.preflight,
        task: result.task,
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-authorization-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderCredentialValueAuthorizationTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        route: result.route,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-read-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderCredentialValueReadTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        preflight: result.preflight,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/cloud-consciousness/live-provider-credential-value-access-authorization-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        route: result.route,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities") {
    const registry = await buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      ...registry,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/summary") {
    const registry = await buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/refresh") {
    const registry = await buildCapabilityRegistry();
    await publishEvent("capability.updated", {
      registry: registry.registry,
      summary: registry.summary,
    });
    sendJson(res, 200, {
      ok: true,
      refreshed: true,
      ...registry,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/invocations") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const capabilityId = requestUrl.searchParams.get("capabilityId") ?? null;
    sendJson(res, 200, {
      ok: true,
      count: capabilityInvocationLog.length,
      items: listCapabilityInvocations({
        limit: Number.isNaN(limit) ? 20 : limit,
        capabilityId,
      }),
      summary: buildCapabilityInvocationSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/invocations/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: buildCapabilityInvocationSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/commands/transcripts") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listCommandTranscriptRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseCommandTranscriptSummary(buildCommandTranscriptSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/commands/transcripts/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseCommandTranscriptSummary(buildCommandTranscriptSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/changes") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listFilesystemChangeRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseFilesystemChangeSummary(buildFilesystemChangeSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/changes/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseFilesystemChangeSummary(buildFilesystemChangeSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/reads") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listFilesystemReadRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseFilesystemReadSummary(buildFilesystemReadSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/reads/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseFilesystemReadSummary(buildFilesystemReadSummary()),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/invoke") {
    try {
      const body = await readJsonBody(req);
      const invocation = await invokeCapability(body);
      sendJson(res, invocation.statusCode, invocation.response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/policy/evaluate") {
    try {
      const body = await readJsonBody(req);
      const decision = recordPolicyDecision(evaluatePolicyIntent(body, { stage: "policy.evaluate" }));
      await publishEvent("policy.evaluated", { policy: decision });
      sendJson(res, 200, {
        ok: true,
        policy: decision,
        state: buildPolicyState(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/approvals") {
    const status = requestUrl.searchParams.get("status") || null;
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listApprovals()
      .filter((approval) => !status || approval.status === status)
      .slice(0, safeLimit);
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: buildApprovalSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/approvals/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: buildApprovalSummary(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/approve")) {
    const approvalId = requestUrl.pathname.slice("/approvals/".length, -"/approve".length);
    const approval = approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = markApprovalApproved(approval, {
        approvedBy: typeof body.approvedBy === "string" && body.approvedBy.trim() ? body.approvedBy.trim() : "user",
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Approved by user.",
      });
      await publishEvent("approval.approved", {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/deny")) {
    const approvalId = requestUrl.pathname.slice("/approvals/".length, -"/deny".length);
    const approval = approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = markApprovalDenied(approval, {
        deniedBy: typeof body.deniedBy === "string" && body.deniedBy.trim() ? body.deniedBy.trim() : "user",
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Denied by user.",
      });
      await publishEvent("approval.denied", {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      if (result.task?.status === "failed") {
        await publishEvent("task.failed", {
          task: serialiseTask(result.task),
          reason: "Approval denied by user.",
          approval: serialiseApproval(result.approval),
        });
      }
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/current") {
    reconcileRuntimeState();
    const task = getCurrentTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "current-task",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-finished") {
    reconcileRuntimeState();
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-finished",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-failed") {
    reconcileRuntimeState();
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-failed",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "10", 10);
    const safeLimit = Number.isNaN(limit) ? 10 : Math.max(1, Math.min(limit, 50));
    sendJson(res, 200, {
      ok: true,
      count: tasks.size,
      items: listTasks().slice(0, safeLimit),
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-finished") {
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-failed") {
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(body);
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task) });
      await publishTaskApprovalIfPending(task);
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, { ok: true, task: serialiseTask(task) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/step") {
    try {
      const body = await readJsonBody(req);
      const step = await runOperatorStep(body);
      sendJson(res, 200, {
        ok: true,
        ran: step.ran,
        blocked: step.blocked ?? false,
        reason: step.reason ?? null,
        dryRun: step.dryRun ?? false,
        task: step.task ? serialiseTask(step.task) : null,
        execution: step.execution ? serialiseExecutionResult(step.execution) : null,
        policy: step.policy ?? step.task?.policy?.decision ?? null,
        approval: step.approval ?? step.task?.approval ?? null,
        operator: step.operator ?? buildOperatorState(),
        summary: step.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/run") {
    try {
      const body = await readJsonBody(req);
      const result = await runOperatorLoop(body);
      sendJson(res, 200, {
        ok: true,
        ran: result.ran,
        count: result.steps.length,
        blocked: result.blocked ?? false,
        reason: result.reason ?? null,
        dryRun: result.dryRun ?? false,
        nextTask: result.nextTask ? serialiseTask(result.nextTask) : null,
        steps: result.steps.map((step) => ({
          task: step.task ? serialiseTask(step.task) : null,
          execution: step.execution ? serialiseExecutionResult(step.execution) : null,
          policy: step.policy ?? step.task?.policy?.decision ?? null,
        })),
        operator: result.operator ?? buildOperatorState(),
        summary: result.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Plan work for ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
        includePlan: true,
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(task),
        plan: serialisePlanForPublic(task.plan),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Plan and execute work for ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
        includePlan: true,
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));

      const executionResult = await executeTaskWithRecovery(task, {
        ...body,
        actions: Array.isArray(body.actions) ? body.actions : task.plan?.steps
          ?.filter((step) => step.phase === "acting_on_target")
          .map((step) => ({ kind: step.kind, params: step.params ?? {} })),
      });
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        plan: serialisePlanForPublic(execution.task.plan),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Open the AI work view at ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), executor: "core-v1" });
      await publishTaskApprovalIfPending(task);
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));

      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/recover")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/recover".length);
    const sourceTask = getTaskById(taskId);
    if (!sourceTask) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    if (!isRecoverableTask(sourceTask)) {
      sendJson(res, 409, { ok: false, error: "Task is not recoverable." });
      return;
    }

    if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
      sendJson(res, 409, {
        ok: false,
        error: "Task already has a recovery task.",
        recoveredByTaskId: sourceTask.recoveredByTaskId,
        recoveredTask: serialiseTask(tasks.get(sourceTask.recoveredByTaskId)),
      });
      return;
    }

    try {
      const recoveredTask = recoverTask(sourceTask);
      const reclaimedTasks = supersedeOtherActiveTasks(recoveredTask.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(recoveredTask) });
      await publishTaskApprovalIfPending(recoveredTask);
      await publishEvent("task.recovered", {
        task: serialiseTask(recoveredTask),
        recoveredFromTaskId: sourceTask.id,
      });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(recoveredTask),
        recoveredFromTask: serialiseTask(sourceTask),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/execute")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/execute".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/tasks/")) {
    const taskPath = requestUrl.pathname.slice("/tasks/".length);
    const [taskId] = taskPath.split("/");
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    sendJson(res, 200, { ok: true, task: serialiseTask(task) });
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/phase")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/phase".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const phase = typeof body.phase === "string" ? body.phase.trim() : "";
      if (!phase) {
        sendJson(res, 400, { ok: false, error: "Task phase is required." });
        return;
      }

      if (typeof body.status === "string" && body.status.trim()) {
        // N-1: Validate status against the allowed enum before writing to the task.
        // Without this check, any string could bypass the state machine.
        const VALID_TASK_STATUSES = new Set([
          "queued", "running", "paused", "completed", "failed", "superseded",
        ]);
        const requestedStatus = body.status.trim();
        if (!VALID_TASK_STATUSES.has(requestedStatus)) {
          sendJson(res, 400, { ok: false, error: `Invalid task status: "${requestedStatus}". Allowed: ${[...VALID_TASK_STATUSES].join(", ")}.` });
          return;
        }
        task.status = requestedStatus;
      }

      const updatedTask = appendTaskPhase(task, phase, body.details ?? null);
      reconcileRuntimeState();

      await publishEvent("task.phase_changed", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/attach-work-view")
  ) {
    const taskId = requestUrl.pathname
      .slice("/tasks/".length, -"/attach-work-view".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = attachTaskToWorkView(task, body);
      await publishEvent("task.running", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/complete")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/complete".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = completeTask(task, body.details ?? null);
      await publishEvent("task.completed", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/pause") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to pause." });
      return;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return;
    }

    task.status = "paused";
    appendTaskPhase(task, "paused", { reason: "Paused by operator." });
    reconcileRuntimeState();

    await publishEvent("task.paused", { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/resume") {
    const task = getCurrentTask()
      ?? [...tasks.values()].filter((candidate) => candidate.status === "paused").sort(compareTasksForDisplay)[0]
      ?? null;

    if (!task || task.status !== "paused") {
      sendJson(res, 409, { ok: false, error: "No paused task to resume." });
      return;
    }

    task.status = "queued";
    appendTaskPhase(task, "resumed", { reason: "Resumed by operator." });
    reconcileRuntimeState();

    await publishEvent("task.resumed", { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/takeover") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to take over." });
      return;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return;
    }

    const now = new Date().toISOString();
    task.status = "paused";
    task.operatorTakeover = {
      status: "operator_controlled",
      requestedAt: now,
      reason: "Taken over by operator.",
      resumesThrough: "/control/resume",
      stopsThrough: "/control/stop",
    };
    task.workView = {
      ...(task.workView ?? {}),
      visibility: "visible",
      mode: "operator-takeover",
    };
    appendTaskPhase(task, "operator_takeover", { reason: "Taken over by operator." });
    reconcileRuntimeState();

    const takeoverTask = serialiseTask(task);
    await publishEvent("task.operator_takeover", { task: takeoverTask });
    sendJson(res, 200, { ok: true, task: takeoverTask, runtime: runtimeState });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/stop") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to stop." });
      return;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return;
    }

    task.status = "failed";
    appendTaskPhase(task, "failed", { reason: "Stopped by operator." });
    task.outcome = {
      kind: "failed",
      summary: "Stopped by operator.",
      reason: "Stopped by operator.",
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    const stoppedTask = serialiseTask(task);
    reconcileRuntimeState();

    await publishEvent("task.failed", { task: stoppedTask, reason: "Stopped by operator." });
    sendJson(res, 200, { ok: true, task: stoppedTask, runtime: runtimeState });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });

  };
}
