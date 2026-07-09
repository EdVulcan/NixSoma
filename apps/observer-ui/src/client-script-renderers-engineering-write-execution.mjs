export const observerClientEngineeringWriteExecutionRenderersScript = `function renderEngineeringWriteExecutionEvidence(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const first = Array.isArray(data?.evidence) ? data.evidence[0] : null;
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringWriteExecutionRegistry.textContent = data?.registry ?? "openclaw-native-engineering-write-execution-evidence-v0";
  engineeringWriteExecutionTotal.textContent = String(summary.total ?? 0);
  engineeringWriteExecutionPassed.textContent = String(summary.passed ?? 0);
  engineeringWriteExecutionProposal.textContent = String(summary.withEngineeringProposal ?? 0);
  engineeringWriteExecutionMutation.textContent = governance.canWriteFile ? "enabled" : "blocked";
  engineeringWriteExecutionMode.textContent = data?.mode ?? "approved-workspace-text-write-execution-evidence";

  engineeringWriteExecutionJson.textContent = [
    "Native engineering write execution evidence: reads approved workspace_text_write task and filesystem ledger outcomes for cc_write-derived proposals.",
    "This endpoint is read-only. It does not write files, create tasks, create approvals, approve tasks, execute operator steps, run shell commands, or call providers.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-write-execution-evidence-v0"}\`,
    \`Mode: \${data?.mode ?? "approved-workspace-text-write-execution-evidence"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_tool.write_execution_evidence"} risk=\${data?.capability?.risk ?? "medium"}\`,
    \`Summary: total=\${summary.total ?? 0} passed=\${summary.passed ?? 0} failed=\${summary.failed ?? 0} withProposal=\${summary.withEngineeringProposal ?? 0} completed=\${summary.completedTasks ?? 0} bytes=\${summary.totalContentBytes ?? 0}\`,
    \`Latest: task=\${first?.taskId ?? "none"} status=\${first?.taskStatus ?? "none"} change=\${first?.change ?? "none"} bytes=\${first?.contentBytes ?? 0} proposal=\${first?.proposal?.proposalId ?? "none"} validation=\${Boolean(first?.validation?.ok)}\`,
    \`Governance: readLedger=\${Boolean(governance.canReadFilesystemChangeLedger)} write=\${Boolean(governance.canWriteFile)} task=\${Boolean(governance.canCreateTask)} approval=\${Boolean(governance.canCreateApproval)} approve=\${Boolean(governance.canApproveTask)} operator=\${Boolean(governance.canExecuteOperatorStep)} provider=\${Boolean(governance.canCallProvider)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "write_execution_evidence"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
