import {
  AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrAssessmentInstruction,
  parseAiWorkspaceOcrAssessment,
} from "./ai-workspace-assessment-contract.mjs";
import { stableAiWorkspaceJson } from "./ai-workspace-context.mjs";
import {
  aiWorkspaceOcrContextsMatch,
  buildAiWorkspaceOcrProviderContext,
  buildAiWorkspaceProviderOcr,
  compactAiWorkspaceOcrEvidence,
  createAiWorkspaceOcrContextReader,
} from "./ai-workspace-ocr-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY =
  "nixsoma-ai-workspace-ocr-assessment-v0";

export { buildAiWorkspaceProviderOcr } from "./ai-workspace-ocr-context.mjs";

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function providerContext({ observedAt, workViewState, observation, providerOcr,
  taskObjective }) {
  return buildAiWorkspaceOcrProviderContext({
    registry: "nixsoma-ai-workspace-ocr-assessment-context-v0",
    context: {
      observedAt,
      workViewState,
      observation,
      providerOcr,
    },
    taskObjective,
    requestedBehavior: {
      assessmentOnly: true,
      allowedOutcomes: ["complete", "incomplete", "blocked", "unknown"],
      maximumActions: 0,
      taskMutation: false,
      automaticContinuation: false,
    },
  });
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
  verificationContext = null,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerWasCalled(reason, providerDecision);
  const providerEvidence = providerDecision?.evidence ?? {};
  return {
    ok: true,
    registry: AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY,
    status: "local_fallback",
    assessment: { outcome: "unknown", confidence: null },
    fallback: { reason: `ai_workspace_ocr_assessment_${reason}` },
    evidence: {
      contextContentHash: providerEvidence.contextContentHash
        ?? (providerCalled ? state.lastContextHash ?? null : null),
      requestContentHash: providerEvidence.requestContentHash
        ?? (providerCalled ? state.lastRequestHash ?? null : null),
      responseContentHash: providerEvidence.responseContentHash
        ?? (providerCalled ? state.lastResponseHash ?? null : null),
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      verificationFrameContentHash: verificationContext?.observation?.frame?.sha256 ?? null,
      verificationOcrSceneContentHash:
        verificationContext?.observation?.sceneContentSha256 ?? null,
      ...projectAiWorkspaceTaskEvidence(decisionContext?.taskObjectiveBinding),
      completionAudit: false,
      budget: {
        limitsEnforced: providerEvidence.budget?.limitsEnforced
          ?? config.enforceLimits
          ?? true,
        day: providerEvidence.budget?.day ?? state.day ?? null,
        callsUsed: providerEvidence.budget?.callsUsed ?? state.callsUsed ?? 0,
        callsLimit: providerEvidence.budget?.callsLimit
          ?? (config.enforceLimits === false ? null : config.maxCallsPerDay ?? null),
        tokensUsed: providerEvidence.budget?.tokensUsed ?? state.tokensUsed ?? 0,
        tokensLimit: providerEvidence.budget?.tokensLimit
          ?? (config.enforceLimits === false ? null : config.maxTokensPerDay ?? null),
      },
    },
    governance: {
      explicitOperatorTrigger: true,
      standingAuthorization: true,
      providerCalled,
      networkEgress: providerCalled,
      maximumProviderCalls: 1,
      maximumActions: 0,
      actionExecuted: false,
      taskMutated: false,
      automaticContinuation: false,
      localOcrBound: decisionContext !== null,
      currentActiveSurfaceBound: decisionContext !== null,
      taskObjectiveBound: decisionContext?.taskObjectiveBinding?.ok === true,
      taskObjectiveProviderEgress: providerCalled
        && decisionContext?.taskObjectiveBinding?.ok === true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: providerCalled && decisionContext !== null,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      browserApiUsed: false,
      renderedTextMayContainVisibleUrlsOrValues: true,
      providerRetentionControlledExternally: true,
      createsTask: false,
      createsApproval: false,
      processLaunch: false,
      parentDisplayConnected: false,
      mutatesHost: false,
    },
  };
}

export function createAiWorkspaceOcrAssessment({
  standingAdvisory,
  fetchJson,
  sessionManagerUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const observeContext = createAiWorkspaceOcrContextReader({ fetchJson, sessionManagerUrl });

  async function publishRequiredAudit(payload) {
    const accepted = await publishAuditEvent("ai_workspace.ocr_assessment_completed", payload);
    if (accepted?.ok !== true) {
      throw new Error("required AI workspace OCR assessment audit was not accepted");
    }
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;
    try {
      await publishRequiredAudit({
        registry: AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY,
        at: now(),
        contextContentHash: result.evidence.contextContentHash,
        responseContentHash: result.evidence.responseContentHash,
        frameContentHash: result.evidence.frameContentHash,
        ocrSceneContentHash: result.evidence.ocrSceneContentHash,
        ocrBindingHash: result.evidence.ocrBindingHash,
        ocrItemCount: result.evidence.ocrItemCount,
        ocrCharacterCount: result.evidence.ocrCharacterCount,
        taskId: result.evidence.taskId,
        taskStatus: result.evidence.taskStatus,
        objectiveContentHash: result.evidence.objectiveContentHash,
        taskVersionHash: result.evidence.taskVersionHash,
        status: "local_fallback",
        fallbackReason: result.fallback.reason,
        outcome: "unknown",
        confidence: null,
        maximumActions: 0,
        taskMutated: false,
        automaticContinuation: false,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
      });
      result.evidence.completionAudit = true;
    } catch {
      result.evidence.completionAudit = false;
    }
    return result;
  }

  async function invoke({ taskId: requestedTaskId } = {}) {
    const taskId = normaliseAiWorkspaceTaskId(requestedTaskId);
    if (!taskId || typeof getTaskById !== "function") {
      return fallback("task_objective_unavailable", standingAdvisory);
    }
    if (!standingAdvisory || typeof standingAdvisory.requestDecision !== "function") {
      return fallback("runtime_unavailable", standingAdvisory);
    }

    let decisionContext;
    const egressAuditPayload = {
      taskId,
      taskStatus: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      registry: AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY,
      maximumActions: 0,
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
    };
    const providerDecision = await standingAdvisory.requestDecision({
      buildContext: async (observedAt) => {
        decisionContext = await observeContext(observedAt);
        const taskObjectiveBinding = buildAiWorkspaceTaskObjectiveBinding({
          task: getTaskById(taskId),
          taskId,
          workViewState: decisionContext.workViewState,
          maximumActions: 0,
        });
        if (!taskObjectiveBinding.ok) throw new Error(taskObjectiveBinding.reason);
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider = providerContext({
          observedAt,
          workViewState: decisionContext.workViewState,
          observation: decisionContext.observation,
          providerOcr: decisionContext.providerOcr,
          taskObjective: taskObjectiveBinding.providerProjection,
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
      instruction: buildAiWorkspaceOcrAssessmentInstruction(),
      buildPrompt: (context) =>
        `Assess this server-generated local OCR workspace context once: ${stableAiWorkspaceJson(context)}`,
      responseContract: AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceOcrAssessment,
      readActionId: (parsed) => parsed.decision.outcome,
      auditEventName: "cloud_provider.ai_workspace_ocr_assessment_egress_authorized",
      auditPayload: egressAuditPayload,
      successResult: "ai_workspace_ocr_assessment_returned",
    });
    if (!providerDecision.ok) {
      return finaliseFallback(providerDecision.reason, {
        providerDecision,
        decisionContext,
      });
    }

    let verificationContext;
    try {
      verificationContext = await observeContext(now());
    } catch {
      return finaliseFallback("verification_context_unavailable", {
        providerDecision,
        decisionContext,
      });
    }
    const currentTaskBinding = buildAiWorkspaceTaskObjectiveBinding({
      task: getTaskById(taskId),
      taskId,
      workViewState: verificationContext.workViewState,
      maximumActions: 0,
    });
    if (!aiWorkspaceTaskObjectiveBindingMatches(
      decisionContext.taskObjectiveBinding,
      currentTaskBinding,
    )) {
      return finaliseFallback("task_objective_changed", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }
    if (!aiWorkspaceOcrContextsMatch(decisionContext, verificationContext)) {
      return finaliseFallback("verification_context_changed", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }

    const decision = providerDecision.parsed.decision;
    await publishRequiredAudit({
      registry: AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY,
      at: now(),
      contextContentHash: providerDecision.evidence.contextContentHash,
      responseContentHash: providerDecision.evidence.responseContentHash,
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      verificationFrameContentHash: verificationContext.observation.frame.sha256,
      verificationFrameSequence: verificationContext.observation.frame.sequence,
      verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
      ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
      status: "assessed",
      outcome: decision.outcome,
      confidence: decision.confidence,
      maximumActions: 0,
      taskMutated: false,
      automaticContinuation: false,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
    });
    return {
      ok: true,
      registry: AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY,
      status: "assessed",
      assessment: {
        outcome: decision.outcome,
        confidence: decision.confidence,
      },
      evidence: {
        ...providerDecision.evidence,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        verificationFrameContentHash: verificationContext.observation.frame.sha256,
        verificationFrameSequence: verificationContext.observation.frame.sequence,
        verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        completionAudit: true,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        providerCalled: true,
        networkEgress: true,
        maximumProviderCalls: 1,
        maximumActions: 0,
        actionExecuted: false,
        taskMutated: false,
        automaticContinuation: false,
        localOcrBound: true,
        localOcrRevalidated: true,
        currentActiveSurfaceBound: true,
        taskObjectiveBound: true,
        taskObjectiveProviderEgress: true,
        rawTaskGoalProviderEgress: false,
        ocrTextProviderEgress: true,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
        browserApiUsed: false,
        renderedTextMayContainVisibleUrlsOrValues: true,
        providerRetentionControlledExternally: true,
        createsTask: false,
        createsApproval: false,
        processLaunch: false,
        parentDisplayConnected: false,
        mutatesHost: false,
      },
    };
  }

  return {
    invoke,
    localFallback: (reason) => fallback(reason, standingAdvisory),
  };
}
