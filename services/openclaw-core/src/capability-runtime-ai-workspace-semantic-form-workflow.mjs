import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_CAPABILITY_ID =
  "act.ai.workspace.semantic_form_workflow";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_CAPABILITY_ID;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: Number.isInteger(value.byteLength) ? value.byteLength : null,
    textExposed: false,
    persisted: false,
  };
}

function compactStep(step) {
  return {
    index: Number.isInteger(step?.index) ? step.index : null,
    status: typeof step?.status === "string" ? step.status.slice(0, 80) : null,
    actionId: typeof step?.actionId === "string" ? step.actionId.slice(0, 40) : null,
    itemOrdinal: Number.isInteger(step?.itemOrdinal) ? step.itemOrdinal : null,
    inputEvidence: compactInputEvidence(step?.inputEvidence),
    providerCalled: step?.providerCalled === true,
    actionExecuted: step?.actionExecuted === true,
    postActionVerified: step?.postActionVerified === true,
    completionAudit: step?.completionAudit === true,
    semanticSubmitTargetBound: step?.semanticSubmitTargetBound === true,
    responseContentHash: step?.responseContentHash ?? null,
    sceneContentHash: step?.sceneContentHash ?? null,
  };
}

export function createAiWorkspaceSemanticFormWorkflowCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_semantic_form_workflow_request_invalid",
        policyId: "ai-workspace-explicit-semantic-form-workflow",
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
      return "AI workspace semantic form workflow accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace semantic form workflow runtime is unavailable.";
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
      kind: "ai.workspace.semantic_form_workflow",
      ok: result?.ok === true,
      status: result?.status ?? null,
      terminalReason: result?.terminalReason ?? null,
      stepCount: result?.evidence?.stepCount ?? 0,
      providerCallCount: result?.evidence && "providerCallCount" in result.evidence
        ? result.evidence.providerCallCount
        : 0,
      providerCallCountMinimum: result?.evidence?.providerCallCountMinimum ?? 0,
      actionCount: result?.evidence && "actionCount" in result.evidence
        ? result.evidence.actionCount
        : 0,
      actionCountMinimum: result?.evidence?.actionCountMinimum ?? 0,
      taskId: result?.evidence?.taskId ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      continuationAudit: result?.evidence?.continuationAudit === true,
      workflowCompletionAudit: result?.evidence?.workflowCompletionAudit === true,
      outcomeUnknown: result?.evidence?.outcomeUnknown === true,
      steps: Array.isArray(result?.steps) ? result.steps.slice(0, 2).map(compactStep) : [],
      maximumProviderCalls: 2,
      maximumActions: 2,
      continuationAfterVerifiedTypeOnly:
        result?.governance?.continuationAfterVerifiedTypeOnly === true,
      continuedAfterVerifiedType: result?.governance?.continuedAfterVerifiedType === true,
      terminalAfterSubmitStep: true,
      boundedAutomaticContinuation:
        result?.governance?.boundedAutomaticContinuation === true,
      automaticRepeat: false,
      inputTextExposed: false,
      inputTextPersisted: false,
      taskMutated: false,
      automaticTaskCompletion: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
