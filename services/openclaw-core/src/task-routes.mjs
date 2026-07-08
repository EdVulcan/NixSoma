import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

function parseTaskLimit(searchParams) {
  const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  return Number.isNaN(limit) ? 10 : Math.max(1, Math.min(limit, 50));
}

async function publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask }) {
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));
}

function planTaskInput(body, { execute = false } = {}) {
  return {
    ...body,
    goal:
      typeof body.goal === "string" && body.goal.trim()
        ? body.goal
        : `Plan ${execute ? "and execute " : ""}work for ${body.targetUrl ?? "the target URL"}`,
    type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
    workViewStrategy:
      typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
        ? body.workViewStrategy
        : "ai-work-view",
    includePlan: true,
  };
}

function executionTaskInput(body) {
  return {
    ...body,
    goal:
      typeof body.goal === "string" && body.goal.trim()
        ? body.goal
        : `Open the AI work view at ${body.targetUrl ?? "the target URL"}`,
    type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
    workViewStrategy:
      typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
        ? body.workViewStrategy
        : "ai-work-view",
  };
}

export async function handleTaskRoute({ req, res, requestUrl, state, approvalEngine, taskManager, planBuilder, executor, publishEvent }) {
  const { tasks, runtimeState, getCurrentTask } = state;
  const { publishTaskApprovalIfPending } = approvalEngine;
  const { serialisePlanForPublic } = planBuilder;
  const { executeTaskWithRecovery, serialiseExecutionResult } = executor;
  const {
    createTask,
    getTaskById,
    appendTaskPhase,
    attachTaskToWorkView,
    completeTask,
    recoverTask,
    isRecoverableTask,
    supersedeOtherActiveTasks,
    listTasks,
    getActiveTasks,
    getLatestFinishedTask,
    getLatestFailedTask,
    buildTaskSummary,
    serialiseTask,
    reconcileRuntimeState,
  } = taskManager;

  if (req.method === "GET" && requestUrl.pathname === "/tasks/summary") {
    reconcileRuntimeState();
    sendJson(res, 200, {
      ok: true,
      summary: buildTaskSummary(),
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/active") {
    reconcileRuntimeState();
    const activeTasks = getActiveTasks();
    sendJson(res, 200, {
      ok: true,
      count: activeTasks.length,
      items: activeTasks.map((task) => serialiseTask(task)),
      summary: buildTaskSummary(),
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/current") {
    reconcileRuntimeState();
    const task = getCurrentTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "current-task",
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-finished") {
    reconcileRuntimeState();
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-finished",
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-failed") {
    reconcileRuntimeState();
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-failed",
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks") {
    const safeLimit = parseTaskLimit(requestUrl.searchParams);
    sendJson(res, 200, {
      ok: true,
      count: tasks.size,
      items: listTasks().slice(0, safeLimit),
      summary: buildTaskSummary(),
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-finished") {
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-failed") {
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(body);
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.created"), { task: serialiseTask(task) });
      await publishTaskApprovalIfPending(task);
      await publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask });
      sendJson(res, 201, { ok: true, task: serialiseTask(task) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(planTaskInput(body));
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask });
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(task),
        plan: serialisePlanForPublic(task.plan),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(planTaskInput(body, { execute: true }));
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask });

      const executionResult = await executeTaskWithRecovery(task, {
        ...body,
        actions: Array.isArray(body.actions) ? body.actions : task.plan?.steps
          ?.filter((step) => step.phase === "acting_on_target")
          .map((step) => ({ kind: step.kind, params: step.params ?? {} })),
      });
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        plan: serialisePlanForPublic(execution.task.plan),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(executionTaskInput(body));
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.created"), { task: serialiseTask(task), executor: "core-v1" });
      await publishTaskApprovalIfPending(task);
      await publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask });

      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/tasks/") && requestUrl.pathname.endsWith("/recover")) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/recover".length);
    const sourceTask = getTaskById(taskId);
    if (!sourceTask) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    if (!isRecoverableTask(sourceTask)) {
      sendJson(res, 409, { ok: false, error: "Task is not recoverable." });
      return true;
    }

    if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
      sendJson(res, 409, {
        ok: false,
        error: "Task already has a recovery task.",
        recoveredByTaskId: sourceTask.recoveredByTaskId,
        recoveredTask: serialiseTask(tasks.get(sourceTask.recoveredByTaskId)),
      });
      return true;
    }

    try {
      const recoveredTask = recoverTask(sourceTask);
      const reclaimedTasks = supersedeOtherActiveTasks(recoveredTask.id);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.created"), { task: serialiseTask(recoveredTask) });
      await publishTaskApprovalIfPending(recoveredTask);
      await publishEvent(createEventName("task.recovered"), {
        task: serialiseTask(recoveredTask),
        recoveredFromTaskId: sourceTask.id,
      });
      await publishReclaimedTasks(reclaimedTasks, { publishEvent, serialiseTask });
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(recoveredTask),
        recoveredFromTask: serialiseTask(sourceTask),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/tasks/") && requestUrl.pathname.endsWith("/execute")) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/execute".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/tasks/")) {
    const taskPath = requestUrl.pathname.slice("/tasks/".length);
    const [taskId] = taskPath.split("/");
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    sendJson(res, 200, { ok: true, task: serialiseTask(task) });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/tasks/") && requestUrl.pathname.endsWith("/phase")) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/phase".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const phase = typeof body.phase === "string" ? body.phase.trim() : "";
      if (!phase) {
        sendJson(res, 400, { ok: false, error: "Task phase is required." });
        return true;
      }

      if (typeof body.status === "string" && body.status.trim()) {
        const validTaskStatuses = new Set([
          "queued", "running", "paused", "completed", "failed", "superseded",
        ]);
        const requestedStatus = body.status.trim();
        if (!validTaskStatuses.has(requestedStatus)) {
          sendJson(res, 400, { ok: false, error: `Invalid task status: "${requestedStatus}". Allowed: ${[...validTaskStatuses].join(", ")}.` });
          return true;
        }
        task.status = requestedStatus;
      }

      const updatedTask = appendTaskPhase(task, phase, body.details ?? null);
      reconcileRuntimeState();

      await publishEvent(createEventName("task.phase_changed"), { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/tasks/") && requestUrl.pathname.endsWith("/attach-work-view")) {
    const taskId = requestUrl.pathname
      .slice("/tasks/".length, -"/attach-work-view".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = attachTaskToWorkView(task, body);
      await publishEvent(createEventName("task.running"), { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/tasks/") && requestUrl.pathname.endsWith("/complete")) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/complete".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = completeTask(task, body.details ?? null);
      await publishEvent(createEventName("task.completed"), { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  return false;
}
