import {
  AI_COMPOSITOR_INPUT_REGISTRY,
  AI_COMPOSITOR_KEYBOARD_TYPE_OPERATION,
  AI_COMPOSITOR_POINTER_SCROLL_OPERATION,
  normaliseAiCompositorInputAction,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";

export function hasAiCompositorFrameBinding(params) {
  return Boolean(params?.compositorFrame);
}

function createAiCompositorInputDispatch({
  sessionManagerUrl,
  fetchFn = fetch,
} = {}) {
  return async function dispatchAiCompositorInput({
    action,
    trustedHelperLease,
    forwardedGrantHeaders = {},
  } = {}) {
    const normalised = normaliseAiCompositorInputAction(action);
    const keyboardAction = normalised.operation === AI_COMPOSITOR_KEYBOARD_TYPE_OPERATION;
    const scrollAction = normalised.operation === AI_COMPOSITOR_POINTER_SCROLL_OPERATION;
    const targetBoundAction = keyboardAction || scrollAction
      || Number.isInteger(normalised.surfaceId);
    try {
      const response = await fetchFn(`${sessionManagerUrl}/work-view/compositor-input`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...forwardedGrantHeaders,
        },
        body: JSON.stringify({ action, trustedHelperLease }),
      });
      const data = await response.json().catch(() => null);
      const evidence = data?.input ?? null;
      const accepted = response.ok
        && data?.ok === true
        && evidence?.registry === AI_COMPOSITOR_INPUT_REGISTRY
        && evidence.operation === normalised.operation
        && ["executed", "executed_post_frame_unavailable"].includes(evidence.status)
        && (!targetBoundAction || (
          (!scrollAction || evidence.direction === normalised.direction)
          && (!keyboardAction || (
            evidence.inputCharCount === normalised.inputCharCount
            && evidence.inputTextExposed === false
            && evidence.inputTextPersisted === false
            && evidence.keyboardInput === true
            && evidence.hotkeyInput === false
            && evidence.enterKeyInput === false
            && evidence.automaticRepeat === false
          ))
          && evidence.surfaceId === normalised.surfaceId
          && evidence.inventorySequence === normalised.inventorySequence
          && evidence.inventoryMatched === true
          && evidence.surfaceMatched === true
        ));
      return {
        registry: "openclaw-trusted-work-view-action-mediation-v0",
        attempted: true,
        required: true,
        accepted,
        status: accepted ? "accepted" : "rejected",
        reason: accepted ? null : data?.error ?? "ai_compositor_input_rejected",
        sessionId: trustedHelperLease?.sessionId ?? null,
        leaseId: trustedHelperLease?.leaseId ?? null,
        leaseMatched: evidence?.leaseMatched === true,
        transport: "ai-compositor-native",
        visualGrounding: {
          required: true,
          status: evidence?.status ?? "unavailable",
          frameSha256: normalised.frame.sha256,
          frameSequence: normalised.frame.sequence,
          frameMatched: evidence?.frameMatched === true,
          frameFresh: evidence?.frameFresh === true,
          receiptMatched: evidence?.receiptMatched === true,
          sequenceAdvanced: evidence?.sequenceAdvanced === true,
          frameChanged: evidence?.frameChanged === true,
          inventoryMatched: targetBoundAction ? evidence?.inventoryMatched === true : false,
          surfaceMatched: targetBoundAction ? evidence?.surfaceMatched === true : false,
          surfaceId: targetBoundAction ? normalised.surfaceId : null,
          inventorySequence: targetBoundAction ? normalised.inventorySequence : null,
          inputCharCount: keyboardAction ? normalised.inputCharCount : null,
          inputTextExposed: false,
          inputTextPersisted: false,
          keyboardInput: keyboardAction,
          hotkeyInput: false,
          enterKeyInput: false,
          automaticRepeat: false,
          imageDataRetained: false,
          persisted: false,
        },
        nativeInput: evidence,
      };
    } catch (error) {
      return {
        registry: "openclaw-trusted-work-view-action-mediation-v0",
        attempted: true,
        required: true,
        accepted: false,
        status: "unavailable",
        reason: error instanceof Error ? error.message : "ai_compositor_input_unavailable",
        leaseMatched: false,
        transport: "ai-compositor-native",
        visualGrounding: {
          required: true,
          status: "unavailable",
          frameSha256: normalised.frame.sha256,
          frameSequence: normalised.frame.sequence,
          frameMatched: false,
          frameFresh: normalised.frame.fresh,
          receiptMatched: false,
          sequenceAdvanced: false,
          inputCharCount: keyboardAction ? normalised.inputCharCount : null,
          inputTextExposed: false,
          inputTextPersisted: false,
          keyboardInput: keyboardAction,
          hotkeyInput: false,
          enterKeyInput: false,
          automaticRepeat: false,
          imageDataRetained: false,
          persisted: false,
        },
        nativeInput: null,
      };
    }
  };
}

export function createAiCompositorPointerDispatch(options = {}) {
  return createAiCompositorInputDispatch(options);
}

export function createAiCompositorKeyboardDispatch(options = {}) {
  return createAiCompositorInputDispatch(options);
}
