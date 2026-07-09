export const observerClientEngineeringEditRenderersScript = `function renderEngineeringEditProposal(data) {
  const target = data?.target ?? {};
  const governance = data?.governance ?? {};
  const summary = data?.summary ?? {};
  const validation = data?.validation ?? {};
  const diffPreview = data?.diffPreview ?? {};
  const lines = Array.isArray(diffPreview.lines) ? diffPreview.lines : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringEditProposalRegistry.textContent = data?.registry ?? "openclaw-native-engineering-edit-proposal-v0";
  engineeringEditProposalTarget.textContent = target.relativePath ?? "package.json";
  engineeringEditProposalPreview.textContent = \`\${diffPreview.previewLineCount ?? lines.length} lines\`;
  engineeringEditProposalApply.textContent = governance.canApplyPatch ? "enabled" : "blocked";
  engineeringEditProposalAudit.textContent = data?.auditEvidence?.evidenceKind ?? "missing";

  engineeringEditProposalJson.textContent = [
    "Native governed edit proposal: exact-match surgical diff preview mapped from cc_edit without applying a patch.",
    "This endpoint reads through the bounded workspace read surface and does not write, apply, create tasks, create approvals, run shell commands, start LSP, call providers, or import enhanced source code.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-edit-proposal-v0"}\`,
    \`Mode: \${data?.mode ?? "surgical-edit-proposal-diff-preview-only"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.engineering_tool.edit_proposal"} source=\${data?.sourceCapability?.sourceToolName ?? "cc_edit"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired ?? true)}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Target: \${target.relativePath ?? "package.json"} originalBytes=\${target.originalBytes ?? 0} proposedBytes=\${target.proposedBytes ?? 0} changedAt=\${target.changedAtLine ?? "unknown"} replacements=\${target.replacementsAvailable ?? summary.replacementsAvailable ?? 0} contentExposed=\${Boolean(target.contentExposed)} diffPreview=\${Boolean(target.diffPreviewExposed)}\`,
    \`Hashes: original=\${target.originalSha256 ?? "unknown"} proposed=\${target.proposedSha256 ?? "unknown"}\`,
    \`Proposal: id=\${data?.proposal?.id ?? "unknown"} kind=\${data?.proposal?.kind ?? "exact_replacement_diff_preview"} next=\${summary.nextRequiredStep ?? "approval_gated_patch_apply_task"}\`,
    \`Validation: ok=\${Boolean(validation.ok)} uniqueExactMatch=\${Boolean(validation.exactReplacement?.uniqueExactMatch)} structured=\${validation.structuredPatch?.engine ?? "unknown"} preview=\${validation.preview?.engine ?? "unknown"}\`,
    \`Bounds: root=\${Boolean(data?.bounds?.workspaceRootConstrained)} traversal=\${Boolean(data?.bounds?.pathTraversalProtection)} maxSearch=\${data?.bounds?.maxSearchBytes ?? "n/a"} maxReplacement=\${data?.bounds?.maxReplacementBytes ?? "n/a"} noWriteApply=\${Boolean(data?.bounds?.noWriteApply)}\`,
    \`Governance: readWorkspace=\${Boolean(governance.canReadWorkspaceContent)} arbitrarySystemPath=\${Boolean(governance.canReadArbitrarySystemPath)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} verify=\${Boolean(governance.canRunVerification)} lsp=\${Boolean(governance.canStartLsp)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} apply=\${Boolean(governance.canApplyPatch)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "edit_proposal"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...lines.map((line) => {
      const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      const number = line.type === "add" ? line.newLine : line.oldLine;
      return \`\${prefix}\${number ?? "?"}: \${line.text ?? ""}\`;
    }),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
