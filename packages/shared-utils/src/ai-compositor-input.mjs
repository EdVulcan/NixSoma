import { WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS } from "./work-view-visual-frame.mjs";

export const AI_COMPOSITOR_INPUT_REGISTRY = "nixsoma-ai-compositor-input-v0";
export const AI_COMPOSITOR_INPUT_OPERATION = "pointer_click";
export const AI_COMPOSITOR_INPUT_SOCKET = "nixsoma-ai-0";
export const AI_COMPOSITOR_INPUT_WIDTH = 1280;
export const AI_COMPOSITOR_INPUT_HEIGHT = 720;

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
  return {
    operation: AI_COMPOSITOR_INPUT_OPERATION,
    x: value.x,
    y: value.y,
    button: "left",
    frame: normaliseAiCompositorFrameBinding(value.compositorFrame, options),
  };
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
  return {
    registry: AI_COMPOSITOR_INPUT_REGISTRY,
    status: boundedString(value.status, 80) ?? "unavailable",
    operation: value.operation === AI_COMPOSITOR_INPUT_OPERATION
      ? AI_COMPOSITOR_INPUT_OPERATION
      : null,
    requestId: boundedString(value.requestId, 64),
    socketName: value.socketName === AI_COMPOSITOR_INPUT_SOCKET
      ? AI_COMPOSITOR_INPUT_SOCKET
      : null,
    x: Number.isInteger(value.x) ? value.x : null,
    y: Number.isInteger(value.y) ? value.y : null,
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
    imageDataRetained: false,
    persisted: false,
    desktopWideInput: false,
    parentDisplayConnected: false,
    rootRequired: false,
    hostMutation: false,
  };
}
