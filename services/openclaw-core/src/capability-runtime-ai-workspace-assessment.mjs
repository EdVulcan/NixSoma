import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_ASSESSMENT_CAPABILITY_ID =
  "sense.ai.workspace.assessment";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_ASSESSMENT_CAPABILITY_ID;
}

export function createAiWorkspaceAssessmentCapabilityHandlers({ runtime } = {}) {
  function authorizeRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return { handled: false, authorization: null };
    const approved = aiWorkspaceTaskRequestIsBounded(request, rawBody);
    return {
      handled: true,
      authorization: {
        registry: "openclaw-standing-capability-authorization-v0",
        required: false,
        ok: approved,
        approved,
        reason: approved ? null : "ai_workspace_assessment_request_invalid",
        policyId: "ai-workspace-explicit-task-assessment",
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
    if (!aiWorkspaceTaskRequestIsBounded(request, rawBody)) {
      return "AI workspace assessment accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace assessment runtime is unavailable.";
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
      kind: "ai.workspace.assessment",
      ok: result?.ok === true,
      status: result?.status ?? null,
      outcome: result?.assessment?.outcome ?? "unknown",
      confidence: typeof result?.assessment?.confidence === "number"
        ? result.assessment.confidence
        : null,
      contextContentHash: result?.evidence?.contextContentHash ?? null,
      requestContentHash: result?.evidence?.requestContentHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      sceneContentHash: result?.evidence?.sceneContentHash ?? null,
      sceneItemCount: result?.evidence?.sceneItemCount ?? 0,
      taskId: result?.evidence?.taskId ?? null,
      taskStatus: result?.evidence?.taskStatus ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      completionAudit: result?.evidence?.completionAudit === true,
      providerCalled: result?.governance?.providerCalled === true,
      semanticSceneBound: result?.governance?.semanticSceneBound === true,
      currentBrowserSurfaceBound: result?.governance?.currentBrowserSurfaceBound === true,
      taskObjectiveBound: result?.governance?.taskObjectiveBound === true,
      taskObjectiveProviderEgress: result?.governance?.taskObjectiveProviderEgress === true,
      rawTaskGoalProviderEgress: result?.governance?.rawTaskGoalProviderEgress === true,
      pixelsProviderEgress: result?.governance?.pixelsProviderEgress === true,
      urlsProviderEgress: result?.governance?.urlsProviderEgress === true,
      inputValuesProviderEgress: result?.governance?.inputValuesProviderEgress === true,
      maximumProviderCalls: 1,
      maximumActions: 0,
      actionExecuted: false,
      taskMutated: false,
      automaticContinuation: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
