export const NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_REGISTRY = "openclaw-native-engineering-verification-evidence-v0";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_MAX_OUTPUT_CHARS = 4_000;
const MAX_OUTPUT_CHARS = 12_000;
const WORK_STANDARDS_COVERAGE_REGISTRY = "openclaw-engineering-work-standards-task-coverage-v0";

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function truncateText(value, maxChars) {
  const text = String(value ?? "");
  if (text.length <= maxChars) {
    return { text, truncated: false, chars: text.length };
  }
  return { text: text.slice(0, maxChars), truncated: true, chars: maxChars };
}

function truncateOutputPair(stdout, stderr, maxOutputChars) {
  const stdoutPreview = truncateText(stdout, maxOutputChars);
  const remaining = Math.max(0, maxOutputChars - stdoutPreview.chars);
  const stderrPreview = truncateText(stderr, remaining);
  return {
    stdout: stdoutPreview.text,
    stderr: stderrPreview.text,
    stdoutTruncated: stdoutPreview.truncated,
    stderrTruncated: stderrPreview.truncated,
    outputChars: stdoutPreview.chars + stderrPreview.chars,
    outputTruncated: stdoutPreview.truncated || stderrPreview.truncated,
  };
}

function findTask(tasks, taskId) {
  if (!taskId) {
    return null;
  }
  if (tasks instanceof Map) {
    return tasks.get(taskId) ?? null;
  }
  if (Array.isArray(tasks)) {
    return tasks.find((task) => task?.id === taskId) ?? null;
  }
  return null;
}

function taskHasTranscriptEntry(task, record) {
  const entries = Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
  return entries.some((entry, index) => {
    if (record.invocationId && entry.invocationId === record.invocationId) {
      return true;
    }
    return index === record.index
      && entry.command === record.command
      && entry.exitCode === record.exitCode
      && entry.timedOut === record.timedOut;
  });
}

function findInvocation(invocations, record) {
  return invocations.find((entry) => {
    if (record.invocationId && entry?.id === record.invocationId) {
      return true;
    }
    return entry?.request?.taskId === record.taskId
      && entry?.capability?.id === "act.system.command.execute"
      && entry?.request?.command === record.command;
  }) ?? null;
}

function buildChecks({ record, task, attachedToTaskCompletion }) {
  const checks = [
    {
      name: "transcript_entry_present",
      ok: true,
      evidence: record.invocationId ?? `${record.taskId}:${record.index}`,
    },
    {
      name: "task_completed",
      ok: task?.status === "completed",
      evidence: task?.status ?? "missing_task",
    },
    {
      name: "attached_to_task_completion",
      ok: attachedToTaskCompletion,
      evidence: attachedToTaskCompletion ? "outcome.details.commandTranscript" : "not_attached",
    },
    {
      name: "exit_code_zero",
      ok: record.exitCode === 0,
      evidence: String(record.exitCode ?? "missing"),
    },
    {
      name: "not_timed_out",
      ok: record.timedOut !== true,
      evidence: String(record.timedOut === true),
    },
  ];

  return {
    checks,
    failedChecks: checks.filter((check) => check.ok !== true),
  };
}

function isTerminalTaskStatus(status) {
  return status === "completed" || status === "failed";
}

function buildWorkStandardsCoverage({ ok, attachedToTaskCompletion, attachedToTerminalTask }) {
  const verificationEvidenceCovered = attachedToTerminalTask === true || attachedToTaskCompletion === true;
  return {
    registry: WORK_STANDARDS_COVERAGE_REGISTRY,
    sourceRegistry: "openclaw-engineering-work-standards-v0",
    status: verificationEvidenceCovered ? "covered" : "missing_task_completion_attachment",
    standards: [
      {
        id: "verification_evidence_before_report",
        required: true,
        satisfied: verificationEvidenceCovered,
        evidence: verificationEvidenceCovered ? "terminal_task.outcome.details.commandTranscript" : "not_attached",
      },
    ],
    reportReadiness: {
      canReportWithEvidence: verificationEvidenceCovered,
      commandSucceeded: ok === true,
      recoveryEvidenceRecommended: verificationEvidenceCovered && ok !== true,
    },
    governance: {
      canCreateTask: false,
      canCreateApproval: false,
      canExecuteCommand: false,
      canMutate: false,
      canCallProvider: false,
    },
  };
}

function buildEvidenceRecord(record, { tasks, invocations, maxOutputChars }) {
  const task = findTask(tasks, record.taskId);
  const invocation = findInvocation(invocations, record);
  const attachedToTaskCompletion = task?.status === "completed" && taskHasTranscriptEntry(task, record);
  const attachedToTerminalTask = isTerminalTaskStatus(task?.status) && taskHasTranscriptEntry(task, record);
  const output = truncateOutputPair(record.stdout, record.stderr, maxOutputChars);
  const { checks, failedChecks } = buildChecks({ record, task, attachedToTaskCompletion });
  const ok = failedChecks.length === 0;

  return {
    taskId: record.taskId ?? null,
    taskStatus: task?.status ?? record.taskStatus ?? null,
    taskClosedAt: task?.closedAt ?? record.taskClosedAt ?? null,
    taskOutcome: task?.outcome?.kind ?? record.taskOutcome ?? null,
    sourceCommand: record.sourceCommand ?? task?.sourceCommand ?? null,
    transcriptIndex: record.index ?? null,
    invocationId: record.invocationId ?? invocation?.id ?? null,
    capabilityId: record.capabilityId ?? invocation?.capability?.id ?? null,
    state: record.state ?? "unknown",
    ok,
    commandShape: {
      command: invocation?.request?.command ?? record.command ?? null,
      cwd: invocation?.request?.cwd ?? null,
      args: null,
      timeoutMs: null,
      argsAvailable: false,
      requestMetadataSource: invocation ? "capability_invocation_log" : "command_transcript_record",
    },
    result: {
      exitCode: record.exitCode ?? invocation?.summary?.exitCode ?? null,
      timedOut: record.timedOut === true || invocation?.summary?.timedOut === true,
      stdout: output.stdout,
      stderr: output.stderr,
      stdoutTruncated: output.stdoutTruncated,
      stderrTruncated: output.stderrTruncated,
      outputChars: output.outputChars,
      outputTruncated: output.outputTruncated,
    },
    retryPolicy: {
      maxRetries: 0,
      retriesUsed: 0,
      source: "evidence_only_existing_task_completion",
    },
    attachment: {
      attachedToTaskCompletion,
      taskOutcomePath: attachedToTaskCompletion ? "outcome.details.commandTranscript" : null,
      taskClosedAt: task?.closedAt ?? record.taskClosedAt ?? null,
    },
    validation: {
      ok,
      checks,
      failedChecks,
    },
    workStandardsCoverage: buildWorkStandardsCoverage({ ok, attachedToTaskCompletion, attachedToTerminalTask }),
  };
}

function buildGovernance() {
  return {
    mode: "native_engineering_verification_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadCommandTranscriptLedger: true,
    canReadCapabilityInvocationLedger: true,
    canExecuteCommand: false,
    canCreateTask: false,
    canCreateApproval: false,
    canMutate: false,
    canCallProvider: false,
    observerVisible: true,
  };
}

export function buildNativeEngineeringVerificationEvidence({
  transcriptRecords = [],
  capabilityInvocations = [],
  tasks = new Map(),
  taskId = null,
  limit = DEFAULT_LIMIT,
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
} = {}) {
  const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const safeMaxOutputChars = normalisePositiveInteger(maxOutputChars, DEFAULT_MAX_OUTPUT_CHARS, MAX_OUTPUT_CHARS);
  const filteredRecords = transcriptRecords
    .filter((record) => !taskId || record.taskId === taskId)
    .slice(0, safeLimit);
  const evidence = filteredRecords.map((record) => buildEvidenceRecord(record, {
    tasks,
    invocations: capabilityInvocations,
    maxOutputChars: safeMaxOutputChars,
  }));
  const generatedAt = new Date().toISOString();
  const summary = evidence.reduce((accumulator, item) => {
    accumulator.total += 1;
    if (item.ok) {
      accumulator.passed += 1;
    } else {
      accumulator.failed += 1;
    }
    if (item.result.timedOut) {
      accumulator.timedOut += 1;
    }
    if (item.attachment.attachedToTaskCompletion) {
      accumulator.attachedToCompletedTasks += 1;
    }
    if (item.result.outputTruncated) {
      accumulator.outputTruncated += 1;
    }
    if (item.workStandardsCoverage?.reportReadiness?.canReportWithEvidence) {
      accumulator.workStandardsCovered += 1;
    }
    if (item.workStandardsCoverage?.reportReadiness?.recoveryEvidenceRecommended) {
      accumulator.workStandardsRecoveryRecommended += 1;
    }
    return accumulator;
  }, {
    total: 0,
    passed: 0,
    failed: 0,
    timedOut: 0,
    attachedToCompletedTasks: 0,
    outputTruncated: 0,
    workStandardsCovered: 0,
    workStandardsRecoveryRecommended: 0,
  });
  const workStandardsCoverage = {
    registry: WORK_STANDARDS_COVERAGE_REGISTRY,
    sourceRegistry: "openclaw-engineering-work-standards-v0",
    status: summary.total === 0
      ? "no_verification_records"
      : summary.workStandardsCovered === summary.total
        ? "covered"
        : "missing_task_completion_attachment",
    score: {
      required: summary.total,
      satisfied: summary.workStandardsCovered,
      missing: Math.max(0, summary.total - summary.workStandardsCovered),
    },
    coveredStandards: ["verification_evidence_before_report"],
    missingRequiredStandards: summary.workStandardsCovered === summary.total ? [] : ["verification_evidence_before_report"],
    governance: {
      canCreateTask: false,
      canCreateApproval: false,
      canExecuteCommand: false,
      canMutate: false,
      canCallProvider: false,
    },
  };

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_REGISTRY,
    mode: "completed-command-transcript-verification-evidence",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "cc_verify",
      intendedNativeCapabilityId: "sense.openclaw.engineering_tool.verify_evidence",
      migrationMode: "verification_evidence_from_governed_command_transcripts",
    },
    capability: {
      id: "sense.openclaw.engineering_tool.verify_evidence",
      sourceToolName: "cc_verify",
      risk: "medium",
      approvalRequired: false,
    },
    query: {
      taskId,
      limit: safeLimit,
      maxOutputChars: safeMaxOutputChars,
    },
    bounds: {
      maxRecords: MAX_LIMIT,
      selectedRecords: safeLimit,
      maxOutputChars: safeMaxOutputChars,
      outputBudgetApplied: true,
      noCommandExecution: true,
      noTaskCreation: true,
      noApprovalCreation: true,
    },
    governance: buildGovernance(),
    workStandardsCoverage,
    evidence,
    summary,
    auditEvidence: {
      operation: "verification_evidence",
      capabilityId: "sense.openclaw.engineering_tool.verify_evidence",
      generatedAt,
      taskId,
      summary,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no new command execution",
      "no shell invocation",
      "no task creation",
      "no approval creation",
      "no provider call",
      "no retry execution",
    ],
  };
}
