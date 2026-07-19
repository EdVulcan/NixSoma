export function createAiCompositorFrameRoute({
  capture,
  observeGraphicalSession,
  projectGraphicalSession,
  publishEvent,
  createEventName,
  sendJson,
}) {
  return async function handleAiCompositorFrameRoute(req, res, requestUrl) {
    if (req.method !== "GET" || requestUrl.pathname !== "/work-view/compositor-frame") {
      return false;
    }

    const graphicalSession = observeGraphicalSession();
    if (!graphicalSession.ready) {
      sendJson(res, 409, {
        ok: false,
        error: "AI graphical session is not ready for compositor capture.",
        aiGraphicalSession: graphicalSession,
      });
      return true;
    }

    try {
      const frame = await capture.capture();
      const metadata = capture.snapshot();
      const projectedSession = projectGraphicalSession(graphicalSession, metadata);
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-compositor-frame-captured",
        compositorFrame: metadata,
        aiGraphicalSession: projectedSession,
      });
      sendJson(res, frame.available ? 200 : 409, {
        ok: frame.available,
        frame,
        aiGraphicalSession: projectedSession,
      });
    } catch (error) {
      sendJson(res, 409, {
        ok: false,
        error: error instanceof Error ? error.message : "AI compositor capture failed.",
        aiGraphicalSession: projectGraphicalSession(graphicalSession, capture.snapshot()),
      });
    }
    return true;
  };
}
