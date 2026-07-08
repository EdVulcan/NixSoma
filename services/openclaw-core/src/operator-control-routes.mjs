import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

function serialiseOperatorStep(step, { serialiseTask, serialiseExecutionResult, buildOperatorState }) {
  return {
    ok: true,
    ran: step.ran,
    blocked: step.blocked ?? false,
    reason: step.reason ?? null,
    dryRun: step.dryRun ?? false,
    task: step.task ? serialiseTask(step.task) : null,
    execution: step.execution ? serialiseExecutionResult(step.execution) : null,
    policy: step.policy ?? step.task?.policy?.decision ?? null,
    approval: step.approval ?? step.task?.approval ?? null,
    operator: step.operator ?? buildOperatorState(),
    summary: step.summary,
  };
}

export async function handleOperatorControlRoute({ req, res, requestUrl, state, taskManager, executor, publishEvent }) {
  const { tasks, runtimeState, getCurrentTask } = state;
  const {
    getTaskById,
    appendTaskPhase,
    reconcileRuntimeState,
    serialiseTask,
    compareTasksForDisplay,
  } = taskManager;
  const {
    serialiseExecutionResult,
    buildOperatorState,
    runOperatorStep,
    runOperatorLoop,
  } = executor;

  if (req.method === "GET" && requestUrl.pathname === "/operator/state") {
    sendJson(res, 200, {
      ok: true,
      operator: buildOperatorState(),
    });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/step") {
    try {
      const body = await readJsonBody(req);
      const step = await runOperatorStep(body);
      sendJson(res, 200, serialiseOperatorStep(step, {
        serialiseTask,
        serialiseExecutionResult,
        buildOperatorState,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/run") {
    try {
      const body = await readJsonBody(req);
      const result = await runOperatorLoop(body);
      sendJson(res, 200, {
        ok: true,
        ran: result.ran,
        count: result.steps.length,
        blocked: result.blocked ?? false,
        reason: result.reason ?? null,
        dryRun: result.dryRun ?? false,
        nextTask: result.nextTask ? serialiseTask(result.nextTask) : null,
        steps: result.steps.map((step) => ({
          task: step.task ? serialiseTask(step.task) : null,
          execution: step.execution ? serialiseExecutionResult(step.execution) : null,
          policy: step.policy ?? step.task?.policy?.decision ?? null,
        })),
        operator: result.operator ?? buildOperatorState(),
        summary: result.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/pause") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to pause." });
      return true;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return true;
    }

    task.status = "paused";
    appendTaskPhase(task, "paused", { reason: "Paused by operator." });
    reconcileRuntimeState();

    await publishEvent(createEventName("task.paused"), { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/resume") {
    const task = getCurrentTask()
      ?? [...tasks.values()].filter((candidate) => candidate.status === "paused").sort(compareTasksForDisplay)[0]
      ?? null;

    if (!task || task.status !== "paused") {
      sendJson(res, 409, { ok: false, error: "No paused task to resume." });
      return true;
    }

    task.status = "queued";
    appendTaskPhase(task, "resumed", { reason: "Resumed by operator." });
    reconcileRuntimeState();

    await publishEvent(createEventName("task.resumed"), { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/takeover") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to take over." });
      return true;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return true;
    }

    const now = new Date().toISOString();
    task.status = "paused";
    task.operatorTakeover = {
      status: "operator_controlled",
      requestedAt: now,
      reason: "Taken over by operator.",
      resumesThrough: "/control/resume",
      stopsThrough: "/control/stop",
    };
    task.workView = {
      ...(task.workView ?? {}),
      visibility: "visible",
      mode: "operator-takeover",
    };
    appendTaskPhase(task, "operator_takeover", { reason: "Taken over by operator." });
    reconcileRuntimeState();

    const takeoverTask = serialiseTask(task);
    await publishEvent(createEventName("task.operator_takeover"), { task: takeoverTask });
    sendJson(res, 200, { ok: true, task: takeoverTask, runtime: runtimeState });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/stop") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to stop." });
      return true;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return true;
    }

    task.status = "failed";
    appendTaskPhase(task, "failed", { reason: "Stopped by operator." });
    task.outcome = {
      kind: "failed",
      summary: "Stopped by operator.",
      reason: "Stopped by operator.",
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    const stoppedTask = serialiseTask(task);
    reconcileRuntimeState();

    await publishEvent(createEventName("task.failed"), { task: stoppedTask, reason: "Stopped by operator." });
    sendJson(res, 200, { ok: true, task: stoppedTask, runtime: runtimeState });
    return true;
  }

  return false;
}
