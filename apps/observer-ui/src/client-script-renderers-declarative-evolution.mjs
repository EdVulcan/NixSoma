export const observerClientDeclarativeEvolutionRenderersScript = `function renderDeclarativeEvolutionActivationReview(data) {
  const review = data?.result ?? data ?? {};
  const healthGate = review.healthGate ?? {};
  const hostHealth = review.hostHealth ?? {};
  const binding = review.binding ?? {};
  const blocked = review.blocked === true || review.ok !== true;
  declarativeEvolutionActivationRegistry.textContent = review.registry ?? "unknown";
  declarativeEvolutionHealthGateStatus.textContent = blocked
    ? (review.reason ?? "blocked")
    : healthGate.assessment ?? "unknown";
  declarativeEvolutionHostHealthStatus.textContent = hostHealth.status ?? "unknown";
  declarativeEvolutionActivationReady.textContent = String(review.activationReady === true);
  declarativeEvolutionReviewJson.textContent = JSON.stringify({
    ok: review.ok === true,
    blocked,
    reason: review.reason ?? null,
    sourceTaskId: review.sourceTaskId ?? binding.sourceStagingTaskId ?? null,
    candidateHash: binding.candidateHash ?? healthGate.candidateHash ?? null,
    stagedFileHash: binding.stagedFileHash ?? healthGate.stagedFileHash ?? null,
    evaluatedClosurePath: binding.evaluatedClosurePath ?? healthGate.evaluatedClosurePath ?? null,
    derivationPath: binding.derivationPath ?? healthGate.derivationPath ?? null,
    narHash: binding.narHash ?? healthGate.narHash ?? null,
    closureIntegrityStatus: healthGate.closureIntegrityStatus ?? null,
    closureIntegrityReceiptHash: binding.closureIntegrityReceiptHash ?? healthGate.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: binding.approvalRecordHash ?? healthGate.approvalRecordHash ?? null,
    hostHealthHash: binding.hostHealthHash ?? hostHealth.hostHealthHash ?? null,
    hostHealthStatus: hostHealth.status ?? null,
    activationReady: review.activationReady === true,
    next: review.next?.recommendedAction ?? null,
    governance: review.governance ?? null,
  }, null, 2);
}

function renderDeclarativeEvolutionActivationDecision(data) {
  const task = data?.task ?? data?.result?.task ?? null;
  const approval = data?.approval ?? data?.result?.approval ?? null;
  const binding = data?.approvalBinding ?? data?.result?.approvalBinding ?? task?.nativeDeclarativeEvolution?.activationDecision ?? {};
  const governance = data?.governance ?? data?.result?.governance ?? {};
  const execution = task?.nativeDeclarativeEvolution?.execution ?? null;
  declarativeEvolutionActivationTaskId.textContent = task?.id ?? "none";
  declarativeEvolutionActivationApprovalId.textContent = approval?.id ?? "none";
  if (task?.id && declarativeEvolutionDecisionTaskIdInput) {
    declarativeEvolutionDecisionTaskIdInput.value = task.id;
  }
  declarativeEvolutionDecisionJson.textContent = JSON.stringify({
    ok: data?.ok === true || data?.result?.ok === true,
    taskId: task?.id ?? null,
    taskStatus: task?.status ?? null,
    approvalId: approval?.id ?? null,
    approvalStatus: approval?.status ?? null,
    decision: binding.decision ?? null,
    sourceStagingTaskId: binding.sourceStagingTaskId ?? null,
    candidateHash: binding.candidateHash ?? null,
    stagedFileHash: binding.stagedFileHash ?? null,
    evaluatedClosurePath: binding.evaluatedClosurePath ?? null,
    derivationPath: binding.derivationPath ?? null,
    narHash: binding.narHash ?? null,
    closureIntegrityReceiptHash: binding.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: binding.approvalRecordHash ?? null,
    hostHealthHash: binding.hostHealthHash ?? null,
    executionStatus: execution?.status ?? null,
    activation: execution?.activation ?? "not executed",
    governance: {
      createsTask: governance.createsTask === true,
      createsApproval: governance.createsApproval === true,
      writesManagedConfig: governance.writesManagedConfig === true,
      switchesGeneration: governance.switchesGeneration === true,
      executesActivation: governance.executesActivation === true,
      executesRollback: governance.executesRollback === true,
      automaticActivation: governance.automaticActivation === true,
    },
  }, null, 2);
}

function renderDeclarativeEvolutionActivationExecution(data) {
  const task = data?.task ?? data?.result?.task ?? null;
  const approval = data?.approval ?? data?.result?.approval ?? null;
  const binding = data?.approvalBinding ?? data?.result?.approvalBinding ?? task?.nativeDeclarativeEvolution?.activation ?? {};
  const execution = task?.nativeDeclarativeEvolution?.execution ?? data?.result?.activation ?? null;
  declarativeEvolutionExecutionTaskId.textContent = task?.id ?? "none";
  declarativeEvolutionExecutionStatus.textContent = execution?.status ?? task?.status ?? "queued";
  declarativeEvolutionExecutionJson.textContent = JSON.stringify({
    ok: data?.ok === true || data?.result?.ok === true,
    taskId: task?.id ?? null,
    taskStatus: task?.status ?? null,
    approvalId: approval?.id ?? null,
    activationDecisionTaskId: binding.activationDecisionTaskId ?? null,
    sourceStagingTaskId: binding.sourceStagingTaskId ?? null,
    candidateHash: binding.candidateHash ?? null,
    evaluatedClosurePath: binding.evaluatedClosurePath ?? null,
    derivationPath: binding.derivationPath ?? null,
    narHash: binding.narHash ?? null,
    closureIntegrityReceiptHash: binding.closureIntegrityReceiptHash ?? null,
    approvalRecordHash: binding.approvalRecordHash ?? null,
    executionStatus: execution?.status ?? null,
    activationExecuted: execution?.activationExecuted === true,
    generationSwitched: execution?.generationSwitched === true,
    postActivationHealth: execution?.postActivationHealth ?? null,
    receiptHash: execution?.executionReceipt?.receiptHash ?? null,
    automaticRollback: false,
  }, null, 2);
}

`;
