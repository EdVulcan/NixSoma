import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const ROUTE = "/plugins/native-adapter/declarative-evolution/staging-tasks";
const ACTIVATION_DECISION_ROUTE = "/plugins/native-adapter/declarative-evolution/activation-decisions";
const ACTIVATION_ROUTE = "/plugins/native-adapter/declarative-evolution/activation-tasks";
const ACTIVATION_REVIEW_ROUTE = "/plugins/native-adapter/declarative-evolution/activation-decision";

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
  if (req.method === "GET" && requestUrl.pathname === ACTIVATION_REVIEW_ROUTE) {
    try {
      const result = await planBuilder.buildNativeDeclarativeEvolutionActivationDecisionReview({
        taskId: requestUrl.searchParams.get("taskId"),
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: errorMessage(error) });
    }
    return true;
  }

  if (req.method !== "POST" || ![ROUTE, ACTIVATION_DECISION_ROUTE, ACTIVATION_ROUTE].includes(requestUrl.pathname)) {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const result = requestUrl.pathname === ACTIVATION_DECISION_ROUTE
      ? await planBuilder.createNativeDeclarativeEvolutionActivationDecisionTask({
        taskId: body.taskId,
        decision: body.decision,
        confirm: body.confirm === true,
      })
      : requestUrl.pathname === ACTIVATION_ROUTE
        ? await planBuilder.createNativeDeclarativeEvolutionActivationTask({
          activationDecisionTaskId: body.activationDecisionTaskId,
          confirm: body.confirm === true,
        })
        : await planBuilder.createNativeDeclarativeEvolutionStagingTask({
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
      review: result.review,
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
