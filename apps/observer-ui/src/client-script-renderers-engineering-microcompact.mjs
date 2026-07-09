export const observerClientEngineeringMicrocompactRenderersScript = `function renderEngineeringMicrocompactEvidence(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringMicrocompactRegistry.textContent = data?.registry ?? "openclaw-native-engineering-microcompact-evidence-v0";
  engineeringMicrocompactItems.textContent = String(summary.totalItems ?? candidates.length);
  engineeringMicrocompactCompactable.textContent = String(summary.compactableItems ?? 0);
  engineeringMicrocompactReclaimed.textContent = String(summary.reclaimedChars ?? 0);
  engineeringMicrocompactMutation.textContent = governance.canMutatePersistedLogs ? "enabled" : "blocked";

  engineeringMicrocompactJson.textContent = [
    "Native engineering microcompact evidence: estimates context-budget recovery from historical command transcript outputs without exposing raw output text.",
    "This endpoint does not mutate runtime messages, rewrite persisted logs, execute commands, create tasks, create approvals, call providers, or import enhanced source code.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-microcompact-evidence-v0"}\`,
    \`Mode: \${data?.mode ?? "context-management-evidence-only"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_context.microcompact_evidence"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Query: limit=\${data?.query?.limit ?? 20} threshold=\${data?.query?.thresholdChars ?? 1000} protectRecent=\${data?.query?.protectRecentItems ?? 3}\`,
    \`Summary: items=\${summary.totalItems ?? candidates.length} compactable=\${summary.compactableItems ?? 0} protected=\${summary.protectedItems ?? 0} originalChars=\${summary.totalOriginalChars ?? 0} reclaimedChars=\${summary.reclaimedChars ?? 0}\`,
    \`Governance: readTranscript=\${Boolean(governance.canReadCommandTranscriptLedger)} readVerify=\${Boolean(governance.canReadVerificationEvidence)} readRecovery=\${Boolean(governance.canReadRecoveryEvidence)} mutateRuntime=\${Boolean(governance.canMutateRuntimeMessages)} mutateLogs=\${Boolean(governance.canMutatePersistedLogs)} execute=\${Boolean(governance.canExecuteCommand)} provider=\${Boolean(governance.canCallProvider)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "microcompact_evidence"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...candidates.slice(0, 8).map((candidate) => {
      const preview = candidate.microcompactPreview ?? {};
      const output = candidate.output ?? {};
      return \`\${preview.compactable ? "compactable" : "kept"} task=\${candidate.taskId ?? "none"} chars=\${output.totalChars ?? 0} reclaimed=\${preview.reclaimedChars ?? 0} reason=\${preview.reason ?? "unknown"} rawText=\${Boolean(output.rawTextReturned)}\`;
    }),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
