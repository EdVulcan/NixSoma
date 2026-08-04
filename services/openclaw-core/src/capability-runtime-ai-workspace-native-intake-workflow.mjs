import { aiWorkspaceTaskRequestIsBounded } from "./ai-workspace-capability-request.mjs";

export const AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_CAPABILITY_ID =
  "act.ai.workspace.native_intake_workflow";

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_CAPABILITY_ID;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || value.charCount > 32
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: Number.isInteger(value.byteLength) ? value.byteLength : null,
    maxChars: 32,
    textExposed: false,
    persisted: false,
  };
}

function compactLifecycle(value) {
  return {
    registry: value?.registry ?? null,
    unitName: value?.unitName ?? null,
    status: value?.status ?? null,
    active: value?.active === true,
    surfaceAttached: value?.surfaceAttached === true,
    surfaceId: Number.isInteger(value?.surfaceId) ? value.surfaceId : null,
    inventorySequence: Number.isSafeInteger(value?.inventorySequence)
      ? value.inventorySequence
      : null,
    activated: value?.activated === true,
  };
}

export function createAiWorkspaceNativeIntakeWorkflowCapabilityHandlers({ runtime } = {}) {
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
        reason: approved ? null : "ai_workspace_native_intake_workflow_request_invalid",
        policyId: "ai-workspace-explicit-native-intake-workflow",
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
      return "AI workspace native intake workflow accepts only capabilityId, one taskId, and params.confirm=true.";
    }
    if (!runtime || typeof runtime.invoke !== "function") {
      return "AI workspace native intake workflow runtime is unavailable.";
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
      kind: "ai.workspace.native_intake_workflow",
      ok: result?.ok === true,
      status: result?.status ?? null,
      terminalReason: result?.terminalReason ?? null,
      taskId: evidence.taskId ?? null,
      objectiveContentHash: evidence.objectiveContentHash ?? null,
      taskVersionHash: evidence.taskVersionHash ?? null,
      surfaceId: evidence.surfaceId ?? null,
      inventorySequence: evidence.inventorySequence ?? null,
      providerCallCount: "providerCallCount" in evidence ? evidence.providerCallCount : 0,
      providerCallCountMinimum: evidence.providerCallCountMinimum ?? 0,
      actionCount: "actionCount" in evidence ? evidence.actionCount : 0,
      actionCountMinimum: evidence.actionCountMinimum ?? 0,
      lifecycleActionCount: "lifecycleActionCount" in evidence
        ? evidence.lifecycleActionCount
        : 0,
      lifecycleActionCountMinimum: evidence.lifecycleActionCountMinimum ?? 0,
      lifecycleStartVerified: evidence.lifecycleStartVerified === true,
      lifecycleStopVerified: evidence.lifecycleStopVerified === true,
      workflowCompletionAudit: evidence.workflowCompletionAudit === true,
      outcomeUnknown: evidence.outcomeUnknown === true,
      application: {
        started: compactLifecycle(result?.application?.started),
        stopped: compactLifecycle(result?.application?.stopped),
      },
      typeStep: result?.typeStep ? {
        status: result.typeStep.status ?? null,
        actionId: result.typeStep.actionId ?? null,
        inputEvidence: compactInputEvidence(result.typeStep.inputEvidence),
        providerCalled: result.typeStep.providerCalled === true,
        actionExecuted: result.typeStep.actionExecuted === true,
        postActionVerified: result.typeStep.postActionVerified === true,
        completionAudit: result.typeStep.completionAudit === true,
        expectedSurfaceBound: result.typeStep.expectedSurfaceBound === true,
      } : null,
      maximumProviderCalls: 1,
      maximumActions: 1,
      maximumLifecycleActions: 2,
      exactFixedApplication: governance.exactFixedApplication === true,
      currentActiveSurfaceBound: governance.currentActiveSurfaceBound === true,
      automaticRepeat: false,
      arbitraryKeyboardInput: false,
      enterKeyInput: false,
      hotkeyInput: false,
      inputTextExposed: false,
      inputTextPersisted: false,
      taskMutated: false,
      automaticTaskCompletion: false,
      arbitraryProcessLaunch: false,
      arbitraryWindowControl: false,
      networkAccessExpanded: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
