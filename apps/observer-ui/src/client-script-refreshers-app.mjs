import { observerClientMvpPhaseRefreshersScript } from "./client-script-refreshers-mvp-phases.mjs";
import { observerClientMemoryPhaseRefreshersScript } from "./client-script-refreshers-memory-phases.mjs";
import { observerClientWorkspaceSourceRefreshersScript } from "./client-script-refreshers-workspace-source.mjs";
import { observerClientEngineeringContextRefreshersScript } from "./client-script-refreshers-engineering-context.mjs";
import { observerClientEngineeringProviderHandoffRefreshersScript } from "./client-script-refreshers-engineering-provider-handoff.mjs";
export const observerClientAppRefreshersScript = `async function refreshOperatorState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/operator/state\`);
    renderOperatorState(data.operator);
    if (operatorLoopJson.textContent === "No operator run yet." || operatorLoopJson.textContent === "Unable to read operator state.") {
      operatorLoopJson.textContent = [
        \`Status: \${data.operator?.status ?? "idle"}\`,
        \`Blocked: \${Boolean(data.operator?.blocked)}\`,
        \`Reason: \${data.operator?.reason ?? "none"}\`,
        \`Next Task: \${data.operator?.nextTask?.id ?? "none"}\`,
      ].join("\\n");
    }
  } catch {
    operatorLoopStatus.textContent = "offline";
    operatorLoopBlocked.textContent = "unknown";
    operatorLoopNext.textContent = "unknown";
    operatorLoopJson.textContent = "Unable to read operator state.";
  }
}

async function refreshPolicyState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/policy/state\`);
    renderPolicyState(data.policy);
  } catch {
    policyEngine.textContent = "offline";
    policyDecision.textContent = "unknown";
    policyDomain.textContent = "unknown";
    policyJson.textContent = "Unable to read policy state.";
  }
}

async function refreshApprovalState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/approvals?limit=10\`);
    renderApprovalState(data);
  } catch {
    latestPendingApproval = null;
    approvalPendingCount.textContent = "0";
    approvalLatest.textContent = "unknown";
    approvalJson.textContent = "Unable to read approval inbox.";
  }
}

async function refreshCapabilityState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/capabilities\`);
    renderCapabilityState(data);
  } catch {
    capabilityRegistry.textContent = "offline";
    capabilityOnline.textContent = "0";
    capabilityApproval.textContent = "unknown";
    capabilityJson.textContent = "Unable to read body capabilities.";
  }
}

async function refreshCapabilityHistory() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invocations?limit=8\`);
    renderCapabilityHistory(data);
  } catch {
    capabilityHistoryTotal.textContent = "0";
    capabilityHistoryInvoked.textContent = "0";
    capabilityHistoryBlocked.textContent = "0";
    capabilityHistoryLatest.textContent = "unknown";
    capabilityHistoryJson.textContent = "Unable to read capability invocation history.";
  }
}

async function refreshCommandLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/commands/transcripts?limit=8\`);
    renderCommandLedger(data);
  } catch {
    commandLedgerTotal.textContent = "0";
    commandLedgerExecuted.textContent = "0";
    commandLedgerFailed.textContent = "0";
    commandLedgerSkipped.textContent = "0";
    commandLedgerTasks.textContent = "unknown";
    commandLedgerJson.textContent = "Unable to read command transcript ledger.";
  }
}

async function refreshEngineeringVerificationEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-verification/evidence?limit=8&maxOutputChars=2000\`);
    renderEngineeringVerificationEvidence(data);
  } catch {
    engineeringVerificationRegistry.textContent = "offline";
    engineeringVerificationPassed.textContent = "0";
    engineeringVerificationFailed.textContent = "0";
    engineeringVerificationAttached.textContent = "0";
    engineeringVerificationExecution.textContent = "unknown";
    engineeringVerificationJson.textContent = "Unable to read native engineering verification evidence.";
  }
}

async function refreshEngineeringRecoveryEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-recovery/evidence?limit=8&maxOutputChars=2000\`);
    renderEngineeringRecoveryEvidence(data);
  } catch {
    engineeringRecoveryRegistry.textContent = "offline";
    engineeringRecoveryFailures.textContent = "0";
    engineeringRecoveryRecoverable.textContent = "0";
    engineeringRecoveryRecovered.textContent = "0";
    engineeringRecoveryExecution.textContent = "unknown";
    engineeringRecoveryAction.textContent = "none";
    engineeringRecoveryActionJson.textContent = "Unable to draft native engineering recovery action.";
    engineeringRecoveryJson.textContent = "Unable to read native engineering recovery evidence.";
  }
}

async function refreshEngineeringMicrocompactEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-microcompact/evidence?limit=8&thresholdChars=1000&protectRecentItems=3\`);
    renderEngineeringMicrocompactEvidence(data);
  } catch {
    engineeringMicrocompactRegistry.textContent = "offline";
    engineeringMicrocompactItems.textContent = "0";
    engineeringMicrocompactCompactable.textContent = "0";
    engineeringMicrocompactReclaimed.textContent = "0";
    engineeringMicrocompactMutation.textContent = "unknown";
    engineeringMicrocompactJson.textContent = "Unable to read native engineering microcompact evidence.";
  }
}

async function refreshEngineeringPlanTodoEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-plan-todo/evidence?limit=8\`);
    renderEngineeringPlanTodoEvidence(data);
  } catch {
    engineeringPlanTodoRegistry.textContent = "offline";
    engineeringPlanTodoTasks.textContent = "0";
    engineeringPlanTodoTodos.textContent = "0";
    engineeringPlanTodoDone.textContent = "0";
    engineeringPlanTodoMutation.textContent = "unknown";
    engineeringPlanTodoWorkbench.textContent = "none";
    engineeringPlanTodoWorkbenchJson.textContent = "Unable to bridge native engineering planning workbench state.";
    engineeringPlanTodoJson.textContent = "Unable to read native engineering plan/todo evidence.";
  }
}

async function refreshFilesystemLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/filesystem/changes?limit=8\`);
    renderFilesystemLedger(data);
  } catch {
    filesystemLedgerTotal.textContent = "0";
    filesystemLedgerMkdir.textContent = "0";
    filesystemLedgerWrites.textContent = "0";
    filesystemLedgerTasks.textContent = "unknown";
    filesystemLedgerJson.textContent = "Unable to read filesystem change ledger.";
  }
}

async function refreshFilesystemReadLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/filesystem/reads?limit=8\`);
    renderFilesystemReadLedger(data);
  } catch {
    filesystemReadLedgerTotal.textContent = "0";
    filesystemReadLedgerMetadata.textContent = "0";
    filesystemReadLedgerQuery.textContent = "0";
    filesystemReadLedgerReadText.textContent = "0";
    filesystemReadLedgerTasks.textContent = "unknown";
    filesystemReadLedgerJson.textContent = "Unable to read filesystem read ledger.";
  }
}

${observerClientWorkspaceSourceRefreshersScript}async function invokeCapabilityFromUi(kind) {
  const requests = {
    vitals: {
      capabilityId: "sense.system.vitals",
      intent: "system.observe",
    },
    process: {
      capabilityId: "sense.process.list",
      intent: "process.list",
      params: { limit: 10 },
    },
    commandDryRun: {
      capabilityId: "act.system.command.dry_run",
      intent: "system.command",
      params: { command: "rm", args: ["-rf", "/tmp/openclaw-danger"] },
    },
    approvedCommandDryRun: {
      capabilityId: "act.system.command.dry_run",
      intent: "system.command",
      approved: true,
      params: { command: "rm", args: ["-rf", "/tmp/openclaw-danger"] },
    },
  };
  const body = requests[kind];
  if (!body) {
    throw new Error(\`Unknown capability invocation kind: \${kind}\`);
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  renderCapabilityInvocation(result);
  setControlMessage(result.invoked
    ? \`Capability invoked: \${result.capability?.id ?? body.capabilityId}\`
    : \`Capability blocked: \${result.reason ?? "unknown"}\`);
  await refreshCapabilityState();
  await refreshCapabilityHistory();
  await refreshPolicyState();
  await refreshAuditState();
}

async function resolveLatestApproval(action) {
  if (!latestPendingApproval?.id) {
    throw new Error("No pending approval request.");
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/approvals/\${latestPendingApproval.id}/\${action}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reason: action === "approve" ? "Approved from Observer UI." : "Denied from Observer UI.",
    }),
  });
  setControlMessage(\`Approval \${action} completed: \${result.approval?.id ?? latestPendingApproval.id}\`);
  await refreshApprovalState();
  await refreshPolicyState();
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

function renderTaskSummary(task, { includeRecovery = true, includeOutcome = true } = {}) {
  if (!task) {
    return "No task selected.";
  }

  const taskLastAction = deriveTaskLastAction(task);
  const lines = [
    \`ID: \${task.id}\`,
    \`Goal: \${task.goal}\`,
    \`Type: \${task.type}\`,
    \`Status: \${task.status}\`,
    \`Phase: \${task.executionPhase ?? "queued"}\`,
    \`Target URL: \${task.targetUrl ?? "none"}\`,
    \`Work View Strategy: \${task.workViewStrategy ?? "none"}\`,
    \`Work View Session: \${task.workView?.sessionId ?? "none"}\`,
    \`Work View URL: \${task.workView?.activeUrl ?? "none"}\`,
    \`Work View: \${task.workView?.status ?? "none"} / \${task.workView?.visibility ?? "none"}\`,
    \`Policy: \${task.policy?.decision?.decision ?? "none"} / \${task.policy?.decision?.domain ?? "none"}\`,
    \`Task Lens: \${describeTaskRelationship(task)}\`,
  ];

  if (includeOutcome) {
    lines.push(\`Outcome: \${task.outcome?.kind ?? "open"}\${task.outcome?.summary ? \` - \${task.outcome.summary}\` : ""}\`);
    if (task.outcome?.reason) {
      lines.push(\`Failure Reason: \${task.outcome.reason}\`);
    }
    const trustedWorkViewAuthority = task.outcome?.details?.trustedWorkViewAuthority ?? null;
    if (trustedWorkViewAuthority) {
      lines.push("Trusted Work-View Authority: "
        + (trustedWorkViewAuthority.authorityRevoked === true ? "revoked" : "unknown")
        + " / " + (trustedWorkViewAuthority.actionAuthority ?? "unknown"));
    }
    const taskVerification = task.outcome?.details?.verification ?? null;
    const taskWorkViewSummary = task.outcome?.details?.workViewSummary ?? taskVerification?.workViewSummary ?? null;
    const taskActionEvidence = task.outcome?.details?.actionEvidence ?? taskVerification?.actionEvidence ?? null;
    const taskRecoveryEvidence = task.outcome?.details?.recoveryEvidence ?? task.recovery?.recoveryEvidence ?? null;
    const taskPostExecutionVerification = task.outcome?.details?.postExecutionVerification ?? null;
    if (taskVerification) {
      lines.push(\`Verification: \${taskVerification.ok === true ? "passed" : taskVerification.ok === false ? "failed" : "unknown"}\`);
    }
    if (taskWorkViewSummary) {
      lines.push(\`Verification Work View Summary: \${taskWorkViewSummary.summaryText ?? "none"}\`);
      lines.push(\`Verification Work View URL: \${taskWorkViewSummary.url ?? "none"}\`);
      lines.push(\`Verification Visible Text: \${(taskWorkViewSummary.visibleTextBlocks ?? []).join(" | ") || "none"}\`);
    }
    if (taskActionEvidence) {
      lines.push(\`Action Evidence: \${taskActionEvidence.actionCount ?? 0} action(s), degraded=\${taskActionEvidence.degradedCount ?? 0}\`);
      lines.push(\`Action Evidence Observed URL: \${taskActionEvidence.observedAfterActions?.url ?? "none"}\`);
      lines.push(\`Action Evidence Kinds: \${(taskActionEvidence.actions ?? []).map((action) => action.kind).join(" -> ") || "none"}\`);
    }
    if (taskRecoveryEvidence) {
      lines.push(\`Recovery Evidence: \${taskRecoveryEvidence.reason ?? "none"}\`);
      lines.push(\`Recovery Evidence Observed URL: \${taskRecoveryEvidence.observedUrl ?? "none"}\`);
      lines.push(\`Recovery Recommendation: \${taskRecoveryEvidence.recommendation?.strategy ?? "none"} -> \${taskRecoveryEvidence.recommendation?.targetUrl ?? "none"}\`);
    }
    if (taskPostExecutionVerification) {
      const summary = taskPostExecutionVerification.summary ?? {};
      lines.push(\`Post Execution Verification: \${taskPostExecutionVerification.registry ?? "unknown"} / \${taskPostExecutionVerification.mode ?? "unknown"}\`);
      lines.push(\`Post Verification Unit: \${taskPostExecutionVerification.targetUnit ?? "unknown"} before=\${summary.beforeActiveState ?? "unknown"} after=\${summary.afterActiveState ?? "unknown"}\`);
      lines.push(\`Post Verification Health: beforeServiceOk=\${summary.beforeServiceOk ?? "unknown"} afterServiceOk=\${summary.afterServiceOk ?? "unknown"} noAutomaticRecovery=\${Boolean(summary.noAutomaticRecovery)}\`);
    }
    if (task.bodyEvidenceLedgerFirstRecord) {
      const firstRecord = task.bodyEvidenceLedgerFirstRecord;
      lines.push(\`Body Evidence Ledger First Record: \${firstRecord.plannedRecordType ?? "unknown"} appended=\${Boolean(firstRecord.recordAppended)} storageWritten=\${Boolean(firstRecord.durableStorageWritten)}\`);
      lines.push(\`Body Evidence Ledger File: \${firstRecord.ledgerFileDisplayPath ?? "pending"} recordId=\${firstRecord.recordId ?? "pending"} hash=\${firstRecord.contentHash ?? "pending"}\`);
    }
    if (task.bodyEvidenceLedgerFollowupRecord) {
      const followupRecord = task.bodyEvidenceLedgerFollowupRecord;
      lines.push(\`Body Evidence Ledger Follow-up Record: \${followupRecord.plannedRecordType ?? "unknown"} sequence=\${followupRecord.plannedSequence ?? "unknown"} appended=\${Boolean(followupRecord.recordAppended)} storageWritten=\${Boolean(followupRecord.durableStorageWritten)}\`);
      lines.push(\`Body Evidence Ledger Follow-up File: \${followupRecord.ledgerFileDisplayPath ?? "pending"} recordId=\${followupRecord.recordId ?? "pending"} previous=\${followupRecord.previousRecordId ?? "pending"} hash=\${followupRecord.contentHash ?? "pending"}\`);
    }
  }

  if (includeRecovery) {
    lines.push(\`Recovery: \${task.recovery?.recoveredFromTaskId ? \`attempt \${task.recovery?.attempt ?? 1} from \${task.recovery.recoveredFromTaskId}\` : "original task"}\`);
    lines.push(\`Recovered By: \${task.recoveredByTaskId ?? "none"}\`);
    lines.push(\`Recoverable: \${task.restorable ? "yes" : "no"}\`);
  }

  if (task.plan) {
    const steps = Array.isArray(task.plan.steps) ? task.plan.steps : [];
    const completed = steps.filter((step) => step.status === "completed").length;
    lines.push(\`Plan: \${task.plan.strategy ?? "unknown"} / \${task.plan.status ?? "unknown"}\`);
    lines.push(\`Plan Steps: \${completed}/\${steps.length} completed\`);
  }

  lines.push(\`Last Action: \${taskLastAction?.kind ?? "none"}\${taskLastAction ? \` (degraded: \${taskLastAction.degraded})\` : ""}\`);
  lines.push(\`Recent Phases: \${(task.phaseHistory ?? []).slice(-4).map((entry) => entry.phase).join(" -> ") || "none"}\`);
  lines.push(\`Created: \${formatTimestamp(task.createdAt)}\`);
  lines.push(\`Updated: \${formatTimestamp(task.updatedAt)}\`);
  lines.push(\`Closed: \${formatTimestamp(task.closedAt)}\`);
  return lines.join("\\n");
}

function describeTaskRelationship(task) {
  if (!task) {
    return "none";
  }

  if (task.isCurrentTask) {
    return "current active task";
  }

  if (currentTaskState?.recovery?.recoveredFromTaskId === task.id) {
    return "ancestor of current recovered task";
  }

  if (task.recoveredByTaskId && task.recoveredByTaskId === currentTaskState?.id) {
    return "recovered into current active task";
  }

  if (task.isActive) {
    return "active task";
  }

  if (currentTaskState?.workView?.sessionId && task.workView?.sessionId === currentTaskState.workView.sessionId) {
    return "shares work view session with current task";
  }

  return "historical task";
}

function renderTaskSection(title, tasks) {
  if (!tasks.length) {
    return "";
  }

  return \`<section class="task-section">
    <h3>\${escapeHtml(title)}</h3>
    \${tasks.map((task) => renderTaskCard(task)).join("")}
  </section>\`;
}

function getDesiredWorkViewUrl() {
  return desiredWorkViewUrl || "https://example.com/work-view";
}

function getSelectedHistoryTaskId() {
  const value = taskDetailIdInput.value.trim();
  return value || null;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { ok: false, error: await response.text() };

  if (!response.ok) {
    throw new Error(payload?.error ?? \`Request failed with status \${response.status}\`);
  }

  return payload;
}

function addEventItem(event) {
  const item = document.createElement("li");
  item.textContent = \`[\${event.timestamp}] \${event.type} from \${event.source}\`;
  eventsList.prepend(item);
  while (eventsList.children.length > 30) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

async function refreshHealth() {
  try {
    const [core, hub, sessionManager, screen, screenAct, systemSense, systemHeal] = await Promise.all([
      fetchJson(\`\${observerConfig.coreUrl}/health\`),
      fetchJson(\`\${observerConfig.eventHubUrl}/health\`),
      fetchJson(\`\${observerConfig.sessionManagerUrl}/health\`),
      fetchJson(\`\${observerConfig.screenSenseUrl}/health\`),
      fetchJson(\`\${observerConfig.screenActUrl}/health\`),
      fetchJson(\`\${observerConfig.systemSenseUrl}/health\`),
      fetchJson(\`\${observerConfig.systemHealUrl}/health\`),
    ]);

    setHealthPill(coreHealth, !!core.ok, core.ok ? "healthy" : "unhealthy");
    setHealthPill(eventhubHealth, !!hub.ok, hub.ok ? "healthy" : "unhealthy");
    setHealthPill(sessionManagerHealth, !!sessionManager.ok, sessionManager.ok ? "healthy" : "unhealthy");
    setHealthPill(screenHealth, !!screen.ok, screen.ok ? "healthy" : "unhealthy");
    setHealthPill(screenActHealth, !!screenAct.ok, screenAct.ok ? "healthy" : "unhealthy");
    setHealthPill(systemHealthPill, !!systemSense.ok, systemSense.ok ? "healthy" : "unhealthy");
    setHealthPill(systemHealHealth, !!systemHeal.ok, systemHeal.ok ? "healthy" : "unhealthy");
  } catch (error) {
    setHealthPill(coreHealth, false, "offline");
    setHealthPill(eventhubHealth, false, "offline");
    setHealthPill(sessionManagerHealth, false, "offline");
    setHealthPill(screenHealth, false, "offline");
    setHealthPill(screenActHealth, false, "offline");
    setHealthPill(systemHealthPill, false, "offline");
    setHealthPill(systemHealHealth, false, "offline");
  }
}

${observerClientMvpPhaseRefreshersScript}${observerClientMemoryPhaseRefreshersScript}${observerClientEngineeringContextRefreshersScript}${observerClientEngineeringProviderHandoffRefreshersScript}`;
