export const observerClientEngineeringProviderHandoffRenderersScript = `function renderEngineeringProviderHandoff(data) {
  const result = data?.result ?? {};
  const summary = data?.summary ?? result?.summary ?? {};
  const task = result?.task ?? null;
  const approval = result?.approval ?? null;
  const binding = task?.cloudConsciousnessLiveProviderEgressExecution?.requestBinding ?? {};
  const blocked = data?.blocked === true || result?.blocked === true;
  engineeringProviderHandoffStatus.textContent = blocked
    ? (data?.reason ?? result?.reason ?? "blocked")
    : task
      ? (approval?.status ?? task.status ?? "created")
      : "not created";
  engineeringProviderHandoffTask.textContent = task?.id ?? summary.taskId ?? "none";
  engineeringProviderHandoffApproval.textContent = approval?.id ?? summary.approvalId ?? "none";
  engineeringProviderHandoffJson.textContent = [
    "Provider handoff task creation is local and approval-gated.",
    \`Capability: \${data?.capability?.id ?? "act.openclaw.engineering_context.provider_handoff_task"}\`,
    \`Status: \${blocked ? (data?.reason ?? result?.reason ?? "blocked") : task ? (task.status ?? "created") : "not created"}\`,
    \`Task: \${task?.id ?? summary.taskId ?? "none"}\`,
    \`Approval: \${approval?.id ?? summary.approvalId ?? "none"} status=\${approval?.status ?? "none"}\`,
    \`Binding: provider=\${binding.provider ?? summary.provider ?? "none"} model=\${binding.model ?? summary.model ?? "none"} requestBound=\${Boolean(binding.requestContentHash) || summary.requestBound === true}\`,
    \`Governance: createsTask=\${Boolean(result?.governance?.createsTask ?? summary.createsTask)} createsApproval=\${Boolean(result?.governance?.createsApproval ?? summary.createsApproval)} endpointContacted=\${Boolean(result?.governance?.endpointContacted ?? summary.endpointContacted)} networkEgress=\${Boolean(result?.governance?.networkEgress ?? summary.networkEgress)} providerCall=\${Boolean(result?.governance?.providerCall ?? false)}\`,
    "Request text and credential values are not shown or persisted in this readback.",
  ].join("\\n");
}

`;
