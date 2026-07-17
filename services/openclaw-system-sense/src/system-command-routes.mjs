import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";

export async function handleSystemCommandRoutes({
  req,
  res,
  requestUrl,
  publishEvent,
  publishAuditEvent = publishEvent,
  operations,
}) {
  if (req.method === "GET" && requestUrl.pathname === "/system/processes") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = await operations.listProcesses({
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "",
        limit,
      });
      await publishEvent(createEventName("system.processes.listed"), {
        count: result.count,
        query: result.query,
      });
      sendJson(res, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 500, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/dry-run") {
    try {
      const body = await readJsonBody(req);
      const plan = operations.buildCommandDryRun(body);
      await publishEvent(createEventName("system.command.planned"), { plan });
      sendJson(res, 200, {
        ok: true,
        plan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/execute") {
    try {
      const body = await readJsonBody(req);
      await publishAuditEvent(createEventName("system.command.execute_requested"), {
        command: body.command ?? null,
        argsCount: Array.isArray(body.args) ? body.args.length : 0,
        cwd: body.cwd ?? body.workingDirectory ?? null,
      });
      const execution = await operations.executeCommand(body);
      await publishEvent(createEventName("system.command.executed"), {
        command: execution.command,
        cwd: execution.cwd,
        exitCode: execution.result.exitCode,
        timedOut: execution.result.timedOut,
        durationMs: execution.result.durationMs,
      });
      sendJson(res, 200, {
        ok: true,
        execution,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return true;
  }

  return false;
}
