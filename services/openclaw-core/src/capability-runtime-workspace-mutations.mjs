const TEXT_WRITE_CAPABILITY_ID = "act.openclaw.workspace_text_write";
const PATCH_APPLY_CAPABILITY_ID = "act.openclaw.workspace_patch_apply";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mutationKind(capabilityId) {
  return capabilityId === TEXT_WRITE_CAPABILITY_ID
    ? "workspace.text_write_task"
    : "workspace.patch_apply_task";
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

function blockedTaskResult(capabilityId) {
  return {
    ok: false,
    blocked: true,
    reason: "operator_confirmation_required",
    registry: `openclaw-native-${capabilityId === TEXT_WRITE_CAPABILITY_ID ? "workspace-text-write" : "workspace-patch-apply"}-task-v0`,
    mode: "capability-runtime-workspace-mutation",
    capability: {
      id: capabilityId,
      approvalRequired: true,
    },
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      executed: false,
      canMutate: false,
      canCallProvider: false,
      canUseNetwork: false,
      contentExposed: false,
    },
  };
}

function requireWorkspaceOwner(workspaceOps, methodName) {
  if (typeof workspaceOps?.[methodName] !== "function") {
    throw new Error(`Workspace mutation owner ${methodName} is unavailable.`);
  }
  return workspaceOps[methodName].bind(workspaceOps);
}

function buildTextWriteInput(params) {
  return {
    workspacePath: params.workspacePath,
    relativePath: params.relativePath,
    content: typeof params.content === "string" ? params.content : "",
    overwrite: params.overwrite !== false,
    engineeringPlanTodoSuggestionLink: isPlainObject(params.engineeringPlanTodoSuggestionLink)
      ? params.engineeringPlanTodoSuggestionLink
      : null,
    confirm: true,
  };
}

function buildPatchApplyInput(params) {
  return {
    workspacePath: params.workspacePath,
    relativePath: params.relativePath,
    search: params.search,
    replacement: params.replacement,
    occurrence: params.occurrence,
    edits: Array.isArray(params.edits) ? params.edits : null,
    contextLines: params.contextLines,
    proposal: isPlainObject(params.proposal) ? params.proposal : null,
    deriveProposalFromSource: params.deriveProposalFromSource === true,
    proposalQuery: params.proposalQuery,
    selectTargetFromSource: params.selectTargetFromSource === true,
    targetSelectionQuery: params.targetSelectionQuery,
    targetSelectionScope: params.targetSelectionScope,
    engineeringPlanTodoSuggestionLink: isPlainObject(params.engineeringPlanTodoSuggestionLink)
      ? params.engineeringPlanTodoSuggestionLink
      : null,
    confirm: true,
  };
}

export function createWorkspaceMutationCapabilityHandlers({
  workspaceOps = {},
  serialiseTask,
  serialiseApproval,
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id !== TEXT_WRITE_CAPABILITY_ID && capability.id !== PATCH_APPLY_CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    const params = request.params ?? {};
    if (params.confirm !== true) {
      return {
        handled: true,
        result: blockedTaskResult(capability.id),
      };
    }

    const methodName = capability.id === TEXT_WRITE_CAPABILITY_ID
      ? "createNativeOpenClawWorkspaceTextWriteTask"
      : "createNativeOpenClawWorkspacePatchApplyTask";
    const buildInput = capability.id === TEXT_WRITE_CAPABILITY_ID
      ? buildTextWriteInput
      : buildPatchApplyInput;
    const result = await requireWorkspaceOwner(workspaceOps, methodName)(buildInput(params));
    return {
      handled: true,
      result: publicTaskResult(result, { serialiseTask, serialiseApproval }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== TEXT_WRITE_CAPABILITY_ID && capability.id !== PATCH_APPLY_CAPABILITY_ID) {
      return null;
    }
    const governance = result?.governance ?? {};
    const target = result?.target ?? {};
    const task = result?.task;
    return {
      kind: mutationKind(capability.id),
      ok: result?.blocked !== true && result?.ok !== false && Boolean(task?.id),
      blocked: result?.blocked === true,
      reason: result?.reason ?? null,
      taskId: task?.id ?? null,
      approvalId: result?.approval?.id ?? null,
      relativePath: target.relativePath ?? null,
      contentBytes: target.contentBytes ?? null,
      editCount: target.editCount ?? (Array.isArray(result?.edits) ? result.edits.length : 0),
      diffPreviewExposed: target.diffPreviewExposed === true || Array.isArray(result?.diffPreview),
      fullContentExposed: target.contentExposed === true,
      createsTask: governance.createsTask === true,
      createsApproval: governance.createsApproval === true,
      requiresApproval: result?.capability?.approvalRequired !== false,
      canExecuteWithoutApproval: governance.canExecuteWithoutApproval === true,
      executed: governance.executed === true,
      noMutationBeforeApproval: governance.canExecuteWithoutApproval !== true && governance.executed !== true,
      noContentInInvocation: true,
      noReplacementInInvocation: true,
      noFullDiffInInvocation: true,
      noProviderEgress: governance.canCallProvider !== true
        && governance.canUseNetwork !== true
        && governance.providerEgress !== true,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== TEXT_WRITE_CAPABILITY_ID && capability.id !== PATCH_APPLY_CAPABILITY_ID) {
      return null;
    }
    const confirm = request.params?.confirm;
    if (confirm !== undefined && typeof confirm !== "boolean") {
      return `${mutationKind(capability.id)} confirm must be a boolean.`;
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
