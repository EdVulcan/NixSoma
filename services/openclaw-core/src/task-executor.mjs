import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function createTaskExecutor(deps) {
  const { client, state, taskManager, planBuilder, approvalEngine, workspaceOps, policyEvaluator, publishEvent } = deps;
  const {
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenSenseUrl,
    screenActUrl,
    systemSenseUrl,
  } = client;
  const {
    tasks,
    persistState,
    approvals,
    policyAuditLog,
    capabilityInvocationLog,
    runtimeState,
    updateRuntimeState,
    getCurrentTask,
    SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS,
    SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_RESTART_HELPER_SUDO,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
  } = state;
  const {
    serialiseTask,
    createTask,
    isActiveTask,
    hasRecoverableCapabilityPlan,
    hasRecoverableNativePluginRuntimeActivationPlan,
    hasRecoverableSearchWebAdapterPlan,
    getTaskById,
    appendTaskPhase,
    setTaskPhase,
    attachTaskToWorkView,
    buildWorkViewAttachPayload,
    completeTask,
    failTask,
    reconcileRuntimeState,
    getNextQueuedTask,
    buildTaskSummary,
  } = taskManager;
  const {
    serialisePlanForPublic,
    updatePlanForPhase,
    invokeCapability,
    isLongTermMemoryWriteTask,
    executeLongTermMemoryWriteTask,
    isCloudConsciousnessHandoffTask,
    executeCloudConsciousnessHandoffTask,
    isCloudConsciousnessProviderDryRunTask,
    executeCloudConsciousnessProviderDryRunTask,
    isCloudConsciousnessProviderCallRehearsalTask,
    executeCloudConsciousnessProviderCallRehearsalTask,
    isCloudConsciousnessLiveProviderRunbookTask,
    executeCloudConsciousnessLiveProviderRunbookTask,
    isCloudConsciousnessLiveProviderExecutionPlanTask,
    executeCloudConsciousnessLiveProviderExecutionPlanTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterTask,
    isCloudConsciousnessLiveProviderRuntimeImplementationTask,
    executeCloudConsciousnessLiveProviderRuntimeImplementationTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask,
    isCloudConsciousnessLiveProviderRequestBuilderTask,
    executeCloudConsciousnessLiveProviderRequestBuilderTask,
    capabilityById,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
  } = planBuilder;
  const { serialiseApproval, buildApprovalSummary, createApprovalRequestForTask, publishTaskApprovalIfPending } = approvalEngine;
  const { applyWorkspacePatchEdits, readBoundedWorkspaceTextFile } = workspaceOps;
  const { ensureTaskPolicy, recordPolicyDecision, evaluatePolicyIntent, isPolicyExecutionAllowed } = policyEvaluator;

  // L10299-10323
function buildOperatorState() {
  reconcileRuntimeState();
  const currentTask = getCurrentTask();
  const nextTask = getNextQueuedTask();
  const paused = runtimeState.paused === true;
  return {
    status: paused ? "paused" : nextTask ? "ready" : "idle",
    blocked: paused,
    reason: paused ? "runtime_paused" : null,
    currentTask: currentTask ? serialiseTask(currentTask) : null,
    nextTask: nextTask ? serialiseTask(nextTask) : null,
    policy: {
      respectsPause: true,
      enforcesTaskPolicy: true,
      defaultMaxSteps: 5,
      maxStepsLimit: 20,
      supportsDryRun: true,
      controls: ["pause", "resume", "stop", "takeover"],
      decisions: ["allow", "audit_only", "require_approval", "deny"],
    },
    approvals: buildApprovalSummary(),
    summary: buildTaskSummary(),
  };
}


  // L19586-22450
function normaliseExecutorActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-task-executor" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      params: action.params && typeof action.params === "object" ? action.params : {},
    }));
}

const OPERATOR_INVOKABLE_CAPABILITIES = new Set([
  "sense.system.vitals",
  "sense.filesystem.read",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
  "act.filesystem.mkdir",
  "sense.process.list",
  "act.system.command.dry_run",
  "act.system.command.execute",
  "act.system.heal",
]);

function planCapabilityActionSteps(task) {
  return (task.plan?.steps ?? [])
    .filter((step) => step.phase === "acting_on_target" && OPERATOR_INVOKABLE_CAPABILITIES.has(step.capabilityId));
}

function shouldExecuteCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

function isNativePluginCapabilityTask(task) {
  return task?.type === "native_plugin_capability";
}

function isNativePluginRuntimeActivationTask(task) {
  return task?.type === "native_plugin_runtime_activation"
    && task?.plan?.strategy === "native-plugin-runtime-activation-v0";
}

function isNativePluginRuntimeAdapterTask(task) {
  return task?.type === "native_plugin_runtime_adapter_implementation"
    && task?.plan?.strategy === "native-plugin-runtime-adapter-v0";
}

function isOpenClawSearchWebAdapterTask(task) {
  return task?.type === "openclaw_search_web_adapter_invocation"
    && task?.plan?.strategy === "openclaw-search-web-adapter-v0";
}

function isOpenClawSearchWebRuntimeActivationTask(task) {
  return task?.type === "openclaw_search_web_runtime_activation"
    && task?.plan?.strategy === "openclaw-search-web-runtime-activation-v0";
}

function isOpenClawSearchWebProviderRuntimeSandboxTask(task) {
  return task?.type === "openclaw_search_web_provider_runtime_sandbox"
    && task?.plan?.strategy === "openclaw-search-web-provider-runtime-sandbox-v0";
}

function isSystemdRepairExecutionTask(task) {
  return task?.type === "systemd_repair_execution_task"
    && task?.systemdRepair?.registry === SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY;
}

function isSystemdNextRepairTask(task) {
  return task?.type === "systemd_next_repair_task"
    && (task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY
      || task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY);
}

function isBodyEvidenceLedgerDirectoryTask(task) {
  return task?.type === "body_evidence_ledger_directory_task";
}

function isBodyEvidenceLedgerFirstRecordTask(task) {
  return task?.type === "body_evidence_ledger_first_record_task"
    && task?.bodyEvidenceLedgerFirstRecord?.registry === "openclaw-body-evidence-ledger-first-record-task-v0";
}

function isBodyEvidenceLedgerFollowupRecordTask(task) {
  return task?.type === "body_evidence_ledger_followup_record_task"
    && task?.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0";
}

function readBodyEvidenceLedgerLines() {
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  if (!existsSync(ledgerFilePath)) {
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      exists: false,
      lineCount: 0,
      records: [],
    };
  }
  const text = readFileSync(ledgerFilePath, "utf8");
  const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
  return {
    ledgerFileDisplayPath,
    ledgerFilePath,
    exists: true,
    lineCount: lines.length,
    records: lines.map((line, index) => {
      try {
        const record = JSON.parse(line);
        return {
          index,
          ok: true,
          id: record.id ?? null,
          evidenceType: record.evidenceType ?? null,
          sourceRegistry: record.sourceRegistry ?? null,
          contentHash: record.contentHash ?? null,
        };
      } catch (error) {
        return {
          index,
          ok: false,
          error: error instanceof Error ? error.message : "Invalid JSONL record",
        };
      }
    }),
  };
}

async function deferSystemdRepairExecutionTask(task) {
  const deferredTask = await setTaskPhase(task, "systemd_repair_execution_deferred", {
    status: "completed",
    details: {
      executor: "systemd-repair-execution-task-v0",
      reason: "operator_reviewed_execution_task_shell_only",
      target: task.systemdRepair?.target ?? null,
      command: task.systemdRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  });
  deferredTask.outcome = {
    kind: "systemd_repair_execution_deferred",
    summary: `Operator-reviewed systemd repair execution task shell for ${task.systemdRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
    details: {
      systemdRepair: task.systemdRepair ?? null,
      hostMutation: false,
      executed: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    at: deferredTask.updatedAt,
  };
  deferredTask.closedAt = deferredTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent("systemd.repair.execution_deferred", { task: serialiseTask(deferredTask) });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    blocked: false,
    reason: null,
    execution: {
      mode: "deferred_execution_shell",
      target: deferredTask.systemdRepair?.target ?? null,
      command: deferredTask.systemdRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  };
}

function buildSystemdRepairCommandTranscript(task, result) {
  const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
  const command = repair.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  const actualArgs = Array.isArray(result.args) ? result.args : [];
  return {
    stepId: task.systemdNextRepair ? "execute-next-systemd-restart" : "execute-systemd-restart",
    actionKind: task.systemdNextRepair ? "systemd.next_repair.execute" : "systemd.repair.execute",
    capabilityId: "act.system.heal",
    invocationId: result.invocationId,
    command: [command.command ?? "systemctl", ...args].join(" "),
    actualCommand: [result.command ?? command.command ?? "systemctl", ...actualArgs].join(" "),
    authDelegation: result.authDelegation ?? null,
    skipped: false,
    skipReason: null,
    condition: null,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runSystemdRepairCommand(task) {
  const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
  const command = repair.command ?? {};
  const requestedArgs = Array.isArray(command.args) ? command.args : ["restart", repair.target?.unit ?? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT];
  const useRestartHelper =
    SYSTEMD_REPAIR_RESTART_HELPER
    && repair.target?.unit === SYSTEMD_REPAIR_REAL_EXECUTION_UNIT
    && command.command === "systemctl"
    && requestedArgs[0] === "restart"
    && requestedArgs[1] === SYSTEMD_REPAIR_REAL_EXECUTION_UNIT;
  const executable = useRestartHelper ? SYSTEMD_REPAIR_RESTART_HELPER_SUDO : command.command ?? "systemctl";
  const args = useRestartHelper ? ["-n", SYSTEMD_REPAIR_RESTART_HELPER] : requestedArgs;
  const authDelegation = useRestartHelper
    ? {
        mode: SYSTEMD_REPAIR_AUTH_DELEGATION ?? "external-fixed-helper",
        helper: SYSTEMD_REPAIR_RESTART_HELPER,
        sudo: SYSTEMD_REPAIR_RESTART_HELPER_SUDO,
        passwordPromptAllowed: false,
        scope: "restart openclaw-browser-runtime.service only",
      }
    : {
        mode: "direct-systemctl",
        helper: null,
        sudo: null,
        passwordPromptAllowed: true,
        scope: "host policy decides whether authentication is required",
      };
  const startedAt = new Date().toISOString();

  try {
    const result = await execFileAsync(executable, args, {
      timeout: SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 16384,
    });
    return {
      invocationId: randomUUID(),
      command: executable,
      args,
      requestedCommand: command.command ?? "systemctl",
      requestedArgs,
      authDelegation,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode: 0,
      timedOut: false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ok: true,
    };
  } catch (error) {
    const exitCode = Number.isInteger(error?.code) ? error.code : 1;
    return {
      invocationId: randomUUID(),
      command: executable,
      args,
      requestedCommand: command.command ?? "systemctl",
      requestedArgs,
      authDelegation,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode,
      timedOut: error?.killed === true || error?.signal === "SIGTERM",
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" && error.stderr.trim()
        ? error.stderr
        : error instanceof Error
          ? error.message
          : "systemctl restart failed.",
      ok: false,
    };
  }
}

async function executeBodyEvidenceLedgerDirectoryTask(task) {
  const directory = task.bodyEvidenceLedgerDirectory ?? {};
  const displayPath = typeof directory.displayPath === "string" && directory.displayPath.trim()
    ? directory.displayPath.trim()
    : ".artifacts/openclaw-body-evidence-ledger";
  const executionPath = path.isAbsolute(displayPath)
    ? displayPath
    : path.resolve(process.cwd(), "../..", displayPath);

  await setTaskPhase(task, "body_evidence_ledger_directory_create", {
    status: "running",
    details: {
      executor: "body-evidence-ledger-directory-task-v0",
      target: displayPath,
      executionPath,
      hostMutation: true,
      recordWritesEnabled: false,
    },
  });

  const result = await postJson(`${systemSenseUrl}/system/files/mkdir`, {
    path: executionPath,
    recursive: true,
    intent: "body.evidence.ledger.directory.create",
  });
  task.bodyEvidenceLedgerDirectory = {
    ...directory,
    resolvedPath: result.path ?? null,
    allowedRoot: result.root ?? null,
    directoryCreated: result.created === true,
    directoryExists: true,
    durableStorageWritten: false,
    recordWritesEnabled: false,
    mkdirResult: {
      registry: "openclaw-body-evidence-ledger-directory-execution-v0",
      mode: result.mode ?? "mkdir",
      created: result.created === true,
      recursive: result.recursive === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "body-evidence-ledger-directory-task-v0",
    summary: `Created OpenClaw body evidence ledger directory at ${displayPath}; no ledger records written.`,
    target: displayPath,
    result,
    hostMutation: true,
    directoryCreated: result.created === true,
    directoryExists: true,
    durableStorageWritten: false,
    recordWritesEnabled: false,
  });
  await publishEvent("body_evidence_ledger.directory_created", {
    task: serialiseTask(completedTask),
    target: displayPath,
    path: result.path ?? null,
    created: result.created === true,
  });

  return {
    task: completedTask,
    policy: completedTask.policy?.decision ?? null,
    approval: completedTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-directory-execution-v0",
      mode: "approved_directory_creation",
      target: displayPath,
      path: result.path ?? null,
      hostMutation: true,
      directoryCreated: result.created === true,
      directoryExists: true,
      durableStorageWritten: false,
      recordWritesEnabled: false,
    },
  };
}

async function executeBodyEvidenceLedgerFirstRecordTask(task) {
  const firstRecord = task.bodyEvidenceLedgerFirstRecord ?? {};
  const recordType = typeof firstRecord.plannedRecordType === "string" && firstRecord.plannedRecordType.trim()
    ? firstRecord.plannedRecordType.trim()
    : "body_evidence_ledger_bootstrap";
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  const timelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  const recordedAt = new Date().toISOString();
  const recordBase = {
    id: `body-ledger-${randomUUID()}`,
    recordedAt,
    sourceRegistry: firstRecord.sourceRegistry ?? "openclaw-body-evidence-timeline-readiness-v0",
    sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
    phase: "phase_2_body_evidence_memory",
    evidenceType: recordType,
    summary: "Bootstrap durable OpenClaw body evidence memory from timeline readiness evidence.",
    evidence: {
      timelineReadinessRegistry: timelineReadiness.registry ?? null,
      timelineReady: timelineReadiness.summary?.ready === true || timelineReadiness.ready === true,
      bodyMemoryPurpose: timelineReadiness.memoryPurpose ?? timelineReadiness.purpose ?? "operator-visible body evidence memory",
      sourceChecks: timelineReadiness.summary?.checks ?? timelineReadiness.checks ?? null,
    },
    governance: {
      taskId: task.id,
      approvalId: task.approval?.requestId ?? null,
      approved: isTaskPolicyApproved(task),
      appendOnly: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
      hostMutation: true,
      scope: ledgerFileDisplayPath,
    },
  };
  const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
  const record = {
    ...recordBase,
    contentHash,
  };
  const line = `${JSON.stringify(record)}\n`;

  await setTaskPhase(task, "body_evidence_ledger_first_record_append", {
    status: "running",
    details: {
      executor: "body-evidence-ledger-first-record-task-v0",
      ledgerFile: ledgerFileDisplayPath,
      recordType,
      hostMutation: true,
      durableStorageWritten: false,
    },
  });

  const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
    path: ledgerFilePath,
    content: line,
    encoding: "utf8",
    createIfMissing: true,
    intent: "body.evidence.ledger.record.append",
  });
  task.bodyEvidenceLedgerFirstRecord = {
    ...firstRecord,
    ledgerFileDisplayPath,
    ledgerFilePath: result.path ?? ledgerFilePath,
    allowedRoot: result.root ?? null,
    recordId: record.id,
    contentHash,
    contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
    previousBytes: result.previousBytes ?? 0,
    totalBytes: result.totalBytes ?? null,
    recordAppended: true,
    durableStorageWritten: true,
    appendExecutionEnabled: true,
    appendResult: {
      registry: "openclaw-body-evidence-ledger-first-record-append-v0",
      mode: result.mode ?? "append_text",
      created: result.created === true,
      createIfMissing: result.createIfMissing === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "body-evidence-ledger-first-record-task-v0",
    summary: `Appended first OpenClaw body evidence ledger record ${record.id} to ${ledgerFileDisplayPath}.`,
    ledgerFile: ledgerFileDisplayPath,
    result,
    record,
    hostMutation: true,
    recordAppended: true,
    durableStorageWritten: true,
    scheduler: false,
    backgroundWriter: false,
    bulkImport: false,
  });
  await publishEvent("body_evidence_ledger.first_record_appended", {
    task: serialiseTask(completedTask),
    ledgerFile: ledgerFileDisplayPath,
    recordId: record.id,
    contentHash,
  });

  return {
    task: completedTask,
    policy: completedTask.policy?.decision ?? null,
    approval: completedTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-first-record-append-v0",
      mode: "approved_first_record_append",
      ledgerFile: ledgerFileDisplayPath,
      path: result.path ?? null,
      recordId: record.id,
      contentHash,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
}

async function deferBodyEvidenceLedgerFollowupRecordTask(task) {
  const followupRecord = task.bodyEvidenceLedgerFollowupRecord ?? {};
  const recordType = typeof followupRecord.plannedRecordType === "string" && followupRecord.plannedRecordType.trim()
    ? followupRecord.plannedRecordType.trim()
    : "body_evidence_timeline_followup";
  const plannedSequence = Number.isInteger(followupRecord.plannedSequence) ? followupRecord.plannedSequence : 2;
  const deferredTask = await setTaskPhase(task, "body_evidence_ledger_followup_record_deferred", {
    status: "completed",
    details: {
      executor: "body-evidence-ledger-followup-record-task-v0",
      reason: "followup_record_task_shell_only",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
    },
  });
  deferredTask.bodyEvidenceLedgerFollowupRecord = {
    ...followupRecord,
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
    deferredExecution: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      mode: "deferred_followup_record_append_shell",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
  deferredTask.outcome = {
    kind: "body_evidence_ledger_followup_record_deferred",
    summary: `Follow-up ledger record ${plannedSequence} task shell is ready; no JSONL append executed.`,
    details: {
      bodyEvidenceLedgerFollowupRecord: deferredTask.bodyEvidenceLedgerFollowupRecord,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
  persistState();
  await publishEvent("body_evidence_ledger.followup_record_deferred", {
    task: serialiseTask(deferredTask),
    recordType,
    plannedSequence,
  });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      mode: "deferred_followup_record_append_shell",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
}

async function executeBodyEvidenceLedgerFollowupRecordTask(task) {
  const followupRecord = task.bodyEvidenceLedgerFollowupRecord ?? {};
  const recordType = typeof followupRecord.plannedRecordType === "string" && followupRecord.plannedRecordType.trim()
    ? followupRecord.plannedRecordType.trim()
    : "body_evidence_timeline_followup";
  const plannedSequence = Number.isInteger(followupRecord.plannedSequence) ? followupRecord.plannedSequence : 2;
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  const ledger = readBodyEvidenceLedgerLines();
  if (!ledger.exists || ledger.lineCount !== 1 || ledger.records?.[0]?.ok !== true) {
    throw new Error("Follow-up ledger append requires exactly one existing valid ledger record.");
  }

  if (followupRecord.appendRouteReviewRegistry !== "openclaw-body-evidence-ledger-followup-record-append-route-review-v0") {
    throw new Error("Follow-up ledger append requires a stored append route review.");
  }

  const timelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  const previousRecord = ledger.records[0];
  const recordedAt = new Date().toISOString();
  const recordBase = {
    id: `body-ledger-${randomUUID()}`,
    recordedAt,
    sourceRegistry: followupRecord.sourceRegistry ?? "openclaw-body-evidence-timeline-readiness-v0",
    sourceEndpoint: followupRecord.sourceEndpoint ?? "/system/route/body-evidence-timeline-readiness",
    phase: "phase_2_body_evidence_memory",
    evidenceType: recordType,
    sequence: plannedSequence,
    summary: "Follow-up durable OpenClaw body evidence memory from the latest timeline readiness evidence.",
    previousRecord: {
      id: previousRecord.id ?? null,
      evidenceType: previousRecord.evidenceType ?? null,
      sourceRegistry: previousRecord.sourceRegistry ?? null,
      contentHash: previousRecord.contentHash ?? null,
    },
    evidence: {
      timelineReadinessRegistry: timelineReadiness.registry ?? null,
      timelineReady: timelineReadiness.summary?.ready === true || timelineReadiness.ready === true,
      bodyMemoryPurpose: timelineReadiness.memoryPurpose ?? timelineReadiness.purpose ?? "operator-visible body evidence memory",
      sourceChecks: timelineReadiness.summary?.checks ?? timelineReadiness.checks ?? null,
      routeReviewRegistry: followupRecord.appendRouteReviewRegistry,
    },
    governance: {
      taskId: task.id,
      approvalId: task.approval?.requestId ?? null,
      approved: isTaskPolicyApproved(task),
      appendOnly: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
      hostMutation: true,
      scope: ledgerFileDisplayPath,
    },
  };
  const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
  const record = {
    ...recordBase,
    contentHash,
  };
  const line = `${JSON.stringify(record)}\n`;

  await setTaskPhase(task, "body_evidence_ledger_followup_record_append", {
    status: "running",
    details: {
      executor: "body-evidence-ledger-followup-record-append-v0",
      ledgerFile: ledgerFileDisplayPath,
      recordType,
      plannedSequence,
      hostMutation: true,
      durableStorageWritten: false,
    },
  });

  const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
    path: ledgerFilePath,
    content: line,
    encoding: "utf8",
    createIfMissing: false,
    intent: "body.evidence.ledger.followup_record.append",
  });
  task.bodyEvidenceLedgerFollowupRecord = {
    ...followupRecord,
    ledgerFileDisplayPath,
    ledgerFilePath: result.path ?? ledgerFilePath,
    allowedRoot: result.root ?? null,
    recordId: record.id,
    contentHash,
    previousRecordId: previousRecord.id ?? null,
    previousRecordHash: previousRecord.contentHash ?? null,
    contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
    previousBytes: result.previousBytes ?? null,
    totalBytes: result.totalBytes ?? null,
    recordAppended: true,
    durableStorageWritten: true,
    appendExecutionEnabled: true,
    appendResult: {
      registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
      mode: result.mode ?? "append_text",
      created: result.created === true,
      createIfMissing: result.createIfMissing === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "body-evidence-ledger-followup-record-append-v0",
    summary: `Appended follow-up OpenClaw body evidence ledger record ${record.id} to ${ledgerFileDisplayPath}.`,
    ledgerFile: ledgerFileDisplayPath,
    result,
    record,
    previousRecord: record.previousRecord,
    hostMutation: true,
    recordAppended: true,
    durableStorageWritten: true,
    scheduler: false,
    backgroundWriter: false,
    bulkImport: false,
  });
  await publishEvent("body_evidence_ledger.followup_record_appended", {
    task: serialiseTask(completedTask),
    ledgerFile: ledgerFileDisplayPath,
    recordId: record.id,
    previousRecordId: record.previousRecord.id,
    contentHash,
  });

  return {
    task: completedTask,
    policy: completedTask.policy?.decision ?? null,
    approval: completedTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
      mode: "approved_followup_record_append",
      ledgerFile: ledgerFileDisplayPath,
      path: result.path ?? null,
      recordId: record.id,
      previousRecordId: record.previousRecord.id,
      contentHash,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
}

function findSystemdVerificationUnit(inventory, targetUnit) {
  return (inventory?.units ?? []).find((unit) => unit.unit === targetUnit) ?? null;
}

async function captureSystemdRepairVerificationSnapshot(targetUnit, stage) {
  const checkedAt = new Date().toISOString();
  const snapshot = {
    stage,
    checkedAt,
    targetUnit,
    unitInventory: null,
    targetUnitState: null,
    systemHealth: null,
    targetServiceHealth: null,
    errors: [],
  };

  try {
    const inventory = await fetchJson(`${systemSenseUrl}/system/systemd/units`);
    const unit = findSystemdVerificationUnit(inventory, targetUnit);
    snapshot.unitInventory = {
      registry: inventory.registry ?? null,
      observedAt: inventory.observedAt ?? null,
      systemdAvailable: inventory.source?.systemdAvailable ?? null,
      summary: inventory.summary ?? null,
    };
    snapshot.targetUnitState = unit
      ? {
          unit: unit.unit,
          activeState: unit.activeState ?? null,
          subState: unit.subState ?? null,
          loadState: unit.loadState ?? null,
          unitFileState: unit.unitFileState ?? null,
          systemdObserved: unit.systemdObserved === true,
          observation: unit.observation ?? null,
        }
      : null;
    if (!unit) {
      snapshot.errors.push("target_unit_not_found_in_inventory");
    }
  } catch (error) {
    snapshot.errors.push(`unit_inventory_unavailable:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const health = await fetchJson(`${systemSenseUrl}/system/health`);
    const browserRuntime = health.system?.services?.browserRuntime ?? null;
    snapshot.systemHealth = {
      timestamp: health.system?.timestamp ?? null,
      alertCount: Array.isArray(health.system?.alerts) ? health.system.alerts.length : 0,
      online: health.system?.network?.online ?? null,
      checkedTargets: health.system?.network?.checkedTargets ?? null,
    };
    snapshot.targetServiceHealth = browserRuntime
      ? {
          name: browserRuntime.name ?? "browserRuntime",
          ok: browserRuntime.ok === true,
          status: browserRuntime.status ?? null,
          url: browserRuntime.url ?? null,
          latencyMs: browserRuntime.latencyMs ?? null,
          checkedAt: browserRuntime.checkedAt ?? null,
        }
      : null;
    if (!browserRuntime) {
      snapshot.errors.push("browser_runtime_health_not_found");
    }
  } catch (error) {
    snapshot.errors.push(`system_health_unavailable:${error instanceof Error ? error.message : "unknown"}`);
  }

  return snapshot;
}

function buildSystemdRepairPostExecutionVerification(targetUnit, before, after, result) {
  return {
    registry: "openclaw-systemd-repair-post-verification-v0",
    mode: "single_observation_no_recovery",
    targetUnit,
    checkedAt: new Date().toISOString(),
    commandExitCode: result.exitCode,
    commandSucceeded: result.ok === true,
    before,
    after,
    summary: {
      unitObservedBefore: before.targetUnitState?.systemdObserved === true,
      unitObservedAfter: after.targetUnitState?.systemdObserved === true,
      beforeActiveState: before.targetUnitState?.activeState ?? null,
      afterActiveState: after.targetUnitState?.activeState ?? null,
      beforeServiceOk: before.targetServiceHealth?.ok ?? null,
      afterServiceOk: after.targetServiceHealth?.ok ?? null,
      errorCount: before.errors.length + after.errors.length,
      noAutomaticRecovery: true,
    },
    governance: {
      recordsEvidenceOnly: true,
      triggersRecovery: false,
      retriesExecution: false,
      schedulesFollowUp: false,
    },
  };
}

async function executeSystemdRepairExecutionTask(task) {
  const targetUnit = task.systemdRepair?.target?.unit ?? null;
  if (targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
  }

  const command = task.systemdRepair?.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Unexpected systemd repair command: ${JSON.stringify(command)}`);
  }

  const beforeVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "before_real_execution");
  const runningTask = await setTaskPhase(task, "systemd_repair_execution_running", {
    status: "running",
    details: {
      executor: "systemd-repair-execution-task-v0",
      target: task.systemdRepair?.target ?? null,
      command,
      hostMutationAttempted: true,
      executed: true,
    },
  });
  const result = await runSystemdRepairCommand(runningTask);
  const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
  const afterVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "after_real_execution");
  const postExecutionVerification = buildSystemdRepairPostExecutionVerification(
    targetUnit,
    beforeVerification,
    afterVerification,
    result,
  );
  const rollbackNote =
    runningTask.systemdRepair?.evidence?.plan?.proposal?.rollbackNote
    ?? runningTask.systemdRepair?.evidence?.dryRunEnvelope?.plan?.proposal?.rollbackNote
    ?? null;
  const status = result.ok ? "completed" : "failed";
  const phase = result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed";
  const updatedTask = await setTaskPhase(runningTask, phase, {
    status,
    details: {
      executor: "systemd-repair-execution-task-v0",
      target: runningTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      commandTranscript,
      result,
      postExecutionVerification,
    },
  });
  updatedTask.systemdRepair = {
    ...(updatedTask.systemdRepair ?? {}),
    execution: {
      ...(updatedTask.systemdRepair?.execution ?? {}),
      shellOnly: false,
      realExecutionEnabled: true,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      completedAt: result.completedAt,
      authDelegation: result.authDelegation ?? null,
    },
  };
  updatedTask.outcome = {
    kind: result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed",
    summary: result.ok
      ? `Operator-approved systemd restart completed for ${targetUnit}.`
      : `Operator-approved systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
    reason: result.ok ? null : "systemd_restart_nonzero_exit",
    details: {
      systemdRepair: updatedTask.systemdRepair,
      target: updatedTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      authDelegation: result.authDelegation ?? null,
      commandTranscript,
      result,
      postExecutionVerification,
      rollbackNote,
    },
    at: updatedTask.updatedAt,
  };
  updatedTask.closedAt = updatedTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent(result.ok ? "systemd.repair.execution_completed" : "systemd.repair.execution_failed", {
    task: serialiseTask(updatedTask),
    result,
  });

  return {
    task: updatedTask,
    policy: updatedTask.policy?.decision ?? null,
    approval: updatedTask.approval ?? null,
    blocked: false,
    reason: null,
    commandTranscript,
    verification: { ok: result.ok, checks: [], failedChecks: result.ok ? [] : [{ name: "systemctl_restart_exit_code", expected: 0, actual: result.exitCode }] },
    execution: {
      mode: "operator_reviewed_real_systemd_restart",
      target: updatedTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      authDelegation: result.authDelegation ?? null,
      postExecutionVerification,
      rollbackNote: updatedTask.outcome.details.rollbackNote,
    },
  };
}

async function deferSystemdNextRepairTask(task) {
  const deferredTask = await setTaskPhase(task, "systemd_next_repair_execution_deferred", {
    status: "completed",
    details: {
      executor: "systemd-next-repair-task-shell-v0",
      reason: "next_repair_task_shell_only",
      target: task.systemdNextRepair?.target ?? null,
      command: task.systemdNextRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  });
  deferredTask.outcome = {
    kind: "systemd_next_repair_execution_deferred",
    summary: `Next OpenClaw systemd repair task shell for ${task.systemdNextRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
    details: {
      systemdNextRepair: task.systemdNextRepair ?? null,
      hostMutation: false,
      executed: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    at: deferredTask.updatedAt,
  };
  deferredTask.closedAt = deferredTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent("systemd.next_repair.execution_deferred", { task: serialiseTask(deferredTask) });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    blocked: false,
    reason: null,
    execution: {
      mode: "next_repair_deferred_execution_shell",
      target: deferredTask.systemdNextRepair?.target ?? null,
      command: deferredTask.systemdNextRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  };
}

async function executeSystemdNextRepairTask(task) {
  const targetUnit = task.systemdNextRepair?.target?.unit ?? null;
  if (targetUnit !== SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Next real systemd repair execution is limited to ${SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT}.`);
  }

  const command = task.systemdNextRepair?.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Unexpected next systemd repair command: ${JSON.stringify(command)}`);
  }

  const beforeVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "before_next_real_execution");
  const runningTask = await setTaskPhase(task, "systemd_next_repair_execution_running", {
    status: "running",
    details: {
      executor: "systemd-next-repair-real-execution-v0",
      target: task.systemdNextRepair?.target ?? null,
      command,
      hostMutationAttempted: true,
      executed: true,
    },
  });
  const result = await runSystemdRepairCommand(runningTask);
  const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
  const afterVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "after_next_real_execution");
  const postExecutionVerification = buildSystemdRepairPostExecutionVerification(
    targetUnit,
    beforeVerification,
    afterVerification,
    result,
  );
  const rollbackNote = "If this restart degrades body health, inspect systemd status and verify health before attempting any further repair.";
  const status = result.ok ? "completed" : "failed";
  const phase = result.ok ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed";
  const updatedTask = await setTaskPhase(runningTask, phase, {
    status,
    details: {
      executor: "systemd-next-repair-real-execution-v0",
      target: runningTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      commandTranscript,
      result,
      postExecutionVerification,
    },
  });
  updatedTask.systemdNextRepair = {
    ...(updatedTask.systemdNextRepair ?? {}),
    execution: {
      ...(updatedTask.systemdNextRepair?.execution ?? {}),
      shellOnly: false,
      realExecutionEnabled: true,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      completedAt: result.completedAt,
      authDelegation: result.authDelegation ?? null,
    },
  };
  updatedTask.outcome = {
    kind: result.ok ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed",
    summary: result.ok
      ? `Operator-approved next systemd restart completed for ${targetUnit}.`
      : `Operator-approved next systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
    reason: result.ok ? null : "systemd_next_restart_nonzero_exit",
    details: {
      systemdNextRepair: updatedTask.systemdNextRepair,
      target: updatedTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      authDelegation: result.authDelegation ?? null,
      commandTranscript,
      result,
      postExecutionVerification,
      rollbackNote,
    },
    at: updatedTask.updatedAt,
  };
  updatedTask.closedAt = updatedTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent(result.ok ? "systemd.next_repair.execution_completed" : "systemd.next_repair.execution_failed", {
    task: serialiseTask(updatedTask),
    result,
  });

  return {
    task: updatedTask,
    policy: updatedTask.policy?.decision ?? null,
    approval: updatedTask.approval ?? null,
    blocked: false,
    reason: null,
    commandTranscript,
    verification: { ok: result.ok, checks: [], failedChecks: result.ok ? [] : [{ name: "systemctl_next_restart_exit_code", expected: 0, actual: result.exitCode }] },
    execution: {
      mode: "operator_reviewed_next_real_systemd_restart",
      target: updatedTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      authDelegation: result.authDelegation ?? null,
      postExecutionVerification,
      rollbackNote: updatedTask.outcome.details.rollbackNote,
    },
  };
}

async function deferNativePluginCapabilityExecution(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.invoke.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const capabilityStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.capability.invoke") ?? null;
  const reason = "runtime_adapter_deferred";
  const deferredTask = await setTaskPhase(task, reason, {
    status: "queued",
    details: {
      executor: "native-plugin-adapter-v0",
      reason,
      capabilityId: capabilityStep?.capabilityId ?? "act.plugin.capability.invoke",
      pluginId: capabilityStep?.params?.pluginId ?? null,
      packageName: capabilityStep?.params?.packageName ?? null,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_adapter_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferNativePluginRuntimeActivation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_activation.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_activation") ?? null;
  const reason = "native_plugin_runtime_activation_deferred";
  const deferredTask = await setTaskPhase(task, "runtime_activation_deferred", {
    status: "queued",
    details: {
      executor: "native-plugin-runtime-activation-v0",
      reason,
      pluginId: activationStep?.params?.pluginId ?? null,
      packageName: activationStep?.params?.packageName ?? null,
      capabilityId: activationStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
      blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-runtime-activation-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_activation_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferNativePluginRuntimeAdapterImplementation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_adapter.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const adapterStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_adapter_implementation") ?? null;
  const reason = "native_plugin_runtime_adapter_implementation_deferred";
  const deferredTask = await setTaskPhase(task, "runtime_adapter_implementation_deferred", {
    status: "queued",
    details: {
      executor: "native-plugin-runtime-adapter-v0",
      reason,
      contractId: adapterStep?.params?.contractId ?? null,
      contractVersion: adapterStep?.params?.contractVersion ?? null,
      pluginId: adapterStep?.params?.pluginId ?? null,
      packageName: adapterStep?.params?.packageName ?? null,
      capabilityId: adapterStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
      blockedCheckIds: adapterStep?.params?.blockedCheckIds ?? [],
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-runtime-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_adapter_implementation_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebAdapterExecution(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.invoke.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const providerStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.invoke") ?? null;
  const reason = "search_web_runtime_preflight_deferred";
  const deferredTask = await setTaskPhase(task, "network_provider_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-adapter-v0",
      reason,
      providerContractId: providerStep?.params?.providerContractId ?? null,
      operation: providerStep?.params?.operation ?? null,
      queryLength: providerStep?.params?.queryLength ?? null,
      queryDigest: providerStep?.params?.queryDigest ?? null,
      queryContentExposed: false,
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimePreflightBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_runtime_preflight_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimePreflightBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebRuntimeActivation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.runtime_activation.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.runtime_activation") ?? null;
  const reason = "search_web_network_runtime_adapter_deferred";
  const deferredTask = await setTaskPhase(task, "network_runtime_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-runtime-activation-v0",
      reason,
      providerContractId: activationStep?.params?.providerContractId ?? null,
      operation: activationStep?.params?.operation ?? null,
      blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
      queryContentExposed: false,
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-runtime-activation-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_network_runtime_adapter_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebProviderRuntimeSandbox(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.provider_runtime_sandbox.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const sandboxStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.provider_runtime_sandbox") ?? null;
  const reason = "search_web_provider_runtime_sandbox_deferred";
  const deferredTask = await setTaskPhase(task, "provider_runtime_sandbox_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-provider-runtime-sandbox-v0",
      reason,
      providerContractId: sandboxStep?.params?.providerContractId ?? null,
      manifestId: sandboxStep?.params?.manifestId ?? null,
      sandboxId: sandboxStep?.params?.sandboxId ?? null,
      contractVersion: sandboxStep?.params?.contractVersion ?? null,
      blockedCheckIds: sandboxStep?.params?.blockedCheckIds ?? [],
      queryContentExposed: false,
      endpointHostsExposed: false,
      authEnvVarNamesExposed: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-provider-runtime-sandbox-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_provider_runtime_sandbox_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function inferCapabilityOperation(step) {
  if (typeof step.params?.operation === "string" && step.params.operation.trim()) {
    return step.params.operation.trim();
  }
  if (step.kind === "filesystem.metadata") {
    return "metadata";
  }
  if (step.kind === "filesystem.read_text" || step.kind === "filesystem.read-text") {
    return "read_text";
  }
  if (step.kind === "filesystem.search") {
    return "search";
  }
  if (step.kind === "filesystem.list") {
    return "list";
  }
  return null;
}

function buildCapabilityInvokeBodyFromPlanStep(step, task) {
  const approved = isTaskPolicyApproved(task);
  return {
    capabilityId: step.capabilityId,
    taskId: task.id,
    intent: step.intent ?? step.kind,
    operation: inferCapabilityOperation(step),
    approved,
    params: step.params ?? {},
    policy: {
      intent: step.intent ?? step.kind,
      approved,
    },
  };
}

function buildCommandTranscriptEntry(step, response) {
  if (response.capability?.id !== "act.system.command.execute") {
    return null;
  }
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: response.capability.id,
    invocationId: response.invocation?.id ?? null,
    command: response.invocation?.request?.command ?? step.params?.command ?? null,
    exitCode: response.summary?.exitCode ?? null,
    timedOut: response.summary?.timedOut ?? null,
    stdout: response.summary?.stdout ?? "",
    stderr: response.summary?.stderr ?? "",
  };
}

function normaliseCommandFailureMode(step) {
  const mode = typeof step.onFailure === "string" ? step.onFailure.trim() : "";
  return mode === "continue" ? "continue" : "fail_task";
}

function isFailedCommandTranscriptEntry(entry) {
  return entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0);
}

function latestExecutedCommandTranscriptEntry(commandTranscript) {
  return commandTranscript
    .slice()
    .reverse()
    .find((entry) => entry.capabilityId === "act.system.command.execute" && entry.skipped !== true) ?? null;
}

function evaluateCommandStepCondition(step, commandTranscript) {
  const condition = step.when && typeof step.when === "object" ? step.when : null;
  if (!condition) {
    return { shouldRun: true, reason: null, condition: null };
  }

  const previous = latestExecutedCommandTranscriptEntry(commandTranscript);
  if (!previous) {
    return { shouldRun: false, reason: "missing_previous_command_result", condition };
  }

  if (typeof condition.previousStdoutIncludes === "string" && !previous.stdout.includes(condition.previousStdoutIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_missing_text", condition };
  }
  if (typeof condition.previousStdoutNotIncludes === "string" && previous.stdout.includes(condition.previousStdoutNotIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_contains_text", condition };
  }
  if (Number.isInteger(condition.previousExitCode) && previous.exitCode !== condition.previousExitCode) {
    return { shouldRun: false, reason: "previous_exit_code_mismatch", condition };
  }

  return { shouldRun: true, reason: null, condition };
}

function buildSkippedCommandTranscriptEntry(step, conditionResult) {
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: step.capabilityId ?? null,
    invocationId: null,
    command: step.params?.command ?? null,
    skipped: true,
    skipReason: conditionResult.reason,
    condition: conditionResult.condition,
    exitCode: null,
    timedOut: false,
    stdout: "",
    stderr: "",
  };
}

function extractTaskCommandTranscript(task) {
  return Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
}

function classifyCommandTranscriptEntry(entry) {
  if (entry?.skipped === true) {
    return "skipped";
  }
  if (entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0)) {
    return "failed";
  }
  return "executed";
}

function buildCommandTranscriptRecords() {
  return [...tasks.values()]
    .flatMap((task) => extractTaskCommandTranscript(task).map((entry, index) => ({
      taskId: task.id,
      taskGoal: task.goal,
      taskStatus: task.status,
      taskClosedAt: task.closedAt ?? null,
      taskUpdatedAt: task.updatedAt ?? null,
      sourceCommand: task.sourceCommand ?? null,
      taskOutcome: task.outcome?.kind ?? task.status,
      index,
      state: classifyCommandTranscriptEntry(entry),
      stepId: entry.stepId ?? null,
      actionKind: entry.actionKind ?? null,
      capabilityId: entry.capabilityId ?? null,
      invocationId: entry.invocationId ?? null,
      command: entry.command ?? null,
      exitCode: entry.exitCode ?? null,
      timedOut: entry.timedOut === true,
      skipped: entry.skipped === true,
      skipReason: entry.skipReason ?? null,
      stdout: entry.stdout ?? "",
      stderr: entry.stderr ?? "",
    })))
    .sort((left, right) => {
      const leftTime = Date.parse(left.taskClosedAt ?? left.taskUpdatedAt ?? "");
      const rightTime = Date.parse(right.taskClosedAt ?? right.taskUpdatedAt ?? "");
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
      if (safeLeftTime !== safeRightTime) {
        return safeRightTime - safeLeftTime;
      }
      if (left.taskId !== right.taskId) {
        return String(right.taskId).localeCompare(String(left.taskId));
      }
      return left.index - right.index;
    });
}

function listCommandTranscriptRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildCommandTranscriptRecords().slice(0, safeLimit);
}

function buildCommandTranscriptSummary() {
  return buildCommandTranscriptRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.state] = (summary[record.state] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const command = record.command ?? "unknown";
    summary.byCommand[command] = (summary.byCommand[command] ?? 0) + 1;
    const status = record.taskStatus ?? "unknown";
    summary.byTaskStatus[status] = (summary.byTaskStatus[status] ?? 0) + 1;
    const timestamp = record.taskClosedAt ?? record.taskUpdatedAt ?? null;
    if (timestamp && (!summary.latestAt || String(timestamp).localeCompare(summary.latestAt) > 0)) {
      summary.latestAt = timestamp;
    }
    return summary;
  }, {
    total: 0,
    executed: 0,
    skipped: 0,
    failed: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCommand: {},
    byTaskStatus: {},
  });
}

function serialiseCommandTranscriptSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

const FILESYSTEM_CHANGE_CAPABILITIES = new Set([
  "act.filesystem.mkdir",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
]);

function classifyFilesystemChange(entry) {
  if (entry.capability?.id === "act.filesystem.mkdir") {
    return "mkdir";
  }
  if (entry.capability?.id === "act.filesystem.write_text") {
    return "write_text";
  }
  if (entry.capability?.id === "act.filesystem.append_text") {
    return "append_text";
  }
  return "unknown";
}

function buildFilesystemChangeRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && FILESYSTEM_CHANGE_CAPABILITIES.has(entry.capability?.id))
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      change: classifyFilesystemChange(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      overwrite: entry.summary?.overwrite ?? null,
      created: entry.summary?.created ?? null,
      recursive: entry.summary?.recursive ?? null,
      previousBytes: entry.summary?.previousBytes ?? null,
      totalBytes: entry.summary?.totalBytes ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemChangeRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemChangeRecords().slice(0, safeLimit);
}

function buildFilesystemChangeSummary() {
  return buildFilesystemChangeRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.change] = (summary[record.change] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    mkdir: 0,
    write_text: 0,
    append_text: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemChangeSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function classifyFilesystemRead(entry) {
  const requestedOperation = entry.request?.operation ?? null;
  if (requestedOperation === "read-text") {
    return "read_text";
  }
  return entry.summary?.operation ?? requestedOperation ?? "read";
}

function buildFilesystemReadRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && entry.capability?.id === "sense.filesystem.read")
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      operation: classifyFilesystemRead(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      count: entry.summary?.count ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      encoding: entry.summary?.encoding ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemReadRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemReadRecords().slice(0, safeLimit);
}

function buildFilesystemReadSummary() {
  return buildFilesystemReadRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.operation] = (summary[record.operation] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    metadata: 0,
    list: 0,
    search: 0,
    read_text: 0,
    read: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemReadSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function isTaskPolicyApproved(task) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || approval?.status === "approved";
}

function buildCapabilityApprovalGate(task, actionSteps) {
  if (isTaskPolicyApproved(task)) {
    return null;
  }

  for (const step of actionSteps) {
    const capability = capabilityById(step.capabilityId);
    const requiresApproval = step.requiresApproval === true
      || capability?.requiresApproval === true
      || capability?.governance === "require_approval";
    if (!capability || !requiresApproval) {
      continue;
    }

    const request = normaliseCapabilityInvokeRequest(buildCapabilityInvokeBodyFromPlanStep(step, task));
    const decision = recordPolicyDecision(evaluatePolicyIntent(
      buildCapabilityPolicyInput(capability, request),
      {
        stage: "capability_plan.approval",
        taskId: task.id,
        type: task.type,
        goal: task.goal,
      },
    ));

    if (!isPolicyExecutionAllowed(decision)) {
      return {
        step,
        capability,
        decision,
        reason: decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      };
    }
  }

  return null;
}

function buildActionEvidence(actionResults, workViewSummary) {
  const actions = actionResults.map((action, index) => ({
    index,
    id: action?.id ?? null,
    kind: action?.kind ?? null,
    params: action?.params ?? {},
    degraded: Boolean(action?.degraded),
    result: action?.result ?? null,
    executedAt: action?.executedAt ?? null,
    screenContext: action?.screenContext ?? null,
  }));

  return {
    kind: "eye-hand-action-evidence",
    actionCount: actions.length,
    degradedCount: actions.filter((action) => action.degraded).length,
    actions,
    observedAfterActions: workViewSummary
      ? {
          summaryText: workViewSummary.summaryText ?? null,
          url: workViewSummary.url ?? null,
          visibleTextBlocks: workViewSummary.visibleTextBlocks ?? [],
          recentInteraction: workViewSummary.recentInteraction ?? null,
        }
      : null,
  };
}

function buildExecutionVerification({ targetUrl, options, verifiedScreen, actionResults, workView }) {
  const expectedUrl =
    typeof options.expectedUrl === "string" && options.expectedUrl.trim()
      ? options.expectedUrl.trim()
      : targetUrl;
  const expectedReadiness =
    typeof options.expectedReadiness === "string" && options.expectedReadiness.trim()
      ? options.expectedReadiness.trim()
      : "ready";
  const activeUrl = workView?.activeUrl ?? verifiedScreen?.screen?.snapshotText?.match(/^URL: (.+)$/m)?.[1] ?? null;
  const readiness = verifiedScreen?.screen?.readiness ?? null;
  const workViewSummary = verifiedScreen?.screen?.workViewSummary ?? null;
  const actionEvidence = buildActionEvidence(actionResults, workViewSummary);
  const degradedActions = actionResults.filter((action) => action?.degraded);
  const checks = [
    {
      name: "target_url",
      expected: expectedUrl,
      actual: activeUrl,
      passed: activeUrl === expectedUrl,
    },
    {
      name: "screen_readiness",
      expected: expectedReadiness,
      actual: readiness,
      passed: readiness === expectedReadiness,
    },
    {
      name: "actions_not_degraded",
      expected: 0,
      actual: degradedActions.length,
      passed: degradedActions.length === 0,
    },
  ];

  if (options.hideOnComplete === false) {
    checks.push({
      name: "work_view_visible",
      expected: "visible",
      actual: workView?.visibility ?? null,
      passed: workView?.visibility === "visible",
    });
  }

  const failedChecks = checks.filter((check) => !check.passed);
  return {
    ok: failedChecks.length === 0,
    expectedUrl,
    expectedReadiness,
    activeUrl,
    readiness,
    workViewSummary,
    observedTextBlocks: workViewSummary?.visibleTextBlocks ?? [],
    recentInteraction: workViewSummary?.recentInteraction ?? null,
    actionEvidence,
    checks,
    failedChecks,
  };
}

async function executeTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const targetUrl =
    typeof options.targetUrl === "string" && options.targetUrl.trim()
      ? options.targetUrl.trim()
      : task.targetUrl;
  if (!targetUrl) {
    throw new Error("Task targetUrl is required for execution.");
  }

  const policy = ensureTaskPolicy(task, { stage: "task.execute", targetUrl });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked task execution: ${policy.decision.reason}`, {
      targetUrl,
      executor: "core-v2",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent("task.failed", {
      task: serialiseTask(failedTask),
      reason: "Policy blocked task execution.",
      policy: policy.decision,
      executor: "core-v2",
    });
    return {
      task: failedTask,
      prepare: null,
      reveal: null,
      initialScreen: null,
      verifiedScreen: null,
      actions: [],
      finalWorkViewState: null,
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const displayTarget =
    typeof options.displayTarget === "string" && options.displayTarget.trim()
      ? options.displayTarget.trim()
      : "workspace-2";
  const actions = normaliseExecutorActions(options.actions);
  const actionResults = [];

  try {
    await setTaskPhase(task, "preparing_work_view", {
      status: "running",
      details: { targetUrl, displayTarget, executor: "core-v1" },
    });
    const prepare = await postJson(`${sessionManagerUrl}/work-view/prepare`, {
      displayTarget,
      entryUrl: targetUrl,
    });

    await setTaskPhase(task, "opening_target", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const reveal = await postJson(`${sessionManagerUrl}/work-view/reveal`, {
      entryUrl: targetUrl,
    });
    const attachedTask = attachTaskToWorkView(task, buildWorkViewAttachPayload(reveal, targetUrl));
    await publishEvent("task.running", { task: serialiseTask(attachedTask) });

    await setTaskPhase(task, "observing_screen", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const initialScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    for (const action of actions) {
      const endpoint = action.kind === "keyboard.type"
        ? "/act/keyboard/type"
        : action.kind === "keyboard.hotkey"
          ? "/act/keyboard/hotkey"
          : "/act/mouse/click";
      const actionData = await postJson(`${screenActUrl}${endpoint}`, action.params);
      actionResults.push(actionData.action);
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: action.kind,
          degraded: Boolean(actionData.action?.degraded),
          result: actionData.action?.result ?? null,
          executor: "core-v1",
        },
      });
    }

    await setTaskPhase(task, "verifying_result", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const verifiedScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    const preCompletionWorkViewState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    const verificationWorkView = preCompletionWorkViewState?.workView ?? reveal?.workView ?? {};
    const verification = buildExecutionVerification({
      targetUrl,
      options,
      verifiedScreen,
      actionResults,
      workView: verificationWorkView,
    });

    if (!verification.ok) {
      const failedTask = failTask(task, "Executor verification failed.", {
        targetUrl,
        executor: "core-v2",
        verification,
        workViewSummary: verification.workViewSummary ?? null,
        actionEvidence: verification.actionEvidence ?? null,
        actionCount: actionResults.length,
      });
      await publishEvent("task.failed", {
        task: serialiseTask(failedTask),
        reason: "Executor verification failed.",
        verification,
        executor: "core-v2",
      });
      return {
        task: failedTask,
        prepare,
        reveal,
        initialScreen,
        verifiedScreen,
        actions: actionResults,
        finalWorkViewState: preCompletionWorkViewState,
        verification,
      };
    }

    let finalWorkViewState = preCompletionWorkViewState;
    if (options.hideOnComplete !== false) {
      finalWorkViewState = await postJson(`${sessionManagerUrl}/work-view/hide`, {});
    }

    const workView = finalWorkViewState?.workView ?? verificationWorkView;
    const updatedTask = completeTask(task, {
      targetUrl,
      workViewUrl: targetUrl,
      summary: `Executor completed task at ${targetUrl}`,
      executor: "core-v2",
      actionCount: actionResults.length,
      verification,
      workViewSummary: verification.workViewSummary ?? null,
      actionEvidence: verification.actionEvidence ?? null,
      initialScreen: {
        readiness: initialScreen.screen?.readiness ?? null,
        focusedWindow: initialScreen.screen?.focusedWindow ?? null,
      },
      verifiedScreen: {
        readiness: verifiedScreen.screen?.readiness ?? null,
        focusedWindow: verifiedScreen.screen?.focusedWindow ?? null,
        workViewSummary: verification.workViewSummary ?? null,
      },
      actions: actionResults.map((action) => ({
        id: action?.id ?? null,
        kind: action?.kind ?? null,
        params: action?.params ?? {},
        degraded: Boolean(action?.degraded),
        result: action?.result ?? null,
        screenContext: action?.screenContext ?? null,
      })),
      workView: {
        status: workView.status ?? null,
        visibility: workView.visibility ?? null,
        mode: workView.mode ?? null,
        helperStatus: workView.helperStatus ?? null,
        browserStatus: workView.browserStatus ?? null,
        entryUrl: workView.entryUrl ?? targetUrl,
        activeUrl: workView.activeUrl ?? targetUrl,
        displayTarget: workView.displayTarget ?? displayTarget,
      },
    });
    await publishEvent("task.completed", { task: serialiseTask(updatedTask), executor: "core-v2", verification });
    return {
      task: updatedTask,
      prepare,
      reveal,
      initialScreen,
      verifiedScreen,
      actions: actionResults,
      finalWorkViewState,
      verification,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task execution failed.";
    const failedTask = failTask(task, message, {
      targetUrl,
      executor: "core-v1",
      actionCount: actionResults.length,
    });
    await publishEvent("task.failed", { task: serialiseTask(failedTask), reason: message, executor: "core-v1" });
    throw error;
  }
}

async function executeCapabilityPlanTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const actionSteps = planCapabilityActionSteps(task);
  if (actionSteps.length === 0) {
    throw new Error("Task does not include invokable capability plan steps.");
  }

  const policy = ensureTaskPolicy(task, { stage: "capability_plan.execute" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked capability plan execution: ${policy.decision.reason}`, {
      executor: "capability-invoke-v1",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent("task.failed", {
      task: serialiseTask(failedTask),
      reason: "Policy blocked capability plan execution.",
      policy: policy.decision,
      executor: "capability-invoke-v1",
    });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const approvalGate = buildCapabilityApprovalGate(task, actionSteps);
  if (approvalGate) {
    const approval = createApprovalRequestForTask(task, approvalGate.decision);
    await publishEvent("policy.evaluated", {
      task: serialiseTask(task),
      policy: approvalGate.decision,
      capability: approvalGate.capability,
    });
    await setTaskPhase(task, "waiting_for_approval", {
      status: "queued",
      details: {
        executor: "capability-invoke-v1",
        capabilityId: approvalGate.capability.id,
        actionKind: approvalGate.step.kind,
        reason: approvalGate.reason,
        approvalId: approval.id,
      },
    });
    await publishTaskApprovalIfPending(task);
    return {
      task,
      blocked: true,
      reason: approvalGate.reason,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: approvalGate.decision,
      approval: serialiseApproval(approval),
    };
  }

  const capabilityInvocations = [];
  const commandTranscript = [];
  try {
    for (const step of actionSteps) {
      const conditionResult = evaluateCommandStepCondition(step, commandTranscript);
      if (!conditionResult.shouldRun) {
        const transcriptEntry = buildSkippedCommandTranscriptEntry(step, conditionResult);
        commandTranscript.push(transcriptEntry);
        await setTaskPhase(task, "acting_on_target", {
          status: "running",
          details: {
            actionKind: step.kind,
            capabilityId: step.capabilityId,
            skipped: true,
            skipReason: conditionResult.reason,
            condition: conditionResult.condition,
            executor: "capability-invoke-v1",
          },
        });
        continue;
      }

      const invocation = await invokeCapability(buildCapabilityInvokeBodyFromPlanStep(step, task));
      const response = invocation.response;
      capabilityInvocations.push(response);
      const transcriptEntry = buildCommandTranscriptEntry(step, response);
      if (transcriptEntry) {
        commandTranscript.push(transcriptEntry);
      }
      if (response.blocked === true || response.invoked !== true) {
        const failedTask = failTask(task, `Capability invocation blocked: ${response.reason ?? "unknown"}`, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
        });
        await publishEvent("task.failed", {
          task: serialiseTask(failedTask),
          reason: "Capability invocation blocked.",
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }

      const failureMode = transcriptEntry ? normaliseCommandFailureMode(step) : null;
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: step.kind,
          capabilityId: step.capabilityId,
          invocationId: response.invocation?.id ?? null,
          summary: response.summary ?? null,
          commandFailed: transcriptEntry ? isFailedCommandTranscriptEntry(transcriptEntry) : false,
          onFailure: failureMode,
          executor: "capability-invoke-v1",
        },
      });

      if (transcriptEntry && isFailedCommandTranscriptEntry(transcriptEntry) && failureMode !== "continue") {
        const reason = transcriptEntry.timedOut === true
          ? "Command execution timed out."
          : `Command execution failed with exit code ${transcriptEntry.exitCode}.`;
        const failedTask = failTask(task, reason, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
          commandTranscript,
          failedCommand: transcriptEntry,
          onFailure: failureMode,
        });
        await publishEvent("task.failed", {
          task: serialiseTask(failedTask),
          reason,
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          commandTranscript,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }
    }

    const completedTask = completeTask(task, {
      executor: "capability-invoke-v1",
      summary: `Completed ${capabilityInvocations.length} capability invocation(s).`,
      capabilityInvocations: capabilityInvocations.map((response) => ({
        id: response.invocation?.id ?? null,
        capabilityId: response.capability?.id ?? null,
        invoked: response.invoked === true,
        blocked: response.blocked === true,
        summary: response.summary ?? null,
      })),
      commandTranscript,
    });
    await publishEvent("task.completed", {
      task: serialiseTask(completedTask),
      executor: "capability-invoke-v1",
      capabilityInvocations: capabilityInvocations.map((response) => response.invocation ?? null),
    });
    return {
      task: completedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: { ok: true, checks: [], failedChecks: [] },
      policy: policy.decision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    const failedTask = failTask(task, message, {
      executor: "capability-invoke-v1",
      capabilityInvocations,
      commandTranscript,
    });
    await publishEvent("task.failed", { task: serialiseTask(failedTask), reason: message, executor: "capability-invoke-v1" });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: null,
      policy: policy.decision,
    };
  }
}

function recoverTask(sourceTask) {
  if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
    throw new Error(`Task already has a recovery task: ${sourceTask.recoveredByTaskId}`);
  }

  const recoveryAttempt = (sourceTask.recovery?.attempt ?? 0) + 1;
  const recoverableCapabilityPlan = hasRecoverableCapabilityPlan(sourceTask);
  const recoverableNativePluginRuntimeActivationPlan = hasRecoverableNativePluginRuntimeActivationPlan(sourceTask);
  const recoverableSearchWebAdapterPlan = hasRecoverableSearchWebAdapterPlan(sourceTask);
  const shouldRecoverExistingPlan = recoverableCapabilityPlan
    || recoverableNativePluginRuntimeActivationPlan
    || recoverableSearchWebAdapterPlan;
  const recoveryBody = {
    goal: sourceTask.goal,
    type: sourceTask.type,
    targetUrl: sourceTask.targetUrl,
    workViewStrategy: sourceTask.workViewStrategy,
    includePlan: Boolean(sourceTask.plan) && !shouldRecoverExistingPlan,
    recovery: {
      recoveredFromTaskId: sourceTask.id,
      recoveredFromOutcome: sourceTask.outcome?.kind ?? sourceTask.status,
      attempt: recoveryAttempt,
      recoveryEvidence: sourceTask.outcome?.details?.recoveryEvidence ?? null,
    },
  };

  if (shouldRecoverExistingPlan) {
    recoveryBody.plan = resetRecoveredPlan(sourceTask.plan);
    recoveryBody.policy = buildRecoveredPolicyRequest(sourceTask);
  }
  if (sourceTask.sourceCommand && typeof sourceTask.sourceCommand === "object") {
    recoveryBody.sourceCommand = sourceTask.sourceCommand;
  }

  const recoveredTask = createTask(recoveryBody);

  sourceTask.recoveredByTaskId = recoveredTask.id;
  sourceTask.updatedAt = new Date().toISOString();
  persistState();
  return recoveredTask;
}

function clonePlainObject(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

function buildRecoveredPolicyRequest(sourceTask) {
  const request = clonePlainObject(sourceTask.policy?.request ?? sourceTask.policy ?? {});
  delete request.approved;
  return request;
}

function resetRecoveredPlan(plan) {
  const now = new Date().toISOString();
  const recoveredPlan = clonePlainObject(plan);
  recoveredPlan.planId = `plan-${randomUUID()}`;
  recoveredPlan.status = "planned";
  recoveredPlan.createdAt = now;
  recoveredPlan.updatedAt = now;
  delete recoveredPlan.failure;

  if (Array.isArray(recoveredPlan.steps)) {
    recoveredPlan.steps = recoveredPlan.steps.map((step) => {
      const recoveredStep = {
        ...step,
        status: "pending",
      };
      delete recoveredStep.completedAt;
      delete recoveredStep.details;
      return recoveredStep;
    });
  }

  return recoveredPlan;
}

function recoveryEvidenceTargetUrl(sourceTask) {
  const targetUrl = sourceTask?.outcome?.details?.recoveryEvidence?.recommendation?.targetUrl;
  return typeof targetUrl === "string" && targetUrl.trim() ? targetUrl.trim() : null;
}

function buildRecoveryExecuteOptions(options, attempt, sourceTask = null) {
  const recoveryOptions = options.recovery && typeof options.recovery === "object" ? options.recovery : {};
  const evidenceTargetUrl = recoveryEvidenceTargetUrl(sourceTask);
  return {
    ...options,
    ...recoveryOptions,
    autoRecover: false,
    recoveryEvidenceTargetUrl: evidenceTargetUrl,
    expectedUrl:
      typeof recoveryOptions.expectedUrl === "string" && recoveryOptions.expectedUrl.trim()
        ? recoveryOptions.expectedUrl.trim()
        : evidenceTargetUrl
          ? evidenceTargetUrl
        : typeof options.recoveryExpectedUrl === "string" && options.recoveryExpectedUrl.trim()
          ? options.recoveryExpectedUrl.trim()
          : options.targetUrl,
    actions: Array.isArray(recoveryOptions.actions) ? recoveryOptions.actions : options.actions,
    recoveryAttempt: attempt,
  };
}

function serialiseExecutionResult(executionResult) {
  const finalExecution = executionResult.finalExecution ?? executionResult;
  return {
    executor: finalExecution.capabilityInvocations ? "capability-invoke-v1" : executionResult.recovery?.attempted ? "core-v3" : finalExecution.verification ? "core-v2" : "core-v1",
    actions: (finalExecution.actions ?? []).map((action) => ({
      kind: action?.kind ?? null,
      degraded: Boolean(action?.degraded),
      result: action?.result ?? null,
    })),
    policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
    verification: finalExecution.verification ?? null,
    workViewSummary:
      finalExecution.verification?.workViewSummary
      ?? finalExecution.task?.outcome?.details?.workViewSummary
      ?? null,
    observedTextBlocks: finalExecution.verification?.observedTextBlocks ?? [],
    actionEvidence:
      finalExecution.verification?.actionEvidence
      ?? finalExecution.task?.outcome?.details?.actionEvidence
      ?? null,
    capabilityInvocations: (finalExecution.capabilityInvocations ?? []).map((response) => ({
      id: response.invocation?.id ?? null,
      capabilityId: response.capability?.id ?? null,
      invoked: response.invoked === true,
      blocked: response.blocked === true,
      reason: response.reason ?? null,
      summary: response.summary ?? null,
    })),
    commandTranscript: finalExecution.task?.outcome?.details?.commandTranscript ?? [],
    finalReadiness: finalExecution.verifiedScreen?.screen?.readiness ?? null,
    finalWorkView: finalExecution.finalWorkViewState?.workView ?? null,
    recovery: executionResult.recovery ?? null,
    attempts: (executionResult.attempts ?? [finalExecution]).map((attempt) => ({
      taskId: attempt.task?.id ?? null,
      status: attempt.task?.status ?? null,
      phase: attempt.task?.executionPhase ?? null,
      verification: attempt.verification?.ok ?? null,
      workViewSummaryUrl: attempt.verification?.workViewSummary?.url ?? null,
      failedChecks: attempt.verification?.failedChecks?.map((check) => check.name) ?? [],
    })),
  };
}

async function executeTaskWithRecovery(task, options = {}) {
  if (isNativePluginCapabilityTask(task)) {
    const deferredExecution = await deferNativePluginCapabilityExecution(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isNativePluginRuntimeActivationTask(task)) {
    const deferredExecution = await deferNativePluginRuntimeActivation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isNativePluginRuntimeAdapterTask(task)) {
    const deferredExecution = await deferNativePluginRuntimeAdapterImplementation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebAdapterTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebAdapterExecution(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebRuntimeActivationTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebRuntimeActivation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebProviderRuntimeSandboxTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebProviderRuntimeSandbox(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isSystemdRepairExecutionTask(task)) {
    const deferredExecution = task.systemdRepair?.execution?.realExecutionEnabled === true
      ? await executeSystemdRepairExecutionTask(task)
      : await deferSystemdRepairExecutionTask(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isSystemdNextRepairTask(task)) {
    const deferredExecution = task.systemdNextRepair?.execution?.realExecutionEnabled === true
      ? await executeSystemdNextRepairTask(task)
      : await deferSystemdNextRepairTask(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerDirectoryTask(task)) {
    const directoryExecution = await executeBodyEvidenceLedgerDirectoryTask(task);
    return {
      finalExecution: directoryExecution,
      attempts: [directoryExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerFirstRecordTask(task)) {
    const firstRecordExecution = await executeBodyEvidenceLedgerFirstRecordTask(task);
    return {
      finalExecution: firstRecordExecution,
      attempts: [firstRecordExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerFollowupRecordTask(task)) {
    const followupRecordExecution = task.bodyEvidenceLedgerFollowupRecord?.appendExecutionEnabled === true
      ? await executeBodyEvidenceLedgerFollowupRecordTask(task)
      : await deferBodyEvidenceLedgerFollowupRecordTask(task);
    return {
      finalExecution: followupRecordExecution,
      attempts: [followupRecordExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isLongTermMemoryWriteTask(task)) {
    const longTermMemoryExecution = await executeLongTermMemoryWriteTask(task);
    return {
      finalExecution: longTermMemoryExecution,
      attempts: [longTermMemoryExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessHandoffTask(task)) {
    const cloudConsciousnessExecution = await executeCloudConsciousnessHandoffTask(task);
    return {
      finalExecution: cloudConsciousnessExecution,
      attempts: [cloudConsciousnessExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessProviderDryRunTask(task)) {
    const cloudConsciousnessProviderDryRunExecution = await executeCloudConsciousnessProviderDryRunTask(task);
    return {
      finalExecution: cloudConsciousnessProviderDryRunExecution,
      attempts: [cloudConsciousnessProviderDryRunExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessProviderCallRehearsalTask(task)) {
    const cloudConsciousnessProviderCallRehearsalExecution = await executeCloudConsciousnessProviderCallRehearsalTask(task);
    return {
      finalExecution: cloudConsciousnessProviderCallRehearsalExecution,
      attempts: [cloudConsciousnessProviderCallRehearsalExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRunbookTask(task)) {
    const cloudConsciousnessLiveProviderRunbookExecution = await executeCloudConsciousnessLiveProviderRunbookTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRunbookExecution,
      attempts: [cloudConsciousnessLiveProviderRunbookExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderExecutionPlanTask(task)) {
    const cloudConsciousnessLiveProviderExecutionPlanExecution = await executeCloudConsciousnessLiveProviderExecutionPlanTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderExecutionPlanExecution,
      attempts: [cloudConsciousnessLiveProviderExecutionPlanExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRuntimeAdapterTask(task)) {
    const cloudConsciousnessLiveProviderRuntimeAdapterExecution = await executeCloudConsciousnessLiveProviderRuntimeAdapterTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRuntimeAdapterExecution,
      attempts: [cloudConsciousnessLiveProviderRuntimeAdapterExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRuntimeImplementationTask(task)) {
    const cloudConsciousnessLiveProviderRuntimeImplementationExecution = await executeCloudConsciousnessLiveProviderRuntimeImplementationTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRuntimeImplementationExecution,
      attempts: [cloudConsciousnessLiveProviderRuntimeImplementationExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask(task)) {
    const cloudConsciousnessLiveProviderRuntimeAdapterImplementationExecution = await executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRuntimeAdapterImplementationExecution,
      attempts: [cloudConsciousnessLiveProviderRuntimeAdapterImplementationExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRuntimeAdapterModuleTask(task)) {
    const cloudConsciousnessLiveProviderRuntimeAdapterModuleExecution = await executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRuntimeAdapterModuleExecution,
      attempts: [cloudConsciousnessLiveProviderRuntimeAdapterModuleExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isCloudConsciousnessLiveProviderRequestBuilderTask(task)) {
    const cloudConsciousnessLiveProviderRequestBuilderExecution = await executeCloudConsciousnessLiveProviderRequestBuilderTask(task);
    return {
      finalExecution: cloudConsciousnessLiveProviderRequestBuilderExecution,
      attempts: [cloudConsciousnessLiveProviderRequestBuilderExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (shouldExecuteCapabilityPlan(task)) {
    const capabilityExecution = await executeCapabilityPlanTask(task, options);
    return {
      finalExecution: capabilityExecution,
      attempts: [capabilityExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  const firstExecution = await executeTask(task, options);
  const maxRecoveryAttempts =
    Number.isInteger(options.maxRecoveryAttempts) && options.maxRecoveryAttempts > 0
      ? options.maxRecoveryAttempts
      : Number.isInteger(options.retryBudget) && options.retryBudget > 0
        ? options.retryBudget
        : 0;

  if (firstExecution.task.status !== "failed" || options.autoRecover !== true || maxRecoveryAttempts < 1) {
    return {
      finalExecution: firstExecution,
      attempts: [firstExecution],
      recovery: {
        attempted: false,
        maxAttempts: maxRecoveryAttempts,
      },
    };
  }

  let sourceTask = firstExecution.task;
  const attempts = [firstExecution];
  const recoveredTaskIds = [];
  const usedRecommendationTargetUrls = [];

  for (let attempt = 1; attempt <= maxRecoveryAttempts; attempt += 1) {
    const recoveredTask = recoverTask(sourceTask);
    recoveredTaskIds.push(recoveredTask.id);
    reconcileRuntimeState();
    await publishEvent("task.created", { task: serialiseTask(recoveredTask), executor: "core-v3" });
    await publishTaskApprovalIfPending(recoveredTask);
    await publishEvent("task.recovered", {
      task: serialiseTask(recoveredTask),
      recoveredFromTaskId: sourceTask.id,
      autoRecovered: true,
      attempt,
      executor: "core-v3",
    });

    const recoveryOptions = buildRecoveryExecuteOptions(options, attempt, sourceTask);
    if (recoveryOptions.recoveryEvidenceTargetUrl) {
      usedRecommendationTargetUrls.push(recoveryOptions.recoveryEvidenceTargetUrl);
    }
    const recoveryExecution = await executeTask(recoveredTask, recoveryOptions);
    attempts.push(recoveryExecution);
    sourceTask = recoveryExecution.task;

    if (recoveryExecution.task.status !== "failed") {
      return {
        finalExecution: recoveryExecution,
        attempts,
        recovery: {
          attempted: true,
          succeeded: true,
          attempts: attempt,
          recoveredTaskIds,
          recoveredFromTaskId: firstExecution.task.id,
          usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
          usedRecommendationTargetUrls,
        },
      };
    }
  }

  return {
    finalExecution: attempts.at(-1),
    attempts,
    recovery: {
      attempted: true,
      succeeded: false,
      attempts: maxRecoveryAttempts,
      recoveredTaskIds,
      recoveredFromTaskId: firstExecution.task.id,
      usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
      usedRecommendationTargetUrls,
    },
  };
}

function buildOperatorOptions(task, body = {}) {
  const planActions = task.plan?.steps
    ?.filter((step) => step.phase === "acting_on_target")
    .map((step) => ({ kind: step.kind, params: step.params ?? {} }));
  return {
    ...body,
    targetUrl: body.targetUrl ?? task.targetUrl,
    actions: Array.isArray(body.actions) ? body.actions : planActions,
    operator: "loop-v1",
  };
}

async function runOperatorStep(body = {}) {
  reconcileRuntimeState();
  const ignorePause = body.ignorePause === true;
  const dryRun = body.dryRun === true || body.peek === true;

  if (runtimeState.paused && !ignorePause) {
    return {
      ran: false,
      blocked: true,
      reason: "runtime_paused",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const task = getNextQueuedTask();
  if (!task) {
    return {
      ran: false,
      blocked: false,
      reason: "no_queued_task",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  if (dryRun) {
    return {
      ran: false,
      blocked: false,
      reason: "dry_run",
      dryRun: true,
      task,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const policy = ensureTaskPolicy(task, { stage: "operator.step" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    return {
      ran: false,
      blocked: true,
      reason: policy.decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const pendingApproval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (pendingApproval?.status === "pending") {
    return {
      ran: false,
      blocked: true,
      reason: "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: task.policy?.decision ?? null,
      approval: serialiseApproval(pendingApproval),
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const executionResult = await executeTaskWithRecovery(task, buildOperatorOptions(task, body));
  const finalExecution = executionResult.finalExecution ?? executionResult;
  if (finalExecution.blocked === true) {
    return {
      ran: false,
      blocked: true,
      reason: finalExecution.reason ?? "policy_requires_approval",
      dryRun: false,
      task: finalExecution.task,
      execution: null,
      policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
      approval: finalExecution.approval ?? finalExecution.task?.approval ?? null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  return {
    ran: true,
    blocked: false,
    reason: null,
    dryRun: false,
    task: executionResult.finalExecution.task,
    execution: executionResult,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

async function runOperatorLoop(body = {}) {
  const maxSteps = Number.isInteger(body.maxSteps) && body.maxSteps > 0 ? Math.min(body.maxSteps, 20) : 5;
  const steps = [];
  let stopReason = null;
  let blocked = false;
  let dryRun = false;
  let nextTask = null;

  for (let index = 0; index < maxSteps; index += 1) {
    const step = await runOperatorStep(body);
    if (!step.ran) {
      stopReason = step.reason ?? null;
      blocked = step.blocked === true;
      dryRun = step.dryRun === true;
      nextTask = step.task ?? null;
      break;
    }
    steps.push(step);
  }

  return {
    ran: steps.length > 0,
    steps,
    blocked,
    reason: stopReason,
    dryRun,
    nextTask,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

  return {
    executeTask,
    executeTaskWithRecovery,
    serialiseExecutionResult,
    listCommandTranscriptRecords,
    buildCommandTranscriptSummary,
    serialiseCommandTranscriptSummary,
    listFilesystemChangeRecords,
    buildFilesystemChangeSummary,
    serialiseFilesystemChangeSummary,
    listFilesystemReadRecords,
    buildFilesystemReadSummary,
    serialiseFilesystemReadSummary,
    buildOperatorState,
    buildOperatorOptions,
    runOperatorStep,
    runOperatorLoop,
  };
}
