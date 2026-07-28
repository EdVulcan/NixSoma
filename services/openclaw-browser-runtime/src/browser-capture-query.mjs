const VISUAL_MODES = new Set(["full", "metadata"]);
const SEMANTIC_MODES = new Set(["items", "summary"]);

export function parseBrowserCaptureQuery(requestUrl) {
  const visualMode = requestUrl?.searchParams?.get("visual") ?? "full";
  if (!VISUAL_MODES.has(visualMode)) {
    return {
      ok: false,
      error: "Browser capture visual mode must be full or metadata.",
    };
  }

  const requestedSemanticMode = requestUrl.searchParams.get("semantic");
  if (requestedSemanticMode !== null && !SEMANTIC_MODES.has(requestedSemanticMode)) {
    return {
      ok: false,
      error: "Browser capture semantic mode must be items or summary.",
    };
  }

  const semanticMode = requestedSemanticMode
    ?? (visualMode === "full" ? "items" : "summary");
  return {
    ok: true,
    visualMode,
    semanticMode,
    includeSemanticItems: semanticMode === "items",
  };
}
