export const observerClientAcpxCodexBridgeRenderersScript = `function renderAcpxCodexBridgeCompatibility(data) {
  const compatibility = data?.compatibility ?? {};
  const authIsolation = data?.authIsolation ?? {};
  const persistence = data?.persistence ?? {};
  const governance = data?.governance ?? {};
  const wrapperDraft = data?.wrapperDraft ?? null;
  const draftSummary = wrapperDraft?.summary ?? {};
  const draftProposal = wrapperDraft?.proposal ?? {};
  const draftGovernance = wrapperDraft?.governance ?? {};
  const wrapperWriteProposal = data?.wrapperWriteProposal ?? null;
  const writeProposal = wrapperWriteProposal?.proposal ?? {};
  const writeGovernance = wrapperWriteProposal?.governance ?? {};
  const wrapperWriteExecutionEvidence = data?.wrapperWriteExecutionEvidence ?? null;
  const writeEvidenceSummary = wrapperWriteExecutionEvidence?.summary ?? {};
  const writeRecovery = wrapperWriteExecutionEvidence?.recoveryRecommendation ?? {};
  const latestWriteEvidence = Array.isArray(wrapperWriteExecutionEvidence?.evidence) ? wrapperWriteExecutionEvidence.evidence[0] : null;
  const processSpawnProposal = data?.processSpawnProposal ?? null;
  const spawnProposal = processSpawnProposal?.proposal ?? {};
  const spawnSummary = processSpawnProposal?.summary ?? {};
  const spawnGovernance = processSpawnProposal?.governance ?? {};
  const liveExecutionBoundaryReview = data?.liveExecutionBoundaryReview ?? null;
  const liveDecision = liveExecutionBoundaryReview?.decision ?? {};
  const records = Array.isArray(persistence.records) ? persistence.records : [];
  const selected = persistence.selectedRecord ?? null;
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  const draftDeferred = Array.isArray(wrapperDraft?.deferredExecutionBoundaries) ? wrapperDraft.deferredExecutionBoundaries : [];
  const writeDeferred = Array.isArray(wrapperWriteProposal?.deferredExecutionBoundaries) ? wrapperWriteProposal.deferredExecutionBoundaries : [];
  const writeEvidenceDeferred = Array.isArray(wrapperWriteExecutionEvidence?.deferredExecutionBoundaries) ? wrapperWriteExecutionEvidence.deferredExecutionBoundaries : [];
  const spawnDeferred = Array.isArray(processSpawnProposal?.deferredExecutionBoundaries) ? processSpawnProposal.deferredExecutionBoundaries : [];
  const liveDeferred = Array.isArray(liveExecutionBoundaryReview?.deferredExecutionBoundaries) ? liveExecutionBoundaryReview.deferredExecutionBoundaries : [];

  acpxCodexBridgeRegistry.textContent = data?.registry ?? "openclaw-native-acpx-codex-bridge-compatibility-v0";
  acpxCodexBridgeSessions.textContent = String(persistence.totalRecords ?? records.length);
  acpxCodexBridgeSelected.textContent = selected?.sessionKey ?? persistence.selectedSessionKey ?? "none";
  acpxCodexBridgeDraft.textContent = draftSummary.readyForApprovalBridge ? "ready" : (draftProposal.status ?? "blocked");
  acpxCodexBridgeAuth.textContent = authIsolation.credentialValueRead ? "credential-read" : "isolated";
  acpxCodexBridgeRuntime.textContent = governance.canSpawnCodexAcp || governance.canExecuteWrapper ? "enabled" : "blocked";
  acpxCodexBridgeWriteEvidence.textContent = \`\${writeEvidenceSummary.passed ?? 0}/\${writeEvidenceSummary.total ?? 0}\`;
  acpxCodexBridgeRecovery.textContent = writeRecovery.needed ? (writeRecovery.status ?? "review") : "not needed";
  acpxCodexBridgeSpawnProposal.textContent = spawnSummary.readyForSpawnApprovalDesign ? "ready" : (spawnProposal.status ?? "blocked");
  acpxCodexBridgeLiveBoundary.textContent = liveDecision.status ?? "blocked";
  acpxCodexBridgeMode.textContent = data?.mode ?? "compatibility-and-persistence-evidence";

  acpxCodexBridgeJson.textContent = [
    "ACPX/Codex bridge compatibility: maps enhanced bridge lessons into OpenClaw-native compatibility and session persistence evidence.",
    "Read models do not read CODEX_HOME, read auth.json/config.toml, copy auth material, chmod wrappers, execute npx/npx.cmd, spawn ACP/Codex, call providers, or use network egress. Wrapper files are written only through the separate approval-gated workspace_text_write bridge.",
    \`Registry: \${data?.registry ?? "openclaw-native-acpx-codex-bridge-compatibility-v0"}\`,
    \`Mode: \${data?.mode ?? "compatibility-and-persistence-evidence"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.auditEvidence?.capabilityId ?? "sense.openclaw.acpx_codex_bridge.compatibility"}\`,
    \`Compatibility: runtime=\${compatibility.currentRuntimeSubject ?? "unknown"} target=\${compatibility.targetBridge ?? "unknown"} posix=\${compatibility.posixCommand ?? "unknown"} windowsLesson=\${compatibility.windowsCommandLesson ?? "unknown"} override=\${Boolean(compatibility.commandOverrideSupportedByContract)} wrapperDrafted=\${Boolean(compatibility.wrapperCommandDrafted)} wrapperWritten=\${Boolean(compatibility.wrapperWritten)} processSpawned=\${Boolean(compatibility.codexAcpProcessSpawned)}\`,
    \`Auth: CODEX_HOME=\${Boolean(authIsolation.sourceCodexHomeRead)} authJson=\${Boolean(authIsolation.authJsonRead)} configToml=\${Boolean(authIsolation.configTomlRead)} copied=\${Boolean(authIsolation.authMaterialCopied)} credentialValue=\${Boolean(authIsolation.credentialValueRead)} secretWrapper=\${Boolean(authIsolation.secretValuesEmbeddedInWrapper)}\`,
    \`Persistence: registry=\${persistence.registry ?? "openclaw-native-acpx-codex-session-persistence-v0"} ready=\${Boolean(persistence.storeReady)} records=\${persistence.totalRecords ?? records.length}/\${persistence.maxRecords ?? "n/a"} selected=\${selected?.sessionKey ?? persistence.selectedSessionKey ?? "none"} missingNull=\${Boolean(persistence.missingSessionReturnsNull)} overwrite=\${Boolean(persistence.supportsOverwrite)} independent=\${Boolean(persistence.supportsIndependentSessions)}\`,
    \`Governance: persist=\${Boolean(governance.canPersistSessionMetadata)} credentialRead=\${Boolean(governance.canReadCredentialValue)} authCopy=\${Boolean(governance.canCopyAuthMaterial)} wrapperWrite=\${Boolean(governance.canWriteWrapper)} wrapperExec=\${Boolean(governance.canExecuteWrapper)} spawn=\${Boolean(governance.canSpawnCodexAcp)} provider=\${Boolean(governance.canCallProvider)} network=\${Boolean(governance.canUseNetwork)} observer=\${Boolean(governance.observerVisible)}\`,
    wrapperDraft ? \`Wrapper capability: \${wrapperDraft.auditEvidence?.capabilityId ?? "plan.openclaw.acpx_codex_bridge.wrapper_action"}\` : null,
    wrapperDraft ? \`Wrapper draft: registry=\${wrapperDraft.registry ?? "unknown"} status=\${draftProposal.status ?? "unknown"} ready=\${Boolean(draftSummary.readyForApprovalBridge)} path=\${draftProposal.wrapper?.relativePath ?? "none"} command=\${draftProposal.command?.command ?? "npx"} args=\${(draftProposal.command?.args ?? []).join(" ")}\` : null,
    wrapperDraft ? \`Wrapper governance: draft=\${Boolean(draftGovernance.canDraftWrapperAction)} task=\${Boolean(draftGovernance.createsTask)} approval=\${Boolean(draftGovernance.createsApproval)} credentialRead=\${Boolean(draftGovernance.canReadCredentialValue)} authCopy=\${Boolean(draftGovernance.canCopyAuthMaterial)} write=\${Boolean(draftGovernance.canWriteWrapper)} exec=\${Boolean(draftGovernance.canExecuteWrapper)} spawn=\${Boolean(draftGovernance.canSpawnCodexAcp)} provider=\${Boolean(draftGovernance.canCallProvider)} network=\${Boolean(draftGovernance.canUseNetwork)}\` : null,
    wrapperWriteProposal ? \`Wrapper write capability: \${wrapperWriteProposal.auditEvidence?.capabilityId ?? "plan.openclaw.acpx_codex_bridge.wrapper_write"}\` : null,
    wrapperWriteProposal ? \`Wrapper write proposal: registry=\${wrapperWriteProposal.registry ?? "unknown"} status=\${writeProposal.status ?? "unknown"} path=\${writeProposal.wrapper?.relativePath ?? "none"} hash=\${writeProposal.wrapper?.contentHash ?? "none"} bytes=\${writeProposal.wrapper?.contentPreviewBytes ?? 0} futureWrite=\${writeProposal.writeBoundary?.futureWriteCapabilityId ?? "none"}\` : null,
    wrapperWriteProposal ? \`Wrapper write governance: proposal=\${Boolean(writeGovernance.canBuildWrapperWriteProposal)} task=\${Boolean(writeGovernance.createsTask)} approval=\${Boolean(writeGovernance.createsApproval)} credentialRead=\${Boolean(writeGovernance.canReadCredentialValue)} authCopy=\${Boolean(writeGovernance.canCopyAuthMaterial)} write=\${Boolean(writeGovernance.canWriteWrapper)} exec=\${Boolean(writeGovernance.canExecuteWrapper)} spawn=\${Boolean(writeGovernance.canSpawnCodexAcp)} provider=\${Boolean(writeGovernance.canCallProvider)} network=\${Boolean(writeGovernance.canUseNetwork)}\` : null,
    wrapperWriteExecutionEvidence ? \`Wrapper write evidence capability: \${wrapperWriteExecutionEvidence.capability?.id ?? "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence"}\` : null,
    wrapperWriteExecutionEvidence ? \`Wrapper write evidence: registry=\${wrapperWriteExecutionEvidence.registry ?? "unknown"} total=\${writeEvidenceSummary.total ?? 0} passed=\${writeEvidenceSummary.passed ?? 0} failed=\${writeEvidenceSummary.failed ?? 0} completed=\${writeEvidenceSummary.completedTasks ?? 0} bytes=\${writeEvidenceSummary.totalContentBytes ?? 0}\` : null,
    latestWriteEvidence ? \`Latest wrapper write: task=\${latestWriteEvidence.taskId ?? "none"} status=\${latestWriteEvidence.taskStatus ?? "none"} path=\${latestWriteEvidence.wrapper?.target?.relativePath ?? "none"} hash=\${latestWriteEvidence.wrapper?.target?.contentHash ?? "none"} validation=\${Boolean(latestWriteEvidence.validation?.ok)} argsExposed=\${Boolean(latestWriteEvidence.wrapper?.command?.argsExposed)} spawn=\${Boolean(latestWriteEvidence.wrapper?.command?.processSpawned)}\` : null,
    wrapperWriteExecutionEvidence ? \`Wrapper recovery: needed=\${Boolean(writeRecovery.needed)} status=\${writeRecovery.status ?? "unknown"} next=\${writeRecovery.recommendedNextAction ?? "none"} createsTask=\${Boolean(writeRecovery.createsTask)}\` : null,
    wrapperWriteExecutionEvidence ? \`Wrapper evidence governance: readLedger=\${Boolean(wrapperWriteExecutionEvidence.governance?.canReadFilesystemChangeLedger)} write=\${Boolean(wrapperWriteExecutionEvidence.governance?.canWriteFile)} task=\${Boolean(wrapperWriteExecutionEvidence.governance?.canCreateTask)} approval=\${Boolean(wrapperWriteExecutionEvidence.governance?.canCreateApproval)} approve=\${Boolean(wrapperWriteExecutionEvidence.governance?.canApproveTask)} operator=\${Boolean(wrapperWriteExecutionEvidence.governance?.canExecuteOperatorStep)} credentialRead=\${Boolean(wrapperWriteExecutionEvidence.governance?.canReadCredentialValue)} authCopy=\${Boolean(wrapperWriteExecutionEvidence.governance?.canCopyAuthMaterial)} chmod=\${Boolean(wrapperWriteExecutionEvidence.governance?.canChmodWrapper)} exec=\${Boolean(wrapperWriteExecutionEvidence.governance?.canExecuteWrapper)} spawn=\${Boolean(wrapperWriteExecutionEvidence.governance?.canSpawnCodexAcp)} provider=\${Boolean(wrapperWriteExecutionEvidence.governance?.canCallProvider)} network=\${Boolean(wrapperWriteExecutionEvidence.governance?.canUseNetwork)}\` : null,
    processSpawnProposal ? \`Process spawn proposal capability: \${processSpawnProposal.auditEvidence?.capabilityId ?? "plan.openclaw.acpx_codex_bridge.process_spawn"}\` : null,
    processSpawnProposal ? \`Process spawn proposal: registry=\${processSpawnProposal.registry ?? "unknown"} status=\${spawnProposal.status ?? "unknown"} ready=\${Boolean(spawnSummary.readyForSpawnApprovalDesign)} wrapper=\${spawnProposal.wrapper?.relativePath ?? "none"} task=\${spawnSummary.selectedWrapperWriteTaskId ?? "none"} invocation=\${spawnSummary.selectedInvocationId ?? "none"}\` : null,
    processSpawnProposal ? \`Process spawn contract: future=\${spawnProposal.commandContract?.futureCapabilityId ?? "none"} command=\${spawnProposal.commandContract?.commandName ?? "node"} argsCount=\${spawnProposal.commandContract?.argsCount ?? 0} argsExposed=\${Boolean(spawnProposal.commandContract?.argsExposed)} executed=\${Boolean(spawnProposal.commandContract?.commandExecuted)} spawned=\${Boolean(spawnProposal.commandContract?.processSpawned)}\` : null,
    processSpawnProposal ? \`Process spawn governance: proposal=\${Boolean(spawnGovernance.canBuildProcessSpawnProposal)} task=\${Boolean(spawnGovernance.createsTask)} approval=\${Boolean(spawnGovernance.createsApproval)} approve=\${Boolean(spawnGovernance.canApproveTask)} operator=\${Boolean(spawnGovernance.canExecuteOperatorStep)} credentialRead=\${Boolean(spawnGovernance.canReadCredentialValue)} authCopy=\${Boolean(spawnGovernance.canCopyAuthMaterial)} chmod=\${Boolean(spawnGovernance.canChmodWrapper)} exec=\${Boolean(spawnGovernance.canExecuteWrapper)} spawn=\${Boolean(spawnGovernance.canSpawnCodexAcp)} provider=\${Boolean(spawnGovernance.canCallProvider)} network=\${Boolean(spawnGovernance.canUseNetwork)}\` : null,
    liveExecutionBoundaryReview ? \`Live execution boundary: registry=\${liveExecutionBoundaryReview.registry ?? "unknown"} capability=\${liveExecutionBoundaryReview.capability?.id ?? "govern.openclaw.acpx_codex_bridge.live_execution_boundary_review"} decision=\${liveDecision.status ?? "blocked"} canProceed=\${Boolean(liveDecision.canProceedToLiveSpawn)} blockers=\${(liveDecision.blockers ?? []).join(",")}\` : null,
    liveExecutionBoundaryReview ? \`Live boundary governance: task=\${Boolean(liveExecutionBoundaryReview.governance?.canCreateTask)} approval=\${Boolean(liveExecutionBoundaryReview.governance?.canCreateApproval)} operator=\${Boolean(liveExecutionBoundaryReview.governance?.canExecuteOperatorStep)} credentialRead=\${Boolean(liveExecutionBoundaryReview.governance?.canReadCredentialValue)} authCopy=\${Boolean(liveExecutionBoundaryReview.governance?.canCopyAuthMaterial)} chmod=\${Boolean(liveExecutionBoundaryReview.governance?.canChmodWrapper)} exec=\${Boolean(liveExecutionBoundaryReview.governance?.canExecuteWrapper)} spawn=\${Boolean(liveExecutionBoundaryReview.governance?.canSpawnCodexAcp)} provider=\${Boolean(liveExecutionBoundaryReview.governance?.canCallProvider)} network=\${Boolean(liveExecutionBoundaryReview.governance?.canUseNetwork)}\` : null,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "acpx_codex_bridge_compatibility_read"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...records.slice(0, 8).map((record) => \`\${record.sessionKey ?? "session"} agent=\${record.agentId ?? "unknown"} record=\${record.acpxRecordId ?? "unknown"} revision=\${record.revision ?? 0} credentialRead=\${Boolean(record.credentialValueRead)} copied=\${Boolean(record.authMaterialCopied)} wrapper=\${Boolean(record.wrapperWritten)} spawn=\${Boolean(record.processSpawned)}\`),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
    ...draftDeferred.map((boundary) => \`draft deferred: \${boundary}\`),
    ...writeDeferred.map((boundary) => \`write proposal deferred: \${boundary}\`),
    ...writeEvidenceDeferred.map((boundary) => \`write evidence deferred: \${boundary}\`),
    ...spawnDeferred.map((boundary) => \`spawn proposal deferred: \${boundary}\`),
    ...liveDeferred.map((boundary) => \`live boundary deferred: \${boundary}\`),
  ].filter(Boolean).join("\\n");
}

`;
