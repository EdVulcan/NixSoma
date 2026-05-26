import { buildCloudLiveProviderRuntimeAdapterModuleContract } from "./cloud-live-provider-runtime-adapter.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_IMPLEMENTATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-implementation-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_IMPLEMENTATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_MODULE_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0";

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

function phase21Governance(extra = {}) {
  return {
    phase: "phase-21",
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

function phase24Governance(extra = {}) {
  return {
    phase: "phase-24",
    moduleBoundaryDefined: true,
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

function phase25Governance(extra = {}) {
  return {
    phase: "phase-25",
    createsTask: false,
    createsApproval: false,
    moduleBoundaryDefined: true,
    mutatesModule: false,
    writesSource: false,
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

  async function createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter implementation task creation requires confirm=true.");
    }

    const adapterImplementation = await buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation();
    if (adapterImplementation.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter implementation task requires a ready Phase 20 adapter interface scaffold.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.runtime_adapter_implementation",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "runtime_adapter_implementation_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider-call runtime adapter implementation task without enabling egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_runtime_adapter_implementation_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_runtime_adapter_implementation_task.draft",
      type: "cloud_consciousness_live_provider_runtime_adapter_implementation_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_runtime_adapter_implementation_task",
      workViewStrategy: "cloud-consciousness-live-provider-runtime-adapter-implementation",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-implementation-shell",
        summary: "Create an approval-gated runtime adapter implementation task shell while keeping provider SDK, credentials, endpoint contact, and network egress disabled.",
        governance: phase21Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-runtime-adapter-interface-scaffold",
            phase: "review_live_provider_runtime_adapter_implementation_interface",
            title: "Review Phase 20 runtime adapter implementation interface scaffold",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before runtime adapter implementation work can be considered",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-runtime-adapter-implementation",
            phase: "cloud_consciousness_live_provider_runtime_adapter_implementation_deferred",
            title: "Record approved implementation shell and defer SDK, credential, endpoint, and network work",
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
    task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_IMPLEMENTATION_TASK_REGISTRY,
      adapterImplementationRegistry: adapterImplementation.registry,
      implementationStatus: "task_shell_only",
      definesRuntimeAdapterInterface: true,
      implementsRuntimeAdapter: false,
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
      planner: "cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_IMPLEMENTATION_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-implementation-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: adapterImplementation.registry,
      adapterImplementation,
      task,
      approval,
      governance: phase21Governance({ createsTask: true, createsApproval: true }),
    };
  }

  async function buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract() {
    const adapterImplementation = await buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation();
    const moduleContract = buildCloudLiveProviderRuntimeAdapterModuleContract();
    const checks = [
      {
        id: "phase-20-interface-scaffold-ready",
        label: "Phase 20 runtime adapter implementation interface scaffold is ready",
        passed: adapterImplementation.summary?.ready === true,
        evidence: adapterImplementation.registry,
      },
      {
        id: "module-boundary-defined",
        label: "Runtime adapter code boundary is defined in a dedicated module",
        passed: moduleContract.summary?.moduleBoundaryDefined === true
          && moduleContract.module === "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs",
        evidence: moduleContract.module,
      },
      {
        id: "contract-only-no-live-activity",
        label: "Runtime adapter module remains contract-only with no live provider activity",
        passed: moduleContract.summary?.implementsRuntimeAdapter === false
          && moduleContract.summary?.providerSdkLoaded === false
          && moduleContract.summary?.credentialValueRead === false
          && moduleContract.summary?.endpointContacted === false
          && moduleContract.summary?.networkEgress === false
          && moduleContract.summary?.liveProviderCallEnabled === false,
        evidence: moduleContract.implementationStatus,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: moduleContract.registry,
      mode: "phase_24_live_provider_runtime_adapter_module_contract",
      generatedAt: new Date().toISOString(),
      status: ready ? "runtime_adapter_module_contract_ready_no_live_egress" : "waiting_for_runtime_adapter_module_contract_prerequisites",
      governance: phase24Governance(),
      moduleContract,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-24",
        moduleBoundaryDefined: moduleContract.summary?.moduleBoundaryDefined === true,
        methodCount: moduleContract.summary?.methodCount ?? 0,
        implementedMethodCount: moduleContract.summary?.implementedMethodCount ?? 0,
        implementsRuntimeAdapter: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        networkEgress: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        adapterImplementation: {
          registry: adapterImplementation.registry,
          ready: adapterImplementation.summary?.ready ?? null,
          completionPercent: adapterImplementation.summary?.completionPercent ?? null,
        },
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task",
        boundary: "a separate approval-gated task is required before adding executable adapter code or provider egress",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter module task creation requires confirm=true.");
    }

    const moduleContract = await buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract();
    if (moduleContract.summary?.ready !== true) {
      throw new Error("Cloud consciousness live provider runtime adapter module task requires a ready Phase 24 module contract.");
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.runtime_adapter_module",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "runtime_adapter_module_task", "operator_reviewed"],
    };
    const goal = "Prepare reviewed live provider runtime adapter module task without mutating code or enabling egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_runtime_adapter_module_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_runtime_adapter_module_task.draft",
      type: "cloud_consciousness_live_provider_runtime_adapter_module_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_runtime_adapter_module_task",
      workViewStrategy: "cloud-consciousness-live-provider-runtime-adapter-module",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-module-shell",
        summary: "Create an approval-gated runtime adapter module task shell while keeping source mutation, SDK loading, credentials, endpoint contact, and network egress disabled.",
        governance: phase25Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-runtime-adapter-module-contract",
            phase: "review_live_provider_runtime_adapter_module_contract",
            title: "Review Phase 24 runtime adapter module contract",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before runtime adapter module work can be considered",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-runtime-adapter-module-work",
            phase: "cloud_consciousness_live_provider_runtime_adapter_module_deferred",
            title: "Record approved module task shell and defer source mutation, SDK, credential, endpoint, and network work",
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
    task.cloudConsciousnessLiveProviderRuntimeAdapterModule = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_MODULE_TASK_REGISTRY,
      moduleContractRegistry: moduleContract.registry,
      modulePath: moduleContract.moduleContract?.module ?? "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs",
      implementationStatus: "task_shell_only",
      moduleBoundaryDefined: true,
      mutatesModule: false,
      writesSource: false,
      implementsRuntimeAdapter: false,
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
      planner: "cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
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
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_MODULE_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-module-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: moduleContract.registry,
      moduleContract,
      task,
      approval,
      governance: phase25Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderRuntimeAdapterModuleTask(task) {
    return task?.type === "cloud_consciousness_live_provider_runtime_adapter_module_task"
      && task?.cloudConsciousnessLiveProviderRuntimeAdapterModule?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_MODULE_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask(task) {
    const moduleContract = await buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract();
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

    task.cloudConsciousnessLiveProviderRuntimeAdapterModule = {
      ...(task.cloudConsciousnessLiveProviderRuntimeAdapterModule ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      moduleBoundaryDefined: true,
      mutatesModule: false,
      writesSource: false,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_runtime_adapter_module_deferred", {
      moduleContractRegistry: moduleContract.registry,
      modulePath: moduleContract.moduleContract?.module ?? "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs",
      deferredSlice: "openclaw-cloud-consciousness-approved-live-provider-runtime-adapter-module-deferred",
      reason: "runtime adapter module task approved; source mutation, SDK, credential, endpoint, network, and live call remain deferred",
      mutatesModule: false,
      writesSource: false,
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
      summary: "Approved runtime adapter module task shell recorded; executable adapter code remains deferred.",
      moduleContractRegistry: moduleContract.registry,
      phase: "cloud_consciousness_live_provider_runtime_adapter_module_deferred",
      mutatesModule: false,
      writesSource: false,
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
      moduleContract: {
        registry: moduleContract.registry,
        ready: moduleContract.summary?.ready ?? null,
      },
    });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
      status: "runtime_adapter_module_deferred_after_approval",
      task,
      moduleContract,
      governance: phase25Governance({ createsTask: true, createsApproval: true }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        mutatesModule: false,
        writesSource: false,
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

  function isCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask(task) {
    return task?.type === "cloud_consciousness_live_provider_runtime_adapter_implementation_task"
      && task?.cloudConsciousnessLiveProviderRuntimeAdapterImplementation?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_IMPLEMENTATION_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask(task) {
    const adapterImplementation = await buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation();
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

    task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation = {
      ...(task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      definesRuntimeAdapterInterface: true,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_runtime_adapter_implementation_deferred", {
      adapterImplementationRegistry: adapterImplementation.registry,
      deferredSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-approved-deferred",
      reason: "runtime adapter implementation shell approved; SDK, credential, endpoint, network, and live call remain deferred",
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
      summary: "Approved runtime adapter implementation task shell recorded; live provider runtime adapter remains deferred.",
      adapterImplementationRegistry: adapterImplementation.registry,
      phase: "cloud_consciousness_live_provider_runtime_adapter_implementation_deferred",
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
      adapterImplementation: {
        registry: adapterImplementation.registry,
        ready: adapterImplementation.summary?.ready ?? null,
      },
    });
    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0",
      status: "runtime_adapter_implementation_deferred_after_approval",
      task,
      adapterImplementation,
      governance: phase21Governance({ createsTask: true, createsApproval: true }),
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

  return {
    createCloudConsciousnessLiveProviderRuntimeImplementationTask,
    isCloudConsciousnessLiveProviderRuntimeImplementationTask,
    executeCloudConsciousnessLiveProviderRuntimeImplementationTask,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation,
    buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract,
    createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
  };
}
