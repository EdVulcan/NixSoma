import { createHash } from "node:crypto";

export const AI_LOCAL_OCR_REGISTRY = "nixsoma-ai-workspace-local-ocr-v0";
export const AI_LOCAL_OCR_MAX_ITEMS = 64;
export const AI_LOCAL_OCR_MAX_ITEM_CHARS = 160;
export const AI_LOCAL_OCR_MAX_TOTAL_CHARS = 4096;

const FRAME_REGISTRY = "nixsoma-ai-compositor-frame-v0";
const SOCKET_NAME = "nixsoma-ai-0";
const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function boundedHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function positiveInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : null;
}

function boundedText(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  return text && text.length <= AI_LOCAL_OCR_MAX_ITEM_CHARS ? text : null;
}

function projectFrame(frame) {
  if (frame?.registry !== FRAME_REGISTRY
    || frame.socketName !== SOCKET_NAME
    || frame.width !== FRAME_WIDTH
    || frame.height !== FRAME_HEIGHT
    || !boundedHash(frame.sha256)
    || !positiveInteger(frame.sequence)
    || !Number.isFinite(Date.parse(frame.capturedAt ?? ""))) return null;
  return {
    registry: FRAME_REGISTRY,
    socketName: SOCKET_NAME,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    sha256: frame.sha256,
    sequence: frame.sequence,
    capturedAt: frame.capturedAt,
  };
}

function projectBounds(bounds) {
  if (!Number.isInteger(bounds?.x)
    || !Number.isInteger(bounds?.y)
    || !positiveInteger(bounds?.width, FRAME_WIDTH)
    || !positiveInteger(bounds?.height, FRAME_HEIGHT)
    || bounds.x < 0
    || bounds.y < 0
    || bounds.x + bounds.width > FRAME_WIDTH
    || bounds.y + bounds.height > FRAME_HEIGHT) return null;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function projectItems(items) {
  if (!Array.isArray(items) || items.length > AI_LOCAL_OCR_MAX_ITEMS) return null;
  let characterCount = 0;
  const projected = [];
  for (const [index, item] of items.entries()) {
    const text = boundedText(item?.text);
    const bounds = projectBounds(item?.bounds);
    if (item?.ordinal !== index + 1
      || !text
      || !bounds
      || typeof item.confidence !== "number"
      || !Number.isFinite(item.confidence)
      || item.confidence < 0
      || item.confidence > 1) return null;
    characterCount += text.length;
    if (characterCount > AI_LOCAL_OCR_MAX_TOTAL_CHARS) return null;
    projected.push({
      ordinal: index + 1,
      text,
      confidence: Math.round(item.confidence * 1000) / 1000,
      bounds,
    });
  }
  return { items: projected, characterCount };
}

function sceneHash({ frame, surface, inventorySequence, items, truncated }) {
  return createHash("sha256")
    .update(stableJson({
      frame: { sha256: frame.sha256, sequence: frame.sequence },
      surface,
      inventorySequence,
      items,
      truncated,
    }))
    .digest("hex");
}

export function buildAiLocalOcrObservation({
  observedAt,
  frame: inputFrame,
  surface: inputSurface,
  inventorySequence,
  items: inputItems,
  sourceItemCount,
  truncated,
} = {}) {
  const frame = projectFrame(inputFrame);
  const surface = {
    surfaceId: positiveInteger(inputSurface?.surfaceId, 0xffff_ffff),
    width: positiveInteger(inputSurface?.width, FRAME_WIDTH),
    height: positiveInteger(inputSurface?.height, FRAME_HEIGHT),
  };
  const projected = projectItems(inputItems);
  if (!Number.isFinite(Date.parse(observedAt ?? ""))
    || !frame
    || !surface.surfaceId
    || !surface.width
    || !surface.height
    || !positiveInteger(inventorySequence)
    || !projected
    || !Number.isInteger(sourceItemCount)
    || sourceItemCount < projected.items.length
    || sourceItemCount > 4096
    || typeof truncated !== "boolean") {
    throw new Error("AI local OCR observation contract is invalid.");
  }
  const contentHash = sceneHash({
    frame,
    surface,
    inventorySequence,
    items: projected.items,
    truncated,
  });
  return {
    ok: true,
    registry: AI_LOCAL_OCR_REGISTRY,
    status: "observed",
    observedAt,
    engine: {
      name: "tesseract",
      language: "eng",
      segmentationMode: 11,
      inputTransport: "stdin",
      outputTransport: "stdout",
    },
    frame,
    surface,
    inventorySequence,
    itemCount: projected.items.length,
    sourceItemCount,
    characterCount: projected.characterCount,
    truncated,
    items: projected.items,
    sceneContentSha256: contentHash,
    boundary: {
      sourceScope: "ai_owned_active_surface_only",
      localProcess: true,
      pixelsExposed: false,
      pixelsProviderEgress: false,
      textTransient: true,
      textPersisted: false,
      browserStorage: false,
      maximumProviderCalls: 0,
      maximumActions: 0,
      taskMutated: false,
      automaticContinuation: false,
      parentDisplayConnected: false,
      desktopWideCapture: false,
      processLaunchExpanded: false,
      mutatesHost: false,
    },
  };
}

export function normaliseAiLocalOcrObservation(value) {
  if (value?.registry !== AI_LOCAL_OCR_REGISTRY
    || value.status !== "observed"
    || value.ok !== true
    || value.engine?.name !== "tesseract"
    || value.engine.language !== "eng"
    || value.engine.segmentationMode !== 11
    || value.engine.inputTransport !== "stdin"
    || value.engine.outputTransport !== "stdout"
    || value.itemCount !== value.items?.length
    || value.characterCount !== value.items?.reduce((total, item) => total + String(item?.text ?? "").length, 0)
    || value.boundary?.sourceScope !== "ai_owned_active_surface_only"
    || value.boundary.localProcess !== true
    || value.boundary.pixelsExposed !== false
    || value.boundary.pixelsProviderEgress !== false
    || value.boundary.textTransient !== true
    || value.boundary.textPersisted !== false
    || value.boundary.browserStorage !== false
    || value.boundary.maximumProviderCalls !== 0
    || value.boundary.maximumActions !== 0
    || value.boundary.taskMutated !== false
    || value.boundary.automaticContinuation !== false
    || value.boundary.parentDisplayConnected !== false
    || value.boundary.desktopWideCapture !== false
    || value.boundary.processLaunchExpanded !== false
    || value.boundary.mutatesHost !== false) return null;
  try {
    const projected = buildAiLocalOcrObservation(value);
    return projected.sceneContentSha256 === value.sceneContentSha256 ? projected : null;
  } catch {
    return null;
  }
}

export function projectAiLocalOcrSummary(value) {
  const observation = normaliseAiLocalOcrObservation(value);
  if (!observation) return null;
  return {
    registry: AI_LOCAL_OCR_REGISTRY,
    status: observation.status,
    observedAt: observation.observedAt,
    frame: observation.frame,
    surface: observation.surface,
    inventorySequence: observation.inventorySequence,
    itemCount: observation.itemCount,
    sourceItemCount: observation.sourceItemCount,
    characterCount: observation.characterCount,
    truncated: observation.truncated,
    sceneContentSha256: observation.sceneContentSha256,
    engine: observation.engine,
    textExposed: false,
    textPersisted: false,
    pixelsExposed: false,
    providerCalled: false,
    actionExecuted: false,
    taskMutated: false,
    automaticContinuation: false,
    mutatesHost: false,
  };
}
