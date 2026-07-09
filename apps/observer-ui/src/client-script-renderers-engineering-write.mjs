export const observerClientEngineeringWriteRenderersScript = `function renderEngineeringWriteProposal(data) {
  const summary = data?.summary ?? {};
  const target = data?.target ?? {};
  const governance = data?.governance ?? {};
  const diff = data?.diffPreview ?? {};
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringWriteProposalRegistry.textContent = data?.registry ?? "openclaw-native-engineering-write-proposal-v0";
  engineeringWriteProposalKind.textContent = summary.proposalKind ?? "create_file_proposal";
  engineeringWriteProposalTarget.textContent = target.relativePath ?? "none";
  engineeringWriteProposalBytes.textContent = String(target.proposedBytes ?? 0);
  engineeringWriteProposalMutation.textContent = governance.canWriteFile ? "enabled" : "blocked";
  engineeringWriteProposalMode.textContent = data?.mode ?? "source-write-proposal-diff-metadata-preview-only";

  engineeringWriteProposalJson.textContent = [
    "Native engineering write proposal: maps cc_write create/overwrite intent into governed OpenClaw proposal evidence.",
    "This endpoint returns redacted diff metadata and content hashes only. It does not write files, overwrite files, create tasks, create approvals, run shell commands, start LSP, call providers, or import enhanced source code.",
    "Approval-gated task bridge: /plugins/native-adapter/engineering-write-proposal-tasks creates a workspace_text_write task only with explicit confirmation; approval is still required before mutation.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-write-proposal-v0"}\`,
    \`Mode: \${data?.mode ?? "source-write-proposal-diff-metadata-preview-only"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.engineering_tool.write_proposal"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Target: \${target.relativePath ?? "none"} exists=\${Boolean(target.exists)} overwrite=\${Boolean(target.overwriteRequested)} proposedBytes=\${target.proposedBytes ?? 0} contentExposed=\${Boolean(target.contentExposed)} diffTextExposed=\${Boolean(target.diffPreviewTextExposed)}\`,
    \`Preview: format=\${diff.format ?? "unknown"} lines=\${diff.previewLineCount ?? 0} truncated=\${Boolean(diff.truncated)} contentExposed=\${Boolean(diff.contentExposed)}\`,
    \`Summary: kind=\${summary.proposalKind ?? "unknown"} task=\${Boolean(summary.createsTask)} approval=\${Boolean(summary.createsApproval)} mutate=\${Boolean(summary.canMutate)} next=\${summary.nextRequiredStep ?? "approval_gated_workspace_text_write_task"}\`,
    \`Governance: write=\${Boolean(governance.canWriteFile)} overwrite=\${Boolean(governance.canOverwriteFile)} execute=\${Boolean(governance.canExecuteToolCode)} mutate=\${Boolean(governance.canMutate)} provider=\${Boolean(governance.canCallProvider)} approvalBeforeWrite=\${Boolean(governance.requiresApprovalBeforeWrite)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "write_proposal"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
