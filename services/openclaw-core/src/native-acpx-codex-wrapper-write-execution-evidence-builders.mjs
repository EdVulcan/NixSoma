export const NATIVE_ACPX_CODEX_WRAPPER_WRITE_EXECUTION_EVIDENCE_REGISTRY = "openclaw-native-acpx-codex-wrapper-write-execution-evidence-v0";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
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

function normalisePathPart(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

function pathMatchesTarget(recordPath, relativePath) {
  const safeRecordPath = normalisePathPart(recordPath);
  const safeRelativePath = normalisePathPart(relativePath);
  return Boolean(safeRecordPath && safeRelativePath && (
    safeRecordPath === safeRelativePath
    || safeRecordPath.endsWith(`/${safeRelativePath}`)
  ));
}

function buildChecks({ record, task, wrapper }) {
  const checks = [
    {
      name: "filesystem_write_recorded",
      ok: record?.change === "write_text",
      evidence: record?.id ?? "missing_record",
    },
    {
      name: "task_completed",
      ok: task?.status === "completed",
      evidence: task?.status ?? "missing_task",
    },
    {
      name: "acpx_wrapper_write_bridge_attached",
      ok: wrapper?.registry === "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0",
      evidence: wrapper?.registry ?? "missing_wrapper_write_bridge",
    },
    {
      name: "approved_mutation_capability_used",
      ok: wrapper?.approvedMutationCapabilityId === "act.openclaw.workspace_text_write"
        && record?.capabilityId === "act.filesystem.write_text",
      evidence: `${wrapper?.approvedMutationCapabilityId ?? "missing"} -> ${record?.capabilityId ?? "missing"}`,
    },
    {
      name: "target_path_matches_ledger",
      ok: pathMatchesTarget(record?.path, wrapper?.target?.relativePath),
      evidence: `${record?.path ?? "missing"} -> ${wrapper?.target?.relativePath ?? "missing"}`,
    },
    {
      name: "content_preview_not_exposed",
      ok: wrapper?.target?.contentPreviewExposed === false
        && wrapper?.governance?.contentPreviewExposedOnTask === false,
      evidence: String(wrapper?.target?.contentPreviewExposed === false),
    },
    {
      name: "command_args_not_exposed",
      ok: wrapper?.command?.argsExposed === false,
      evidence: String(wrapper?.command?.argsExposed === false),
    },
    {
      name: "execution_boundaries_preserved",
      ok: wrapper?.command?.commandExecuted === false
        && wrapper?.command?.processSpawned === false
        && wrapper?.governance?.canReadCredentialValue === false
        && wrapper?.governance?.canCopyAuthMaterial === false
        && wrapper?.governance?.canSpawnCodexAcp === false,
      evidence: `command=${Boolean(wrapper?.command?.commandExecuted)} spawn=${Boolean(wrapper?.command?.processSpawned)}`,
    },
  ];
  return {
    checks,
    failedChecks: checks.filter((check) => check.ok !== true),
  };
}

function buildEvidenceItem(record, { tasks }) {
  const task = findTask(tasks, record.taskId);
  const wrapper = task?.nativeAcpxCodexBridgeWrapper ?? null;
  const { checks, failedChecks } = buildChecks({ record, task, wrapper });
  return {
    taskId: record.taskId ?? null,
    taskStatus: task?.status ?? null,
    taskClosedAt: task?.closedAt ?? null,
    invocationId: record.id ?? null,
    capabilityId: record.capabilityId ?? null,
    change: record.change ?? null,
    path: record.path ?? null,
    contentBytes: record.contentBytes ?? null,
    overwrite: record.overwrite ?? null,
    policy: {
      decision: record.policy?.decision ?? null,
      approved: record.policy?.approved ?? null,
      risk: record.policy?.risk ?? null,
    },
    wrapper: wrapper ? {
      registry: wrapper.registry ?? null,
      proposalId: wrapper.proposalId ?? null,
      sourceRegistry: wrapper.sourceRegistry ?? null,
      sourceCapabilityId: wrapper.sourceCapabilityId ?? null,
      approvedMutationCapabilityId: wrapper.approvedMutationCapabilityId ?? null,
      target: wrapper.target ? {
        relativePath: wrapper.target.relativePath ?? null,
        contentHash: wrapper.target.contentHash ?? null,
        contentPreviewBytes: wrapper.target.contentPreviewBytes ?? null,
        contentPreviewExposed: wrapper.target.contentPreviewExposed === true,
        chmodApplied: wrapper.target.chmodApplied === true,
      } : null,
      command: wrapper.command ? {
        command: wrapper.command.command ?? null,
        argsCount: wrapper.command.argsCount ?? null,
        argsExposed: wrapper.command.argsExposed === true,
        commandExecuted: wrapper.command.commandExecuted === true,
        processSpawned: wrapper.command.processSpawned === true,
      } : null,
    } : null,
    validation: {
      ok: failedChecks.length === 0,
      checks,
      failedChecks,
    },
  };
}

function buildGovernance() {
  return {
    mode: "native_acpx_codex_wrapper_write_execution_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadFilesystemChangeLedger: true,
    canReadTaskMetadata: true,
    canWriteFile: false,
    canCreateTask: false,
    canCreateApproval: false,
    canApproveTask: false,
    canExecuteOperatorStep: false,
    canReadCredentialValue: false,
    canCopyAuthMaterial: false,
    canChmodWrapper: false,
    canExecuteWrapper: false,
    canSpawnCodexAcp: false,
    canCallProvider: false,
    canUseNetwork: false,
    canMutate: false,
    observerVisible: true,
  };
}

function buildRecoveryRecommendation({ taskId, task, evidence, summary }) {
  if (taskId && !task) {
    return {
      needed: true,
      status: "task_not_found",
      reason: "requested_wrapper_write_task_not_found",
      recommendedNextAction: "check_task_id_or_create_a_new_approval_gated_wrapper_write_task",
      createsTask: false,
    };
  }
  if (task && task.status !== "completed") {
    return {
      needed: true,
      status: "task_not_completed",
      reason: `wrapper_write_task_status_${task.status ?? "unknown"}`,
      recommendedNextAction: "approve_pending_task_then_run_operator_step_before_rechecking_evidence",
      createsTask: false,
    };
  }
  if (taskId && evidence.length === 0) {
    return {
      needed: true,
      status: "missing_filesystem_ledger",
      reason: "completed_wrapper_write_task_has_no_matching_write_text_ledger_record",
      recommendedNextAction: "inspect_filesystem_changes_and_rerun_the_approved_workspace_text_write_path_if_needed",
      createsTask: false,
    };
  }
  if (summary.failed > 0) {
    return {
      needed: true,
      status: "validation_failed",
      reason: "wrapper_write_execution_evidence_checks_failed",
      recommendedNextAction: "inspect_failed_checks_before_any_process_spawn_or_auth_copy_work",
      createsTask: false,
    };
  }
  return {
    needed: false,
    status: "not_needed",
    reason: evidence.length > 0 ? "approved_wrapper_write_has_ledger_evidence" : "no_wrapper_write_evidence_selected",
    recommendedNextAction: evidence.length > 0 ? "continue_to_verification_or_process_spawn_proposal_only_after_review" : "create_and_approve_a_wrapper_write_task_to_generate_evidence",
    createsTask: false,
  };
}

export function buildNativeAcpxCodexWrapperWriteExecutionEvidence({
  filesystemChanges = [],
  tasks = new Map(),
  taskId = null,
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const selectedTask = taskId ? findTask(tasks, taskId) : null;
  const evidence = filesystemChanges
    .filter((record) => record?.change === "write_text")
    .filter((record) => !taskId || record.taskId === taskId)
    .map((record) => buildEvidenceItem(record, { tasks }))
    .filter((item) => item.wrapper?.registry === "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0")
    .filter((item) => !taskId || item.taskId === taskId)
    .slice(0, safeLimit);
  const generatedAt = new Date().toISOString();
  const summary = evidence.reduce((accumulator, item) => {
    accumulator.total += 1;
    if (item.validation.ok) {
      accumulator.passed += 1;
    } else {
      accumulator.failed += 1;
    }
    if (item.wrapper?.proposalId) {
      accumulator.withWrapperProposal += 1;
    }
    if (item.taskStatus === "completed") {
      accumulator.completedTasks += 1;
    }
    if (item.contentBytes !== null) {
      accumulator.totalContentBytes += item.contentBytes;
    }
    return accumulator;
  }, {
    total: 0,
    passed: 0,
    failed: 0,
    withWrapperProposal: 0,
    completedTasks: 0,
    totalContentBytes: 0,
  });
  const recoveryRecommendation = buildRecoveryRecommendation({
    taskId,
    task: selectedTask,
    evidence,
    summary,
  });

  return {
    ok: true,
    registry: NATIVE_ACPX_CODEX_WRAPPER_WRITE_EXECUTION_EVIDENCE_REGISTRY,
    mode: "approved-acpx-codex-wrapper-write-execution-evidence",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "ACPX/Codex bridge compatibility",
      intendedNativeCapabilityId: "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence",
      migrationMode: "execution_evidence_from_approved_workspace_text_write_bridge",
    },
    capability: {
      id: "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence",
      risk: "medium",
      approvalRequired: false,
      runtimeOwner: "openclaw_on_nixos",
    },
    query: {
      taskId,
      limit: safeLimit,
    },
    bounds: {
      maxRecords: MAX_LIMIT,
      selectedRecords: safeLimit,
      noFilesystemWrite: true,
      noTaskCreation: true,
      noApprovalCreation: true,
      noApprovalAction: true,
      noOperatorExecution: true,
      noCredentialRead: true,
      noAuthCopy: true,
      noChmod: true,
      noWrapperExecution: true,
      noProcessSpawn: true,
      noProviderCall: true,
      noNetwork: true,
    },
    governance: buildGovernance(),
    evidence,
    summary,
    recoveryRecommendation,
    auditEvidence: {
      operation: "acpx_codex_wrapper_write_execution_evidence",
      capabilityId: "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence",
      generatedAt,
      summary,
      recoveryStatus: recoveryRecommendation.status,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no filesystem write from evidence route",
      "no task creation",
      "no approval creation",
      "no approval action",
      "no operator execution",
      "no CODEX_HOME read",
      "no auth.json or config.toml read",
      "no auth material copy",
      "no chmod",
      "no npx or npx.cmd execution",
      "no ACP/Codex process spawn",
      "no provider call",
      "no network egress",
    ],
  };
}
