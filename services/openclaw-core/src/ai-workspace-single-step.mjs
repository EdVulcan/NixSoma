import {
  AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS,
  AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  buildAiWorkspaceSingleStepInstruction,
  parseAiWorkspaceSingleStepDecision,
} from "./ai-workspace-single-step-contract.mjs";
import { executeAiWorkspaceSemanticClick } from "./ai-workspace-semantic-click.mjs";
import { executeAiWorkspaceSemanticType } from "./ai-workspace-semantic-type.mjs";
import {
  buildWriteOnlyInputEvidence,
} from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";
import {
  buildAiWorkspaceProviderContext,
  createAiWorkspaceContextObserver,
  stableAiWorkspaceJson,
} from "./ai-workspace-context.mjs";

export const AI_WORKSPACE_SINGLE_STEP_REGISTRY =
  "nixsoma-ai-workspace-single-step-v0";

function publicDecision(decision) {
  if (!decision || typeof decision !== "object") return null;
  const { inputText, ...publicFields } = decision;
  return {
    ...publicFields,
    inputEvidence: typeof inputText === "string"
      ? buildWriteOnlyInputEvidence(inputText).evidence
      : null,
  };
}

function expectedTaskEvidenceMatches(expected, binding) {
  if (expected === null || expected === undefined) return true;
  const actual = projectAiWorkspaceTaskEvidence(binding);
  return expected && typeof expected === "object" && !Array.isArray(expected)
    && Object.keys(expected).length === 3
    && expected.taskId === actual.taskId
    && expected.objectiveContentHash === actual.objectiveContentHash
    && expected.taskVersionHash === actual.taskVersionHash;
}

function fallback(reason, standingAdvisory, {
  providerDecision = null,
  decisionContext = null,
} = {}) {
  const state = standingAdvisory?.state ?? {};
  const config = standingAdvisory?.config ?? {};
  const providerCalled = providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
  const providerEvidence = providerDecision?.evidence ?? {};
  const scene = decisionContext?.scene ?? null;
  const objectiveBinding = decisionContext?.taskObjectiveBinding ?? null;
  return {
    ok: true,
    registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
    status: "local_fallback",
    fallback: {
      reason: `ai_workspace_single_step_${reason}`,
      actionId: "no_op",
    },
    evidence: {
      contextContentHash: providerEvidence.contextContentHash
        ?? (providerCalled ? state.lastContextHash ?? null : null),
      requestContentHash: providerEvidence.requestContentHash
        ?? (providerCalled ? state.lastRequestHash ?? null : null),
      responseContentHash: providerEvidence.responseContentHash
        ?? (providerCalled ? state.lastResponseHash ?? null : null),
      sceneContentHash: scene?.sceneContentSha256 ?? null,
      sceneItemCount: scene?.itemCount ?? 0,
      ...projectAiWorkspaceTaskEvidence(objectiveBinding),
      actionId: "no_op",
      actionExecuted: false,
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
      maximumActions: 1,
      actionExecuted: false,
      automaticRepeat: false,
      semanticSceneBound: scene !== null,
      currentBrowserSurfaceBound: scene !== null,
      taskObjectiveBound: objectiveBinding?.ok === true,
      taskObjectiveProviderEgress: providerCalled && objectiveBinding?.ok === true,
      rawTaskGoalProviderEgress: false,
      sceneContentProviderEgress: providerCalled && scene !== null,
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

export function createAiWorkspaceSingleStep({
  standingAdvisory,
  fetchJson,
  postJson,
  sessionManagerUrl,
  screenSenseUrl,
  screenActUrl,
  getTaskById = () => null,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  const observeContext = createAiWorkspaceContextObserver({
    fetchJson,
    sessionManagerUrl,
    screenSenseUrl,
  });

  async function publishRequiredAudit(name, payload) {
    const accepted = await publishAuditEvent(name, payload);
    if (accepted?.ok !== true) throw new Error("required AI workspace single-step audit was not accepted");
  }

  async function finaliseFallback(reason, options = {}) {
    const result = fallback(reason, standingAdvisory, options);
    if (result.governance.providerCalled !== true) return result;

    let completionAudit = true;
    try {
      await publishRequiredAudit("ai_workspace.single_step_completed", {
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        at: now(),
        contextContentHash: result.evidence.contextContentHash,
        responseContentHash: result.evidence.responseContentHash,
        sceneContentHash: result.evidence.sceneContentHash,
        sceneItemCount: result.evidence.sceneItemCount,
        taskId: result.evidence.taskId ?? null,
        taskStatus: result.evidence.taskStatus ?? null,
        objectiveContentHash: result.evidence.objectiveContentHash ?? null,
        taskVersionHash: result.evidence.taskVersionHash ?? null,
        status: "local_fallback",
        fallbackReason: result.fallback.reason,
        actionId: "no_op",
        actionExecuted: false,
        maximumActions: 1,
        automaticRepeat: false,
      });
    } catch {
      completionAudit = false;
    }
    result.evidence.completionAudit = completionAudit;
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
    const egressAuditPayload = {
      taskId,
      taskStatus: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
      maximumActions: 1,
      callerPromptAccepted: false,
      automaticRepeat: false,
      semanticSceneRequired: true,
      pixelsEgress: false,
      urlsEgress: false,
      inputValuesEgress: false,
      providerGeneratedInputAllowed: true,
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
        });
        if (!taskObjectiveBinding.ok) {
          throw new Error(taskObjectiveBinding.reason);
        }
        if (!expectedTaskEvidenceMatches(expectedTaskBinding, taskObjectiveBinding)) {
          throw new Error("ai_workspace_task_objective_changed");
        }
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider = buildAiWorkspaceProviderContext({
          registry: "nixsoma-ai-workspace-single-step-context-v2",
          observedAt,
          context: decisionContext,
          taskObjective: taskObjectiveBinding.providerProjection,
          requestedBehavior: {
            maximumActions: 1,
            allowedActions: ["no_op", "scroll_up", "scroll_down", "click_item", "type_item"],
            semanticItemOrdinals: "one_based_ordered_items",
            semanticTypeInput: {
              maximumCharacters: AI_WORKSPACE_SINGLE_STEP_MAX_INPUT_CHARS,
              writeOnlyExecutionPayload: true,
            },
            automaticRepeat: false,
          },
        });
        Object.assign(egressAuditPayload, projectAiWorkspaceTaskEvidence(taskObjectiveBinding));
        return decisionContext.provider;
      },
      instruction: buildAiWorkspaceSingleStepInstruction(),
      buildPrompt: (context) =>
        `Choose exactly one bounded action for this server-generated AI workspace context: ${stableAiWorkspaceJson(context)}`,
      responseContract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceSingleStepDecision,
      readActionId: (parsed) => parsed.decision.actionId,
      auditEventName: "cloud_provider.ai_workspace_single_step_egress_authorized",
      auditPayload: egressAuditPayload,
      successResult: "ai_workspace_single_step_decision_returned",
    });
    if (!providerDecision.ok) {
      return finaliseFallback(providerDecision.reason, {
        providerDecision,
        decisionContext,
      });
    }

    const decision = providerDecision.parsed.decision;
    let executionContext;
    try {
      executionContext = await observeContext(now());
    } catch {
      return finaliseFallback("execution_context_unavailable", {
        providerDecision,
        decisionContext,
      });
    }
    const taskObjectiveStillCurrent = () => aiWorkspaceTaskObjectiveBindingMatches(
      decisionContext.taskObjectiveBinding,
      buildAiWorkspaceTaskObjectiveBinding({
        task: getTaskById(taskId),
        taskId,
        workViewState: executionContext.workViewState,
      }),
    );
    if (!taskObjectiveStillCurrent()) {
      return finaliseFallback("task_objective_changed", {
        providerDecision,
        decisionContext,
      });
    }
    if (executionContext.surface.surfaceId !== decisionContext.surface.surfaceId
      || executionContext.surface.pid !== decisionContext.surface.pid
      || executionContext.inventorySequence !== decisionContext.inventorySequence
      || executionContext.scene.sceneContentSha256 !== decisionContext.scene.sceneContentSha256) {
      return finaliseFallback("execution_context_changed", {
        providerDecision,
        decisionContext,
      });
    }

    if (decision.actionId === "no_op") {
      await publishRequiredAudit("ai_workspace.single_step_completed", {
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        sceneContentHash: decisionContext.scene.sceneContentSha256,
        sceneItemCount: decisionContext.scene.itemCount,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionId: "no_op",
        actionExecuted: false,
        maximumActions: 1,
        automaticRepeat: false,
      });
      return {
        ok: true,
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        status: "no_op",
        decision: publicDecision(decision),
        evidence: {
          ...providerDecision.evidence,
          sceneContentHash: decisionContext.scene.sceneContentSha256,
          sceneItemCount: decisionContext.scene.itemCount,
          ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
          actionExecuted: false,
          completionAudit: true,
          executionFrame: null,
          postFrame: null,
        },
        governance: {
          explicitOperatorTrigger: true,
          standingAuthorization: true,
          providerCalled: true,
          networkEgress: true,
          maximumActions: 1,
          actionExecuted: false,
          automaticRepeat: false,
          semanticSceneBound: true,
          currentBrowserSurfaceBound: true,
          taskObjectiveBound: true,
          taskObjectiveProviderEgress: true,
          rawTaskGoalProviderEgress: false,
          sceneContentProviderEgress: true,
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

    if (decision.actionId === "click_item") {
      const semanticClick = await executeAiWorkspaceSemanticClick({
        decision,
        executionContext,
        decisionContext,
        taskObjectiveBinding: decisionContext.taskObjectiveBinding,
        taskObjectiveStillCurrent,
        providerEvidence: providerDecision.evidence,
        screenActUrl,
        postJson,
        publishRequiredAudit,
        now,
      });
      if (!semanticClick.ok) {
        return finaliseFallback(semanticClick.reason, {
          providerDecision,
          decisionContext,
        });
      }
      return {
        ok: true,
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        status: semanticClick.status,
        decision: publicDecision(decision),
        action: semanticClick.action,
        evidence: {
          ...providerDecision.evidence,
          ...semanticClick.evidence,
          ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        },
        governance: {
          explicitOperatorTrigger: true,
          standingAuthorization: true,
          providerCalled: true,
          networkEgress: true,
          maximumActions: 1,
          actionExecuted: true,
          automaticRepeat: false,
          currentFrameBound: true,
          currentActiveSurfaceBound: true,
          semanticSceneBound: true,
          semanticItemOrdinalBound: true,
          currentBrowserSurfaceBound: true,
          taskObjectiveBound: true,
          taskObjectiveProviderEgress: true,
          rawTaskGoalProviderEgress: false,
          sceneContentProviderEgress: true,
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

    if (decision.actionId === "type_item") {
      const semanticType = await executeAiWorkspaceSemanticType({
        decision,
        executionContext,
        decisionContext,
        taskObjectiveBinding: decisionContext.taskObjectiveBinding,
        taskObjectiveStillCurrent,
        providerEvidence: providerDecision.evidence,
        screenActUrl,
        postJson,
        publishRequiredAudit,
        now,
      });
      if (!semanticType.ok) {
        return finaliseFallback(semanticType.reason, {
          providerDecision,
          decisionContext,
        });
      }
      return {
        ok: true,
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        status: semanticType.status,
        decision: publicDecision(decision),
        action: semanticType.action,
        evidence: {
          ...providerDecision.evidence,
          ...semanticType.evidence,
          ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        },
        governance: {
          explicitOperatorTrigger: true,
          standingAuthorization: true,
          providerCalled: true,
          networkEgress: true,
          maximumActions: 1,
          actionExecuted: true,
          automaticRepeat: false,
          currentFrameBound: true,
          currentActiveSurfaceBound: true,
          semanticSceneBound: true,
          semanticItemOrdinalBound: true,
          currentBrowserSurfaceBound: true,
          taskObjectiveBound: true,
          taskObjectiveProviderEgress: true,
          rawTaskGoalProviderEgress: false,
          sceneContentProviderEgress: true,
          pixelsProviderEgress: false,
          urlsProviderEgress: false,
          inputValuesProviderEgress: false,
          providerGeneratedInput: true,
          inputTextPersisted: false,
          createsTask: false,
          createsApproval: false,
          keyboardInput: true,
          arbitraryPointerInput: false,
          processLaunch: false,
          parentDisplayConnected: false,
          mutatesHost: false,
        },
      };
    }

    const direction = decision.actionId === "scroll_up" ? "up" : "down";
    const actionBody = {
      direction,
      surfaceId: executionContext.surface.surfaceId,
      inventorySequence: executionContext.inventorySequence,
      compositorFrame: {
        registry: executionContext.frame.registry,
        socketName: executionContext.frame.socketName,
        width: executionContext.frame.width,
        height: executionContext.frame.height,
        sha256: executionContext.frame.sha256,
        sequence: executionContext.frame.sequence,
        capturedAt: executionContext.frame.capturedAt,
      },
    };
    await publishRequiredAudit("ai_workspace.single_step_action_authorized", {
      registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
      at: now(),
      contextContentHash: providerDecision.evidence.contextContentHash,
      responseContentHash: providerDecision.evidence.responseContentHash,
      sceneContentHash: decisionContext.scene.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
      actionId: decision.actionId,
      direction,
      surfaceId: actionBody.surfaceId,
      inventorySequence: actionBody.inventorySequence,
      frameSha256: actionBody.compositorFrame.sha256,
      frameSequence: actionBody.compositorFrame.sequence,
      maximumActions: 1,
      automaticRepeat: false,
    });
    if (!taskObjectiveStillCurrent()) {
      return finaliseFallback("task_objective_changed", {
        providerDecision,
        decisionContext,
      });
    }

    const response = await postJson(`${screenActUrl}/act/mouse/scroll`, actionBody, {
      grantContext: {
        taskId,
        stepId: null,
        capabilityId: "act.screen.pointer_keyboard",
        intent: "mouse.scroll",
      },
    });
    const mediation = response?.action?.mediation;
    const input = mediation?.nativeInput;
    const executed = response?.action?.result === "executed-ai-compositor"
      && mediation?.accepted === true
      && input?.operation === "pointer_scroll"
      && input.direction === direction
      && input.surfaceId === actionBody.surfaceId
      && input.inventorySequence === actionBody.inventorySequence
      && input.receiptMatched === true
      && input.inventoryMatched === true
      && input.surfaceMatched === true;
    if (!executed) throw new Error("AI workspace single-step action was not accepted by its owner.");

    let completionAudit = true;
    try {
      await publishRequiredAudit("ai_workspace.single_step_completed", {
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        at: now(),
        contextContentHash: providerDecision.evidence.contextContentHash,
        responseContentHash: providerDecision.evidence.responseContentHash,
        sceneContentHash: decisionContext.scene.sceneContentSha256,
        sceneItemCount: decisionContext.scene.itemCount,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionId: decision.actionId,
        actionExecuted: true,
        direction,
        surfaceId: actionBody.surfaceId,
        inventorySequence: actionBody.inventorySequence,
        receiptMatched: true,
        frameChanged: input.frameChanged === true,
        maximumActions: 1,
        automaticRepeat: false,
      });
    } catch {
      completionAudit = false;
    }

    return {
      ok: true,
      registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
      status: completionAudit ? "executed" : "executed_completion_audit_unavailable",
      decision: publicDecision(decision),
      action: {
        actionId: decision.actionId,
        direction,
        surfaceId: actionBody.surfaceId,
        inventorySequence: actionBody.inventorySequence,
        executed: true,
      },
      evidence: {
        ...providerDecision.evidence,
        sceneContentHash: decisionContext.scene.sceneContentSha256,
        sceneItemCount: decisionContext.scene.itemCount,
        ...projectAiWorkspaceTaskEvidence(decisionContext.taskObjectiveBinding),
        actionExecuted: true,
        executionFrame: {
          sha256: input.frame?.sha256 ?? actionBody.compositorFrame.sha256,
          sequence: input.frame?.sequence ?? actionBody.compositorFrame.sequence,
        },
        postFrame: input.postFrame ? {
          sha256: input.postFrame.sha256 ?? null,
          sequence: input.postFrame.sequence ?? null,
        } : null,
        receiptMatched: true,
        frameChanged: input.frameChanged === true,
        completionAudit,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        providerCalled: true,
        networkEgress: true,
        maximumActions: 1,
        actionExecuted: true,
        automaticRepeat: false,
        currentFrameBound: true,
        currentActiveSurfaceBound: true,
        semanticSceneBound: true,
        currentBrowserSurfaceBound: true,
        taskObjectiveBound: true,
        taskObjectiveProviderEgress: true,
        rawTaskGoalProviderEgress: false,
        sceneContentProviderEgress: true,
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
    observeContext,
    localFallback: (reason) => fallback(reason, standingAdvisory),
  };
}
