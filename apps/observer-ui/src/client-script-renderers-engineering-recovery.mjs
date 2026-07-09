export const observerClientEngineeringRecoveryRenderersScript = `function renderEngineeringRecoveryEvidence(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const failures = Array.isArray(data?.failures) ? data.failures : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  engineeringRecoveryRegistry.textContent = data?.registry ?? "openclaw-native-engineering-recovery-evidence-v0";
  engineeringRecoveryFailures.textContent = String(summary.totalFailures ?? failures.length);
  engineeringRecoveryRecoverable.textContent = String(summary.recoverableFailures ?? 0);
  engineeringRecoveryRecovered.textContent = String(summary.alreadyRecovered ?? 0);
  engineeringRecoveryExecution.textContent = governance.canExecuteCommand ? "enabled" : "blocked";

  engineeringRecoveryJson.textContent = [
    "Native engineering recovery evidence: reads failed engineering verification and source-command task outcomes, then exposes governed recovery review hints.",
    "This endpoint does not create recovery tasks, approve recovery, rerun commands, mutate files, call providers, or import enhanced source code.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-recovery-evidence-v0"}\`,
    \`Mode: \${data?.mode ?? "failed-native-engineering-tool-recovery-evidence"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_tool.recovery_evidence"} risk=\${data?.capability?.risk ?? "medium"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Query: taskId=\${data?.query?.taskId ?? "latest"} limit=\${data?.query?.limit ?? 10}\`,
    \`Summary: failures=\${summary.totalFailures ?? failures.length} recoverable=\${summary.recoverableFailures ?? 0} alreadyRecovered=\${summary.alreadyRecovered ?? 0}\`,
    \`Governance: readVerification=\${Boolean(governance.canReadVerificationEvidence)} readTasks=\${Boolean(governance.canReadTaskOutcomes)} createRecovery=\${Boolean(governance.canCreateRecoveryTask)} approve=\${Boolean(governance.canApproveRecovery)} execute=\${Boolean(governance.canExecuteCommand)} mutate=\${Boolean(governance.canMutate)} provider=\${Boolean(governance.canCallProvider)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "recovery_evidence"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...failures.slice(0, 8).map((failure) => {
      const recommendationIds = (failure.recommendations ?? []).map((item) => \`\${item.id}\${item.createsTask ? "(operator)" : ""}\`).join(",") || "none";
      return \`\${failure.kind ?? "unknown"} task=\${failure.taskId ?? "none"} source=\${failure.source ?? "unknown"} recoverable=\${Boolean(failure.recoverable)} alreadyRecovered=\${Boolean(failure.alreadyRecovered)} exit=\${failure.result?.exitCode ?? "n/a"} timeout=\${Boolean(failure.result?.timedOut)} recommendations=\${recommendationIds}\`;
    }),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
