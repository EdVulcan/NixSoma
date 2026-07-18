export const observerClientEngineeringContextRenderersScript = `function renderEngineeringContextPacket(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  const workViewAssociation = data?.workViewAssociation ?? null;
  const workViewSummary = workViewAssociation?.summary ?? {};
  const workViewObservation = workViewAssociation?.observation ?? null;
  const workViewAssociationToolName = "trusted_work_view";
  engineeringContextPacketRegistry.textContent = data?.registry ?? "openclaw-native-engineering-context-packet-v0";
  engineeringContextPacketRecords.textContent = String(summary.sourceTranscriptRecords ?? 0);
  engineeringContextPacketMessages.textContent = String(summary.messageCount ?? messages.length);
  engineeringContextPacketRedactions.textContent = String(summary.redactions ?? 0);
  engineeringContextPacketProvider.textContent = governance.callsProvider ? "enabled" : "blocked";
  engineeringContextPacketAudit.textContent = data?.auditEvidence?.persisted === false ? "not persisted" : "persisted";
  if (engineeringContextPacketSourceTask) {
    engineeringContextPacketSourceTask.textContent = summary.sourceTaskId ?? data?.provenance?.sourceTaskId ?? "none";
  }
  engineeringContextPacketWorkView.textContent = workViewSummary.workViewId ?? "none";
  engineeringContextPacketBinding.textContent = workViewSummary.bindingStatus ?? "none";
  engineeringContextPacketAuthority.textContent = workViewSummary.actionAuthority ?? "inactive";
  if (engineeringContextPacketCapture) {
    engineeringContextPacketCapture.textContent = workViewObservation
      ? \`\${workViewObservation.status ?? "unknown"}/\${workViewObservation.freshness ?? "unknown"}\`
      : "none";
  }
  if (engineeringContextPacketTargets) {
    engineeringContextPacketTargets.textContent = workViewObservation
      ? String(workViewObservation.semanticTargets?.itemCount ?? 0)
      : "none";
  }
  if (engineeringContextPacketSemanticAction) {
    engineeringContextPacketSemanticAction.textContent = summary.semanticActionDecisionStatus
      ? String(summary.semanticActionDecisionStatus) + "/" + String(summary.semanticActionDecisionReason ?? "none")
      : "none";
  }
  if (engineeringContextPacketPlanTodo) {
    engineeringContextPacketPlanTodo.textContent = summary.planTodoEvidenceIncluded
      ? \`\${summary.planTodoTodoSource ?? "unknown"}/\${summary.planTodoCurrentAction ?? "review_current_todo"}\`
      : "none";
  }
  if (engineeringContextPacketExperienceMemory) {
    engineeringContextPacketExperienceMemory.textContent = summary.experienceMemoryIncluded
      ? \`\${summary.experienceMemoryRecalled ?? 0}/\${summary.experienceMemoryStatus ?? "unknown"}\`
      : "none";
  }
  if (engineeringContextPacketExperienceMemoryPattern) {
    engineeringContextPacketExperienceMemoryPattern.textContent = summary.experienceMemoryIncluded
      ? \`\${summary.experienceMemoryPattern ?? "unknown"}/\${summary.experienceMemoryCompletionRate ?? "n/a"}\`
      : "none";
  }
  const recoveryAction = workViewSummary.recoveryAction ?? "none";
  const recoveryButtonLabels = {
    prepare_work_view: "Prepare Trusted Work View",
    reveal_work_view: "Reveal Trusted Work View",
    hide_work_view: "Hide Trusted Work View",
    resume_ai_action_authority: "Resume AI Action Authority",
    restart_approved_trusted_sidecar: "Restart Approved Trusted Sidecar",
  };
  const recoveryButtonLabel = recoveryButtonLabels[recoveryAction] ?? null;
  const rebindStatuses = new Set(["stale_session_binding", "stale_work_view_binding"]);
  const canRebind = rebindStatuses.has(workViewSummary.bindingStatus);
  if (engineeringContextPacketBindWorkViewButton) {
    engineeringContextPacketBindWorkViewButton.textContent = canRebind
      ? "Rebind Task to Work View"
      : "Bind Task to Work View";
  }
  engineeringContextPacketRecovery.textContent = recoveryAction;
  if (engineeringContextPacketRecoveryButton) {
    engineeringContextPacketRecoveryButton.textContent = recoveryButtonLabel ?? "Prepare Trusted Work View";
    engineeringContextPacketRecoveryButton.hidden = recoveryButtonLabel === null;
    engineeringContextPacketRecoveryButton.disabled = recoveryButtonLabel === null;
  }
  engineeringContextPacketJson.textContent = [
    "Local governed engineering context packet: bounded task and transcript evidence for later explicit consumption.",
    "The packet is built only after this explicit Observer action; it does not create tasks, execute commands, call providers, or perform network egress.",
    \`Registry: \${data?.registry ?? "openclaw-native-engineering-context-packet-v0"}\`,
    \`Mode: \${data?.mode ?? "local_governed_engineering_context_assembly"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.engineering_context.packet"} risk=\${data?.capability?.risk ?? "medium"} approval=\${Boolean(data?.capability?.approvalRequired)}\`,
    \`Summary: records=\${summary.sourceTranscriptRecords ?? 0} messages=\${summary.messageCount ?? messages.length} redactions=\${summary.redactions ?? 0} compacted=\${summary.compactedMessages ?? 0} reclaimedChars=\${summary.reclaimedChars ?? 0}\`,
    \`Task Selection: executionTask=\${data?.provenance?.taskId ?? "none"} sourceTask=\${summary.sourceTaskId ?? data?.provenance?.sourceTaskId ?? "none"}\`,
    \`Protection: verification=\${Boolean(summary.verificationEvidenceProtected)} recovery=\${Boolean(summary.recoveryEvidenceProtected)} planTodo=\${Boolean(summary.planTodoEvidenceIncluded)}\`,
    \`Experience Memory: included=\${Boolean(summary.experienceMemoryIncluded)} recalled=\${summary.experienceMemoryRecalled ?? 0} stored=\${summary.experienceMemoryStored ?? 0} matched=\${summary.experienceMemoryMatched ?? 0} completed=\${summary.experienceMemoryCompletedMatches ?? 0} failed=\${summary.experienceMemoryFailedMatches ?? 0} rate=\${summary.experienceMemoryCompletionRate ?? "n/a"} latest=\${summary.experienceMemoryLatestOutcome ?? "none"} pattern=\${summary.experienceMemoryPattern ?? "none"} status=\${summary.experienceMemoryStatus ?? "none"} advisoryOnly=\${Boolean(summary.experienceMemoryAdvisoryOnly)}\`,
    \`Experience Memory Next Action: \${summary.experienceMemoryNextAction ?? "follow standard approval and verification boundaries"}\`,
    \`Incident Experience: target=\${summary.experienceMemoryIncidentTargetUnit ?? "none"} matched=\${summary.experienceMemoryIncidentMatched ?? 0} restored=\${summary.experienceMemoryIncidentRestored ?? 0} recoveryRequired=\${summary.experienceMemoryIncidentRecoveryRequired ?? 0} latestRestored=\${summary.experienceMemoryIncidentLatestRestoredHealthy ?? "unknown"} pattern=\${summary.experienceMemoryIncidentPattern ?? "none"}\`,
    \`Incident Experience Next Action: \${summary.experienceMemoryIncidentNextAction ?? "no matching fixed-target incident history"}\`,
    \`Trusted Work View (\${workViewAssociationToolName}): included=\${Boolean(summary.workViewAssociationIncluded)} status=\${workViewSummary.status ?? "none"} workView=\${workViewSummary.workViewId ?? "none"} binding=\${workViewSummary.bindingStatus ?? "none"} authority=\${workViewSummary.actionAuthority ?? "inactive"} recovery=\${recoveryAction} leaseMatched=\${Boolean(workViewSummary.leaseMatched)} observationRegistry=\${workViewObservation?.registry ?? "openclaw-native-engineering-work-view-observation-v0"} observation=\${workViewSummary.workViewObservationStatus ?? "none"}/\${workViewSummary.workViewObservationFreshness ?? "none"} sequence=\${workViewSummary.workViewObservationSequence ?? "none"} semanticTargets=\${workViewSummary.semanticTargetCount ?? "none"}\`,
    \`Governance: local=\${Boolean(governance.localAssemblyOnly)} credentialStore=\${Boolean(governance.readsCredentialStore)} taskMutation=\${Boolean(governance.mutatesTaskState)} provider=\${Boolean(governance.callsProvider)} network=\${Boolean(governance.networkEgress)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "missing"} inputContent=\${Boolean(data?.auditEvidence?.inputContentRecorded)} outputContent=\${Boolean(data?.auditEvidence?.outputContentRecorded)}\`,
    "",
    "Semantic Action Decision Registry: openclaw-native-engineering-work-view-action-decision-v0",
    "Semantic Action Decision: status=" + String(summary.semanticActionDecisionStatus ?? "none")
      + " reason=" + String(summary.semanticActionDecisionReason ?? "none")
      + " ready=" + String(summary.semanticActionReady === true)
      + " control=" + String(summary.semanticActionOperatorControlId ?? "none"),
    "Packet messages:",
    JSON.stringify(messages, null, 2),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
