import {
  AI_WORKSPACE_OCR_TYPE_REVIEWED_MULTI_APPLICATION_MODE,
} from "./ai-workspace-ocr-type.mjs";

export const AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_REGISTRY =
  "nixsoma-ai-workspace-native-intake-workflow-v0";

const CAPABILITY_ID = "act.ai.workspace.native_intake_workflow";
const INTENT = "ai.workspace.native_intake_workflow";
const LIFECYCLE_REGISTRY = "nixsoma-ai-native-intake-lifecycle-v0";
const LIFECYCLE_UNIT = "nixsoma-ai-native-intake.service";
const OCR_TYPE_REGISTRY = "nixsoma-ai-workspace-ocr-type-v0";
const SHA256 = /^[a-f0-9]{64}$/u;
const FIXED_INPUT = /^[A-Za-z0-9 .,_-]{1,32}$/u;

function boundedHash(value) {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || value.charCount > 32
    || !Number.isInteger(value.byteLength)
    || value.byteLength < value.charCount
    || value.byteLength > value.charCount * 4
    || value.maxChars !== 32
    || value.truncated !== false
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: value.byteLength,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function normaliseMissionBinding(taskBinding, inputText) {
  if (taskBinding === null || taskBinding === undefined) {
    return inputText === null || inputText === undefined ? null : undefined;
  }
  const keys = typeof taskBinding === "object" && !Array.isArray(taskBinding)
    ? Object.keys(taskBinding).sort()
    : [];
  if (keys.join("\0") !== [
    "objectiveContentHash",
    "taskId",
    "taskVersionHash",
  ].sort().join("\0")
    || typeof taskBinding.taskId !== "string"
    || !taskBinding.taskId
    || boundedHash(taskBinding.objectiveContentHash) === null
    || boundedHash(taskBinding.taskVersionHash) === null
    || typeof inputText !== "string"
    || !FIXED_INPUT.test(inputText)) return undefined;
  return { taskBinding: { ...taskBinding }, inputText };
}

function nativeIntakeLifecycleFromState(state) {
  return state?.workView?.aiGraphicalSession?.nativeIntakeLifecycle
    ?? state?.aiGraphicalSession?.nativeIntakeLifecycle
    ?? null;
}

function lifecycleStopped(application) {
  return application?.registry === LIFECYCLE_REGISTRY
    && application.unitName === LIFECYCLE_UNIT
    && application.enabled === true
    && application.status === "stopped"
    && application.active === false
    && application.surfaceAttached === false
    && application.matchingSurface === null;
}

export function aiWorkspaceNativeIntakeLifecycleStopped(state) {
  return lifecycleStopped(nativeIntakeLifecycleFromState(state));
}

function compactStartedLifecycle(application) {
  const surface = application?.matchingSurface;
  if (application?.registry !== LIFECYCLE_REGISTRY
    || application.unitName !== LIFECYCLE_UNIT
    || application.enabled !== true
    || application.status !== "running"
    || application.active !== true
    || application.surfaceAttached !== true
    || application.reused !== false
    || !Number.isInteger(application.mainPid)
    || application.mainPid < 1
    || !Number.isInteger(application.surfaceInventorySequence)
    || application.surfaceInventorySequence < 1
    || !Number.isInteger(surface?.surfaceId)
    || surface.surfaceId < 1
    || surface.pid !== application.mainPid
    || !Number.isInteger(surface.width)
    || surface.width < 1
    || surface.width > 1280
    || !Number.isInteger(surface.height)
    || surface.height < 1
    || surface.height > 720
    || surface.activated !== true) return null;
  return {
    registry: LIFECYCLE_REGISTRY,
    unitName: LIFECYCLE_UNIT,
    status: "running",
    active: true,
    surfaceAttached: true,
    surfaceId: surface.surfaceId,
    inventorySequence: application.surfaceInventorySequence,
    activated: true,
    reused: false,
  };
}

function compactStoppedLifecycle(application) {
  if (application?.registry !== LIFECYCLE_REGISTRY
    || application.unitName !== LIFECYCLE_UNIT
    || application.enabled !== true
    || application.status !== "stopped"
    || application.active !== false
    || application.surfaceAttached !== false
    || application.matchingSurface !== null
    || application.reused !== false) return null;
  return {
    registry: LIFECYCLE_REGISTRY,
    unitName: LIFECYCLE_UNIT,
    status: "stopped",
    active: false,
    surfaceAttached: false,
    surfaceId: null,
    inventorySequence: Number.isSafeInteger(application.surfaceInventorySequence)
      ? application.surfaceInventorySequence
      : null,
    activated: false,
    reused: false,
  };
}

function compactTypeStep(result) {
  if (result?.registry !== OCR_TYPE_REGISTRY) return null;
  const evidence = result.evidence ?? {};
  const action = result.action ?? {};
  return {
    registry: OCR_TYPE_REGISTRY,
    status: typeof result.status === "string" ? result.status.slice(0, 80) : null,
    actionId: action.actionId === "type_text" ? "type_text" : "no_op",
    inputEvidence: compactInputEvidence(action.inputEvidence ?? evidence.inputEvidence),
    surfaceId: Number.isInteger(action.surfaceId) ? action.surfaceId : null,
    inventorySequence: Number.isSafeInteger(action.inventorySequence)
      ? action.inventorySequence
      : null,
    taskId: typeof evidence.taskId === "string" ? evidence.taskId.slice(0, 200) : null,
    objectiveContentHash: boundedHash(evidence.objectiveContentHash),
    taskVersionHash: boundedHash(evidence.taskVersionHash),
    contextContentHash: boundedHash(evidence.contextContentHash),
    requestContentHash: boundedHash(evidence.requestContentHash),
    responseContentHash: boundedHash(evidence.responseContentHash),
    frameContentHash: boundedHash(evidence.frameContentHash),
    verificationFrameContentHash: boundedHash(evidence.verificationFrameContentHash),
    verificationFrameSequence: Number.isSafeInteger(evidence.verificationFrameSequence)
      ? evidence.verificationFrameSequence
      : null,
    postActionFrameContentHash: boundedHash(evidence.postActionFrameContentHash),
    postActionFrameSequence: Number.isSafeInteger(evidence.postActionFrameSequence)
      ? evidence.postActionFrameSequence
      : null,
    providerCalled: result.governance?.providerCalled === true,
    actionExecuted: action.executed === true && result.governance?.actionExecuted === true,
    receiptMatched: evidence.receiptMatched === true,
    frameChanged: evidence.frameChanged === true,
    postActionVerified: evidence.postActionVerified === true,
    completionAudit: evidence.completionAudit === true,
    expectedSurfaceBound: evidence.expectedSurfaceBound === true
      && result.governance?.fixedApplicationSurfaceBound === true,
    taskObjectiveBound: result.governance?.taskObjectiveBound === true,
    taskObjectiveInputBound: result.governance?.taskObjectiveInputBound === true,
    currentFrameBound: result.governance?.currentFrameBound === true,
    currentActiveSurfaceBound: result.governance?.currentActiveSurfaceBound === true,
    keyboardInput: result.governance?.keyboardInput === true,
    providerGeneratedInput: result.governance?.providerGeneratedInput === true,
    reviewedMultiApplicationMissionMode:
      result.governance?.reviewedMultiApplicationMissionMode === true,
  };
}

function verifiedTypeStep(step, expectedSurfaceBinding, expectedTaskId, missionBound = false) {
  return step?.status === "executed"
    && step.actionId === "type_text"
    && step.inputEvidence !== null
    && step.surfaceId === expectedSurfaceBinding.surfaceId
    && step.inventorySequence === expectedSurfaceBinding.inventorySequence
    && step.taskId === expectedTaskId
    && boundedHash(step.objectiveContentHash) !== null
    && boundedHash(step.taskVersionHash) !== null
    && boundedHash(step.contextContentHash) !== null
    && boundedHash(step.requestContentHash) !== null
    && boundedHash(step.responseContentHash) !== null
    && boundedHash(step.frameContentHash) !== null
    && boundedHash(step.verificationFrameContentHash) !== null
    && boundedHash(step.postActionFrameContentHash) !== null
    && Number.isSafeInteger(step.verificationFrameSequence)
    && Number.isSafeInteger(step.postActionFrameSequence)
    && step.postActionFrameSequence > step.verificationFrameSequence
    && step.providerCalled
    && step.actionExecuted
    && step.receiptMatched
    && step.frameChanged
    && step.postActionVerified
    && step.completionAudit
    && step.expectedSurfaceBound
    && step.taskObjectiveBound
    && step.taskObjectiveInputBound
    && step.currentFrameBound
    && step.currentActiveSurfaceBound
    && step.keyboardInput
    && step.providerGeneratedInput
    && (!missionBound || step.reviewedMultiApplicationMissionMode);
}

export function createAiWorkspaceNativeIntakeWorkflow({
  invokeType,
  fetchJson,
  postJson,
  sessionManagerUrl,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  async function complete({
    status,
    terminalReason,
    started = null,
    stopped = null,
    typeStep = null,
    providerOutcomeUnknown = false,
    lifecycleOutcomeUnknown = false,
    startAttempted = false,
    stopAttempted = false,
  }) {
    const providerCallCountMinimum = typeStep?.providerCalled === true ? 1 : 0;
    const actionCountMinimum = typeStep?.actionExecuted === true ? 1 : 0;
    const lifecycleActionCountMinimum = Number(started !== null) + Number(stopped !== null);
    const providerCallCount = providerOutcomeUnknown ? null : providerCallCountMinimum;
    const actionCount = providerOutcomeUnknown ? null : actionCountMinimum;
    const lifecycleActionCount = lifecycleOutcomeUnknown
      ? null
      : lifecycleActionCountMinimum;
    const fixedActionCount = actionCount === null || lifecycleActionCount === null
      ? null
      : actionCount + lifecycleActionCount;
    const outcomeUnknown = providerOutcomeUnknown || lifecycleOutcomeUnknown;
    let workflowCompletionAudit = false;
    try {
      const accepted = await publishAuditEvent("ai_workspace.native_intake_workflow_completed", {
        registry: AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_REGISTRY,
        at: now(),
        status,
        terminalReason,
        application: { started, stopped },
        typeStep,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        lifecycleActionCount,
        lifecycleActionCountMinimum,
        fixedActionCount,
        startAttempted,
        stopAttempted,
        outcomeUnknown,
        maximumProviderCalls: 1,
        maximumActions: 1,
        maximumLifecycleActions: 2,
        automaticRepeat: false,
        taskMutated: false,
        automaticTaskCompletion: false,
      });
      workflowCompletionAudit = accepted?.ok === true;
    } catch {
      workflowCompletionAudit = false;
    }
    const finalStatus = status === "completed" && !workflowCompletionAudit
      ? "completed_audit_unavailable"
      : status;
    const finalReason = status === "completed" && !workflowCompletionAudit
      ? "workflow_completion_audit_unavailable"
      : terminalReason;
    return {
      ok: finalStatus === "completed",
      registry: AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_REGISTRY,
      status: finalStatus,
      terminalReason: finalReason,
      application: { started, stopped },
      typeStep,
      evidence: {
        taskId: typeStep?.taskId ?? null,
        objectiveContentHash: typeStep?.objectiveContentHash ?? null,
        taskVersionHash: typeStep?.taskVersionHash ?? null,
        surfaceId: started?.surfaceId ?? null,
        inventorySequence: started?.inventorySequence ?? null,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        lifecycleActionCount,
        lifecycleActionCountMinimum,
        fixedActionCount,
        lifecycleStartVerified: started !== null,
        lifecycleStopVerified: stopped !== null,
        workflowCompletionAudit,
        outcomeUnknown,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        maximumProviderCalls: 1,
        providerCallCount,
        maximumActions: 1,
        actionCount,
        maximumLifecycleActions: 2,
        lifecycleActionCount,
        maximumFixedActions: 3,
        fixedActionCount,
        exactFixedApplication: true,
        fixedProcessStart: startAttempted,
        fixedProcessStop: stopAttempted,
        currentActiveSurfaceBound: typeStep?.expectedSurfaceBound === true,
        taskObjectiveBound: typeStep?.taskObjectiveBound === true,
        reviewedMultiApplicationMissionMode:
          typeStep?.reviewedMultiApplicationMissionMode === true,
        keyboardInput: typeStep?.keyboardInput === true,
        arbitraryKeyboardInput: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        taskMutated: false,
        automaticTaskCompletion: false,
        arbitraryProcessLaunch: false,
        arbitraryWindowControl: false,
        networkAccessExpanded: false,
        createsTask: false,
        createsApproval: false,
        parentDisplayConnected: false,
        mutatesHost: false,
      },
    };
  }

  async function lifecycleRequest(operation, taskId) {
    const start = operation === "start";
    const path = `/work-view/application/native-intake/${operation}`;
    return postJson(`${sessionManagerUrl}${path}`, {
      operatorActionSource: "ai_workspace_native_intake_workflow",
      recommendedAction: start ? "start_ai_native_intake" : "stop_ai_native_intake",
    }, {
      grantContext: {
        taskId,
        stepId: null,
        capabilityId: CAPABILITY_ID,
        intent: INTENT,
      },
    });
  }

  async function invoke({
    taskId,
    expectedTaskBinding = null,
    expectedInputText = null,
  } = {}) {
    if (typeof invokeType !== "function"
      || typeof fetchJson !== "function"
      || typeof postJson !== "function"
      || typeof sessionManagerUrl !== "string") {
      return complete({
        status: "runtime_unavailable",
        terminalReason: "native_intake_workflow_runtime_unavailable",
      });
    }
    const missionBinding = normaliseMissionBinding(expectedTaskBinding, expectedInputText);
    if (missionBinding === undefined
      || (missionBinding && missionBinding.taskBinding.taskId !== taskId)) {
      return complete({
        status: "precondition_failed",
        terminalReason: "reviewed_multi_application_binding_invalid",
      });
    }

    let initialState;
    try {
      initialState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    } catch {
      return complete({
        status: "precondition_unavailable",
        terminalReason: "native_intake_state_unavailable",
      });
    }
    if (!aiWorkspaceNativeIntakeLifecycleStopped(initialState)) {
      return complete({
        status: "precondition_failed",
        terminalReason: "native_intake_not_stopped",
      });
    }

    let status = "start_outcome_unknown";
    let terminalReason = "native_intake_start_failed";
    let started = null;
    let stopped = null;
    let typeStep = null;
    let providerOutcomeUnknown = false;
    let lifecycleOutcomeUnknown = false;
    let startAttempted = false;
    let stopAttempted = false;

    try {
      startAttempted = true;
      let startResponse;
      try {
        startResponse = await lifecycleRequest("start", taskId);
      } catch {
        lifecycleOutcomeUnknown = true;
      }
      if (!lifecycleOutcomeUnknown) {
        started = compactStartedLifecycle(startResponse?.application);
        if (!started) {
          status = "start_evidence_invalid";
          terminalReason = "native_intake_start_evidence_invalid";
          lifecycleOutcomeUnknown = true;
        } else {
          const expectedSurfaceBinding = {
            surfaceId: started.surfaceId,
            inventorySequence: started.inventorySequence,
          };
          let typeResult;
          try {
            typeResult = await invokeType({
              taskId,
              expectedSurfaceBinding,
              ...(missionBinding ? {
                expectedTaskBinding: missionBinding.taskBinding,
                expectedInputText: missionBinding.inputText,
                decisionMode: AI_WORKSPACE_OCR_TYPE_REVIEWED_MULTI_APPLICATION_MODE,
              } : {}),
            });
          } catch {
            providerOutcomeUnknown = true;
            status = "type_outcome_unknown";
            terminalReason = "native_intake_type_failed";
          }
          if (!providerOutcomeUnknown) {
            typeStep = compactTypeStep(typeResult);
            if (verifiedTypeStep(
              typeStep,
              expectedSurfaceBinding,
              taskId,
              missionBinding !== null,
            )) {
              status = "completed";
              terminalReason = "verified_native_intake_type";
            } else {
              status = "stopped_after_type";
              terminalReason = typeStep?.status === "no_action"
                ? "native_intake_type_no_action"
                : typeStep?.status === "local_fallback"
                  ? "native_intake_type_fallback"
                  : "native_intake_type_not_verified";
            }
          }
        }
      }
    } finally {
      if (startAttempted) {
        stopAttempted = true;
        try {
          const stopResponse = await lifecycleRequest("stop", taskId);
          stopped = compactStoppedLifecycle(stopResponse?.application);
          if (!stopped) {
            lifecycleOutcomeUnknown = true;
            status = "cleanup_evidence_invalid";
            terminalReason = "native_intake_stop_evidence_invalid";
          }
        } catch {
          lifecycleOutcomeUnknown = true;
          status = "cleanup_outcome_unknown";
          terminalReason = "native_intake_stop_failed";
        }
      }
    }

    return complete({
      status,
      terminalReason,
      started,
      stopped,
      typeStep,
      providerOutcomeUnknown,
      lifecycleOutcomeUnknown,
      startAttempted,
      stopAttempted,
    });
  }

  return {
    invoke,
    busy: () => complete({
      status: "local_fallback",
      terminalReason: "workspace_run_in_flight",
    }),
  };
}
