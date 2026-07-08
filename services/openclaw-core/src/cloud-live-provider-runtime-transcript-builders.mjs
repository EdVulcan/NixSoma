import {
  buildRollbackNote,
  recordEgressTranscript,
  verifyProviderResponse,
} from "./cloud-live-provider-runtime-adapter.mjs";

import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_TRANSCRIPT_RECORDER_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RESPONSE_VERIFIER_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-response-verifier-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ROLLBACK_NOTE_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-rollback-note-task-v0";

export function createCloudLiveProviderRuntimeTranscriptBuilders(deps) {
  const {
    buildCloudConsciousnessLiveProviderNoNetworkSender,
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

  async function buildCloudConsciousnessLiveProviderEgressTranscriptRecorder() {
    const noNetworkSender = await buildCloudConsciousnessLiveProviderNoNetworkSender();
    const transcriptRecorder = recordEgressTranscript({
      egressEnvelope: noNetworkSender.egressEnvelope,
      providerRequest: noNetworkSender.credentialResolver?.requestBuilder?.providerRequest,
      credentialResolution: noNetworkSender.credentialResolver?.credentialResolution,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const checks = [
      {
        id: "phase-36-no-network-sender-ready",
        label: "Phase 36 no-network sender envelope is ready",
        passed: noNetworkSender.summary?.ready === true
          && noNetworkSender.summary?.dispatchDeferred === true
          && noNetworkSender.summary?.networkEgress === false,
        evidence: noNetworkSender.registry,
      },
      {
        id: "egress-transcript-recorded",
        label: "recordEgressTranscript creates a local transcript for the deferred envelope",
        passed: transcriptRecorder.summary?.ready === true
          && transcriptRecorder.summary?.transcriptRecorded === true
          && transcriptRecorder.transcript?.schema === "openclaw.cloud_consciousness.live_provider_egress_transcript.v0"
          && typeof transcriptRecorder.transcript?.contentHash === "string",
        evidence: transcriptRecorder.registry,
      },
      {
        id: "no-live-provider-activity",
        label: "Transcript recorder does not read credentials, contact endpoints, transmit externally, or create provider responses",
        passed: transcriptRecorder.summary?.credentialValueRead === false
          && transcriptRecorder.summary?.endpointContacted === false
          && transcriptRecorder.summary?.networkEgress === false
          && transcriptRecorder.summary?.providerResponseCreated === false
          && transcriptRecorder.summary?.liveProviderCallEnabled === false,
        evidence: "local-transcript-only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: transcriptRecorder.registry,
      mode: "phase_40_local_egress_transcript_recorder",
      generatedAt: new Date().toISOString(),
      status: ready ? "egress_transcript_recorder_ready_local_only" : "waiting_for_egress_transcript_recorder_prerequisites",
      governance: liveProviderPhaseGovernance.phase40Governance(),
      transcriptRecorder,
      noNetworkSender,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-40",
        localEgressTranscriptRecorderReady: true,
        transcriptRecorded: true,
        localOnly: true,
        dispatchDeferred: true,
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task",
        boundary: "separate approval is required before transcript records can be attached to any runtime egress path",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider egress transcript recorder task creation requires confirm=true.");
    }

    const transcriptRecorder = await buildCloudConsciousnessLiveProviderEgressTranscriptRecorder();
    if (transcriptRecorder.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider egress transcript recorder task requires a ready Phase 40 transcript recorder.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.egress_transcript_recorder",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "egress_transcript_recorder_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider egress transcript recorder task without endpoint contact or network egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_egress_transcript_recorder_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_egress_transcript_recorder_task.draft",
      type: "cloud_consciousness_live_provider_egress_transcript_recorder_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_egress_transcript_recorder_task",
      workViewStrategy: "cloud-consciousness-live-provider-egress-transcript-recorder",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-egress-transcript-recorder-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-egress-transcript-recorder-shell",
        summary: "Create an approval-gated task shell around the local egress transcript recorder while keeping endpoint contact, network egress, provider responses, and live provider calls disabled.",
        governance: liveProviderPhaseGovernance.phase40Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-egress-transcript-recorder",
            phase: "review_live_provider_egress_transcript_recorder",
            title: "Review Phase 40 local egress transcript recorder output",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before transcript records can be attached to any egress path",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-egress-transcript-recorder-use",
            phase: "cloud_consciousness_live_provider_egress_transcript_recorder_deferred",
            title: "Record approved transcript-recorder shell and defer endpoint, network, response, and live-call work",
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
    task.cloudConsciousnessLiveProviderEgressTranscriptRecorder = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_TRANSCRIPT_RECORDER_TASK_REGISTRY,
      transcriptRecorderRegistry: transcriptRecorder.registry,
      transcriptSchema: transcriptRecorder.transcriptRecorder?.transcript?.schema ?? null,
      transcriptRecorded: true,
      localEgressTranscriptRecorderReady: true,
      implementationStatus: "task_shell_only",
      localOnly: true,
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-egress-transcript-recorder-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_TRANSCRIPT_RECORDER_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-egress-transcript-recorder-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: transcriptRecorder.registry,
      transcriptRecorder,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase40Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderEgressTranscriptRecorderTask(task) {
    return task?.type === "cloud_consciousness_live_provider_egress_transcript_recorder_task"
      && task?.cloudConsciousnessLiveProviderEgressTranscriptRecorder?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_TRANSCRIPT_RECORDER_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderEgressTranscriptRecorderTask(task) {
    const transcriptRecorder = await buildCloudConsciousnessLiveProviderEgressTranscriptRecorder();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderEgressTranscriptRecorder = {
      ...(task.cloudConsciousnessLiveProviderEgressTranscriptRecorder ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      transcriptRecorderRegistry: transcriptRecorder.registry,
      transcriptSchema: transcriptRecorder.transcriptRecorder?.transcript?.schema ?? null,
      transcriptRecorded: true,
      localEgressTranscriptRecorderReady: true,
      localOnly: true,
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_egress_transcript_recorder_deferred", {
      transcriptRecorderRegistry: transcriptRecorder.registry,
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-egress-transcript-recorder-deferred",
      reason: "egress transcript recorder task approved; endpoint contact, network egress, provider response creation, and live provider call remain deferred",
      transcriptRecorded: true,
      localOnly: true,
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved egress transcript recorder task shell recorded; executable provider egress remains deferred.",
      transcriptRecorderRegistry: transcriptRecorder.registry,
      phase: "cloud_consciousness_live_provider_egress_transcript_recorder_deferred",
      transcriptRecorded: true,
      localOnly: true,
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-egress-transcript-recorder-task-v0",
      status: "egress_transcript_recorder_deferred_after_approval",
      task,
      transcriptRecorder,
      governance: liveProviderPhaseGovernance.phase40Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        transcriptRecorded: true,
        localOnly: true,
        dispatchDeferred: true,
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderResponseVerifier() {
    const transcriptRecorder = await buildCloudConsciousnessLiveProviderEgressTranscriptRecorder();
    const localResponseReadback = {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-response-readback-v0",
      mode: "phase_44_fixture_local_provider_response_readback",
      response: {
        latest: {
          id: "phase44-local-provider-response-rehearsal",
          schema: "openclaw.cloud_consciousness.provider_call_rehearsal.v0",
          requestId: transcriptRecorder.transcriptRecorder?.transcript?.requestId ?? null,
          requestContentHash: transcriptRecorder.transcriptRecorder?.transcript?.requestContentHash ?? null,
          contentHash: "phase44-local-provider-response-rehearsal-content-hash",
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
      egressTranscriptRecord: transcriptRecorder.transcriptRecorder?.transcript,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const checks = [
      {
        id: "phase-40-transcript-ready",
        label: "Phase 40 egress transcript recorder is ready",
        passed: transcriptRecorder.summary?.ready === true
          && transcriptRecorder.summary?.localOnly === true
          && transcriptRecorder.summary?.dispatchDeferred === true,
        evidence: transcriptRecorder.registry,
      },
      {
        id: "local-response-readback-ready",
        label: "Local provider response rehearsal readback is available",
        passed: localResponseReadback.summary?.ready === true
          && localResponseReadback.response?.latest?.schema === "openclaw.cloud_consciousness.provider_call_rehearsal.v0",
        evidence: localResponseReadback.registry,
      },
      {
        id: "response-verifier-ready",
        label: "verifyProviderResponse validates the local response rehearsal without creating provider responses",
        passed: responseVerifier.summary?.ready === true
          && responseVerifier.summary?.responseVerified === true
          && responseVerifier.summary?.providerResponseCreated === false
          && responseVerifier.verification?.responseSource === "local_rehearsal_readback",
        evidence: responseVerifier.registry,
      },
      {
        id: "no-live-provider-activity",
        label: "Response verifier does not read credentials, contact endpoints, transmit externally, or call providers",
        passed: responseVerifier.summary?.credentialValueRead === false
          && responseVerifier.summary?.endpointContacted === false
          && responseVerifier.summary?.networkEgress === false
          && responseVerifier.summary?.liveProviderCallEnabled === false,
        evidence: "local-response-verification-only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: responseVerifier.registry,
      mode: "phase_44_local_provider_response_verifier",
      generatedAt: new Date().toISOString(),
      status: ready ? "provider_response_verifier_ready_local_only" : "waiting_for_provider_response_verifier_prerequisites",
      governance: liveProviderPhaseGovernance.phase44Governance(),
      responseVerifier,
      transcriptRecorder,
      localResponseReadback,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-44",
        localProviderResponseVerifierReady: true,
        responseVerified: true,
        localOnly: true,
        responseSource: "local_rehearsal_readback",
        localRehearsal: true,
        safeReadback: true,
        transcriptDeferred: true,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-response-verifier-task",
        boundary: "separate approval is required before response verification can be attached to any runtime egress path",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderResponseVerifierTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider response verifier task creation requires confirm=true.");
    }

    const responseVerifier = await buildCloudConsciousnessLiveProviderResponseVerifier();
    if (responseVerifier.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider response verifier task requires a ready Phase 44 response verifier.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.response_verifier",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "response_verifier_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider response verifier task without endpoint contact or network egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_response_verifier_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_response_verifier_task.draft",
      type: "cloud_consciousness_live_provider_response_verifier_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_response_verifier_task",
      workViewStrategy: "cloud-consciousness-live-provider-response-verifier",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-response-verifier-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-response-verifier-shell",
        summary: "Create an approval-gated task shell around the local provider response verifier while keeping endpoint contact, network egress, provider response creation, and live provider calls disabled.",
        governance: liveProviderPhaseGovernance.phase44Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-response-verifier",
            phase: "review_live_provider_response_verifier",
            title: "Review Phase 44 local provider response verifier output",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before response verification can be attached to any egress path",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-response-verifier-use",
            phase: "cloud_consciousness_live_provider_response_verifier_deferred",
            title: "Record approved response-verifier shell and defer endpoint, network, response creation, and live-call work",
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
    task.cloudConsciousnessLiveProviderResponseVerifier = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RESPONSE_VERIFIER_TASK_REGISTRY,
      responseVerifierRegistry: responseVerifier.registry,
      responseSource: "local_rehearsal_readback",
      responseVerified: true,
      localProviderResponseVerifierReady: true,
      implementationStatus: "task_shell_only",
      localOnly: true,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-response-verifier-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RESPONSE_VERIFIER_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-response-verifier-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: responseVerifier.registry,
      responseVerifier,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase44Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderResponseVerifierTask(task) {
    return task?.type === "cloud_consciousness_live_provider_response_verifier_task"
      && task?.cloudConsciousnessLiveProviderResponseVerifier?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RESPONSE_VERIFIER_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderResponseVerifierTask(task) {
    const responseVerifier = await buildCloudConsciousnessLiveProviderResponseVerifier();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderResponseVerifier = {
      ...(task.cloudConsciousnessLiveProviderResponseVerifier ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      responseVerifierRegistry: responseVerifier.registry,
      responseSource: "local_rehearsal_readback",
      responseVerified: true,
      localProviderResponseVerifierReady: true,
      localOnly: true,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_response_verifier_deferred", {
      responseVerifierRegistry: responseVerifier.registry,
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-response-verifier-deferred",
      reason: "response verifier task approved; endpoint contact, network egress, provider response creation, and live provider call remain deferred",
      responseVerified: true,
      localOnly: true,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved response verifier task shell recorded; executable provider egress remains deferred.",
      responseVerifierRegistry: responseVerifier.registry,
      phase: "cloud_consciousness_live_provider_response_verifier_deferred",
      responseVerified: true,
      localOnly: true,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-response-verifier-task-v0",
      status: "response_verifier_deferred_after_approval",
      task,
      responseVerifier,
      governance: liveProviderPhaseGovernance.phase44Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        responseVerified: true,
        localOnly: true,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderRollbackNote() {
    const responseVerifier = await buildCloudConsciousnessLiveProviderResponseVerifier();
    const rollbackNote = buildRollbackNote({
      responseVerification: responseVerifier.responseVerifier,
      egressTranscriptRecord: responseVerifier.transcriptRecorder?.transcriptRecorder?.transcript,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const checks = [
      {
        id: "phase-44-response-verifier-ready",
        label: "Phase 44 response verifier is ready",
        passed: responseVerifier.summary?.ready === true
          && responseVerifier.summary?.responseVerified === true
          && responseVerifier.summary?.networkEgress === false,
        evidence: responseVerifier.registry,
      },
      {
        id: "rollback-note-ready",
        label: "buildRollbackNote creates an operator-visible note without a rollback command",
        passed: rollbackNote.summary?.ready === true
          && rollbackNote.summary?.rollbackNoteReady === true
          && rollbackNote.summary?.rollbackExecuted === false
          && rollbackNote.note?.rollbackCommand === null,
        evidence: rollbackNote.registry,
      },
      {
        id: "no-live-provider-activity",
        label: "Rollback note builder does not mutate host state, contact endpoints, transmit externally, or call providers",
        passed: rollbackNote.summary?.hostMutation === false
          && rollbackNote.summary?.endpointContacted === false
          && rollbackNote.summary?.networkEgress === false
          && rollbackNote.summary?.liveProviderCallEnabled === false,
        evidence: "local-rollback-note-only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: rollbackNote.registry,
      mode: "phase_48_local_provider_rollback_note",
      generatedAt: new Date().toISOString(),
      status: ready ? "provider_rollback_note_ready_local_only" : "waiting_for_provider_rollback_note_prerequisites",
      governance: liveProviderPhaseGovernance.phase48Governance(),
      rollbackNote,
      responseVerifier,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-48",
        localRollbackNoteBuilderReady: true,
        rollbackNoteReady: true,
        localOnly: true,
        rollbackRequired: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-rollback-note-task",
        boundary: "separate approval is required before rollback notes can be attached to any runtime egress path",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderRollbackNoteTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider rollback note task creation requires confirm=true.");
    }

    const rollbackNote = await buildCloudConsciousnessLiveProviderRollbackNote();
    if (rollbackNote.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider rollback note task requires a ready Phase 48 rollback note.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.rollback_note",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "rollback_note_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider rollback note task without rollback execution or network egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_rollback_note_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_rollback_note_task.draft",
      type: "cloud_consciousness_live_provider_rollback_note_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_rollback_note_task",
      workViewStrategy: "cloud-consciousness-live-provider-rollback-note",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-rollback-note-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-rollback-note-shell",
        summary: "Create an approval-gated task shell around the local rollback note while keeping rollback execution, host mutation, endpoint contact, network egress, and live provider calls disabled.",
        governance: liveProviderPhaseGovernance.phase48Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-rollback-note",
            phase: "review_live_provider_rollback_note",
            title: "Review Phase 48 local provider rollback note",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before rollback notes can be attached to any egress path",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-rollback-note-use",
            phase: "cloud_consciousness_live_provider_rollback_note_deferred",
            title: "Record approved rollback-note shell and defer rollback execution, host mutation, network, and live-call work",
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
    task.cloudConsciousnessLiveProviderRollbackNote = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ROLLBACK_NOTE_TASK_REGISTRY,
      rollbackNoteRegistry: rollbackNote.registry,
      rollbackNoteReady: true,
      localRollbackNoteBuilderReady: true,
      implementationStatus: "task_shell_only",
      localOnly: true,
      rollbackRequired: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-rollback-note-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ROLLBACK_NOTE_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-rollback-note-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: rollbackNote.registry,
      rollbackNote,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase48Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderRollbackNoteTask(task) {
    return task?.type === "cloud_consciousness_live_provider_rollback_note_task"
      && task?.cloudConsciousnessLiveProviderRollbackNote?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ROLLBACK_NOTE_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRollbackNoteTask(task) {
    const rollbackNote = await buildCloudConsciousnessLiveProviderRollbackNote();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderRollbackNote = {
      ...(task.cloudConsciousnessLiveProviderRollbackNote ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      rollbackNoteRegistry: rollbackNote.registry,
      rollbackNoteReady: true,
      localRollbackNoteBuilderReady: true,
      localOnly: true,
      rollbackRequired: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_rollback_note_deferred", {
      rollbackNoteRegistry: rollbackNote.registry,
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-rollback-note-deferred",
      reason: "rollback note task approved; rollback execution, host mutation, endpoint contact, network egress, and live provider call remain deferred",
      rollbackNoteReady: true,
      localOnly: true,
      rollbackRequired: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved rollback note task shell recorded; rollback execution and provider egress remain deferred.",
      rollbackNoteRegistry: rollbackNote.registry,
      phase: "cloud_consciousness_live_provider_rollback_note_deferred",
      rollbackNoteReady: true,
      localOnly: true,
      rollbackRequired: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-rollback-note-task-v0",
      status: "rollback_note_deferred_after_approval",
      task,
      rollbackNote,
      governance: liveProviderPhaseGovernance.phase48Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        rollbackNoteReady: true,
        localOnly: true,
        rollbackRequired: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        dispatchDeferred: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        liveProviderCallEnabled: false,
      },
    };
  }


  return {
    buildCloudConsciousnessLiveProviderEgressTranscriptRecorder,
    createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask,
    isCloudConsciousnessLiveProviderEgressTranscriptRecorderTask,
    executeCloudConsciousnessLiveProviderEgressTranscriptRecorderTask,
    buildCloudConsciousnessLiveProviderResponseVerifier,
    createCloudConsciousnessLiveProviderResponseVerifierTask,
    isCloudConsciousnessLiveProviderResponseVerifierTask,
    executeCloudConsciousnessLiveProviderResponseVerifierTask,
    buildCloudConsciousnessLiveProviderRollbackNote,
    createCloudConsciousnessLiveProviderRollbackNoteTask,
    isCloudConsciousnessLiveProviderRollbackNoteTask,
    executeCloudConsciousnessLiveProviderRollbackNoteTask,
  };
}
