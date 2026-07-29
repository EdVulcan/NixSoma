import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_OCR_CLICK_CAPABILITY_ID =
  "act.ai.workspace.ocr_click";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_OCR_CLICK_CAPABILITY_ID;
}

export function createAiWorkspaceOcrClickCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_ocr_click_request_invalid",
        policyId: "ai-workspace-explicit-ocr-click",
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
      return "AI workspace OCR click accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace OCR click runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (!isCapability(capability)) return { handled: false, result: null };
    return { handled: true, result: await runtime.invoke({ taskId: request.taskId }) };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    const evidence = result?.evidence ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "ai.workspace.ocr_click",
      ok: result?.ok === true,
      status: result?.status ?? null,
      actionId: result?.action?.executed === true
        ? result.action.actionId
        : result?.decision?.actionId ?? result?.action?.actionId ?? "no_op",
      itemOrdinal: Number.isInteger(result?.action?.itemOrdinal)
        ? result.action.itemOrdinal
        : Number.isInteger(result?.decision?.itemOrdinal) ? result.decision.itemOrdinal : null,
      confidence: typeof result?.decision?.confidence === "number"
        ? result.decision.confidence
        : null,
      contextContentHash: evidence.contextContentHash ?? null,
      requestContentHash: evidence.requestContentHash ?? null,
      responseContentHash: evidence.responseContentHash ?? null,
      frameContentHash: evidence.frameContentHash ?? null,
      frameSequence: evidence.frameSequence ?? null,
      ocrSceneContentHash: evidence.ocrSceneContentHash ?? null,
      ocrBindingHash: evidence.ocrBindingHash ?? null,
      ocrItemCount: evidence.ocrItemCount ?? 0,
      ocrCharacterCount: evidence.ocrCharacterCount ?? 0,
      verificationFrameContentHash: evidence.verificationFrameContentHash ?? null,
      verificationFrameSequence: evidence.verificationFrameSequence ?? null,
      verificationOcrSceneContentHash: evidence.verificationOcrSceneContentHash ?? null,
      postActionFrameContentHash: evidence.postActionFrameContentHash ?? null,
      postActionFrameSequence: evidence.postActionFrameSequence ?? null,
      postActionOcrSceneContentHash: evidence.postActionOcrSceneContentHash ?? null,
      surfaceId: evidence.surfaceId ?? result?.action?.surfaceId ?? null,
      inventorySequence: evidence.inventorySequence
        ?? result?.action?.inventorySequence
        ?? null,
      taskId: evidence.taskId ?? null,
      taskStatus: evidence.taskStatus ?? null,
      objectiveContentHash: evidence.objectiveContentHash ?? null,
      taskVersionHash: evidence.taskVersionHash ?? null,
      actionExecuted: evidence.actionExecuted === true,
      receiptMatched: evidence.receiptMatched === true,
      frameChanged: evidence.frameChanged === true,
      postActionVerified: evidence.postActionVerified === true,
      completionAudit: evidence.completionAudit === true,
      providerCalled: governance.providerCalled === true,
      localOcrBound: governance.localOcrBound === true,
      localOcrRevalidated: governance.localOcrRevalidated === true,
      currentFrameBound: governance.currentFrameBound === true,
      currentActiveSurfaceBound: governance.currentActiveSurfaceBound === true,
      ocrItemOrdinalBound: governance.ocrItemOrdinalBound === true,
      taskObjectiveBound: governance.taskObjectiveBound === true,
      taskObjectiveProviderEgress: governance.taskObjectiveProviderEgress === true,
      rawTaskGoalProviderEgress: governance.rawTaskGoalProviderEgress === true,
      ocrTextProviderEgress: governance.ocrTextProviderEgress === true,
      ocrTextPersistedLocally: governance.ocrTextPersistedLocally === true,
      pixelsProviderEgress: governance.pixelsProviderEgress === true,
      arbitraryPointerInput: governance.arbitraryPointerInput === true,
      providerRetentionControlledExternally:
        governance.providerRetentionControlledExternally === true,
      maximumProviderCalls: 1,
      maximumActions: 1,
      taskMutated: false,
      automaticContinuation: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
