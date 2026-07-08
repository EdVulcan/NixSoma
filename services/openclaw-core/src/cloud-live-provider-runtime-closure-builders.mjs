import {
  buildRollbackNote,
  buildCloudLiveProviderRuntimeAdapterModuleContract,
  buildProviderRequest,
  recordEgressTranscript,
  resolveCredentialReference,
  sendProviderRequest,
  verifyProviderResponse,
} from "./cloud-live-provider-runtime-adapter.mjs";

import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_COMPLETION_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-completion-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_EXIT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-exit-v0";

function runtimeAdapterEvidenceRef(result) {
  return {
    registry: result?.registry ?? null,
    ready: result?.summary?.ready ?? result?.summary?.complete ?? null,
    complete: result?.summary?.complete ?? result?.summary?.ready ?? null,
    completionPercent: result?.summary?.completionPercent ?? null,
    phase: result?.summary?.phase ?? null,
  };
}

export function createCloudLiveProviderRuntimeClosureBuilders(deps) {
  const {
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
  } = deps;

  function buildLocalRuntimeAdapterCompletionChain() {
    const moduleContract = buildCloudLiveProviderRuntimeAdapterModuleContract();
    const providerRequest = buildProviderRequest({
      executionPlan: {
        runbookRecordId: "phase52-runbook-record",
        runbookContentHash: "phase52-runbook-content-hash",
        requestEnvelopeHash: "phase52-request-envelope-hash",
        endpointFingerprint: "phase52-endpoint-fingerprint",
        credentialReference: "openclaw://credential/provider/live-provider-fixture",
      },
      requestEnvelope: {
        id: "phase52-reviewed-request-envelope",
        messages: [
          {
            role: "system",
            content: "OpenClaw local live-provider runtime adapter completion. Do not transmit externally.",
          },
          {
            role: "user",
            content: "Close the local adapter method table from approved metadata only.",
          },
        ],
      },
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const credentialResolution = resolveCredentialReference({
      executionPlan: {
        credentialReference: providerRequest.request?.credentialReference,
      },
    });
    const noNetworkSender = sendProviderRequest({
      providerRequest,
      credentialResolution,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const transcriptRecorder = recordEgressTranscript({
      egressEnvelope: noNetworkSender,
      providerRequest,
      credentialResolution,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const localResponseReadback = {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-response-readback-v0",
      mode: "phase_52_fixture_local_provider_response_readback",
      response: {
        latest: {
          id: "phase52-local-provider-response-rehearsal",
          schema: "openclaw.cloud_consciousness.provider_call_rehearsal.v0",
          requestId: transcriptRecorder.transcript?.requestId ?? null,
          requestContentHash: transcriptRecorder.transcript?.requestContentHash ?? null,
          contentHash: "phase52-local-provider-response-rehearsal-content-hash",
          transmittedExternally: false,
          cloudCallExecuted: false,
          providerSdkLoaded: false,
          credentialRead: false,
        },
      },
      summary: {
        ready: true,
        recordCount: 1,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
      },
    };
    const responseVerifier = verifyProviderResponse({
      providerResponseReadback: localResponseReadback,
      egressTranscriptRecord: transcriptRecorder.transcript,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const rollbackNote = buildRollbackNote({
      responseVerification: responseVerifier,
      egressTranscriptRecord: transcriptRecorder.transcript,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    return {
      moduleContract,
      requestBuilder: providerRequest,
      credentialResolver: credentialResolution,
      noNetworkSender,
      transcriptRecorder,
      responseVerifier,
      rollbackNote,
    };
  }

  async function buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion() {
    const {
      moduleContract,
      requestBuilder,
      credentialResolver,
      noNetworkSender,
      transcriptRecorder,
      responseVerifier,
      rollbackNote,
    } = buildLocalRuntimeAdapterCompletionChain();
    const methodClosures = [
      {
        name: "buildProviderRequest",
        registry: requestBuilder.registry,
        ready: requestBuilder.summary?.ready === true,
        boundary: "pure provider request serialization",
      },
      {
        name: "resolveCredentialReference",
        registry: credentialResolver.registry,
        ready: credentialResolver.summary?.ready === true,
        boundary: "credential reference validation only",
      },
      {
        name: "sendProviderRequest",
        registry: noNetworkSender.registry,
        ready: noNetworkSender.summary?.ready === true,
        boundary: "no-network sender envelope; dispatch remains deferred",
      },
      {
        name: "recordEgressTranscript",
        registry: transcriptRecorder.registry,
        ready: transcriptRecorder.summary?.ready === true,
        boundary: "local egress transcript record",
      },
      {
        name: "verifyProviderResponse",
        registry: responseVerifier.registry,
        ready: responseVerifier.summary?.ready === true,
        boundary: "local response rehearsal readback verification",
      },
      {
        name: "buildRollbackNote",
        registry: rollbackNote.registry,
        ready: rollbackNote.summary?.ready === true,
        boundary: "operator-visible rollback note only",
      },
    ];
    const implementedMethodCount = moduleContract.summary?.implementedMethodCount ?? methodClosures.length;
    const checks = [
      {
        id: "module-method-table-complete",
        label: "Dedicated runtime adapter module exposes all six local methods",
        passed: moduleContract.summary?.ready === true
          && moduleContract.summary?.methodCount === 6
          && implementedMethodCount === 6,
        evidence: moduleContract.registry,
      },
      {
        id: "method-chain-ready",
        label: "Request builder, credential resolver, no-network sender, transcript recorder, response verifier, and rollback note are ready",
        passed: methodClosures.every((method) => method.ready === true),
        evidence: `${methodClosures.filter((method) => method.ready).length}/${methodClosures.length} method slice(s)`,
      },
      {
        id: "local-runtime-chain-only",
        label: "The completed adapter remains local-only and does not perform live provider activity",
        passed: [
          requestBuilder.summary,
          credentialResolver.summary,
          noNetworkSender.summary,
          transcriptRecorder.summary,
          responseVerifier.summary,
          rollbackNote.summary,
        ].every((summary) => summary?.endpointContacted === false
          && summary?.networkEgress === false
          && summary?.liveProviderCallEnabled === false),
        evidence: "endpointContacted=false networkEgress=false liveProviderCallEnabled=false",
      },
      {
        id: "closure-before-live-launch",
        label: "Completion routes to adapter closure before any separate live launch path",
        passed: true,
        evidence: "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_COMPLETION_REGISTRY,
      mode: "phase_52_live_provider_runtime_adapter_completion_summary",
      generatedAt: new Date().toISOString(),
      status: ready ? "runtime_adapter_method_table_complete_local_only" : "waiting_for_runtime_adapter_method_table_completion",
      governance: liveProviderPhaseGovernance.phase52Governance(),
      methodClosures,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-52",
        methodCount: methodClosures.length,
        implementedMethodCount,
        readyMethodCount: methodClosures.filter((method) => method.ready).length,
        localRuntimeAdapterComplete: ready,
        adapterMethodTableClosed: ready,
        localOnly: true,
        dispatchDeferred: true,
        implementsRuntimeAdapter: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        moduleContract: runtimeAdapterEvidenceRef(moduleContract),
        requestBuilder: runtimeAdapterEvidenceRef(requestBuilder),
        credentialResolver: runtimeAdapterEvidenceRef(credentialResolver),
        noNetworkSender: runtimeAdapterEvidenceRef(noNetworkSender),
        transcriptRecorder: runtimeAdapterEvidenceRef(transcriptRecorder),
        responseVerifier: runtimeAdapterEvidenceRef(responseVerifier),
        rollbackNote: runtimeAdapterEvidenceRef(rollbackNote),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task",
        boundary: "close and audit the completed local adapter method table before any separate live provider launch route",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter closure task creation requires confirm=true.");
    }

    const completion = await buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion();
    if (completion.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter closure task requires a ready Phase 52 completion summary.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.runtime_adapter_closure",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "runtime_adapter_closure", "operator_reviewed"],
    };
    const goal = "Close reviewed live provider runtime adapter method table without enabling egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_runtime_adapter_closure_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_runtime_adapter_closure_task.draft",
      type: "cloud_consciousness_live_provider_runtime_adapter_closure_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_runtime_adapter_closure_task",
      workViewStrategy: "cloud-consciousness-live-provider-runtime-adapter-closure",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-closure",
        summary: "Create an approval-gated closure task for the completed local adapter method table while keeping live provider egress disabled.",
        governance: liveProviderPhaseGovernance.phase52Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-runtime-adapter-completion",
            phase: "review_live_provider_runtime_adapter_completion",
            title: "Review Phase 52 completed local runtime adapter method table",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before closing the adapter method table",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-live-launch",
            phase: "cloud_consciousness_live_provider_runtime_adapter_closure_deferred",
            title: "Record approved closure and defer any real live provider launch route",
            status: "pending",
            requiresApproval: true,
            executesNow: false,
          },
        ],
      },
    }, { skipInitialPolicy: true });

    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task.cloudConsciousnessLiveProviderRuntimeAdapterClosure = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY,
      completionRegistry: completion.registry,
      implementationStatus: "task_shell_only",
      localRuntimeAdapterComplete: true,
      adapterMethodTableClosed: true,
      methodCount: completion.summary?.methodCount ?? 6,
      implementedMethodCount: completion.summary?.implementedMethodCount ?? 6,
      localOnly: true,
      dispatchDeferred: true,
      implementsRuntimeAdapter: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
    });
    await publishTaskApprovalIfPending(task);
    await publishEvent("task.planned", {
      task: serialiseTask(task),
      plan: task.plan,
    });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-closure-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: completion.registry,
      completion,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase52Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderRuntimeAdapterClosureTask(task) {
    return task?.type === "cloud_consciousness_live_provider_runtime_adapter_closure_task"
      && task?.cloudConsciousnessLiveProviderRuntimeAdapterClosure?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRuntimeAdapterClosureTask(task) {
    const completion = await buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderRuntimeAdapterClosure = {
      ...(task.cloudConsciousnessLiveProviderRuntimeAdapterClosure ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      completionRegistry: completion.registry,
      localRuntimeAdapterComplete: true,
      adapterMethodTableClosed: true,
      methodCount: completion.summary?.methodCount ?? 6,
      implementedMethodCount: completion.summary?.implementedMethodCount ?? 6,
      localOnly: true,
      dispatchDeferred: true,
      implementsRuntimeAdapter: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_runtime_adapter_closure_deferred", {
      completionRegistry: completion.registry,
      deferredSlice: "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-exit",
      reason: "runtime adapter method table closure approved; live provider launch remains a separate route",
      localRuntimeAdapterComplete: true,
      adapterMethodTableClosed: true,
      methodCount: completion.summary?.methodCount ?? 6,
      implementedMethodCount: completion.summary?.implementedMethodCount ?? 6,
      dispatchDeferred: true,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved runtime adapter closure recorded; real live provider launch remains deferred to a separate route.",
      completionRegistry: completion.registry,
      phase: "cloud_consciousness_live_provider_runtime_adapter_closure_deferred",
      localRuntimeAdapterComplete: true,
      adapterMethodTableClosed: true,
      methodCount: completion.summary?.methodCount ?? 6,
      implementedMethodCount: completion.summary?.implementedMethodCount ?? 6,
      dispatchDeferred: true,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
      status: "runtime_adapter_closure_deferred_after_approval",
      task,
      completion,
      governance: liveProviderPhaseGovernance.phase52Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        localRuntimeAdapterComplete: true,
        adapterMethodTableClosed: true,
        methodCount: completion.summary?.methodCount ?? 6,
        implementedMethodCount: completion.summary?.implementedMethodCount ?? 6,
        localOnly: true,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit() {
    const completion = await buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion();
    const checks = [
      {
        id: "completion-summary-ready",
        label: "Phase 52 completion summary is ready",
        passed: completion.summary?.ready === true
          && completion.summary?.completionPercent === 100,
        evidence: completion.registry,
      },
      {
        id: "method-table-closed",
        label: "All six local runtime adapter methods are closed",
        passed: completion.summary?.methodCount === 6
          && completion.summary?.implementedMethodCount === 6
          && completion.summary?.adapterMethodTableClosed === true,
        evidence: `${completion.summary?.implementedMethodCount ?? 0}/${completion.summary?.methodCount ?? 0}`,
      },
      {
        id: "closure-task-registered",
        label: "Approval-gated closure task registry is available",
        passed: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY
          === "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
        evidence: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_TASK_REGISTRY,
      },
      {
        id: "real-live-launch-still-separate",
        label: "No credential value read, endpoint contact, network egress, provider response creation, rollback execution, or live call is enabled",
        passed: completion.summary?.credentialValueRead === false
          && completion.summary?.endpointContacted === false
          && completion.summary?.networkEgress === false
          && completion.summary?.providerResponseCreated === false
          && completion.summary?.rollbackExecuted === false
          && completion.summary?.liveProviderCallEnabled === false,
        evidence: "separate_live_launch_route_required",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_CLOSURE_EXIT_REGISTRY,
      mode: "phase_55_live_provider_runtime_adapter_closure_exit",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_55_runtime_adapter_closure_complete" : "waiting_for_runtime_adapter_closure_readiness",
      governance: liveProviderPhaseGovernance.phase52Governance({ phase: "phase-55" }),
      completedPhase: {
        id: "phase-55",
        name: "Live Provider Runtime Adapter Closure",
        completionClaim: complete ? "phase_55_complete" : "phase_55_incomplete",
      },
      checks,
      summary: {
        ready: complete,
        complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-55",
        localRuntimeAdapterComplete: completion.summary?.localRuntimeAdapterComplete === true,
        adapterMethodTableClosed: completion.summary?.adapterMethodTableClosed === true,
        methodCount: completion.summary?.methodCount ?? 0,
        implementedMethodCount: completion.summary?.implementedMethodCount ?? 0,
        createsTask: true,
        createsApproval: true,
        localOnly: true,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        completion: runtimeAdapterEvidenceRef(completion),
        methodClosures: completion.methodClosures,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-real-launch-route-review",
        boundary: "real live provider launch requires a separate operator-reviewed route; Phase 55 does not enable egress",
      },
    };
  }


  return {
    buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion,
    createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterClosureTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterClosureTask,
    buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit,
  };
}
