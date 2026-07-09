export const NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_REGISTRY =
  "openclaw-native-engineering-lsp-symbol-request-proposal-v0";

const SUPPORTED_ACTIONS = new Set(["definition", "references", "hover"]);

function normaliseLanguage(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "typescript";
}

function normaliseAction(value) {
  const action = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_ACTIONS.has(action) ? action : "definition";
}

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normaliseNonNegativeInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

function normaliseRelativePath(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().replaceAll("\\", "/").replace(/^\.\//u, "")
    : "src/app.ts";
}

function methodForAction(action) {
  if (action === "references") {
    return "textDocument/references";
  }
  if (action === "hover") {
    return "textDocument/hover";
  }
  return "textDocument/definition";
}

function normaliseWorkspace(workspace = {}) {
  return {
    id: workspace?.id ?? null,
    name: workspace?.name ?? null,
    path: workspace?.path ?? null,
  };
}

function recordWorkspaceMatches(record, workspacePath) {
  if (!workspacePath) {
    return true;
  }
  return record.workspace?.path === workspacePath;
}

function sourceTransferFromRecord(record = {}) {
  return record.process?.protocolHandshake?.sourceTransfer ?? null;
}

function findApprovedDidOpenState({ records, workspacePath, language, relativePath }) {
  return [...(records?.values?.() ?? [])]
    .filter((record) => record.language === language)
    .filter((record) => recordWorkspaceMatches(record, workspacePath))
    .filter((record) => record.status === "didopen_source_transfer_completed")
    .filter((record) => record.boundaries?.sourceContentTransferred === true)
    .filter((record) => record.boundaries?.jsonRpcOperationalRequestsEnabled === false)
    .filter((record) => sourceTransferFromRecord(record)?.relativePath === relativePath)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] ?? null;
}

function buildGovernance({ ready }) {
  return {
    mode: "native_engineering_lsp_symbol_request_proposal_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadLifecycleState: true,
    canDraftSymbolRequest: true,
    canSendSymbolRequest: false,
    canStartLspServer: false,
    canReuseLongLivedProcess: false,
    canMutateWorkspace: false,
    canCreateTask: false,
    canCreateApproval: false,
    canCallProvider: false,
    futureSymbolRequestRequiresApproval: true,
    approvedDidOpenStateRequired: true,
    readyForApprovalTask: ready,
    observerVisible: true,
  };
}

export function createNativeEngineeringLspSymbolRequestProposalBuilders({
  records,
  selectOpenClawToolCatalogWorkspace,
} = {}) {
  function buildNativeEngineeringLspSymbolRequestProposal({
    workspacePath = null,
    language = "typescript",
    action = "definition",
    relativePath = "src/app.ts",
    line = 1,
    character = 0,
  } = {}) {
    const safeLanguage = normaliseLanguage(language);
    const safeAction = normaliseAction(action);
    const safeRelativePath = normaliseRelativePath(relativePath);
    const safeLine = normalisePositiveInteger(line, 1, 1_000_000);
    const safeCharacter = normaliseNonNegativeInteger(character, 0, 100_000);
    const workspace = workspacePath
      ? selectOpenClawToolCatalogWorkspace({ workspacePath }).item
      : null;
    const didOpenState = findApprovedDidOpenState({
      records,
      workspacePath: workspace?.path ?? workspacePath,
      language: safeLanguage,
      relativePath: safeRelativePath,
    });
    const sourceTransfer = sourceTransferFromRecord(didOpenState ?? {});
    const ready = Boolean(didOpenState && sourceTransfer?.uri);
    const method = methodForAction(safeAction);
    const generatedAt = new Date().toISOString();
    const summary = {
      action: safeAction,
      method,
      language: safeLanguage,
      relativePath: safeRelativePath,
      sourceTransferStateFound: ready,
      symbolRequestSent: false,
      approvalRequiredBeforeSymbolRequest: true,
    };

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_REGISTRY,
      mode: "lsp-symbol-request-proposal-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_lsp",
        intendedNativeCapabilityId: "plan.openclaw.engineering_tool.lsp_symbol_request",
        migrationMode: "symbol_request_proposal_without_json_rpc",
      },
      capability: {
        id: "plan.openclaw.engineering_tool.lsp_symbol_request",
        sourceToolName: "cc_lsp",
        operationClass: "lsp_symbol_request_proposal",
        risk: "medium",
        approvalRequiredForRequest: true,
        approvalRequiredForProposal: false,
      },
      workspace: normaliseWorkspace(workspace ?? didOpenState?.workspace ?? {}),
      prerequisite: {
        requiredStatus: "didopen_source_transfer_completed",
        found: ready,
        sourceTaskId: didOpenState?.sourceTaskId ?? null,
        sourceApprovalId: didOpenState?.sourceApprovalId ?? null,
        server: {
          serverBinary: didOpenState?.server?.serverBinary ?? null,
          serverArgs: didOpenState?.server?.serverArgs ?? [],
        },
        sourceTransfer,
      },
      proposedJsonRpc: {
        method,
        sent: false,
        params: ready
          ? {
              textDocument: { uri: sourceTransfer.uri },
              position: {
                line: Math.max(0, safeLine - 1),
                character: safeCharacter,
              },
              context: safeAction === "references" ? { includeDeclaration: true } : undefined,
            }
          : null,
      },
      query: {
        action: safeAction,
        language: safeLanguage,
        relativePath: safeRelativePath,
        line: safeLine,
        character: safeCharacter,
      },
      bounds: {
        requiresApprovedDidOpenState: true,
        noSourceContentReturned: true,
        noLspServerStart: true,
        noLongLivedProcessPool: true,
        noJsonRpcSent: true,
        noSymbolRequestSent: true,
        noWorkspaceMutation: true,
        noProviderCall: true,
      },
      governance: buildGovernance({ ready }),
      auditEvidence: {
        operation: "lsp_symbol_request_proposal",
        capabilityId: "plan.openclaw.engineering_tool.lsp_symbol_request",
        generatedAt,
        persisted: false,
        evidenceKind: "response_embedded_symbol_request_proposal",
        summary,
      },
      summary,
      deferredExecutionBoundaries: [
        "no definition/references/hover JSON-RPC request sent",
        "no long-lived LSP process pool",
        "no task creation",
        "no approval creation",
        "no workspace mutation",
        "no provider call",
      ],
      nextSmallestRealCapability: "approval-gated LSP symbol request task after operator inspection",
    };
  }

  return {
    buildNativeEngineeringLspSymbolRequestProposal,
  };
}
