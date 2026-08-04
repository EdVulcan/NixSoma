import {
  EXECUTION_GRANT_HEADER,
  executionGrantContextFromHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

function validateBody(body, route, definition) {
  const keys = body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body).sort()
    : [];
  if (keys.join("\0") !== ["operatorActionSource", "recommendedAction"].sort().join("\0")
    || !route.operatorActionSources.has(body.operatorActionSource)
    || body.recommendedAction !== route.expectedRecommendation) {
    const error = new Error(`${definition.label} lifecycle request contract is invalid.`);
    error.code = `${definition.errorCodePrefix}_REQUEST_INVALID`;
    error.statusCode = 400;
    throw error;
  }
}

export function createAiFixedApplicationLifecycleRoute({
  lifecycle,
  definition,
  routes,
  executionGrantVerifier,
  publishEvent,
  createEventName,
  sendJson,
} = {}) {
  const routeMap = new Map(routes.map((route) => [route.path, {
    ...route,
    operatorActionSources: new Set(route.operatorActionSources),
  }]));

  return async function handleAiFixedApplicationLifecycleRoute(req, res, requestUrl) {
    const route = req.method === "POST" ? routeMap.get(requestUrl.pathname) : null;
    if (!route) return false;
    let lifecycleAttempted = false;

    try {
      const body = await readJsonBody(req, 4_096);
      validateBody(body, route, definition);
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
          registry: definition.registry,
          operation: route.operation,
          unitName: definition.unitName,
          fixedApplication: true,
          arbitraryProcessLaunch: false,
        },
        executionGrant,
      });
      if (audit?.ok !== true) {
        const error = new Error(
          `${definition.label} lifecycle requires a durable pre-execution audit event.`,
        );
        error.code = `${definition.errorCodePrefix}_AUDIT_REQUIRED`;
        error.statusCode = 503;
        throw error;
      }

      lifecycleAttempted = true;
      const application = await lifecycle[route.operation]();
      await publishEvent(createEventName("screen.updated"), {
        service: "openclaw-session-manager",
        action: `${definition.eventActionPrefix}-${route.operation}-completed`,
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
        error: error instanceof Error
          ? error.message
          : `${definition.label} lifecycle failed.`,
        code: error?.code ?? null,
        application: lifecycle.snapshot(),
      });
    }
    return true;
  };
}
