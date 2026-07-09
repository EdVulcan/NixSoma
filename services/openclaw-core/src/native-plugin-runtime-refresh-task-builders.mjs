import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export const NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY = "openclaw-native-plugin-runtime-refresh-task-v0";
export const NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_DRAFT_REGISTRY = "openclaw-native-plugin-runtime-refresh-task-draft-v0";

function compactRuntimeRefreshEvidence(evidence) {
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

export function createNativePluginRuntimeRefreshTaskBuilders(deps) {
  const {
    buildNativePluginRuntimeRefreshEvidence,
    autonomyMode,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
  } = deps;

  function buildNativePluginRuntimeRefreshTaskDraft({
    packagePath = null,
    capabilityId = "act.plugin.capability.invoke",
  } = {}) {
    const refreshEvidence = buildNativePluginRuntimeRefreshEvidence({ packagePath, capabilityId });
    const now = new Date().toISOString();
    const policyRequest = {
      intent: "plugin.runtime_refresh",
      domain: "body_internal",
      risk: "medium",
      requiresApproval: true,
      approved: false,
      capabilityId: "act.openclaw.plugin_runtime.refresh_task",
      tags: [
        "native_plugin_runtime_refresh",
        "explicit_approval_required",
        "read_model_refresh_only",
      ],
    };
    const policyDecision = {
      id: randomUUID(),
      at: now,
      engine: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY,
      stage: "native_plugin.runtime_refresh.task.materialize",
      subject: {
        taskId: null,
        type: "native_plugin_runtime_refresh",
        goal: "Recompute native plugin runtime read-model evidence after approval",
        targetUrl: null,
        intent: policyRequest.intent,
      },
      domain: policyRequest.domain,
      risk: policyRequest.risk,
      decision: "require_approval",
      reason: "native_plugin_runtime_refresh_requires_explicit_user_approval_before_lifecycle_action",
      approved: false,
      autonomyMode,
      autonomous: false,
    };
    const plan = {
      planId: `plan-${randomUUID()}`,
      strategy: "native-plugin-runtime-refresh-v0",
      planner: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY,
      capabilityAware: true,
      status: "planned",
      goal: policyDecision.subject.goal,
      targetUrl: null,
      intent: policyRequest.intent,
      createdAt: now,
      updatedAt: now,
      capabilitySummary: {
        total: 3,
        approvalGates: 1,
        ids: [
          "sense.openclaw.plugin_runtime.refresh_evidence",
          "govern.policy.evaluate",
          "act.openclaw.plugin_runtime.refresh_task",
        ],
        byRisk: {
          low: 1,
          medium: 2,
        },
      },
      steps: [
        {
          id: "step-review-runtime-refresh-evidence",
          kind: "openclaw.native_plugin.runtime_refresh_evidence",
          phase: "reviewing_runtime_refresh_evidence",
          title: "Review native plugin runtime refresh read-model evidence",
          status: "pending",
          capabilityId: "sense.openclaw.plugin_runtime.refresh_evidence",
          risk: "low",
          governance: "audit_only",
          requiresApproval: false,
          params: {
            sourceRegistry: refreshEvidence.registry,
            readModelRefreshed: refreshEvidence.summary?.readModelRefreshed === true,
            validationOk: refreshEvidence.summary?.validationOk === true,
          },
        },
        {
          id: "step-user-approval",
          kind: "approval.gate",
          phase: "waiting_for_approval",
          title: "Wait for explicit user approval before runtime refresh lifecycle action",
          status: "pending",
          capabilityId: "govern.policy.evaluate",
          risk: "medium",
          governance: "require_approval",
          requiresApproval: true,
        },
        {
          id: "step-refresh-runtime-read-model",
          kind: "plugin.runtime_refresh",
          phase: "runtime_read_model_refresh",
          title: "Recompute native plugin runtime read model without loading plugin modules",
          status: "pending",
          capabilityId: "act.openclaw.plugin_runtime.refresh_task",
          risk: "medium",
          governance: "require_approval",
          requiresApproval: true,
          params: {
            packagePath,
            capabilityId,
            canRefreshReadModel: true,
            canInvalidateDiscoveryCache: false,
            canInvalidateModuleCache: false,
            canImportModule: false,
            canExecutePluginCode: false,
            canActivateRuntime: false,
            canMutatePluginInstallState: false,
          },
        },
      ],
      governance: {
        mode: "native_plugin_runtime_refresh_task_plan",
        runtimeOwner: "openclaw_on_nixos",
        canRefreshReadModel: true,
        canInvalidateDiscoveryCache: false,
        canInvalidateModuleCache: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutatePluginInstallState: false,
        requiresExplicitApproval: true,
      },
    };

    return {
      ok: true,
      registry: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_DRAFT_REGISTRY,
      mode: "approval-gated-native-plugin-runtime-refresh-task-draft",
      generatedAt: now,
      sourceRegistry: refreshEvidence.registry,
      sourceMode: refreshEvidence.mode,
      runtimeRefreshEvidence: compactRuntimeRefreshEvidence(refreshEvidence),
      plan,
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      governance: {
        mode: "native_plugin_runtime_refresh_task_draft",
        runtimeOwner: "openclaw_on_nixos",
        createsTask: false,
        createsApproval: false,
        canExecuteWithoutApproval: false,
        canRefreshReadModel: true,
        canInvalidateDiscoveryCache: false,
        canInvalidateModuleCache: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutatePluginInstallState: false,
        requiresExplicitApprovalBeforeRuntimeRefresh: true,
      },
    };
  }

  async function createNativePluginRuntimeRefreshTask({
    packagePath = null,
    capabilityId = "act.plugin.capability.invoke",
    confirm = false,
  } = {}) {
    if (confirm !== true) {
      throw new Error("Native plugin runtime refresh task creation requires confirm=true.");
    }

    const draft = buildNativePluginRuntimeRefreshTaskDraft({ packagePath, capabilityId });
    const task = createTask({
      goal: draft.plan.goal,
      type: "native_plugin_runtime_refresh",
      workViewStrategy: "native-plugin-runtime-refresh",
      plan: draft.plan,
      policy: draft.policy.request,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    task.nativePluginRuntimeRefresh = {
      registry: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY,
      mode: "approval-gated-native-plugin-runtime-refresh-task",
      packagePath,
      capabilityId,
      sourceRegistry: draft.sourceRegistry,
      sourceMode: draft.sourceMode,
      runtimeRefreshEvidence: draft.runtimeRefreshEvidence,
      execution: null,
      governance: draft.governance,
    };
    const approval = createApprovalRequestForTask(task, draft.policy.decision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_REGISTRY,
      mode: "approval-gated-native-plugin-runtime-refresh-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: draft.registry,
      sourceMode: draft.mode,
      runtimeRefreshEvidence: draft.runtimeRefreshEvidence,
      task,
      approval,
      governance: {
        mode: "native_plugin_runtime_refresh_task_approval_gated",
        runtimeOwner: "openclaw_on_nixos",
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        canRefreshReadModel: true,
        canInvalidateDiscoveryCache: false,
        canInvalidateModuleCache: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutatePluginInstallState: false,
        executed: false,
        requiresExplicitApprovalBeforeRuntimeRefresh: true,
      },
    };
  }

  return {
    buildNativePluginRuntimeRefreshTaskDraft,
    createNativePluginRuntimeRefreshTask,
  };
}
