export const NATIVE_ENGINEERING_EDIT_EXECUTION_EVIDENCE_REGISTRY = "openclaw-native-engineering-edit-execution-evidence-v0";

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

function buildChecks({ record, task, proposal }) {
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
      name: "engineering_edit_proposal_attached",
      ok: Boolean(proposal?.proposalId),
      evidence: proposal?.proposalId ?? "missing_proposal",
    },
    {
      name: "approved_mutation_capability_used",
      ok: proposal?.approvedMutationCapabilityId === "act.openclaw.workspace_patch_apply"
        && record?.capabilityId === "act.filesystem.write_text",
      evidence: `${proposal?.approvedMutationCapabilityId ?? "missing"} -> ${record?.capabilityId ?? "missing"}`,
    },
    {
      name: "content_not_exposed",
      ok: proposal?.contentExposed === false,
      evidence: String(proposal?.contentExposed === false),
    },
  ];
  return {
    checks,
    failedChecks: checks.filter((check) => check.ok !== true),
  };
}

function buildEvidenceItem(record, { tasks }) {
  const task = findTask(tasks, record.taskId);
  const proposal = task?.engineeringEditProposal ?? null;
  const { checks, failedChecks } = buildChecks({ record, task, proposal });
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
    proposal: proposal ? {
      registry: proposal.registry ?? null,
      proposalId: proposal.proposalId ?? null,
      proposalKind: proposal.proposalKind ?? null,
      sourceCapabilityId: proposal.sourceCapabilityId ?? null,
      approvedMutationCapabilityId: proposal.approvedMutationCapabilityId ?? null,
      target: proposal.target ? {
        relativePath: proposal.target.relativePath ?? null,
        originalBytes: proposal.target.originalBytes ?? null,
        proposedBytes: proposal.target.proposedBytes ?? null,
        originalSha256: proposal.target.originalSha256 ?? null,
        proposedSha256: proposal.target.proposedSha256 ?? null,
        changedAtLine: proposal.target.changedAtLine ?? null,
        contentExposed: proposal.target.contentExposed === true,
        diffPreviewExposed: proposal.target.diffPreviewExposed === true,
      } : null,
      contentExposed: proposal.contentExposed === true,
      diffPreviewExposed: proposal.diffPreviewExposed === true,
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
    mode: "native_engineering_edit_execution_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadFilesystemChangeLedger: true,
    canReadTaskMetadata: true,
    canWriteFile: false,
    canCreateTask: false,
    canCreateApproval: false,
    canApproveTask: false,
    canExecuteOperatorStep: false,
    canExecuteCommand: false,
    canCallProvider: false,
    canMutate: false,
    observerVisible: true,
  };
}

export function buildNativeEngineeringEditExecutionEvidence({
  filesystemChanges = [],
  tasks = new Map(),
  taskId = null,
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const evidence = filesystemChanges
    .filter((record) => record?.change === "write_text")
    .filter((record) => !taskId || record.taskId === taskId)
    .map((record) => buildEvidenceItem(record, { tasks }))
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
    if (item.proposal?.proposalId) {
      accumulator.withEngineeringProposal += 1;
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
    withEngineeringProposal: 0,
    completedTasks: 0,
    totalContentBytes: 0,
  });

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_EDIT_EXECUTION_EVIDENCE_REGISTRY,
    mode: "approved-workspace-patch-apply-execution-evidence",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "cc_edit",
      intendedNativeCapabilityId: "sense.openclaw.engineering_tool.edit_execution_evidence",
      migrationMode: "execution_evidence_from_approved_workspace_patch_apply_tasks",
    },
    capability: {
      id: "sense.openclaw.engineering_tool.edit_execution_evidence",
      sourceToolName: "cc_edit",
      risk: "medium",
      approvalRequired: false,
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
      noProviderCall: true,
    },
    governance: buildGovernance(),
    evidence,
    summary,
    auditEvidence: {
      operation: "edit_execution_evidence",
      capabilityId: "sense.openclaw.engineering_tool.edit_execution_evidence",
      generatedAt,
      summary,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no filesystem write from evidence route",
      "no task creation",
      "no approval creation",
      "no approval action",
      "no operator execution",
      "no verification command execution",
      "no provider call",
    ],
  };
}
