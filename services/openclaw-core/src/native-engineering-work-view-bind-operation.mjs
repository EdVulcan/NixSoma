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

export async function executeNativeEngineeringWorkViewBind({
  taskManager,
  taskId,
  confirm = false,
  rebind = false,
  publishEvent = async () => {},
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  readWorkViewState = readNativeEngineeringWorkViewState,
  serialiseTask = (task) => task,
  operatorActionSource = "observer_engineering_context_packet",
} = {}) {
  const {
    getTaskById,
    bindTaskToTrustedWorkView,
  } = taskManager ?? {};
  const task = typeof getTaskById === "function" ? getTaskById(taskId) : null;

  if (!task) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: "Task not found.",
        task: taskSummary(task),
      },
    };
  }

  if (confirm !== true) {
    const decision = buildNativeEngineeringWorkViewBindDecision({
      task,
      taskId,
      rebind,
      confirm: false,
      operatorActionSource,
    });
    return {
      statusCode: 409,
      body: {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: "Explicit operator confirmation is required before binding.",
        task: taskSummary(task),
        bind: decision.readback,
      },
    };
  }

  let workViewRead;
  try {
    workViewRead = normaliseWorkViewRead(await readWorkViewState({ sessionManagerUrl, fetchImpl }));
  } catch {
    workViewRead = { ok: false, data: null };
  }
  const decision = buildNativeEngineeringWorkViewBindDecision({
    task,
    taskId,
    rebind,
    workViewState: workViewRead.data,
    readStatus: workViewRead.ok ? "available" : "unavailable",
    confirm: true,
    operatorActionSource,
  });

  if (!decision.ok) {
    return {
      statusCode: 409,
      body: {
        ok: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        error: `Trusted work-view bind blocked: ${decision.status}.`,
        task: taskSummary(task),
        bind: decision.readback,
      },
    };
  }

  if (!decision.shouldMutate) {
    const association = buildNativeEngineeringWorkViewAssociation({
      task,
      taskId,
      workViewState: workViewRead.data,
      readStatus: "available",
    });
    return {
      statusCode: 200,
      body: {
        ok: true,
        changed: false,
        registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
        task: taskSummary(task),
        bind: decision.readback,
        association,
      },
    };
  }

  if (typeof bindTaskToTrustedWorkView !== "function") {
    throw new Error("Trusted work-view binding owner is not configured.");
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
    reason: completedBind.summary.operation === "rebind"
      ? "operator_reviewed_trusted_work_view_rebind"
      : "operator_reviewed_trusted_work_view_bind",
    workViewBinding: completedBind.summary,
  });
  return {
    statusCode: 200,
    body: {
      ok: true,
      changed: true,
      registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
      task: taskSummary(updatedTask),
      bind: completedBind,
      association,
    },
  };
}
