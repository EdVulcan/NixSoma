import { createHash } from "node:crypto";

export const WORK_VIEW_VISUAL_FRAME_REGISTRY = "openclaw-browser-visual-frame-v0";
export const WORK_VIEW_VISUAL_FRAME_WIDTH = 960;
export const WORK_VIEW_VISUAL_FRAME_HEIGHT = 540;
export const WORK_VIEW_VISUAL_FRAME_MAX_BYTES = 256 * 1024;
export const WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS = 2_000;
export const WORK_VIEW_VISUAL_FRAME_MEDIA_TYPE = "image/jpeg";

const DATA_URL_PREFIX = `data:${WORK_VIEW_VISUAL_FRAME_MEDIA_TYPE};base64,`;

export function unavailableWorkViewVisualFrame(reason, { capturedAt = null, byteLength = null } = {}) {
  return {
    registry: WORK_VIEW_VISUAL_FRAME_REGISTRY,
    available: false,
    reason,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    dataExposed: false,
    capturedAt,
    byteLength,
    maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
    width: WORK_VIEW_VISUAL_FRAME_WIDTH,
    height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
  };
}

function validAvailableFrame(frame) {
  return frame?.registry === WORK_VIEW_VISUAL_FRAME_REGISTRY
    && frame.available === true
    && frame.sourceScope === "ai_owned_active_page_only"
    && frame.desktopWideCapture === false
    && frame.persisted === false
    && frame.mediaType === WORK_VIEW_VISUAL_FRAME_MEDIA_TYPE
    && frame.encoding === "base64_data_url"
    && frame.width === WORK_VIEW_VISUAL_FRAME_WIDTH
    && frame.height === WORK_VIEW_VISUAL_FRAME_HEIGHT
    && Number.isInteger(frame.byteLength)
    && frame.byteLength > 0
    && frame.byteLength <= WORK_VIEW_VISUAL_FRAME_MAX_BYTES
    && typeof frame.sha256 === "string"
    && /^[a-f0-9]{64}$/u.test(frame.sha256)
    && Number.isFinite(Date.parse(frame.capturedAt))
    && Number.isInteger(frame.sequence)
    && frame.sequence > 0;
}

function validFrameData(frame) {
  if (typeof frame.dataUrl !== "string" || !frame.dataUrl.startsWith(DATA_URL_PREFIX)) return false;
  const bytes = Buffer.from(frame.dataUrl.slice(DATA_URL_PREFIX.length), "base64");
  return bytes.length === frame.byteLength
    && bytes.length <= WORK_VIEW_VISUAL_FRAME_MAX_BYTES
    && createHash("sha256").update(bytes).digest("hex") === frame.sha256;
}

export function projectWorkViewVisualFrame(frame, { includeData = false, now = Date.now() } = {}) {
  if (!validAvailableFrame(frame)) {
    if (frame?.available === false && frame?.registry === WORK_VIEW_VISUAL_FRAME_REGISTRY) {
      return unavailableWorkViewVisualFrame(
        typeof frame.reason === "string" ? frame.reason.slice(0, 80) : "unavailable",
        {
          capturedAt: Number.isFinite(Date.parse(frame.capturedAt)) ? frame.capturedAt : null,
          byteLength: Number.isInteger(frame.byteLength) ? frame.byteLength : null,
        },
      );
    }
    return unavailableWorkViewVisualFrame("invalid_frame_contract");
  }
  if (includeData && !validFrameData(frame)) {
    return unavailableWorkViewVisualFrame("invalid_frame_data", { capturedAt: frame.capturedAt });
  }
  const ageMs = Math.max(0, now - Date.parse(frame.capturedAt));
  return {
    registry: WORK_VIEW_VISUAL_FRAME_REGISTRY,
    available: true,
    reason: null,
    sourceScope: "ai_owned_active_page_only",
    pageId: typeof frame.pageId === "string" ? frame.pageId.slice(0, 120) : null,
    pageUrl: typeof frame.pageUrl === "string" ? frame.pageUrl.slice(0, 2048) : null,
    mediaType: WORK_VIEW_VISUAL_FRAME_MEDIA_TYPE,
    encoding: "base64_data_url",
    width: WORK_VIEW_VISUAL_FRAME_WIDTH,
    height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
    byteLength: frame.byteLength,
    maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
    sha256: frame.sha256,
    capturedAt: frame.capturedAt,
    sequence: frame.sequence,
    ageMs,
    fresh: ageMs <= WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
    desktopWideCapture: false,
    persisted: false,
    dataExposed: includeData,
    ...(includeData ? { dataUrl: frame.dataUrl } : {}),
  };
}
