import { WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS } from "./work-view-visual-frame.mjs";

export const AI_COMPOSITOR_INPUT_REGISTRY = "nixsoma-ai-compositor-input-v0";
export const AI_COMPOSITOR_POINTER_CLICK_OPERATION = "pointer_click";
export const AI_COMPOSITOR_POINTER_SCROLL_OPERATION = "pointer_scroll";
export const AI_COMPOSITOR_INPUT_OPERATION = AI_COMPOSITOR_POINTER_CLICK_OPERATION;
export const AI_COMPOSITOR_INPUT_SOCKET = "nixsoma-ai-0";
export const AI_COMPOSITOR_INPUT_WIDTH = 1280;
export const AI_COMPOSITOR_INPUT_HEIGHT = 720;
export const AI_COMPOSITOR_SCROLL_X = 640;
export const AI_COMPOSITOR_SCROLL_Y = 360;

function boundedString(value, maximum = 100) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : null;
}

export function normaliseAiCompositorFrameBinding(value, { now = Date.now() } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI compositor input requires a native frame binding.");
  }
  const capturedAt = boundedString(value.capturedAt);
  const capturedAtMs = Date.parse(capturedAt ?? "");
  if (value.registry !== "nixsoma-ai-compositor-frame-v0"
    || value.socketName !== AI_COMPOSITOR_INPUT_SOCKET
    || value.width !== AI_COMPOSITOR_INPUT_WIDTH
    || value.height !== AI_COMPOSITOR_INPUT_HEIGHT
    || typeof value.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || !Number.isInteger(value.sequence)
    || value.sequence < 1
    || !Number.isFinite(capturedAtMs)) {
    throw new Error("AI compositor frame binding is invalid.");
  }
  return {
    registry: value.registry,
    socketName: AI_COMPOSITOR_INPUT_SOCKET,
    width: AI_COMPOSITOR_INPUT_WIDTH,
    height: AI_COMPOSITOR_INPUT_HEIGHT,
    sha256: value.sha256,
    sequence: value.sequence,
    capturedAt,
    ageMs: Math.max(0, now - capturedAtMs),
    fresh: now - capturedAtMs <= WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
  };
}

export function normaliseAiCompositorPointerAction(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI compositor input action must be an object.");
  }
  if (value.button !== undefined && value.button !== "left") {
    throw new Error("AI compositor input only allows the left pointer button.");
  }
  if (!Number.isInteger(value.x) || value.x < 0 || value.x >= AI_COMPOSITOR_INPUT_WIDTH
    || !Number.isInteger(value.y) || value.y < 0 || value.y >= AI_COMPOSITOR_INPUT_HEIGHT) {
    throw new Error("AI compositor input coordinates are outside the fixed output.");
  }
  const surfaceBound = value.surfaceId !== undefined
    || value.inventorySequence !== undefined;
  if (surfaceBound && (value.surfaceId === undefined || value.inventorySequence === undefined)) {
    throw new Error("AI compositor pointer surface binding requires both surfaceId and inventorySequence.");
  }
  return {
    operation: AI_COMPOSITOR_POINTER_CLICK_OPERATION,
    x: value.x,
    y: value.y,
    button: "left",
    surfaceId: surfaceBound
      ? positiveUint32(value.surfaceId, "AI compositor pointer surfaceId")
      : null,
    inventorySequence: surfaceBound
      ? positiveUint32(value.inventorySequence, "AI compositor pointer inventorySequence")
      : null,
    frame: normaliseAiCompositorFrameBinding(value.compositorFrame, options),
  };
}

function positiveUint32(value, label) {
  if (!Number.isInteger(value) || value <= 0 || value > 0xffff_ffff) {
    throw new Error(`${label} must be a positive 32-bit integer.`);
  }
  return value;
}

export function normaliseAiCompositorScrollAction(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI compositor scroll action must be an object.");
  }
  if (value.direction !== "up" && value.direction !== "down") {
    throw new Error("AI compositor scroll only allows one up or down step.");
  }
  return {
    operation: AI_COMPOSITOR_POINTER_SCROLL_OPERATION,
    x: AI_COMPOSITOR_SCROLL_X,
    y: AI_COMPOSITOR_SCROLL_Y,
    direction: value.direction,
    surfaceId: positiveUint32(value.surfaceId, "AI compositor scroll surfaceId"),
    inventorySequence: positiveUint32(
      value.inventorySequence,
      "AI compositor scroll inventorySequence",
    ),
    frame: normaliseAiCompositorFrameBinding(value.compositorFrame, options),
  };
}

export function normaliseAiCompositorInputAction(value, options = {}) {
  return value?.direction !== undefined
    ? normaliseAiCompositorScrollAction(value, options)
    : normaliseAiCompositorPointerAction(value, options);
}

export function aiCompositorFrameMatches(binding, frame) {
  return binding?.registry === frame?.registry
    && binding.socketName === frame.socketName
    && binding.width === frame.width
    && binding.height === frame.height
    && binding.sha256 === frame.sha256
    && binding.sequence === frame.sequence
    && binding.capturedAt === frame.capturedAt;
}

export function projectAiCompositorInputEvidence(value) {
  if (!value || typeof value !== "object") return null;
  const operation = [
    AI_COMPOSITOR_POINTER_CLICK_OPERATION,
    AI_COMPOSITOR_POINTER_SCROLL_OPERATION,
  ].includes(value.operation) ? value.operation : null;
  return {
    registry: AI_COMPOSITOR_INPUT_REGISTRY,
    status: boundedString(value.status, 80) ?? "unavailable",
    operation,
    requestId: boundedString(value.requestId, 64),
    socketName: value.socketName === AI_COMPOSITOR_INPUT_SOCKET
      ? AI_COMPOSITOR_INPUT_SOCKET
      : null,
    x: Number.isInteger(value.x) ? value.x : null,
    y: Number.isInteger(value.y) ? value.y : null,
    direction: operation === AI_COMPOSITOR_POINTER_SCROLL_OPERATION
      && ["up", "down"].includes(value.direction)
      ? value.direction
      : null,
    surfaceId: Number.isInteger(value.surfaceId)
      ? value.surfaceId
      : null,
    inventorySequence: Number.isInteger(value.inventorySequence)
      ? value.inventorySequence
      : null,
    frame: value.frame ? {
      sha256: boundedString(value.frame.sha256, 64),
      sequence: Number.isInteger(value.frame.sequence) ? value.frame.sequence : null,
      capturedAt: boundedString(value.frame.capturedAt),
    } : null,
    postFrame: value.postFrame ? {
      sha256: boundedString(value.postFrame.sha256, 64),
      sequence: Number.isInteger(value.postFrame.sequence) ? value.postFrame.sequence : null,
      capturedAt: boundedString(value.postFrame.capturedAt),
    } : null,
    frameMatched: value.frameMatched === true,
    frameFresh: value.frameFresh === true,
    leaseMatched: value.leaseMatched === true,
    receiptMatched: value.receiptMatched === true,
    sequenceAdvanced: value.sequenceAdvanced === true,
    frameChanged: value.frameChanged === true,
    inventoryMatched: Number.isInteger(value.surfaceId)
      ? value.inventoryMatched === true
      : false,
    surfaceMatched: Number.isInteger(value.surfaceId)
      ? value.surfaceMatched === true
      : false,
    imageDataRetained: false,
    persisted: false,
    desktopWideInput: false,
    parentDisplayConnected: false,
    rootRequired: false,
    hostMutation: false,
  };
}
