import { createHash } from "node:crypto";

import { normaliseAiLocalOcrObservation } from "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import {
  AI_WORKSPACE_OCR_ASSESSMENT_RESPONSE_CONTRACT,
  buildAiWorkspaceOcrAssessmentInstruction,
  parseAiWorkspaceOcrAssessment,
} from "./ai-workspace-assessment-contract.mjs";
import { stableAiWorkspaceJson } from "./ai-workspace-context.mjs";
import {
  aiWorkspaceTaskObjectiveBindingMatches,
  buildAiWorkspaceTaskObjectiveBinding,
  normaliseAiWorkspaceTaskId,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_OCR_ASSESSMENT_REGISTRY =
  "nixsoma-ai-workspace-ocr-assessment-v0";

const PROVIDER_OCR_REGISTRY = "nixsoma-ai-workspace-provider-ocr-v0";
const MAX_PROVIDER_OCR_ITEMS = 24;
const MAX_PROVIDER_OCR_CHARS = 1200;

function hashValue(value) {
  return createHash("sha256").update(stableAiWorkspaceJson(value)).digest("hex");
}

function providerWasCalled(reason, providerDecision) {
  return providerDecision?.ok === true
    || ["provider_failed", "response_invalid"].includes(reason);
}

function activeSurface(workViewState) {
  const workView = workViewState?.workView;
  const session = workViewState?.session;
  const graphical = workView?.aiGraphicalSession;
  const inventory = graphical?.surfaceInventory;
  const identity = workView?.trustedSession?.sessionIdentity;
  const helper = workView?.trustedSession?.helperRuntime ?? workView?.helperRuntime;
  const active = Array.isArray(inventory?.surfaces)
    ? inventory.surfaces.filter((surface) => surface?.activated === true)
    : [];
  if (session?.status !== "running"
    || session.role !== "ai-work-view"
    || workView?.status !== "prepared"
    || identity?.status !== "authoritative"
    || helper?.status !== "active"
    || helper.actionAuthority !== "active"
    || helper.leaseMatched !== true
    || graphical?.ready !== true
    || inventory?.available !== true
    || inventory.socketName !== "nixsoma-ai-0"
    || !Number.isInteger(inventory.sequence)
    || inventory.sequence < 1
    || active.length !== 1) return null;
  const surface = active[0];
  if (!Number.isInteger(surface.surfaceId)
    || surface.surfaceId < 1
    || !Number.isInteger(surface.width)
    || surface.width < 1
    || surface.width > 1280
    || !Number.isInteger(surface.height)
    || surface.height < 1
    || surface.height > 720) return null;
  return {
    surfaceId: surface.surfaceId,
    width: surface.width,
    height: surface.height,
    inventorySequence: inventory.sequence,
  };
}

export function buildAiWorkspaceProviderOcr(observation) {
  const normalized = normaliseAiLocalOcrObservation(observation);
  if (!normalized || normalized.itemCount < 1) return null;
  const items = [];
  let characterCount = 0;
  for (const item of normalized.items) {
    if (items.length >= MAX_PROVIDER_OCR_ITEMS
      || characterCount + item.text.length > MAX_PROVIDER_OCR_CHARS) break;
    items.push({
      ordinal: item.ordinal,
      text: item.text,
      confidence: item.confidence,
      bounds: item.bounds,
    });
    characterCount += item.text.length;
  }
  if (items.length < 1) return null;
  const truncated = normalized.truncated || items.length < normalized.itemCount;
  const content = {
    registry: PROVIDER_OCR_REGISTRY,
    engine: {
      name: normalized.engine.name,
      language: normalized.engine.language,
      segmentationMode: normalized.engine.segmentationMode,
    },
    itemCount: items.length,
    characterCount,
    truncated,
    items,
  };
  return content;
}

function ocrBindingHash(observation, providerOcr) {
  return hashValue({
    frameContentHash: observation.frame.sha256,
    frameSequence: observation.frame.sequence,
    surface: observation.surface,
    inventorySequence: observation.inventorySequence,
    providerOcr,
  });
}

function providerContext({ observedAt, workViewState, observation, providerOcr,
  taskObjective }) {
  const workView = workViewState.workView;
  const helper = workView.trustedSession?.helperRuntime ?? workView.helperRuntime;
  return {
    registry: "nixsoma-ai-workspace-ocr-assessment-context-v0",
    observedAt,
    workspace: {
      prepared: true,
      actionAuthority: helper.actionAuthority === "active",
      leaseMatched: helper.leaseMatched === true,
      socketName: "nixsoma-ai-0",
      frame: {
        available: true,
        fresh: true,
        width: observation.frame.width,
        height: observation.frame.height,
        sequence: observation.frame.sequence,
      },
      inventory: {
        available: true,
        sequence: observation.inventorySequence,
        activeSurface: observation.surface,
      },
      localOcr: providerOcr,
    },
    taskObjective,
    requestedBehavior: {
      assessmentOnly: true,
      allowedOutcomes: ["complete", "incomplete", "blocked", "unknown"],
      maximumActions: 0,
      taskMutation: false,
      automaticContinuation: false,
    },
    disclosures: {
      boundedLocalOcrTextProviderEgress: true,
      renderedTextMayContainVisibleUrlsOrValues: true,
    },
    exclusions: {
      pixels: true,
      frameHash: true,
      browserApis: true,
      processIds: true,
      callerPrompt: true,
      rawTaskGoal: true,
      taskIds: true,
      taskMetadata: true,
      commands: true,
      filePaths: true,
      credentials: true,
    },
  };
}

function compactOcrEvidence(context) {
  return {
    frameContentHash: context?.observation?.frame?.sha256 ?? null,
    frameSequence: context?.observation?.frame?.sequence ?? null,
    ocrSceneContentHash: context?.observation?.sceneContentSha256 ?? null,
    ocrBindingHash: context?.ocrBindingHash ?? null,
    ocrItemCount: context?.providerOcr?.itemCount ?? 0,
    ocrCharacterCount: context?.providerOcr?.characterCount ?? 0,
    ocrTruncated: context?.providerOcr?.truncated === true,
    surfaceId: context?.observation?.surface?.surfaceId ?? null,
    inventorySequence: context?.observation?.inventorySequence ?? null,
  };
}

function contextMatches(decisionContext, verificationContext) {
  return verificationContext.observation.surface.surfaceId
      === decisionContext.observation.surface.surfaceId
    && verificationContext.observation.surface.width
      === decisionContext.observation.surface.width
    && verificationContext.observation.surface.height
      === decisionContext.observation.surface.height
    && verificationContext.observation.inventorySequence
      === decisionContext.observation.inventorySequence
    && verificationContext.observation.frame.sequence
      > decisionContext.observation.frame.sequence
    && stableAiWorkspaceJson(verificationContext.providerOcr)
      === stableAiWorkspaceJson(decisionContext.providerOcr);
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
      ...compactOcrEvidence(decisionContext),
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
  async function observeContext(observedAt) {
    const ocrResponse = await fetchJson(`${sessionManagerUrl}/work-view/local-ocr`);
    const observation = normaliseAiLocalOcrObservation(ocrResponse?.observation);
    if (!observation) throw new Error("AI workspace local OCR context is unavailable.");
    const workViewState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    const surface = activeSurface(workViewState);
    if (!surface
      || surface.surfaceId !== observation.surface.surfaceId
      || surface.width !== observation.surface.width
      || surface.height !== observation.surface.height
      || surface.inventorySequence !== observation.inventorySequence) {
      throw new Error("AI workspace local OCR surface binding is unavailable.");
    }
    const providerOcr = buildAiWorkspaceProviderOcr(observation);
    if (!providerOcr) throw new Error("AI workspace local OCR text is unavailable.");
    return {
      observedAt,
      observation,
      providerOcr,
      ocrBindingHash: ocrBindingHash(observation, providerOcr),
      workViewState,
    };
  }

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
    if (!contextMatches(decisionContext, verificationContext)) {
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
      ...compactOcrEvidence(decisionContext),
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
        ...compactOcrEvidence(decisionContext),
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
