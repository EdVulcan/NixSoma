export const observerClientRuntimeEngineeringLoopControlsScript = `let latestEngineeringLoopControlState = null;

function focusEngineeringLoopTask(result) {
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
}

function boundedEngineeringInput(input, fallback, maxChars) {
  const value = String(input?.value ?? "").trim();
  return (value || fallback).slice(0, maxChars);
}

function readEngineeringEditLoopInput() {
  return {
    relativePath: boundedEngineeringInput(engineeringEditPathInput, "package.json", 240),
    oldString: boundedEngineeringInput(engineeringEditOldInput, "OpenClaw on NixOS monorepo skeleton", 8000),
    newString: boundedEngineeringInput(engineeringEditNewInput, "OpenClaw on NixOS native agent body skeleton", 8000),
  };
}

function readEngineeringWriteLoopInput() {
  return {
    relativePath: boundedEngineeringInput(engineeringWritePathInput, "scratch/observer-engineering-loop.txt", 240),
    content: boundedEngineeringInput(engineeringWriteContentInput, "OpenClaw observer engineering loop write proposal", 16 * 1024),
  };
}

function readEngineeringVerificationLoopInput() {
  return {
    proposalId: boundedEngineeringInput(engineeringVerificationProposalInput, "openclaw:typecheck", 240),
    query: boundedEngineeringInput(engineeringVerificationQueryInput, "verify", 240),
  };
}

function engineeringLoopEvidenceRoute(kind, taskId) {
  if (kind === "edit") {
    return \`/plugins/native-adapter/engineering-edit-execution/evidence?taskId=\${taskId ?? ""}\`;
  }
  if (kind === "write") {
    return \`/plugins/native-adapter/engineering-write-execution/evidence?taskId=\${taskId ?? ""}\`;
  }
  return \`/plugins/native-adapter/engineering-verification/evidence?taskId=\${taskId ?? ""}\`;
}

function renderEngineeringLoopControlState(kind, result) {
  const taskId = result.task?.id ?? "none";
  const approvalId = result.approval?.id ?? "none";
  const evidenceRoute = engineeringLoopEvidenceRoute(kind, result.task?.id ?? null);
  latestEngineeringLoopControlState = {
    kind,
    taskId: result.task?.id ?? null,
    approvalId: result.approval?.id ?? null,
    evidenceRoute,
  };
  engineeringLoopStateKind.textContent = kind;
  engineeringLoopStateTask.textContent = taskId === "none" ? "none" : taskId.slice(0, 8);
  engineeringLoopStateApproval.textContent = approvalId === "none" ? "none" : approvalId.slice(0, 8);
  engineeringLoopStateNext.textContent = "approve pending approval, then run operator step";
  engineeringLoopStateEvidence.textContent = evidenceRoute;
  engineeringLoopStateCompletion.textContent = "pending approval";
  engineeringLoopStateJson.textContent = [
    \`Kind: \${kind}\`,
    \`Task: \${taskId}\`,
    \`Approval: \${approvalId}\`,
    \`Task Status: \${result.task?.status ?? "unknown"}\`,
    \`Approval Status: \${result.approval?.status ?? "unknown"}\`,
    "Next: approve pending approval, then run operator step",
    \`Evidence: \${evidenceRoute}\`,
    "Boundary: no auto-approval, no automatic operator step, no unapproved mutation.",
  ].join("\\n");
}

async function refreshEngineeringLoopCompletionReadback() {
  if (!latestEngineeringLoopControlState?.taskId) {
    throw new Error("Create an engineering loop task first.");
  }
  const evidence = await fetchJson(\`\${observerConfig.coreUrl}\${latestEngineeringLoopControlState.evidenceRoute}\`);
  if (latestEngineeringLoopControlState.kind === "recovery" || latestEngineeringLoopControlState.kind === "recovery-draft") {
    const summary = evidence?.summary ?? {};
    const failures = summary.totalFailures ?? 0;
    const recoverable = summary.recoverableFailures ?? 0;
    const recovered = summary.alreadyRecovered ?? 0;
    engineeringLoopStateCompletion.textContent = \`failures=\${failures} recoverable=\${recoverable} recovered=\${recovered}\`;
    engineeringLoopStateJson.textContent = [
      \`Kind: \${latestEngineeringLoopControlState.kind}\`,
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Approval: \${latestEngineeringLoopControlState.approvalId ?? "none"}\`,
      \`Evidence: \${latestEngineeringLoopControlState.evidenceRoute}\`,
      \`Recovery: failures=\${failures} recoverable=\${recoverable} recovered=\${recovered}\`,
      \`Registry: \${evidence?.registry ?? "unknown"}\`,
      "Boundary: readback only; no approval, execution, retry, recovery task, mutation, provider call, or result envelope.",
    ].join("\\n");
    setControlMessage(\`Refreshed engineering recovery readback for \${latestEngineeringLoopControlState.taskId}.\`);
    await refreshEngineeringLoopControlSurfaces();
    return;
  }
  const summary = evidence?.summary ?? {};
  const total = summary.total ?? 0;
  const passed = summary.passed ?? 0;
  const failed = summary.failed ?? 0;
  engineeringLoopStateCompletion.textContent = \`total=\${total} passed=\${passed} failed=\${failed}\`;
  engineeringLoopStateJson.textContent = [
    \`Kind: \${latestEngineeringLoopControlState.kind}\`,
    \`Task: \${latestEngineeringLoopControlState.taskId}\`,
    \`Approval: \${latestEngineeringLoopControlState.approvalId ?? "none"}\`,
    \`Evidence: \${latestEngineeringLoopControlState.evidenceRoute}\`,
    \`Completion: total=\${total} passed=\${passed} failed=\${failed}\`,
    \`Registry: \${evidence?.registry ?? "unknown"}\`,
    "Boundary: readback only; no approval, execution, retry, recovery task, mutation, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Refreshed engineering loop completion evidence for \${latestEngineeringLoopControlState.taskId}.\`);
  await refreshEngineeringLoopControlSurfaces();
}

function renderEngineeringRecoveryLoopDraftState(draft) {
  latestEngineeringLoopControlState = {
    kind: "recovery-draft",
    taskId: draft.sourceTaskId,
    approvalId: null,
    evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${draft.sourceTaskId}\`,
  };
  engineeringLoopStateKind.textContent = "recovery-draft";
  engineeringLoopStateTask.textContent = draft.sourceTaskId ? draft.sourceTaskId.slice(0, 8) : "none";
  engineeringLoopStateApproval.textContent = "none";
  engineeringLoopStateNext.textContent = "operator may create recovery task after review";
  engineeringLoopStateEvidence.textContent = latestEngineeringLoopControlState.evidenceRoute;
  engineeringLoopStateCompletion.textContent = "draft ready";
  engineeringLoopStateJson.textContent = [
    "Kind: recovery-draft",
    \`Source Task: \${draft.sourceTaskId}\`,
    \`Failure: \${draft.failureKind}\`,
    \`Endpoint: \${draft.endpoint}\`,
    "Next: click Create Recovery Task only after reviewing failed evidence.",
    "Boundary: draft only; no recovery task, approval, operator step, command rerun, mutation, provider call, or result envelope.",
  ].join("\\n");
}

function renderEngineeringRecoveryLoopTaskState(draft, result) {
  const recoveredTaskId = result.task?.id ?? null;
  const approvalId = result.task?.approval?.requestId ?? result.task?.approval?.id ?? result.approval?.id ?? null;
  latestEngineeringLoopControlState = {
    kind: "recovery",
    taskId: recoveredTaskId,
    approvalId,
    evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${draft.sourceTaskId}\`,
  };
  engineeringLoopStateKind.textContent = "recovery";
  engineeringLoopStateTask.textContent = recoveredTaskId ? recoveredTaskId.slice(0, 8) : "none";
  engineeringLoopStateApproval.textContent = approvalId ? approvalId.slice(0, 8) : "none";
  engineeringLoopStateNext.textContent = "approve recovered task if pending, then run operator step";
  engineeringLoopStateEvidence.textContent = latestEngineeringLoopControlState.evidenceRoute;
  engineeringLoopStateCompletion.textContent = "recovery task queued";
  engineeringLoopStateJson.textContent = [
    "Kind: recovery",
    \`Source Task: \${draft.sourceTaskId}\`,
    \`Recovered Task: \${recoveredTaskId ?? "none"}\`,
    \`Approval: \${approvalId ?? "none"}\`,
    \`Failure: \${draft.failureKind}\`,
    "Next: approval and operator step are still required before any command rerun.",
    "Boundary: created recovery task only; no auto-approval, no automatic command rerun, no mutation by the UI.",
  ].join("\\n");
}

async function draftEngineeringRecoveryLoopAction() {
  const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-recovery/evidence?limit=8&maxOutputChars=2000\`);
  renderEngineeringRecoveryEvidence(data);
  if (!latestEngineeringRecoveryActionDraft) {
    throw new Error("No recoverable engineering failure is available for a recovery action draft.");
  }
  renderEngineeringRecoveryLoopDraftState(latestEngineeringRecoveryActionDraft);
  setControlMessage(\`Drafted recovery action for failed task \${latestEngineeringRecoveryActionDraft.sourceTaskId}; creation still requires an explicit operator click.\`);
}

async function createEngineeringRecoveryLoopTask() {
  if (!latestEngineeringRecoveryActionDraft) {
    await draftEngineeringRecoveryLoopAction();
  }
  const draft = latestEngineeringRecoveryActionDraft;
  const result = await fetchJson(\`\${observerConfig.coreUrl}\${draft.endpoint}\`, {
    method: "POST",
  });
  focusEngineeringLoopTask(result);
  renderEngineeringRecoveryLoopTaskState(draft, result);
  setControlMessage(\`Created recovery task \${result.task?.id ?? "unknown"} from failed engineering task \${draft.sourceTaskId}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
}

async function refreshEngineeringLoopControlSurfaces() {
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshEngineeringEditProposal();
  await refreshEngineeringWriteProposal();
  await refreshEngineeringWriteExecutionEvidence();
  await refreshEngineeringVerificationEvidence();
  await refreshEngineeringRecoveryEvidence();
}

async function createEngineeringEditLoopApprovalTask() {
  const input = readEngineeringEditLoopInput();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-edit-proposal-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: input.relativePath,
      oldString: input.oldString,
      newString: input.newString,
      contextLines: 1,
      maxOutputChars: 8000,
      confirm: true,
    }),
  });

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("edit", result);
  setControlMessage(\`Created approval-gated engineering edit task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshWorkspacePatchApplyDraft();
}

async function createEngineeringWriteLoopApprovalTask() {
  const input = readEngineeringWriteLoopInput();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-write-proposal-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: input.relativePath,
      content: \`\${input.content}\\n\`,
      overwrite: true,
      contextLines: 1,
      confirm: true,
    }),
  });

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("write", result);
  setControlMessage(\`Created approval-gated engineering write task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshWorkspaceTextWriteDraft();
}

async function createEngineeringVerificationLoopApprovalTask() {
  const input = readEngineeringVerificationLoopInput();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: input.proposalId,
      query: input.query,
      confirm: true,
    }),
  });

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("verification", result);
  setControlMessage(\`Created approval-gated engineering verification task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshSourceCommandPlanDraft();
}

`;
