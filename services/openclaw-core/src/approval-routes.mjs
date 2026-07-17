import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

function parseApprovalLimit(searchParams) {
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  return Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
}

function approvalIdFromPath(pathname, suffix) {
  return pathname.slice("/approvals/".length, -suffix.length);
}

export async function handleApprovalRoute({ req, res, requestUrl, state, approvalEngine, taskManager, publishEvent }) {
  const {
    serialiseApproval,
    listApprovals,
    buildApprovalSummary,
    markApprovalApproved,
    markApprovalDenied,
  } = approvalEngine;
  const { serialiseTask } = taskManager;

  if (req.method === "GET" && requestUrl.pathname === "/approvals") {
    const status = requestUrl.searchParams.get("status") || null;
    const safeLimit = parseApprovalLimit(requestUrl.searchParams);
    const items = listApprovals()
      .filter((approval) => !status || approval.status === status)
      .slice(0, safeLimit);
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: buildApprovalSummary(),
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/approvals/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: buildApprovalSummary(),
    });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/approve")) {
    const approvalId = approvalIdFromPath(requestUrl.pathname, "/approve");
    const approval = state.approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return true;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const operatorActor = req.openclawOperator?.actor;
      if (!operatorActor) {
        sendJson(res, 401, { ok: false, error: "Authenticated operator identity is required." });
        return true;
      }
      const result = markApprovalApproved(approval, {
        approvedBy: operatorActor,
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Approved by user.",
      });
      await publishEvent(createEventName("approval.approved"), {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/deny")) {
    const approvalId = approvalIdFromPath(requestUrl.pathname, "/deny");
    const approval = state.approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return true;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const operatorActor = req.openclawOperator?.actor;
      if (!operatorActor) {
        sendJson(res, 401, { ok: false, error: "Authenticated operator identity is required." });
        return true;
      }
      const result = markApprovalDenied(approval, {
        deniedBy: operatorActor,
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Denied by user.",
      });
      await publishEvent(createEventName("approval.denied"), {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      if (result.task?.status === "failed") {
        await publishEvent(createEventName("task.failed"), {
          task: serialiseTask(result.task),
          reason: "Approval denied by user.",
          approval: serialiseApproval(result.approval),
        });
      }
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return true;
  }

  return false;
}
