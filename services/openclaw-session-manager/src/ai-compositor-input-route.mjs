import {
  EXECUTION_GRANT_HEADER,
  executionGrantContextFromHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const SCREEN_ACT_POINTER_PATH = "/act/mouse/click";
const SCREEN_ACT_SCROLL_PATH = "/act/mouse/scroll";

export function createAiCompositorInputRoute({
  controller,
  executionGrantVerifier,
  publishEvent,
  createEventName,
  sendJson,
} = {}) {
  return async function handleAiCompositorInputRoute(req, res, requestUrl) {
    if (req.method !== "POST" || requestUrl.pathname !== "/work-view/compositor-input") {
      return false;
    }
    try {
      const body = await readJsonBody(req, 16_384);
      const action = body?.action;
      const grantContext = executionGrantContextFromHeaders(req.headers);
      const scrollShape = action && typeof action === "object"
        && action.direction !== undefined;
      const grantPath = scrollShape
        ? SCREEN_ACT_SCROLL_PATH
        : SCREEN_ACT_POINTER_PATH;
      const verification = executionGrantVerifier.verifyRequest({
        token: req.headers[EXECUTION_GRANT_HEADER],
        method: "POST",
        path: grantPath,
        body: action,
        context: grantContext,
      });
      if (!verification.ok) {
        const error = new Error(verification.reason);
        error.code = verification.code;
        error.statusCode = verification.statusCode;
        throw error;
      }
      const expectedIntent = scrollShape ? "mouse.scroll" : "mouse.click";
      if (grantContext.intent !== null && grantContext.intent !== expectedIntent) {
        const error = new Error("AI compositor input intent does not match its operation shape.");
        error.code = "AI_COMPOSITOR_INPUT_INTENT_MISMATCH";
        error.statusCode = 400;
        throw error;
      }
      const audit = await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-compositor-input-requested",
        executionGrant: {
          issuer: verification.grant.issuer,
          audience: verification.grant.audience,
          grantId: verification.grant.grantId,
          taskId: verification.grant.taskId,
          stepId: verification.grant.stepId,
          capabilityId: verification.grant.capabilityId,
        },
        input: {
          operation: scrollShape ? "pointer_scroll" : "pointer_click",
          x: action?.x ?? null,
          y: action?.y ?? null,
          direction: scrollShape ? action?.direction ?? null : null,
          surfaceId: action?.surfaceId ?? null,
          inventorySequence: action?.inventorySequence ?? null,
          frameSha256: action?.compositorFrame?.sha256 ?? null,
          frameSequence: action?.compositorFrame?.sequence ?? null,
          socketName: action?.compositorFrame?.socketName ?? null,
          imageDataRetained: false,
          persisted: false,
        },
      });
      if (audit?.ok !== true) {
        const error = new Error("AI compositor input requires a durable pre-execution audit event.");
        error.code = "AI_COMPOSITOR_INPUT_AUDIT_REQUIRED";
        error.statusCode = 503;
        throw error;
      }
      const input = await controller.execute({
        action,
        trustedHelperLease: body.trustedHelperLease,
      });
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: "ai-compositor-input-executed",
        input,
        executionGrant: {
          issuer: verification.grant.issuer,
          audience: verification.grant.audience,
          grantId: verification.grant.grantId,
          taskId: verification.grant.taskId,
          stepId: verification.grant.stepId,
          capabilityId: verification.grant.capabilityId,
        },
      });
      sendJson(res, 200, { ok: true, input });
    } catch (error) {
      sendJson(res, error?.statusCode ?? 409, {
        ok: false,
        error: error instanceof Error ? error.message : "AI compositor input failed.",
        code: error?.code ?? null,
        input: controller.snapshot(),
      });
    }
    return true;
  };
}
