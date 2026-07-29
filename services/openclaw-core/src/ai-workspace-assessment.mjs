import {
  AI_WORKSPACE_ASSESSMENT_RESPONSE_CONTRACT,
  buildAiWorkspaceAssessmentInstruction,
  parseAiWorkspaceAssessment,
} from "./ai-workspace-assessment-contract.mjs";
import {
  buildAiWorkspaceProviderContext,
  createAiWorkspaceContextObserver,
  stableAiWorkspaceJson,
} from "./ai-workspace-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_ASSESSMENT_REGISTRY =
  "nixsoma-ai-workspace-task-assessment-v0";

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function contextMatches(decisionContext, verificationContext) {
  return verificationContext.surface.surfaceId === decisionContext.surface.surfaceId
    && verificationContext.surface.pid === decisionContext.surface.pid
    && verificationContext.inventorySequence === decisionContext.inventorySequence
    && verificationContext.scene.sceneContentSha256 === decisionContext.scene.sceneContentSha256;
}

function expectedTaskBindingMatches(expected, current) {
  if (expected === null || expected === undefined) return true;
  const evidence = current?.evidence ?? {};
  return normaliseAiWorkspaceTaskId(expected?.taskId) !== null
    && expected.taskId === evidence.taskId
    && typeof expected.objectiveContentHash === "string"
    && expected.objectiveContentHash === evidence.objectiveContentHash
    && typeof expected.taskVersionHash === "string"
    && expected.taskVersionHash === evidence.taskVersionHash;
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerWasCalled(reason, providerDecision);
  const providerEvidence = providerDecision?.evidence ?? {};
  const scene = decisionContext?.scene ?? null;
  const taskBinding = decisionContext?.taskObjectiveBinding ?? null;
  return {
    ok: true,
    registry: AI_WORKSPACE_ASSESSMENT_REGISTRY,
    status: "local_fallback",
    assessment: { outcome: "unknown", confidence: null },
    fallback: { reason: `ai_workspace_assessment_${reason}` },
    evidence: {
      contextContentHash: providerEvidence.contextContentHash
        ?? (providerCalled ? state.lastContextHash ?? null : null),
      requestContentHash: providerEvidence.requestContentHash
        ?? (providerCalled ? state.lastRequestHash ?? null : null),
      responseContentHash: providerEvidence.responseContentHash
        ?? (providerCalled ? state.lastResponseHash ?? null : null),
      sceneContentHash: scene?.sceneContentSha256 ?? null,
      sceneItemCount: scene?.itemCount ?? 0,
      ...projectAiWorkspaceTaskEvidence(taskBinding),
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
      semanticSceneBound: scene !== null,
      currentBrowserSurfaceBound: scene !== null,
      taskObjectiveBound: taskBinding?.ok === true,
      taskObjectiveProviderEgress: providerCalled && taskBinding?.ok === true,
      rawTaskGoalProviderEgress: false,
      pixelsProviderEgress: false,
      urlsProviderEgress: false,
      inputValuesProviderEgress: false,
      createsTask: false,
      createsApproval: false,
      keyboardInput: false,
      arbitraryPointerInput: false,
      processLaunch: false,
      parentDisplayConnected: false,
      mutatesHost: false,
    },
  };
}

export function createAiWorkspaceAssessment({
  standingAdvisory,
  fetchJson,
  sessionManagerUrl,
  screenSenseUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const observeContext = createAiWorkspaceContextObserver({
    fetchJson,
    sessionManagerUrl,
    screenSenseUrl,
  });

  async function publishRequiredAudit(payload) {
    const accepted = await publishAuditEvent("ai_workspace.assessment_completed", payload);
    if (accepted?.ok !== true) {
      throw new Error("required AI workspace assessment audit was not accepted");
    }
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;
    try {
      await publishRequiredAudit({
        registry: AI_WORKSPACE_ASSESSMENT_REGISTRY,
        at: now(),
        contextContentHash: result.evidence.contextContentHash,
        responseContentHash: result.evidence.responseContentHash,
        sceneContentHash: result.evidence.sceneContentHash,
        sceneItemCount: result.evidence.sceneItemCount,
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
      });
      result.evidence.completionAudit = true;
    } catch {
      result.evidence.completionAudit = false;
    }
    return result;
  }

  async function invoke({ taskId: requestedTaskId, expectedTaskBinding = null } = {}) {
    const taskId = normaliseAiWorkspaceTaskId(requestedTaskId);
    if (!taskId || typeof getTaskById !== "function") {
      return fallback("task_objective_unavailable", standingAdvisory);
    }
    if (!standingAdvisory || typeof standingAdvisory.requestDecision !== "function") {
      return fallback("runtime_unavailable", standingAdvisory);
    }

    let decisionContext;
    let expectedBindingChanged = false;
    const egressAuditPayload = {
      taskId,
      taskStatus: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      registry: AI_WORKSPACE_ASSESSMENT_REGISTRY,
      maximumActions: 0,
      callerPromptAccepted: false,
      automaticContinuation: false,
      semanticSceneRequired: true,
      pixelsEgress: false,
      urlsEgress: false,
      inputValuesEgress: false,
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
        if (!expectedTaskBindingMatches(expectedTaskBinding, taskObjectiveBinding)) {
          expectedBindingChanged = true;
          throw new Error("expected task binding changed");
        }
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider = buildAiWorkspaceProviderContext({
          registry: "nixsoma-ai-workspace-task-assessment-context-v0",
          observedAt,
          context: decisionContext,
          taskObjective: taskObjectiveBinding.providerProjection,
          requestedBehavior: {
            assessmentOnly: true,
            allowedOutcomes: ["complete", "incomplete", "blocked", "unknown"],
            maximumActions: 0,
            taskMutation: false,
            automaticContinuation: false,
          },
        });
        Object.assign(
          egressAuditPayload,
          projectAiWorkspaceTaskEvidence(taskObjectiveBinding),
        );
        return decisionContext.provider;
      },
      instruction: buildAiWorkspaceAssessmentInstruction(),
      buildPrompt: (context) =>
        `Assess this server-generated AI workspace context once: ${stableAiWorkspaceJson(context)}`,
      responseContract: AI_WORKSPACE_ASSESSMENT_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceAssessment,
      readActionId: (parsed) => parsed.decision.outcome,
      auditEventName: "cloud_provider.ai_workspace_assessment_egress_authorized",
      auditPayload: egressAuditPayload,
      successResult: "ai_workspace_assessment_returned",
    });
    if (!providerDecision.ok) {
      return finaliseFallback(expectedBindingChanged
        ? "task_objective_changed_before_egress"
        : providerDecision.reason, {
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
      });
    }
    if (!contextMatches(decisionContext, verificationContext)) {
      return finaliseFallback("verification_context_changed", {
        providerDecision,
        decisionContext,
      });
    }

    const decision = providerDecision.parsed.decision;
    await publishRequiredAudit({
      registry: AI_WORKSPACE_ASSESSMENT_REGISTRY,
      at: now(),
      contextContentHash: providerDecision.evidence.contextContentHash,
      responseContentHash: providerDecision.evidence.responseContentHash,
      sceneContentHash: decisionContext.scene.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
      status: "assessed",
      outcome: decision.outcome,
      confidence: decision.confidence,
      maximumActions: 0,
      taskMutated: false,
      automaticContinuation: false,
    });
    return {
      ok: true,
      registry: AI_WORKSPACE_ASSESSMENT_REGISTRY,
      status: "assessed",
      assessment: {
        outcome: decision.outcome,
        confidence: decision.confidence,
      },
      evidence: {
        ...providerDecision.evidence,
        sceneContentHash: decisionContext.scene.sceneContentSha256,
        sceneItemCount: decisionContext.scene.itemCount,
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
        semanticSceneBound: true,
        currentBrowserSurfaceBound: true,
        taskObjectiveBound: true,
        taskObjectiveProviderEgress: true,
        rawTaskGoalProviderEgress: false,
        pixelsProviderEgress: false,
        urlsProviderEgress: false,
        inputValuesProviderEgress: false,
        createsTask: false,
        createsApproval: false,
        keyboardInput: false,
        arbitraryPointerInput: false,
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
