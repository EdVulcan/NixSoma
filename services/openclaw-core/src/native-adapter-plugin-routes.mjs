import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

function queryOrAlias(requestUrl, key, alias, fallback = null) {
  return requestUrl.searchParams.get(key) ?? requestUrl.searchParams.get(alias) ?? fallback;
}

function searchWebQueryInput(requestUrl, fallback = null) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    query: queryOrAlias(requestUrl, "query", "q", fallback),
    limit: requestUrl.searchParams.get("limit"),
  };
}

function runtimeSearchWebInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    providerContractId: requestUrl.searchParams.get("providerContractId"),
    query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
    limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
  };
}

function workspaceIndexInput(requestUrl, fallbackQuery = null) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    scope: requestUrl.searchParams.get("scope") ?? "tools",
    query: queryOrAlias(requestUrl, "query", "q", fallbackQuery),
    limit: requestUrl.searchParams.get("limit"),
  };
}

function engineeringReadInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    relativePath: queryOrAlias(requestUrl, "relativePath", "path", "package.json"),
    startLine: queryOrAlias(requestUrl, "startLine", "start_line", "1"),
    endLine: queryOrAlias(requestUrl, "endLine", "end_line"),
    maxOutputChars: requestUrl.searchParams.get("maxOutputChars"),
    maxFileSizeBytes: requestUrl.searchParams.get("maxFileSizeBytes"),
  };
}

function engineeringGlobInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    pattern: requestUrl.searchParams.get("pattern") ?? "**/*",
    limit: requestUrl.searchParams.get("limit"),
  };
}

function engineeringGrepInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    query: queryOrAlias(requestUrl, "query", "q", "openclaw"),
    literal: requestUrl.searchParams.get("literal") ?? "true",
    caseSensitive: queryOrAlias(requestUrl, "caseSensitive", "case_sensitive", "false"),
    include: requestUrl.searchParams.get("include") ?? "**/*",
    limit: requestUrl.searchParams.get("limit"),
    maxOutputChars: requestUrl.searchParams.get("maxOutputChars"),
    maxFileSizeBytes: requestUrl.searchParams.get("maxFileSizeBytes"),
  };
}

function engineeringEditProposalInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    relativePath: queryOrAlias(requestUrl, "relativePath", "path"),
    oldString: queryOrAlias(requestUrl, "oldString", "search"),
    newString: queryOrAlias(requestUrl, "newString", "replacement", ""),
    contextLines: requestUrl.searchParams.get("contextLines"),
    maxOutputChars: requestUrl.searchParams.get("maxOutputChars"),
    maxFileSizeBytes: requestUrl.searchParams.get("maxFileSizeBytes"),
  };
}

function engineeringWriteProposalInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    relativePath: queryOrAlias(requestUrl, "relativePath", "path"),
    content: requestUrl.searchParams.get("content") ?? "",
    contentBase64: requestUrl.searchParams.get("contentBase64"),
    overwrite: requestUrl.searchParams.get("overwrite"),
    contextLines: requestUrl.searchParams.get("contextLines"),
    maxContentBytes: requestUrl.searchParams.get("maxContentBytes"),
    maxExistingFileBytes: requestUrl.searchParams.get("maxExistingFileBytes"),
  };
}

function engineeringLspEvidenceInput(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    action: requestUrl.searchParams.get("action") ?? "check",
    language: requestUrl.searchParams.get("language") ?? "typescript",
    relativePath: queryOrAlias(requestUrl, "relativePath", "path"),
    line: requestUrl.searchParams.get("line"),
    character: requestUrl.searchParams.get("character"),
    limit: requestUrl.searchParams.get("limit"),
  };
}

const GET_ROUTES = new Map([
  [
    "/plugins/native-adapter/manifest-profile",
    {
      builder: "buildNativePluginManifestProfile",
      errorStatus: 404,
      input: (requestUrl) => ({ packagePath: requestUrl.searchParams.get("packagePath") }),
    },
  ],
  [
    "/plugins/native-adapter/tool-catalog",
    {
      builder: "buildNativeOpenClawToolCatalogProfile",
      errorStatus: 404,
      input: (requestUrl) => ({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category"),
        query: queryOrAlias(requestUrl, "query", "q"),
        limit: requestUrl.searchParams.get("limit"),
      }),
    },
  ],
  [
    "/plugins/native-adapter/engineering-tool-surface",
    {
      builder: "buildNativeEngineeringToolSurfaceInventory",
      errorStatus: 404,
      input: (requestUrl) => ({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      }),
    },
  ],
  [
    "/plugins/native-adapter/engineering-read-search/read",
    {
      builder: "buildNativeEngineeringReadFile",
      errorStatus: 400,
      input: engineeringReadInput,
    },
  ],
  [
    "/plugins/native-adapter/engineering-read-search/glob",
    {
      builder: "buildNativeEngineeringGlob",
      errorStatus: 400,
      input: engineeringGlobInput,
    },
  ],
  [
    "/plugins/native-adapter/engineering-read-search/grep",
    {
      builder: "buildNativeEngineeringGrep",
      errorStatus: 400,
      input: engineeringGrepInput,
    },
  ],
  [
    "/plugins/native-adapter/engineering-edit-proposal/draft",
    {
      builder: "buildNativeEngineeringEditProposal",
      errorStatus: 400,
      input: engineeringEditProposalInput,
    },
  ],
  [
    "/plugins/native-adapter/engineering-write-proposal/draft",
    {
      builder: "buildNativeEngineeringWriteProposal",
      errorStatus: 400,
      input: engineeringWriteProposalInput,
    },
  ],
  [
    "/plugins/native-adapter/engineering-lsp/evidence",
    {
      builder: "buildNativeEngineeringLspEvidence",
      errorStatus: 400,
      input: engineeringLspEvidenceInput,
    },
  ],
  [
    "/plugins/native-adapter/plugin-manifest-map",
    {
      builder: "buildOpenClawPluginManifestMap",
      errorStatus: 404,
      input: (requestUrl) => searchWebQueryInput(requestUrl),
    },
  ],
  [
    "/plugins/native-adapter/plugin-capability-plan",
    {
      builder: "buildOpenClawPluginCapabilityPlan",
      errorStatus: 404,
      input: (requestUrl) => searchWebQueryInput(requestUrl),
    },
  ],
  [
    "/plugins/native-adapter/plugin-candidate-contract-tests",
    {
      builder: "buildOpenClawPluginCandidateContractTests",
      errorStatus: 404,
      input: (requestUrl) => ({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category") ?? "search_and_web",
        query: queryOrAlias(requestUrl, "query", "q"),
        limit: requestUrl.searchParams.get("limit"),
      }),
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-contract",
    {
      builder: "buildOpenClawPluginSearchWebAdapterContract",
      errorStatus: 404,
      input: (requestUrl) => searchWebQueryInput(requestUrl),
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-task-draft",
    {
      builder: "buildOpenClawPluginSearchWebAdapterTaskDraft",
      errorStatus: 404,
      input: (requestUrl) => ({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: queryOrAlias(requestUrl, "query", "q", "openclaw native integration"),
        limit: requestUrl.searchParams.get("limit"),
      }),
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight",
    {
      builder: "buildOpenClawPluginSearchWebAdapterRuntimePreflight",
      errorStatus: 400,
      input: runtimeSearchWebInput,
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan",
    {
      builder: "buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan",
      errorStatus: 400,
      input: runtimeSearchWebInput,
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox",
    {
      builder: "buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox",
      errorStatus: 400,
      input: runtimeSearchWebInput,
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-task-draft",
    {
      builder: "buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft",
      errorStatus: 400,
      input: runtimeSearchWebInput,
    },
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-task-draft",
    {
      builder: "buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft",
      errorStatus: 400,
      input: runtimeSearchWebInput,
    },
  ],
  [
    "/plugins/native-adapter/workspace-semantic-index",
    {
      builder: "buildNativeOpenClawWorkspaceSemanticIndex",
      errorStatus: 404,
      input: (requestUrl) => workspaceIndexInput(requestUrl),
    },
  ],
  [
    "/plugins/native-adapter/workspace-symbol-lookup",
    {
      builder: "buildNativeOpenClawWorkspaceSymbolLookup",
      errorStatus: 404,
      input: (requestUrl) => workspaceIndexInput(requestUrl, "tool"),
    },
  ],
  [
    "/plugins/native-adapter/workspace-edit-target-selection",
    {
      builder: "buildNativeOpenClawWorkspaceEditTargetSelection",
      errorStatus: 404,
      input: (requestUrl) => workspaceIndexInput(requestUrl, "edit"),
    },
  ],
  [
    "/plugins/native-adapter/prompt-semantics",
    {
      builder: "buildNativeOpenClawPromptSemanticsProfile",
      errorStatus: 404,
      input: (requestUrl) => ({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: queryOrAlias(requestUrl, "query", "q", "edit"),
        limit: requestUrl.searchParams.get("limit"),
      }),
    },
  ],
]);

const POST_TASK_ROUTES = new Map([
  [
    "/plugins/native-adapter/plugin-search-web-adapter-tasks",
    "createOpenClawPluginSearchWebAdapterTask",
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks",
    "createOpenClawPluginSearchWebAdapterRuntimeActivationTask",
  ],
  [
    "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks",
    "createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask",
  ],
]);

function searchWebTaskInput(body) {
  return {
    workspacePath: body.workspacePath,
    providerContractId: body.providerContractId,
    query: body.query ?? body.q,
    limit: body.limit,
    confirm: body.confirm,
  };
}

export async function handleNativeAdapterPluginRoute({
  req,
  res,
  requestUrl,
  pluginReview,
  serialiseTask,
  serialiseApproval,
}) {
  if (req.method === "GET") {
    const route = GET_ROUTES.get(requestUrl.pathname);
    if (!route) {
      return false;
    }
    try {
      const builder = pluginReview[route.builder];
      sendJson(res, 200, builder(route.input(requestUrl)));
    } catch (error) {
      sendError(res, route.errorStatus, error);
    }
    return true;
  }

  if (req.method === "POST") {
    const builderName = POST_TASK_ROUTES.get(requestUrl.pathname);
    if (!builderName) {
      return false;
    }
    try {
      const body = await readJsonBody(req);
      const result = await pluginReview[builderName](searchWebTaskInput(body));
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      sendError(res, 400, error);
    }
    return true;
  }

  return false;
}
