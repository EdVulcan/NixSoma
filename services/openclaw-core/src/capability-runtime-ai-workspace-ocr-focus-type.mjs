import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_OCR_FOCUS_TYPE_CAPABILITY_ID =
  "act.ai.workspace.ocr_focus_type";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_OCR_FOCUS_TYPE_CAPABILITY_ID;
}

export function createAiWorkspaceOcrFocusTypeCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_ocr_focus_type_request_invalid",
        policyId: "ai-workspace-explicit-ocr-focus-type",
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
      return "AI workspace OCR focus type accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace OCR focus type runtime is unavailable.";
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
    const inputEvidence = evidence.inputEvidence
      ?? result?.decision?.inputEvidence
      ?? result?.actions?.find((action) => action?.actionId === "type_text")?.inputEvidence
      ?? null;
    return {
      kind: "ai.workspace.ocr_focus_type",
      ok: result?.ok === true,
      status: result?.status ?? null,
      actionId: result?.status === "executed"
        ? "focus_and_type"
        : result?.decision?.actionId ?? "no_op",
      confidence: typeof result?.decision?.confidence === "number"
        ? result.decision.confidence
        : null,
      itemOrdinal: evidence.itemOrdinal ?? result?.decision?.itemOrdinal ?? null,
      inputEvidence,
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
      focusFrameContentHash: evidence.focusFrameContentHash ?? null,
      focusFrameSequence: evidence.focusFrameSequence ?? null,
      focusOcrSceneContentHash: evidence.focusOcrSceneContentHash ?? null,
      postActionFrameContentHash: evidence.postActionFrameContentHash ?? null,
      postActionFrameSequence: evidence.postActionFrameSequence ?? null,
      postActionOcrSceneContentHash: evidence.postActionOcrSceneContentHash ?? null,
      surfaceId: evidence.surfaceId ?? result?.actions?.at(-1)?.surfaceId ?? null,
      inventorySequence: evidence.inventorySequence
        ?? result?.actions?.at(-1)?.inventorySequence
        ?? null,
      taskId: evidence.taskId ?? null,
      taskStatus: evidence.taskStatus ?? null,
      objectiveContentHash: evidence.objectiveContentHash ?? null,
      taskVersionHash: evidence.taskVersionHash ?? null,
      actionCount: evidence.actionCount ?? 0,
      focusActionExecuted: evidence.focusActionExecuted === true,
      focusActionVerified: evidence.focusActionVerified === true,
      typeActionExecuted: evidence.typeActionExecuted === true,
      postActionVerified: evidence.postActionVerified === true,
      outcomeUnknown: evidence.outcomeUnknown === true,
      completionAudit: evidence.completionAudit === true,
      providerCalled: governance.providerCalled === true,
      localOcrBound: governance.localOcrBound === true,
      localOcrRevalidated: governance.localOcrRevalidated === true,
      focusRevalidated: governance.focusRevalidated === true,
      currentFrameBound: governance.currentFrameBound === true,
      currentActiveSurfaceBound: governance.currentActiveSurfaceBound === true,
      ocrItemOrdinalBound: governance.ocrItemOrdinalBound === true,
      taskObjectiveInputBound: governance.taskObjectiveInputBound === true,
      providerGeneratedInput: governance.providerGeneratedInput === true,
      pointerInput: governance.pointerInput === true,
      keyboardInput: governance.keyboardInput === true,
      hotkeyInput: governance.hotkeyInput === true,
      enterKeyInput: governance.enterKeyInput === true,
      inputTextExposed: governance.inputTextExposed === true,
      inputTextPersisted: governance.inputTextPersisted === true,
      taskObjectiveBound: governance.taskObjectiveBound === true,
      taskObjectiveProviderEgress: governance.taskObjectiveProviderEgress === true,
      rawTaskGoalProviderEgress: governance.rawTaskGoalProviderEgress === true,
      ocrTextProviderEgress: governance.ocrTextProviderEgress === true,
      ocrTextPersistedLocally: governance.ocrTextPersistedLocally === true,
      pixelsProviderEgress: governance.pixelsProviderEgress === true,
      arbitraryPointerInput: governance.arbitraryPointerInput === true,
      arbitraryKeyboardInput: governance.arbitraryKeyboardInput === true,
      providerRetentionControlledExternally:
        governance.providerRetentionControlledExternally === true,
      maximumProviderCalls: 1,
      maximumActions: 2,
      fixedActionSequence: true,
      automaticRepeat: false,
      taskMutated: false,
      automaticContinuation: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
