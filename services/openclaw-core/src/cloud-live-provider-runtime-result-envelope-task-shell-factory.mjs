const DEFAULT_CREDENTIAL_REFERENCE = "openclaw://credential/provider/live-provider-fixture";

export function resultEnvelopeTaskShellDeferredCredentialFlags() {
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

function sourceReadinessFields(route, fields) {
  const summary = route.summary ?? {};
  return Object.fromEntries(fields.map((field) => [field, summary[field] === true]));
}

function taskShellResponseStatus(slug) {
  return slug
    .replace(/^openclaw-cloud-consciousness-live-provider-/, "")
    .replace(/-/g, "_");
}

export function createResultEnvelopeTaskShellRuntime(context, config) {
  const {
    buildRoute,
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
  } = context;

  const {
    createName,
    predicateName,
    executeName,
    routeRegistry,
    taskRegistry,
    taskSlug,
    approvedDeferredSlug,
    taskType,
    taskField,
    taskDeferredPhase,
    phaseGovernance,
    taskCreatedField,
    taskApprovedField,
    taskDeferredField,
    sourceReadinessFieldNames,
    routeReadyError,
    policyIntent,
    policyTags,
    goal,
    workViewStrategy,
    planner,
    strategy,
    planSummary,
    reviewStep,
    approvalStepTitle,
    deferredStep,
    mode,
    executor,
    sourcePhase,
    deferredReason,
    completionSummary,
  } = config;

  async function createTaskShell({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error(`${goal} requires confirm=true.`);
    }

    const route = await buildRoute();
    if (route.summary?.ready !== true || route.next?.recommendedSlice !== taskSlug) {
      throw new Error(routeReadyError);
    }

    const policyRequest = {
      intent: policyIntent,
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: policyTags,
    };
    const policyDecision = evaluatePolicyIntent({
      type: taskType,
      goal,
      policy: policyRequest,
    }, {
      stage: `${policyIntent}.draft`,
      type: taskType,
      goal,
    });

    const task = createTask({
      goal,
      type: taskType,
      workViewStrategy,
      policy: policyRequest,
      plan: {
        planner,
        strategy,
        summary: planSummary,
        governance: phaseGovernance({
          createsTask: true,
          createsApproval: true,
          [taskCreatedField]: true,
        }),
        steps: [
          reviewStep,
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: approvalStepTitle,
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          deferredStep,
        ],
      },
    }, { skipInitialPolicy: true });

    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task[taskField] = {
      registry: taskRegistry,
      sourceRegistry: routeRegistry,
      sourceTaskId: route.summary?.sourceTaskId ?? null,
      implementationStatus: "task_shell_only",
      credentialReference: route.decision?.credentialReference ?? DEFAULT_CREDENTIAL_REFERENCE,
      ...sourceReadinessFields(route, sourceReadinessFieldNames),
      [taskCreatedField]: true,
      [taskApprovedField]: false,
      [taskDeferredField]: true,
      ...resultEnvelopeTaskShellDeferredCredentialFlags(),
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner,
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
      registry: taskRegistry,
      mode,
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeRegistry,
      route,
      task,
      approval,
      governance: phaseGovernance({
        createsTask: true,
        createsApproval: true,
        [taskCreatedField]: true,
      }),
    };
  }

  function isTask(task) {
    return task?.type === taskType
      && task?.[taskField]?.registry === taskRegistry;
  }

  async function executeTask(task) {
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
    task[taskField] = {
      ...(task[taskField] ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      [taskCreatedField]: true,
      [taskApprovedField]: true,
      [taskDeferredField]: true,
      ...resultEnvelopeTaskShellDeferredCredentialFlags(),
    };
    appendTaskPhase(task, taskDeferredPhase, {
      taskRegistry,
      recordedAt,
      sourcePhase,
      deferredSlice: approvedDeferredSlug,
      reason: deferredReason,
      [taskCreatedField]: true,
      [taskApprovedField]: true,
      [taskDeferredField]: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: completionSummary,
      taskRegistry,
      phase: taskDeferredPhase,
      [taskCreatedField]: true,
      [taskApprovedField]: true,
      [taskDeferredField]: true,
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
      executor,
      status: `${taskShellResponseStatus(taskSlug)}_deferred_after_approval`,
      task,
      governance: phaseGovernance({
        createsTask: true,
        createsApproval: true,
        [taskCreatedField]: true,
        [taskApprovedField]: true,
      }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        [taskCreatedField]: true,
        [taskApprovedField]: true,
        [taskDeferredField]: true,
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

  return {
    [createName]: createTaskShell,
    [predicateName]: isTask,
    [executeName]: executeTask,
  };
}
