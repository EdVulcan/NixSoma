export const observerClientEngineeringRecoveryRenderersScript = `let latestEngineeringRecoveryEvidence = null;
let latestEngineeringRecoveryActionDraft = null;

function selectEngineeringRecoveryFailure(data) {
  const failures = Array.isArray(data?.failures) ? data.failures : [];
  return failures.find((failure) => {
    const recommendations = Array.isArray(failure?.recommendations) ? failure.recommendations : [];
    return failure?.recoverable === true
      && failure?.alreadyRecovered !== true
      && typeof failure?.taskId === "string"
      && recommendations.some((item) => item?.id === "recover_task_after_review" && item?.createsTask === true);
  }) ?? null;
}

function buildEngineeringRecoveryActionDraft(data) {
  const failure = selectEngineeringRecoveryFailure(data);
  if (!failure) {
    return null;
  }
  const recommendation = (failure.recommendations ?? []).find((item) => item.id === "recover_task_after_review") ?? null;
  if (!recommendation?.endpoint) {
    return null;
  }

  return {
    registry: "openclaw-native-engineering-loop-recovery-action-draft-v0",
    mode: "operator-confirmed-recovery-task-draft",
    identityLevel: data?.identityLevel ?? "Level 1: stable user-space control plane",
    sourceRegistry: data?.registry ?? "openclaw-native-engineering-recovery-evidence-v0",
    sourceTaskId: failure.taskId,
    failureKind: failure.kind ?? "unknown",
    endpoint: recommendation.endpoint,
    createsTask: true,
    createsApproval: "from recovered task policy when required",
    executesCommand: false,
    mutatesWorkspace: false,
    callsProvider: false,
    requiresOperatorAction: true,
    requiresApprovalBeforeAnyCommandRerun: recommendation.requiresApprovalBeforeAnyCommandRerun === true,
    deferredExecutionBoundaries: [
      "draft does not call recovery endpoint",
      "explicit operator click required before recovery task creation",
      "recovered task remains queued behind existing approval policy",
      "no automatic operator step or command rerun",
      "no filesystem mutation, provider egress, credential read, or result envelope",
    ],
  };
}

function renderEngineeringRecoveryActionDraft(draft) {
  latestEngineeringRecoveryActionDraft = draft ?? null;
  if (!draft) {
    engineeringRecoveryAction.textContent = "none";
    engineeringRecoveryActionJson.textContent = "No recoverable engineering failure available for a recovery action draft.";
    return;
  }

  engineeringRecoveryAction.textContent = draft.sourceTaskId ? draft.sourceTaskId.slice(0, 8) : "ready";
  engineeringRecoveryActionJson.textContent = [
    "Native engineering recovery action draft: converts recovery evidence into an explicit operator-confirmed recovery task action.",
    \`Registry: \${draft.registry}\`,
    \`Mode: \${draft.mode}\`,
    \`Identity: \${draft.identityLevel}\`,
    \`Source Task: \${draft.sourceTaskId}\`,
    \`Failure: \${draft.failureKind}\`,
    \`Endpoint: \${draft.endpoint}\`,
    \`Creates Task: \${Boolean(draft.createsTask)} approval=\${draft.createsApproval}\`,
    \`Boundary: executesCommand=\${Boolean(draft.executesCommand)} mutatesWorkspace=\${Boolean(draft.mutatesWorkspace)} provider=\${Boolean(draft.callsProvider)}\`,
    "",
    ...draft.deferredExecutionBoundaries.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

function renderEngineeringRecoveryEvidence(data) {
  latestEngineeringRecoveryEvidence = data ?? null;
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const failures = Array.isArray(data?.failures) ? data.failures : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  const workStandardsCoverage = data?.workStandardsCoverage ?? {};
  engineeringRecoveryRegistry.textContent = data?.registry ?? "openclaw-native-engineering-recovery-evidence-v0";
  engineeringRecoveryFailures.textContent = String(summary.totalFailures ?? failures.length);
  engineeringRecoveryRecoverable.textContent = String(summary.recoverableFailures ?? 0);
  engineeringRecoveryRecovered.textContent = String(summary.alreadyRecovered ?? 0);
  engineeringRecoveryExecution.textContent = governance.canExecuteCommand ? "enabled" : "blocked";
  renderEngineeringRecoveryActionDraft(buildEngineeringRecoveryActionDraft(data));

  engineeringRecoveryJson.textContent = [
    "Native engineering recovery evidence: reads failed engineering verification and source-command task outcomes, then exposes governed recovery review hints.",
    "This endpoint does not create recovery tasks, approve recovery, rerun commands, mutate files, call providers, or import enhanced source code.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-recovery-evidence-v0"}\`,
    \`Mode: \${data?.mode ?? "failed-native-engineering-tool-recovery-evidence"}\`,
    \`Identity: \${data?.identityLevel ?? "Level 1: stable user-space control plane"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_tool.recovery_evidence"} risk=\${data?.capability?.risk ?? "medium"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Query: taskId=\${data?.query?.taskId ?? "latest"} limit=\${data?.query?.limit ?? 10}\`,
    \`Summary: failures=\${summary.totalFailures ?? failures.length} recoverable=\${summary.recoverableFailures ?? 0} alreadyRecovered=\${summary.alreadyRecovered ?? 0}\`,
    \`Work Standards Coverage: registry=\${workStandardsCoverage.registry ?? "openclaw-engineering-recovery-work-standards-coverage-v0"} status=\${workStandardsCoverage.status ?? "unknown"} covered=\${workStandardsCoverage.score?.covered ?? 0} missing=\${workStandardsCoverage.score?.missing ?? 0}\`,
    \`Governance: readVerification=\${Boolean(governance.canReadVerificationEvidence)} readTasks=\${Boolean(governance.canReadTaskOutcomes)} createRecovery=\${Boolean(governance.canCreateRecoveryTask)} approve=\${Boolean(governance.canApproveRecovery)} execute=\${Boolean(governance.canExecuteCommand)} mutate=\${Boolean(governance.canMutate)} provider=\${Boolean(governance.canCallProvider)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "recovery_evidence"} evidence=\${data?.auditEvidence?.evidenceKind ?? "missing"} persisted=\${Boolean(data?.auditEvidence?.persisted)}\`,
    "",
    ...failures.slice(0, 8).map((failure) => {
      const recommendationIds = (failure.recommendations ?? []).map((item) => \`\${item.id}\${item.createsTask ? "(operator)" : ""}\`).join(",") || "none";
      const coverage = failure.workStandardsCoverage ?? {};
      return \`\${failure.kind ?? "unknown"} task=\${failure.taskId ?? "none"} source=\${failure.source ?? "unknown"} recoverable=\${Boolean(failure.recoverable)} alreadyRecovered=\${Boolean(failure.alreadyRecovered)} reportReady=\${Boolean(coverage.reportReadiness?.canReportWithEvidence)} coverage=\${coverage.status ?? "unknown"} exit=\${failure.result?.exitCode ?? "n/a"} timeout=\${Boolean(failure.result?.timedOut)} recommendations=\${recommendationIds}\`;
    }),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
