import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildAiWorkspaceTaskObjectiveBinding } from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_CAPABILITY_ID =
  "act.ai.workspace.accept_assessment";
export const AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_REGISTRY =
  "nixsoma-ai-workspace-assessment-acceptance-v0";

const ASSESSMENT_CAPABILITY_ID = "sense.ai.workspace.assessment";
const ALLOWED_BODY_KEYS = new Set(["capabilityId", "taskId", "params"]);
const ALLOWED_PARAM_KEYS = new Set([
  "confirm",
  "assessmentInvocationId",
  "objectiveContentHash",
  "taskVersionHash",
  "responseContentHash",
  "sceneContentHash",
]);
const MAX_ID_CHARS = 200;

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_CAPABILITY_ID;
}

function boundedId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= MAX_ID_CHARS ? id : null;
}

function boundedHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function acceptanceRequestIsBounded(request, rawBody) {
  const params = request?.params ?? {};
  return params.confirm === true
    && boundedId(request?.taskId) !== null
    && boundedId(params.assessmentInvocationId) !== null
    && boundedHash(params.objectiveContentHash) !== null
    && boundedHash(params.taskVersionHash) !== null
    && boundedHash(params.responseContentHash) !== null
    && boundedHash(params.sceneContentHash) !== null
    && request.stepId === null
    && request.operation === null
    && request.intent === null
    && Object.keys(params).every((key) => ALLOWED_PARAM_KEYS.has(key))
    && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

function rejected(reason, taskId = null, { requiredAudit = false } = {}) {
  return {
    ok: false,
    registry: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_REGISTRY,
    status: "rejected",
    reason,
    task: null,
    evidence: {
      taskId,
      requiredAudit,
      taskCompleted: false,
    },
    governance: {
      explicitOperatorConfirmation: true,
      providerCalled: false,
      providerTriggeredCompletion: false,
      maximumActions: 0,
      actionExecuted: false,
      automaticContinuation: false,
      mutatesTask: false,
      mutatesHost: false,
    },
  };
}

function assessmentReceiptMatches(entry, request) {
  const params = request.params;
  const summary = entry?.summary ?? {};
  return entry?.id === params.assessmentInvocationId
    && entry?.capability?.id === ASSESSMENT_CAPABILITY_ID
    && entry?.invoked === true
    && entry?.blocked === false
    && entry?.request?.taskId === request.taskId
    && entry?.authorization?.policyId === "ai-workspace-explicit-task-assessment"
    && entry?.authorization?.approved === true
    && entry?.policy?.decision === "audit_only"
    && entry?.policy?.domain === "cross_boundary"
    && entry?.policy?.approved === true
    && summary.kind === "ai.workspace.assessment"
    && summary.status === "assessed"
    && summary.outcome === "complete"
    && typeof summary.confidence === "number"
    && summary.confidence >= 0
    && summary.confidence <= 1
    && summary.taskId === request.taskId
    && summary.objectiveContentHash === params.objectiveContentHash
    && summary.taskVersionHash === params.taskVersionHash
    && summary.responseContentHash === params.responseContentHash
    && summary.sceneContentHash === params.sceneContentHash
    && summary.completionAudit === true
    && summary.providerCalled === true
    && summary.semanticSceneBound === true
    && summary.currentBrowserSurfaceBound === true
    && summary.taskObjectiveBound === true
    && summary.taskObjectiveProviderEgress === true
    && summary.rawTaskGoalProviderEgress === false
    && summary.pixelsProviderEgress === false
    && summary.urlsProviderEgress === false
    && summary.inputValuesProviderEgress === false
    && summary.maximumActions === 0
    && summary.actionExecuted === false
    && summary.taskMutated === false
    && summary.automaticContinuation === false;
}

function taskBindingMatchesReceipt(binding, request) {
  return binding?.ok === true
    && binding.evidence.taskId === request.taskId
    && binding.evidence.objectiveContentHash === request.params.objectiveContentHash
    && binding.evidence.taskVersionHash === request.params.taskVersionHash;
}

export function createAiWorkspaceAssessmentAcceptanceCapabilityHandlers({
  capabilityInvocationLog = [],
  taskManager = {},
  readWorkViewState,
  publishAuditEvent = async () => ({ ok: true }),
  publishEvent = async () => {},
  now = () => new Date().toISOString(),
} = {}) {
  const {
    getTaskById = () => null,
    completeTask,
    serialiseTask = (task) => task,
  } = taskManager;

  function validateRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return null;
    if (!acceptanceRequestIsBounded(request, rawBody)) {
      return "AI workspace assessment acceptance requires only taskId, params.confirm=true, one assessment invocation ID, and its four receipt hashes.";
    }
    if (typeof completeTask !== "function" || typeof readWorkViewState !== "function") {
      return "AI workspace assessment acceptance runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (!isCapability(capability)) return { handled: false, result: null };
    const assessmentInvocation = capabilityInvocationLog.find(
      (entry) => entry?.id === request.params.assessmentInvocationId,
    );
    if (!assessmentReceiptMatches(assessmentInvocation, request)) {
      return {
        handled: true,
        result: rejected("assessment_receipt_invalid", request.taskId),
      };
    }

    const task = getTaskById(request.taskId);
    let workViewState;
    try {
      workViewState = await readWorkViewState();
    } catch {
      return {
        handled: true,
        result: rejected("work_view_state_unavailable", request.taskId),
      };
    }
    const currentBinding = buildAiWorkspaceTaskObjectiveBinding({
      task,
      taskId: request.taskId,
      workViewState,
      maximumActions: 0,
    });
    if (!taskBindingMatchesReceipt(currentBinding, request)) {
      return {
        handled: true,
        result: rejected("task_version_changed", request.taskId),
      };
    }

    const auditPayload = {
      registry: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_REGISTRY,
      at: now(),
      taskId: request.taskId,
      assessmentInvocationId: request.params.assessmentInvocationId,
      outcome: "complete",
      confidence: assessmentInvocation.summary.confidence,
      objectiveContentHash: request.params.objectiveContentHash,
      taskVersionHash: request.params.taskVersionHash,
      responseContentHash: request.params.responseContentHash,
      sceneContentHash: request.params.sceneContentHash,
      explicitOperatorConfirmation: true,
      providerTriggeredCompletion: false,
      maximumActions: 0,
      automaticContinuation: false,
    };
    const audit = await publishAuditEvent(
      "ai_workspace.assessment_acceptance_authorized",
      auditPayload,
    );
    if (audit?.ok !== true) {
      throw new Error("required AI workspace assessment acceptance audit was not accepted");
    }

    const finalTask = getTaskById(request.taskId);
    const finalBinding = buildAiWorkspaceTaskObjectiveBinding({
      task: finalTask,
      taskId: request.taskId,
      workViewState,
      maximumActions: 0,
    });
    if (!taskBindingMatchesReceipt(finalBinding, request)) {
      return {
        handled: true,
        result: rejected("task_version_changed_after_audit", request.taskId, {
          requiredAudit: true,
        }),
      };
    }

    const assessmentAcceptance = {
      registry: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_REGISTRY,
      assessmentInvocationId: request.params.assessmentInvocationId,
      outcome: "complete",
      confidence: assessmentInvocation.summary.confidence,
      objectiveContentHash: request.params.objectiveContentHash,
      taskVersionHash: request.params.taskVersionHash,
      responseContentHash: request.params.responseContentHash,
      sceneContentHash: request.params.sceneContentHash,
      explicitOperatorConfirmation: true,
      providerTriggeredCompletion: false,
      acceptedAt: auditPayload.at,
    };
    const completedTask = completeTask(finalTask, {
      summary: "Operator accepted a verified AI workspace completion assessment.",
      assessmentAcceptance,
    });
    const publicTask = serialiseTask(completedTask);
    await publishEvent(createEventName("task.completed"), {
      task: publicTask,
      assessmentAcceptance,
    });
    return {
      handled: true,
      result: {
        ok: true,
        registry: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_REGISTRY,
        status: "accepted",
        task: publicTask,
        evidence: {
          ...assessmentAcceptance,
          taskId: request.taskId,
          requiredAudit: true,
          taskCompleted: completedTask.status === "completed",
        },
        governance: {
          explicitOperatorConfirmation: true,
          providerCalled: false,
          providerTriggeredCompletion: false,
          maximumActions: 0,
          actionExecuted: false,
          automaticContinuation: false,
          mutatesTask: true,
          mutatesHost: false,
        },
      },
    };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    return {
      kind: "ai.workspace.assessment_acceptance",
      ok: result?.ok === true,
      status: result?.status ?? null,
      reason: result?.reason ?? null,
      taskId: result?.evidence?.taskId ?? null,
      taskStatus: result?.task?.status ?? null,
      assessmentInvocationId: result?.evidence?.assessmentInvocationId ?? null,
      outcome: result?.evidence?.outcome ?? null,
      confidence: result?.evidence?.confidence ?? null,
      objectiveContentHash: result?.evidence?.objectiveContentHash ?? null,
      taskVersionHash: result?.evidence?.taskVersionHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      sceneContentHash: result?.evidence?.sceneContentHash ?? null,
      requiredAudit: result?.evidence?.requiredAudit === true,
      taskCompleted: result?.evidence?.taskCompleted === true,
      explicitOperatorConfirmation: result?.governance?.explicitOperatorConfirmation === true,
      providerCalled: false,
      providerTriggeredCompletion: false,
      maximumActions: 0,
      actionExecuted: false,
      automaticContinuation: false,
      mutatesHost: false,
    };
  }

  return { validateRequest, callBackend, summariseResult };
}
