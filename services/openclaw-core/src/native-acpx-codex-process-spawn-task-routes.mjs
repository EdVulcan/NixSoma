import { randomUUID } from "node:crypto";
import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildNativeAcpxCodexBridgeProcessSpawnProposal } from "./native-acpx-codex-process-spawn-proposal-builders.mjs";
import { buildNativeAcpxCodexWrapperWriteExecutionEvidence } from "./native-acpx-codex-wrapper-write-execution-evidence-builders.mjs";

export const NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY = "openclaw-native-acpx-codex-bridge-process-spawn-task-v0";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

function bodyString(body, key, fallback) {
  return typeof body[key] === "string" ? body[key] : fallback;
}

function buildProcessSpawnProposal({ state, executor, taskId }) {
  const wrapperWriteExecutionEvidence = buildNativeAcpxCodexWrapperWriteExecutionEvidence({
    filesystemChanges: executor.listFilesystemChangeRecords({ limit: taskId ? 100 : 10 }),
    tasks: state.tasks,
    taskId,
    limit: 10,
  });
  return buildNativeAcpxCodexBridgeProcessSpawnProposal({
    wrapperWriteExecutionEvidence,
    taskId,
  });
}

function buildProcessSpawnTaskDraft({ processSpawnProposal, autonomyMode }) {
  const now = new Date().toISOString();
  const ready = processSpawnProposal.summary?.readyForSpawnApprovalDesign === true;
  const policyRequest = {
    intent: "acpx_codex_bridge.process_spawn_preflight",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    approved: false,
    capabilityId: "act.openclaw.acpx_codex_bridge.process_spawn_preflight",
    tags: [
      "acpx_codex_bridge",
      "explicit_approval_required",
      "process_spawn_preflight_only",
    ],
  };
  const goal = `Approve ACPX/Codex bridge process-spawn preflight for ${processSpawnProposal.proposal?.wrapper?.relativePath ?? "selected wrapper"}`;
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY,
    stage: "acpx_codex_bridge.process_spawn.task.materialize",
    subject: {
      taskId: null,
      type: "native_acpx_codex_bridge_process_spawn",
      goal,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "acpx_codex_bridge_process_spawn_preflight_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "acpx-codex-bridge-process-spawn-v0",
    planner: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY,
    capabilityAware: true,
    status: ready ? "planned" : "blocked",
    goal,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 4,
      approvalGates: 1,
      ids: [
        "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence",
        "plan.openclaw.acpx_codex_bridge.process_spawn",
        "act.openclaw.acpx_codex_bridge.process_spawn_preflight",
        "act.system.command.execute",
      ],
      byRisk: {
        medium: 2,
        high: 2,
      },
    },
    steps: [
      {
        id: "step-review-process-spawn-proposal",
        kind: "acpx_codex_bridge.process_spawn_proposal",
        phase: "reviewing_process_spawn_proposal",
        title: "Review ACPX/Codex process-spawn proposal contract",
        status: ready ? "pending" : "blocked",
        capabilityId: "plan.openclaw.acpx_codex_bridge.process_spawn",
        risk: "high",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          proposalId: processSpawnProposal.proposal?.id ?? null,
          selectedWrapperWriteTaskId: processSpawnProposal.summary?.selectedWrapperWriteTaskId ?? null,
          selectedInvocationId: processSpawnProposal.summary?.selectedInvocationId ?? null,
          wrapperRelativePath: processSpawnProposal.proposal?.wrapper?.relativePath ?? null,
          argsExposed: false,
          processSpawned: false,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before process-spawn preflight",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-record-preflight",
        kind: "acpx_codex_bridge.process_spawn_preflight",
        phase: "approved_preflight_only",
        title: "Record ACPX/Codex process-spawn preflight without executing wrapper",
        status: "pending",
        capabilityId: "act.openclaw.acpx_codex_bridge.process_spawn_preflight",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
        params: {
          canReadCredentialValue: false,
          canCopyAuthMaterial: false,
          canChmodWrapper: false,
          canExecuteWrapper: false,
          canSpawnCodexAcp: false,
          canCallProvider: false,
          canUseNetwork: false,
        },
      },
    ],
    governance: {
      mode: "acpx_codex_bridge_process_spawn_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      readyForProcessSpawnPreflight: ready,
      requiresExplicitApproval: true,
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canChmodWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
    },
  };

  return {
    registry: "openclaw-native-acpx-codex-bridge-process-spawn-task-draft-v0",
    mode: "approval-gated-process-spawn-preflight-task-draft",
    generatedAt: now,
    processSpawnProposal,
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "acpx_codex_bridge_process_spawn_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      readyForProcessSpawnPreflight: ready,
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canChmodWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
    },
  };
}

async function createProcessSpawnTask({
  state,
  executor,
  taskManager,
  approvalEngine,
  publishEvent,
  taskId,
  confirm,
}) {
  if (confirm !== true) {
    throw new Error("ACPX/Codex process-spawn task creation requires confirm=true.");
  }
  const processSpawnProposal = buildProcessSpawnProposal({ state, executor, taskId });
  if (processSpawnProposal.summary?.readyForSpawnApprovalDesign !== true) {
    throw new Error("ACPX/Codex process-spawn task requires approved wrapper write execution evidence.");
  }
  const draft = buildProcessSpawnTaskDraft({
    processSpawnProposal,
    autonomyMode: state.autonomyMode,
  });
  const task = taskManager.createTask({
    goal: draft.plan.goal,
    type: "native_acpx_codex_bridge_process_spawn",
    workViewStrategy: "acpx-codex-bridge-process-spawn-preflight",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  task.nativeAcpxCodexBridgeProcessSpawn = {
    registry: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY,
    mode: "approval-gated-process-spawn-preflight-task",
    sourceRegistry: draft.processSpawnProposal.registry,
    processSpawnProposal: draft.processSpawnProposal,
    execution: null,
    governance: draft.governance,
  };
  const approval = approvalEngine.createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = taskManager.supersedeOtherActiveTasks(task.id);
  taskManager.reconcileRuntimeState();
  state.persistState();

  await publishEvent(createEventName("task.created"), { task: taskManager.serialiseTask(task), planner: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY });
  await approvalEngine.publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: taskManager.serialiseTask(task), plan: draft.plan });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: taskManager.serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_TASK_REGISTRY,
    mode: "approval-gated-process-spawn-preflight-task",
    generatedAt: new Date().toISOString(),
    processSpawnProposal: draft.processSpawnProposal,
    task,
    approval,
    governance: {
      ...draft.governance,
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
    },
  };
}

export async function handleNativeAcpxCodexProcessSpawnTaskRoute({
  req,
  res,
  requestUrl,
  state,
  executor,
  taskManager,
  approvalEngine,
  publishEvent,
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  if (req.method !== "POST" || requestUrl.pathname !== "/plugins/native-adapter/acpx-codex-bridge-process-spawn-tasks") {
    return false;
  }
  try {
    const body = await readJsonBody(req);
    const result = await createProcessSpawnTask({
      state,
      executor,
      taskManager,
      approvalEngine,
      publishEvent,
      taskId: bodyString(body, "taskId", null),
      confirm: body.confirm === true,
    });
    sendJson(res, 201, {
      ...result,
      task: serialiseTask(result.task),
      approval: serialiseApproval(result.approval),
      summary: buildTaskSummary(),
    });
  } catch (error) {
    sendError(res, 400, error);
  }
  return true;
}
