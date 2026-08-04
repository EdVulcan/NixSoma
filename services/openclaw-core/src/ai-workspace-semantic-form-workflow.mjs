import {
  AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS,
} from "./ai-workspace-single-step-contract.mjs";

export const AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_REGISTRY =
  "nixsoma-ai-workspace-semantic-form-workflow-v0";

const SINGLE_STEP_REGISTRY = "nixsoma-ai-workspace-single-step-v0";
const SHA256 = /^[a-f0-9]{64}$/u;

function boundedHash(value) {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || value.charCount > AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS
    || !Number.isInteger(value.byteLength)
    || value.byteLength < 1
    || value.byteLength < value.charCount
    || value.byteLength > value.charCount * 4
    || !Number.isInteger(value.maxChars)
    || value.maxChars < value.charCount
    || value.truncated !== false
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: value.byteLength,
    maxChars: value.maxChars,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function compactStep(result, index) {
  const evidence = result?.evidence ?? {};
  const actionId = result?.decision?.actionId ?? result?.fallback?.actionId ?? null;
  return {
    index,
    registry: result?.registry === SINGLE_STEP_REGISTRY ? SINGLE_STEP_REGISTRY : null,
    status: typeof result?.status === "string" ? result.status.slice(0, 80) : null,
    actionId: typeof actionId === "string" ? actionId.slice(0, 40) : null,
    itemOrdinal: Number.isInteger(result?.action?.itemOrdinal)
      ? result.action.itemOrdinal
      : Number.isInteger(result?.decision?.itemOrdinal) ? result.decision.itemOrdinal : null,
    inputEvidence: compactInputEvidence(
      result?.action?.inputEvidence ?? evidence.inputEvidence ?? result?.decision?.inputEvidence,
    ),
    providerCalled: result?.governance?.providerCalled === true,
    actionExecuted: result?.governance?.actionExecuted === true,
    postActionVerified: evidence.postActionVerified === true,
    completionAudit: evidence.completionAudit === true,
    semanticSceneBound: result?.governance?.semanticSceneBound === true,
    currentFrameBound: result?.governance?.currentFrameBound === true,
    currentActiveSurfaceBound: result?.governance?.currentActiveSurfaceBound === true,
    semanticItemOrdinalBound: result?.governance?.semanticItemOrdinalBound === true,
    currentBrowserSurfaceBound: result?.governance?.currentBrowserSurfaceBound === true,
    taskObjectiveBound: result?.governance?.taskObjectiveBound === true,
    semanticSubmitTargetBound: result?.governance?.semanticSubmitTargetBound === true,
    keyboardInput: result?.governance?.keyboardInput === true,
    providerGeneratedInput: result?.governance?.providerGeneratedInput === true,
    taskId: typeof evidence.taskId === "string" ? evidence.taskId.slice(0, 200) : null,
    objectiveContentHash: boundedHash(evidence.objectiveContentHash),
    taskVersionHash: boundedHash(evidence.taskVersionHash),
    responseContentHash: boundedHash(evidence.responseContentHash),
    sceneContentHash: boundedHash(evidence.sceneContentHash),
  };
}

function validStep(step, expectedActions) {
  if (step.registry !== SINGLE_STEP_REGISTRY
    || typeof step.status !== "string"
    || !expectedActions.has(step.actionId)) return false;
  if (step.status === "local_fallback") {
    return step.actionId === "no_op" && step.actionExecuted === false;
  }
  return typeof step.taskId === "string"
    && step.taskId.length > 0
    && boundedHash(step.objectiveContentHash) !== null
    && boundedHash(step.taskVersionHash) !== null;
}

function taskBinding(step) {
  return {
    taskId: step.taskId,
    objectiveContentHash: step.objectiveContentHash,
    taskVersionHash: step.taskVersionHash,
  };
}

function sameTaskBinding(left, right) {
  return left.taskId === right.taskId
    && left.objectiveContentHash === right.objectiveContentHash
    && left.taskVersionHash === right.taskVersionHash;
}

function verifiedType(step) {
  return step.status === "executed"
    && step.actionId === "type_item"
    && Number.isInteger(step.itemOrdinal)
    && step.itemOrdinal >= 1
    && step.inputEvidence !== null
    && boundedHash(step.responseContentHash) !== null
    && boundedHash(step.sceneContentHash) !== null
    && step.providerCalled
    && step.actionExecuted
    && step.postActionVerified
    && step.completionAudit
    && step.semanticSceneBound
    && step.currentFrameBound
    && step.currentActiveSurfaceBound
    && step.semanticItemOrdinalBound
    && step.currentBrowserSurfaceBound
    && step.taskObjectiveBound
    && step.keyboardInput
    && step.providerGeneratedInput;
}

function verifiedSubmit(step) {
  return step.status === "executed"
    && step.actionId === "click_item"
    && Number.isInteger(step.itemOrdinal)
    && step.itemOrdinal >= 1
    && boundedHash(step.responseContentHash) !== null
    && boundedHash(step.sceneContentHash) !== null
    && step.providerCalled
    && step.actionExecuted
    && step.postActionVerified
    && step.completionAudit
    && step.semanticSceneBound
    && step.currentFrameBound
    && step.currentActiveSurfaceBound
    && step.semanticItemOrdinalBound
    && step.currentBrowserSurfaceBound
    && step.taskObjectiveBound
    && step.semanticSubmitTargetBound
    && !step.keyboardInput;
}

export function createAiWorkspaceSemanticFormWorkflow({
  invokeType,
  invokeSubmit,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  async function complete({
    ok = true,
    status,
    terminalReason,
    steps,
    continuationAudit = false,
    continuedAfterVerifiedType = false,
    outcomeUnknown = false,
  }) {
    const providerCallCountMinimum = steps.filter((step) => step.providerCalled).length;
    const actionCountMinimum = steps.filter((step) => step.actionExecuted).length;
    const providerCallCount = outcomeUnknown ? null : providerCallCountMinimum;
    const actionCount = outcomeUnknown ? null : actionCountMinimum;
    let workflowCompletionAudit = false;
    try {
      const accepted = await publishAuditEvent("ai_workspace.semantic_form_workflow_completed", {
        registry: AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_REGISTRY,
        at: now(),
        status,
        terminalReason,
        steps,
        stepCount: steps.length,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        continuationAudit,
        continuedAfterVerifiedType,
        outcomeUnknown,
        maximumProviderCalls: 2,
        maximumActions: 2,
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
      ok: ok && finalStatus === "completed",
      registry: AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_REGISTRY,
      status: finalStatus,
      terminalReason: finalReason,
      steps,
      evidence: {
        taskId: steps[0]?.taskId ?? null,
        objectiveContentHash: steps[0]?.objectiveContentHash ?? null,
        taskVersionHash: steps[0]?.taskVersionHash ?? null,
        stepCount: steps.length,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        continuationAudit,
        workflowCompletionAudit,
        outcomeUnknown,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        maximumProviderCalls: 2,
        providerCallCount,
        maximumActions: 2,
        actionCount,
        continuationAfterVerifiedTypeOnly: true,
        continuedAfterVerifiedType,
        terminalAfterSubmitStep: true,
        boundedAutomaticContinuation: continuedAfterVerifiedType,
        automaticRepeat: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        taskMutated: false,
        automaticTaskCompletion: false,
        createsTask: false,
        createsApproval: false,
        parentDisplayConnected: false,
        mutatesHost: false,
      },
    };
  }

  async function invoke(input = {}) {
    if (typeof invokeType !== "function" || typeof invokeSubmit !== "function") {
      return complete({
        ok: false,
        status: "runtime_unavailable",
        terminalReason: "semantic_form_runtime_unavailable",
        steps: [],
      });
    }

    let typeResult;
    try {
      typeResult = await invokeType(input);
    } catch {
      return complete({
        ok: false,
        status: "type_step_outcome_unknown",
        terminalReason: "type_step_failed",
        steps: [],
        outcomeUnknown: true,
      });
    }
    const typeStep = compactStep(typeResult, 1);
    if (!validStep(typeStep, new Set(["no_op", "type_item"]))) {
      return complete({
        ok: false,
        status: "type_step_outcome_unknown",
        terminalReason: "type_step_result_invalid",
        steps: [],
        outcomeUnknown: true,
      });
    }
    if (typeStep.status === "local_fallback" || typeStep.actionId === "no_op") {
      return complete({
        ok: false,
        status: "stopped_after_type",
        terminalReason: typeStep.status === "local_fallback"
          ? "type_step_fallback"
          : "type_step_no_op",
        steps: [typeStep],
      });
    }
    if (!verifiedType(typeStep)) {
      return complete({
        ok: false,
        status: "stopped_after_type",
        terminalReason: "type_step_not_verified",
        steps: [typeStep],
      });
    }

    let continuationAudit = false;
    try {
      const accepted = await publishAuditEvent("ai_workspace.semantic_form_continuation_authorized", {
        registry: AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_REGISTRY,
        at: now(),
        ...taskBinding(typeStep),
        typeStep,
        nextStep: 2,
        continuationReason: "verified_semantic_type",
        maximumProviderCalls: 2,
        maximumActions: 2,
        automaticRepeat: false,
      });
      continuationAudit = accepted?.ok === true;
    } catch {
      continuationAudit = false;
    }
    if (!continuationAudit) {
      return complete({
        ok: false,
        status: "stopped_after_type",
        terminalReason: "continuation_audit_unavailable",
        steps: [typeStep],
      });
    }

    let submitResult;
    try {
      submitResult = await invokeSubmit({
        ...input,
        expectedTaskBinding: taskBinding(typeStep),
      });
    } catch {
      return complete({
        ok: false,
        status: "submit_step_outcome_unknown",
        terminalReason: "submit_step_failed",
        steps: [typeStep],
        continuationAudit: true,
        continuedAfterVerifiedType: true,
        outcomeUnknown: true,
      });
    }
    const submitStep = compactStep(submitResult, 2);
    if (!validStep(submitStep, new Set(["no_op", "click_item"]))
      || (submitStep.status !== "local_fallback" && !sameTaskBinding(typeStep, submitStep))) {
      return complete({
        ok: false,
        status: "submit_step_outcome_unknown",
        terminalReason: "submit_step_result_invalid",
        steps: [typeStep],
        continuationAudit: true,
        continuedAfterVerifiedType: true,
        outcomeUnknown: true,
      });
    }
    if (submitStep.status === "local_fallback" || submitStep.actionId === "no_op") {
      return complete({
        ok: false,
        status: "stopped_after_submit",
        terminalReason: submitStep.status === "local_fallback"
          ? "submit_step_fallback"
          : "submit_step_no_op",
        steps: [typeStep, submitStep],
        continuationAudit: true,
        continuedAfterVerifiedType: true,
      });
    }
    if (!verifiedSubmit(submitStep)) {
      return complete({
        ok: false,
        status: "stopped_after_submit",
        terminalReason: "submit_step_not_verified",
        steps: [typeStep, submitStep],
        continuationAudit: true,
        continuedAfterVerifiedType: true,
      });
    }
    return complete({
      status: "completed",
      terminalReason: "verified_type_then_submit",
      steps: [typeStep, submitStep],
      continuationAudit: true,
      continuedAfterVerifiedType: true,
    });
  }

  return {
    invoke,
    busy: () => complete({
      ok: false,
      status: "local_fallback",
      terminalReason: "workspace_run_in_flight",
      steps: [],
    }),
  };
}
