import {
  buildWorkViewSemanticScene,
  unavailableWorkViewSemanticScene,
} from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";

export function createBrowserSemanticSceneReader({
  browserRuntimeUrl,
  browserRuntimeHeaders = () => ({}),
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  return async function readBrowserSemanticScene() {
    try {
      const response = await fetchImpl(`${browserRuntimeUrl}/browser/capture?visual=metadata&semantic=items`, {
        headers: browserRuntimeHeaders(),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || data.running !== true) {
        return unavailableWorkViewSemanticScene("browser_semantic_capture_unavailable");
      }
      return buildWorkViewSemanticScene({
        browser: data.browser,
        capture: data.capture,
        now: now(),
      });
    } catch {
      return unavailableWorkViewSemanticScene("browser_semantic_capture_unavailable");
    }
  };
}

export function createBrowserSemanticSceneRoute({
  readBrowserSemanticScene,
  sendJson,
} = {}) {
  return async function handleBrowserSemanticSceneRoute(req, res, requestUrl) {
    if (req.method !== "GET" || requestUrl.pathname !== "/screen/semantic-scene") {
      return false;
    }
    const scene = await readBrowserSemanticScene();
    res.setHeader?.("cache-control", "no-store");
    sendJson(res, 200, { ok: true, scene });
    return true;
  };
}
