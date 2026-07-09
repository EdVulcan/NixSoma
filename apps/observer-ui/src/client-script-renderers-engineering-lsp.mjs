export const observerClientEngineeringLspRenderersScript = `function renderEngineeringLspEvidence(payload) {
  const data = payload?.evidence ?? payload ?? {};
  const lifecycleDraft = payload?.lifecycleDraft ?? null;
  const sourceTransferProposal = payload?.sourceTransferProposal ?? null;
  const symbolRequestProposal = payload?.symbolRequestProposal ?? null;
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const server = data?.serverReadiness ?? {};
  const draftSummary = lifecycleDraft?.summary ?? {};
  const draftGovernance = lifecycleDraft?.governance ?? {};
  const draft = lifecycleDraft?.lifecycleDraft ?? {};
  const sourceSummary = sourceTransferProposal?.summary ?? {};
  const sourceFile = sourceTransferProposal?.file ?? {};
  const sourceGovernance = sourceTransferProposal?.governance ?? {};
  const proposedDidOpen = sourceTransferProposal?.proposedDidOpen ?? {};
  const symbolSummary = symbolRequestProposal?.summary ?? {};
  const symbolGovernance = symbolRequestProposal?.governance ?? {};
  const proposedSymbolRequest = symbolRequestProposal?.proposedJsonRpc ?? {};
  const detected = Array.isArray(summary.detectedLanguages) ? summary.detectedLanguages : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  const draftGates = Array.isArray(lifecycleDraft?.readinessGates) ? lifecycleDraft.readinessGates : [];
  const draftDeferred = Array.isArray(lifecycleDraft?.deferredExecutionBoundaries) ? lifecycleDraft.deferredExecutionBoundaries : [];
  const sourceDeferred = Array.isArray(sourceTransferProposal?.deferredExecutionBoundaries) ? sourceTransferProposal.deferredExecutionBoundaries : [];
  const symbolDeferred = Array.isArray(symbolRequestProposal?.deferredExecutionBoundaries) ? symbolRequestProposal.deferredExecutionBoundaries : [];
  engineeringLspRegistry.textContent = data?.registry ?? "openclaw-native-engineering-lsp-evidence-v0";
  engineeringLspLanguages.textContent = detected.length ? detected.join(",") : "none";
  engineeringLspServer.textContent = server.status ?? "not_checked";
  engineeringLspRuntime.textContent = lifecycleDraft ? \`draft:\${draft.lifecycleAction ?? "start"}\` : (governance.canStartLspServer ? "enabled" : "blocked");
  engineeringLspMode.textContent = [
    data?.mode ?? "lsp-contract-and-availability-evidence-only",
    lifecycleDraft ? lifecycleDraft.mode ?? "lsp-lifecycle-readiness-draft-only" : null,
    sourceTransferProposal ? sourceTransferProposal.mode ?? "lsp-didopen-source-transfer-proposal-only" : null,
    symbolRequestProposal ? symbolRequestProposal.mode ?? "lsp-symbol-request-proposal-only" : null,
  ].filter(Boolean).join(" + ");

  engineeringLspJson.textContent = [
    "Native engineering LSP evidence: maps cc_lsp check, definition, references, hover, lifecycle readiness, source transfer, and symbol request proposal into governed OpenClaw evidence.",
    "The source-transfer proposal reads one bounded workspace source file locally for preview/hash only. The symbol-request proposal reads approved didOpen state only. These proposal endpoints do not start language servers, send symbol requests, mutate files, create tasks, create approvals, or call providers.",
    "Approved source-transfer tasks may send didOpen only after explicit approval. Approved symbol-request tasks may send exactly one definition/references/hover request through a short-lived LSP process; long-lived pools remain deferred.",
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
    lifecycleDraft ? "" : null,
    lifecycleDraft ? \`Lifecycle draft: registry=\${lifecycleDraft.registry ?? "unknown"} mode=\${lifecycleDraft.mode ?? "unknown"} action=\${draft.lifecycleAction ?? "start"} status=\${draft.status ?? "draft_only"}\` : null,
    lifecycleDraft ? \`Lifecycle server: language=\${draft.server?.language ?? "typescript"} binary=\${draft.server?.serverBinary ?? "typescript-language-server"} checked=\${Boolean(draft.server?.binaryChecked)} started=\${Boolean(draft.server?.processStarted)} jsonRpc=\${Boolean(draft.server?.jsonRpcHandshakeSent)}\` : null,
    lifecycleDraft ? \`Lifecycle readiness: files=\${draftSummary.selectedLanguageFiles ?? 0} config=\${draftSummary.configFilesPresent ?? 0} passed=\${draftSummary.gatesPassed ?? 0} deferred=\${draftSummary.gatesDeferred ?? 0} executionReady=\${Boolean(draftSummary.executionReady)} taskNow=\${Boolean(draftSummary.canCreateTaskNow)}\` : null,
    lifecycleDraft ? \`Lifecycle governance: draft=\${Boolean(draftGovernance.canDraftLifecycleAction)} checkBinary=\${Boolean(draftGovernance.canCheckServerBinary)} start=\${Boolean(draftGovernance.canStartLspServer)} task=\${Boolean(draftGovernance.canCreateTask)} approval=\${Boolean(draftGovernance.canCreateApproval)} jsonRpc=\${Boolean(draftGovernance.canSendJsonRpcRequest)} futureApproval=\${Boolean(draftGovernance.futureLifecycleExecutionRequiresApproval)}\` : null,
    sourceTransferProposal ? "" : null,
    sourceTransferProposal ? \`Source transfer proposal: registry=\${sourceTransferProposal.registry ?? "unknown"} mode=\${sourceTransferProposal.mode ?? "unknown"} path=\${sourceFile.relativePath ?? "none"} language=\${sourceFile.languageId ?? "typescript"}\` : null,
    sourceTransferProposal ? \`Source file: bytes=\${sourceSummary.textBytes ?? 0} lines=\${sourceSummary.lineCount ?? 0} sha256=\${sourceSummary.textSha256 ?? "missing"} previewChars=\${sourceSummary.previewChars ?? 0} truncated=\${Boolean(sourceSummary.previewTruncated)}\` : null,
    sourceTransferProposal ? \`Proposed didOpen: method=\${proposedDidOpen.method ?? "textDocument/didOpen"} sent=\${Boolean(proposedDidOpen.sent)} uri=\${sourceFile.uri ?? "missing"}\` : null,
    sourceTransferProposal ? \`Source governance: localRead=\${Boolean(sourceGovernance.canReadWorkspaceSourceForProposal)} transfer=\${Boolean(sourceGovernance.canTransferSourceContentToLsp)} didOpen=\${Boolean(sourceGovernance.canSendDidOpen)} symbols=\${Boolean(sourceGovernance.canSendSymbolRequests)} start=\${Boolean(sourceGovernance.canStartLspServer)} futureApproval=\${Boolean(sourceGovernance.futureSourceTransferRequiresApproval)}\` : null,
    symbolRequestProposal ? "" : null,
    symbolRequestProposal ? \`Symbol request proposal: registry=\${symbolRequestProposal.registry ?? "unknown"} mode=\${symbolRequestProposal.mode ?? "unknown"} action=\${symbolSummary.action ?? "definition"} ready=\${Boolean(symbolSummary.sourceTransferStateFound)}\` : null,
    symbolRequestProposal ? \`Proposed symbol JSON-RPC: method=\${proposedSymbolRequest.method ?? "textDocument/definition"} sent=\${Boolean(proposedSymbolRequest.sent)} approval=\${Boolean(symbolSummary.approvalRequiredBeforeSymbolRequest)}\` : null,
    symbolRequestProposal ? \`Symbol governance: draft=\${Boolean(symbolGovernance.canDraftSymbolRequest)} send=\${Boolean(symbolGovernance.canSendSymbolRequest)} start=\${Boolean(symbolGovernance.canStartLspServer)} futureApproval=\${Boolean(symbolGovernance.futureSymbolRequestRequiresApproval)} readyTask=\${Boolean(symbolGovernance.readyForApprovalTask)}\` : null,
    "",
    ...(data?.actionContracts ?? []).map((contract) => \`\${contract.action}: \${contract.operationClass} boundary=\${contract.nativeBoundary}\`),
    lifecycleDraft ? "" : null,
    ...draftGates.map((gate) => \`lifecycle gate: \${gate.id} status=\${gate.status} required=\${Boolean(gate.requiredForExecution)}\`),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
    ...draftDeferred.map((boundary) => \`lifecycle deferred: \${boundary}\`),
    ...sourceDeferred.map((boundary) => \`source-transfer deferred: \${boundary}\`),
    ...symbolDeferred.map((boundary) => \`symbol-request deferred: \${boundary}\`),
  ].filter((line) => line !== null).join("\\n");
}

`;
