import { projectAiCompositorFrame } from "../../../packages/shared-utils/src/ai-compositor-frame.mjs";
import {
  buildProviderWorkViewSemanticScene,
  normaliseWorkViewSemanticScene,
} from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";

import {
  AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
  buildAiWorkspaceSingleStepInstruction,
  parseAiWorkspaceSingleStepDecision,
} from "./ai-workspace-single-step-contract.mjs";
import { executeAiWorkspaceSemanticClick } from "./ai-workspace-semantic-click.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_SINGLE_STEP_REGISTRY =
  "nixsoma-ai-workspace-single-step-v0";

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const SOCKET_NAME = "nixsoma-ai-0";

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function boundedInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= 0xffff_ffff ? value : null;
}

function activeSurface(inventory) {
  if (inventory?.available !== true
    || inventory.socketName !== SOCKET_NAME
    || !Number.isInteger(inventory.sequence)
    || inventory.sequence < 1
    || !Array.isArray(inventory.surfaces)) return null;
  const active = inventory.surfaces.filter((surface) => surface?.activated === true);
  if (active.length !== 1) return null;
  const surface = active[0];
  const surfaceId = boundedInteger(surface.surfaceId);
  if (!surfaceId || !boundedInteger(surface.width) || !boundedInteger(surface.height)) return null;
  return {
    surfaceId,
    pid: boundedInteger(surface.pid),
    width: surface.width,
    height: surface.height,
  };
}

function compactProviderContext({
  observedAt,
  workView,
  frame,
  inventory,
  surface,
  semanticScene,
  taskObjective,
}) {
  const helper = workView.helperRuntime;
  return {
    registry: "nixsoma-ai-workspace-single-step-context-v1",
    observedAt,
    workspace: {
      prepared: workView.status === "prepared",
      actionAuthority: helper.actionAuthority === "active",
      leaseMatched: helper.leaseMatched === true,
      browserAttached: workView.aiGraphicalSession.browserAttachment?.attached === true,
      socketName: SOCKET_NAME,
      frame: {
        available: true,
        fresh: true,
        width: frame.width,
        height: frame.height,
        sequence: frame.sequence,
      },
      inventory: {
        available: true,
        sequence: inventory.sequence,
        count: inventory.count,
        activeSurface: {
          surfaceId: surface.surfaceId,
          width: surface.width,
          height: surface.height,
        },
      },
      semanticScene,
    },
    taskObjective,
    requestedBehavior: {
      maximumActions: 1,
      allowedActions: ["no_op", "scroll_up", "scroll_down", "click_item"],
      semanticItemOrdinals: "one_based_ordered_items",
      automaticRepeat: false,
    },
    exclusions: {
      pixels: true,
      frameHash: true,
      titles: true,
      appIds: true,
      processIds: true,
      urls: true,
      textInput: true,
      commands: true,
      filePaths: true,
      credentials: true,
      callerPrompt: true,
      semanticFrameHash: true,
      browserPid: true,
      targetIds: true,
      selectors: true,
      inputValues: true,
      rawTaskGoal: true,
      taskIds: true,
      taskMetadata: true,
      taskPaths: true,
    },
  };
}

function taskEvidence(binding) {
  const evidence = binding?.evidence ?? {};
  return {
    taskId: evidence.taskId ?? null,
    taskStatus: evidence.taskStatus ?? null,
    objectiveContentHash: evidence.objectiveContentHash ?? null,
    taskVersionHash: evidence.taskVersionHash ?? null,
  };
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
      ...taskEvidence(objectiveBinding),
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
  async function observeContext(observedAt) {
    const [frameResponse, stateResponse, sceneResponse] = await Promise.all([
      fetchJson(`${sessionManagerUrl}/work-view/compositor-frame`),
      fetchJson(`${sessionManagerUrl}/work-view/state`),
      fetchJson(`${screenSenseUrl}/screen/semantic-scene`),
    ]);
    const workView = stateResponse?.workView;
    const graphical = workView?.aiGraphicalSession;
    const helper = workView?.helperRuntime;
    const inventory = graphical?.surfaceInventory;
    const validationNow = Date.parse(observedAt);
    const frame = projectAiCompositorFrame(frameResponse?.frame, {
      includeData: false,
      now: validationNow,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const surface = activeSurface(inventory);
    const scene = normaliseWorkViewSemanticScene(sceneResponse?.scene, {
      now: validationNow,
    });
    const providerScene = buildProviderWorkViewSemanticScene(scene);
    if (workView?.status !== "prepared"
      || helper?.status !== "active"
      || helper.actionAuthority !== "active"
      || helper.leaseMatched !== true
      || graphical?.ready !== true
      || graphical.browserAttachment?.attached !== true
      || frame.available !== true
      || frame.fresh !== true
      || frame.socketName !== SOCKET_NAME
      || !surface
      || !surface.pid
      || !scene
      || !providerScene
      || scene.browserPid !== surface.pid) {
      throw new Error("AI workspace single-step context is not ready.");
    }
    return {
      provider: compactProviderContext({
        observedAt,
        workView,
        frame,
        inventory,
        surface,
        semanticScene: providerScene,
      }),
      frame,
      inventorySequence: inventory.sequence,
      surface,
      scene,
      workViewState: stateResponse,
    };
  }

  async function publishRequiredAudit(name, payload) {
    const accepted = await publishAuditEvent(name, payload);
    if (accepted?.ok !== true) throw new Error("required AI workspace single-step audit was not accepted");
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
      registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
      maximumActions: 1,
      callerPromptAccepted: false,
      automaticRepeat: false,
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
        });
        if (!taskObjectiveBinding.ok) {
          throw new Error(taskObjectiveBinding.reason);
        }
        decisionContext.taskObjectiveBinding = taskObjectiveBinding;
        decisionContext.provider.taskObjective = taskObjectiveBinding.providerProjection;
        Object.assign(egressAuditPayload, taskEvidence(taskObjectiveBinding));
        return decisionContext.provider;
      },
      instruction: buildAiWorkspaceSingleStepInstruction(),
      buildPrompt: (context) =>
        `Choose exactly one bounded action for this server-generated AI workspace context: ${stableJson(context)}`,
      responseContract: AI_WORKSPACE_SINGLE_STEP_RESPONSE_CONTRACT,
      parseResponse: parseAiWorkspaceSingleStepDecision,
      readActionId: (parsed) => parsed.decision.actionId,
      auditEventName: "cloud_provider.ai_workspace_single_step_egress_authorized",
      auditPayload: egressAuditPayload,
      successResult: "ai_workspace_single_step_decision_returned",
    });
    if (!providerDecision.ok) {
      return fallback(providerDecision.reason, standingAdvisory, {
        providerDecision,
        decisionContext,
      });
    }

    const decision = providerDecision.parsed.decision;
    let executionContext;
    try {
      executionContext = await observeContext(now());
    } catch {
      return fallback("execution_context_unavailable", standingAdvisory, {
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
      return fallback("task_objective_changed", standingAdvisory, {
        providerDecision,
        decisionContext,
      });
    }
    if (executionContext.surface.surfaceId !== decisionContext.surface.surfaceId
      || executionContext.surface.pid !== decisionContext.surface.pid
      || executionContext.inventorySequence !== decisionContext.inventorySequence
      || executionContext.scene.sceneContentSha256 !== decisionContext.scene.sceneContentSha256
      || executionContext.scene.frame.sha256 !== decisionContext.scene.frame.sha256) {
      return fallback("execution_context_changed", standingAdvisory, {
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
        ...taskEvidence(decisionContext.taskObjectiveBinding),
        actionId: "no_op",
        actionExecuted: false,
        maximumActions: 1,
        automaticRepeat: false,
      });
      return {
        ok: true,
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        status: "no_op",
        decision,
        evidence: {
          ...providerDecision.evidence,
          sceneContentHash: decisionContext.scene.sceneContentSha256,
          sceneItemCount: decisionContext.scene.itemCount,
          ...taskEvidence(decisionContext.taskObjectiveBinding),
          actionExecuted: false,
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
        return fallback(semanticClick.reason, standingAdvisory, {
          providerDecision,
          decisionContext,
        });
      }
      return {
        ok: true,
        registry: AI_WORKSPACE_SINGLE_STEP_REGISTRY,
        status: semanticClick.status,
        decision,
        action: semanticClick.action,
        evidence: {
          ...providerDecision.evidence,
          ...semanticClick.evidence,
          ...taskEvidence(decisionContext.taskObjectiveBinding),
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
      ...taskEvidence(decisionContext.taskObjectiveBinding),
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
      return fallback("task_objective_changed", standingAdvisory, {
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
        ...taskEvidence(decisionContext.taskObjectiveBinding),
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
      decision,
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
        ...taskEvidence(decisionContext.taskObjectiveBinding),
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

  return { invoke, observeContext };
}
