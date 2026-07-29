function compositorFrame(context) {
  const frame = context?.observation?.frame ?? {};
  return {
    registry: frame.registry,
    socketName: frame.socketName,
    width: frame.width,
    height: frame.height,
    sha256: frame.sha256,
    sequence: frame.sequence,
    capturedAt: frame.capturedAt,
  };
}

function surfaceBinding(context) {
  return {
    surfaceId: context?.observation?.surface?.surfaceId ?? null,
    inventorySequence: context?.observation?.inventorySequence ?? null,
    compositorFrame: compositorFrame(context),
  };
}

export function projectAiWorkspaceOcrClickTarget(item) {
  const bounds = item?.bounds;
  if (!Number.isInteger(item?.ordinal)
    || !bounds
    || !Number.isInteger(bounds.x)
    || !Number.isInteger(bounds.y)
    || !Number.isInteger(bounds.width)
    || !Number.isInteger(bounds.height)) return null;
  return {
    itemOrdinal: item.ordinal,
    itemBounds: { ...bounds },
    targetX: Math.floor(bounds.x + bounds.width / 2),
    targetY: Math.floor(bounds.y + bounds.height / 2),
  };
}

function nativeBindingMatched(input, body) {
  return input?.surfaceId === body.surfaceId
    && input.inventorySequence === body.inventorySequence
    && input.frame?.sha256 === body.compositorFrame.sha256
    && input.frame?.sequence === body.compositorFrame.sequence
    && input.receiptMatched === true
    && input.inventoryMatched === true
    && input.surfaceMatched === true
    && input.frameMatched === true
    && input.frameFresh === true
    && input.sequenceAdvanced === true
    && input.frameChanged === true;
}

export async function executeAiWorkspaceOcrNativeClick({
  postJson,
  screenActUrl,
  taskId,
  context,
  item,
} = {}) {
  const target = projectAiWorkspaceOcrClickTarget(item);
  if (typeof postJson !== "function" || !target) {
    return { ok: false, reason: "action_rejected", action: null, nativeInput: null };
  }
  const body = {
    x: target.targetX,
    y: target.targetY,
    button: "left",
    ...surfaceBinding(context),
  };
  let response;
  try {
    response = await postJson(`${screenActUrl}/act/mouse/click`, body, {
      grantContext: {
        taskId,
        stepId: null,
        capabilityId: "act.screen.pointer_keyboard",
        intent: "mouse.click",
      },
    });
  } catch {
    return { ok: false, reason: "action_outcome_unknown", action: null, nativeInput: null };
  }
  const mediation = response?.action?.mediation;
  const input = mediation?.nativeInput;
  const executed = response?.action?.kind === "mouse.click"
    && response.action.result === "executed-ai-compositor"
    && mediation?.accepted === true
    && input?.operation === "pointer_click"
    && input.x === body.x
    && input.y === body.y
    && nativeBindingMatched(input, body);
  if (!executed) {
    return { ok: false, reason: "action_rejected", action: null, nativeInput: input ?? null };
  }
  return {
    ok: true,
    reason: null,
    nativeInput: input,
    action: {
      actionId: "click_item",
      itemOrdinal: target.itemOrdinal,
      bounds: target.itemBounds,
      x: target.targetX,
      y: target.targetY,
      surfaceId: body.surfaceId,
      inventorySequence: body.inventorySequence,
      executed: true,
      receiptMatched: true,
      frameChanged: true,
    },
  };
}

export async function executeAiWorkspaceOcrNativeType({
  postJson,
  screenActUrl,
  taskId,
  context,
  inputText,
  inputEvidence,
} = {}) {
  if (typeof postJson !== "function"
    || typeof inputText !== "string"
    || !Number.isInteger(inputEvidence?.charCount)
    || inputEvidence.charCount < 1) {
    return { ok: false, reason: "action_rejected", action: null, nativeInput: null };
  }
  const body = { text: inputText, ...surfaceBinding(context) };
  let response;
  try {
    response = await postJson(`${screenActUrl}/act/keyboard/type`, body, {
      grantContext: {
        taskId,
        stepId: null,
        capabilityId: "act.screen.pointer_keyboard",
        intent: "keyboard.type",
      },
    });
  } catch {
    return { ok: false, reason: "action_outcome_unknown", action: null, nativeInput: null };
  } finally {
    body.text = null;
  }
  const mediation = response?.action?.mediation;
  const input = mediation?.nativeInput;
  const executed = response?.action?.kind === "keyboard.type"
    && response.action.result === "executed-ai-compositor"
    && mediation?.accepted === true
    && input?.operation === "keyboard_type"
    && input.inputCharCount === inputEvidence.charCount
    && input.inputTextExposed === false
    && input.inputTextPersisted === false
    && input.keyboardInput === true
    && input.hotkeyInput === false
    && input.enterKeyInput === false
    && input.automaticRepeat === false
    && nativeBindingMatched(input, body);
  if (!executed) {
    return { ok: false, reason: "action_rejected", action: null, nativeInput: input ?? null };
  }
  return {
    ok: true,
    reason: null,
    nativeInput: input,
    action: {
      actionId: "type_text",
      inputEvidence,
      surfaceId: body.surfaceId,
      inventorySequence: body.inventorySequence,
      executed: true,
      receiptMatched: true,
      frameChanged: true,
    },
  };
}
