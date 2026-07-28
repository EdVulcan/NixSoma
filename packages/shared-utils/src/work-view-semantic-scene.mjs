import { createHash } from "node:crypto";

import {
  WORK_VIEW_SEMANTIC_TARGET_REFERENCE_REGISTRY,
  normaliseWorkViewSemanticTargetReference,
  projectWorkViewSemanticTargets,
} from "./work-view-semantic-targets.mjs";
import {
  WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
  WORK_VIEW_VISUAL_FRAME_HEIGHT,
  WORK_VIEW_VISUAL_FRAME_WIDTH,
  projectWorkViewVisualFrame,
} from "./work-view-visual-frame.mjs";

export const WORK_VIEW_SEMANTIC_SCENE_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-v0";
export const WORK_VIEW_SEMANTIC_SCENE_PROVIDER_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-provider-v0";
export const WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS = 12;
export const WORK_VIEW_SEMANTIC_SCENE_MAX_NAME_CHARS = 80;

const SCENE_KEYS = new Set([
  "registry", "available", "reason", "sourceScope", "observedAt", "browserPid",
  "frame", "viewport", "itemCount", "sourceItemCount", "truncated", "items",
  "sceneContentSha256", "inputValuesExposed", "urlsExposed", "selectorsExposed",
  "targetIdsExposed", "arbitraryPageScript", "pixelsExposed", "persisted",
]);
const FRAME_KEYS = new Set(["sha256", "sequence", "capturedAt"]);
const VIEWPORT_KEYS = new Set(["width", "height"]);
const ITEM_KEYS = new Set(["role", "name", "disabled", "bounds"]);
const BOUNDS_KEYS = new Set(["x", "y", "width", "height"]);

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function boundedText(value, maximum) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function positivePid(value) {
  return Number.isInteger(value) && value > 0 && value <= 0x7fff_ffff ? value : null;
}

function sceneHash({ viewport, items, truncated }) {
  return createHash("sha256")
    .update(JSON.stringify({ viewport, items, truncated }))
    .digest("hex");
}

export function unavailableWorkViewSemanticScene(reason) {
  return {
    registry: WORK_VIEW_SEMANTIC_SCENE_REGISTRY,
    available: false,
    reason,
    sourceScope: "ai_owned_active_browser_page_only",
    observedAt: null,
    browserPid: null,
    frame: null,
    viewport: {
      width: WORK_VIEW_VISUAL_FRAME_WIDTH,
      height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
    },
    itemCount: 0,
    sourceItemCount: 0,
    truncated: false,
    items: [],
    sceneContentSha256: null,
    inputValuesExposed: false,
    urlsExposed: false,
    selectorsExposed: false,
    targetIdsExposed: false,
    arbitraryPageScript: false,
    pixelsExposed: false,
    persisted: false,
  };
}

function projectItem(item) {
  const role = boundedText(item?.role, 40);
  const name = boundedText(item?.name, WORK_VIEW_SEMANTIC_SCENE_MAX_NAME_CHARS);
  const bounds = item?.bounds;
  if (!role || !name
    || !Number.isInteger(bounds?.x)
    || !Number.isInteger(bounds?.y)
    || !Number.isInteger(bounds?.width)
    || !Number.isInteger(bounds?.height)
    || bounds.x < 0
    || bounds.y < 0
    || bounds.width < 1
    || bounds.height < 1
    || bounds.x > WORK_VIEW_VISUAL_FRAME_WIDTH
    || bounds.y > WORK_VIEW_VISUAL_FRAME_HEIGHT
    || bounds.width > WORK_VIEW_VISUAL_FRAME_WIDTH
    || bounds.height > WORK_VIEW_VISUAL_FRAME_HEIGHT) {
    return null;
  }
  return {
    role,
    name,
    disabled: item.disabled === true,
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  };
}

function projectSceneEntries(targets) {
  return targets.items
    .map((target) => ({ item: projectItem(target), target }))
    .filter((entry) => entry.item !== null)
    .slice(0, WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS);
}

export function buildWorkViewSemanticScene({
  browser,
  capture,
  now = Date.now(),
} = {}) {
  const browserPid = positivePid(browser?.browserPid);
  const frame = projectWorkViewVisualFrame(capture?.visualFrame, {
    includeData: false,
    now,
  });
  const targets = projectWorkViewSemanticTargets(capture?.semanticTargets);
  if (browser?.running !== true || !browserPid) return unavailableWorkViewSemanticScene("browser_not_running");
  if (frame.available !== true || frame.fresh !== true) return unavailableWorkViewSemanticScene("visual_frame_not_fresh");
  if (targets.available !== true
    || targets.frame?.sha256 !== frame.sha256
    || targets.frame?.sequence !== frame.sequence
    || targets.inputValuesExposed !== false
    || targets.selectorsExposed !== false
    || targets.arbitraryPageScript !== false
    || targets.persisted !== false) {
    return unavailableWorkViewSemanticScene("semantic_inventory_not_frame_bound");
  }

  const sourceItems = targets.items.map(projectItem).filter(Boolean);
  const items = projectSceneEntries(targets).map((entry) => entry.item);
  if (items.length < 1) return unavailableWorkViewSemanticScene("semantic_scene_empty");
  const truncated = sourceItems.length > items.length || targets.truncated === true;
  const viewport = {
    width: WORK_VIEW_VISUAL_FRAME_WIDTH,
    height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
  };
  return {
    registry: WORK_VIEW_SEMANTIC_SCENE_REGISTRY,
    available: true,
    reason: null,
    sourceScope: "ai_owned_active_browser_page_only",
    observedAt: new Date(now).toISOString(),
    browserPid,
    frame: {
      sha256: frame.sha256,
      sequence: frame.sequence,
      capturedAt: frame.capturedAt,
    },
    viewport,
    itemCount: items.length,
    sourceItemCount: sourceItems.length,
    truncated,
    items,
    sceneContentSha256: sceneHash({ viewport, items, truncated }),
    inputValuesExposed: false,
    urlsExposed: false,
    selectorsExposed: false,
    targetIdsExposed: false,
    arbitraryPageScript: false,
    pixelsExposed: false,
    persisted: false,
  };
}

function unresolvedSceneItem(reason, scene = null) {
  return {
    ok: false,
    reason,
    scene,
    itemOrdinal: null,
    semanticTarget: null,
    evidence: null,
  };
}

export function resolveWorkViewSemanticSceneAction({
  operation,
  browser,
  capture,
  expectedSceneContentSha256,
  expectedBrowserPid,
  expectedFrame,
  itemOrdinal,
  now = Date.now(),
} = {}) {
  if (!["click", "type"].includes(operation)) {
    return unresolvedSceneItem("semantic_scene_operation_invalid");
  }
  const scene = buildWorkViewSemanticScene({ browser, capture, now });
  if (scene.available !== true) return unresolvedSceneItem(scene.reason, scene);
  if (scene.browserPid !== expectedBrowserPid) {
    return unresolvedSceneItem("semantic_scene_browser_changed", scene);
  }
  if (scene.frame.sha256 !== expectedFrame?.sha256
    || scene.frame.sequence !== expectedFrame?.sequence) {
    return unresolvedSceneItem("semantic_scene_frame_changed", scene);
  }
  if (scene.sceneContentSha256 !== expectedSceneContentSha256) {
    return unresolvedSceneItem("semantic_scene_changed", scene);
  }
  if (!Number.isInteger(itemOrdinal) || itemOrdinal < 1 || itemOrdinal > scene.itemCount) {
    return unresolvedSceneItem("semantic_scene_item_ordinal_invalid", scene);
  }

  const targets = projectWorkViewSemanticTargets(capture?.semanticTargets);
  const selected = projectSceneEntries(targets)[itemOrdinal - 1];
  if (!selected) return unresolvedSceneItem("semantic_scene_item_unavailable", scene);
  if (selected.item.disabled) return unresolvedSceneItem("semantic_scene_item_disabled", scene);
  if (operation === "type" && selected.item.role !== "textbox") {
    return unresolvedSceneItem("semantic_scene_item_not_textbox", scene);
  }

  const semanticTarget = normaliseWorkViewSemanticTargetReference({
    registry: WORK_VIEW_SEMANTIC_TARGET_REFERENCE_REGISTRY,
    operation,
    targetId: selected.target.targetId,
    inventorySha256: targets.inventorySha256,
    frame: {
      sha256: targets.frame.sha256,
      sequence: targets.frame.sequence,
    },
  });
  if (!semanticTarget) return unresolvedSceneItem("semantic_scene_target_reference_invalid", scene);

  return {
    ok: true,
    reason: null,
    scene,
    itemOrdinal,
    semanticTarget,
    evidence: {
      registry: `nixsoma-ai-browser-semantic-scene-${operation}-resolution-v0`,
      sceneContentSha256: scene.sceneContentSha256,
      itemOrdinal,
      itemCount: scene.itemCount,
      browserMatched: true,
      frameMatched: true,
      sceneMatched: true,
      disabled: false,
    },
  };
}

export function resolveWorkViewSemanticSceneClick(options = {}) {
  return resolveWorkViewSemanticSceneAction({ ...options, operation: "click" });
}

export function resolveWorkViewSemanticSceneType(options = {}) {
  return resolveWorkViewSemanticSceneAction({ ...options, operation: "type" });
}

export function normaliseWorkViewSemanticScene(scene, { now = Date.now() } = {}) {
  if (!exactKeys(scene, SCENE_KEYS)
    || scene.registry !== WORK_VIEW_SEMANTIC_SCENE_REGISTRY
    || scene.available !== true
    || scene.reason !== null
    || scene.sourceScope !== "ai_owned_active_browser_page_only"
    || !positivePid(scene.browserPid)
    || !exactKeys(scene.frame, FRAME_KEYS)
    || !/^[a-f0-9]{64}$/u.test(scene.frame.sha256)
    || !Number.isInteger(scene.frame.sequence)
    || scene.frame.sequence < 1
    || !Number.isFinite(Date.parse(scene.frame.capturedAt))
    || !Number.isFinite(Date.parse(scene.observedAt))
    || now - Date.parse(scene.frame.capturedAt) > WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS
    || now - Date.parse(scene.observedAt) > WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS
    || !exactKeys(scene.viewport, VIEWPORT_KEYS)
    || scene.viewport.width !== WORK_VIEW_VISUAL_FRAME_WIDTH
    || scene.viewport.height !== WORK_VIEW_VISUAL_FRAME_HEIGHT
    || !Array.isArray(scene.items)
    || scene.items.length < 1
    || scene.items.length > WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS
    || scene.itemCount !== scene.items.length
    || !Number.isInteger(scene.sourceItemCount)
    || scene.sourceItemCount < scene.itemCount
    || typeof scene.truncated !== "boolean"
    || scene.inputValuesExposed !== false
    || scene.urlsExposed !== false
    || scene.selectorsExposed !== false
    || scene.targetIdsExposed !== false
    || scene.arbitraryPageScript !== false
    || scene.pixelsExposed !== false
    || scene.persisted !== false) {
    return null;
  }

  const items = scene.items.map((item) => {
    if (!exactKeys(item, ITEM_KEYS)
      || !exactKeys(item.bounds, BOUNDS_KEYS)) return null;
    const projected = projectItem(item);
    return projected
      && projected.role === item.role
      && projected.name === item.name
      && projected.disabled === item.disabled
      ? projected
      : null;
  });
  if (items.some((item) => item === null)) return null;
  const expectedHash = sceneHash({
    viewport: scene.viewport,
    items,
    truncated: scene.truncated,
  });
  if (scene.sceneContentSha256 !== expectedHash) return null;

  return {
    ...scene,
    frame: { ...scene.frame },
    viewport: { ...scene.viewport },
    items,
  };
}

export function buildProviderWorkViewSemanticScene(scene) {
  const normalised = normaliseWorkViewSemanticScene(scene, {
    now: Date.parse(scene?.observedAt),
  });
  if (!normalised) return null;
  return {
    registry: WORK_VIEW_SEMANTIC_SCENE_PROVIDER_REGISTRY,
    sourceScope: normalised.sourceScope,
    viewport: { ...normalised.viewport },
    itemCount: normalised.itemCount,
    truncated: normalised.truncated,
    items: normalised.items.map((item) => ({
      role: item.role,
      name: item.name,
      disabled: item.disabled,
      bounds: { ...item.bounds },
    })),
    exclusions: {
      pixels: true,
      urls: true,
      inputValues: true,
      selectors: true,
      targetIds: true,
      pageScript: true,
      browserPid: true,
      frameHash: true,
    },
  };
}
