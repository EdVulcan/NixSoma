const CAPABILITY_ID = "act.openclaw.engineering_tool.verify";
const MAX_INPUT_CHARS = 240;

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length > MAX_INPUT_CHARS) {
    throw new Error(`${label} must be a string of at most ${MAX_INPUT_CHARS} characters.`);
  }
  return value;
}

function compactTask(task) {
  if (!task || typeof task !== "object") return null;
  return {
    id: task.id ?? null,
    type: task.type ?? null,
    goal: task.goal ?? null,
    status: task.status ?? null,
    approval: task.approval ?? null,
    executionPhase: task.executionPhase ?? null,
    createdAt: task.createdAt ?? null,
    closedAt: task.closedAt ?? null,
    updatedAt: task.updatedAt ?? null,
  };
}

function publicTaskResult(result, { serialiseTask, serialiseApproval } = {}) {
  return {
    ...result,
    task: typeof serialiseTask === "function" ? serialiseTask(result.task) : compactTask(result.task),
    approval: typeof serialiseApproval === "function"
      ? serialiseApproval(result.approval)
      : result.approval
        ? {
            id: result.approval.id ?? null,
            status: result.approval.status ?? null,
            taskId: result.approval.taskId ?? null,
          }
        : null,
  };
}

function blockedTaskResult() {
  return {
    ok: false,
    blocked: true,
    reason: "operator_confirmation_required",
    registry: "openclaw-native-engineering-verification-task-v0",
    mode: "capability-runtime-engineering-verification-task",
    capability: {
      id: CAPABILITY_ID,
      approvalRequired: true,
    },
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      executed: false,
      canExecuteCommand: false,
      canMutate: false,
      canCallProvider: false,
      canUseNetwork: false,
      contentExposed: false,
    },
  };
}

function buildTaskInput(params) {
  return {
    proposalId: boundedString(params.proposalId, "proposalId"),
    workspaceId: boundedString(params.workspaceId, "workspaceId"),
    scriptName: boundedString(params.scriptName, "scriptName"),
    workspacePath: boundedString(params.workspacePath, "workspacePath"),
    query: boundedString(params.query, "query") ?? "command",
    engineeringPlanTodoSuggestionLink: isPlainObject(params.engineeringPlanTodoSuggestionLink)
      ? params.engineeringPlanTodoSuggestionLink
      : null,
    confirm: true,
  };
}

function requireWorkspaceOwner(workspaceOps) {
  if (typeof workspaceOps?.createOpenClawSourceCommandTask !== "function") {
    throw new Error("Workspace verification task owner is unavailable.");
  }
  return workspaceOps.createOpenClawSourceCommandTask.bind(workspaceOps);
}

export function createEngineeringVerificationTaskCapabilityHandlers({
  workspaceOps = {},
  serialiseTask,
  serialiseApproval,
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    const params = request.params ?? {};
    if (params.confirm !== true) {
      return { handled: true, result: blockedTaskResult() };
    }
    const result = await requireWorkspaceOwner(workspaceOps)(buildTaskInput(params));
    return {
      handled: true,
      result: publicTaskResult(result, { serialiseTask, serialiseApproval }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const governance = result?.governance ?? {};
    const sourceTask = result?.sourceCommandTask ?? {};
    const task = result?.task;
    return {
      kind: "engineering.verification_task",
      ok: result?.blocked !== true && Boolean(task?.id),
      blocked: result?.blocked === true,
      reason: result?.reason ?? null,
      taskId: task?.id ?? null,
      approvalId: result?.approval?.id ?? null,
      proposalId: result?.sourceCommandProposal?.id ?? sourceTask.proposalId ?? null,
      createsTask: governance.createsTask === true,
      createsApproval: governance.createsApproval === true,
      canExecuteWithoutApproval: governance.canExecuteWithoutApproval === true,
      executed: sourceTask.executed === true || governance.executed === true,
      noCommandExecution: sourceTask.executed !== true && governance.executed !== true,
      noMutation: governance.canMutate !== true,
      noProviderEgress: governance.canCallProvider !== true && governance.canUseNetwork !== true,
      noContentInInvocation: true,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    const confirm = request.params?.confirm;
    if (confirm !== undefined && typeof confirm !== "boolean") {
      return "engineering.verification_task confirm must be a boolean.";
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
