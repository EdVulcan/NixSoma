import { createHash } from "node:crypto";
import {
  WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
  WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
} from "./work-view-visual-frame.mjs";

export const AI_COMPOSITOR_FRAME_REGISTRY = "nixsoma-ai-compositor-frame-v0";
export const AI_COMPOSITOR_FRAME_MEDIA_TYPE = "image/png";

const DATA_URL_PREFIX = `data:${AI_COMPOSITOR_FRAME_MEDIA_TYPE};base64,`;

export function unavailableAiCompositorFrame(reason, dimensions = {}) {
  return {
    registry: AI_COMPOSITOR_FRAME_REGISTRY,
    available: false,
    reason,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
    dataExposed: false,
    capturedAt: null,
    byteLength: null,
    maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
    width: Number.isInteger(dimensions.width) ? dimensions.width : null,
    height: Number.isInteger(dimensions.height) ? dimensions.height : null,
  };
}

function validFrame(frame, dimensions) {
  return frame?.registry === AI_COMPOSITOR_FRAME_REGISTRY
    && frame.available === true
    && frame.sourceScope === "ai_owned_nested_output_only"
    && frame.captureApi === "weston_output_capture_v1"
    && frame.browserScreenshotApi === false
    && frame.desktopWideCapture === false
    && frame.parentDisplayConnected === false
    && frame.inputAuthority === false
    && frame.persisted === false
    && frame.mediaType === AI_COMPOSITOR_FRAME_MEDIA_TYPE
    && frame.encoding === "base64_data_url"
    && frame.width === dimensions.width
    && frame.height === dimensions.height
    && Number.isInteger(frame.byteLength)
    && frame.byteLength > 0
    && frame.byteLength <= WORK_VIEW_VISUAL_FRAME_MAX_BYTES
    && typeof frame.sha256 === "string"
    && /^[a-f0-9]{64}$/u.test(frame.sha256)
    && Number.isFinite(Date.parse(frame.capturedAt))
    && Number.isInteger(frame.sequence)
    && frame.sequence > 0;
}

export function projectAiCompositorFrame(
  frame,
  { includeData = false, now = Date.now(), width, height } = {},
) {
  const dimensions = { width, height };
  if (!validFrame(frame, dimensions)) {
    return unavailableAiCompositorFrame(
      frame?.available === false && typeof frame.reason === "string"
        ? frame.reason.slice(0, 80)
        : "invalid_frame_contract",
      dimensions,
    );
  }
  if (includeData) {
    if (typeof frame.dataUrl !== "string" || !frame.dataUrl.startsWith(DATA_URL_PREFIX)) {
      return unavailableAiCompositorFrame("invalid_frame_data", dimensions);
    }
    const bytes = Buffer.from(frame.dataUrl.slice(DATA_URL_PREFIX.length), "base64");
    if (bytes.length !== frame.byteLength
      || createHash("sha256").update(bytes).digest("hex") !== frame.sha256) {
      return unavailableAiCompositorFrame("invalid_frame_data", dimensions);
    }
  }
  const ageMs = Math.max(0, now - Date.parse(frame.capturedAt));
  return {
    registry: AI_COMPOSITOR_FRAME_REGISTRY,
    available: true,
    reason: null,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    socketName: typeof frame.socketName === "string" ? frame.socketName.slice(0, 80) : null,
    mediaType: AI_COMPOSITOR_FRAME_MEDIA_TYPE,
    encoding: "base64_data_url",
    width: dimensions.width,
    height: dimensions.height,
    byteLength: frame.byteLength,
    maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
    sha256: frame.sha256,
    capturedAt: frame.capturedAt,
    sequence: frame.sequence,
    ageMs,
    fresh: ageMs <= WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
    dataExposed: includeData,
    ...(includeData ? { dataUrl: frame.dataUrl } : {}),
  };
}
