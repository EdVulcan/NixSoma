export const observerClientEngineeringContextRenderersScript = `function renderEngineeringContextPacket(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const deferred = Array.isArray(data?.deferredExecutionBoundaries) ? data.deferredExecutionBoundaries : [];
  const workViewAssociation = data?.workViewAssociation ?? null;
  const workViewSummary = workViewAssociation?.summary ?? {};
  const workViewAssociationToolName = "trusted_work_view";
  engineeringContextPacketRegistry.textContent = data?.registry ?? "openclaw-native-engineering-context-packet-v0";
  engineeringContextPacketRecords.textContent = String(summary.sourceTranscriptRecords ?? 0);
  engineeringContextPacketMessages.textContent = String(summary.messageCount ?? messages.length);
  engineeringContextPacketRedactions.textContent = String(summary.redactions ?? 0);
  engineeringContextPacketProvider.textContent = governance.callsProvider ? "enabled" : "blocked";
  engineeringContextPacketAudit.textContent = data?.auditEvidence?.persisted === false ? "not persisted" : "persisted";
  engineeringContextPacketWorkView.textContent = workViewSummary.workViewId ?? "none";
  engineeringContextPacketBinding.textContent = workViewSummary.bindingStatus ?? "none";
  engineeringContextPacketAuthority.textContent = workViewSummary.actionAuthority ?? "inactive";
  const recoveryAction = workViewSummary.recoveryAction ?? "none";
  const recoveryButtonLabels = {
    prepare_work_view: "Prepare Trusted Work View",
    reveal_work_view: "Reveal Trusted Work View",
  };
  const recoveryButtonLabel = recoveryButtonLabels[recoveryAction] ?? null;
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
    \`Protection: verification=\${Boolean(summary.verificationEvidenceProtected)} recovery=\${Boolean(summary.recoveryEvidenceProtected)}\`,
    \`Trusted Work View (\${workViewAssociationToolName}): included=\${Boolean(summary.workViewAssociationIncluded)} status=\${workViewSummary.status ?? "none"} workView=\${workViewSummary.workViewId ?? "none"} binding=\${workViewSummary.bindingStatus ?? "none"} authority=\${workViewSummary.actionAuthority ?? "inactive"} recovery=\${recoveryAction} leaseMatched=\${Boolean(workViewSummary.leaseMatched)}\`,
    \`Governance: local=\${Boolean(governance.localAssemblyOnly)} credentialStore=\${Boolean(governance.readsCredentialStore)} taskMutation=\${Boolean(governance.mutatesTaskState)} provider=\${Boolean(governance.callsProvider)} network=\${Boolean(governance.networkEgress)}\`,
    \`Audit: operation=\${data?.auditEvidence?.operation ?? "missing"} inputContent=\${Boolean(data?.auditEvidence?.inputContentRecorded)} outputContent=\${Boolean(data?.auditEvidence?.outputContentRecorded)}\`,
    "",
    "Packet messages:",
    JSON.stringify(messages, null, 2),
    "",
    ...deferred.map((boundary) => \`deferred: \${boundary}\`),
  ].join("\\n");
}

`;
