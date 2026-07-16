const CAPABILITY_ID = "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge";
const MAX_TARGET_INDEX = 7;
const MAX_CONTEXT_LINES = 20;
const MAX_TASK_ID_CHARS = 200;

function requireBuilder(builder) {
  if (typeof builder !== "function") {
    throw new Error("buildNativeEngineeringLspSelectedTargetReadBridge is not configured.");
  }
  return builder;
}

function boundedInteger(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

export function createEngineeringLspCapabilityHandlers({
  buildNativeEngineeringLspSelectedTargetReadBridge,
} = {}) {
  function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    const params = request.params ?? {};
    return {
      handled: true,
      result: requireBuilder(buildNativeEngineeringLspSelectedTargetReadBridge)({
        workspacePath: params.workspacePath,
        language: params.language,
        taskId: params.taskId,
        targetIndex: params.targetIndex,
        contextLines: params.contextLines,
        includeRead: params.includeRead,
        maxOutputChars: params.maxOutputChars,
        maxFileSizeBytes: params.maxFileSizeBytes,
      }),
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    const params = request.params ?? {};
    if (typeof params.taskId !== "string" || !params.taskId.trim()) {
      return "LSP selected-target read requires an explicit taskId.";
    }
    if (params.taskId.trim().length > MAX_TASK_ID_CHARS) {
      return "LSP selected-target taskId is too long.";
    }
    if (params.targetIndex !== undefined && !boundedInteger(params.targetIndex, MAX_TARGET_INDEX)) {
      return `LSP selected-target targetIndex must be an integer from 0 to ${MAX_TARGET_INDEX}.`;
    }
    if (params.contextLines !== undefined && !boundedInteger(params.contextLines, MAX_CONTEXT_LINES)) {
      return `LSP selected-target contextLines must be an integer from 0 to ${MAX_CONTEXT_LINES}.`;
    }
    if (params.includeRead !== undefined && typeof params.includeRead !== "boolean") {
      return "LSP selected-target includeRead must be boolean.";
    }
    return null;
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "engineering.lsp_selected_target_read",
      ok: result?.ok === true,
      blocked: result?.blocked === true,
      reason: result?.reason ?? null,
      sourceTaskId: summary.sourceTaskId ?? result?.query?.taskId ?? null,
      targetIndex: summary.targetIndex ?? result?.query?.targetIndex ?? null,
      relativePath: summary.relativePath ?? result?.target?.relativePath ?? null,
      startLine: summary.startLine ?? result?.target?.startLine ?? null,
      endLine: summary.endLine ?? result?.target?.endLine ?? null,
      includeRead: summary.includeRead === true,
      readOk: summary.readOk === true,
      charsReturned: result?.readResult?.summary?.charsReturned ?? 0,
      outputTruncated: result?.readResult?.summary?.outputTruncated === true,
      contentExposed: summary.contentExposed === true,
      noRawLspPayload: result?.bounds?.noRawLspPayload === true,
      noMutation: governance.canMutateWorkspace === false,
      noProviderEgress: governance.canCallProvider === false && governance.networkEgress !== true,
    };
  }

  return { callBackend, summariseResult, validateRequest };
}
