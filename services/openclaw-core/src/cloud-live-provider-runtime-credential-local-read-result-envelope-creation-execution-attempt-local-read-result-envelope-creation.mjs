import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-final-readiness-preflight-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-route-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-approved-deferred-v0";

export function createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(context) {
  const {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight,
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
  } = context;

  async function buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRoute() {
    const finalReadinessPreflight =
      await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight();
    const decision = {
      decision: "route_to_approval_gated_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
      selectedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-shell",
      reason: "The result envelope final readiness preflight is recorded; the next gate is a separate approval-gated result envelope creation task shell before any credential value can be read or represented.",
      requiredBeforeCredentialValueRead: [
        "separate approval-gated credential value local read result envelope creation task shell",
        "redaction-safe result envelope creation contract that never exposes credential values",
        "explicit local-only proof that endpoint/network egress remains unauthorized",
        "provider request assembly and egress remain separately gated after local result envelope creation evidence",
      ],
      credentialReference: finalReadinessPreflight.preflight?.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded:
        finalReadinessPreflight.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded === true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: false,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      credentialValueIncluded: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
    };
    const checks = [
      {
        id: "phase-122-result-envelope-final-readiness-preflight-recorded",
        label: "Phase 122 credential value result envelope final readiness preflight is recorded",
        passed: finalReadinessPreflight.summary?.ready === true
          && finalReadinessPreflight.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded === true,
        evidence: finalReadinessPreflight.summary?.sourceTaskId ?? null,
      },
      {
        id: "credential-value-still-unread",
        label: "Credential value remains unread, unexposed, and outside provider reads",
        passed: finalReadinessPreflight.summary?.credentialValueRead === false
          && finalReadinessPreflight.summary?.credentialValueIncluded === false
          && finalReadinessPreflight.summary?.credentialValueExposed === false
          && finalReadinessPreflight.summary?.providerCredentialRead === false
          && decision.credentialValueRead === false,
        evidence: decision.credentialReference,
      },
      {
        id: "result-envelope-creation-task-not-created",
        label: "Result envelope creation route does not create a task or result envelope",
        passed: decision.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated === false
          && decision.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: decision.selectedSlice,
      },
      {
        id: "no-endpoint-network-or-live-call",
        label: "Result envelope creation route does not contact endpoints, transmit externally, or enable live provider calls",
        passed: finalReadinessPreflight.summary?.endpointContacted === false
          && finalReadinessPreflight.summary?.networkEgress === false
          && finalReadinessPreflight.summary?.transmitsExternally === false
          && finalReadinessPreflight.summary?.liveProviderCallEnabled === false,
        evidence: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_route_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY,
      mode: "phase_123_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_route",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_route_ready" : "waiting_for_phase_122_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_final_readiness_preflight",
      governance: liveProviderPhaseGovernance.phase123Governance({
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded:
          finalReadinessPreflight.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded === true,
      }),
      decision,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-123",
        finalReadinessPreflightFound: finalReadinessPreflight.summary?.ready === true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded:
          finalReadinessPreflight.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded === true,
        sourceTaskId: finalReadinessPreflight.summary?.sourceTaskId ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY,
        selectedSlice: decision.selectedSlice,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: false,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        finalReadinessPreflight,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-shell",
        boundary: "credential value reads, local read result envelope creation, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation task creation requires confirm=true.");
    }

    const route = await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRoute();
    if (route.summary?.ready !== true
      || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-shell") {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation task requires a ready Phase 123 result envelope creation route.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation", "operator_reviewed"],
    };
    const goal = "Prepare approval-gated credential value local read result envelope creation task shell without reading credential values or creating envelopes";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task.draft",
      type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
      workViewStrategy: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-shell",
        summary: "Create an approval-gated credential value local read result envelope creation task shell while keeping credential values unread, result envelopes uncreated, and endpoint/network activity disabled.",
        governance: liveProviderPhaseGovernance.phase124Governance({
          createsTask: true,
          createsApproval: true,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
        }),
        steps: [
          {
            id: "review-credential-value-local-read-result-envelope-creation-route",
            phase: "review_live_provider_credential_value_local_read_result_envelope_creation_route",
            title: "Review Phase 123 credential value local read result envelope creation route",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before credential value local read result envelope creation shell can be recorded",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-credential-value-local-read-result-envelope-creation",
            phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred",
            title: "Record local read result envelope creation task shell and defer credential value reads and envelope creation",
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
    task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY,
      sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY,
      sourceTaskId: route.summary?.sourceTaskId ?? null,
      implementationStatus: "task_shell_only",
      credentialReference: route.decision?.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded:
        route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded === true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: false,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      credentialValueIncluded: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
      launchAuthorized: false,
      launchExecuted: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY,
      route,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase124Governance({
        createsTask: true,
        createsApproval: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      }),
    };
  }

  function isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(task) {
    return task?.type === "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task"
      && task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(task) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    const recordedAt = new Date().toISOString();
    task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation = {
      ...(task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      credentialValueIncluded: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
      launchAuthorized: false,
      launchExecuted: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred", {
      taskRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_route",
      deferredSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-approved-deferred",
      reason: "credential value local read result envelope creation task shell approved; credential value read and result envelope creation remain deferred",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved credential value local read result envelope creation task shell recorded; credential values remain unread and result envelopes remain uncreated.",
      taskRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY,
      phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0",
      status: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred_after_approval",
      task,
      governance: liveProviderPhaseGovernance.phase124Governance({
        createsTask: true,
        createsApproval: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
      }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  function findLatestApprovedDeferredCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation ?? {};
        return isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(task)
          && task.status === "completed"
          && shell.implementationStatus === "deferred_after_approval"
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false
          && shell.credentialValueIncluded === false
          && shell.credentialValueRead === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false
          && shell.transmitsExternally === false
          && shell.liveProviderCallEnabled === false
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && task.outcome?.details?.phase === "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred";
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById?.(candidates[0].id) ?? candidates[0] : null;
  }

  async function buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationApprovedDeferred() {
    const task = findLatestApprovedDeferredCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask();
    const shell = task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation ?? {};
    const checks = [
      {
        id: "credential-value-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-approved",
        label: "Credential value local-read result envelope creation task shell was approved",
        passed: Boolean(task)
          && task.approval?.status === "approved"
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved === true,
        evidence: task?.approval?.requestId ?? null,
      },
      {
        id: "credential-value-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-remains-deferred",
        label: "Approved credential value local-read result envelope creation remains deferred and uncreated",
        passed: shell.implementationStatus === "deferred_after_approval"
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: task?.outcome?.details?.phase ?? null,
      },
      {
        id: "credential-value-still-unread",
        label: "Credential value remains unread, unexposed, and outside provider reads",
        passed: shell.credentialValueIncluded === false
          && shell.credentialValueRead === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false,
        evidence: shell.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      },
      {
        id: "no-endpoint-network-rollback-mutation-launch-or-live-call",
        label: "Approved deferred local-read result envelope creation evidence has no endpoint contact, network egress, rollback, host mutation, launch, or live provider call",
        passed: shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false
          && shell.transmitsExternally === false
          && shell.liveProviderCallEnabled === false
          && shell.launchAuthorized === false
          && shell.launchExecuted === false,
        evidence: "no_network_activity",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_APPROVED_DEFERRED_REGISTRY,
      mode: "phase_125_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_approved_deferred",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_approved_deferred_ready" : "waiting_for_phase_124_approved_deferred_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell",
      governance: liveProviderPhaseGovernance.phase125Governance({
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved:
          shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved === true,
      }),
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-125",
        approvedDeferredEvidenceFound: Boolean(task),
        sourceTaskId: task?.id ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_EXECUTION_LOCAL_READ_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_LOCAL_READ_RESULT_ENVELOPE_CREATION_TASK_REGISTRY,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated:
          shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated === true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved:
          shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved === true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred:
          shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred === true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        approvedDeferredTask: task ? serialiseTask(task) : null,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight",
        boundary: "actual credential value reads, local read result envelope creation, endpoint contact, network egress, provider response creation, rollback execution, host mutation, launch execution, and live provider calls remain separate future gates",
      },
    };
  }

  return {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRoute,
    createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask,
    isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask,
    executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask,
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationApprovedDeferred,
  };
}
