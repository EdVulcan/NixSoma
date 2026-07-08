import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

export const serialisedTaskField = { output: "task", source: "task", transform: "task" };
export const serialisedApprovalField = { output: "approval", source: "approval", transform: "approval" };

export function postRoute(pathname, action, fields) {
  return [pathname, { action, fields }];
}

function routeFieldValue(field, result, { serialiseTask, serialiseApproval }) {
  if (typeof field === "string") {
    return [field, result[field]];
  }

  if (field.transform === "task") {
    return [field.output, serialiseTask(result[field.source])];
  }

  if (field.transform === "approval") {
    return [field.output, serialiseApproval(result[field.source])];
  }

  return [field.output, result[field.source]];
}

function buildConfirmPostResponse(result, route, context) {
  const response = {
    ok: true,
    registry: result.registry,
    mode: result.mode,
    generatedAt: result.generatedAt,
  };

  for (const field of route.fields) {
    const [key, value] = routeFieldValue(field, result, context);
    response[key] = value;
  }

  response.governance = result.governance;
  response.summary = context.buildTaskSummary();
  return response;
}

export function createConfirmPostRouteHandler({ routes, missingHandlerLabel }) {
  const routeMap = routes instanceof Map ? routes : new Map(routes);

  return async function handleConfirmPostRoute({
    req,
    res,
    requestUrl,
    planBuilder,
    serialiseTask,
    serialiseApproval,
    buildTaskSummary,
  }) {
    if (req.method !== "POST") {
      return false;
    }

    const route = routeMap.get(requestUrl.pathname);
    if (!route) {
      return false;
    }

    try {
      const body = await readJsonBody(req);
      const action = planBuilder?.[route.action];
      if (typeof action !== "function") {
        throw new Error(`Missing ${missingHandlerLabel} POST handler: ${route.action}`);
      }

      const result = await action.call(planBuilder, {
        confirm: body.confirm === true,
      });
      sendJson(res, 201, buildConfirmPostResponse(result, route, {
        serialiseTask,
        serialiseApproval,
        buildTaskSummary,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }

    return true;
  };
}
