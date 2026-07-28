export const AI_WORKSPACE_SINGLE_STEP_CAPABILITY_ID =
  "act.ai.workspace.single_step";

const ALLOWED_BODY_KEYS = new Set(["capabilityId", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_SINGLE_STEP_CAPABILITY_ID;
}

function requestIsBounded(request, rawBody) {
  if (request?.params?.confirm !== true
    || request.taskId !== null
    || request.stepId !== null
    || request.operation !== null
    || request.intent !== null
    || Object.keys(request.params ?? {}).some((key) => !ALLOWED_PARAM_KEYS.has(key))) {
    return false;
  }
  return rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
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
        taskId: null,
        approvalId: null,
        bindingHash: null,
        reservation: null,
      },
    };
  }

  function validateRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return null;
    if (!requestIsBounded(request, rawBody)) {
      return "AI workspace single-step accepts only capabilityId and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace single-step runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability) {
    if (!isCapability(capability)) return { handled: false, result: null };
    return { handled: true, result: await runtime.invoke() };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    return {
      kind: "ai.workspace.single_step",
      ok: result?.ok === true,
      status: result?.status ?? null,
      actionId: result?.decision?.actionId ?? result?.fallback?.actionId ?? null,
      contextContentHash: result?.evidence?.contextContentHash ?? null,
      requestContentHash: result?.evidence?.requestContentHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      providerCalled: result?.governance?.providerCalled === true,
      actionExecuted: result?.governance?.actionExecuted === true,
      currentFrameBound: result?.governance?.currentFrameBound === true,
      currentActiveSurfaceBound: result?.governance?.currentActiveSurfaceBound === true,
      maximumActions: 1,
      automaticRepeat: false,
      createsTask: false,
      createsApproval: false,
      keyboardInput: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
