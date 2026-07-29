import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_OCR_ASSESSMENT_CAPABILITY_ID =
  "sense.ai.workspace.ocr_assessment";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_OCR_ASSESSMENT_CAPABILITY_ID;
}

export function createAiWorkspaceOcrAssessmentCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_ocr_assessment_request_invalid",
        policyId: "ai-workspace-explicit-ocr-assessment",
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
      return "AI workspace OCR assessment accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace OCR assessment runtime is unavailable.";
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
      kind: "ai.workspace.ocr_assessment",
      ok: result?.ok === true,
      status: result?.status ?? null,
      outcome: result?.assessment?.outcome ?? "unknown",
      confidence: typeof result?.assessment?.confidence === "number"
        ? result.assessment.confidence
        : null,
      contextContentHash: result?.evidence?.contextContentHash ?? null,
      requestContentHash: result?.evidence?.requestContentHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      frameContentHash: result?.evidence?.frameContentHash ?? null,
      frameSequence: result?.evidence?.frameSequence ?? null,
      ocrSceneContentHash: result?.evidence?.ocrSceneContentHash ?? null,
      ocrBindingHash: result?.evidence?.ocrBindingHash ?? null,
      ocrItemCount: result?.evidence?.ocrItemCount ?? 0,
      ocrCharacterCount: result?.evidence?.ocrCharacterCount ?? 0,
      ocrTruncated: result?.evidence?.ocrTruncated === true,
      verificationFrameContentHash:
        result?.evidence?.verificationFrameContentHash ?? null,
      verificationFrameSequence: result?.evidence?.verificationFrameSequence ?? null,
      verificationOcrSceneContentHash:
        result?.evidence?.verificationOcrSceneContentHash ?? null,
      surfaceId: result?.evidence?.surfaceId ?? null,
      inventorySequence: result?.evidence?.inventorySequence ?? null,
      taskId: result?.evidence?.taskId ?? null,
      taskStatus: result?.evidence?.taskStatus ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      completionAudit: result?.evidence?.completionAudit === true,
      providerCalled: result?.governance?.providerCalled === true,
      localOcrBound: result?.governance?.localOcrBound === true,
      localOcrRevalidated: result?.governance?.localOcrRevalidated === true,
      currentActiveSurfaceBound: result?.governance?.currentActiveSurfaceBound === true,
      taskObjectiveBound: result?.governance?.taskObjectiveBound === true,
      taskObjectiveProviderEgress:
        result?.governance?.taskObjectiveProviderEgress === true,
      rawTaskGoalProviderEgress: result?.governance?.rawTaskGoalProviderEgress === true,
      ocrTextProviderEgress: result?.governance?.ocrTextProviderEgress === true,
      ocrTextPersistedLocally:
        result?.governance?.ocrTextPersistedLocally === true,
      pixelsProviderEgress: result?.governance?.pixelsProviderEgress === true,
      renderedTextMayContainVisibleUrlsOrValues:
        result?.governance?.renderedTextMayContainVisibleUrlsOrValues === true,
      providerRetentionControlledExternally:
        result?.governance?.providerRetentionControlledExternally === true,
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
