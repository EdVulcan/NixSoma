import { createHash } from "node:crypto";

import {
  WORK_VIEW_VISUAL_FRAME_HEIGHT,
  WORK_VIEW_VISUAL_FRAME_WIDTH,
} from "./work-view-visual-frame.mjs";

export const WORK_VIEW_SEMANTIC_TARGET_INVENTORY_REGISTRY = "openclaw-browser-semantic-target-inventory-v0";
export const WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS = 64;
export const WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS = 120;

export function unavailableWorkViewSemanticTargets(reason) {
  return {
    registry: WORK_VIEW_SEMANTIC_TARGET_INVENTORY_REGISTRY,
    available: false,
    reason,
    sourceScope: "ai_owned_active_page_only",
    frame: null,
    itemCount: 0,
    truncated: false,
    maxItems: WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS,
    maxNameChars: WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS,
    items: [],
    inventorySha256: null,
    inputValuesExposed: false,
    selectorsExposed: false,
    arbitraryPageScript: false,
    mutation: false,
    desktopWideCapture: false,
    persisted: false,
  };
}

function boundedText(value, maxChars) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, maxChars) : "";
}

function boundedCoordinate(value, max) {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : null;
}

function projectTarget(target, frameSequence, index) {
  const x = boundedCoordinate(target?.bounds?.x, WORK_VIEW_VISUAL_FRAME_WIDTH);
  const y = boundedCoordinate(target?.bounds?.y, WORK_VIEW_VISUAL_FRAME_HEIGHT);
  const width = boundedCoordinate(target?.bounds?.width, WORK_VIEW_VISUAL_FRAME_WIDTH);
  const height = boundedCoordinate(target?.bounds?.height, WORK_VIEW_VISUAL_FRAME_HEIGHT);
  if (x === null || y === null || width === null || height === null || width < 1 || height < 1) return null;
  return {
    targetId: `frame-${frameSequence}-target-${index + 1}`,
    role: boundedText(target?.role, 40) || "interactive",
    tag: boundedText(target?.tag, 20).toLowerCase() || "unknown",
    name: boundedText(target?.name, WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS),
    inputType: boundedText(target?.inputType, 30).toLowerCase() || null,
    disabled: target?.disabled === true,
    bounds: { x, y, width, height },
    visible: true,
    valueExposed: false,
    selectorExposed: false,
  };
}

export function projectWorkViewSemanticTargets(inventory) {
  const frame = inventory?.frame;
  if (inventory?.available !== true
    || typeof frame?.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(frame.sha256)
    || !Number.isInteger(frame.sequence)
    || frame.sequence < 1
    || !Array.isArray(inventory.items)) {
    return unavailableWorkViewSemanticTargets(
      typeof inventory?.reason === "string" ? inventory.reason.slice(0, 80) : "invalid_inventory_contract",
    );
  }
  const items = inventory.items
    .slice(0, WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS)
    .map((target, index) => projectTarget(target, frame.sequence, index))
    .filter(Boolean);
  const frameReference = {
    sha256: frame.sha256,
    sequence: frame.sequence,
    capturedAt: typeof frame.capturedAt === "string" ? frame.capturedAt : null,
  };
  const inventorySha256 = createHash("sha256")
    .update(JSON.stringify({ frame: frameReference, items }))
    .digest("hex");
  return {
    registry: WORK_VIEW_SEMANTIC_TARGET_INVENTORY_REGISTRY,
    available: true,
    reason: null,
    sourceScope: "ai_owned_active_page_only",
    pageUrl: boundedText(inventory.pageUrl, 2048) || null,
    frame: frameReference,
    itemCount: items.length,
    truncated: inventory.items.length > WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS || inventory.truncated === true,
    maxItems: WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS,
    maxNameChars: WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS,
    items,
    inventorySha256,
    inputValuesExposed: false,
    selectorsExposed: false,
    arbitraryPageScript: false,
    mutation: false,
    desktopWideCapture: false,
    persisted: false,
  };
}

export function summariseWorkViewSemanticTargets(inventory) {
  const projected = projectWorkViewSemanticTargets(inventory);
  const { items: _items, ...summary } = projected;
  return summary;
}
