import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export const NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-task-v0";
export const NATIVE_ENGINEERING_LSP_LIFECYCLE_EXECUTION_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-execution-v0";

function redactedWorkspace(workspace) {
  return {
    id: workspace?.id ?? null,
    name: workspace?.name ?? null,
    path: workspace?.path ?? null,
  };
}

function buildPolicyDecision({ now, goal, autonomyMode }) {
  return {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-engineering-lsp-lifecycle-task-v0",
    stage: "openclaw.native.engineering_lsp_lifecycle.task",
    subject: {
      taskId: null,
      type: "native_engineering_lsp_lifecycle",
      goal,
      targetUrl: null,
      intent: "openclaw.engineering.lsp.lifecycle",
    },
    domain: "body_internal",
    risk: "medium",
    decision: "require_approval",
    reason: "engineering_lsp_lifecycle_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
}

function buildPolicyRequest() {
  return {
    intent: "openclaw.engineering.lsp.lifecycle",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    tags: ["native_engineering", "lsp_lifecycle", "explicit_approval_required"],
  };
}

function buildLifecyclePlan({ buildRulePlan, goal, policyRequest, draft }) {
  const lifecycle = draft.lifecycleDraft;
  const action = {
    kind: "engineering.lsp.lifecycle",
    intent: "openclaw.engineering.lsp.lifecycle",
    params: {
      language: draft.query.language,
      lifecycleAction: draft.query.lifecycleAction,
      workspaceId: draft.workspace.id,
      workspacePath: draft.workspace.path,
      serverBinary: lifecycle.server.serverBinary,
      serverArgs: lifecycle.server.serverArgs,
      sourceDraftRegistry: draft.registry,
      sourceDraftId: lifecycle.id,
      jsonRpcEnabled: false,
    },
  };
  return buildRulePlan({
    goal,
    type: "native_engineering_lsp_lifecycle",
    intent: "openclaw.engineering.lsp.lifecycle",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
}

function buildTaskMetadata(draft) {
  const lifecycle = draft.lifecycleDraft;
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
    sourceRegistry: draft.registry,
    sourceCapabilityId: draft.capability.id,
    draftId: lifecycle.id,
    language: draft.query.language,
    lifecycleAction: draft.query.lifecycleAction,
    workspace: redactedWorkspace(draft.workspace),
    server: {
      serverBinary: lifecycle.server.serverBinary,
      serverArgs: lifecycle.server.serverArgs,
      binaryChecked: false,
      processStarted: false,
      jsonRpcHandshakeSent: false,
    },
    execution: null,
    approvedMutation: false,
    contentExposed: false,
  };
}

export function createNativeEngineeringLspLifecycleTaskBuilders({
  autonomyMode,
  buildNativeEngineeringLspLifecycleDraft,
  buildRulePlan,
  createTask,
  createApprovalRequestForTask,
  persistState,
  publishEvent,
  publishTaskApprovalIfPending,
  reconcileRuntimeState,
  serialisePlanForPublic,
  serialiseTask,
  supersedeOtherActiveTasks,
}) {
  async function createNativeEngineeringLspLifecycleTask({
    workspacePath = null,
    language = "typescript",
    lifecycleAction = "start",
    confirm = false,
  } = {}) {
    if (confirm !== true) {
      throw new Error("Native engineering LSP lifecycle task creation requires confirm=true.");
    }

    const draft = buildNativeEngineeringLspLifecycleDraft({
      workspacePath,
      language,
      lifecycleAction,
    });
    const now = new Date().toISOString();
    const goal = `Run approved OpenClaw LSP lifecycle ${draft.query.lifecycleAction} gate for ${draft.query.language}`;
    const policyRequest = buildPolicyRequest();
    const policyDecision = buildPolicyDecision({ now, goal, autonomyMode });
    const plan = buildLifecyclePlan({ buildRulePlan, goal, policyRequest, draft });

    const task = createTask({
      goal,
      type: "native_engineering_lsp_lifecycle",
      workViewStrategy: "openclaw-native-engineering-lsp-lifecycle",
      plan,
      policy: policyRequest,
    }, { skipInitialPolicy: true });
    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task.engineeringLspLifecycle = buildTaskMetadata(draft);
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", { task: serialiseTask(task), planner: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY });
    await publishTaskApprovalIfPending(task);
    await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
      mode: "approval-gated-lsp-lifecycle-binary-gate",
      generatedAt: new Date().toISOString(),
      sourceRegistry: draft.registry,
      lifecycleDraft: {
        registry: draft.registry,
        mode: draft.mode,
        id: draft.lifecycleDraft.id,
        readinessGates: draft.readinessGates,
      },
      engineeringLspLifecycle: task.engineeringLspLifecycle,
      task,
      approval,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        canStartProcessWithoutApproval: false,
        canSendJsonRpcRequest: false,
        contentExposed: false,
      },
    };
  }

  return {
    createNativeEngineeringLspLifecycleTask,
  };
}

function isApproved(task, approvals) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || approval?.status === "approved";
}

function resolveExecutablePath(binary, envPath = process.env.PATH ?? "") {
  if (typeof binary !== "string" || !binary.trim()) {
    return null;
  }
  const candidate = binary.trim();
  const paths = candidate.includes(path.sep)
    ? [candidate]
    : envPath.split(path.delimiter).filter(Boolean).map((entry) => path.join(entry, candidate));
  for (const item of paths) {
    try {
      accessSync(item, constants.X_OK);
      return item;
    } catch {
      // Keep scanning PATH entries.
    }
  }
  return null;
}

function buildLifecycleExecution({ task, executablePath, approved = false }) {
  const metadata = task.engineeringLspLifecycle ?? {};
  const now = new Date().toISOString();
  const serverBinary = metadata.server?.serverBinary ?? null;
  const binaryFound = Boolean(executablePath);
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_EXECUTION_REGISTRY,
    mode: "approved-lsp-lifecycle-binary-gate",
    generatedAt: now,
    taskId: task.id,
    lifecycleAction: metadata.lifecycleAction ?? null,
    language: metadata.language ?? null,
    workspace: metadata.workspace ?? null,
    server: {
      serverBinary,
      serverArgs: metadata.server?.serverArgs ?? [],
      binaryChecked: true,
      binaryFound,
      executablePath: executablePath ?? null,
      processStarted: false,
      processId: null,
      jsonRpcHandshakeSent: false,
    },
    result: {
      ok: binaryFound,
      state: binaryFound ? "binary_gate_passed_process_supervision_deferred" : "server_binary_missing",
      failureKind: binaryFound ? null : "lsp_server_binary_missing",
    },
    governance: {
      approved,
      canStartProcessWithoutApproval: false,
      processStarted: false,
      jsonRpcEnabled: false,
      contentExposed: false,
    },
    recoveryRecommendation: binaryFound
      ? {
          recoverable: true,
          nextAction: "implement supervised user-space process start/stop/readback before JSON-RPC",
        }
      : {
          recoverable: true,
          nextAction: `install or expose ${serverBinary ?? "the requested language server"} in the OpenClaw service PATH, then rerun the approved lifecycle task`,
        },
  };
}

export function isNativeEngineeringLspLifecycleTask(task) {
  return task?.type === "native_engineering_lsp_lifecycle"
    || task?.engineeringLspLifecycle?.registry === NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY;
}

export function createNativeEngineeringLspLifecycleTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  publishEvent,
}) {
  const { approvals, persistState } = state;
  const { serialiseTask, isActiveTask, setTaskPhase, completeTask, failTask } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy } = policyEvaluator;

  async function executeNativeEngineeringLspLifecycleTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("Native engineering LSP lifecycle task is not active.");
    }
    const policy = ensureTaskPolicy(task, { stage: "native_engineering.lsp_lifecycle.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!isApproved(task, approvals)) {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: "native-engineering-lsp-lifecycle-v0",
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          lifecycleAction: task.engineeringLspLifecycle?.lifecycleAction ?? null,
          language: task.engineeringLspLifecycle?.language ?? null,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: "native-engineering-lsp-lifecycle-v0",
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
          mode: "native_engineering_lsp_lifecycle_waiting_for_approval",
          executed: false,
          processStarted: false,
          jsonRpcSent: false,
        },
      };
    }

    await setTaskPhase(task, "lsp_lifecycle_binary_gate", {
      status: "running",
      details: {
        executor: "native-engineering-lsp-lifecycle-v0",
        lifecycleAction: task.engineeringLspLifecycle?.lifecycleAction ?? null,
        language: task.engineeringLspLifecycle?.language ?? null,
        serverBinary: task.engineeringLspLifecycle?.server?.serverBinary ?? null,
      },
    });
    const executablePath = resolveExecutablePath(task.engineeringLspLifecycle?.server?.serverBinary);
    const execution = buildLifecycleExecution({ task, executablePath, approved: true });
    task.engineeringLspLifecycle = {
      ...(task.engineeringLspLifecycle ?? {}),
      server: {
        ...(task.engineeringLspLifecycle?.server ?? {}),
        binaryChecked: true,
        binaryFound: execution.server.binaryFound,
        executablePath: execution.server.executablePath,
        processStarted: false,
        jsonRpcHandshakeSent: false,
      },
      execution,
    };
    persistState();

    if (!execution.result.ok) {
      const failedTask = failTask(task, `LSP lifecycle ${execution.lifecycleAction ?? "start"} blocked: ${execution.server.serverBinary ?? "server"} binary not found.`, {
        executor: "native-engineering-lsp-lifecycle-v0",
        lspLifecycleExecution: execution,
        recoveryEvidence: {
          kind: "lsp_lifecycle_recovery",
          recoverable: true,
          reason: execution.result.failureKind,
          recommendation: execution.recoveryRecommendation,
        },
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: execution.result.failureKind,
        executor: "native-engineering-lsp-lifecycle-v0",
      });
      return {
        task: failedTask,
        blocked: true,
        reason: execution.result.failureKind,
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: { ok: false, checks: [{ name: "server_binary_present", ok: false }], failedChecks: ["server_binary_present"] },
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        execution,
      };
    }

    const completedTask = completeTask(task, {
      executor: "native-engineering-lsp-lifecycle-v0",
      summary: "LSP lifecycle binary gate passed; process supervision remains deferred.",
      lspLifecycleExecution: execution,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "native-engineering-lsp-lifecycle-v0",
    });
    return {
      task: completedTask,
      blocked: false,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: { ok: true, checks: [{ name: "server_binary_present", ok: true }], failedChecks: [] },
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      execution,
    };
  }

  return [
    { name: "native-engineering-lsp-lifecycle", predicate: isNativeEngineeringLspLifecycleTask, execute: executeNativeEngineeringLspLifecycleTask },
  ];
}
