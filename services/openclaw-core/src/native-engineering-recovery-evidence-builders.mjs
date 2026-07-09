import { isRecoverableTask } from "./task-recovery.mjs";

export const NATIVE_ENGINEERING_RECOVERY_EVIDENCE_REGISTRY = "openclaw-native-engineering-recovery-evidence-v0";
const RECOVERY_WORK_STANDARDS_COVERAGE_REGISTRY = "openclaw-engineering-recovery-work-standards-coverage-v0";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function taskList(tasks) {
  if (tasks instanceof Map) {
    return [...tasks.values()];
  }
  if (Array.isArray(tasks)) {
    return tasks;
  }
  return [];
}

function findTask(tasks, taskId) {
  if (!taskId) {
    return null;
  }
  return taskList(tasks).find((task) => task?.id === taskId) ?? null;
}

function classifyFailedVerification(evidence) {
  const failedNames = (evidence.validation?.failedChecks ?? []).map((check) => check.name);
  if (evidence.result?.timedOut === true || failedNames.includes("not_timed_out")) {
    return "verification_command_timeout";
  }
  if (failedNames.includes("exit_code_zero")) {
    return "verification_command_exit_nonzero";
  }
  if (failedNames.includes("task_completed")) {
    return "verification_task_not_completed";
  }
  if (failedNames.includes("attached_to_task_completion")) {
    return "verification_not_attached_to_task_completion";
  }
  return "verification_failed";
}

function buildRecommendations({ task, evidence, failureKind, recoverable }) {
  const taskId = task?.id ?? evidence?.taskId ?? null;
  const command = evidence?.commandShape?.command ?? "unknown";
  const recommendations = [
    {
      id: "inspect_verification_evidence",
      label: "Inspect verification evidence",
      endpoint: `/plugins/native-adapter/engineering-verification/evidence${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`,
      createsTask: false,
      executesCommand: false,
    },
    {
      id: "inspect_command_ledger",
      label: "Inspect command transcript ledger",
      endpoint: "/commands/transcripts?limit=8",
      createsTask: false,
      executesCommand: false,
    },
  ];

  if (recoverable && taskId && !task?.recoveredByTaskId) {
    recommendations.push({
      id: "recover_task_after_review",
      label: "Create recovery task after operator review",
      endpoint: `/tasks/${encodeURIComponent(taskId)}/recover`,
      createsTask: true,
      executesCommand: false,
      requiresOperatorAction: true,
      requiresApprovalBeforeAnyCommandRerun: true,
    });
  } else if (recoverable && taskId && task?.recoveredByTaskId) {
    recommendations.push({
      id: "inspect_existing_recovery_task",
      label: "Inspect existing recovery task",
      endpoint: `/tasks/${encodeURIComponent(task.recoveredByTaskId)}`,
      createsTask: false,
      executesCommand: false,
      alreadyRecovered: true,
    });
  }

  recommendations.push({
    id: "adjust_command_or_workspace_state",
    label: "Adjust command or workspace state before rerun",
    rationale: failureKind === "verification_command_exit_nonzero"
      ? `Command ${command} exited non-zero; inspect stderr/stdout before creating a recovery task.`
      : "Inspect the failed evidence and task state before creating a recovery task.",
    createsTask: false,
    executesCommand: false,
  });

  return recommendations;
}

function fallbackWorkStandardsCoverage(evidence) {
  const attached = evidence?.attachment?.attachedToTaskCompletion === true;
  return {
    registry: "openclaw-engineering-work-standards-task-coverage-v0",
    sourceRegistry: "openclaw-engineering-work-standards-v0",
    status: attached ? "covered" : "missing_task_completion_attachment",
    standards: [
      {
        id: "verification_evidence_before_report",
        required: true,
        satisfied: attached,
        evidence: attached ? "outcome.details.commandTranscript" : "not_attached",
      },
    ],
    reportReadiness: {
      canReportWithEvidence: attached,
      commandSucceeded: evidence?.ok === true,
      recoveryEvidenceRecommended: attached && evidence?.ok !== true,
    },
  };
}

function buildFailureFromVerification(evidence, { tasks }) {
  const task = findTask(tasks, evidence.taskId);
  const failureKind = classifyFailedVerification(evidence);
  const recoverable = task ? isRecoverableTask(task) : false;
  const workStandardsCoverage = evidence.workStandardsCoverage ?? fallbackWorkStandardsCoverage(evidence);
  return {
    id: `engineering-recovery-${evidence.taskId ?? "no-task"}-${evidence.transcriptIndex ?? 0}`,
    kind: failureKind,
    source: "verification_evidence",
    taskId: evidence.taskId ?? null,
    taskStatus: task?.status ?? evidence.taskStatus ?? null,
    taskOutcome: task?.outcome?.kind ?? evidence.taskOutcome ?? null,
    sourceCommand: task?.sourceCommand ?? evidence.sourceCommand ?? null,
    recoverable,
    alreadyRecovered: Boolean(task?.recoveredByTaskId),
    recoveredByTaskId: task?.recoveredByTaskId ?? null,
    commandShape: evidence.commandShape ?? null,
    result: {
      exitCode: evidence.result?.exitCode ?? null,
      timedOut: evidence.result?.timedOut === true,
      stdout: evidence.result?.stdout ?? "",
      stderr: evidence.result?.stderr ?? "",
      outputTruncated: evidence.result?.outputTruncated === true,
    },
    failedChecks: evidence.validation?.failedChecks ?? [],
    workStandardsCoverage,
    recommendations: buildRecommendations({ task, evidence, failureKind, recoverable }),
  };
}

function buildFailuresFromFailedTasks({ tasks, seenTaskIds, taskId }) {
  return taskList(tasks)
    .filter((task) => !taskId || task?.id === taskId)
    .filter((task) => task?.status === "failed" && !seenTaskIds.has(task.id))
    .filter((task) => task?.sourceCommand?.registry === "openclaw-source-command-task-v0")
    .map((task) => {
      const recoverable = isRecoverableTask(task);
      return {
        id: `engineering-recovery-${task.id}-failed-task`,
        kind: "failed_source_command_task_without_verification_evidence",
        source: "failed_task",
        taskId: task.id,
        taskStatus: task.status,
        taskOutcome: task.outcome?.kind ?? null,
        sourceCommand: task.sourceCommand ?? null,
        recoverable,
        alreadyRecovered: Boolean(task.recoveredByTaskId),
        recoveredByTaskId: task.recoveredByTaskId ?? null,
        commandShape: null,
        result: {
          exitCode: task.outcome?.details?.failedCommand?.exitCode ?? null,
          timedOut: task.outcome?.details?.failedCommand?.timedOut === true,
          stdout: task.outcome?.details?.failedCommand?.stdout ?? "",
          stderr: task.outcome?.details?.failedCommand?.stderr ?? "",
          outputTruncated: false,
        },
        failedChecks: [],
        workStandardsCoverage: {
          registry: "openclaw-engineering-work-standards-task-coverage-v0",
          sourceRegistry: "openclaw-engineering-work-standards-v0",
          status: "missing_verification_evidence",
          standards: [
            {
              id: "verification_evidence_before_report",
              required: true,
              satisfied: false,
              evidence: "failed_task_without_verification_evidence",
            },
          ],
          reportReadiness: {
            canReportWithEvidence: false,
            commandSucceeded: false,
            recoveryEvidenceRecommended: true,
          },
        },
        recommendations: buildRecommendations({
          task,
          evidence: { taskId: task.id, commandShape: null },
          failureKind: "failed_source_command_task_without_verification_evidence",
          recoverable,
        }),
      };
    });
}

function buildGovernance() {
  return {
    mode: "native_engineering_recovery_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadVerificationEvidence: true,
    canReadTaskOutcomes: true,
    canCreateRecoveryTask: false,
    canApproveRecovery: false,
    canExecuteCommand: false,
    canMutate: false,
    canCallProvider: false,
    observerVisible: true,
  };
}

export function buildNativeEngineeringRecoveryEvidence({
  verificationEvidence = null,
  tasks = new Map(),
  taskId = null,
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const failedVerification = (verificationEvidence?.evidence ?? [])
    .filter((item) => item?.ok !== true)
    .filter((item) => !taskId || item.taskId === taskId);
  const seenTaskIds = new Set(failedVerification.map((item) => item.taskId).filter(Boolean));
  const failures = [
    ...failedVerification.map((item) => buildFailureFromVerification(item, { tasks })),
    ...buildFailuresFromFailedTasks({ tasks, seenTaskIds, taskId }),
  ].slice(0, safeLimit);
  const generatedAt = new Date().toISOString();
  const summary = failures.reduce((accumulator, failure) => {
    accumulator.totalFailures += 1;
    if (failure.recoverable) {
      accumulator.recoverableFailures += 1;
    }
    if (failure.alreadyRecovered) {
      accumulator.alreadyRecovered += 1;
    }
    if (failure.workStandardsCoverage?.reportReadiness?.canReportWithEvidence) {
      accumulator.workStandardsCoveredFailures += 1;
    } else {
      accumulator.workStandardsMissingFailures += 1;
    }
    if (failure.workStandardsCoverage?.reportReadiness?.recoveryEvidenceRecommended) {
      accumulator.workStandardsRecoveryRecommended += 1;
    }
    accumulator.byKind[failure.kind] = (accumulator.byKind[failure.kind] ?? 0) + 1;
    return accumulator;
  }, {
    totalFailures: 0,
    recoverableFailures: 0,
    alreadyRecovered: 0,
    workStandardsCoveredFailures: 0,
    workStandardsMissingFailures: 0,
    workStandardsRecoveryRecommended: 0,
    byKind: {},
  });
  const workStandardsCoverage = {
    registry: RECOVERY_WORK_STANDARDS_COVERAGE_REGISTRY,
    sourceRegistry: "openclaw-engineering-work-standards-v0",
    sourceCoverageRegistry: "openclaw-engineering-work-standards-task-coverage-v0",
    status: summary.totalFailures === 0
      ? "no_failures"
      : summary.workStandardsMissingFailures === 0
        ? "covered"
        : "missing_verification_evidence",
    score: {
      failures: summary.totalFailures,
      covered: summary.workStandardsCoveredFailures,
      missing: summary.workStandardsMissingFailures,
    },
    coveredStandards: ["verification_evidence_before_report"],
    governance: {
      canCreateRecoveryTask: false,
      canApproveRecovery: false,
      canExecuteCommand: false,
      canMutate: false,
      canCallProvider: false,
    },
  };

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_RECOVERY_EVIDENCE_REGISTRY,
    mode: "failed-native-engineering-tool-recovery-evidence",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "observer_recovery_evidence",
      intendedNativeCapabilityId: "sense.openclaw.engineering_tool.recovery_evidence",
      migrationMode: "observer_visible_failure_recovery_evidence",
    },
    capability: {
      id: "sense.openclaw.engineering_tool.recovery_evidence",
      sourceToolName: "observer_recovery_evidence",
      risk: "medium",
      approvalRequired: false,
    },
    sourceRegistries: [
      verificationEvidence?.registry ?? "openclaw-native-engineering-verification-evidence-v0",
    ],
    query: {
      taskId,
      limit: safeLimit,
    },
    bounds: {
      maxFailures: MAX_LIMIT,
      selectedFailures: safeLimit,
      noRecoveryTaskCreation: true,
      noApprovalCreation: true,
      noCommandExecution: true,
    },
    governance: buildGovernance(),
    workStandardsCoverage,
    failures,
    summary,
    auditEvidence: {
      operation: "recovery_evidence",
      capabilityId: "sense.openclaw.engineering_tool.recovery_evidence",
      generatedAt,
      taskId,
      summary,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no recovery task creation",
      "no approval creation",
      "no command execution",
      "no automatic retry",
      "no filesystem mutation",
      "no provider call",
    ],
  };
}
