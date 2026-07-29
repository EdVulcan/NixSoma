import {
  AI_WORKSPACE_OCR_CLICK_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrClickInstruction,
  parseAiWorkspaceOcrClickDecision,
} from "./ai-workspace-ocr-click-contract.mjs";
import { stableAiWorkspaceJson } from "./ai-workspace-context.mjs";
import {
  aiWorkspaceOcrContextsMatch,
  aiWorkspaceOcrSurfaceMatches,
  buildAiWorkspaceOcrProviderContext,
  compactAiWorkspaceOcrEvidence,
  createAiWorkspaceOcrContextReader,
} from "./ai-workspace-ocr-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_OCR_CLICK_REGISTRY =
  "nixsoma-ai-workspace-ocr-click-v0";

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function publicDecision(decision) {
  return {
    actionId: decision?.actionId === "click_item" ? "click_item" : "no_op",
    itemOrdinal: Number.isInteger(decision?.itemOrdinal) ? decision.itemOrdinal : null,
    confidence: typeof decision?.confidence === "number" ? decision.confidence : null,
  };
}

function selectedItemEvidence(item) {
  return item ? {
    itemOrdinal: item.ordinal,
    itemBounds: item.bounds,
    targetX: Math.floor(item.bounds.x + item.bounds.width / 2),
    targetY: Math.floor(item.bounds.y + item.bounds.height / 2),
  } : {
    itemOrdinal: null,
    itemBounds: null,
    targetX: null,
    targetY: null,
  };
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
  verificationContext = null,
  postActionContext = null,
  action = null,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerWasCalled(reason, providerDecision);
  const providerEvidence = providerDecision?.evidence ?? {};
  const actionExecuted = action?.executed === true;
  return {
    ok: true,
    registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
    status: "local_fallback",
    decision: { actionId: "no_op", itemOrdinal: null, confidence: null },
    action: {
      actionId: actionExecuted ? "click_item" : "no_op",
      itemOrdinal: action?.itemOrdinal ?? null,
      executed: actionExecuted,
    },
    fallback: { reason: `ai_workspace_ocr_click_${reason}` },
    evidence: {
      contextContentHash: providerEvidence.contextContentHash
        ?? (providerCalled ? state.lastContextHash ?? null : null),
      requestContentHash: providerEvidence.requestContentHash
        ?? (providerCalled ? state.lastRequestHash ?? null : null),
      responseContentHash: providerEvidence.responseContentHash
        ?? (providerCalled ? state.lastResponseHash ?? null : null),
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      verificationFrameContentHash: verificationContext?.observation?.frame?.sha256 ?? null,
      verificationFrameSequence: verificationContext?.observation?.frame?.sequence ?? null,
      verificationOcrSceneContentHash:
        verificationContext?.observation?.sceneContentSha256 ?? null,
      postActionFrameContentHash: postActionContext?.observation?.frame?.sha256 ?? null,
      postActionFrameSequence: postActionContext?.observation?.frame?.sequence ?? null,
      postActionOcrSceneContentHash:
        postActionContext?.observation?.sceneContentSha256 ?? null,
      ...projectAiWorkspaceTaskEvidence(decisionContext?.taskObjectiveBinding),
      actionExecuted,
      receiptMatched: action?.receiptMatched === true,
      frameChanged: action?.frameChanged === true,
      postActionVerified: false,
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
      maximumActions: 1,
      actionExecuted,
      taskMutated: false,
      automaticContinuation: false,
      localOcrBound: decisionContext !== null,
      localOcrRevalidated: verificationContext !== null,
      currentFrameBound: actionExecuted,
      currentActiveSurfaceBound: actionExecuted,
      ocrItemOrdinalBound: actionExecuted,
      postActionVerified: false,
      taskObjectiveBound: decisionContext?.taskObjectiveBinding?.ok === true,
      taskObjectiveProviderEgress: providerCalled
        && decisionContext?.taskObjectiveBinding?.ok === true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: providerCalled && decisionContext !== null,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      arbitraryPointerInput: false,
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

export function createAiWorkspaceOcrClick({
  standingAdvisory,
  fetchJson,
  postJson,
  sessionManagerUrl,
  screenActUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const observeContext = createAiWorkspaceOcrContextReader({ fetchJson, sessionManagerUrl });

  async function publishRequiredAudit(name, payload) {
    const accepted = await publishAuditEvent(name, payload);
    if (accepted?.ok !== true) {
      throw new Error(`required AI workspace OCR click audit was not accepted: ${name}`);
    }
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;
    try {
      await publishRequiredAudit("ai_workspace.ocr_click_completed", {
        registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
        at: now(),
        contextContentHash: result.evidence.contextContentHash,
        responseContentHash: result.evidence.responseContentHash,
        frameContentHash: result.evidence.frameContentHash,
        ocrSceneContentHash: result.evidence.ocrSceneContentHash,
        ocrBindingHash: result.evidence.ocrBindingHash,
        verificationFrameContentHash: result.evidence.verificationFrameContentHash,
        postActionFrameContentHash: result.evidence.postActionFrameContentHash,
        ...projectAiWorkspaceTaskEvidence(options.decisionContext?.taskObjectiveBinding),
        status: "local_fallback",
        fallbackReason: result.fallback.reason,
        actionId: result.action.actionId,
        itemOrdinal: result.action.itemOrdinal,
        actionExecuted: result.action.executed,
        postActionVerified: false,
        maximumActions: 1,
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
    if (!standingAdvisory || typeof standingAdvisory.requestDecision !== "function"
      || typeof postJson !== "function") {
      return fallback("runtime_unavailable", standingAdvisory);
    }

    let decisionContext;
    const egressAuditPayload = {
      taskId,
      taskStatus: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
      maximumActions: 1,
      allowedActions: ["click_item", "no_op"],
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
      providerCoordinatesAllowed: false,
    };
    const providerDecision = await standingAdvisory.requestDecision({
      buildContext: async (observedAt) => {
        decisionContext = await observeContext(observedAt);
        const taskObjectiveBinding = buildAiWorkspaceTaskObjectiveBinding({
          task: getTaskById(taskId),
          taskId,
          workViewState: decisionContext.workViewState,
          maximumActions: 1,
        });
        if (!taskObjectiveBinding.ok) throw new Error(taskObjectiveBinding.reason);
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider = buildAiWorkspaceOcrProviderContext({
          registry: "nixsoma-ai-workspace-ocr-click-context-v0",
          context: decisionContext,
          taskObjective: taskObjectiveBinding.providerProjection,
          requestedBehavior: {
            allowedActions: ["click_item", "no_op"],
            coordinatesDerivedLocally: true,
            selectedOrdinalMustNameTarget: true,
            maximumActions: 1,
            taskMutation: false,
            automaticContinuation: false,
          },
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
      instruction: buildAiWorkspaceOcrClickInstruction(),
      buildPrompt: (context) =>
        `Choose at most one server-bounded local OCR item action: ${stableAiWorkspaceJson(context)}`,
      responseContract: AI_WORKSPACE_OCR_CLICK_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceOcrClickDecision,
      readActionId: (parsed) => parsed.decision.actionId,
      auditEventName: "cloud_provider.ai_workspace_ocr_click_egress_authorized",
      auditPayload: egressAuditPayload,
      successResult: "ai_workspace_ocr_click_returned",
    });
    if (!providerDecision.ok) {
      return finaliseFallback(providerDecision.reason, { providerDecision, decisionContext });
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
      maximumActions: 1,
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
    if (decision.actionId === "no_op") {
      await publishRequiredAudit("ai_workspace.ocr_click_completed", {
        registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        verificationFrameContentHash: verificationContext.observation.frame.sha256,
        verificationFrameSequence: verificationContext.observation.frame.sequence,
        verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        status: "no_action",
        actionId: "no_op",
        itemOrdinal: null,
        confidence: decision.confidence,
        actionExecuted: false,
        postActionVerified: false,
        maximumActions: 1,
        taskMutated: false,
        automaticContinuation: false,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
      });
      return {
        ok: true,
        registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
        status: "no_action",
        decision: publicDecision(decision),
        action: { actionId: "no_op", itemOrdinal: null, executed: false },
        evidence: {
          ...providerDecision.evidence,
          ...compactAiWorkspaceOcrEvidence(decisionContext),
          verificationFrameContentHash: verificationContext.observation.frame.sha256,
          verificationFrameSequence: verificationContext.observation.frame.sequence,
          verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
          ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
          actionExecuted: false,
          postActionVerified: false,
          completionAudit: true,
        },
        governance: {
          ...fallback("no_action", standingAdvisory, {
            providerDecision,
            decisionContext,
            verificationContext,
          }).governance,
          providerCalled: true,
          localOcrRevalidated: true,
        },
      };
    }

    const item = verificationContext.providerOcr.items.find(
      (candidate) => candidate.ordinal === decision.itemOrdinal,
    );
    if (!item) {
      return finaliseFallback("item_ordinal_unavailable", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }
    const target = selectedItemEvidence(item);
    const actionBody = {
      x: target.targetX,
      y: target.targetY,
      button: "left",
      surfaceId: verificationContext.observation.surface.surfaceId,
      inventorySequence: verificationContext.observation.inventorySequence,
      compositorFrame: {
        registry: verificationContext.observation.frame.registry,
        socketName: verificationContext.observation.frame.socketName,
        width: verificationContext.observation.frame.width,
        height: verificationContext.observation.frame.height,
        sha256: verificationContext.observation.frame.sha256,
        sequence: verificationContext.observation.frame.sequence,
        capturedAt: verificationContext.observation.frame.capturedAt,
      },
    };
    await publishRequiredAudit("ai_workspace.ocr_click_action_authorized", {
      registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
      at: now(),
      contextContentHash: providerDecision.evidence.contextContentHash,
      responseContentHash: providerDecision.evidence.responseContentHash,
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      verificationFrameContentHash: verificationContext.observation.frame.sha256,
      verificationFrameSequence: verificationContext.observation.frame.sequence,
      verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
      ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
      actionId: "click_item",
      ...target,
      surfaceId: actionBody.surfaceId,
      inventorySequence: actionBody.inventorySequence,
      maximumActions: 1,
      automaticContinuation: false,
    });
    const taskBindingAfterAudit = buildAiWorkspaceTaskObjectiveBinding({
      task: getTaskById(taskId),
      taskId,
      workViewState: verificationContext.workViewState,
      maximumActions: 1,
    });
    if (!aiWorkspaceTaskObjectiveBindingMatches(
      decisionContext.taskObjectiveBinding,
      taskBindingAfterAudit,
    )) {
      return finaliseFallback("task_objective_changed", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }

    let response;
    try {
      response = await postJson(`${screenActUrl}/act/mouse/click`, actionBody, {
        grantContext: {
          taskId,
          stepId: null,
          capabilityId: "act.screen.pointer_keyboard",
          intent: "mouse.click",
        },
      });
    } catch {
      return finaliseFallback("action_outcome_unknown", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }
    const mediation = response?.action?.mediation;
    const input = mediation?.nativeInput;
    const actionExecuted = response?.action?.kind === "mouse.click"
      && response.action.result === "executed-ai-compositor"
      && mediation?.accepted === true
      && input?.operation === "pointer_click"
      && input.x === actionBody.x
      && input.y === actionBody.y
      && input.surfaceId === actionBody.surfaceId
      && input.inventorySequence === actionBody.inventorySequence
      && input.receiptMatched === true
      && input.inventoryMatched === true
      && input.surfaceMatched === true
      && input.frameMatched === true
      && input.frameFresh === true
      && input.sequenceAdvanced === true
      && input.frameChanged === true;
    if (!actionExecuted) {
      return finaliseFallback("action_rejected", {
        providerDecision,
        decisionContext,
        verificationContext,
      });
    }

    const action = {
      actionId: "click_item",
      itemOrdinal: item.ordinal,
      bounds: item.bounds,
      x: actionBody.x,
      y: actionBody.y,
      surfaceId: actionBody.surfaceId,
      inventorySequence: actionBody.inventorySequence,
      executed: true,
      receiptMatched: true,
      frameChanged: true,
    };
    let postActionContext;
    try {
      postActionContext = await observeContext(now());
    } catch {
      return finaliseFallback("post_action_context_unavailable", {
        providerDecision,
        decisionContext,
        verificationContext,
        action,
      });
    }
    const postTaskBinding = buildAiWorkspaceTaskObjectiveBinding({
      task: getTaskById(taskId),
      taskId,
      workViewState: postActionContext.workViewState,
      maximumActions: 1,
    });
    const selectedTextStillVisible = postActionContext.providerOcr.items.some(
      (candidate) => candidate.text === item.text,
    );
    const postActionVerified = aiWorkspaceTaskObjectiveBindingMatches(
      decisionContext.taskObjectiveBinding,
      postTaskBinding,
    )
      && aiWorkspaceOcrSurfaceMatches(verificationContext, postActionContext)
      && postActionContext.observation.sceneContentSha256
        !== verificationContext.observation.sceneContentSha256
      && selectedTextStillVisible === false;
    if (!postActionVerified) {
      return finaliseFallback("post_action_verification_failed", {
        providerDecision,
        decisionContext,
        verificationContext,
        postActionContext,
        action,
      });
    }

    await publishRequiredAudit("ai_workspace.ocr_click_completed", {
      registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
      at: now(),
      contextContentHash: providerDecision.evidence.contextContentHash,
      responseContentHash: providerDecision.evidence.responseContentHash,
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      verificationFrameContentHash: verificationContext.observation.frame.sha256,
      verificationFrameSequence: verificationContext.observation.frame.sequence,
      verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
      postActionFrameContentHash: postActionContext.observation.frame.sha256,
      postActionFrameSequence: postActionContext.observation.frame.sequence,
      postActionOcrSceneContentHash: postActionContext.observation.sceneContentSha256,
      ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
      status: "executed",
      actionId: "click_item",
      ...target,
      surfaceId: actionBody.surfaceId,
      inventorySequence: actionBody.inventorySequence,
      receiptMatched: true,
      frameChanged: true,
      actionExecuted: true,
      postActionVerified: true,
      maximumActions: 1,
      taskMutated: false,
      automaticContinuation: false,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
    });
    return {
      ok: true,
      registry: AI_WORKSPACE_OCR_CLICK_REGISTRY,
      status: "executed",
      decision: publicDecision(decision),
      action,
      evidence: {
        ...providerDecision.evidence,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        verificationFrameContentHash: verificationContext.observation.frame.sha256,
        verificationFrameSequence: verificationContext.observation.frame.sequence,
        verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
        postActionFrameContentHash: postActionContext.observation.frame.sha256,
        postActionFrameSequence: postActionContext.observation.frame.sequence,
        postActionOcrSceneContentHash: postActionContext.observation.sceneContentSha256,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionExecuted: true,
        receiptMatched: true,
        frameChanged: true,
        postActionVerified: true,
        completionAudit: true,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        providerCalled: true,
        networkEgress: true,
        maximumProviderCalls: 1,
        maximumActions: 1,
        actionExecuted: true,
        taskMutated: false,
        automaticContinuation: false,
        localOcrBound: true,
        localOcrRevalidated: true,
        currentFrameBound: true,
        currentActiveSurfaceBound: true,
        ocrItemOrdinalBound: true,
        postActionVerified: true,
        taskObjectiveBound: true,
        taskObjectiveProviderEgress: true,
        rawTaskGoalProviderEgress: false,
        ocrTextProviderEgress: true,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
        arbitraryPointerInput: false,
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
