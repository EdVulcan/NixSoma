export const observerClientEngineeringLspRenderersScript = `function renderEngineeringLspEvidence(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const server = data?.serverReadiness ?? {};
  const detected = Array.isArray(summary.detectedLanguages) ? summary.detectedLanguages : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringLspRegistry.textContent = data?.registry ?? "openclaw-native-engineering-lsp-evidence-v0";
  engineeringLspLanguages.textContent = detected.length ? detected.join(",") : "none";
  engineeringLspServer.textContent = server.status ?? "not_checked";
  engineeringLspRuntime.textContent = governance.canStartLspServer ? "enabled" : "blocked";
  engineeringLspMode.textContent = data?.mode ?? "lsp-contract-and-availability-evidence-only";

  engineeringLspJson.textContent = [
    "Native engineering LSP evidence: maps cc_lsp check, definition, references, and hover contracts into governed OpenClaw availability evidence.",
    "This endpoint scans bounded workspace metadata only. It does not check server binaries, start language servers, read file contents into LSP, send JSON-RPC, mutate files, create tasks, create approvals, or call providers.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-lsp-evidence-v0"}\`,
    \`Mode: \${data?.mode ?? "lsp-contract-and-availability-evidence-only"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_tool.lsp_evidence"} risk=\${data?.capability?.risk ?? "medium"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Query: action=\${data?.query?.action ?? "check"} language=\${data?.query?.language ?? "typescript"} path=\${data?.query?.relativePath ?? "none"} line=\${data?.query?.line ?? "n/a"} character=\${data?.query?.character ?? "n/a"} limit=\${data?.query?.limit ?? 100}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Languages: detected=\${detected.join(",") || "none"} selectedFiles=\${summary.selectedLanguageFiles ?? 0} configFiles=\${summary.configFilesPresent ?? 0} filesScanned=\${data?.languageSignals?.counters?.filesScanned ?? 0} dirsSkipped=\${data?.languageSignals?.counters?.directoriesSkipped ?? 0}\`,
    \`Server: language=\${server.language ?? "typescript"} binary=\${server.serverBinary ?? "typescript-language-server"} status=\${server.status ?? "not_checked"} reason=\${server.reason ?? "command_execution_deferred"} start=\${Boolean(server.canStartServer)} jsonRpc=\${Boolean(server.canSendJsonRpcRequest)}\`,
    \`Governance: metadata=\${Boolean(governance.canReadWorkspaceMetadata)} content=\${Boolean(governance.canReadSourceFileContent)} checkBinary=\${Boolean(governance.canCheckServerBinary)} start=\${Boolean(governance.canStartLspServer)} openFile=\${Boolean(governance.canOpenFileInServer)} jsonRpc=\${Boolean(governance.canSendJsonRpcRequest)} execute=\${Boolean(governance.canExecuteCommand)} mutate=\${Boolean(governance.canMutate)} provider=\${Boolean(governance.canCallProvider)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "lsp_evidence"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...(data?.actionContracts ?? []).map((contract) => \`\${contract.action}: \${contract.operationClass} boundary=\${contract.nativeBoundary}\`),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
