export const observerClientRuntimeApprovalTasksScript = `async function createWorkspaceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated workspace command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceCommandPlanDraft();
}

async function createSourceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      query: "command",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated source command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshSourceCommandPlanDraft();
}

async function createNativePluginInvokeApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/invoke-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin invoke task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginInvokePlan();
}

async function createNativePluginRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime activation task \${result.task?.id ?? "unknown"}; runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginActivationPlan();
}

async function createNativePluginRuntimeAdapterApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime adapter task \${result.task?.id ?? "unknown"}; implementation remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginRuntimeAdapterContract();
}

async function createAcpxCodexBridgeWrapperApprovalTask() {
  const bridge = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-compatibility\`);
  const sessionKey = bridge?.persistence?.records?.[0]?.sessionKey ?? null;
  if (!sessionKey) {
    throw new Error("No ACPX/Codex bridge session metadata is available for a wrapper task.");
  }
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionKey,
      command: "npx",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated ACPX/Codex bridge wrapper task \${result.task?.id ?? "unknown"}; wrapper write and ACP spawn remain deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshAcpxCodexBridgeCompatibility();
}

async function createAcpxCodexBridgeWrapperWriteApprovalTask() {
  const bridge = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-compatibility\`);
  const sessionKey = bridge?.persistence?.records?.[0]?.sessionKey ?? null;
  if (!sessionKey) {
    throw new Error("No ACPX/Codex bridge session metadata is available for a wrapper write task.");
  }
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-write-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionKey,
      command: "npx",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated ACPX/Codex bridge wrapper write task \${result.task?.id ?? "unknown"}; ACP spawn and auth copy remain deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshAcpxCodexBridgeCompatibility();
}

async function createPluginSearchWebApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web adapter task \${result.task?.id ?? "unknown"}; network execution remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebAdapterContract();
}

async function createPluginSearchWebRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web runtime activation task \${result.task?.id ?? "unknown"}; network runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebRuntimeActivationPlan();
}

async function createPluginSearchWebProviderSandboxApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web provider sandbox task \${result.task?.id ?? "unknown"}; provider runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebProviderRuntimeSandbox();
}

async function createSourceAuthoredEditApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-authored-edit-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposalQuery: "edit",
      targetSelectionQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw source-authored edit task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

async function createWorkspaceTextWriteApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-text-write-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-write.txt",
      content: "hello from observer native OpenClaw workspace text write\\n",
      overwrite: true,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace text write task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceTextWriteDraft();
}

async function createWorkspacePatchApplyApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-patch-apply-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-edit.txt",
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposal: {
        title: "Observer sample edit proposal",
        rationale: "Demonstrate proposal envelope metadata for an approval-gated OpenClaw workspace patch.",
        targetContext: { symbol: "observer-sample", fileRole: "workspace scratch fixture" },
      },
      deriveProposalFromSource: true,
      proposalQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace patch apply task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

`;
