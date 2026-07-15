import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";
import { executeNativeEngineeringWorkViewBind } from "./native-engineering-work-view-bind-operation.mjs";
import { readNativeEngineeringWorkViewState } from "./native-engineering-work-view-association.mjs";
import { NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY } from "./native-engineering-work-view-binding.mjs";

export const NATIVE_ENGINEERING_WORK_VIEW_BIND_PATH =
  "/plugins/native-adapter/engineering-context/work-view/bind";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function handleNativeEngineeringWorkViewBindRoute({
  req,
  res,
  requestUrl,
  state,
  taskManager,
  publishEvent,
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  readWorkViewState = readNativeEngineeringWorkViewState,
} = {}) {
  if (requestUrl.pathname !== NATIVE_ENGINEERING_WORK_VIEW_BIND_PATH) return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  try {
    const body = await readJsonBody(req);
    const taskId = hasText(body.taskId) ? body.taskId.trim() : null;
    if (!taskId) {
      sendJson(res, 400, {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: "taskId is required.",
      });
      return true;
    }
    const result = await executeNativeEngineeringWorkViewBind({
      taskManager,
      taskId,
      confirm: body.confirm === true,
      rebind: body.rebind === true,
      publishEvent,
      sessionManagerUrl,
      fetchImpl,
      readWorkViewState,
      serialiseTask: taskManager.serialiseTask,
    });
    sendJson(res, result.statusCode, result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, {
      ok: false,
      registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
      error: message,
    });
  }
  return true;
}
