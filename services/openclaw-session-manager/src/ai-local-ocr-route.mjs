import {
  buildAiLocalOcrObservation,
  projectAiLocalOcrSummary,
} from "../../../packages/shared-utils/src/ai-local-ocr.mjs";

const ROUTE_PATH = "/work-view/local-ocr";

function activeSurface(inventory) {
  if (inventory?.available !== true
    || inventory.socketName !== "nixsoma-ai-0"
    || !Number.isInteger(inventory.sequence)
    || inventory.sequence < 1
    || !Array.isArray(inventory.surfaces)) return null;
  const active = inventory.surfaces.filter((surface) => surface?.activated === true);
  if (active.length !== 1) return null;
  const surface = active[0];
  if (!Number.isInteger(surface.surfaceId)
    || surface.surfaceId < 1
    || !Number.isInteger(surface.width)
    || surface.width < 1
    || surface.width > 1280
    || !Number.isInteger(surface.height)
    || surface.height < 1
    || surface.height > 720) return null;
  return {
    surfaceId: surface.surfaceId,
    width: surface.width,
    height: surface.height,
  };
}

function inventoryBindingMatches(before, after, surface) {
  const current = activeSurface(after);
  return current !== null
    && after.sequence === before.sequence
    && current.surfaceId === surface.surfaceId
    && current.width === surface.width
    && current.height === surface.height;
}

export function createAiLocalOcrRoute({
  engine,
  capture,
  observeGraphicalSession,
  observeSurfaceInventory,
  publishEvent,
  createEventName,
  sendJson,
}) {
  return async function handleAiLocalOcrRoute(req, res, requestUrl) {
    if (req.method !== "GET" || requestUrl.pathname !== ROUTE_PATH) return false;

    const graphicalSession = observeGraphicalSession();
    const inventory = observeSurfaceInventory();
    const surface = activeSurface(inventory);
    if (graphicalSession?.ready !== true || !surface) {
      sendJson(res, 409, {
        ok: false,
        error: "AI local OCR requires one active surface in the ready graphical session.",
      });
      return true;
    }

    try {
      const frame = await capture.capture();
      if (frame?.available !== true || frame.fresh !== true) {
        throw new Error("AI local OCR could not acquire a fresh compositor frame.");
      }
      const recognized = await engine.recognize(frame);
      const finalInventory = observeSurfaceInventory();
      if (!inventoryBindingMatches(inventory, finalInventory, surface)) {
        throw new Error("AI local OCR active-surface binding changed during observation.");
      }
      const observation = buildAiLocalOcrObservation({
        observedAt: frame.capturedAt,
        frame,
        surface,
        inventorySequence: inventory.sequence,
        ...recognized,
      });
      const summary = projectAiLocalOcrSummary(observation);
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-local-ocr-observed",
        localOcr: summary,
      });
      res.openclawResponseHeaders = {
        ...(res.openclawResponseHeaders ?? {}),
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
        expires: "0",
      };
      sendJson(res, 200, { ok: true, observation });
    } catch (error) {
      sendJson(res, 409, {
        ok: false,
        error: error instanceof Error ? error.message : "AI local OCR observation failed.",
      });
    }
    return true;
  };
}
