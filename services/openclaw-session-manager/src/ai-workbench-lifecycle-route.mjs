import {
  EXECUTION_GRANT_HEADER,
  executionGrantContextFromHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const ROUTES = new Map([
  ["/work-view/application/start", {
    operation: "start",
    auditAction: "ai-workbench-start-requested",
    expectedRecommendation: "start_ai_workbench",
  }],
  ["/work-view/application/stop", {
    operation: "stop",
    auditAction: "ai-workbench-stop-requested",
    expectedRecommendation: "stop_ai_workbench",
  }],
]);

function validateBody(body, expectedRecommendation) {
  const keys = body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body).sort()
    : [];
  if (keys.join("\0") !== ["operatorActionSource", "recommendedAction"].sort().join("\0")
    || body.operatorActionSource !== "capability_runtime_work_view_control"
    || body.recommendedAction !== expectedRecommendation) {
    const error = new Error("AI workbench lifecycle request contract is invalid.");
    error.code = "AI_WORKBENCH_REQUEST_INVALID";
    error.statusCode = 400;
    throw error;
  }
}

export function createAiWorkbenchLifecycleRoute({
  lifecycle,
  executionGrantVerifier,
  publishEvent,
  createEventName,
  sendJson,
} = {}) {
  return async function handleAiWorkbenchLifecycleRoute(req, res, requestUrl) {
    const route = req.method === "POST" ? ROUTES.get(requestUrl.pathname) : null;
    if (!route) return false;
    let lifecycleAttempted = false;

    try {
      const body = await readJsonBody(req, 4_096);
      validateBody(body, route.expectedRecommendation);
      const verification = executionGrantVerifier.verifyRequest({
        token: req.headers[EXECUTION_GRANT_HEADER],
        method: "POST",
        path: requestUrl.pathname,
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
        action: route.auditAction,
        application: {
          registry: "nixsoma-ai-workbench-lifecycle-v0",
          operation: route.operation,
          unitName: "nixsoma-ai-workbench.service",
          fixedApplication: true,
          arbitraryProcessLaunch: false,
        },
        executionGrant,
      });
      if (audit?.ok !== true) {
        const error = new Error("AI workbench lifecycle requires a durable pre-execution audit event.");
        error.code = "AI_WORKBENCH_AUDIT_REQUIRED";
        error.statusCode = 503;
        throw error;
      }

      lifecycleAttempted = true;
      const application = await lifecycle[route.operation]();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: `ai-workbench-${route.operation}-completed`,
        application,
        executionGrant,
      });
      sendJson(res, 200, { ok: true, application });
    } catch (error) {
      if (lifecycleAttempted && typeof lifecycle.reconcile === "function") {
        try {
          await lifecycle.reconcile();
        } catch {
          // Preserve the original actuator error if read-only reconciliation fails.
        }
      }
      sendJson(res, error?.statusCode ?? 409, {
        ok: false,
        error: error instanceof Error ? error.message : "AI workbench lifecycle failed.",
        code: error?.code ?? null,
        application: lifecycle.snapshot(),
      });
    }
    return true;
  };
}
