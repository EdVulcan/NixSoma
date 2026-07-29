import { stableAiWorkspaceJson } from "./ai-workspace-context.mjs";
import {
  aiWorkspaceOcrContextsMatch,
  buildAiWorkspaceOcrProviderContext,
  createAiWorkspaceOcrContextReader,
} from "./ai-workspace-ocr-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export function createAiWorkspaceOcrDecisionSession({
  standingAdvisory,
  fetchJson,
  sessionManagerUrl,
  getTaskById = () => null,
  registry,
  providerContextRegistry,
  allowedActions,
  requestedBehavior,
  instruction,
  responseContract,
  parseResponse,
  readActionId,
  auditEventName,
  successResult,
  maximumActions = 1,
  egressAudit = {},
  now = () => new Date().toISOString(),
} = {}) {
  const observeContext = createAiWorkspaceOcrContextReader({ fetchJson, sessionManagerUrl });

  function failure(reason, evidence = {}) {
    return { ok: false, reason, taskId: evidence.taskId ?? null, ...evidence };
  }

  async function decide({ taskId: requestedTaskId } = {}) {
    const taskId = normaliseAiWorkspaceTaskId(requestedTaskId);
    if (!taskId || typeof getTaskById !== "function") {
      return failure("task_objective_unavailable");
    }
    if (!standingAdvisory || typeof standingAdvisory.requestDecision !== "function") {
      return failure("runtime_unavailable", { taskId });
    }

    let decisionContext;
    const egressAuditPayload = {
      taskId,
      taskStatus: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      registry,
      maximumActions,
      allowedActions: [...allowedActions],
      callerPromptAccepted: false,
      automaticContinuation: false,
      localOcrRequired: true,
      ocrTextEgress: true,
      ocrTextPersistedLocally: false,
      renderedTextMayContainVisibleUrlsOrValues: true,
      providerRetentionControlledExternally: true,
      pixelsEgress: false,
      frameHashEgress: false,
      rawTaskGoalEgress: false,
      taskObjectiveEgress: true,
      ...egressAudit,
    };
    const providerDecision = await standingAdvisory.requestDecision({
      buildContext: async (observedAt) => {
        decisionContext = await observeContext(observedAt);
        const taskObjectiveBinding = buildAiWorkspaceTaskObjectiveBinding({
          task: getTaskById(taskId),
          taskId,
          workViewState: decisionContext.workViewState,
          maximumActions,
        });
        if (!taskObjectiveBinding.ok) throw new Error(taskObjectiveBinding.reason);
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider = buildAiWorkspaceOcrProviderContext({
          registry: providerContextRegistry,
          context: decisionContext,
          taskObjective: taskObjectiveBinding.providerProjection,
          requestedBehavior,
        });
        Object.assign(
          egressAuditPayload,
          projectAiWorkspaceTaskEvidence(taskObjectiveBinding),
          {
            frameSequence: decisionContext.observation.frame.sequence,
            surfaceId: decisionContext.observation.surface.surfaceId,
            inventorySequence: decisionContext.observation.inventorySequence,
            ocrBindingHash: decisionContext.ocrBindingHash,
            ocrItemCount: decisionContext.providerOcr.itemCount,
            ocrCharacterCount: decisionContext.providerOcr.characterCount,
            ocrTruncated: decisionContext.providerOcr.truncated,
          },
        );
        return decisionContext.provider;
      },
      instruction,
      buildPrompt: (context) =>
        `Choose at most one server-bounded local OCR action: ${stableAiWorkspaceJson(context)}`,
      responseContract,
      parseResponse,
      readActionId,
      auditEventName,
      auditPayload: egressAuditPayload,
      successResult,
    });
    if (!providerDecision.ok) {
      return failure(providerDecision.reason, { taskId, providerDecision, decisionContext });
    }

    let verificationContext;
    try {
      verificationContext = await observeContext(now());
    } catch {
      return failure("verification_context_unavailable", {
        taskId,
        providerDecision,
        decisionContext,
      });
    }
    const currentTaskBinding = buildAiWorkspaceTaskObjectiveBinding({
      task: getTaskById(taskId),
      taskId,
      workViewState: verificationContext.workViewState,
      maximumActions,
    });
    if (!aiWorkspaceTaskObjectiveBindingMatches(
      decisionContext.taskObjectiveBinding,
      currentTaskBinding,
    )) {
      return failure("task_objective_changed", {
        taskId,
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }
    if (!aiWorkspaceOcrContextsMatch(decisionContext, verificationContext)) {
      return failure("verification_context_changed", {
        taskId,
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }
    return {
      ok: true,
      reason: null,
      taskId,
      providerDecision,
      decisionContext,
      verificationContext,
    };
  }

  return { decide, observeContext };
}
