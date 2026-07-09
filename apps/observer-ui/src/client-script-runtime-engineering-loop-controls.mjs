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
  if (kind === "lsp-lifecycle") {
    return \`/tasks/\${taskId ?? ""}\`;
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
  if (latestEngineeringLoopControlState.kind === "planning-workbench") {
    renderEngineeringPlanTodoEvidence(evidence);
    const state = latestEngineeringPlanTodoWorkbenchState;
    if (!state) {
      throw new Error("No planning workbench state available for the selected engineering task.");
    }
    engineeringLoopStateCompletion.textContent = \`todos=\${state.counts.total} done=\${state.counts.done} pending=\${state.counts.pending}\`;
    engineeringLoopStateJson.textContent = [
      "Kind: planning-workbench",
      \`Task: \${state.taskId ?? latestEngineeringLoopControlState.taskId}\`,
      \`Evidence: \${latestEngineeringLoopControlState.evidenceRoute}\`,
      \`Todos: total=\${state.counts.total} done=\${state.counts.done} inProgress=\${state.counts.inProgress} pending=\${state.counts.pending}\`,
      \`Current: \${state.currentTodo?.id ?? "none"} \${state.currentTodo?.status ?? "none"}\`,
      \`Registry: \${state.registry}\`,
      "Boundary: readback only; no hidden planning mode, todo file write, task mutation, command execution, or provider call.",
    ].join("\\n");
    setControlMessage(\`Refreshed engineering planning workbench state for \${state.taskId ?? "selected task"}.\`);
    await refreshEngineeringLoopControlSurfaces();
    return;
  }
  if (latestEngineeringLoopControlState.kind === "recovery" || latestEngineeringLoopControlState.kind === "recovery-draft") {
    const summary = evidence?.summary ?? {};
    const failures = summary.totalFailures ?? 0;
    const recoverable = summary.recoverableFailures ?? 0;
    const recovered = summary.alreadyRecovered ?? 0;
    const verificationRoute = latestEngineeringLoopControlState.verificationRoute ?? null;
    const verificationEvidence = verificationRoute
      ? await fetchJson(\`\${observerConfig.coreUrl}\${verificationRoute}\`)
      : null;
    const verificationSummary = verificationEvidence?.summary ?? {};
    const rerunTotal = verificationSummary.total ?? 0;
    const rerunPassed = verificationSummary.passed ?? 0;
    const rerunFailed = verificationSummary.failed ?? 0;
    engineeringLoopStateCompletion.textContent = verificationRoute
      ? \`recovery=\${recovered} rerun=\${rerunPassed}/\${rerunTotal} failed=\${rerunFailed}\`
      : \`failures=\${failures} recoverable=\${recoverable} recovered=\${recovered}\`;
    engineeringLoopStateJson.textContent = [
      \`Kind: \${latestEngineeringLoopControlState.kind}\`,
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Approval: \${latestEngineeringLoopControlState.approvalId ?? "none"}\`,
      \`Evidence: \${latestEngineeringLoopControlState.evidenceRoute}\`,
      \`Recovery: failures=\${failures} recoverable=\${recoverable} recovered=\${recovered}\`,
      verificationRoute ? \`Rerun Evidence: \${verificationRoute}\` : "Rerun Evidence: not created yet",
      verificationRoute ? \`Rerun: total=\${rerunTotal} passed=\${rerunPassed} failed=\${rerunFailed}\` : null,
      \`Registry: \${evidence?.registry ?? "unknown"}\`,
      "Boundary: readback only; no approval, execution, retry, recovery task, mutation, provider call, or result envelope.",
    ].filter(Boolean).join("\\n");
    setControlMessage(\`Refreshed engineering recovery readback for \${latestEngineeringLoopControlState.taskId}.\`);
    await refreshEngineeringLoopControlSurfaces();
    return;
  }
  if (latestEngineeringLoopControlState.kind === "lsp-lifecycle") {
    const task = evidence?.task ?? evidence;
    const lifecycle = task?.engineeringLspLifecycle ?? {};
    const execution = task?.outcome?.details?.lspLifecycleExecution ?? lifecycle.execution ?? {};
    const lifecycleState = execution.lifecycleState ?? lifecycle.lifecycleState ?? {};
    engineeringLoopStateCompletion.textContent = \`status=\${task?.status ?? "unknown"} lifecycle=\${lifecycleState.status ?? execution.result?.state ?? "unknown"}\`;
    engineeringLoopStateJson.textContent = [
      "Kind: lsp-lifecycle",
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Approval: \${latestEngineeringLoopControlState.approvalId ?? "none"}\`,
      \`Task Status: \${task?.status ?? "unknown"}\`,
      \`Action: \${lifecycle.lifecycleAction ?? execution.lifecycleAction ?? "start"} language=\${lifecycle.language ?? execution.language ?? "typescript"}\`,
      \`Server: \${lifecycle.server?.serverBinary ?? execution.server?.serverBinary ?? "unknown"} binaryFound=\${Boolean(execution.server?.binaryFound)} processStarted=\${Boolean(execution.server?.processStarted)} aliveAtProbe=\${Boolean(execution.server?.processAliveAtProbe)} terminated=\${Boolean(execution.server?.processTerminated)} jsonRpc=\${Boolean(execution.server?.jsonRpcHandshakeSent)}\`,
      \`Lifecycle State: \${lifecycleState.status ?? "pending"} active=\${Boolean(lifecycleState.process?.longLivedProcessActive)} jsonRpc=\${Boolean(lifecycleState.boundaries?.jsonRpcEnabled)}\`,
      \`Result: \${execution.result?.state ?? task?.outcome?.kind ?? "pending"}\`,
      \`Recovery: \${execution.recoveryRecommendation?.nextAction ?? task?.outcome?.details?.recoveryEvidence?.recommendation?.nextAction ?? "pending operator step"}\`,
      "Boundary: approval-gated binary gate plus process probe only; no long-lived process state, JSON-RPC, source-content read, mutation, provider call, or result envelope.",
    ].join("\\n");
    setControlMessage(\`Refreshed LSP lifecycle task readback for \${latestEngineeringLoopControlState.taskId}.\`);
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

function renderEngineeringLspLifecycleLoopTaskState(result) {
  const taskId = result.task?.id ?? null;
  const approvalId = result.approval?.id ?? result.task?.approval?.requestId ?? null;
  latestEngineeringLoopControlState = {
    kind: "lsp-lifecycle",
    taskId,
    approvalId,
    evidenceRoute: engineeringLoopEvidenceRoute("lsp-lifecycle", taskId),
  };
  engineeringLoopStateKind.textContent = "lsp-lifecycle";
  engineeringLoopStateTask.textContent = taskId ? taskId.slice(0, 8) : "none";
  engineeringLoopStateApproval.textContent = approvalId ? approvalId.slice(0, 8) : "none";
  engineeringLoopStateNext.textContent = "approve pending approval, then run operator step";
  engineeringLoopStateEvidence.textContent = latestEngineeringLoopControlState.evidenceRoute;
  engineeringLoopStateCompletion.textContent = "pending approval";
  engineeringLoopStateJson.textContent = [
    "Kind: lsp-lifecycle",
    \`Task: \${taskId ?? "none"}\`,
    \`Approval: \${approvalId ?? "none"}\`,
    \`Language: \${result.engineeringLspLifecycle?.language ?? "typescript"}\`,
    \`Action: \${result.engineeringLspLifecycle?.lifecycleAction ?? "start"}\`,
    \`Server: \${result.engineeringLspLifecycle?.server?.serverBinary ?? "typescript-language-server"}\`,
    "Next: approve pending approval, then run operator step. Missing server binaries become recoverable task evidence.",
    result.engineeringLspLifecycle?.lifecycleAction === "source_transfer"
      ? "Boundary: no auto-approval or process start before approval; approved execution may send initialize plus didOpen only; symbol requests, long-lived pools, and provider calls remain blocked."
      : "Boundary: no auto-approval, no process start before approval, no JSON-RPC, no source-content transfer, no provider call.",
  ].join("\\n");
}

async function createEngineeringLspLifecycleLoopTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/lifecycle-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "typescript",
      lifecycleAction: "start",
      confirm: true,
    }),
  });
  focusEngineeringLoopTask(result);
  renderEngineeringLspLifecycleLoopTaskState(result);
  setControlMessage(\`Created LSP lifecycle task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
}

async function createEngineeringLspSourceTransferLoopTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/lifecycle-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "typescript",
      lifecycleAction: "source_transfer",
      relativePath: "src/app.ts",
      confirm: true,
    }),
  });
  focusEngineeringLoopTask(result);
  renderEngineeringLspLifecycleLoopTaskState(result);
  setControlMessage(\`Created LSP source-transfer task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
}

function renderEngineeringRecoveryLoopDraftState(draft) {
  latestEngineeringLoopControlState = {
    kind: "recovery-draft",
    taskId: draft.sourceTaskId,
    sourceTaskId: draft.sourceTaskId,
    approvalId: null,
    evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${draft.sourceTaskId}\`,
    verificationRoute: null,
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
    sourceTaskId: draft.sourceTaskId,
    recoveredTaskId,
    approvalId,
    evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${draft.sourceTaskId}\`,
    verificationRoute: recoveredTaskId
      ? \`/plugins/native-adapter/engineering-verification/evidence?taskId=\${recoveredTaskId}&maxOutputChars=2000\`
      : null,
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
    \`Rerun Evidence: \${latestEngineeringLoopControlState.verificationRoute ?? "pending recovered task"}\`,
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

function selectedEngineeringPlanningTaskId() {
  return latestEngineeringLoopControlState?.taskId
    ?? getSelectedHistoryTaskId()
    ?? currentTaskState?.id
    ?? null;
}

async function bridgeEngineeringPlanningWorkbenchState() {
  const taskId = selectedEngineeringPlanningTaskId();
  const taskQuery = taskId ? \`?taskId=\${encodeURIComponent(taskId)}&limit=8\` : "?limit=8";
  const evidenceRoute = \`/plugins/native-adapter/engineering-plan-todo/evidence\${taskQuery}\`;
  const data = await fetchJson(\`\${observerConfig.coreUrl}\${evidenceRoute}\`);
  renderEngineeringPlanTodoEvidence(data);
  if (!latestEngineeringPlanTodoWorkbenchState) {
    throw new Error("No engineering planning workbench state is available to bridge.");
  }
  const state = latestEngineeringPlanTodoWorkbenchState;
  latestEngineeringLoopControlState = {
    kind: "planning-workbench",
    taskId: state.taskId ?? taskId,
    approvalId: null,
    evidenceRoute,
  };
  engineeringLoopStateKind.textContent = "planning-workbench";
  engineeringLoopStateTask.textContent = state.taskId ? state.taskId.slice(0, 8) : "none";
  engineeringLoopStateApproval.textContent = "none";
  engineeringLoopStateNext.textContent = "use visible todo state to guide next governed action";
  engineeringLoopStateEvidence.textContent = evidenceRoute;
  engineeringLoopStateCompletion.textContent = \`todos=\${state.counts.total} pending=\${state.counts.pending}\`;
  engineeringLoopStateJson.textContent = [
    "Kind: planning-workbench",
    \`Task: \${state.taskId ?? "none"}\`,
    \`Todo Source: \${state.todoSource}\`,
    \`Todos: total=\${state.counts.total} done=\${state.counts.done} inProgress=\${state.counts.inProgress} pending=\${state.counts.pending}\`,
    \`Current: \${state.currentTodo?.id ?? "none"} \${state.currentTodo?.status ?? "none"}\`,
    \`Evidence: \${evidenceRoute}\`,
    "Boundary: Observer workbench bridge only; no hidden planning mode, todo file write, task mutation, approval, command execution, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Bridged engineering planning workbench state for \${state.taskId ?? "selected task"}.\`);
  await refreshEngineeringLoopControlSurfaces();
}

function classifyRestorableEngineeringLoopTask(task) {
  if (!task?.id) {
    return null;
  }
  const approvalId = task.approval?.requestId ?? task.approval?.id ?? null;
  if (task.recovery?.recoveredFromTaskId && task.sourceCommand?.registry === "openclaw-source-command-task-v0") {
    return {
      kind: "recovery",
      taskId: task.id,
      sourceTaskId: task.recovery.recoveredFromTaskId,
      approvalId,
      evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${task.recovery.recoveredFromTaskId}\`,
      verificationRoute: \`/plugins/native-adapter/engineering-verification/evidence?taskId=\${task.id}&maxOutputChars=2000\`,
      restoredFrom: "recovered_source_command_task",
    };
  }
  if (task.recoveredByTaskId && task.sourceCommand?.registry === "openclaw-source-command-task-v0") {
    return {
      kind: "recovery",
      taskId: task.recoveredByTaskId,
      sourceTaskId: task.id,
      approvalId: null,
      evidenceRoute: \`/plugins/native-adapter/engineering-recovery/evidence?taskId=\${task.id}\`,
      verificationRoute: \`/plugins/native-adapter/engineering-verification/evidence?taskId=\${task.recoveredByTaskId}&maxOutputChars=2000\`,
      restoredFrom: "source_command_recovery_link",
    };
  }
  if (task.engineeringEditProposal) {
    return {
      kind: "edit",
      taskId: task.id,
      approvalId,
      evidenceRoute: engineeringLoopEvidenceRoute("edit", task.id),
      restoredFrom: "engineering_edit_proposal_task",
    };
  }
  if (task.engineeringWriteProposal) {
    return {
      kind: "write",
      taskId: task.id,
      approvalId,
      evidenceRoute: engineeringLoopEvidenceRoute("write", task.id),
      restoredFrom: "engineering_write_proposal_task",
    };
  }
  if (task.engineeringLspLifecycle) {
    return {
      kind: "lsp-lifecycle",
      taskId: task.id,
      approvalId,
      evidenceRoute: engineeringLoopEvidenceRoute("lsp-lifecycle", task.id),
      restoredFrom: "engineering_lsp_lifecycle_task",
    };
  }
  if (task.sourceCommand?.registry === "openclaw-source-command-task-v0") {
    return {
      kind: "verification",
      taskId: task.id,
      approvalId,
      evidenceRoute: engineeringLoopEvidenceRoute("verification", task.id),
      restoredFrom: "source_command_verification_task",
    };
  }
  if (Array.isArray(task.plan?.steps) && task.plan.steps.length > 0) {
    return {
      kind: "planning-workbench",
      taskId: task.id,
      approvalId,
      evidenceRoute: \`/plugins/native-adapter/engineering-plan-todo/evidence?taskId=\${task.id}&limit=8\`,
      restoredFrom: "task_plan_steps",
    };
  }
  return null;
}

function nextStepForRestoredEngineeringLoop(task, restored) {
  if (task?.approval?.required === true || task?.status === "queued") {
    return restored.kind === "planning-workbench"
      ? "use visible todo state to guide next governed action"
      : "approve pending approval if required, then run operator step";
  }
  if (task?.status === "completed" || task?.status === "failed") {
    return "refresh completion evidence and decide the next governed action";
  }
  return "inspect restored task state";
}

async function restoreEngineeringLoopStateFromHistory({ startup = false } = {}) {
  const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks?limit=20\`);
  const tasks = Array.isArray(data?.items) ? data.items : [];
  const pair = tasks
    .map((task) => ({ task, restored: classifyRestorableEngineeringLoopTask(task) }))
    .find((item) => item.restored);
  if (!pair?.restored) {
    throw new Error("No engineering loop task was found in core task history.");
  }

  const { task, restored } = pair;
  latestEngineeringLoopControlState = restored;
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = task.id;
  taskDetailIdInput.value = task.id;
  engineeringLoopStateKind.textContent = restored.kind;
  engineeringLoopStateTask.textContent = restored.taskId ? restored.taskId.slice(0, 8) : "none";
  engineeringLoopStateApproval.textContent = restored.approvalId ? restored.approvalId.slice(0, 8) : "none";
  engineeringLoopStateNext.textContent = nextStepForRestoredEngineeringLoop(task, restored);
  engineeringLoopStateEvidence.textContent = restored.evidenceRoute;
  engineeringLoopStateCompletion.textContent = "restored from core history";
  engineeringLoopStateJson.textContent = [
    \`Kind: \${restored.kind}\`,
    \`Task: \${restored.taskId}\`,
    restored.sourceTaskId ? \`Source Task: \${restored.sourceTaskId}\` : null,
    \`Approval: \${restored.approvalId ?? "none"}\`,
    \`Task Status: \${task.status ?? "unknown"}\`,
    \`Restored From: \${restored.restoredFrom}\`,
    \`Evidence: \${restored.evidenceRoute}\`,
    restored.verificationRoute ? \`Rerun Evidence: \${restored.verificationRoute}\` : null,
    \`Next: \${nextStepForRestoredEngineeringLoop(task, restored)}\`,
    "Boundary: restoration is read-only; no task, approval, operator step, command, mutation, provider call, or result envelope is created.",
  ].filter(Boolean).join("\\n");
  setControlMessage(startup
    ? \`Auto-restored engineering loop state from core history task \${task.id}.\`
    : \`Restored engineering loop state from core history task \${task.id}.\`);
  await refreshTaskList();
  await refreshTaskHistoryDetail();
}

async function autoRestoreEngineeringLoopStateOnStartup() {
  if (latestEngineeringLoopControlState?.taskId) {
    return;
  }
  try {
    await restoreEngineeringLoopStateFromHistory({ startup: true });
  } catch {
    engineeringLoopStateCompletion.textContent = "no restorable core history";
  }
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
