import { buildAiWorkspaceTaskObjectiveBinding } from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID =
  "act.ai.workspace.semantic_submit";
export const AI_WORKSPACE_SEMANTIC_SUBMIT_REGISTRY =
  "nixsoma-ai-workspace-semantic-submit-v0";

const SINGLE_STEP_CAPABILITY_ID = "act.ai.workspace.single_step";
const TYPE_RECEIPT_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_ID_CHARS = 200;
const ALLOWED_BODY_KEYS = new Set(["capabilityId", "taskId", "params"]);
const ALLOWED_PARAM_KEYS = new Set([
  "confirm",
  "typeInvocationId",
  "objectiveContentHash",
  "taskVersionHash",
  "responseContentHash",
  "sceneContentHash",
]);
const ACTION_CAPABILITY_IDS = new Set([
  SINGLE_STEP_CAPABILITY_ID,
  "act.ai.workspace.bounded_run",
  "act.ai.workspace.reviewed_cycle",
  "act.ai.workspace.ocr_click",
  "act.ai.workspace.ocr_type",
  "act.ai.workspace.ocr_focus_type",
  AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID,
]);

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID;
}

function boundedId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= MAX_ID_CHARS ? id : null;
}

function boundedHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || !Number.isInteger(value.byteLength)
    || value.byteLength < 1
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: value.byteLength,
    maxChars: Number.isInteger(value.maxChars) ? value.maxChars : null,
    truncated: value.truncated === true,
    textExposed: false,
    persisted: false,
  };
}

function requestIsBounded(request, rawBody) {
  const params = request?.params ?? {};
  return params.confirm === true
    && boundedId(request?.taskId) !== null
    && boundedId(params.typeInvocationId) !== null
    && boundedHash(params.objectiveContentHash) !== null
    && boundedHash(params.taskVersionHash) !== null
    && boundedHash(params.responseContentHash) !== null
    && boundedHash(params.sceneContentHash) !== null
    && request.stepId === null
    && request.operation === null
    && request.intent === null
    && Object.keys(params).length === ALLOWED_PARAM_KEYS.size
    && Object.keys(params).every((key) => ALLOWED_PARAM_KEYS.has(key))
    && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

function rejected(reason, taskId = null, { typeInvocationId = null } = {}) {
  return {
    ok: false,
    registry: AI_WORKSPACE_SEMANTIC_SUBMIT_REGISTRY,
    status: "rejected",
    reason,
    action: { actionId: "no_op", itemOrdinal: null, executed: false },
    evidence: {
      taskId,
      typeInvocationId,
      priorTypeReceiptBound: false,
      authorizationAudit: false,
      completionAudit: false,
    },
    governance: {
      explicitOperatorConfirmation: true,
      providerCalled: false,
      maximumProviderCalls: 1,
      maximumActions: 1,
      actionExecuted: false,
      priorTypeReceiptRequired: true,
      semanticSubmitTargetBound: false,
      automaticRepeat: false,
      keyboardInput: false,
      inputTextPersisted: false,
      taskMutated: false,
      automaticTaskCompletion: false,
      mutatesHost: false,
    },
  };
}

function receiptFromInvocation(entry, request, nowMs) {
  const summary = entry?.summary ?? {};
  const inputEvidence = compactInputEvidence(summary.inputEvidence);
  const ageMs = nowMs - Date.parse(entry?.at ?? "");
  const matched = entry?.id === request.params.typeInvocationId
    && entry?.invoked === true
    && entry?.blocked === false
    && entry?.capability?.id === SINGLE_STEP_CAPABILITY_ID
    && entry?.request?.taskId === request.taskId
    && entry?.authorization?.approved === true
    && entry?.authorization?.policyId === "ai-workspace-explicit-single-step"
    && entry?.policy?.decision === "audit_only"
    && entry?.policy?.domain === "cross_boundary"
    && entry?.policy?.approved === true
    && summary.kind === "ai.workspace.single_step"
    && summary.ok === true
    && summary.status === "executed"
    && summary.actionId === "type_item"
    && summary.taskId === request.taskId
    && summary.objectiveContentHash === request.params.objectiveContentHash
    && summary.taskVersionHash === request.params.taskVersionHash
    && summary.responseContentHash === request.params.responseContentHash
    && summary.sceneContentHash === request.params.sceneContentHash
    && summary.providerCalled === true
    && summary.actionExecuted === true
    && summary.currentFrameBound === true
    && summary.currentActiveSurfaceBound === true
    && summary.semanticSceneBound === true
    && summary.currentBrowserSurfaceBound === true
    && summary.taskObjectiveBound === true
    && summary.postActionVerified === true
    && summary.completionAudit === true
    && summary.providerGeneratedInput === true
    && summary.inputTextPersisted === false
    && summary.keyboardInput === true
    && inputEvidence !== null
    && Number.isFinite(ageMs)
    && ageMs >= 0
    && ageMs <= TYPE_RECEIPT_MAX_AGE_MS;
  return matched ? {
    typeInvocationId: entry.id,
    taskId: summary.taskId,
    objectiveContentHash: summary.objectiveContentHash,
    taskVersionHash: summary.taskVersionHash,
    responseContentHash: summary.responseContentHash,
    sceneContentHash: summary.sceneContentHash,
    inputEvidence,
    ageMs,
  } : null;
}

function taskBindingMatchesReceipt(binding, receipt) {
  return binding?.ok === true
    && binding.evidence.taskId === receipt.taskId
    && binding.evidence.objectiveContentHash === receipt.objectiveContentHash
    && binding.evidence.taskVersionHash === receipt.taskVersionHash;
}

function laterTaskActionExists(log, receiptIndex, taskId) {
  return log.slice(receiptIndex + 1).some((entry) =>
    entry?.request?.taskId === taskId
      && ACTION_CAPABILITY_IDS.has(entry?.capability?.id)
      && entry?.summary?.actionExecuted === true);
}

export function createAiWorkspaceSemanticSubmitCapabilityHandlers({
  runtime,
  capabilityInvocationLog = [],
  taskManager = {},
  readWorkViewState,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const consumedTypeInvocations = new Set(
    capabilityInvocationLog
      .filter((entry) => entry?.capability?.id === AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID
        && entry?.summary?.priorTypeReceiptBound === true
        && entry?.summary?.authorizationAudit === true)
      .map((entry) => entry?.summary?.typeInvocationId)
      .filter(Boolean),
  );
  const getTaskById = taskManager.getTaskById ?? (() => null);

  function authorizeRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return { handled: false, authorization: null };
    const approved = requestIsBounded(request, rawBody);
    return {
      handled: true,
      authorization: {
        registry: "openclaw-standing-capability-authorization-v0",
        required: false,
        ok: approved,
        approved,
        reason: approved ? null : "ai_workspace_semantic_submit_request_invalid",
        policyId: "ai-workspace-explicit-semantic-submit",
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
    if (!requestIsBounded(request, rawBody)) {
      return "AI workspace semantic submit requires only taskId, params.confirm=true, one type invocation ID, and its four receipt hashes.";
    }
    if (!runtime || typeof runtime.invoke !== "function"
      || typeof readWorkViewState !== "function") {
      return "AI workspace semantic submit runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (!isCapability(capability)) return { handled: false, result: null };
    const receiptIndex = capabilityInvocationLog.findIndex(
      (entry) => entry?.id === request.params.typeInvocationId,
    );
    const receipt = receiptIndex >= 0
      ? receiptFromInvocation(
          capabilityInvocationLog[receiptIndex],
          request,
          Date.parse(now()),
        )
      : null;
    if (!receipt) {
      return {
        handled: true,
        result: rejected("type_receipt_invalid", request.taskId, {
          typeInvocationId: request.params.typeInvocationId,
        }),
      };
    }
    if (consumedTypeInvocations.has(receipt.typeInvocationId)
      || laterTaskActionExists(capabilityInvocationLog, receiptIndex, request.taskId)) {
      return {
        handled: true,
        result: rejected("type_receipt_not_current", request.taskId, {
          typeInvocationId: receipt.typeInvocationId,
        }),
      };
    }

    let workViewState;
    try {
      workViewState = await readWorkViewState();
    } catch {
      return {
        handled: true,
        result: rejected("work_view_state_unavailable", request.taskId, {
          typeInvocationId: receipt.typeInvocationId,
        }),
      };
    }
    const binding = buildAiWorkspaceTaskObjectiveBinding({
      task: getTaskById(request.taskId),
      taskId: request.taskId,
      workViewState,
    });
    if (!taskBindingMatchesReceipt(binding, receipt)) {
      return {
        handled: true,
        result: rejected("task_version_changed", request.taskId, {
          typeInvocationId: receipt.typeInvocationId,
        }),
      };
    }

    const audit = await publishAuditEvent("ai_workspace.semantic_submit_authorized", {
      registry: AI_WORKSPACE_SEMANTIC_SUBMIT_REGISTRY,
      at: now(),
      taskId: receipt.taskId,
      typeInvocationId: receipt.typeInvocationId,
      objectiveContentHash: receipt.objectiveContentHash,
      taskVersionHash: receipt.taskVersionHash,
      typeResponseContentHash: receipt.responseContentHash,
      typeSceneContentHash: receipt.sceneContentHash,
      inputEvidence: receipt.inputEvidence,
      explicitOperatorConfirmation: true,
      maximumProviderCalls: 1,
      maximumActions: 1,
      automaticRepeat: false,
    });
    if (audit?.ok !== true) {
      throw new Error("required AI workspace semantic submit audit was not accepted");
    }
    consumedTypeInvocations.add(receipt.typeInvocationId);

    let submitResult;
    try {
      submitResult = await runtime.invoke({
        taskId: request.taskId,
        expectedTaskBinding: {
          taskId: receipt.taskId,
          objectiveContentHash: receipt.objectiveContentHash,
          taskVersionHash: receipt.taskVersionHash,
        },
      });
    } catch {
      return {
        handled: true,
        result: {
          ...rejected("semantic_submit_execution_failed", request.taskId, {
            typeInvocationId: receipt.typeInvocationId,
          }),
          evidence: {
            taskId: receipt.taskId,
            typeInvocationId: receipt.typeInvocationId,
            objectiveContentHash: receipt.objectiveContentHash,
            taskVersionHash: receipt.taskVersionHash,
            typeResponseContentHash: receipt.responseContentHash,
            typeSceneContentHash: receipt.sceneContentHash,
            inputEvidence: receipt.inputEvidence,
            priorTypeReceiptBound: true,
            authorizationAudit: true,
            completionAudit: false,
            postActionVerified: false,
          },
        },
      };
    }
    const actionId = submitResult?.decision?.actionId
      ?? submitResult?.fallback?.actionId
      ?? "no_op";
    const actionExecuted = submitResult?.governance?.actionExecuted === true;
    const action = {
      actionId,
      itemOrdinal: Number.isInteger(submitResult?.action?.itemOrdinal)
        ? submitResult.action.itemOrdinal
        : null,
      executed: actionExecuted,
      postActionVerified: submitResult?.evidence?.postActionVerified === true,
    };
    return {
      handled: true,
      result: {
        ok: submitResult?.ok === true,
        registry: AI_WORKSPACE_SEMANTIC_SUBMIT_REGISTRY,
        status: submitResult?.status ?? "local_fallback",
        action,
        evidence: {
          taskId: receipt.taskId,
          typeInvocationId: receipt.typeInvocationId,
          objectiveContentHash: receipt.objectiveContentHash,
          taskVersionHash: receipt.taskVersionHash,
          typeResponseContentHash: receipt.responseContentHash,
          typeSceneContentHash: receipt.sceneContentHash,
          inputEvidence: receipt.inputEvidence,
          submitResponseContentHash: submitResult?.evidence?.responseContentHash ?? null,
          submitSceneContentHash: submitResult?.evidence?.sceneContentHash ?? null,
          priorTypeReceiptBound: true,
          authorizationAudit: true,
          completionAudit: submitResult?.evidence?.completionAudit === true,
          postActionVerified: action.postActionVerified,
        },
        governance: {
          explicitOperatorConfirmation: true,
          providerCalled: submitResult?.governance?.providerCalled === true,
          maximumProviderCalls: 1,
          maximumActions: 1,
          actionExecuted,
          priorTypeReceiptRequired: true,
          semanticSubmitTargetBound:
            actionId === "click_item" && actionExecuted
              && submitResult?.governance?.semanticSubmitTargetBound === true,
          automaticRepeat: false,
          keyboardInput: false,
          inputTextPersisted: false,
          taskMutated: false,
          automaticTaskCompletion: false,
          createsTask: false,
          createsApproval: false,
          mutatesHost: false,
        },
      },
    };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    return {
      kind: "ai.workspace.semantic_submit",
      ok: result?.ok === true,
      status: result?.status ?? null,
      reason: result?.reason ?? null,
      actionId: result?.action?.actionId ?? null,
      itemOrdinal: result?.action?.itemOrdinal ?? null,
      actionExecuted: result?.governance?.actionExecuted === true,
      postActionVerified: result?.evidence?.postActionVerified === true,
      taskId: result?.evidence?.taskId ?? null,
      typeInvocationId: result?.evidence?.typeInvocationId ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      typeResponseContentHash: result?.evidence?.typeResponseContentHash ?? null,
      typeSceneContentHash: result?.evidence?.typeSceneContentHash ?? null,
      inputEvidence: compactInputEvidence(result?.evidence?.inputEvidence),
      submitResponseContentHash: result?.evidence?.submitResponseContentHash ?? null,
      submitSceneContentHash: result?.evidence?.submitSceneContentHash ?? null,
      priorTypeReceiptBound: result?.evidence?.priorTypeReceiptBound === true,
      authorizationAudit: result?.evidence?.authorizationAudit === true,
      completionAudit: result?.evidence?.completionAudit === true,
      providerCalled: result?.governance?.providerCalled === true,
      maximumProviderCalls: 1,
      maximumActions: 1,
      priorTypeReceiptRequired: true,
      semanticSubmitTargetBound: result?.governance?.semanticSubmitTargetBound === true,
      automaticRepeat: false,
      keyboardInput: false,
      inputTextPersisted: false,
      taskMutated: false,
      automaticTaskCompletion: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
