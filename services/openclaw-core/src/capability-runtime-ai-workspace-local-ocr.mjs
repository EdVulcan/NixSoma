import {
  AI_LOCAL_OCR_REGISTRY,
  normaliseAiLocalOcrObservation,
} from "../../../packages/shared-utils/src/ai-local-ocr.mjs";

export const AI_WORKSPACE_LOCAL_OCR_CAPABILITY_ID =
  "sense.ai.workspace.local_ocr";

const ALLOWED_BODY_KEYS = new Set(["capabilityId", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);

function isCapability(capability) {
  return capability?.id === AI_WORKSPACE_LOCAL_OCR_CAPABILITY_ID;
}

function requestIsBounded(request, rawBody) {
  return request?.params?.confirm === true
    && request.taskId === null
    && request.stepId === null
    && request.operation === null
    && request.intent === null
    && Object.keys(request.params ?? {}).every((key) => ALLOWED_PARAM_KEYS.has(key))
    && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

export function createAiWorkspaceLocalOcrCapabilityHandlers({
  sessionManagerUrl,
  fetchJson,
} = {}) {
  function validateRequest(capability, request, rawBody) {
    if (!isCapability(capability)) return null;
    if (!requestIsBounded(request, rawBody)) {
      return "AI workspace local OCR accepts only capabilityId and params.confirm=true.";
    }
    if (typeof sessionManagerUrl !== "string" || typeof fetchJson !== "function") {
      return "AI workspace local OCR runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability) {
    if (!isCapability(capability)) return { handled: false, result: null };
    const response = await fetchJson(`${sessionManagerUrl}/work-view/local-ocr`);
    const observation = normaliseAiLocalOcrObservation(response?.observation);
    if (!observation) throw new Error("AI workspace local OCR returned an invalid observation.");
    return {
      handled: true,
      result: {
        ...observation,
        governance: {
          explicitOperatorTrigger: true,
          localOcr: true,
          providerCalled: false,
          networkEgress: false,
          pixelsProviderEgress: false,
          maximumProviderCalls: 0,
          maximumActions: 0,
          actionExecuted: false,
          taskMutated: false,
          automaticContinuation: false,
          textTransient: true,
          textPersisted: false,
          browserStorage: false,
          parentDisplayConnected: false,
          desktopWideCapture: false,
          processLaunchExpanded: false,
          mutatesHost: false,
        },
      },
    };
  }

  function summariseResult(capability, result) {
    if (!isCapability(capability)) return null;
    const governance = result?.governance ?? {};
    return {
      kind: "ai.workspace.local_ocr",
      ok: result?.ok === true,
      registry: result?.registry === AI_LOCAL_OCR_REGISTRY ? result.registry : null,
      status: result?.status ?? null,
      observedAt: result?.observedAt ?? null,
      frameContentHash: result?.frame?.sha256 ?? null,
      frameSequence: result?.frame?.sequence ?? null,
      surfaceId: result?.surface?.surfaceId ?? null,
      inventorySequence: result?.inventorySequence ?? null,
      sceneContentHash: result?.sceneContentSha256 ?? null,
      itemCount: result?.itemCount ?? 0,
      sourceItemCount: result?.sourceItemCount ?? 0,
      characterCount: result?.characterCount ?? 0,
      truncated: result?.truncated === true,
      engine: result?.engine?.name ?? null,
      language: result?.engine?.language ?? null,
      inputTransport: result?.engine?.inputTransport ?? null,
      outputTransport: result?.engine?.outputTransport ?? null,
      providerCalled: governance.providerCalled === true,
      maximumProviderCalls: governance.maximumProviderCalls ?? null,
      maximumActions: governance.maximumActions ?? null,
      actionExecuted: governance.actionExecuted === true,
      taskMutated: governance.taskMutated === true,
      automaticContinuation: governance.automaticContinuation === true,
      textExposedInTransientResult: governance.textTransient === true,
      textPersisted: governance.textPersisted === true,
      pixelsProviderEgress: governance.pixelsProviderEgress === true,
      browserStorage: governance.browserStorage === true,
      parentDisplayConnected: governance.parentDisplayConnected === true,
      desktopWideCapture: governance.desktopWideCapture === true,
      processLaunchExpanded: governance.processLaunchExpanded === true,
      mutatesHost: governance.mutatesHost === true,
    };
  }

  return { validateRequest, callBackend, summariseResult };
}
