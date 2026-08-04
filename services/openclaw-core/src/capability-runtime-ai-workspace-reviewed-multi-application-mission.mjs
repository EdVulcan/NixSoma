import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_CAPABILITY_ID =
  "act.ai.workspace.reviewed_multi_application_mission";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_CAPABILITY_ID;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || value.charCount > 32
    || value.maxChars !== 32
    || value.truncated !== false
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: Number.isInteger(value.byteLength) ? value.byteLength : null,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function compactApplication(value) {
  return {
    applicationId: value?.applicationId ?? null,
    registry: value?.registry ?? null,
    status: value?.status ?? null,
    stepCount: Number.isInteger(value?.stepCount) ? value.stepCount : null,
    actionSequence: Array.isArray(value?.actionSequence)
      ? value.actionSequence.slice(0, 2)
      : [],
    providerCallCount: "providerCallCount" in (value ?? {})
      ? value.providerCallCount
      : 0,
    providerCallCountMinimum: value?.providerCallCountMinimum ?? 0,
    actionCount: "actionCount" in (value ?? {}) ? value.actionCount : 0,
    actionCountMinimum: value?.actionCountMinimum ?? 0,
    lifecycleActionCount: "lifecycleActionCount" in (value ?? {})
      ? value.lifecycleActionCount
      : 0,
    lifecycleActionCountMinimum: value?.lifecycleActionCountMinimum ?? 0,
    continuationAudit: value?.continuationAudit === true,
    completionAudit: value?.completionAudit === true,
    exactInputMatched: value?.exactInputMatched === true,
    lifecycleStartVerified: value?.lifecycleStartVerified === true,
    lifecycleStopVerified: value?.lifecycleStopVerified === true,
    verified: value?.verified === true,
    outcomeUnknown: value?.outcomeUnknown === true,
  };
}

export function createAiWorkspaceReviewedMultiApplicationMissionCapabilityHandlers({
  runtime,
} = {}) {
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
        reason: approved ? null : "ai_workspace_reviewed_multi_application_mission_request_invalid",
        policyId: "ai-workspace-explicit-reviewed-multi-application-mission",
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
      return "AI workspace reviewed multi-application mission accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace reviewed multi-application mission runtime is unavailable.";
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
      kind: "ai.workspace.reviewed_multi_application_mission",
      ok: result?.ok === true,
      status: result?.status ?? null,
      terminalReason: result?.terminalReason ?? null,
      taskId: evidence.taskId ?? null,
      objectiveContentHash: evidence.objectiveContentHash ?? null,
      taskVersionHash: evidence.taskVersionHash ?? null,
      inputEvidence: compactInputEvidence(evidence.inputEvidence),
      applications: Array.isArray(result?.applications)
        ? result.applications.slice(0, 2).map(compactApplication)
        : [],
      applicationCount: evidence.applicationCount ?? 0,
      providerCallCount: "providerCallCount" in evidence ? evidence.providerCallCount : 0,
      providerCallCountMinimum: evidence.providerCallCountMinimum ?? 0,
      actionCount: "actionCount" in evidence ? evidence.actionCount : 0,
      actionCountMinimum: evidence.actionCountMinimum ?? 0,
      lifecycleActionCount: "lifecycleActionCount" in evidence
        ? evidence.lifecycleActionCount
        : 0,
      lifecycleActionCountMinimum: evidence.lifecycleActionCountMinimum ?? 0,
      fixedActionCount: "fixedActionCount" in evidence ? evidence.fixedActionCount : 0,
      fixedActionCountMinimum: evidence.fixedActionCountMinimum ?? 0,
      continuationAudit: evidence.continuationAudit === true,
      missionCompletionAudit: evidence.missionCompletionAudit === true,
      outcomeUnknown: evidence.outcomeUnknown === true,
      maximumApplications: 2,
      fixedApplicationOrder: ["fixed_browser_form", "fixed_native_intake"],
      continuationAfterVerifiedBrowserOnly: true,
      continuedToNativeApplication: governance.continuedToNativeApplication === true,
      sameReviewedTaskAcrossApplications:
        governance.sameReviewedTaskAcrossApplications === true,
      sameExactObjectiveInputAcrossApplications:
        governance.sameExactObjectiveInputAcrossApplications === true,
      maximumProviderCalls: 3,
      maximumActions: 3,
      maximumLifecycleActions: 2,
      maximumFixedActions: 5,
      automaticRepeat: false,
      retry: false,
      arbitraryApplicationSelection: false,
      arbitraryProcessLaunch: false,
      arbitraryWindowControl: false,
      arbitraryKeyboardInput: false,
      enterKeyInput: false,
      hotkeyInput: false,
      inputTextExposed: false,
      inputTextPersisted: false,
      taskMutated: false,
      automaticTaskCompletion: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
