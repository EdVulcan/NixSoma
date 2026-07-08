import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

function parseJsonParam(requestUrl, name) {
  const value = requestUrl.searchParams.get(name);
  return value ? JSON.parse(value) : null;
}

function parseIntegerParam(requestUrl, name, fallback) {
  return Number.parseInt(requestUrl.searchParams.get(name) ?? String(fallback), 10);
}

function serialiseDraftEnvelope(draft, serialisePlanForPublic) {
  return {
    ok: true,
    ...draft,
    draft: {
      ...draft.draft,
      plan: serialisePlanForPublic(draft.draft.plan),
    },
  };
}

function bodyString(body, key, fallback) {
  return typeof body[key] === "string" ? body[key] : fallback;
}

function bodyInteger(body, key, fallback) {
  return Number.isInteger(body[key]) ? body[key] : fallback;
}

function serialiseWorkspaceTaskResponse(result, extraFields, { serialiseTask, serialiseApproval, buildTaskSummary }) {
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

function patchDraftInputFromQuery(requestUrl) {
  const proposalQuery = requestUrl.searchParams.get("proposalQuery") ?? "edit";
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    relativePath: requestUrl.searchParams.get("relativePath") ?? null,
    search: requestUrl.searchParams.get("search") ?? "before",
    replacement: requestUrl.searchParams.get("replacement") ?? "after",
    occurrence: parseIntegerParam(requestUrl, "occurrence", 1),
    edits: parseJsonParam(requestUrl, "edits"),
    contextLines: parseIntegerParam(requestUrl, "contextLines", 1),
    proposal: parseJsonParam(requestUrl, "proposal"),
    deriveProposalFromSource: requestUrl.searchParams.get("deriveProposalFromSource") === "true",
    proposalQuery,
    selectTargetFromSource: requestUrl.searchParams.get("selectTargetFromSource") === "true",
    targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? proposalQuery,
    targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
  };
}

function patchTaskInputFromBody(body) {
  const proposalQuery = bodyString(body, "proposalQuery", "edit");
  return {
    workspacePath: bodyString(body, "workspacePath", null),
    relativePath: bodyString(body, "relativePath", null),
    search: bodyString(body, "search", ""),
    replacement: bodyString(body, "replacement", ""),
    occurrence: bodyInteger(body, "occurrence", 1),
    edits: Array.isArray(body.edits) ? body.edits : null,
    contextLines: bodyInteger(body, "contextLines", 1),
    proposal: body.proposal && typeof body.proposal === "object" ? body.proposal : null,
    deriveProposalFromSource: body.deriveProposalFromSource === true,
    proposalQuery,
    selectTargetFromSource: body.selectTargetFromSource === true,
    targetSelectionQuery: bodyString(body, "targetSelectionQuery", proposalQuery),
    targetSelectionScope: bodyString(body, "targetSelectionScope", "tools"),
    confirm: body.confirm === true,
  };
}

function sourceAuthoredDraftInputFromQuery(requestUrl) {
  const proposalQuery = requestUrl.searchParams.get("proposalQuery") ?? "edit";
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    search: requestUrl.searchParams.get("search") ?? "before",
    replacement: requestUrl.searchParams.get("replacement") ?? "after",
    occurrence: parseIntegerParam(requestUrl, "occurrence", 1),
    edits: parseJsonParam(requestUrl, "edits"),
    contextLines: parseIntegerParam(requestUrl, "contextLines", 0),
    proposalQuery,
    targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? proposalQuery,
    targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
  };
}

function sourceAuthoredTaskInputFromBody(body) {
  const proposalQuery = bodyString(body, "proposalQuery", "edit");
  return {
    workspacePath: bodyString(body, "workspacePath", null),
    search: bodyString(body, "search", ""),
    replacement: bodyString(body, "replacement", ""),
    occurrence: bodyInteger(body, "occurrence", 1),
    edits: Array.isArray(body.edits) ? body.edits : null,
    contextLines: bodyInteger(body, "contextLines", 0),
    proposalQuery,
    targetSelectionQuery: bodyString(body, "targetSelectionQuery", proposalQuery),
    targetSelectionScope: bodyString(body, "targetSelectionScope", "tools"),
    confirm: body.confirm === true,
  };
}

export async function handleWorkspaceNativeOpsRoute({
  req,
  res,
  requestUrl,
  workspaceOps,
  serialisePlanForPublic,
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write/draft") {
    try {
      const draft = workspaceOps.buildNativeOpenClawWorkspaceTextWriteDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        relativePath: requestUrl.searchParams.get("relativePath") ?? "scratch/native-write.txt",
        content: "hello from openclaw native workspace text write\n",
        overwrite: requestUrl.searchParams.get("overwrite") !== "false",
      });
      sendJson(res, 200, serialiseDraftEnvelope(draft, serialisePlanForPublic));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await workspaceOps.createNativeOpenClawWorkspaceTextWriteTask({
        workspacePath: bodyString(body, "workspacePath", null),
        relativePath: bodyString(body, "relativePath", "scratch/native-write.txt"),
        content: bodyString(body, "content", ""),
        overwrite: body.overwrite !== false,
        confirm: body.confirm === true,
      });
      sendJson(res, 201, serialiseWorkspaceTaskResponse(result, ["capability", "workspace", "target"], {
        serialiseTask,
        serialiseApproval,
        buildTaskSummary,
      }));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply/draft") {
    try {
      const draft = workspaceOps.buildNativeOpenClawWorkspacePatchApplyDraft(patchDraftInputFromQuery(requestUrl));
      sendJson(res, 200, serialiseDraftEnvelope(draft, serialisePlanForPublic));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await workspaceOps.createNativeOpenClawWorkspacePatchApplyTask(patchTaskInputFromBody(body));
      sendJson(res, 201, serialiseWorkspaceTaskResponse(result, [
        "capability",
        "workspace",
        "target",
        "validation",
        "proposal",
        "proposalSourceSignals",
        "targetSelection",
        "edits",
        "diffPreview",
      ], { serialiseTask, serialiseApproval, buildTaskSummary }));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit/draft") {
    try {
      const draft = workspaceOps.buildOpenClawSourceAuthoredEditDraft(sourceAuthoredDraftInputFromQuery(requestUrl));
      sendJson(res, 200, serialiseDraftEnvelope(draft, serialisePlanForPublic));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await workspaceOps.createOpenClawSourceAuthoredEditTask(sourceAuthoredTaskInputFromBody(body));
      sendJson(res, 201, serialiseWorkspaceTaskResponse(result, [
        "sourceAuthoredEdit",
        "capability",
        "workspace",
        "target",
        "validation",
        "proposal",
        "proposalSourceSignals",
        "targetSelection",
        "edits",
        "diffPreview",
      ], { serialiseTask, serialiseApproval, buildTaskSummary }));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals/plan") {
    try {
      const draft = workspaceOps.buildWorkspaceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
      });
      sendJson(res, 200, { ok: true, ...draft });
    } catch (error) {
      sendError(res, 404, error);
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/plan") {
    try {
      const draft = workspaceOps.buildOpenClawSourceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? "command",
      });
      sendJson(res, 200, { ok: true, ...draft });
    } catch (error) {
      sendError(res, 404, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await workspaceOps.createOpenClawSourceCommandTask({
        proposalId: bodyString(body, "proposalId", null),
        workspaceId: bodyString(body, "workspaceId", null),
        scriptName: bodyString(body, "scriptName", null),
        workspacePath: bodyString(body, "workspacePath", null),
        query: bodyString(body, "query", "command"),
        confirm: body.confirm === true,
      });
      sendJson(res, 201, serialiseWorkspaceTaskResponse(result, [
        "sourceMode",
        "sourceCommandProposal",
        "sourceCommandSignals",
        "sourceCommandPlan",
        "sourceCommandTask",
        "workspaceCommandTask",
      ], { serialiseTask, serialiseApproval, buildTaskSummary }));
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/workspaces/command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await workspaceOps.createWorkspaceCommandTask({
        proposalId: bodyString(body, "proposalId", null),
        workspaceId: bodyString(body, "workspaceId", null),
        scriptName: bodyString(body, "scriptName", null),
        confirm: body.confirm === true,
      });
      sendJson(res, 201, serialiseWorkspaceTaskResponse(result, ["proposal"], {
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
