import { createHash } from "node:crypto";

import { normaliseAiLocalOcrObservation } from "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import { stableAiWorkspaceJson } from "./ai-workspace-context.mjs";

const PROVIDER_OCR_REGISTRY = "nixsoma-ai-workspace-provider-ocr-v0";
export const AI_WORKSPACE_PROVIDER_OCR_MAX_ITEMS = 24;
export const AI_WORKSPACE_PROVIDER_OCR_MAX_CHARS = 1200;

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
    if (items.length >= AI_WORKSPACE_PROVIDER_OCR_MAX_ITEMS
      || characterCount + item.text.length > AI_WORKSPACE_PROVIDER_OCR_MAX_CHARS) break;
    items.push({
      ordinal: item.ordinal,
      text: item.text,
      confidence: item.confidence,
      bounds: item.bounds,
    });
    characterCount += item.text.length;
  }
  if (items.length < 1) return null;
  return {
    registry: PROVIDER_OCR_REGISTRY,
    engine: {
      name: normalized.engine.name,
      language: normalized.engine.language,
      segmentationMode: normalized.engine.segmentationMode,
    },
    itemCount: items.length,
    characterCount,
    truncated: normalized.truncated || items.length < normalized.itemCount,
    items,
  };
}

function ocrBindingHash(observation, providerOcr) {
  return createHash("sha256").update(stableAiWorkspaceJson({
    frameContentHash: observation.frame.sha256,
    frameSequence: observation.frame.sequence,
    surface: observation.surface,
    inventorySequence: observation.inventorySequence,
    providerOcr,
  })).digest("hex");
}

export function createAiWorkspaceOcrContextReader({ fetchJson, sessionManagerUrl } = {}) {
  return async function observeAiWorkspaceOcrContext(observedAt) {
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
  };
}

export function buildAiWorkspaceOcrProviderContext({
  registry,
  context,
  taskObjective,
  requestedBehavior,
} = {}) {
  const workView = context.workViewState.workView;
  const helper = workView.trustedSession?.helperRuntime ?? workView.helperRuntime;
  return {
    registry,
    observedAt: context.observedAt,
    workspace: {
      prepared: true,
      actionAuthority: helper.actionAuthority === "active",
      leaseMatched: helper.leaseMatched === true,
      socketName: "nixsoma-ai-0",
      frame: {
        available: true,
        fresh: true,
        width: context.observation.frame.width,
        height: context.observation.frame.height,
        sequence: context.observation.frame.sequence,
      },
      inventory: {
        available: true,
        sequence: context.observation.inventorySequence,
        activeSurface: context.observation.surface,
      },
      localOcr: context.providerOcr,
    },
    taskObjective,
    requestedBehavior,
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

export function compactAiWorkspaceOcrEvidence(context) {
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

export function aiWorkspaceOcrContextsMatch(decisionContext, verificationContext) {
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

export function aiWorkspaceOcrSurfaceMatches(beforeContext, afterContext) {
  return afterContext.observation.surface.surfaceId
      === beforeContext.observation.surface.surfaceId
    && afterContext.observation.surface.width === beforeContext.observation.surface.width
    && afterContext.observation.surface.height === beforeContext.observation.surface.height
    && afterContext.observation.inventorySequence
      >= beforeContext.observation.inventorySequence
    && afterContext.observation.frame.sequence > beforeContext.observation.frame.sequence;
}
