import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const EXECUTION_ATTEMPT_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-route-v0";
const EXECUTION_ATTEMPT_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0";
const EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0";
const EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0";
const EXECUTION_ATTEMPT_TASK_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
const EXECUTION_ATTEMPT_APPROVED_DEFERRED_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred";
const EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight";
const EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route";
const EXECUTION_ATTEMPT_TASK_TYPE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task";
const EXECUTION_ATTEMPT_TASK_FIELD =
  "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt";
const EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred";
const EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS =
  "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded";
const EXECUTION_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated";
const EXECUTION_ATTEMPT_TASK_APPROVED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved";
const EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred";

function deferredCredentialFlags() {
  return {
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
  };
}

export function createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellRuntime(context) {
  const {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute,
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

  async function createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt task creation requires confirm=true.");
    }

    const route = await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute();
    if (route.summary?.ready !== true || route.next?.recommendedSlice !== EXECUTION_ATTEMPT_TASK_SLUG) {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt task requires a ready Phase 131 execution attempt route.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt", "operator_reviewed"],
    };
    const goal = "Prepare approval-gated credential value local read result envelope creation execution attempt task shell without reading credential values or creating result envelopes";
    const policyDecision = evaluatePolicyIntent({
      type: EXECUTION_ATTEMPT_TASK_TYPE,
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task.draft",
      type: EXECUTION_ATTEMPT_TASK_TYPE,
      goal,
    });

    const task = createTask({
      goal,
      type: EXECUTION_ATTEMPT_TASK_TYPE,
      workViewStrategy: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-shell",
        summary: "Create an approval-gated credential value local read result envelope creation execution attempt task shell while keeping credential values unread, result envelopes uncreated, and endpoint/network activity disabled.",
        governance: liveProviderPhaseGovernance.phase132Governance({
          createsTask: true,
          createsApproval: true,
          [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
        }),
        steps: [
          {
            id: "review-credential-value-local-read-result-envelope-creation-execution-attempt-route",
            phase: "review_live_provider_credential_value_local_read_result_envelope_creation_execution_attempt_route",
            title: "Review Phase 131 credential value local read result envelope creation execution attempt route",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before credential value local read result envelope creation execution attempt shell can be recorded",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-credential-value-local-read-result-envelope-creation-execution-attempt",
            phase: EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE,
            title: "Record local read result envelope creation execution attempt task shell and defer credential value reads, envelope creation, and provider egress",
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
    task[EXECUTION_ATTEMPT_TASK_FIELD] = {
      registry: EXECUTION_ATTEMPT_TASK_REGISTRY,
      sourceRegistry: EXECUTION_ATTEMPT_ROUTE_REGISTRY,
      sourceTaskId: route.summary?.sourceTaskId ?? null,
      implementationStatus: "task_shell_only",
      credentialReference: route.decision?.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      [EXECUTION_FINAL_READINESS_RECORDED_FIELD]:
        route.summary?.[EXECUTION_FINAL_READINESS_RECORDED_FIELD] === true,
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: false,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
      ...deferredCredentialFlags(),
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
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
      registry: EXECUTION_ATTEMPT_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: EXECUTION_ATTEMPT_ROUTE_REGISTRY,
      route,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase132Governance({
        createsTask: true,
        createsApproval: true,
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      }),
    };
  }

  function isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(task) {
    return task?.type === EXECUTION_ATTEMPT_TASK_TYPE
      && task?.[EXECUTION_ATTEMPT_TASK_FIELD]?.registry === EXECUTION_ATTEMPT_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(task) {
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
    task[EXECUTION_ATTEMPT_TASK_FIELD] = {
      ...(task[EXECUTION_ATTEMPT_TASK_FIELD] ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
      ...deferredCredentialFlags(),
    };
    appendTaskPhase(task, EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE, {
      taskRegistry: EXECUTION_ATTEMPT_TASK_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_route",
      deferredSlice: EXECUTION_ATTEMPT_APPROVED_DEFERRED_SLUG,
      reason: "credential value local read result envelope creation execution attempt task shell approved; credential value read, result envelope creation, endpoint contact, and network egress remain deferred",
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved credential value local read result envelope creation execution attempt task shell recorded; credential values remain unread and result envelopes remain uncreated.",
      taskRegistry: EXECUTION_ATTEMPT_TASK_REGISTRY,
      phase: EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE,
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
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
      executor: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
      status: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred_after_approval",
      task,
      governance: liveProviderPhaseGovernance.phase132Governance({
        createsTask: true,
        createsApproval: true,
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
        [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
        [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
        [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
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

  function findLatestApprovedDeferredCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.[EXECUTION_ATTEMPT_TASK_FIELD] ?? {};
        return isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(task)
          && task.status === "completed"
          && (shell.implementationStatus === "deferred_after_approval"
            || shell.implementationStatus === EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS)
          && shell[EXECUTION_ATTEMPT_TASK_CREATED_FIELD] === true
          && shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true
          && shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true
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
          && task.outcome?.details?.phase === EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE;
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById?.(candidates[0].id) ?? candidates[0] : null;
  }

  async function buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred() {
    const task = findLatestApprovedDeferredCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask();
    const shell = task?.[EXECUTION_ATTEMPT_TASK_FIELD] ?? {};
    const checks = [
      {
        id: "credential-value-local-read-result-envelope-creation-execution-attempt-task-approved",
        label: "Credential value local-read result envelope creation execution attempt task shell was approved",
        passed: Boolean(task)
          && task.approval?.status === "approved"
          && shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true,
        evidence: task?.approval?.requestId ?? null,
      },
      {
        id: "credential-value-local-read-result-envelope-creation-execution-attempt-remains-deferred",
        label: "Approved credential value local-read result envelope creation execution attempt remains deferred and uncreated",
        passed: (shell.implementationStatus === "deferred_after_approval"
            || shell.implementationStatus === EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS)
          && shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: shell.implementationStatus ?? task?.outcome?.details?.phase ?? null,
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
        label: "Approved deferred local-read result envelope creation execution attempt evidence has no endpoint contact, network egress, rollback, host mutation, launch, or live provider call",
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
      registry: EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY,
      mode: "phase_133_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_approved_deferred",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_approved_deferred_ready" : "waiting_for_phase_132_approved_deferred_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell",
      governance: liveProviderPhaseGovernance.phase133Governance({
        [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true,
      }),
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-133",
        approvedDeferredEvidenceFound: Boolean(task),
        sourceTaskId: task?.id ?? null,
        sourceRegistry: EXECUTION_ATTEMPT_TASK_REGISTRY,
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_CREATED_FIELD] === true,
        [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true,
        [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true,
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
        recommendedSlice: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_SLUG,
        boundary: "actual credential value reads, local read result envelope creation, endpoint contact, network egress, provider response creation, rollback execution, host mutation, launch execution, and live provider calls remain separate future gates",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight() {
    const approvedDeferred = await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred();
    const task = findLatestApprovedDeferredCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask();
    const shell = task?.[EXECUTION_ATTEMPT_TASK_FIELD] ?? {};
    const recorded = shell[EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD] === true;
    const preflight = {
      registry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
      sourceRegistry: EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY,
      sourceTaskId: task?.id ?? null,
      preflightState: recorded ? "recorded_deferred" : "ready_to_record_deferred",
      credentialReference: shell.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: recorded,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]:
        shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]:
        shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true,
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
    };
    const checks = [
      {
        id: "phase-133-result-envelope-creation-execution-attempt-approved-deferred-ready",
        label: "Phase 133 approved-deferred credential value local-read result envelope creation execution attempt evidence is ready",
        passed: approvedDeferred.summary?.ready === true
          && approvedDeferred.summary?.approvedDeferredEvidenceFound === true
          && Boolean(task),
        evidence: task?.id ?? null,
      },
      {
        id: "result-envelope-creation-execution-attempt-approved-but-still-deferred",
        label: "Credential value local-read result envelope creation execution attempt task is approved but remains deferred and uncreated",
        passed: (shell.implementationStatus === "deferred_after_approval"
            || shell.implementationStatus === EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS)
          && shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true
          && shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true
          && shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: shell.implementationStatus ?? null,
      },
      {
        id: "credential-value-result-envelope-creation-execution-attempt-final-readiness-preflight-state",
        label: "Final credential value local-read result envelope creation execution attempt readiness preflight is local-only and does not read credentials or create envelopes",
        passed: preflight.credentialValueRead === false
          && preflight.credentialValueIncluded === false
          && preflight.credentialValueExposed === false
          && preflight.providerCredentialRead === false
          && preflight.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: preflight.preflightState,
      },
      {
        id: "no-endpoint-network-rollback-mutation-launch-or-live-call",
        label: "Local-read result envelope creation execution attempt final readiness preflight does not contact endpoints, transmit externally, roll back, mutate host state, launch, or enable live provider calls",
        passed: preflight.endpointContacted === false
          && preflight.networkEgress === false
          && preflight.providerResponseCreated === false
          && preflight.rollbackExecuted === false
          && preflight.rollbackCommandCreated === false
          && preflight.hostMutation === false
          && preflight.transmitsExternally === false
          && preflight.liveProviderCallEnabled === false
          && preflight.launchAuthorized === false
          && preflight.launchExecuted === false,
        evidence: "no_network_activity",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
      mode: "phase_134_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_ready_deferred" : "waiting_for_phase_133_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_approved_deferred",
      governance: liveProviderPhaseGovernance.phase134Governance({
        [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: recorded,
      }),
      preflight,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-134",
        [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: recorded,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredRequired: true,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredFound: Boolean(task),
        sourceTaskId: task?.id ?? null,
        sourceRegistry: EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY,
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_CREATED_FIELD] === true,
        [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD] === true,
        [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]:
          shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD] === true,
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
        approvedDeferred,
        resultEnvelopeCreationExecutionAttemptTask: task ? serialiseTask(task) : null,
      },
      next: {
        recommendedSlice: EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG,
        boundary: "actual credential value reads, local read result envelope creation, endpoint contact, network egress, provider response creation, rollback execution, host mutation, launch execution, and live provider calls remain separate future gates",
      },
    };
  }

  async function recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt final readiness preflight requires confirm=true.");
    }

    const preflight = await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight();
    if (preflight.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredFound !== true) {
      throw new Error("Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt final readiness preflight requires Phase 133 approved deferred local-read result envelope creation execution attempt evidence.");
    }

    const task = findLatestApprovedDeferredCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask();
    if (!task) {
      throw new Error("Unable to locate approved deferred credential value local-read result envelope creation execution attempt task for final readiness preflight.");
    }

    const recordedAt = new Date().toISOString();
    task[EXECUTION_ATTEMPT_TASK_FIELD] = {
      ...(task[EXECUTION_ATTEMPT_TASK_FIELD] ?? {}),
      implementationStatus: EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS,
      [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRegistry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecordedAt: recordedAt,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight: {
        ...preflight.preflight,
        preflightState: "recorded_deferred",
        [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      },
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
      ...deferredCredentialFlags(),
    };
    appendTaskPhase(task, EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_STATUS, {
      preflightRegistry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
      recordedAt,
      sourcePhase: EXECUTION_ATTEMPT_TASK_DEFERRED_PHASE,
      preflight: {
        ...preflight.preflight,
        preflightState: "recorded_deferred",
        [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      },
      nextSlice: EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG,
      [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    task.updatedAt = recordedAt;
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      registry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
      mode: "phase_134_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded",
      generatedAt: recordedAt,
      status: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded_deferred",
      task: serialiseTask(task),
      preflight: await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight(),
      governance: liveProviderPhaseGovernance.phase134Governance({
        [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      }),
    };
  }

  return {
    createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask,
    isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask,
    executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask,
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred,
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight,
    recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight,
  };
}
