import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

export async function handlePolicyCapabilityRoute({
  req,
  res,
  requestUrl,
  policyEvaluator,
  planBuilder,
  publishEvent,
}) {
  if (req.method === "GET" && requestUrl.pathname === "/policy/state") {
    sendJson(res, 200, {
      ok: true,
      policy: policyEvaluator.buildPolicyState(),
    });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/refresh") {
    const registry = await planBuilder.buildCapabilityRegistry();
    await publishEvent(createEventName("capability.updated"), {
      registry: registry.registry,
      summary: registry.summary,
    });
    sendJson(res, 200, {
      ok: true,
      refreshed: true,
      ...registry,
    });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/invoke") {
    try {
      const body = await readJsonBody(req);
      const invocation = await planBuilder.invokeCapability(body);
      sendJson(res, invocation.statusCode, invocation.response);
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/policy/evaluate") {
    try {
      const body = await readJsonBody(req);
      const decision = policyEvaluator.recordPolicyDecision(
        policyEvaluator.evaluatePolicyIntent(body, { stage: "policy.evaluate" }),
      );
      await publishEvent(createEventName("policy.evaluated"), { policy: decision });
      sendJson(res, 200, {
        ok: true,
        policy: decision,
        state: policyEvaluator.buildPolicyState(),
      });
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  return false;
}
