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

function engineeringLspSelectedTargetReadCapabilityRequest(taskId, language = "typescript", targetIndex = engineeringLspSelectedTargetIndex()) {
  return {
    capabilityId: "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
    intent: "engineering.lsp.selected_target_read_bridge",
    taskId,
    params: {
      taskId,
      language,
      targetIndex,
      contextLines: 2,
      includeRead: true,
    },
  };
}

function engineeringLspSelectedTargetEditProposalSeedRoute(taskId, language = "typescript", targetIndex = engineeringLspSelectedTargetIndex()) {
  return \`/plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed?taskId=\${encodeURIComponent(taskId ?? "")}&language=\${encodeURIComponent(language ?? "typescript")}&targetIndex=\${encodeURIComponent(String(targetIndex ?? 0))}&contextLines=0\`;
}

function engineeringLoopWorkStandardsQuery(kind) {
  return {
    edit: "edit",
    write: "write",
    verification: "verify",
    recovery: "verify",
    "recovery-draft": "verify",
    "planning-workbench": "plan",
    "lsp-lifecycle": "verify",
  }[kind] ?? "edit";
}

function engineeringLoopWorkStandardsNextAction(workStandards) {
  const missing = Array.isArray(workStandards?.missingRequiredStandards)
    ? workStandards.missingRequiredStandards
    : [];
  const actions = {
    plan_before_mutation: "add plan-first intent before proposing mutation",
    diff_preview_before_apply: "review the bounded diff or mutation preview before approval",
    explicit_approval_for_mutation: "keep mutation behind the explicit approval gate",
    filesystem_ledger_after_apply: "inspect filesystem ledger evidence after approved apply",
    patch_validation_for_edits: "review exact-match patch validation before creating the task",
    verification_evidence_before_report: "attach verification evidence before reporting completion",
    prompt_content_not_product_authority: "keep prompt content hidden and use derived standards only",
  };
  if (missing.length > 0) {
    return actions[missing[0]] ?? "review missing standard: " + missing[0];
  }
  if (workStandards?.status === "ready_for_engineering_loop_guidance") {
    return "standards satisfied; follow the task approval and evidence path";
  }
  return "inspect work-standards readback before continuing";
}

function formatEngineeringLoopWorkStandards(workStandards) {
  const score = workStandards?.score ?? {};
  const missing = workStandards?.missingRequiredStandards ?? [];
  const query = workStandards?.query ?? latestEngineeringLoopControlState?.workStandardsQuery ?? "edit";
  const nextAction = engineeringLoopWorkStandardsNextAction(workStandards);
  return [
    "Work Standards:",
    \`Registry: \${workStandards?.registry ?? "openclaw-engineering-work-standards-v0"}\`,
    "Query: " + query,
    \`Status: \${workStandards?.status ?? "unknown"} satisfied=\${score.satisfied ?? 0}/\${score.required ?? 0} missing=\${score.missing ?? missing.length ?? 0}\`,
    \`Missing: \${missing.join(",") || "none"}\`,
    "Next Standards Action: " + nextAction,
    \`Operator Contract: approval=\${Boolean(workStandards?.operatorContract?.mutationRequiresApproval)} verification=\${Boolean(workStandards?.operatorContract?.completionShouldAttachVerificationEvidence)} promptWall=\${Boolean(workStandards?.operatorContract?.promptWallEnforced)}\`,
    "Boundary: standards are read-only guidance; no task, approval, operator step, mutation, prompt execution, or provider call is created.",
  ].join("\\n");
}

function renderEngineeringLoopWorkStandards(workStandards) {
  if (!latestEngineeringLoopControlState) {
    return;
  }
  latestEngineeringLoopControlState.workStandards = {
    registry: workStandards?.registry ?? "openclaw-engineering-work-standards-v0",
    query: workStandards?.query ?? latestEngineeringLoopControlState.workStandardsQuery ?? "edit",
    status: workStandards?.status ?? "unknown",
    score: workStandards?.score ?? {},
    missingRequiredStandards: workStandards?.missingRequiredStandards ?? [],
    nextAction: engineeringLoopWorkStandardsNextAction(workStandards),
  };
  engineeringLoopStateStandards.textContent = latestEngineeringLoopControlState.workStandards.status
    + " ("
    + latestEngineeringLoopControlState.workStandards.query
    + ")";
  engineeringLoopStateMissing.textContent = String(latestEngineeringLoopControlState.workStandards.missingRequiredStandards.length);
  engineeringLoopStateStandardsNext.textContent = latestEngineeringLoopControlState.workStandards.nextAction;
  const marker = "\\n\\nWork Standards:\\n";
  const existing = String(engineeringLoopStateJson.textContent ?? "");
  const base = existing.includes(marker) ? existing.split(marker)[0] : existing;
  engineeringLoopStateJson.textContent = [
    base,
    formatEngineeringLoopWorkStandards(workStandards),
  ].join("\\n\\n");
}

async function refreshEngineeringLoopWorkStandards() {
  if (!latestEngineeringLoopControlState?.taskId) {
    return;
  }
  const query = engineeringLoopWorkStandardsQuery(latestEngineeringLoopControlState.kind);
  latestEngineeringLoopControlState.workStandardsQuery = query;
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/prompt-semantics?query=\${encodeURIComponent(query)}&limit=24\`);
    renderEngineeringLoopWorkStandards({
      ...(data?.workStandards ?? data?.derivedPlanSemantics?.workStandards ?? {}),
      query,
    });
  } catch {
    renderEngineeringLoopWorkStandards({
      registry: "openclaw-engineering-work-standards-v0",
      query,
      status: "offline",
      score: { required: 0, satisfied: 0, missing: 0 },
      missingRequiredStandards: [],
      operatorContract: {
        mutationRequiresApproval: true,
        completionShouldAttachVerificationEvidence: true,
        promptWallEnforced: false,
      },
    });
  }
}

function renderEngineeringLoopControlState(kind, result) {
  const taskId = result.task?.id ?? "none";
  const approvalId = result.approval?.id ?? "none";
  const evidenceRoute = engineeringLoopEvidenceRoute(kind, result.task?.id ?? null);
  const suggestionLink = result.task?.engineeringPlanTodoSuggestionLink ?? null;
  latestEngineeringLoopControlState = {
    kind,
    taskId: result.task?.id ?? null,
    approvalId: result.approval?.id ?? null,
    evidenceRoute,
    suggestionLink,
    workStandardsQuery: engineeringLoopWorkStandardsQuery(kind),
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
    "Standards: pending query=" + latestEngineeringLoopControlState.workStandardsQuery,
    ...engineeringPlanTodoSuggestionLinkLines(suggestionLink),
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
    const symbolResponse = lifecycle.symbolRequest?.responseSummary ?? execution.server?.symbolResponseSummary ?? {};
    renderEngineeringLspTargetSelection(lifecycle.lifecycleAction === "symbol_request" ? symbolResponse : null);
    const selectedTargetIndex = engineeringLspSelectedTargetIndex();
    const selectedTargetReadBridgeRoute = lifecycle.lifecycleAction === "symbol_request" && symbolResponse.selectedTarget
      ? "/capabilities/invoke"
      : null;
    latestEngineeringLoopControlState.language = lifecycle.language ?? execution.language ?? "typescript";
    latestEngineeringLoopControlState.lifecycleAction = lifecycle.lifecycleAction ?? execution.lifecycleAction ?? "start";
    latestEngineeringLoopControlState.selectedTargetReadRoute = selectedTargetReadBridgeRoute;
    engineeringLoopStateCompletion.textContent = \`status=\${task?.status ?? "unknown"} lifecycle=\${lifecycleState.status ?? execution.result?.state ?? "unknown"}\`;
    engineeringLoopStateJson.textContent = [
      "Kind: lsp-lifecycle",
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Approval: \${latestEngineeringLoopControlState.approvalId ?? "none"}\`,
      \`Task Status: \${task?.status ?? "unknown"}\`,
      \`Action: \${lifecycle.lifecycleAction ?? execution.lifecycleAction ?? "start"} language=\${lifecycle.language ?? execution.language ?? "typescript"}\`,
      \`Server: \${lifecycle.server?.serverBinary ?? execution.server?.serverBinary ?? "unknown"} binaryFound=\${Boolean(execution.server?.binaryFound)} processStarted=\${Boolean(execution.server?.processStarted)} aliveAtProbe=\${Boolean(execution.server?.processAliveAtProbe)} terminated=\${Boolean(execution.server?.processTerminated)} jsonRpc=\${Boolean(execution.server?.jsonRpcHandshakeSent)} symbol=\${Boolean(execution.server?.symbolRequestSent)}\`,
      lifecycle.lifecycleAction === "symbol_request"
        ? \`Symbol Response: observed=\${Boolean(symbolResponse.observed)} kind=\${symbolResponse.resultKind ?? "missing"} results=\${symbolResponse.resultCount ?? 0} uris=\${symbolResponse.uriCount ?? 0} ranges=\${symbolResponse.rangeCount ?? 0} targets=\${symbolResponse.targetCount ?? 0} raw=\${Boolean(symbolResponse.rawResultIncluded)} rawTargets=\${Boolean(symbolResponse.rawTargetsIncluded)}\`
        : null,
      lifecycle.lifecycleAction === "symbol_request" && symbolResponse.selectedTarget
        ? \`Selected Target: uri=\${symbolResponse.selectedTarget.uri} start=\${symbolResponse.selectedTarget.range?.start?.line ?? "n/a"}:\${symbolResponse.selectedTarget.range?.start?.character ?? "n/a"} end=\${symbolResponse.selectedTarget.range?.end?.line ?? "n/a"}:\${symbolResponse.selectedTarget.range?.end?.character ?? "n/a"}\`
        : null,
      lifecycle.lifecycleAction === "symbol_request" && Array.isArray(symbolResponse.targets)
        ? \`Target Selection: index=\${selectedTargetIndex} total=\${symbolResponse.targets.length} explicit=true\`
        : null,
      selectedTargetReadBridgeRoute ? \`Selected Target Read Bridge: \${selectedTargetReadBridgeRoute}\` : null,
      \`Lifecycle State: \${lifecycleState.status ?? "pending"} active=\${Boolean(lifecycleState.process?.longLivedProcessActive)} jsonRpc=\${Boolean(lifecycleState.boundaries?.jsonRpcEnabled)}\`,
      \`Result: \${execution.result?.state ?? task?.outcome?.kind ?? "pending"}\`,
      \`Recovery: \${execution.recoveryRecommendation?.nextAction ?? task?.outcome?.details?.recoveryEvidence?.recommendation?.nextAction ?? "pending operator step"}\`,
      lifecycle.lifecycleAction === "symbol_request"
        ? "Boundary: approved execution may send didOpen plus one symbol request only; no long-lived process pool, mutation, provider call, or result envelope."
        : lifecycle.lifecycleAction === "source_transfer"
          ? "Boundary: approved execution may send initialize plus didOpen only; symbol requests require a separate approved task; no long-lived process pool, mutation, provider call, or result envelope."
          : "Boundary: approval-gated lifecycle process only; no long-lived process pool, source-content transfer, mutation, provider call, or result envelope.",
    ].filter(Boolean).join("\\n");
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
    ...engineeringPlanTodoSuggestionLinkLines(latestEngineeringLoopControlState.suggestionLink),
    "Boundary: readback only; no approval, execution, retry, recovery task, mutation, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Refreshed engineering loop completion evidence for \${latestEngineeringLoopControlState.taskId}.\`);
  await refreshEngineeringLoopControlSurfaces();
}

async function readEngineeringLoopSelectedTarget() {
  if (!latestEngineeringLoopControlState?.taskId || latestEngineeringLoopControlState.kind !== "lsp-lifecycle") {
    throw new Error("Create or restore an LSP lifecycle task first.");
  }
  const targetIndex = engineeringLspSelectedTargetIndex();
  const request = engineeringLspSelectedTargetReadCapabilityRequest(
    latestEngineeringLoopControlState.taskId,
    latestEngineeringLoopControlState.language ?? "typescript",
    targetIndex,
  );
  const route = "/capabilities/invoke";
  const response = await fetchJson(\`\${observerConfig.coreUrl}\${route}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (response.invoked !== true) {
    const reason = response.reason ?? "LSP selected-target read capability was not invoked.";
    engineeringLoopStateCompletion.textContent = \`blocked=\${reason}\`;
    engineeringLoopStateEvidence.textContent = route;
    engineeringLoopStateJson.textContent = [
      "Kind: lsp-selected-target-read",
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Capability: \${request.capabilityId}\`,
      \`Blocked: \${reason}\`,
      "Boundary: explicit read-only bridge; no task, approval, JSON-RPC, LSP process, mutation, provider call, or result envelope.",
    ].join("\\n");
    throw new Error(reason);
  }
  const bridge = response.result ?? {};
  if (!bridge.ok) {
    engineeringLoopStateCompletion.textContent = \`blocked=\${bridge.reason ?? "unknown"}\`;
    engineeringLoopStateEvidence.textContent = route;
    engineeringLoopStateJson.textContent = [
      "Kind: lsp-selected-target-read",
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Bridge: \${route}\`,
      \`Blocked: \${bridge.reason ?? "unknown"}\`,
      "Boundary: explicit read-only bridge; no task, approval, JSON-RPC, LSP process, mutation, provider call, or result envelope.",
    ].join("\\n");
    throw new Error(bridge.reason ?? "selected target read bridge blocked");
  }
  latestEngineeringLoopControlState.selectedTargetReadRoute = route;
  engineeringLoopStateNext.textContent = "review selected target read preview";
  engineeringLoopStateEvidence.textContent = route;
  engineeringLoopStateCompletion.textContent = \`target=\${bridge.target?.relativePath ?? "unknown"} lines=\${bridge.readResult?.summary?.lineCount ?? 0}\`;
  engineeringLoopStateJson.textContent = [
    "Kind: lsp-selected-target-read",
    \`Task: \${latestEngineeringLoopControlState.taskId}\`,
    \`Target Index: \${targetIndex}\`,
    \`Bridge: \${route}\`,
    \`Registry: \${bridge.registry ?? "unknown"}\`,
    \`Target: \${bridge.target?.relativePath ?? "unknown"} lines=\${bridge.target?.startLine ?? "n/a"}-\${bridge.target?.endLine ?? "n/a"}\`,
    \`Read: ok=\${Boolean(bridge.readResult?.ok)} chars=\${bridge.readResult?.summary?.charsReturned ?? 0} truncated=\${Boolean(bridge.readResult?.summary?.outputTruncated)}\`,
    \`Governance: content=\${Boolean(bridge.governance?.canReadWorkspaceContent)} startLsp=\${Boolean(bridge.governance?.canStartLspServer)} jsonRpc=\${Boolean(bridge.governance?.canSendJsonRpcRequest)} mutate=\${Boolean(bridge.governance?.canMutateWorkspace)} provider=\${Boolean(bridge.governance?.canCallProvider)}\`,
    \`Preview:\\n\${bridge.readResult?.content ?? ""}\`,
    "Boundary: explicit read-only bridge; no task, approval, JSON-RPC, LSP process, mutation, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Read selected LSP target \${bridge.target?.relativePath ?? "unknown"} through the bounded native read bridge.\`);
  await refreshEngineeringLoopControlSurfaces();
}

async function seedEngineeringLoopSelectedTargetEditProposal() {
  if (!latestEngineeringLoopControlState?.taskId || latestEngineeringLoopControlState.kind !== "lsp-lifecycle") {
    throw new Error("Create or restore an LSP lifecycle task first.");
  }
  const targetIndex = engineeringLspSelectedTargetIndex();
  const route = engineeringLspSelectedTargetEditProposalSeedRoute(
    latestEngineeringLoopControlState.taskId,
    latestEngineeringLoopControlState.language ?? "typescript",
    targetIndex,
  );
  const seed = await fetchJson(\`\${observerConfig.coreUrl}\${route}\`);
  if (!seed.ok) {
    engineeringLoopStateCompletion.textContent = \`blocked=\${seed.reason ?? "unknown"}\`;
    engineeringLoopStateEvidence.textContent = route;
    engineeringLoopStateJson.textContent = [
      "Kind: lsp-selected-target-edit-seed",
      \`Task: \${latestEngineeringLoopControlState.taskId}\`,
      \`Seed: \${route}\`,
      \`Blocked: \${seed.reason ?? "unknown"}\`,
      "Boundary: explicit read-only edit seed; no task, approval, patch apply, mutation, provider call, or result envelope.",
    ].join("\\n");
    throw new Error(seed.reason ?? "selected target edit seed blocked");
  }
  engineeringEditPathInput.value = seed.seed?.relativePath ?? engineeringEditPathInput.value;
  engineeringEditOldInput.value = seed.seed?.oldString ?? engineeringEditOldInput.value;
  engineeringEditNewInput.value = seed.seed?.oldString ?? engineeringEditNewInput.value;
  latestEngineeringLoopControlState.selectedTargetEditSeedRoute = route;
  engineeringLoopStateNext.textContent = "edit replacement text, then create edit task";
  engineeringLoopStateEvidence.textContent = route;
  engineeringLoopStateCompletion.textContent = \`seed=\${seed.seed?.relativePath ?? "unknown"} bytes=\${seed.seed?.oldStringBytes ?? 0}\`;
  engineeringLoopStateJson.textContent = [
    "Kind: lsp-selected-target-edit-seed",
    \`Task: \${latestEngineeringLoopControlState.taskId}\`,
    \`Target Index: \${targetIndex}\`,
    \`Seed: \${route}\`,
    \`Registry: \${seed.registry ?? "unknown"}\`,
    \`Target: \${seed.seed?.relativePath ?? "unknown"} oldBytes=\${seed.seed?.oldStringBytes ?? 0}\`,
    \`Edit Inputs: path=\${engineeringEditPathInput.value} oldBytes=\${String(engineeringEditOldInput.value ?? "").length} replacementPrefilled=true\`,
    \`Governance: editProposal=\${Boolean(seed.governance?.canBuildEditProposal)} task=\${Boolean(seed.governance?.canCreateTask)} approval=\${Boolean(seed.governance?.canCreateApproval)} mutate=\${Boolean(seed.governance?.canMutateWorkspace)}\`,
    "Next: modify the Replacement Text field, then use Create Edit Task for the existing approval-gated edit path.",
    "Boundary: explicit read-only edit seed; no task, approval, patch apply, mutation, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Seeded edit proposal inputs from LSP selected target \${seed.seed?.relativePath ?? "unknown"}.\`);
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
    language: result.engineeringLspLifecycle?.language ?? "typescript",
    lifecycleAction: result.engineeringLspLifecycle?.lifecycleAction ?? "start",
  };
  renderEngineeringLspTargetSelection(null);
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
    result.engineeringLspLifecycle?.lifecycleAction === "symbol_request"
      ? "Boundary: no auto-approval or process start before approval; approved execution may send didOpen plus one symbol request only; long-lived pools and provider calls remain blocked."
      : result.engineeringLspLifecycle?.lifecycleAction === "source_transfer"
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

async function createEngineeringLspSymbolRequestLoopTask(symbolAction = "definition") {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/lifecycle-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "typescript",
      lifecycleAction: "symbol_request",
      symbolAction,
      relativePath: "src/app.ts",
      line: 2,
      character: 14,
      confirm: true,
    }),
  });
  focusEngineeringLoopTask(result);
  renderEngineeringLspLifecycleLoopTaskState(result);
  setControlMessage(\`Created LSP \${symbolAction} request task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
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
  await refreshEngineeringLoopWorkStandards();
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
  engineeringLoopStateNext.textContent = state.nextGovernedActionSuggestion?.suggestion?.actionId ?? "use visible todo state to guide next governed action";
  engineeringLoopStateEvidence.textContent = evidenceRoute;
  engineeringLoopStateCompletion.textContent = \`todos=\${state.counts.total} pending=\${state.counts.pending}\`;
  engineeringLoopStateJson.textContent = [
    "Kind: planning-workbench",
    \`Task: \${state.taskId ?? "none"}\`,
    \`Todo Source: \${state.todoSource}\`,
    \`Todos: total=\${state.counts.total} done=\${state.counts.done} inProgress=\${state.counts.inProgress} pending=\${state.counts.pending}\`,
    \`Current: \${state.currentTodo?.id ?? "none"} \${state.currentTodo?.status ?? "none"}\`,
    \`Next Governed Action: \${state.nextGovernedActionSuggestion?.suggestion?.actionId ?? "none"} control=\${state.nextGovernedActionSuggestion?.suggestion?.existingObserverControlId ?? "none"} guidanceOnly=\${Boolean(state.nextGovernedActionSuggestion?.governance?.guidanceOnly)}\`,
    \`Evidence: \${evidenceRoute}\`,
    "Boundary: Observer workbench bridge only; no hidden planning mode, todo file write, task mutation, approval, command execution, provider call, or result envelope.",
  ].join("\\n");
  setControlMessage(\`Bridged engineering planning workbench state for \${state.taskId ?? "selected task"}.\`);
  await refreshEngineeringLoopControlSurfaces();
}

async function saveEngineeringPlanningWorkbenchState() {
  if (!latestEngineeringPlanTodoWorkbenchState) {
    await bridgeEngineeringPlanningWorkbenchState();
  }
  const state = latestEngineeringPlanTodoWorkbenchState;
  if (!state?.taskId) {
    throw new Error("No selected engineering planning task is available for workbench storage.");
  }

  const evidence = latestEngineeringPlanTodoEvidence ?? {};
  const todos = Array.isArray(evidence?.planningEvidence?.todoWrite?.items)
    ? evidence.planningEvidence.todoWrite.items
    : [];
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-plan-todo/workbench-state\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
      taskId: state.taskId,
      source: "observer_engineering_plan_todo_panel",
      planSummary: evidence?.planningEvidence?.enter?.summaryPreview ?? "",
      confirmedPlan: evidence?.planningEvidence?.exit?.confirmedPlanPreview ?? "",
      todos,
    }),
  });
  const evidenceRoute = \`/plugins/native-adapter/engineering-plan-todo/evidence?taskId=\${encodeURIComponent(state.taskId)}&limit=8\`;
  const refreshed = await fetchJson(\`\${observerConfig.coreUrl}\${evidenceRoute}\`);
  renderEngineeringPlanTodoEvidence(refreshed);
  latestEngineeringLoopControlState = {
    kind: "planning-workbench",
    taskId: state.taskId,
    approvalId: null,
    evidenceRoute,
  };
  engineeringLoopStateKind.textContent = "planning-workbench";
  engineeringLoopStateTask.textContent = state.taskId.slice(0, 8);
  engineeringLoopStateApproval.textContent = "none";
  engineeringLoopStateNext.textContent = refreshed.nextGovernedActionSuggestion?.suggestion?.actionId ?? "use persisted visible todo state to guide next governed action";
  engineeringLoopStateEvidence.textContent = evidenceRoute;
  engineeringLoopStateCompletion.textContent = \`storedTodos=\${result.record?.counts?.total ?? 0} revision=\${result.record?.revision ?? 0}\`;
  setControlMessage(\`Saved engineering planning workbench state for \${state.taskId}; revision \${result.record?.revision ?? "unknown"}.\`);
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
  restored.suggestionLink = task.engineeringPlanTodoSuggestionLink ?? null;
  restored.workStandardsQuery = engineeringLoopWorkStandardsQuery(restored.kind);
  latestEngineeringLoopControlState = restored;
  if (restored.kind === "lsp-lifecycle") {
    const lifecycle = task.engineeringLspLifecycle ?? {};
    const execution = task.outcome?.details?.lspLifecycleExecution ?? lifecycle.execution ?? {};
    renderEngineeringLspTargetSelection(
      lifecycle.symbolRequest?.responseSummary
        ?? execution.server?.symbolResponseSummary
        ?? null,
    );
  } else {
    renderEngineeringLspTargetSelection(null);
  }
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
    "Standards: pending query=" + latestEngineeringLoopControlState.workStandardsQuery,
    restored.verificationRoute ? \`Rerun Evidence: \${restored.verificationRoute}\` : null,
    \`Next: \${nextStepForRestoredEngineeringLoop(task, restored)}\`,
    ...engineeringPlanTodoSuggestionLinkLines(restored.suggestionLink),
    "Boundary: restoration is read-only; no task, approval, operator step, command, mutation, provider call, or result envelope is created.",
  ].filter(Boolean).join("\\n");
  await refreshEngineeringLoopWorkStandards();
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
  await refreshEngineeringLspEvidence();
  await refreshEngineeringLoopWorkStandards();
}

async function createEngineeringEditLoopApprovalTask(engineeringPlanTodoSuggestionLink = null) {
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
      engineeringPlanTodoSuggestionLink,
      confirm: true,
    }),
  });

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("edit", result);
  setControlMessage(\`Created approval-gated engineering edit task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshWorkspacePatchApplyDraft();
}

async function createEngineeringWriteLoopApprovalTask(engineeringPlanTodoSuggestionLink = null) {
  const input = readEngineeringWriteLoopInput();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-write-proposal-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: input.relativePath,
      content: \`\${input.content}\\n\`,
      overwrite: true,
      contextLines: 1,
      engineeringPlanTodoSuggestionLink,
      confirm: true,
    }),
  });

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("write", result);
  setControlMessage(\`Created approval-gated engineering write task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshWorkspaceTextWriteDraft();
}

async function createEngineeringVerificationLoopApprovalTask(engineeringPlanTodoSuggestionLink = null) {
  const input = readEngineeringVerificationLoopInput();
  const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.openclaw.engineering_tool.verify",
      params: {
        proposalId: input.proposalId,
        query: input.query,
        engineeringPlanTodoSuggestionLink,
        confirm: true,
      },
    }),
  });
  if (response.invoked !== true) {
    throw new Error(response.reason ?? "Engineering verification task capability was not invoked.");
  }
  const result = response.result ?? {};

  focusEngineeringLoopTask(result);
  renderEngineeringLoopControlState("verification", result);
  setControlMessage(\`Created approval-gated engineering verification task \${result.task?.id ?? "unknown"}; approval and operator step are still required.\`);
  await refreshEngineeringLoopControlSurfaces();
  await refreshSourceCommandPlanDraft();
}

`;
