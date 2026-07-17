import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const ROUTE = "/plugins/native-adapter/declarative-evolution/staging-tasks";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function handleNativeDeclarativeEvolutionTaskRoute({
  req,
  res,
  requestUrl,
  planBuilder,
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  if (req.method !== "POST" || requestUrl.pathname !== ROUTE) {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const result = await planBuilder.createNativeDeclarativeEvolutionStagingTask({
      changes: body.changes,
      confirm: body.confirm === true,
    });
    sendJson(res, 201, {
      ok: true,
      registry: result.registry,
      mode: result.mode,
      generatedAt: result.generatedAt,
      candidate: result.candidate,
      stagingDirectory: result.stagingDirectory,
      approvalBinding: result.approvalBinding,
      task: serialiseTask(result.task),
      approval: serialiseApproval(result.approval),
      governance: result.governance,
      summary: buildTaskSummary(),
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: errorMessage(error) });
  }
  return true;
}
