import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const DEFAULT_CAPABILITY_ID = "act.plugin.capability.invoke";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

function nativePluginInputFromQuery(requestUrl) {
  return {
    packagePath: requestUrl.searchParams.get("packagePath"),
    capabilityId: requestUrl.searchParams.get("capabilityId") ?? DEFAULT_CAPABILITY_ID,
  };
}

function nativePluginTaskInputFromBody(body) {
  return {
    packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
    capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : DEFAULT_CAPABILITY_ID,
    confirm: body.confirm === true,
  };
}

const GET_ROUTES = new Map([
  [
    "/plugins/native-adapter/invoke-plan",
    {
      builder: "buildNativePluginCapabilityInvokePlan",
      errorStatus: 404,
      response: (result) => ({ ok: true, ...result }),
    },
  ],
  [
    "/plugins/native-adapter/runtime-preflight",
    {
      builder: "buildNativePluginRuntimePreflight",
      errorStatus: 400,
      response: (result) => result,
    },
  ],
  [
    "/plugins/native-adapter/runtime-activation-plan",
    {
      builder: "buildNativePluginRuntimeActivationPlan",
      errorStatus: 400,
      response: (result) => result,
    },
  ],
  [
    "/plugins/native-adapter/runtime-adapter-contract",
    {
      builder: "buildNativePluginRuntimeAdapterContract",
      errorStatus: 400,
      response: (result) => result,
    },
  ],
  [
    "/plugins/native-adapter/runtime-adapter-task-draft",
    {
      builder: "buildNativePluginRuntimeAdapterTaskDraft",
      errorStatus: 400,
      response: (result) => result,
    },
  ],
  [
    "/plugins/native-adapter/runtime-activation-task-draft",
    {
      builder: "buildNativePluginRuntimeActivationTaskDraft",
      errorStatus: 400,
      response: (result) => result,
    },
  ],
]);

const POST_TASK_ROUTES = new Map([
  [
    "/plugins/native-adapter/invoke-tasks",
    {
      builder: "createNativePluginInvokeTask",
      extraFields: ["sourceMode", "plugin", "capability"],
    },
  ],
  [
    "/plugins/native-adapter/runtime-adapter-tasks",
    {
      builder: "createNativePluginRuntimeAdapterTask",
      extraFields: ["sourceMode", "plugin", "capability", "adapterContract"],
    },
  ],
  [
    "/plugins/native-adapter/runtime-activation-tasks",
    {
      builder: "createNativePluginRuntimeActivationTask",
      extraFields: ["sourceMode", "plugin", "capability", "activationPlan"],
    },
  ],
]);

function serialiseNativePluginTaskResponse(result, extraFields, {
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  const payload = {
    ok: true,
    registry: result.registry,
    mode: result.mode,
    generatedAt: result.generatedAt,
    sourceRegistry: result.sourceRegistry,
  };
  for (const field of extraFields) {
    payload[field] = result[field];
  }
  payload.task = serialiseTask(result.task);
  payload.approval = serialiseApproval(result.approval);
  payload.governance = result.governance;
  payload.summary = buildTaskSummary();
  return payload;
}

export async function handleNativePluginRuntimeRoute({
  req,
  res,
  requestUrl,
  planBuilder,
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  if (req.method === "GET") {
    const route = GET_ROUTES.get(requestUrl.pathname);
    if (!route) {
      return false;
    }
    try {
      const result = planBuilder[route.builder](nativePluginInputFromQuery(requestUrl));
      sendJson(res, 200, route.response(result));
    } catch (error) {
      sendError(res, route.errorStatus, error);
    }
    return true;
  }

  if (req.method === "POST") {
    const route = POST_TASK_ROUTES.get(requestUrl.pathname);
    if (!route) {
      return false;
    }
    try {
      const body = await readJsonBody(req);
      const result = await planBuilder[route.builder](nativePluginTaskInputFromBody(body));
      sendJson(res, 201, serialiseNativePluginTaskResponse(result, route.extraFields, {
        serialiseTask,
        serialiseApproval,
        buildTaskSummary,
      }));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  return false;
}
