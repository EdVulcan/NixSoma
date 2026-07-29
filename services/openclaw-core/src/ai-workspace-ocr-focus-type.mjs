import {
  AI_WORKSPACE_OCR_FOCUS_TYPE_OBJECTIVE_PATTERN,
  AI_WORKSPACE_OCR_FOCUS_TYPE_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrFocusTypeInstruction,
  parseAiWorkspaceOcrFocusTypeDecision,
} from "./ai-workspace-ocr-focus-type-contract.mjs";
import { createAiWorkspaceOcrDecisionSession } from "./ai-workspace-ocr-decision-session.mjs";
import {
  executeAiWorkspaceOcrNativeClick,
  executeAiWorkspaceOcrNativeType,
  projectAiWorkspaceOcrClickTarget,
} from "./ai-workspace-ocr-native-actions.mjs";
import {
  aiWorkspaceOcrSurfaceMatches,
  compactAiWorkspaceOcrEvidence,
} from "./ai-workspace-ocr-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY =
  "nixsoma-ai-workspace-ocr-focus-type-v0";

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function objectiveSpec(binding) {
  const statement = binding?.providerProjection?.statement;
  const match = typeof statement === "string"
    ? AI_WORKSPACE_OCR_FOCUS_TYPE_OBJECTIVE_PATTERN.exec(statement)
    : null;
  return match ? { targetText: match[1], inputText: match[2] } : null;
}

function comparableText(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
    : "";
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 0
    || !Number.isInteger(value.byteLength)
    || value.byteLength < 0
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

function emptyInputEvidence() {
  return {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 0,
    byteLength: 0,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function publicDecision(decision) {
  const active = decision?.actionId === "focus_and_type";
  return {
    actionId: active ? "focus_and_type" : "no_op",
    itemOrdinal: active && Number.isInteger(decision.itemOrdinal)
      ? decision.itemOrdinal
      : null,
    inputEvidence: active
      ? compactInputEvidence(decision.inputEvidence) ?? emptyInputEvidence()
      : emptyInputEvidence(),
    confidence: typeof decision?.confidence === "number" ? decision.confidence : null,
  };
}

function contextEvidence(prefix, context) {
  return {
    [`${prefix}FrameContentHash`]: context?.observation?.frame?.sha256 ?? null,
    [`${prefix}FrameSequence`]: context?.observation?.frame?.sequence ?? null,
    [`${prefix}OcrSceneContentHash`]: context?.observation?.sceneContentSha256 ?? null,
    [`${prefix}OcrItemCount`]: context?.providerOcr?.itemCount ?? 0,
    [`${prefix}OcrCharacterCount`]: context?.providerOcr?.characterCount ?? 0,
    [`${prefix}ContextObserved`]: context !== null && context !== undefined,
    [`${prefix}SurfaceId`]: context?.observation?.surface?.surfaceId ?? null,
  };
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
  verificationContext = null,
  focusContext = null,
  postActionContext = null,
  actions = [],
  focusVerified = false,
  outcomeUnknown = false,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerWasCalled(reason, providerDecision);
  const providerEvidence = providerDecision?.evidence ?? {};
  const actionCount = actions.filter((action) => action?.executed === true).length;
  const focusAction = actions.find((action) => action?.actionId === "focus_item") ?? null;
  const typeAction = actions.find((action) => action?.actionId === "type_text") ?? null;
  const inputEvidence = compactInputEvidence(
    typeAction?.inputEvidence ?? providerDecision?.parsed?.decision?.inputEvidence,
  ) ?? emptyInputEvidence();
  return {
    ok: true,
    registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
    status: "local_fallback",
    decision: {
      actionId: "no_op",
      itemOrdinal: null,
      inputEvidence: emptyInputEvidence(),
      confidence: null,
    },
    actions,
    fallback: { reason: `ai_workspace_ocr_focus_type_${reason}` },
    evidence: {
      contextContentHash: providerEvidence.contextContentHash
        ?? (providerCalled ? state.lastContextHash ?? null : null),
      requestContentHash: providerEvidence.requestContentHash
        ?? (providerCalled ? state.lastRequestHash ?? null : null),
      responseContentHash: providerEvidence.responseContentHash
        ?? (providerCalled ? state.lastResponseHash ?? null : null),
      ...compactAiWorkspaceOcrEvidence(decisionContext),
      ...contextEvidence("verification", verificationContext),
      ...contextEvidence("focus", focusContext),
      ...contextEvidence("postAction", postActionContext),
      ...projectAiWorkspaceTaskEvidence(decisionContext?.taskObjectiveBinding),
      itemOrdinal: focusAction?.itemOrdinal ?? null,
      itemBounds: focusAction?.bounds ?? null,
      targetX: focusAction?.x ?? null,
      targetY: focusAction?.y ?? null,
      inputEvidence,
      actionCount,
      focusActionExecuted: focusAction?.executed === true,
      focusActionVerified: focusVerified === true && focusAction?.executed === true,
      typeActionExecuted: typeAction?.executed === true,
      postActionVerified: false,
      outcomeUnknown,
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
      maximumActions: 2,
      actionCount,
      fixedActionSequence: true,
      actionExecuted: actionCount > 0,
      taskMutated: false,
      automaticContinuation: false,
      automaticRepeat: false,
      localOcrBound: decisionContext !== null,
      localOcrRevalidated: verificationContext !== null,
      focusRevalidated: focusVerified === true,
      currentFrameBound: actionCount > 0,
      currentActiveSurfaceBound: actionCount > 0,
      ocrItemOrdinalBound: focusAction?.executed === true,
      taskObjectiveInputBound: typeAction?.executed === true,
      providerGeneratedInput: typeAction?.executed === true,
      pointerInput: focusAction?.executed === true,
      keyboardInput: typeAction?.executed === true,
      hotkeyInput: false,
      enterKeyInput: false,
      inputTextExposed: false,
      inputTextPersisted: false,
      postActionVerified: false,
      taskObjectiveBound: decisionContext?.taskObjectiveBinding?.ok === true,
      taskObjectiveProviderEgress: providerCalled
        && decisionContext?.taskObjectiveBinding?.ok === true,
      rawTaskGoalProviderEgress: false,
      ocrTextProviderEgress: providerCalled && decisionContext !== null,
      ocrTextPersistedLocally: false,
      pixelsProviderEgress: false,
      arbitraryPointerInput: false,
      arbitraryKeyboardInput: false,
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

export function createAiWorkspaceOcrFocusType({
  standingAdvisory,
  fetchJson,
  postJson,
  sessionManagerUrl,
  screenActUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const decisionSession = createAiWorkspaceOcrDecisionSession({
    standingAdvisory,
    fetchJson,
    sessionManagerUrl,
    getTaskById,
    registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
    providerContextRegistry: "nixsoma-ai-workspace-ocr-focus-type-context-v0",
    allowedActions: ["focus_and_type", "no_op"],
    requestedBehavior: {
      allowedActions: ["focus_and_type", "no_op"],
      targetSubstringMustMatchSelectedOcrItem: true,
      coordinatesDerivedLocally: true,
      inputMustExactlyMatchObjectiveValue: true,
      inputCharacters: "ASCII letters, digits, spaces, period, comma, underscore, hyphen",
      inputMaximumCharacters: 32,
      maximumActions: 2,
      fixedActionSequence: ["focus_item", "type_text"],
      taskMutation: false,
      automaticContinuation: false,
      enterKeyInput: false,
      hotkeyInput: false,
      automaticRepeat: false,
    },
    instruction: buildAiWorkspaceOcrFocusTypeInstruction(),
    responseContract: AI_WORKSPACE_OCR_FOCUS_TYPE_RESPONSE_CONTRACT,
    parseResponse: parseAiWorkspaceOcrFocusTypeDecision,
    readActionId: (parsed) => parsed.decision.actionId,
    auditEventName: "cloud_provider.ai_workspace_ocr_focus_type_egress_authorized",
    successResult: "ai_workspace_ocr_focus_type_returned",
    maximumActions: 2,
    egressAudit: {
      providerCoordinatesAllowed: false,
      providerGeneratedInputAllowed: true,
      providerInputMustMatchTaskObjective: true,
      inputTextPersistedLocally: false,
      fixedActionSequence: true,
      enterKeyInput: false,
      hotkeyInput: false,
      automaticRepeat: false,
    },
    now,
  });
  const { observeContext } = decisionSession;

  async function publishRequiredAudit(name, payload) {
    const accepted = await publishAuditEvent(name, payload);
    if (accepted?.ok !== true) {
      throw new Error(`required AI workspace OCR focus type audit was not accepted: ${name}`);
    }
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;
    try {
      await publishRequiredAudit("ai_workspace.ocr_focus_type_completed", {
        registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
        at: now(),
        contextContentHash: result.evidence.contextContentHash,
        responseContentHash: result.evidence.responseContentHash,
        frameContentHash: result.evidence.frameContentHash,
        ocrSceneContentHash: result.evidence.ocrSceneContentHash,
        ocrBindingHash: result.evidence.ocrBindingHash,
        verificationFrameContentHash: result.evidence.verificationFrameContentHash,
        focusFrameContentHash: result.evidence.focusFrameContentHash,
        postActionFrameContentHash: result.evidence.postActionFrameContentHash,
        ...projectAiWorkspaceTaskEvidence(options.decisionContext?.taskObjectiveBinding),
        status: "local_fallback",
        fallbackReason: result.fallback.reason,
        itemOrdinal: result.evidence.itemOrdinal,
        inputEvidence: result.evidence.inputEvidence,
        actionCount: result.evidence.actionCount,
        focusActionExecuted: result.evidence.focusActionExecuted,
        focusActionVerified: result.evidence.focusActionVerified,
        typeActionExecuted: result.evidence.typeActionExecuted,
        postActionVerified: false,
        outcomeUnknown: result.evidence.outcomeUnknown,
        maximumActions: 2,
        taskMutated: false,
        automaticContinuation: false,
        inputTextExposed: false,
        inputTextPersisted: false,
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
    if (typeof postJson !== "function") return fallback("runtime_unavailable", standingAdvisory);
    const session = await decisionSession.decide({ taskId: requestedTaskId });
    const { taskId, providerDecision, decisionContext, verificationContext } = session;
    if (!session.ok) {
      const result = await finaliseFallback(session.reason, session);
      if (providerDecision?.parsed?.decision) providerDecision.parsed.decision.inputText = null;
      return result;
    }

    const decision = providerDecision.parsed.decision;
    let inputText = decision.inputText;
    let focusVerified = false;
    const actions = [];
    try {
      if (decision.actionId === "no_op") {
        await publishRequiredAudit("ai_workspace.ocr_focus_type_completed", {
          registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
          at: now(),
          contextContentHash: providerDecision.evidence.contextContentHash,
          responseContentHash: providerDecision.evidence.responseContentHash,
          ...compactAiWorkspaceOcrEvidence(decisionContext),
          ...contextEvidence("verification", verificationContext),
          ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
          status: "no_action",
          actionId: "no_op",
          itemOrdinal: null,
          inputEvidence: emptyInputEvidence(),
          confidence: decision.confidence,
          actionCount: 0,
          postActionVerified: false,
          maximumActions: 2,
          taskMutated: false,
          automaticContinuation: false,
          inputTextExposed: false,
          inputTextPersisted: false,
          ocrTextPersistedLocally: false,
          pixelsProviderEgress: false,
        });
        const result = fallback("no_action", standingAdvisory, {
          providerDecision,
          decisionContext,
          verificationContext,
        });
        return {
          ...result,
          status: "no_action",
          fallback: undefined,
          decision: publicDecision(decision),
          evidence: { ...result.evidence, completionAudit: true },
          governance: {
            ...result.governance,
            providerCalled: true,
            localOcrRevalidated: true,
          },
        };
      }

      const spec = objectiveSpec(decisionContext.taskObjectiveBinding);
      const inputEvidence = compactInputEvidence(decision.inputEvidence);
      const item = verificationContext.providerOcr.items.find(
        (candidate) => candidate.ordinal === decision.itemOrdinal,
      );
      const target = projectAiWorkspaceOcrClickTarget(item);
      const selectedText = comparableText(item?.text);
      const expectedTarget = comparableText(spec?.targetText);
      const verificationText = comparableText(
        verificationContext.providerOcr.items.map((candidate) => candidate.text).join(" "),
      );
      if (!spec
        || inputText !== spec.inputText
        || !inputEvidence
        || !item
        || !target
        || !expectedTarget
        || !selectedText.includes(expectedTarget)) {
        return await finaliseFallback("decision_not_objective_bound", {
          providerDecision,
          decisionContext,
          verificationContext,
          actions,
        });
      }
      if (verificationText.includes(comparableText(inputText))) {
        return await finaliseFallback("input_already_visible", {
          providerDecision,
          decisionContext,
          verificationContext,
          actions,
        });
      }

      await publishRequiredAudit("ai_workspace.ocr_focus_type_focus_authorized", {
        registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        ...contextEvidence("verification", verificationContext),
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionId: "focus_item",
        ...target,
        surfaceId: verificationContext.observation.surface.surfaceId,
        inventorySequence: verificationContext.observation.inventorySequence,
        maximumActions: 2,
        fixedActionIndex: 1,
        automaticContinuation: false,
      });
      const taskAfterFocusAudit = buildAiWorkspaceTaskObjectiveBinding({
        task: getTaskById(taskId),
        taskId,
        workViewState: verificationContext.workViewState,
        maximumActions: 2,
      });
      if (!aiWorkspaceTaskObjectiveBindingMatches(
        decisionContext.taskObjectiveBinding,
        taskAfterFocusAudit,
      )) {
        return await finaliseFallback("task_objective_changed", {
          providerDecision,
          decisionContext,
          verificationContext,
          actions,
        });
      }

      const focusExecution = await executeAiWorkspaceOcrNativeClick({
        postJson,
        screenActUrl,
        taskId,
        context: verificationContext,
        item,
      });
      if (!focusExecution.ok) {
        return await finaliseFallback(focusExecution.reason, {
          providerDecision,
          decisionContext,
          verificationContext,
          actions,
          outcomeUnknown: focusExecution.reason === "action_outcome_unknown",
        });
      }
      actions.push({ index: 1, ...focusExecution.action, actionId: "focus_item" });

      let focusContext;
      try {
        focusContext = await observeContext(now());
      } catch {
        return await finaliseFallback("focus_context_unavailable", {
          providerDecision,
          decisionContext,
          verificationContext,
          actions,
        });
      }
      const focusTaskBinding = buildAiWorkspaceTaskObjectiveBinding({
        task: getTaskById(taskId),
        taskId,
        workViewState: focusContext.workViewState,
        maximumActions: 2,
      });
      focusVerified = aiWorkspaceTaskObjectiveBindingMatches(
        decisionContext.taskObjectiveBinding,
        focusTaskBinding,
      )
        && aiWorkspaceOcrSurfaceMatches(verificationContext, focusContext)
        && focusContext.observation.frame.sequence
          > focusExecution.nativeInput.postFrame.sequence;
      if (!focusVerified) {
        return await finaliseFallback("focus_verification_failed", {
          providerDecision,
          decisionContext,
          verificationContext,
          focusContext,
          actions,
          focusVerified,
        });
      }

      await publishRequiredAudit("ai_workspace.ocr_focus_type_type_authorized", {
        registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        ...contextEvidence("verification", verificationContext),
        ...contextEvidence("focus", focusContext),
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionId: "type_text",
        itemOrdinal: item.ordinal,
        inputEvidence,
        surfaceId: focusContext.observation.surface.surfaceId,
        inventorySequence: focusContext.observation.inventorySequence,
        taskObjectiveInputBound: true,
        focusActionVerified: true,
        maximumActions: 2,
        fixedActionIndex: 2,
        automaticContinuation: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
      });
      const taskAfterTypeAudit = buildAiWorkspaceTaskObjectiveBinding({
        task: getTaskById(taskId),
        taskId,
        workViewState: focusContext.workViewState,
        maximumActions: 2,
      });
      if (!aiWorkspaceTaskObjectiveBindingMatches(
        decisionContext.taskObjectiveBinding,
        taskAfterTypeAudit,
      )) {
        return await finaliseFallback("task_objective_changed", {
          providerDecision,
          decisionContext,
          verificationContext,
          focusContext,
          actions,
          focusVerified,
        });
      }

      const typeExecution = await executeAiWorkspaceOcrNativeType({
        postJson,
        screenActUrl,
        taskId,
        context: focusContext,
        inputText,
        inputEvidence,
      });
      if (!typeExecution.ok) {
        return await finaliseFallback(typeExecution.reason, {
          providerDecision,
          decisionContext,
          verificationContext,
          focusContext,
          actions,
          focusVerified,
          outcomeUnknown: typeExecution.reason === "action_outcome_unknown",
        });
      }
      actions.push({ index: 2, ...typeExecution.action });

      let postActionContext;
      try {
        postActionContext = await observeContext(now());
      } catch {
        return await finaliseFallback("post_action_context_unavailable", {
          providerDecision,
          decisionContext,
          verificationContext,
          focusContext,
          actions,
          focusVerified,
        });
      }
      const postTaskBinding = buildAiWorkspaceTaskObjectiveBinding({
        task: getTaskById(taskId),
        taskId,
        workViewState: postActionContext.workViewState,
        maximumActions: 2,
      });
      const postActionText = comparableText(
        postActionContext.providerOcr.items.map((candidate) => candidate.text).join(" "),
      );
      const postActionVerified = aiWorkspaceTaskObjectiveBindingMatches(
        decisionContext.taskObjectiveBinding,
        postTaskBinding,
      )
        && aiWorkspaceOcrSurfaceMatches(focusContext, postActionContext)
        && postActionContext.observation.frame.sequence
          > typeExecution.nativeInput.postFrame.sequence
        && postActionContext.observation.sceneContentSha256
          !== focusContext.observation.sceneContentSha256
        && postActionText.includes(comparableText(inputText));
      if (!postActionVerified) {
        return await finaliseFallback("post_action_verification_failed", {
          providerDecision,
          decisionContext,
          verificationContext,
          focusContext,
          postActionContext,
          actions,
          focusVerified,
        });
      }

      await publishRequiredAudit("ai_workspace.ocr_focus_type_completed", {
        registry: AI_WORKSPACE_OCR_FOCUS_TYPE_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        ...contextEvidence("verification", verificationContext),
        ...contextEvidence("focus", focusContext),
        ...contextEvidence("postAction", postActionContext),
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        status: "executed",
        actionId: "focus_and_type",
        itemOrdinal: item.ordinal,
        itemBounds: target.itemBounds,
        targetX: target.targetX,
        targetY: target.targetY,
        inputEvidence,
        surfaceId: actions[1].surfaceId,
        inventorySequence: actions[1].inventorySequence,
        actionCount: 2,
        focusActionExecuted: true,
        focusActionVerified: true,
        typeActionExecuted: true,
        postActionVerified: true,
        outcomeUnknown: false,
        maximumActions: 2,
        fixedActionSequence: true,
        taskMutated: false,
        automaticContinuation: false,
        automaticRepeat: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        enterKeyInput: false,
        hotkeyInput: false,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
      });

      const result = fallback("executed", standingAdvisory, {
        providerDecision,
        decisionContext,
        verificationContext,
        focusContext,
        postActionContext,
        actions,
        focusVerified,
      });
      return {
        ...result,
        status: "executed",
        fallback: undefined,
        decision: publicDecision(decision),
        evidence: {
          ...result.evidence,
          focusActionVerified: true,
          postActionVerified: true,
          completionAudit: true,
        },
        governance: {
          ...result.governance,
          providerCalled: true,
          focusRevalidated: true,
          taskObjectiveInputBound: true,
          providerGeneratedInput: true,
          pointerInput: true,
          keyboardInput: true,
          postActionVerified: true,
        },
      };
    } finally {
      inputText = null;
      if (providerDecision?.parsed?.decision) providerDecision.parsed.decision.inputText = null;
    }
  }

  return {
    invoke,
    localFallback: (reason) => fallback(reason, standingAdvisory),
  };
}
