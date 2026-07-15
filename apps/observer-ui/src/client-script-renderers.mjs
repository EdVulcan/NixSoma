import { observerClientWorkspaceSourceRenderersScript } from "./client-script-renderers-workspace-source.mjs";
import { observerClientEngineeringEditRenderersScript } from "./client-script-renderers-engineering-edit.mjs";
import { observerClientEngineeringWriteRenderersScript } from "./client-script-renderers-engineering-write.mjs";
import { observerClientEngineeringWriteExecutionRenderersScript } from "./client-script-renderers-engineering-write-execution.mjs";
import { observerClientEngineeringLspRenderersScript } from "./client-script-renderers-engineering-lsp.mjs";
import { observerClientEngineeringMicrocompactRenderersScript } from "./client-script-renderers-engineering-microcompact.mjs";
import { observerClientEngineeringPlanTodoRenderersScript } from "./client-script-renderers-engineering-plan-todo.mjs";
import { observerClientEngineeringRecoveryRenderersScript } from "./client-script-renderers-engineering-recovery.mjs";
import { observerClientEngineeringVerificationRenderersScript } from "./client-script-renderers-engineering-verification.mjs";
import { observerClientNativeRuntimeRefreshRenderersScript } from "./client-script-renderers-native-runtime-refresh.mjs";
import { observerClientAcpxCodexBridgeRenderersScript } from "./client-script-renderers-acpx-codex-bridge.mjs";
import { observerClientEngineeringContextRenderersScript } from "./client-script-renderers-engineering-context.mjs";
import { observerClientEngineeringProviderHandoffRenderersScript } from "./client-script-renderers-engineering-provider-handoff.mjs";
export const observerClientRenderersScript = `function setHealthPill(target, ok, text) {
  target.textContent = text;
  target.className = ok ? "status-pill" : "status-pill warn";
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatTaskFocusLabel(focus, task = null) {
  if (focus === "current-task") {
    return task?.id ? \`Viewing current task \${task.id}.\` : "Viewing current task.";
  }
  if (focus === "latest-failed") {
    return task?.id ? \`Viewing latest failed task \${task.id}.\` : "Viewing latest failed task.";
  }
  if (focus === "selected-task") {
    return task?.id ? \`Viewing selected task \${task.id}.\` : "Viewing selected task.";
  }
  return task?.id ? \`Viewing latest finished task \${task.id}.\` : "Viewing latest finished task.";
}

function setControlMessage(message) {
  controlResult.textContent = message;
}

function updateDesiredUrlHint(activeUrl = null) {
  const hintTail = activeUrl ? \`Current active URL: \${activeUrl}\` : "Current active URL: none";
  workViewUrlHint.textContent = desiredWorkViewUrlPinned
    ? \`Pinned desired URL for the next action. \${hintTail}\`
    : \`Desired URL follows the active work view until you pin a new one. \${hintTail}\`;
}

function setDesiredWorkViewUrl(url, { pinned = true } = {}) {
  const nextUrl = typeof url === "string" && url.trim() ? url.trim() : "https://example.com/work-view";
  desiredWorkViewUrl = nextUrl;
  desiredWorkViewUrlPinned = pinned;
  workViewUrlInput.value = nextUrl;
}

function followActiveWorkViewUrl() {
  const nextUrl = latestWorkViewState?.activeUrl ?? latestWorkViewState?.entryUrl ?? "https://example.com/work-view";
  setDesiredWorkViewUrl(nextUrl, { pinned: false });
  updateDesiredUrlHint(latestWorkViewState?.activeUrl ?? latestWorkViewState?.entryUrl ?? null);
  setControlMessage(\`Following active work view URL: \${nextUrl}\`);
}

function deriveTaskLastAction(task) {
  if (task?.lastAction) {
    return task.lastAction;
  }

  const fallback = latestActionState?.lastAction ?? null;
  if (!fallback) {
    return null;
  }

  const taskSessionId = task?.workView?.sessionId ?? null;
  const actionSessionId = fallback.screenContext?.sessionId ?? null;

  if (taskSessionId && actionSessionId && taskSessionId === actionSessionId) {
    return {
      kind: fallback.kind ?? "unknown",
      degraded: Boolean(fallback.degraded),
      at: fallback.executedAt ?? null,
      result: fallback.result ?? null,
    };
  }

  return null;
}

function renderTaskPlan(plan) {
  if (!plan) {
    return "No task plan selected.";
  }

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const capabilitySummary = plan.capabilitySummary ?? {};
  return [
    \`Plan ID: \${plan.planId ?? "none"}\`,
    \`Strategy: \${plan.strategy ?? "unknown"}\`,
    \`Planner: \${plan.planner ?? "unknown"}\`,
    \`Status: \${plan.status ?? "unknown"}\`,
    \`Intent: \${plan.intent ?? "unknown"}\`,
    \`Target URL: \${plan.targetUrl ?? "none"}\`,
    \`Steps: \${steps.length}\`,
    \`Capabilities: \${capabilitySummary.total ?? 0} (\${(capabilitySummary.ids ?? []).join(", ") || "none"})\`,
    \`Approval Gates: \${capabilitySummary.approvalGates ?? 0}\`,
    "",
    ...steps.map((step, index) => {
      const status = step.status ?? "pending";
      const title = step.title ?? step.kind ?? step.phase ?? \`step \${index + 1}\`;
      const phase = step.phase ?? "unknown";
      const capability = step.capabilityId ?? "unmapped";
      const risk = step.risk ?? "unknown";
      const governance = step.governance ?? "unknown";
      const approval = step.requiresApproval ? " approval-required" : "";
      return \`\${index + 1}. [\${status}] \${phase} - \${title} :: capability=\${capability} risk=\${risk} governance=\${governance}\${approval}\`;
    }),
  ].join("\\n");
}

function renderPlanPanel(task) {
  const plan = task?.plan ?? null;
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  taskPlanStatus.textContent = plan?.status ?? "none";
  taskPlanCount.textContent = String(steps.length);
  taskPlanPlanner.textContent = plan?.planner ?? plan?.strategy ?? "none";
  taskPlanCapabilityCount.textContent = String(plan?.capabilitySummary?.total ?? 0);
  taskPlanApprovalGates.textContent = String(plan?.capabilitySummary?.approvalGates ?? 0);
  taskPlanJson.textContent = renderTaskPlan(plan);
}

function renderOperatorState(operator) {
  const nextTask = operator?.nextTask ?? null;
  operatorLoopStatus.textContent = operator?.status ?? "idle";
  operatorLoopBlocked.textContent = String(operator?.blocked ?? false);
  operatorLoopNext.textContent = nextTask?.id ? nextTask.id.slice(0, 8) : "none";
}

function renderPolicyState(policy) {
  const lastDecision = Array.isArray(policy?.decisions) ? policy.decisions[0] : null;
  policyEngine.textContent = policy?.engine ?? "policy-v0";
  policyDecision.textContent = lastDecision?.decision ?? "none";
  policyDomain.textContent = lastDecision?.domain ?? "none";
  policyAuditCount.textContent = String(policy?.counts?.total ?? 0);
  policyJson.textContent = [
    \`Mode: \${policy?.mode ?? "unknown"}\`,
    \`Body Internal Default: \${policy?.rules?.bodyInternalDefault ?? "unknown"}\`,
    \`User Task Default: \${policy?.rules?.userTaskDefault ?? "unknown"}\`,
    \`Cross Boundary Default: \${policy?.rules?.crossBoundaryDefault ?? "unknown"}\`,
    \`Decisions: \${policy?.counts?.total ?? 0}\`,
    "",
    ...(policy?.decisions ?? []).slice(0, 6).map((decision) => {
      return \`[\${formatTimestamp(decision.at)}] \${decision.decision} \${decision.domain} \${decision.subject?.intent ?? "unknown"} - \${decision.reason}\`;
    }),
  ].join("\\n");
}

function renderApprovalState(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const pendingItems = items.filter((approval) => approval.status === "pending");
  latestPendingApproval = pendingItems[0] ?? null;
  approvalPendingCount.textContent = String(data?.summary?.pendingCount ?? pendingItems.length);
  approvalLatest.textContent = latestPendingApproval?.id ? latestPendingApproval.id.slice(0, 8) : "none";
  approvalJson.textContent = [
    \`Total: \${data?.summary?.counts?.total ?? 0}\`,
    \`Pending: \${data?.summary?.counts?.pending ?? 0}\`,
    \`Approved: \${data?.summary?.counts?.approved ?? 0}\`,
    \`Denied: \${data?.summary?.counts?.denied ?? 0}\`,
    "",
    ...items.slice(0, 6).map((approval) => {
      return \`[\${approval.status}] \${approval.id} task=\${approval.taskId ?? "none"} \${approval.intent ?? "unknown"} risk=\${approval.risk ?? "unknown"} reason=\${approval.reason ?? "none"}\`;
    }),
  ].join("\\n");
}

function renderCapabilityState(registry) {
  const capabilities = Array.isArray(registry?.capabilities) ? registry.capabilities : [];
  const summary = registry?.summary ?? {};
  const topCapabilities = capabilities
    .slice()
    .sort((left, right) => String(left.kind).localeCompare(String(right.kind)) || String(left.id).localeCompare(String(right.id)))
    .slice(0, 8);

  capabilityRegistry.textContent = registry?.registry ?? "capability-v0";
  capabilityOnline.textContent = \`\${summary.online ?? 0}/\${summary.total ?? 0}\`;
  capabilityApproval.textContent = String(summary.requiresApproval ?? 0);
  capabilityJson.textContent = [
    \`Mode: \${registry?.mode ?? "unknown"}\`,
    \`Kinds: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Risks: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: \${Object.entries(summary.byGovernance ?? {}).map(([rule, count]) => \`\${rule}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...topCapabilities.map((capability) => {
      return \`[\${capability.status ?? "unknown"}] \${capability.id} \${capability.kind} \${capability.risk} governance=\${capability.governance}\`;
    }),
  ].join("\\n");
}

function renderCapabilityInvocation(result) {
  if (!result) {
    capabilityInvokeJson.textContent = "No capability invocation yet.";
    return;
  }

  capabilityInvokeJson.textContent = [
    \`Capability: \${result.capability?.id ?? "unknown"}\`,
    \`Invoked: \${Boolean(result.invoked)}\`,
    \`Blocked: \${Boolean(result.blocked)}\`,
    \`Reason: \${result.reason ?? "none"}\`,
    \`Policy: \${result.policy?.decision ?? "none"} / \${result.policy?.domain ?? "unknown"} / risk=\${result.policy?.risk ?? "unknown"}\`,
    \`Summary: \${JSON.stringify(result.summary ?? {}, null, 2)}\`,
  ].join("\\n");
}

function renderCapabilityHistory(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  capabilityHistoryTotal.textContent = String(summary.total ?? 0);
  capabilityHistoryInvoked.textContent = String(summary.invoked ?? 0);
  capabilityHistoryBlocked.textContent = String(summary.blocked ?? 0);
  capabilityHistoryLatest.textContent = summary.latestAt ? formatTimestamp(summary.latestAt) : "none";
  capabilityHistoryJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Invoked: \${summary.invoked ?? 0}\`,
    \`Blocked: \${summary.blocked ?? 0}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const state = entry.blocked ? "blocked" : entry.invoked ? "invoked" : "recorded";
      const decision = entry.policy?.decision ?? "unknown";
      const reason = entry.reason ?? entry.policy?.reason ?? "none";
      return \`[\${formatTimestamp(entry.at)}] \${state} \${entry.capability?.id ?? "unknown"} policy=\${decision} reason=\${reason}\`;
    }),
  ].join("\\n");
}

function extractTaskCommandTranscript(task) {
  return Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
}

function renderCommandTranscript(transcript, { source = "task" } = {}) {
  const entries = Array.isArray(transcript) ? transcript : [];
  const skipped = entries.filter((entry) => entry.skipped === true);
  const executed = entries.filter((entry) => entry.skipped !== true);
  const failed = executed.filter((entry) => entry.timedOut === true || (Number.isInteger(entry.exitCode) && entry.exitCode !== 0));

  commandTranscriptCount.textContent = String(entries.length);
  commandTranscriptExecuted.textContent = String(executed.length);
  commandTranscriptSkipped.textContent = String(skipped.length);
  commandTranscriptFailed.textContent = String(failed.length);

  if (entries.length === 0) {
    commandTranscriptJson.textContent = "No command transcript yet.";
    return;
  }

  commandTranscriptJson.textContent = [
    \`Source: \${source}\`,
    \`Entries: \${entries.length} executed=\${executed.length} skipped=\${skipped.length} failed=\${failed.length}\`,
    "",
    ...entries.map((entry, index) => {
      const state = entry.skipped === true
        ? \`skipped:\${entry.skipReason ?? "condition"}\`
        : entry.timedOut === true
          ? "failed:timeout"
          : Number.isInteger(entry.exitCode) && entry.exitCode !== 0
            ? \`failed:exit_\${entry.exitCode}\`
            : "executed";
      const stdout = String(entry.stdout ?? "").trim();
      const stderr = String(entry.stderr ?? "").trim();
      return [
        \`\${index + 1}. [\${state}] \${entry.command ?? "unknown"} exit=\${entry.exitCode ?? "n/a"}\`,
        stdout ? \`   stdout: \${stdout}\` : null,
        stderr ? \`   stderr: \${stderr}\` : null,
      ].filter(Boolean).join("\\n");
    }),
  ].join("\\n");
}

function renderCommandTranscriptFromTask(task, { source = "task" } = {}) {
  renderCommandTranscript(extractTaskCommandTranscript(task), { source });
}

function renderCommandLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  commandLedgerTotal.textContent = String(summary.total ?? 0);
  commandLedgerExecuted.textContent = String(summary.executed ?? 0);
  commandLedgerFailed.textContent = String(summary.failed ?? 0);
  commandLedgerSkipped.textContent = String(summary.skipped ?? 0);
  commandLedgerTasks.textContent = String(summary.taskCount ?? 0);

  commandLedgerJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Executed: \${summary.executed ?? 0}\`,
    \`Failed: \${summary.failed ?? 0}\`,
    \`Skipped: \${summary.skipped ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Command: \${Object.entries(summary.byCommand ?? {}).map(([command, count]) => \`\${command}=\${count}\`).join(", ") || "none"}\`,
    \`By Task Status: \${Object.entries(summary.byTaskStatus ?? {}).map(([status, count]) => \`\${status}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const state = entry.state ?? (entry.skipped ? "skipped" : "executed");
      const stdout = String(entry.stdout ?? "").trim();
      return \`[\${state}] task=\${entry.taskId ?? "none"} \${entry.command ?? "unknown"} exit=\${entry.exitCode ?? "n/a"} skip=\${entry.skipReason ?? "none"}\${stdout ? \` stdout=\${stdout}\` : ""}\`;
    }),
  ].join("\\n");
}

function renderFilesystemLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  filesystemLedgerTotal.textContent = String(summary.total ?? 0);
  filesystemLedgerMkdir.textContent = String(summary.mkdir ?? 0);
  filesystemLedgerWrites.textContent = String(summary.write_text ?? 0);
  filesystemLedgerTasks.textContent = String(summary.taskCount ?? 0);

  filesystemLedgerJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Mkdir: \${summary.mkdir ?? 0}\`,
    \`Writes: \${summary.write_text ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      return \`[\${entry.change ?? "unknown"}] task=\${entry.taskId ?? "none"} \${entry.path ?? "unknown"} bytes=\${entry.contentBytes ?? "n/a"} created=\${entry.created ?? "n/a"}\`;
    }),
  ].join("\\n");
}

function renderFilesystemReadLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const queryReads = (summary.list ?? 0) + (summary.search ?? 0);
  filesystemReadLedgerTotal.textContent = String(summary.total ?? 0);
  filesystemReadLedgerMetadata.textContent = String(summary.metadata ?? 0);
  filesystemReadLedgerQuery.textContent = String(queryReads);
  filesystemReadLedgerReadText.textContent = String(summary.read_text ?? 0);
  filesystemReadLedgerTasks.textContent = String(summary.taskCount ?? 0);

  filesystemReadLedgerJson.textContent = [
    "Content: not displayed or stored in the read ledger.",
    \`Total: \${summary.total ?? 0}\`,
    \`Metadata: \${summary.metadata ?? 0}\`,
    \`List: \${summary.list ?? 0}\`,
    \`Search: \${summary.search ?? 0}\`,
    \`Read Text: \${summary.read_text ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      return \`[\${entry.operation ?? "read"}] task=\${entry.taskId ?? "none"} \${entry.path ?? "unknown"} count=\${entry.count ?? "n/a"} bytes=\${entry.contentBytes ?? "n/a"} encoding=\${entry.encoding ?? "n/a"}\`;
    }),
  ].join("\\n");
}

${observerClientWorkspaceSourceRenderersScript}${observerClientEngineeringEditRenderersScript}${observerClientEngineeringWriteRenderersScript}${observerClientEngineeringWriteExecutionRenderersScript}${observerClientEngineeringLspRenderersScript}${observerClientEngineeringVerificationRenderersScript}${observerClientEngineeringRecoveryRenderersScript}${observerClientEngineeringMicrocompactRenderersScript}${observerClientEngineeringPlanTodoRenderersScript}${observerClientEngineeringContextRenderersScript}${observerClientEngineeringProviderHandoffRenderersScript}${observerClientNativeRuntimeRefreshRenderersScript}${observerClientAcpxCodexBridgeRenderersScript}function renderNativePluginContract(data) {
  const summary = data?.summary ?? {};
  const contract = data?.contract ?? {};
  const governance = summary.governance ?? contract.governance ?? {};
  const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
  const validation = data?.validation ?? {};
  nativePluginContractRegistry.textContent = data?.registry ?? "openclaw-native-plugin-contract-v0";
  nativePluginContractOwner.textContent = summary.runtimeOwner ?? governance.runtimeOwner ?? "unknown";
  nativePluginContractTotal.textContent = String(summary.totalCapabilities ?? capabilities.length);
  nativePluginContractApproval.textContent = String(summary.approvalRequired ?? 0);
  nativePluginContractMutation.textContent = String(summary.mutationCapable ?? 0);
  nativePluginContractValidation.textContent = validation.ok === true || summary.validationOk === true ? "valid" : "invalid";

  nativePluginContractJson.textContent = [
    "Contract-only native plugin boundary: no plugin code is imported, registered, activated, or executed here.",
    "This is the OpenClawOnNixOS-owned shape that absorbed OpenClaw ideas must satisfy before runtime use.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "contract-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-plugin-sdk-contract-review-v0"}\`,
    \`Runtime Owner: \${summary.runtimeOwner ?? governance.runtimeOwner ?? "unknown"}\`,
    \`Origin: \${summary.origin ?? governance.origin ?? "unknown"}\`,
    \`Capabilities: \${summary.totalCapabilities ?? capabilities.length}\`,
    \`Approval Required: \${summary.approvalRequired ?? 0}\`,
    \`Mutation Capable: \${summary.mutationCapable ?? 0}\`,
    \`Execution Capable: \${summary.executionCapable ?? 0}\`,
    \`Validation: \${validation.ok === true || summary.validationOk === true ? "ok" : "failed"} issues=\${summary.issueCount ?? validation.issues?.length ?? 0}\`,
    \`Governance: externalRuntimeDependencyAllowed=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceContentImported=\${Boolean(governance.sourceContentImported)} executeDuringRegistration=\${Boolean(governance.canExecuteDuringRegistration)}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    "",
    \`Guardrails: \${(summary.guardrails ?? []).join("; ") || "none"}\`,
    "",
    ...capabilities.slice(0, 8).map((capability) => {
      const permissions = capability.permissions ?? {};
      return \`[\${capability.risk ?? "unknown"}] \${capability.id ?? "capability"} kind=\${capability.kind ?? "unknown"} domains=\${(capability.domains ?? []).join(",") || "none"} approval=\${Boolean(capability.approval?.required)} audit=\${Boolean(capability.audit?.required)} command=\${Boolean(permissions.commandExecution)} mutate=\${Boolean(permissions.filesystemWrite || permissions.browserControl || permissions.screenControl || permissions.systemMutation)} owner=\${capability.runtimeOwner ?? "unknown"}\`;
    }),
  ].join("\\n");
}

function renderNativePluginRegistry(data) {
  const summary = data?.summary ?? {};
  const governance = summary.governance ?? data?.governance ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const validation = data?.validation ?? {};
  nativePluginRegistryId.textContent = data?.registry ?? "openclaw-native-plugin-registry-v0";
  nativePluginRegistryTotal.textContent = String(summary.totalPlugins ?? items.length);
  nativePluginRegistryCapabilities.textContent = String(summary.totalCapabilities ?? 0);
  nativePluginRegistryActivation.textContent = data?.activationMode ?? "manual_adapter_required";
  nativePluginRegistryValidation.textContent = validation.ok === true || summary.validationOk === true ? "valid" : "invalid";

  nativePluginRegistryJson.textContent = [
    "Native registry: OpenClawOnNixOS-owned contracts that are eligible for adapter implementation.",
    "Runtime activation is still disabled here; this registry is the controlled starting line.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-registry-v0"}\`,
    \`Mode: \${data?.mode ?? "native-contract-registry"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Activation Mode: \${data?.activationMode ?? "manual_adapter_required"}\`,
    \`Plugins: \${summary.totalPlugins ?? items.length}\`,
    \`Capabilities: \${summary.totalCapabilities ?? 0}\`,
    \`Approval Required: \${summary.approvalRequired ?? 0}\`,
    \`Mutation Capable: \${summary.mutationCapable ?? 0}\`,
    \`Execution Capable: \${summary.executionCapable ?? 0}\`,
    \`Validation: \${validation.ok === true || summary.validationOk === true ? "ok" : "failed"} issues=\${summary.issueCount ?? validation.issues?.length ?? 0}\`,
    \`Governance: externalRuntimeDependencyAllowed=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceContentImported=\${Boolean(governance.sourceContentImported)} canActivateRuntime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    \`Guardrails: \${(summary.guardrails ?? []).join("; ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((item) => {
      const plugin = item.contract?.plugin ?? {};
      const pluginSummary = summary.byPlugin?.[item.id] ?? {};
      return \`[\${item.status ?? "unknown"}] \${plugin.id ?? item.id ?? "plugin"} name=\${plugin.name ?? "unknown"} capabilities=\${pluginSummary.totalCapabilities ?? item.contract?.capabilities?.length ?? 0} approval=\${pluginSummary.approvalRequired ?? 0} mutate=\${pluginSummary.mutationCapable ?? 0} execute=\${pluginSummary.executionCapable ?? 0}\`;
    }),
  ].join("\\n");
}

function renderFormalIntegrationReadiness(data) {
  const summary = data?.summary ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  integrationReadinessRegistry.textContent = data?.registry ?? "openclaw-formal-integration-readiness-v0";
  integrationReadinessStatus.textContent = data?.status ?? "unknown";
  integrationReadinessRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  integrationReadinessRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  integrationReadinessMode.textContent = data?.mode ?? "readiness-only";

  integrationReadinessJson.textContent = [
    "Readiness gate: formal adapter work may begin only after required governance gates pass.",
    "This does not import source, execute plugin code, activate runtime, create tasks, or create approvals.",
    \`Registry: \${data?.registry ?? "openclaw-formal-integration-readiness-v0"}\`,
    \`Mode: \${data?.mode ?? "readiness-only"}\`,
    \`Status: \${data?.status ?? "unknown"}\`,
    \`Ready For Formal Integration: \${Boolean(data?.readyForFormalIntegration)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"}\`,
    \`Import Source Content: \${Boolean(summary.canImportSourceContent)}\`,
    \`Execute Plugin Code: \${Boolean(summary.canExecutePluginCode)}\`,
    \`Creates Task: \${Boolean(summary.createsTask)} Creates Approval: \${Boolean(summary.createsApproval)}\`,
    \`Sources: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginAdapter(data) {
  const summary = data?.summary ?? {};
  nativePluginAdapterRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  nativePluginAdapterStatus.textContent = data?.status ?? "unknown";
  nativePluginAdapterImplemented.textContent = String(summary.implemented ?? data?.implementedCapabilities?.length ?? 0);
  nativePluginAdapterRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginAdapterMode.textContent = data?.mode ?? "native-adapter-shell";

  nativePluginAdapterJson.textContent = [
    "Native adapter shell: first real adapter capability is available, but runtime activation remains disabled.",
    "Implemented adapter reads only reviewed plugin SDK manifest metadata and never reads source contents or executes plugin code.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "native-adapter-shell"}\`,
    \`Status: \${data?.status ?? "unknown"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Implemented: \${(data?.implementedCapabilities ?? []).join(", ") || "none"}\`,
    \`Pending: \${(data?.pendingCapabilities ?? []).join(", ") || "none"}\`,
    \`Read Manifest Metadata: \${Boolean(summary.canReadManifestMetadata)}\`,
    \`Read Source Content: \${Boolean(summary.canReadSourceFileContent)}\`,
    \`Execute Plugin Code: \${Boolean(summary.canExecutePluginCode)}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"}\`,
    \`Creates Task: \${Boolean(summary.createsTask)} Creates Approval: \${Boolean(summary.createsApproval)}\`,
    "",
    \`Guardrails: \${(data?.guardrails ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginPreflight(data) {
  const governance = data?.governance ?? {};
  const envelope = data?.executionEnvelope ?? {};
  const adapter = data?.adapter ?? {};
  const capability = data?.capability ?? {};
  const approval = envelope.approval ?? {};
  const constraints = envelope.constraints ?? {};
  nativePluginPreflightRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-preflight-v0";
  nativePluginPreflightEnvelope.textContent = envelope.envelopeVersion ?? "unknown";
  nativePluginPreflightApproval.textContent = approval.required ? "required" : "not required";
  nativePluginPreflightRuntime.textContent = adapter.canActivateRuntime ? "enabled" : "disabled";
  nativePluginPreflightMode.textContent = data?.mode ?? "preflight-only";

  nativePluginPreflightJson.textContent = [
    "Runtime preflight: builds the governed execution envelope before any plugin module can be loaded.",
    "This still does not create tasks, create approvals, import modules, execute plugin code, mutate state, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-preflight-v0"}\`,
    \`Mode: \${data?.mode ?? "preflight-only"}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Adapter: \${adapter.id ?? "unknown"} status=\${adapter.status ?? "unknown"} owner=\${adapter.runtimeOwner ?? "unknown"}\`,
    \`Plugin: \${data?.plugin?.id ?? "unknown"} package=\${data?.plugin?.packageName ?? "unknown"}\`,
    \`Capability: \${capability.id ?? "unknown"} risk=\${capability.risk ?? "unknown"} approval=\${Boolean(capability.approvalRequired)}\`,
    \`Policy: \${envelope.policyDecision?.decision ?? "unknown"} reason=\${envelope.policyDecision?.reason ?? "none"}\`,
    \`Audit: required=\${Boolean(envelope.audit?.required)} ledger=\${envelope.audit?.ledger ?? "unknown"}\`,
    \`Constraints: importModule=\${Boolean(constraints.canImportModule)} executePlugin=\${Boolean(constraints.canExecutePluginCode)} activateRuntime=\${Boolean(constraints.canActivateRuntime)} mutate=\${Boolean(constraints.canMutate)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposesScripts=\${Boolean(governance.exposesScriptBodies)} exposesDeps=\${Boolean(governance.exposesDependencyVersions)}\`,
  ].join("\\n");
}

function renderNativePluginActivationPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  const envelope = data?.executionEnvelope ?? {};
  nativePluginActivationRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-activation-plan-v0";
  nativePluginActivationStatus.textContent = data?.status ?? "unknown";
  nativePluginActivationRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  nativePluginActivationRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginActivationMode.textContent = data?.mode ?? "activation-plan-only";

  nativePluginActivationJson.textContent = [
    "Runtime activation plan: records the remaining gates before native plugin runtime can be activated.",
    "This still does not create tasks, create approvals, import modules, execute plugin code, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-activation-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "activation-plan-only"}\`,
    \`Status: \${data?.status ?? "unknown"} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"} importModule=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposesScripts=\${Boolean(governance.exposesScriptBodies)} exposesDeps=\${Boolean(governance.exposesDependencyVersions)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginRuntimeAdapterContract(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const contract = data?.runtimeContract ?? {};
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  nativePluginRuntimeContractRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-adapter-contract-v0";
  nativePluginRuntimeContractStatus.textContent = data?.status ?? "unknown";
  nativePluginRuntimeContractRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  nativePluginRuntimeContractRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginRuntimeContractMode.textContent = data?.mode ?? "runtime-adapter-contract";

  nativePluginRuntimeContractJson.textContent = [
    "Native runtime adapter contract: defines the sandboxed loader boundary before any plugin module can be loaded.",
    "This is contract-only: it creates no task, approval, module import, plugin execution, runtime activation, or mutation.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-adapter-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "runtime-adapter-contract"}\`,
    \`Status: \${data?.status ?? "unknown"} adapterReady=\${Boolean(summary.adapterContractReady)} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Checks: \${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Plugin: \${data?.plugin?.id ?? "unknown"} package=\${data?.plugin?.packageName ?? "unknown"} capability=\${data?.capability?.id ?? "unknown"}\`,
    \`Contract: \${contract.contractVersion ?? "unknown"} state=\${contract.state ?? "unknown"} approvalRequired=\${Boolean(contract.approval?.required)} collected=\${Boolean(contract.approval?.collected)}\`,
    \`Isolation: process=\${Boolean(contract.isolation?.processIsolationRequired)} oldModuleImport=\${Boolean(contract.isolation?.oldOpenClawModuleImportAllowed)} pluginImport=\${Boolean(contract.isolation?.pluginModuleImportAllowed)} secretsMounted=\${Boolean(contract.isolation?.secretsMounted)}\`,
    \`Execution: import=\${Boolean(contract.execution?.canImportModule)} pluginCode=\${Boolean(contract.execution?.canExecutePluginCode)} activateRuntime=\${Boolean(contract.execution?.canActivateRuntime)} mutate=\${Boolean(contract.execution?.canMutate)}\`,
    \`Privacy: readme=\${Boolean(contract.privacy?.readmeContentExposed)} source=\${Boolean(contract.privacy?.sourceFileContentExposed)} scripts=\${Boolean(contract.privacy?.scriptBodiesExposed)} deps=\${Boolean(contract.privacy?.dependencyVersionsExposed)} packageVersion=\${Boolean(contract.privacy?.packageVersionExposed)}\`,
    \`Governance: task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} import=\${Boolean(governance.canImportModule)} execute=\${Boolean(governance.canExecutePluginCode)} runtime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    ...checks.map((check) => {
      const required = check.required ? "required" : "optional";
      return \`[\${check.status ?? "unknown"}/\${required}] \${check.id ?? "check"} :: \${check.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginInvokePlan(data) {
  const governance = data?.governance ?? {};
  const policyDecision = data?.policy?.decision ?? {};
  const capability = data?.capability ?? {};
  const plugin = data?.plugin ?? {};
  const steps = Array.isArray(data?.draft?.steps) ? data.draft.steps : [];
  nativePluginInvokePlanRegistry.textContent = data?.registry ?? "openclaw-native-plugin-invoke-plan-v0";
  nativePluginInvokePlanCapability.textContent = capability.id ?? "act.plugin.capability.invoke";
  nativePluginInvokePlanDecision.textContent = policyDecision.decision ?? "unknown";
  nativePluginInvokePlanRuntime.textContent = governance.canActivateRuntime ? "enabled" : "disabled";
  nativePluginInvokePlanMode.textContent = data?.mode ?? "plan-only";

  nativePluginInvokePlanJson.textContent = [
    "Plan-only draft for high-risk plugin capability invocation; no task, approval, runtime activation, or plugin execution is created here.",
    "This is the approval-gate shape that future runtime adapter work must pass through.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-invoke-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Plugin: \${plugin.id ?? "unknown"} package=\${plugin.packageName ?? "unknown"}\`,
    \`Capability: \${capability.id ?? "unknown"} risk=\${capability.risk ?? "unknown"} approval=\${Boolean(capability.approvalRequired)}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} domain=\${policyDecision.domain ?? "unknown"}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} readSource=\${Boolean(governance.canReadSourceFileContent)}\`,
    \`Manifest Metadata: exports=\${(plugin.exportKeys ?? []).join(",") || "none"} scripts=\${(plugin.scriptNames ?? []).join(",") || "none"} deps=\${plugin.dependencySummary?.dependencies ?? 0}\`,
    "",
    ...steps.map((step) => \`[\${step.status ?? "unknown"}] \${step.id ?? "step"} execute=\${Boolean(step.canExecute)}\`),
    "",
    \`Blockers: \${(data?.blockers ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderWorkspaceCommandProposals(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceCommandRegistry.textContent = data?.registry ?? "workspace-command-proposals-v0";
  workspaceCommandTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceCommandValidation.textContent = String(summary.byCategory?.validation ?? 0);
  workspaceCommandBuild.textContent = String(summary.byCategory?.build ?? 0);
  workspaceCommandRuntime.textContent = String(summary.byCategory?.runtime ?? 0);
  workspaceCommandMode.textContent = data?.mode ?? "proposal-only";

  workspaceCommandJson.textContent = [
    "Proposal-only: command shapes are visible, execution remains disabled here.",
    "Script bodies are not displayed.",
    \`Registry: \${data?.registry ?? "workspace-command-proposals-v0"}\`,
    \`Mode: \${data?.mode ?? "proposal-only"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Workspaces: \${summary.workspaces ?? 0}\`,
    \`By Package Manager: \${Object.entries(summary.byPackageManager ?? {}).map(([manager, count]) => \`\${manager}=\${count}\`).join(", ") || "none"}\`,
    \`By Category: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const commandShape = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].filter(Boolean).join(" ");
      const governance = entry.governance ?? {};
      return \`[\${entry.risk ?? "unknown"}] \${entry.workspaceName ?? "workspace"}:\${entry.scriptName ?? "script"} \${commandShape} cwd=\${entry.cwd ?? "unknown"} execute=\${Boolean(governance.canExecute)} approval=\${Boolean(governance.requiresExplicitExecutionApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`;
    }),
  ].join("\\n");
}

function renderSourceCommandProposals(data) {
  const summary = data?.summary ?? {};
  const signals = data?.sourceCommandSignals ?? {};
  const toolSignals = signals.toolSignals ?? {};
  const promptSignals = signals.promptSignals ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  sourceCommandRegistry.textContent = data?.registry ?? "openclaw-source-command-proposals-v0";
  sourceCommandTotal.textContent = String(summary.total ?? data?.count ?? 0);
  sourceCommandTools.textContent = String(summary.matchedTools ?? toolSignals.matchedTools ?? 0);
  sourceCommandPrompts.textContent = String(summary.promptSemanticFiles ?? promptSignals.matchedFiles ?? 0);
  sourceCommandMode.textContent = data?.mode ?? "proposal-only-source-absorbed";

  sourceCommandJson.textContent = [
    "Source-derived command proposals: enhanced OpenClaw tool/prompt signals are absorbed into command proposal metadata only.",
    "No command is executed, no task is created, and script/prompt/source bodies remain hidden.",
    \`Registry: \${data?.registry ?? "openclaw-source-command-proposals-v0"}\`,
    \`Mode: \${data?.mode ?? "proposal-only-source-absorbed"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "workspace-command-proposals-v0"}\`,
    \`Query: \${data?.query?.text ?? "command"} limit=\${data?.query?.limit ?? 12}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Source Signals: registry=\${signals.registry ?? "openclaw-source-command-proposals-v0"} tools=\${toolSignals.matchedTools ?? 0} docs=\${toolSignals.matchedDocumentation ?? 0} promptFiles=\${promptSignals.matchedFiles ?? 0} commandVocabularyFiles=\${promptSignals.commandVocabularyFiles ?? 0}\`,
    \`Governance: execute=\${Boolean(data?.governance?.canExecute)} mutate=\${Boolean(data?.governance?.canMutate)} createsTask=\${Boolean(data?.governance?.createsTask)} createsApproval=\${Boolean(data?.governance?.createsApproval)} scriptBody=\${Boolean(data?.governance?.exposesScriptBodies)} prompt=\${Boolean(data?.governance?.exposesPromptContent)} source=\${Boolean(data?.governance?.exposesSourceFileContent)}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const commandShape = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].filter(Boolean).join(" ");
      const sourceCommand = entry.sourceCommand ?? {};
      const governance = entry.governance ?? {};
      return \`[\${entry.risk ?? "unknown"}] \${entry.workspaceName ?? "workspace"}:\${entry.scriptName ?? "script"} \${commandShape} source=\${sourceCommand.registry ?? "none"} absorbed=\${Boolean(sourceCommand.absorbedFromEnhancedOpenClaw)} execute=\${Boolean(governance.canExecute)} task=\${Boolean(governance.canCreateTaskFromSourceAbsorption)} approval=\${Boolean(governance.requiresExplicitExecutionApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`;
    }),
  ].join("\\n");
}

function renderSourceCommandPlanDraft(data) {
  const proposal = data?.sourceCommandProposal ?? data?.proposal ?? {};
  const sourceCommandPlan = data?.sourceCommandPlan ?? {};
  const signals = data?.sourceCommandSignals ?? {};
  const draft = data?.draft ?? {};
  const governance = data?.governance ?? draft.governance ?? {};
  const policyDecision = draft.policy?.decision ?? {};
  const action = draft.action ?? {};
  const params = action.params ?? {};
  const commandShape = [params.command, ...(Array.isArray(params.args) ? params.args : [])].filter(Boolean).join(" ");
  sourceCommandPlanRegistry.textContent = data?.registry ?? "openclaw-source-command-plan-draft-v0";
  sourceCommandPlanProposal.textContent = proposal.id ?? "none";
  sourceCommandPlanDecision.textContent = policyDecision.decision ?? "unknown";
  sourceCommandPlanTask.textContent = String(governance.createsTask ?? false);
  sourceCommandPlanMode.textContent = data?.mode ?? "plan-only-source-command";

  sourceCommandPlanJson.textContent = [
    "Source-derived command plan: converts enhanced OpenClaw command proposal metadata into an inert approval-gated plan draft.",
    "No task, approval, shell, or process execution is created here.",
    \`Registry: \${data?.registry ?? "openclaw-source-command-plan-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only-source-command"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-command-proposals-v0"}\`,
    \`Proposal: \${proposal.id ?? "none"} source=\${proposal.sourceCommand?.registry ?? "none"} absorbed=\${Boolean(proposal.sourceCommand?.absorbedFromEnhancedOpenClaw)}\`,
    \`Command: \${commandShape || "none"} cwd=\${params.cwd ?? "unknown"} shell=\${Boolean(sourceCommandPlan.commandShape?.usesShell)}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} risk=\${policyDecision.risk ?? proposal.risk ?? "unknown"}\`,
    \`Signals: registry=\${signals.registry ?? "openclaw-source-command-proposals-v0"} tools=\${signals.toolSignals?.matchedTools ?? 0} prompts=\${signals.promptSignals?.matchedFiles ?? 0} commandVocabulary=\${signals.promptSignals?.commandVocabularyFiles ?? 0}\`,
    \`Governance: execute=\${Boolean(governance.canExecute)} mutate=\${Boolean(governance.canMutate)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} scriptBody=\${Boolean(governance.exposesScriptBodies ?? governance.exposesScriptBody)} prompt=\${Boolean(governance.exposesPromptContent)} source=\${Boolean(governance.exposesSourceFileContent)} explicitApproval=\${Boolean(governance.requiresExplicitApprovalBeforeExecution ?? governance.requiresExplicitApproval)}\`,
    \`Capabilities: \${(draft.plan?.capabilitySummary?.ids ?? []).join(", ") || "none"}\`,
    \`Approval Gates: \${draft.plan?.capabilitySummary?.approvalGates ?? 0}\`,
  ].join("\\n");
}

function renderWorkspaceCommandPlanDraft(data) {
  const draft = data?.draft ?? {};
  const proposal = data?.proposal ?? {};
  const governance = draft.governance ?? {};
  const policyDecision = draft.policy?.decision ?? {};
  const action = draft.action ?? {};
  const params = action.params ?? {};
  const commandShape = [params.command, ...(Array.isArray(params.args) ? params.args : [])].filter(Boolean).join(" ");
  workspaceCommandPlanRegistry.textContent = data?.registry ?? "workspace-command-plan-draft-v0";
  workspaceCommandPlanProposal.textContent = proposal.id ?? "none";
  workspaceCommandPlanDecision.textContent = policyDecision.decision ?? "unknown";
  workspaceCommandPlanApproval.textContent = governance.requiresExplicitApproval ? "required" : "not required";
  workspaceCommandPlanTask.textContent = String(governance.createsTask ?? false);
  workspaceCommandPlanMode.textContent = data?.mode ?? "plan-only";

  workspaceCommandPlanJson.textContent = [
    "Plan-only draft: no task, approval, or command execution is created.",
    "Script bodies are not displayed.",
    \`Registry: \${data?.registry ?? "workspace-command-plan-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Proposal: \${proposal.id ?? "none"}\`,
    \`Command: \${commandShape || "none"}\`,
    \`Cwd: \${params.cwd ?? "unknown"}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} risk=\${policyDecision.risk ?? proposal.risk ?? "unknown"}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} execute=\${Boolean(governance.canExecute)} explicitApproval=\${Boolean(governance.requiresExplicitApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`,
    \`Capabilities: \${(draft.plan?.capabilitySummary?.ids ?? []).join(", ") || "none"}\`,
    \`Approval Gates: \${draft.plan?.capabilitySummary?.approvalGates ?? 0}\`,
  ].join("\\n");
}

function renderOperatorPanel(result) {
  if (!result) {
    renderOperatorState(null);
    operatorLoopRan.textContent = "none";
    operatorLoopCount.textContent = "0";
    operatorLoopJson.textContent = "No operator run yet.";
    return;
  }

  const steps = Array.isArray(result.steps) ? result.steps : result.task ? [result] : [];
  const operator = result.operator ?? null;
  const nextTask = result.nextTask ?? operator?.nextTask ?? null;
  const latestCommandTranscript = steps
    .map((step) => step.execution?.commandTranscript)
    .find((transcript) => Array.isArray(transcript) && transcript.length > 0);
  renderOperatorState({
    status: operator?.status ?? (result.blocked ? "paused" : result.ran ? "ran" : "idle"),
    blocked: result.blocked ?? operator?.blocked ?? false,
    nextTask,
  });
  operatorLoopRan.textContent = result.ran ? "yes" : "no";
  operatorLoopCount.textContent = String(result.count ?? steps.length);
  operatorLoopJson.textContent = [
    \`Ran: \${Boolean(result.ran)}\`,
    \`Blocked: \${Boolean(result.blocked ?? operator?.blocked)}\`,
    \`Reason: \${result.reason ?? operator?.reason ?? "none"}\`,
    \`Steps: \${result.count ?? steps.length}\`,
    \`Runtime: \${result.summary?.runtime?.status ?? result.summary?.status ?? "unknown"}\`,
    \`Next Task: \${nextTask?.id ?? "none"}\`,
    "",
    ...steps.map((step, index) => {
      const task = step.task ?? null;
      const verification = step.execution?.verification ?? null;
      return \`\${index + 1}. \${task?.id ?? "no-task"} \${task?.status ?? "idle"} phase=\${task?.executionPhase ?? "none"} \${task?.targetUrl ?? ""} verification=\${verification?.ok ?? "n/a"}\`;
    }),
  ].join("\\n");
  if (latestCommandTranscript) {
    renderCommandTranscript(latestCommandTranscript, { source: "operator" });
  }
}

`;
