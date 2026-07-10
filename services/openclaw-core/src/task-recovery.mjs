import { randomUUID } from "node:crypto";

const OPERATOR_INVOKABLE_CAPABILITIES = new Set([
  "sense.system.vitals",
  "sense.filesystem.read",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
  "act.filesystem.mkdir",
  "sense.process.list",
  "act.system.command.dry_run",
  "act.system.command.execute",
  "act.system.heal",
]);

export function planCapabilityActionSteps(task) {
  return (task.plan?.steps ?? [])
    .filter((step) => step.phase === "acting_on_target" && OPERATOR_INVOKABLE_CAPABILITIES.has(step.capabilityId));
}

export function isNativePluginRuntimeActivationTask(task) {
  return task?.type === "native_plugin_runtime_activation"
    && task?.plan?.strategy === "native-plugin-runtime-activation-v0";
}

export function isNativePluginRuntimeAdapterTask(task) {
  return task?.type === "native_plugin_runtime_adapter_implementation"
    && task?.plan?.strategy === "native-plugin-runtime-adapter-v0";
}

export function isNativePluginRuntimeRefreshTask(task) {
  return task?.type === "native_plugin_runtime_refresh"
    && task?.plan?.strategy === "native-plugin-runtime-refresh-v0";
}

export function isNativeAcpxCodexBridgeWrapperTask(task) {
  return task?.type === "native_acpx_codex_bridge_wrapper_action"
    && task?.plan?.strategy === "acpx-codex-bridge-wrapper-action-v0";
}

export function isNativeAcpxCodexBridgeProcessSpawnTask(task) {
  return task?.type === "native_acpx_codex_bridge_process_spawn"
    && task?.plan?.strategy === "acpx-codex-bridge-process-spawn-v0";
}

export function isOpenClawSearchWebAdapterTask(task) {
  return task?.type === "openclaw_search_web_adapter_invocation"
    && task?.plan?.strategy === "openclaw-search-web-adapter-v0";
}

export function isOpenClawSearchWebRuntimeActivationTask(task) {
  return task?.type === "openclaw_search_web_runtime_activation"
    && task?.plan?.strategy === "openclaw-search-web-runtime-activation-v0";
}

export function isOpenClawSearchWebProviderRuntimeSandboxTask(task) {
  return task?.type === "openclaw_search_web_provider_runtime_sandbox"
    && task?.plan?.strategy === "openclaw-search-web-provider-runtime-sandbox-v0";
}

export function hasRecoverableCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

export function hasRecoverableNativePluginRuntimeActivationPlan(task) {
  return (isNativePluginRuntimeActivationTask(task) || isNativePluginRuntimeAdapterTask(task))
    && task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
    && task?.plan?.governance?.canReadSourceFileContent === false
    && task?.plan?.governance?.canImportModule === false
    && task?.plan?.governance?.canExecutePluginCode === false
    && task?.plan?.governance?.canActivateRuntime === false;
}

export function hasRecoverableSearchWebAdapterPlan(task) {
  const hasDeferredBoundary = isOpenClawSearchWebAdapterTask(task)
    ? task?.plan?.governance?.requiresRuntimePreflightBeforeExecution === true
    : isOpenClawSearchWebRuntimeActivationTask(task)
      ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
      : isOpenClawSearchWebProviderRuntimeSandboxTask(task)
        ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
        : false;
  return hasDeferredBoundary
    && task?.plan?.governance?.canUseNetwork === false
    && task?.plan?.governance?.canExecutePluginCode === false;
}

export function isRecoverableTask(task) {
  if (!["completed", "failed", "superseded"].includes(task.status)) {
    return false;
  }

  if (typeof task.targetUrl === "string" && task.targetUrl.trim().length > 0) {
    return true;
  }

  return hasRecoverableCapabilityPlan(task)
    || hasRecoverableNativePluginRuntimeActivationPlan(task)
    || hasRecoverableSearchWebAdapterPlan(task);
}

export function hasRecoverableBrowserPlan(task) {
  return task?.type === "browser_task"
    && task?.plan?.strategy === "rule-v1"
    && (task.plan.steps ?? []).some((step) => step.phase === "acting_on_target");
}

export function buildEyeHandRecoveryEvidence(task, reason, details = null) {
  if (!details || typeof details !== "object") {
    return null;
  }

  if (details.authorityInterruption?.recoverable === true) {
    return {
      kind: "work-view-authority-recovery-evidence",
      sourceTaskId: task.id,
      reason,
      interruption: { ...details.authorityInterruption },
      targetUrl: details.targetUrl ?? task.targetUrl ?? null,
      recommendation: {
        strategy: "restore_trusted_work_view_then_recover_task",
        targetUrl: details.targetUrl ?? task.targetUrl ?? null,
        automaticRestart: false,
      },
    };
  }

  const verification = details.verification ?? null;
  const actionEvidence = details.actionEvidence ?? verification?.actionEvidence ?? null;
  const workViewSummary = details.workViewSummary ?? verification?.workViewSummary ?? null;

  if (!actionEvidence && !workViewSummary) {
    return null;
  }

  const failedChecks = (verification?.failedChecks ?? []).map((check) => ({
    name: check.name ?? null,
    expected: check.expected ?? null,
    actual: check.actual ?? null,
  }));
  const observedUrl = actionEvidence?.observedAfterActions?.url ?? workViewSummary?.url ?? details.targetUrl ?? task.targetUrl ?? null;

  return {
    kind: "eye-hand-recovery-evidence",
    sourceTaskId: task.id,
    reason,
    failedChecks,
    targetUrl: details.targetUrl ?? task.targetUrl ?? null,
    observedUrl,
    actionEvidence,
    workViewSummary,
    recommendation: {
      strategy: "retry_with_fresh_observation",
      targetUrl: observedUrl,
      rationale: failedChecks.length > 0
        ? `Recover by re-opening the work view and re-verifying failed check(s): ${failedChecks.map((check) => check.name).join(", ")}.`
        : "Recover by re-opening the work view and re-checking the latest observation after the recorded action sequence.",
    },
  };
}

function clonePlainObject(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

export function buildRecoveredPolicyRequest(sourceTask) {
  const request = clonePlainObject(sourceTask.policy?.request ?? sourceTask.policy ?? {});
  delete request.approved;
  return request;
}

export function resetRecoveredPlan(plan, {
  now = () => new Date().toISOString(),
  createId = randomUUID,
  preserveCompletedActionSteps = false,
} = {}) {
  const timestamp = now();
  const recoveredPlan = clonePlainObject(plan);
  recoveredPlan.planId = `plan-${createId()}`;
  recoveredPlan.status = "planned";
  recoveredPlan.createdAt = timestamp;
  recoveredPlan.updatedAt = timestamp;
  delete recoveredPlan.failure;

  if (Array.isArray(recoveredPlan.steps)) {
    recoveredPlan.steps = recoveredPlan.steps.map((step) => {
      if (preserveCompletedActionSteps && step.phase === "acting_on_target" && step.status === "completed") {
        return step;
      }
      const recoveredStep = {
        ...step,
        status: "pending",
      };
      delete recoveredStep.completedAt;
      delete recoveredStep.details;
      return recoveredStep;
    });
  }

  return recoveredPlan;
}

export function createTaskRecovery({
  tasks,
  createTask,
  persistState,
  now = () => new Date().toISOString(),
  createId = randomUUID,
} = {}) {
  function recoverTask(sourceTask) {
    if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
      throw new Error(`Task already has a recovery task: ${sourceTask.recoveredByTaskId}`);
    }

    const recoveryAttempt = (sourceTask.recovery?.attempt ?? 0) + 1;
    const recoverableCapabilityPlan = hasRecoverableCapabilityPlan(sourceTask);
    const recoverableNativePluginRuntimeActivationPlan = hasRecoverableNativePluginRuntimeActivationPlan(sourceTask);
    const recoverableSearchWebAdapterPlan = hasRecoverableSearchWebAdapterPlan(sourceTask);
    const recoverableBrowserPlan = hasRecoverableBrowserPlan(sourceTask);
    const shouldRecoverExistingPlan = recoverableCapabilityPlan
      || recoverableNativePluginRuntimeActivationPlan
      || recoverableSearchWebAdapterPlan
      || recoverableBrowserPlan;
    const recoveryBody = {
      goal: sourceTask.goal,
      type: sourceTask.type,
      targetUrl: sourceTask.targetUrl,
      workViewStrategy: sourceTask.workViewStrategy,
      includePlan: Boolean(sourceTask.plan) && !shouldRecoverExistingPlan,
      recovery: {
        recoveredFromTaskId: sourceTask.id,
        recoveredFromOutcome: sourceTask.outcome?.kind ?? sourceTask.status,
        attempt: recoveryAttempt,
        recoveryEvidence: sourceTask.outcome?.details?.recoveryEvidence ?? null,
      },
    };

    if (shouldRecoverExistingPlan) {
      recoveryBody.plan = resetRecoveredPlan(sourceTask.plan, {
        now,
        createId,
        preserveCompletedActionSteps: recoverableBrowserPlan,
      });
      recoveryBody.policy = buildRecoveredPolicyRequest(sourceTask);
    }
    if (sourceTask.sourceCommand && typeof sourceTask.sourceCommand === "object") {
      recoveryBody.sourceCommand = sourceTask.sourceCommand;
    }
    if (sourceTask.engineeringPlanTodoSuggestionLink && typeof sourceTask.engineeringPlanTodoSuggestionLink === "object") {
      recoveryBody.engineeringPlanTodoSuggestionLink = sourceTask.engineeringPlanTodoSuggestionLink;
    }

    const recoveredTask = createTask(recoveryBody);

    sourceTask.recoveredByTaskId = recoveredTask.id;
    sourceTask.updatedAt = now();
    persistState();
    return recoveredTask;
  }

  return {
    recoverTask,
    isRecoverableTask,
    hasRecoverableCapabilityPlan,
    hasRecoverableNativePluginRuntimeActivationPlan,
    hasRecoverableSearchWebAdapterPlan,
    hasRecoverableBrowserPlan,
    buildEyeHandRecoveryEvidence,
  };
}
