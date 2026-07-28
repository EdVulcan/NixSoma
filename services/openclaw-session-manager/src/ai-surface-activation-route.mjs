import {
  EXECUTION_GRANT_HEADER,
  executionGrantContextFromHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const ROUTE = "/work-view/surface/activate";

function validateBody(body) {
  const keys = body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body).sort()
    : [];
  const expected = [
    "inventorySequence",
    "operatorActionSource",
    "recommendedAction",
    "surfaceId",
  ].sort();
  if (keys.join("\0") !== expected.join("\0")
    || body.operatorActionSource !== "capability_runtime_work_view_control"
    || body.recommendedAction !== "activate_ai_surface"
    || !Number.isInteger(body.surfaceId)
    || body.surfaceId <= 0
    || body.surfaceId > 0xffff_ffff
    || !Number.isInteger(body.inventorySequence)
    || body.inventorySequence <= 0
    || body.inventorySequence > 0xffff_ffff) {
    const error = new Error("AI surface activation request contract is invalid.");
    error.code = "AI_SURFACE_ACTIVATION_REQUEST_INVALID";
    error.statusCode = 400;
    throw error;
  }
}

export function createAiSurfaceActivationRoute({
  controller,
  executionGrantVerifier,
  publishEvent,
  createEventName,
  sendJson,
} = {}) {
  return async function handleAiSurfaceActivationRoute(req, res, requestUrl) {
    if (req.method !== "POST" || requestUrl.pathname !== ROUTE) return false;
    try {
      const body = await readJsonBody(req, 4_096);
      validateBody(body);
      const verification = executionGrantVerifier.verifyRequest({
        token: req.headers[EXECUTION_GRANT_HEADER],
        method: "POST",
        path: ROUTE,
        body,
        context: executionGrantContextFromHeaders(req.headers),
      });
      if (!verification.ok) {
        const error = new Error(verification.reason);
        error.code = verification.code;
        error.statusCode = verification.statusCode;
        throw error;
      }
      const executionGrant = {
        issuer: verification.grant.issuer,
        audience: verification.grant.audience,
        grantId: verification.grant.grantId,
        taskId: verification.grant.taskId,
        stepId: verification.grant.stepId,
        capabilityId: verification.grant.capabilityId,
        intent: verification.grant.intent,
      };
      const audit = await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-surface-activation-requested",
        surface: {
          registry: "nixsoma-ai-surface-activation-v0",
          surfaceId: body.surfaceId,
          inventorySequence: body.inventorySequence,
          titleExposed: false,
          parentDisplayConnected: false,
        },
        executionGrant,
      });
      if (audit?.ok !== true) {
        const error = new Error("AI surface activation requires a durable pre-execution audit event.");
        error.code = "AI_SURFACE_ACTIVATION_AUDIT_REQUIRED";
        error.statusCode = 503;
        throw error;
      }

      const surfaceActivation = await controller.activateSurface({
        surfaceId: body.surfaceId,
        inventorySequence: body.inventorySequence,
      });
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-surface-activation-completed",
        surfaceActivation,
        executionGrant,
      });
      sendJson(res, 200, { ok: true, surfaceActivation });
    } catch (error) {
      sendJson(res, error?.statusCode ?? 409, {
        ok: false,
        error: error instanceof Error ? error.message : "AI surface activation failed.",
        code: error?.code ?? null,
        surfaceActivation: controller.surfaceActivationSnapshot(),
      });
    }
    return true;
  };
}
