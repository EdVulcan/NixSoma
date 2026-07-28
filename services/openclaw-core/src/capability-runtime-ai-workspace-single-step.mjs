export const AI_WORKSPACE_SINGLE_STEP_CAPABILITY_ID =
  "act.ai.workspace.single_step";

const ALLOWED_BODY_KEYS = new Set(["capabilityId", "taskId", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);
const MAX_TASK_ID_CHARS = 200;

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_SINGLE_STEP_CAPABILITY_ID;
}

function requestIsBounded(request, rawBody) {
  const taskId = typeof request?.taskId === "string" ? request.taskId.trim() : "";
  if (request?.params?.confirm !== true
    || !taskId
    || taskId.length > MAX_TASK_ID_CHARS
    || request.stepId !== null
    || request.operation !== null
    || request.intent !== null
    || Object.keys(request.params ?? {}).some((key) => !ALLOWED_PARAM_KEYS.has(key))) {
    return false;
  }
  return rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

function compactInputEvidence(evidence) {
  if (evidence?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(evidence.charCount)
    || evidence.charCount < 1
    || !Number.isInteger(evidence.byteLength)
    || evidence.byteLength < 1
    || evidence.textExposed !== false
    || evidence.persisted !== false) {
    return null;
  }
  return {
    registry: evidence.registry,
    charCount: evidence.charCount,
    byteLength: evidence.byteLength,
    maxChars: Number.isInteger(evidence.maxChars) ? evidence.maxChars : null,
    truncated: evidence.truncated === true,
    textExposed: false,
    persisted: false,
  };
}

export function createAiWorkspaceSingleStepCapabilityHandlers({ runtime } = {}) {
  function authorizeRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return { handled: false, authorization: null };
    const approved = requestIsBounded(request, rawBody);
    return {
      handled: true,
      authorization: {
        registry: "openclaw-standing-capability-authorization-v0",
        required: false,
        ok: approved,
        approved,
        reason: approved ? null : "ai_workspace_single_step_request_invalid",
        policyId: "ai-workspace-explicit-single-step",
        policyVersion: 0,
        taskId: request.taskId,
        approvalId: null,
        bindingHash: null,
        reservation: null,
      },
    };
  }

  function validateRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return null;
    if (!requestIsBounded(request, rawBody)) {
      return "AI workspace single-step accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace single-step runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (!isCapability(capability)) return { handled: false, result: null };
    return { handled: true, result: await runtime.invoke({ taskId: request.taskId }) };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    return {
      kind: "ai.workspace.single_step",
      ok: result?.ok === true,
      status: result?.status ?? null,
      actionId: result?.decision?.actionId ?? result?.fallback?.actionId ?? null,
      itemOrdinal: result?.decision?.itemOrdinal ?? null,
      inputEvidence: compactInputEvidence(result?.evidence?.inputEvidence),
      contextContentHash: result?.evidence?.contextContentHash ?? null,
      requestContentHash: result?.evidence?.requestContentHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      sceneContentHash: result?.evidence?.sceneContentHash ?? null,
      sceneItemCount: result?.evidence?.sceneItemCount ?? 0,
      taskId: result?.evidence?.taskId ?? null,
      taskStatus: result?.evidence?.taskStatus ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      providerCalled: result?.governance?.providerCalled === true,
      actionExecuted: result?.governance?.actionExecuted === true,
      currentFrameBound: result?.governance?.currentFrameBound === true,
      currentActiveSurfaceBound: result?.governance?.currentActiveSurfaceBound === true,
      semanticSceneBound: result?.governance?.semanticSceneBound === true,
      currentBrowserSurfaceBound: result?.governance?.currentBrowserSurfaceBound === true,
      taskObjectiveBound: result?.governance?.taskObjectiveBound === true,
      taskObjectiveProviderEgress: result?.governance?.taskObjectiveProviderEgress === true,
      rawTaskGoalProviderEgress: result?.governance?.rawTaskGoalProviderEgress === true,
      pixelsProviderEgress: result?.governance?.pixelsProviderEgress === true,
      urlsProviderEgress: result?.governance?.urlsProviderEgress === true,
      inputValuesProviderEgress: result?.governance?.inputValuesProviderEgress === true,
      postActionVerified: result?.evidence?.postActionVerified === true,
      maximumActions: 1,
      automaticRepeat: false,
      createsTask: false,
      createsApproval: false,
      providerGeneratedInput: result?.governance?.providerGeneratedInput === true,
      inputTextPersisted: result?.governance?.inputTextPersisted === true,
      keyboardInput: result?.governance?.keyboardInput === true,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
