import {
  resolveCredentialReference,
  sendProviderRequest,
} from "./cloud-live-provider-runtime-adapter.mjs";

import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_REFERENCE_RESOLVER_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_NO_NETWORK_SENDER_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0";

export function createCloudLiveProviderRuntimeCredentialReferenceBuilders(deps) {
  const {
    buildCloudConsciousnessLiveProviderRequestBuilder,
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

  async function buildCloudConsciousnessLiveProviderCredentialReferenceResolver() {
    const requestBuilder = await buildCloudConsciousnessLiveProviderRequestBuilder();
    const credentialReference = requestBuilder.providerRequest?.request?.credentialReference;
    const credentialResolution = resolveCredentialReference({
      executionPlan: {
        credentialReference,
      },
    });
    const checks = [
      {
        id: "phase-28-request-builder-ready",
        label: "Phase 28 request builder carries a credential reference",
        passed: requestBuilder.summary?.ready === true
          && requestBuilder.summary?.credentialValueIncluded === false
          && typeof credentialReference === "string",
        evidence: requestBuilder.registry,
      },
      {
        id: "credential-reference-valid",
        label: "Credential resolver validates reference format without reading credential values",
        passed: credentialResolution.summary?.ready === true
          && credentialResolution.summary?.referenceOnly === true
          && credentialResolution.summary?.credentialValueRead === false
          && credentialResolution.credential?.value === null,
        evidence: credentialResolution.registry,
      },
      {
        id: "no-live-provider-activity",
        label: "Credential reference resolver does not contact endpoints, transmit externally, or call providers",
        passed: credentialResolution.governance?.endpointContacted === false
          && credentialResolution.governance?.networkEgress === false
          && credentialResolution.governance?.liveProviderCallEnabled === false,
        evidence: "reference-only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: credentialResolution.registry,
      mode: "phase_32_credential_reference_resolver",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_reference_resolver_ready_no_value_read" : "waiting_for_credential_reference_resolver_prerequisites",
      governance: liveProviderPhaseGovernance.phase32Governance(),
      credentialResolution,
      requestBuilder,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-32",
        pureCredentialReferenceResolverReady: true,
        credentialReferencePresent: credentialResolution.summary?.credentialReferencePresent ?? false,
        validReference: credentialResolution.summary?.validReference ?? false,
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task",
        boundary: "separate approval is required before resolving credential references through any credential store",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderCredentialReferenceResolverTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider credential reference resolver task creation requires confirm=true.");
    }

    const credentialResolver = await buildCloudConsciousnessLiveProviderCredentialReferenceResolver();
    if (credentialResolver.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider credential reference resolver task requires a ready Phase 32 resolver.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.credential_reference_resolver",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "credential_reference_resolver_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed credential reference resolver task without reading credential values or enabling egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_credential_reference_resolver_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_credential_reference_resolver_task.draft",
      type: "cloud_consciousness_live_provider_credential_reference_resolver_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_credential_reference_resolver_task",
      workViewStrategy: "cloud-consciousness-live-provider-credential-reference-resolver",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-credential-reference-resolver-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-credential-reference-resolver-shell",
        summary: "Create an approval-gated task shell around the credential reference resolver while keeping credential values, endpoints, network egress, and live provider calls disabled.",
        governance: liveProviderPhaseGovernance.phase33Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-credential-reference-resolver",
            phase: "review_live_provider_credential_reference_resolver",
            title: "Review Phase 32 credential reference resolver output",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before credential reference resolution can access any credential store",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-credential-reference-resolution",
            phase: "cloud_consciousness_live_provider_credential_reference_resolver_deferred",
            title: "Record approved credential resolver shell and defer credential-store access, endpoint, network, and live-call work",
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
    task.cloudConsciousnessLiveProviderCredentialReferenceResolver = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_REFERENCE_RESOLVER_TASK_REGISTRY,
      credentialResolverRegistry: credentialResolver.registry,
      credentialReferencePresent: credentialResolver.summary?.credentialReferencePresent ?? false,
      validReference: credentialResolver.summary?.validReference ?? false,
      implementationStatus: "task_shell_only",
      pureCredentialReferenceResolverReady: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-credential-reference-resolver-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_REFERENCE_RESOLVER_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-credential-reference-resolver-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: credentialResolver.registry,
      credentialResolver,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase33Governance({ createsTask: true, createsApproval: true }),
    };
  }

  async function buildCloudConsciousnessLiveProviderNoNetworkSender() {
    const credentialResolver = await buildCloudConsciousnessLiveProviderCredentialReferenceResolver();
    const egressEnvelope = sendProviderRequest({
      providerRequest: credentialResolver.requestBuilder?.providerRequest,
      credentialResolution: credentialResolver.credentialResolution,
      operatorAuthorization: {
        state: "not_authorized",
      },
    });
    const checks = [
      {
        id: "phase-28-request-builder-ready",
        label: "Phase 28 request builder provides a serialized provider request",
        passed: credentialResolver.requestBuilder?.summary?.ready === true
          && typeof credentialResolver.requestBuilder?.providerRequest?.request?.bodyText === "string",
        evidence: credentialResolver.requestBuilder?.registry ?? null,
      },
      {
        id: "phase-32-credential-reference-ready",
        label: "Phase 32 credential resolver validates reference-only metadata",
        passed: credentialResolver.summary?.ready === true
          && credentialResolver.summary?.referenceOnly === true
          && credentialResolver.summary?.credentialValueRead === false,
        evidence: credentialResolver.registry,
      },
      {
        id: "no-network-sender-envelope-ready",
        label: "sendProviderRequest returns a deferred local egress envelope",
        passed: egressEnvelope.summary?.ready === true
          && egressEnvelope.summary?.dispatchDeferred === true
          && egressEnvelope.summary?.networkEgress === false
          && egressEnvelope.egressEnvelope?.dispatch === "deferred",
        evidence: egressEnvelope.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: egressEnvelope.registry,
      mode: "phase_36_no_network_provider_request_sender",
      generatedAt: new Date().toISOString(),
      status: ready ? "no_network_sender_ready_deferred_egress" : "waiting_for_no_network_sender_prerequisites",
      governance: liveProviderPhaseGovernance.phase36Governance(),
      egressEnvelope,
      credentialResolver,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-36",
        noNetworkProviderRequestSenderReady: true,
        dispatchDeferred: true,
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-send-provider-request-task",
        boundary: "separate approval is required before this sender envelope can be connected to any runtime egress path",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderNoNetworkSenderTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider no-network sender task creation requires confirm=true.");
    }

    const noNetworkSender = await buildCloudConsciousnessLiveProviderNoNetworkSender();
    if (noNetworkSender.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider no-network sender task requires a ready Phase 36 sender envelope.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.no_network_sender",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "no_network_sender_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed no-network provider request sender task without endpoint contact or network egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_no_network_sender_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_no_network_sender_task.draft",
      type: "cloud_consciousness_live_provider_no_network_sender_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_no_network_sender_task",
      workViewStrategy: "cloud-consciousness-live-provider-no-network-sender",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-no-network-sender-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-no-network-sender-shell",
        summary: "Create an approval-gated task shell around the no-network sender envelope while keeping endpoint contact, network egress, and live provider calls disabled.",
        governance: liveProviderPhaseGovernance.phase37Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-no-network-sender-envelope",
            phase: "review_live_provider_no_network_sender",
            title: "Review Phase 36 no-network sender envelope",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before sender envelope can be connected to any egress path",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-no-network-sender-use",
            phase: "cloud_consciousness_live_provider_no_network_sender_deferred",
            title: "Record approved no-network sender shell and defer endpoint, network, and live-call work",
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
    task.cloudConsciousnessLiveProviderNoNetworkSender = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_NO_NETWORK_SENDER_TASK_REGISTRY,
      noNetworkSenderRegistry: noNetworkSender.registry,
      implementationStatus: "task_shell_only",
      noNetworkProviderRequestSenderReady: true,
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
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-no-network-sender-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_NO_NETWORK_SENDER_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-no-network-sender-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: noNetworkSender.registry,
      noNetworkSender,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase37Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderNoNetworkSenderTask(task) {
    return task?.type === "cloud_consciousness_live_provider_no_network_sender_task"
      && task?.cloudConsciousnessLiveProviderNoNetworkSender?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_NO_NETWORK_SENDER_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderNoNetworkSenderTask(task) {
    const noNetworkSender = await buildCloudConsciousnessLiveProviderNoNetworkSender();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderNoNetworkSender = {
      ...(task.cloudConsciousnessLiveProviderNoNetworkSender ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      noNetworkSenderRegistry: noNetworkSender.registry,
      noNetworkProviderRequestSenderReady: true,
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
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_no_network_sender_deferred", {
      noNetworkSenderRegistry: noNetworkSender.registry,
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-no-network-sender-deferred",
      reason: "no-network sender task approved; endpoint contact, network egress, and live provider call remain deferred",
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved no-network sender task shell recorded; executable provider egress remains deferred.",
      noNetworkSenderRegistry: noNetworkSender.registry,
      phase: "cloud_consciousness_live_provider_no_network_sender_deferred",
      dispatchDeferred: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-no-network-sender-task-v0",
      status: "no_network_sender_deferred_after_approval",
      task,
      noNetworkSender,
      governance: liveProviderPhaseGovernance.phase37Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        dispatchDeferred: true,
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  function isCloudConsciousnessLiveProviderCredentialReferenceResolverTask(task) {
    return task?.type === "cloud_consciousness_live_provider_credential_reference_resolver_task"
      && task?.cloudConsciousnessLiveProviderCredentialReferenceResolver?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_REFERENCE_RESOLVER_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderCredentialReferenceResolverTask(task) {
    const credentialResolver = await buildCloudConsciousnessLiveProviderCredentialReferenceResolver();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    task.cloudConsciousnessLiveProviderCredentialReferenceResolver = {
      ...(task.cloudConsciousnessLiveProviderCredentialReferenceResolver ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      credentialResolverRegistry: credentialResolver.registry,
      credentialReferencePresent: credentialResolver.summary?.credentialReferencePresent ?? false,
      validReference: credentialResolver.summary?.validReference ?? false,
      pureCredentialReferenceResolverReady: true,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_credential_reference_resolver_deferred", {
      credentialResolverRegistry: credentialResolver.registry,
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-credential-reference-resolver-deferred",
      reason: "credential reference resolver task approved; credential-store access, credential values, endpoint contact, network egress, and live provider call remain deferred",
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved credential reference resolver task shell recorded; credential-store access remains deferred.",
      credentialResolverRegistry: credentialResolver.registry,
      phase: "cloud_consciousness_live_provider_credential_reference_resolver_deferred",
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-credential-reference-resolver-task-v0",
      status: "credential_reference_resolver_deferred_after_approval",
      task,
      credentialResolver,
      governance: liveProviderPhaseGovernance.phase33Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        referenceOnly: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  return {
    buildCloudConsciousnessLiveProviderCredentialReferenceResolver,
    createCloudConsciousnessLiveProviderCredentialReferenceResolverTask,
    isCloudConsciousnessLiveProviderCredentialReferenceResolverTask,
    executeCloudConsciousnessLiveProviderCredentialReferenceResolverTask,
    buildCloudConsciousnessLiveProviderNoNetworkSender,
    createCloudConsciousnessLiveProviderNoNetworkSenderTask,
    isCloudConsciousnessLiveProviderNoNetworkSenderTask,
    executeCloudConsciousnessLiveProviderNoNetworkSenderTask,
  };
}
