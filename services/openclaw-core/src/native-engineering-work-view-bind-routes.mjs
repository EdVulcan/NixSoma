import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  buildNativeEngineeringWorkViewAssociation,
  readNativeEngineeringWorkViewState,
} from "./native-engineering-work-view-association.mjs";
import {
  buildNativeEngineeringWorkViewBindCompletion,
  buildNativeEngineeringWorkViewBindDecision,
  NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
} from "./native-engineering-work-view-binding.mjs";

export const NATIVE_ENGINEERING_WORK_VIEW_BIND_PATH =
  "/plugins/native-adapter/engineering-context/work-view/bind";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function taskSummary(task) {
  return task
    ? { id: task.id, status: task.status ?? null }
    : null;
}

function normaliseWorkViewRead(result) {
  if (result && typeof result === "object" && "ok" in result && "data" in result) {
    return result;
  }
  return result?.workView || result?.session
    ? { ok: true, data: result }
    : { ok: false, data: null };
}

export async function handleNativeEngineeringWorkViewBindRoute({
  req,
  res,
  requestUrl,
  state,
  taskManager,
  publishEvent,
  sessionManagerUrl,
  readWorkViewState = readNativeEngineeringWorkViewState,
} = {}) {
  if (requestUrl.pathname !== NATIVE_ENGINEERING_WORK_VIEW_BIND_PATH) return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  const {
    getTaskById,
    bindTaskToTrustedWorkView,
    serialiseTask,
  } = taskManager;
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

    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: "Task not found.",
        task: taskSummary(task),
      });
      return true;
    }

    if (body.confirm !== true) {
      const decision = buildNativeEngineeringWorkViewBindDecision({
        task,
        taskId,
        confirm: false,
        operatorActionSource: "observer_engineering_context_packet",
      });
      sendJson(res, 409, {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: "Explicit operator confirmation is required before binding.",
        task: taskSummary(task),
        bind: decision.readback,
      });
      return true;
    }

    let workViewRead;
    try {
      workViewRead = normaliseWorkViewRead(await readWorkViewState({ sessionManagerUrl }));
    } catch {
      workViewRead = { ok: false, data: null };
    }
    const decision = buildNativeEngineeringWorkViewBindDecision({
      task,
      taskId,
      workViewState: workViewRead.data,
      readStatus: workViewRead.ok ? "available" : "unavailable",
      confirm: true,
      operatorActionSource: "observer_engineering_context_packet",
    });

    if (!decision.ok) {
      sendJson(res, 409, {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: `Trusted work-view bind blocked: ${decision.status}.`,
        task: taskSummary(task),
        bind: decision.readback,
      });
      return true;
    }

    if (!decision.shouldMutate) {
      sendJson(res, 200, {
        ok: true,
        changed: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        task: serialiseTask(task),
        bind: decision.readback,
      });
      return true;
    }

    const updatedTask = bindTaskToTrustedWorkView(task, decision.internalBinding);
    const completedBind = buildNativeEngineeringWorkViewBindCompletion(decision.readback);
    const association = buildNativeEngineeringWorkViewAssociation({
      task: updatedTask,
      taskId,
      workViewState: workViewRead.data,
      readStatus: "available",
    });
    await publishEvent(createEventName("task.work_view_bound"), {
      task: serialiseTask(updatedTask),
      reason: "operator_reviewed_trusted_work_view_bind",
      workViewBinding: completedBind.summary,
    });
    sendJson(res, 200, {
      ok: true,
      changed: true,
      registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
      task: serialiseTask(updatedTask),
      bind: completedBind,
      association,
    });
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
