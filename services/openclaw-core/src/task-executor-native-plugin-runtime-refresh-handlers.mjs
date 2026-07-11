import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { isNativePluginRuntimeRefreshTask } from "./task-recovery.mjs";

export const NATIVE_PLUGIN_RUNTIME_REFRESH_EXECUTION_REGISTRY = "openclaw-native-plugin-runtime-refresh-task-execution-v0";

function isApproved(task, approvals) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || task?.approval?.status === "approved"
    || approval?.status === "approved";
}

function compactRuntimeRefreshExecutionEvidence(evidence) {
  return {
    registry: evidence?.registry ?? null,
    mode: evidence?.mode ?? null,
    generatedAt: evidence?.generatedAt ?? null,
    capability: evidence?.capability ?? null,
    runtimeState: evidence?.runtimeState ?? null,
    summary: evidence?.summary ?? null,
    governance: evidence?.governance ?? null,
    auditEvidence: evidence?.auditEvidence ?? null,
    deferredExecutionBoundaries: evidence?.deferredExecutionBoundaries ?? [],
  };
}

function buildRuntimeRefreshExecutionRecord({ task, evidence, approval }) {
  const generatedAt = new Date().toISOString();
  return {
    registry: NATIVE_PLUGIN_RUNTIME_REFRESH_EXECUTION_REGISTRY,
    mode: "approval-gated-native-plugin-runtime-refresh-execution",
    generatedAt,
    taskId: task.id,
    approvalId: approval?.id ?? task.approval?.requestId ?? null,
    approved: true,
    readModelRefreshed: evidence?.summary?.readModelRefreshed === true,
    validationOk: evidence?.summary?.validationOk === true,
    runtimeState: evidence?.runtimeState ?? null,
    runtimeRefreshEvidence: compactRuntimeRefreshExecutionEvidence(evidence),
    governance: {
      mode: "native_plugin_runtime_refresh_task_approved_execution",
      runtimeOwner: "openclaw_on_nixos",
      canRefreshReadModel: true,
      canInvalidateDiscoveryCache: false,
      canInvalidateModuleCache: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutatePluginInstallState: false,
      canCallProvider: false,
      executedPluginCode: false,
      activatedRuntime: false,
    },
    auditEvidence: {
      operation: "plugin_runtime_refresh_task_execution",
      capabilityId: "act.openclaw.plugin_runtime.refresh_task",
      approved: true,
      readModelRefreshed: evidence?.summary?.readModelRefreshed === true,
      generatedAt,
      persisted: true,
      evidenceKind: "task_outcome_embedded_audit_evidence",
    },
  };
}

export function createNativePluginRuntimeRefreshTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  publishEvent,
}) {
  const { approvals } = state;
  const { serialiseTask, isActiveTask, setTaskPhase, completeTask } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy } = policyEvaluator;

  async function executeNativePluginRuntimeRefreshTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("Native plugin runtime refresh task is not active.");
    }

    const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_refresh.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!isApproved(task, approvals)) {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: "native-plugin-runtime-refresh-v0",
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          canRefreshReadModel: true,
          canImportModule: false,
          canActivateRuntime: false,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: "native-plugin-runtime-refresh-v0",
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: null,
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        governance: {
          mode: "native_plugin_runtime_refresh_waiting_for_approval",
          executed: false,
          canRefreshReadModel: true,
          canImportModule: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
        },
      };
    }

    await setTaskPhase(task, "runtime_read_model_refresh", {
      status: "running",
      details: {
        executor: "native-plugin-runtime-refresh-v0",
        approvalId: approval?.id ?? task.approval?.requestId ?? null,
        canRefreshReadModel: true,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
      },
    });
    const metadata = task.nativePluginRuntimeRefresh ?? {};
    const refresh = planBuilder.refreshNativePluginRuntimeRegistry();
    if (!refresh.ok || !refresh.swapped) {
      throw new Error("Native plugin registry generation refresh validation failed.");
    }
    const evidence = planBuilder.buildNativePluginRuntimeRefreshEvidence({
      packagePath: metadata.packagePath ?? null,
      capabilityId: metadata.capabilityId ?? "act.plugin.capability.invoke",
    });
    const execution = {
      ...buildRuntimeRefreshExecutionRecord({ task, evidence, approval }),
      generation: {
        previousId: refresh.previous?.id ?? null,
        currentId: refresh.active.id,
        previousHash: refresh.previous?.hash ?? null,
        currentHash: refresh.active.hash,
        swapped: true,
      },
    };
    task.nativePluginRuntimeRefresh = {
      ...metadata,
      registry: metadata.registry ?? "openclaw-native-plugin-runtime-refresh-task-v0",
      mode: metadata.mode ?? "approval-gated-native-plugin-runtime-refresh-task",
      runtimeRefreshEvidence: execution.runtimeRefreshEvidence,
      execution,
      governance: {
        ...(metadata.governance ?? {}),
        executed: true,
        canRefreshReadModel: true,
        canInvalidateDiscoveryCache: false,
        canInvalidateModuleCache: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutatePluginInstallState: false,
      },
    };
    const completedTask = completeTask(task, {
      executor: "native-plugin-runtime-refresh-v0",
      summary: "Native plugin runtime refresh read model recomputed after approval.",
      runtimeRefreshExecution: execution,
      verification: {
        ok: execution.readModelRefreshed === true,
        checks: [
          {
            name: "read_model_refreshed",
            ok: execution.readModelRefreshed === true,
            expected: true,
            actual: execution.readModelRefreshed === true,
          },
          {
            name: "plugin_module_import_blocked",
            ok: execution.governance.canImportModule === false,
            expected: false,
            actual: execution.governance.canImportModule,
          },
          {
            name: "runtime_activation_blocked",
            ok: execution.governance.canActivateRuntime === false,
            expected: false,
            actual: execution.governance.canActivateRuntime,
          },
        ],
      },
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "native-plugin-runtime-refresh-v0",
      runtimeRefreshExecution: execution,
    });

    return {
      task: completedTask,
      blocked: false,
      reason: null,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: completedTask.outcome?.details?.verification ?? null,
      execution,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: execution.governance,
    };
  }

  return [
    {
      name: "native-plugin-runtime-refresh",
      predicate: isNativePluginRuntimeRefreshTask,
      execute: executeNativePluginRuntimeRefreshTask,
    },
  ];
}
