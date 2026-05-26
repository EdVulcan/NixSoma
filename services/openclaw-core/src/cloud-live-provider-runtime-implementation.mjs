const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_IMPLEMENTATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-implementation-task-v0";

function phase18Governance(extra = {}) {
  return {
    phase: "phase-18",
    createsTask: false,
    createsApproval: false,
    implementsRuntimeAdapter: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

function phase20Governance(extra = {}) {
  return {
    phase: "phase-20",
    createsTask: false,
    createsApproval: false,
    definesRuntimeAdapterInterface: true,
    implementsRuntimeAdapter: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

export function createCloudLiveProviderRuntimeImplementation(deps) {
  const {
    buildRuntimeImplementationPlan,
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

  async function createCloudConsciousnessLiveProviderRuntimeImplementationTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider runtime implementation task creation requires confirm=true.");
    }

    const implementationPlan = await buildRuntimeImplementationPlan();
    if (implementationPlan.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider runtime implementation task requires a ready Phase 17 implementation plan.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.runtime_implementation",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "runtime_implementation_shell", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider-call runtime implementation task without enabling egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_runtime_implementation_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_runtime_implementation_task.draft",
      type: "cloud_consciousness_live_provider_runtime_implementation_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_runtime_implementation_task",
      workViewStrategy: "cloud-consciousness-live-provider-runtime-implementation",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-runtime-implementation-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-runtime-implementation-shell",
        summary: "Create an approval-gated runtime implementation shell while keeping SDK, credential, endpoint, and network activity disabled.",
        governance: phase18Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-runtime-implementation-plan",
            phase: "review_live_provider_runtime_implementation_plan",
            title: "Review Phase 17 runtime implementation plan and launch-review evidence",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before runtime implementation work can be considered",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-runtime-implementation",
            phase: "cloud_consciousness_live_provider_runtime_implementation_deferred",
            title: "Record approved runtime implementation shell and defer SDK, credential, endpoint, and network work",
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
    task.cloudConsciousnessLiveProviderRuntimeImplementation = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_IMPLEMENTATION_TASK_REGISTRY,
      implementationPlanRegistry: implementationPlan.registry,
      implementationStatus: "task_shell_only",
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
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
      planner: "cloud-consciousness-live-provider-runtime-implementation-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_IMPLEMENTATION_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-runtime-implementation-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: implementationPlan.registry,
      implementationPlan,
      task,
      approval,
      governance: phase18Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderRuntimeImplementationTask(task) {
    return task?.type === "cloud_consciousness_live_provider_runtime_implementation_task"
      && task?.cloudConsciousnessLiveProviderRuntimeImplementation?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_IMPLEMENTATION_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRuntimeImplementationTask(task) {
    const implementationPlan = await buildRuntimeImplementationPlan();
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
        policy: task.policy?.decision ?? null,
      };
    }

    task.cloudConsciousnessLiveProviderRuntimeImplementation = {
      ...(task.cloudConsciousnessLiveProviderRuntimeImplementation ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_runtime_implementation_deferred", {
      implementationPlanRegistry: implementationPlan.registry,
      deferredSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation",
      reason: "runtime implementation shell approved; SDK, credential, endpoint, network, and live call remain deferred",
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved runtime implementation task shell recorded; live provider runtime remains deferred.",
      implementationPlanRegistry: implementationPlan.registry,
      phase: "cloud_consciousness_live_provider_runtime_implementation_deferred",
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    persistState();
    await publishEvent("task.completed", {
      task: serialiseTask(task),
      implementationPlan: {
        registry: implementationPlan.registry,
        ready: implementationPlan.summary?.ready ?? null,
      },
    });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-runtime-implementation-task-v0",
      status: "runtime_implementation_deferred_after_approval",
      task,
      implementationPlan,
      governance: phase18Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation() {
    const implementationPlan = await buildRuntimeImplementationPlan();
    const adapterInterface = {
      interfaceStatus: "scaffold_ready",
      implementationStatus: "interface_scaffold_only",
      adapterModuleStatus: "not_created",
      providerSdkStatus: "not_loaded",
      credentialAccessStatus: "reference_only_value_not_read",
      endpointContactStatus: "not_contacted",
      networkEgressStatus: "disabled",
      liveProviderCallStatus: "disabled",
      methods: [
        {
          name: "buildProviderRequest",
          purpose: "serialize a reviewed OpenClaw provider request envelope",
          implemented: false,
        },
        {
          name: "resolveCredentialReference",
          purpose: "request operator-approved credential value access without exposing values in logs",
          implemented: false,
        },
        {
          name: "sendProviderRequest",
          purpose: "perform a bounded network egress call after explicit launch authorization",
          implemented: false,
        },
        {
          name: "recordEgressTranscript",
          purpose: "append a live provider-call transcript without credential leakage",
          implemented: false,
        },
        {
          name: "verifyProviderResponse",
          purpose: "turn the provider response into readback evidence",
          implemented: false,
        },
        {
          name: "buildRollbackNote",
          purpose: "record operator-visible rollback and retry guidance",
          implemented: false,
        },
      ],
    };
    const checks = [
      {
        id: "phase-17-implementation-plan-ready",
        label: "Phase 17 runtime implementation plan is ready",
        passed: implementationPlan.summary?.ready === true,
        evidence: implementationPlan.registry,
      },
      {
        id: "adapter-interface-methods-defined",
        label: "Runtime adapter interface scaffold defines the required future methods",
        passed: adapterInterface.methods.length >= 6
          && adapterInterface.methods.every((method) => method.implemented === false),
        evidence: `${adapterInterface.methods.length} method(s)`,
      },
      {
        id: "interface-only-no-live-activity",
        label: "Interface scaffold does not load SDKs, read credentials, contact endpoints, or transmit externally",
        passed: adapterInterface.implementationStatus === "interface_scaffold_only"
          && adapterInterface.providerSdkStatus === "not_loaded"
          && adapterInterface.credentialAccessStatus === "reference_only_value_not_read"
          && adapterInterface.networkEgressStatus === "disabled",
        evidence: adapterInterface.implementationStatus,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-v0",
      mode: "phase_20_live_provider_runtime_adapter_implementation_interface_scaffold",
      generatedAt: new Date().toISOString(),
      status: ready ? "runtime_adapter_interface_scaffold_ready_no_live_egress" : "waiting_for_runtime_adapter_interface_prerequisites",
      governance: phase20Governance(),
      adapterInterface,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-20",
        definesRuntimeAdapterInterface: true,
        implementsRuntimeAdapter: false,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        liveProviderCallEnabled: false,
        networkEgress: false,
        createsTask: false,
      },
      evidence: {
        implementationPlan: {
          registry: implementationPlan.registry,
          ready: implementationPlan.summary?.ready ?? null,
          completionPercent: implementationPlan.summary?.completionPercent ?? null,
        },
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-task",
        boundary: "a separate approval-gated implementation task is required before code creation, SDK loading, credential value reads, endpoint contact, or network egress",
      },
    };
  }

  return {
    createCloudConsciousnessLiveProviderRuntimeImplementationTask,
    isCloudConsciousnessLiveProviderRuntimeImplementationTask,
    executeCloudConsciousnessLiveProviderRuntimeImplementationTask,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation,
  };
}
