import {
  AI_WORKSPACE_OCR_TYPE_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrTypeInstruction,
  buildAiWorkspaceReviewedMultiApplicationOcrTypeInstruction,
  parseAiWorkspaceOcrTypeDecision,
  readAiWorkspaceOcrTypeObjectiveInput,
  readAiWorkspaceReviewedMultiApplicationObjectiveInput,
} from "./ai-workspace-ocr-type-contract.mjs";
import {
  AI_COMPOSITOR_TYPE_MAX_CHARS,
  AI_COMPOSITOR_TYPE_PATTERN,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";
import { createAiWorkspaceOcrDecisionSession } from "./ai-workspace-ocr-decision-session.mjs";
import { executeAiWorkspaceOcrNativeType } from "./ai-workspace-ocr-native-actions.mjs";
import {
  aiWorkspaceOcrSurfaceMatches,
  compactAiWorkspaceOcrEvidence,
} from "./ai-workspace-ocr-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_OCR_TYPE_REGISTRY =
  "nixsoma-ai-workspace-ocr-type-v0";
export const AI_WORKSPACE_OCR_TYPE_REVIEWED_MULTI_APPLICATION_MODE =
  "reviewed_multi_application_mission";
const SHA256 = /^[a-f0-9]{64}$/u;

function normaliseExpectedSurfaceBinding(value) {
  if (value === undefined || value === null) return null;
  const keys = typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  if (keys.join("\0") !== ["inventorySequence", "surfaceId"].sort().join("\0")
    || !Number.isInteger(value.surfaceId)
    || value.surfaceId < 1
    || value.surfaceId > 0xffff_ffff
    || !Number.isSafeInteger(value.inventorySequence)
    || value.inventorySequence < 1) return undefined;
  return {
    surfaceId: value.surfaceId,
    inventorySequence: value.inventorySequence,
  };
}

function expectedSurfaceMatches(context, expectedSurfaceBinding) {
  if (!expectedSurfaceBinding) return false;
  return context?.observation?.surface?.surfaceId === expectedSurfaceBinding.surfaceId
    && context?.observation?.inventorySequence === expectedSurfaceBinding.inventorySequence;
}

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function objectiveInputValue(binding, missionMode = false) {
  const statement = binding?.providerProjection?.statement;
  return missionMode
    ? readAiWorkspaceReviewedMultiApplicationObjectiveInput(statement)
    : readAiWorkspaceOcrTypeObjectiveInput(statement);
}

function normaliseExpectedObjectiveInput(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "string"
    && value.length >= 1
    && value.length <= AI_COMPOSITOR_TYPE_MAX_CHARS
    && AI_COMPOSITOR_TYPE_PATTERN.test(value)
    ? value
    : undefined;
}

function normaliseExpectedTaskBinding(value) {
  if (value === null || value === undefined) return null;
  const keys = typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  if (keys.join("\0") !== [
    "objectiveContentHash",
    "taskId",
    "taskVersionHash",
  ].sort().join("\0")
    || typeof value.taskId !== "string"
    || !value.taskId
    || !SHA256.test(value.objectiveContentHash)
    || !SHA256.test(value.taskVersionHash)) return undefined;
  return { ...value };
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
  const typed = decision?.actionId === "type_text";
  return {
    actionId: typed ? "type_text" : "no_op",
    inputEvidence: typed
      ? compactInputEvidence(decision.inputEvidence)
      : emptyInputEvidence(),
    confidence: typeof decision?.confidence === "number" ? decision.confidence : null,
  };
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
  verificationContext = null,
  postActionContext = null,
  action = null,
  expectedSurfaceBinding = null,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerWasCalled(reason, providerDecision);
  const providerEvidence = providerDecision?.evidence ?? {};
  const actionExecuted = action?.executed === true;
  const inputEvidence = compactInputEvidence(
    action?.inputEvidence ?? providerDecision?.parsed?.decision?.inputEvidence,
  ) ?? emptyInputEvidence();
  return {
    ok: true,
    registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
    status: "local_fallback",
    decision: { actionId: "no_op", inputEvidence: emptyInputEvidence(), confidence: null },
    action: {
      actionId: actionExecuted ? "type_text" : "no_op",
      inputEvidence: actionExecuted ? inputEvidence : emptyInputEvidence(),
      surfaceId: action?.surfaceId ?? null,
      inventorySequence: action?.inventorySequence ?? null,
      executed: actionExecuted,
    },
    fallback: { reason: `ai_workspace_ocr_type_${reason}` },
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
      inputEvidence,
      actionExecuted,
      receiptMatched: action?.receiptMatched === true,
      frameChanged: action?.frameChanged === true,
      postActionVerified: false,
      completionAudit: false,
      expectedSurfaceBound: expectedSurfaceBinding
        ? expectedSurfaceMatches(verificationContext ?? decisionContext, expectedSurfaceBinding)
        : false,
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
      fixedApplicationSurfaceBound: expectedSurfaceBinding
        ? expectedSurfaceMatches(verificationContext ?? decisionContext, expectedSurfaceBinding)
        : false,
      taskObjectiveInputBound: false,
      providerGeneratedInput: actionExecuted,
      keyboardInput: actionExecuted,
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

function comparableText(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
    : "";
}

export function createAiWorkspaceOcrType({
  standingAdvisory,
  fetchJson,
  postJson,
  sessionManagerUrl,
  screenActUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  function createDecisionSession({ missionMode = false } = {}) {
    const objectiveForm = missionMode
      ? 'Enter exact text "VALUE" in the current browser form, submit it, then type it into the fixed native intake'
      : 'Type exact text "VALUE" into the active surface';
    return createAiWorkspaceOcrDecisionSession({
      standingAdvisory,
      fetchJson,
      sessionManagerUrl,
      getTaskById,
      registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
      providerContextRegistry: missionMode
        ? "nixsoma-ai-workspace-reviewed-multi-application-native-type-context-v0"
        : "nixsoma-ai-workspace-ocr-type-context-v0",
      allowedActions: ["type_text", "no_op"],
      requestedBehavior: {
        allowedActions: ["type_text", "no_op"],
        objectiveForm,
        inputMustExactlyMatchObjectiveValue: true,
        inputCharacters: "ASCII letters, digits, spaces, period, comma, underscore, hyphen",
        inputMaximumCharacters: 32,
        maximumActions: 1,
        taskMutation: false,
        automaticContinuation: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
        reviewedMultiApplicationMissionMode: missionMode,
      },
      instruction: missionMode
        ? buildAiWorkspaceReviewedMultiApplicationOcrTypeInstruction()
        : buildAiWorkspaceOcrTypeInstruction(),
      responseContract: AI_WORKSPACE_OCR_TYPE_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceOcrTypeDecision,
      readActionId: (parsed) => parsed.decision.actionId,
      auditEventName: missionMode
        ? "cloud_provider.ai_workspace_reviewed_multi_application_native_type_egress_authorized"
        : "cloud_provider.ai_workspace_ocr_type_egress_authorized",
      successResult: missionMode
        ? "ai_workspace_reviewed_multi_application_native_type_returned"
        : "ai_workspace_ocr_type_returned",
      egressAudit: {
        providerGeneratedInputAllowed: true,
        providerInputMustMatchTaskObjective: true,
        inputTextPersistedLocally: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
        reviewedMultiApplicationMissionMode: missionMode,
      },
      now,
    });
  }

  const decisionSession = createDecisionSession();
  const reviewedMultiApplicationDecisionSession = createDecisionSession({ missionMode: true });

  async function publishRequiredAudit(name, payload) {
    const accepted = await publishAuditEvent(name, payload);
    if (accepted?.ok !== true) {
      throw new Error(`required AI workspace OCR type audit was not accepted: ${name}`);
    }
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;
    try {
      await publishRequiredAudit("ai_workspace.ocr_type_completed", {
        registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
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
        inputEvidence: result.action.inputEvidence,
        actionExecuted: result.action.executed,
        postActionVerified: false,
        maximumActions: 1,
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

  async function invoke({
    taskId: requestedTaskId,
    expectedSurfaceBinding: expectedInput,
    expectedTaskBinding: expectedTaskInput = null,
    expectedInputText: expectedObjectiveInputValue = null,
    decisionMode = null,
  } = {}) {
    if (typeof postJson !== "function") {
      return fallback("runtime_unavailable", standingAdvisory);
    }
    const expectedSurfaceBinding = normaliseExpectedSurfaceBinding(expectedInput);
    if (expectedSurfaceBinding === undefined) {
      return fallback("expected_surface_invalid", standingAdvisory);
    }
    const missionMode = decisionMode === AI_WORKSPACE_OCR_TYPE_REVIEWED_MULTI_APPLICATION_MODE;
    const expectedTaskBinding = normaliseExpectedTaskBinding(expectedTaskInput);
    const expectedObjectiveInput = normaliseExpectedObjectiveInput(expectedObjectiveInputValue);
    if ((decisionMode !== null && !missionMode)
      || expectedTaskBinding === undefined
      || expectedObjectiveInput === undefined
      || (missionMode && (!expectedTaskBinding || !expectedObjectiveInput))
      || (!missionMode && (expectedTaskBinding || expectedObjectiveInput))) {
      return fallback("reviewed_multi_application_binding_invalid", standingAdvisory);
    }
    const activeDecisionSession = missionMode
      ? reviewedMultiApplicationDecisionSession
      : decisionSession;
    const session = await activeDecisionSession.decide({
      taskId: requestedTaskId,
      expectedTaskBinding,
    });
    const { taskId, providerDecision, decisionContext, verificationContext } = session;
    if (!session.ok) {
      return finaliseFallback(session.reason, { ...session, expectedSurfaceBinding });
    }
    if (expectedSurfaceBinding
      && (!expectedSurfaceMatches(decisionContext, expectedSurfaceBinding)
        || !expectedSurfaceMatches(verificationContext, expectedSurfaceBinding))) {
      return finaliseFallback("expected_surface_changed", {
        ...session,
        expectedSurfaceBinding,
      });
    }

    const decision = providerDecision.parsed.decision;
    let inputText = decision.inputText;
    try {
      if (decision.actionId === "no_op") {
        await publishRequiredAudit("ai_workspace.ocr_type_completed", {
          registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
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
          inputEvidence: emptyInputEvidence(),
          confidence: decision.confidence,
          actionExecuted: false,
          postActionVerified: false,
          maximumActions: 1,
          taskMutated: false,
          automaticContinuation: false,
          inputTextExposed: false,
          inputTextPersisted: false,
          ocrTextPersistedLocally: false,
          pixelsProviderEgress: false,
        });
        return {
          ok: true,
          registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
          status: "no_action",
          decision: publicDecision(decision),
          action: {
            actionId: "no_op",
            inputEvidence: emptyInputEvidence(),
            surfaceId: null,
            inventorySequence: null,
            executed: false,
          },
          evidence: {
            ...providerDecision.evidence,
            ...compactAiWorkspaceOcrEvidence(decisionContext),
            verificationFrameContentHash: verificationContext.observation.frame.sha256,
            verificationFrameSequence: verificationContext.observation.frame.sequence,
            verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
            ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
            inputEvidence: emptyInputEvidence(),
            actionExecuted: false,
            postActionVerified: false,
            completionAudit: true,
            expectedSurfaceBound: expectedSurfaceBinding !== null,
          },
          governance: {
            ...fallback("no_action", standingAdvisory, {
              providerDecision,
              decisionContext,
              verificationContext,
              expectedSurfaceBinding,
            }).governance,
            providerCalled: true,
            localOcrRevalidated: true,
          },
        };
      }

      const objectiveValue = objectiveInputValue(decisionContext.taskObjectiveBinding, missionMode);
      const inputEvidence = compactInputEvidence(decision.inputEvidence);
      if (!objectiveValue
        || inputText !== objectiveValue
        || (expectedObjectiveInput !== null && inputText !== expectedObjectiveInput)
        || !inputEvidence) {
        return await finaliseFallback("input_not_objective_bound", {
          providerDecision,
          decisionContext,
          verificationContext,
        });
      }
      const verificationText = comparableText(
        verificationContext.providerOcr.items.map((item) => item.text).join(" "),
      );
      if (verificationText.includes(comparableText(inputText))) {
        return await finaliseFallback("input_already_visible", {
          providerDecision,
          decisionContext,
          verificationContext,
        });
      }

      const surfaceId = verificationContext.observation.surface.surfaceId;
      const inventorySequence = verificationContext.observation.inventorySequence;
      await publishRequiredAudit("ai_workspace.ocr_type_action_authorized", {
        registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        ...compactAiWorkspaceOcrEvidence(decisionContext),
        verificationFrameContentHash: verificationContext.observation.frame.sha256,
        verificationFrameSequence: verificationContext.observation.frame.sequence,
        verificationOcrSceneContentHash: verificationContext.observation.sceneContentSha256,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionId: "type_text",
        inputEvidence,
        surfaceId,
        inventorySequence,
        taskObjectiveInputBound: true,
        expectedSurfaceBound: expectedSurfaceBinding !== null,
        maximumActions: 1,
        automaticContinuation: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
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
        return await finaliseFallback("task_objective_changed", {
          providerDecision,
          decisionContext,
          verificationContext,
        });
      }

      const execution = await executeAiWorkspaceOcrNativeType({
        postJson,
        screenActUrl,
        taskId,
        context: verificationContext,
        inputText,
        inputEvidence,
      });
      if (!execution.ok) {
        return await finaliseFallback(execution.reason, {
          providerDecision,
          decisionContext,
          verificationContext,
        });
      }
      const action = execution.action;
      const input = execution.nativeInput;
      let postActionContext;
      try {
        postActionContext = await activeDecisionSession.observeContext(now());
      } catch {
        return await finaliseFallback("post_action_context_unavailable", {
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
      const postActionText = comparableText(
        postActionContext.providerOcr.items.map((item) => item.text).join(" "),
      );
      const postActionVerified = aiWorkspaceTaskObjectiveBindingMatches(
        decisionContext.taskObjectiveBinding,
        postTaskBinding,
      )
        && aiWorkspaceOcrSurfaceMatches(verificationContext, postActionContext)
        && postActionContext.observation.frame.sequence > input.postFrame.sequence
        && postActionContext.observation.sceneContentSha256
          !== verificationContext.observation.sceneContentSha256
        && postActionText.includes(comparableText(inputText));
      if (!postActionVerified) {
        return await finaliseFallback("post_action_verification_failed", {
          providerDecision,
          decisionContext,
          verificationContext,
          postActionContext,
          action,
        });
      }

      await publishRequiredAudit("ai_workspace.ocr_type_completed", {
        registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
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
        actionId: "type_text",
        inputEvidence,
        surfaceId: action.surfaceId,
        inventorySequence: action.inventorySequence,
        taskObjectiveInputBound: true,
        receiptMatched: true,
        frameChanged: true,
        actionExecuted: true,
        postActionVerified: true,
        expectedSurfaceBound: expectedSurfaceBinding !== null,
        maximumActions: 1,
        taskMutated: false,
        automaticContinuation: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        enterKeyInput: false,
        hotkeyInput: false,
        automaticRepeat: false,
        ocrTextPersistedLocally: false,
        pixelsProviderEgress: false,
      });
      return {
        ok: true,
        registry: AI_WORKSPACE_OCR_TYPE_REGISTRY,
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
          inputEvidence,
          actionExecuted: true,
          receiptMatched: true,
          frameChanged: true,
          postActionVerified: true,
          completionAudit: true,
          expectedSurfaceBound: expectedSurfaceBinding !== null,
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
          fixedApplicationSurfaceBound: expectedSurfaceBinding !== null,
          taskObjectiveInputBound: true,
          reviewedMultiApplicationMissionMode: missionMode,
          providerGeneratedInput: true,
          keyboardInput: true,
          hotkeyInput: false,
          enterKeyInput: false,
          inputTextExposed: false,
          inputTextPersisted: false,
          postActionVerified: true,
          taskObjectiveBound: true,
          taskObjectiveProviderEgress: true,
          rawTaskGoalProviderEgress: false,
          ocrTextProviderEgress: true,
          ocrTextPersistedLocally: false,
          pixelsProviderEgress: false,
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
    } finally {
      inputText = null;
      if (providerDecision?.parsed?.decision) {
        providerDecision.parsed.decision.inputText = null;
      }
    }
  }

  return {
    invoke,
    localFallback: (reason) => fallback(reason, standingAdvisory),
  };
}
