import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_REVIEWED_CYCLE_CAPABILITY_ID =
  "act.ai.workspace.reviewed_cycle";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_REVIEWED_CYCLE_CAPABILITY_ID;
}

function compactStep(step) {
  return {
    index: Number.isInteger(step?.index) ? step.index : null,
    status: typeof step?.status === "string" ? step.status.slice(0, 80) : null,
    actionId: typeof step?.actionId === "string" ? step.actionId.slice(0, 40) : null,
    providerCalled: step?.providerCalled === true,
    actionExecuted: step?.actionExecuted === true,
    completionAudit: step?.completionAudit === true,
    sceneContentHash: step?.sceneContentHash ?? null,
  };
}

function compactRun(run) {
  return {
    status: run?.status ?? null,
    terminalReason: run?.terminalReason ?? null,
    stepCount: run?.evidence?.stepCount ?? 0,
    providerCallCount: run?.evidence && "providerCallCount" in run.evidence
      ? run.evidence.providerCallCount
      : 0,
    providerCallCountMinimum: run?.evidence?.providerCallCountMinimum ?? 0,
    actionCount: run?.evidence && "actionCount" in run.evidence
      ? run.evidence.actionCount
      : 0,
    actionCountMinimum: run?.evidence?.actionCountMinimum ?? 0,
    continuationAudit: run?.evidence?.continuationAudit === true,
    runCompletionAudit: run?.evidence?.runCompletionAudit === true,
    outcomeUnknown: run?.evidence?.outcomeUnknown === true,
    steps: Array.isArray(run?.steps) ? run.steps.slice(0, 2).map(compactStep) : [],
  };
}

function compactAssessment(result) {
  return {
    status: result?.status ?? null,
    outcome: result?.assessment?.outcome ?? "unknown",
    confidence: typeof result?.assessment?.confidence === "number"
      ? result.assessment.confidence
      : null,
    taskId: result?.evidence?.taskId ?? null,
    objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
    taskVersionHash: result?.evidence?.taskVersionHash ?? null,
    contextContentHash: result?.evidence?.contextContentHash ?? null,
    requestContentHash: result?.evidence?.requestContentHash ?? null,
    responseContentHash: result?.evidence?.responseContentHash ?? null,
    sceneContentHash: result?.evidence?.sceneContentHash ?? null,
    sceneItemCount: result?.evidence?.sceneItemCount ?? 0,
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
    maximumActions: 0,
    actionExecuted: false,
    taskMutated: false,
    automaticContinuation: false,
  };
}

export function createAiWorkspaceReviewedCycleCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_reviewed_cycle_request_invalid",
        policyId: "ai-workspace-explicit-reviewed-cycle",
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
      return "AI workspace reviewed cycle accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace reviewed cycle runtime is unavailable.";
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
      kind: "ai.workspace.reviewed_cycle",
      ok: result?.ok === true,
      status: result?.status ?? null,
      terminalReason: result?.terminalReason ?? null,
      taskId: result?.evidence?.taskId ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      providerCallCount: result?.evidence && "providerCallCount" in result.evidence
        ? result.evidence.providerCallCount
        : 0,
      providerCallCountMinimum: result?.evidence?.providerCallCountMinimum ?? 0,
      actionCount: result?.evidence && "actionCount" in result.evidence
        ? result.evidence.actionCount
        : 0,
      actionCountMinimum: result?.evidence?.actionCountMinimum ?? 0,
      runCompletionAudit: result?.evidence?.runCompletionAudit === true,
      assessmentContinuationAudit: result?.evidence?.assessmentContinuationAudit === true,
      assessmentCompletionAudit: result?.evidence?.assessmentCompletionAudit === true,
      cycleCompletionAudit: result?.evidence?.cycleCompletionAudit === true,
      assessmentReceiptEligible: result?.evidence?.assessmentReceiptEligible === true,
      outcomeUnknown: result?.evidence?.outcomeUnknown === true,
      run: compactRun(result?.run),
      assessment: compactAssessment(result?.assessment),
      maximumProviderCalls: 3,
      maximumActions: 2,
      taskMutated: false,
      automaticTaskCompletion: false,
      requiresOperatorAcceptance: true,
      providerTriggeredCompletion: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
