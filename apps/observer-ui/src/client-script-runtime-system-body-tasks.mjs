export const observerClientRuntimeSystemBodyTasksScript = `async function createSystemdRepairExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Real systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairCandidateTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-candidate-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair candidate task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdRepairCandidateTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Next systemd repair task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} approvalState=pending-after-create mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Next systemd repair real execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerDirectoryTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/directory-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger directory task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} target=\${result.ledgerDirectory?.displayPath ?? "unknown"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerDirectoryTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFirstRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/first-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger first record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.firstRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.firstRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFirstRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFollowupRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/followup-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger follow-up record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.followupRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.followupRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFollowupRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

`;
