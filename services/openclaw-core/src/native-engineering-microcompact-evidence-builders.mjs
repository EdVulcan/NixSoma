export const NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_REGISTRY = "openclaw-native-engineering-microcompact-evidence-v0";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_THRESHOLD_CHARS = 1_000;
const MAX_THRESHOLD_CHARS = 100_000;
const DEFAULT_PROTECT_RECENT_ITEMS = 3;
const MAX_PROTECT_RECENT_ITEMS = 20;
const MICROCOMPACT_PLACEHOLDER_CHARS = 220;

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normaliseNonNegativeInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
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

function textChars(value) {
  return typeof value === "string" ? value.length : String(value ?? "").length;
}

function classifyCandidate({ index, outputChars, thresholdChars, protectRecentItems }) {
  if (index < protectRecentItems) {
    return {
      protected: true,
      compactable: false,
      reason: "protected_recent_engineering_evidence",
    };
  }
  if (outputChars <= thresholdChars) {
    return {
      protected: false,
      compactable: false,
      reason: "below_microcompact_threshold",
    };
  }
  return {
    protected: false,
    compactable: true,
    reason: "historical_large_tool_result",
  };
}

function buildCandidate(record, index, { tasks, thresholdChars, protectRecentItems }) {
  const stdoutChars = textChars(record.stdout);
  const stderrChars = textChars(record.stderr);
  const outputChars = stdoutChars + stderrChars;
  const classification = classifyCandidate({
    index,
    outputChars,
    thresholdChars,
    protectRecentItems,
  });
  const task = findTask(tasks, record.taskId);
  const placeholderChars = classification.compactable
    ? Math.min(MICROCOMPACT_PLACEHOLDER_CHARS, outputChars)
    : outputChars;
  const reclaimedChars = classification.compactable
    ? Math.max(0, outputChars - placeholderChars)
    : 0;

  return {
    id: `engineering-microcompact-${record.taskId ?? "no-task"}-${record.index ?? index}`,
    source: "command_transcript_record",
    taskId: record.taskId ?? null,
    taskStatus: task?.status ?? record.taskStatus ?? null,
    taskOutcome: task?.outcome?.kind ?? record.taskOutcome ?? null,
    transcriptIndex: record.index ?? index,
    state: record.state ?? "unknown",
    capabilityId: record.capabilityId ?? null,
    commandShape: {
      command: record.command ?? null,
      argsAvailable: false,
      source: "command_transcript_record",
    },
    output: {
      stdoutChars,
      stderrChars,
      totalChars: outputChars,
      thresholdChars,
      sourceTextExposed: false,
      rawTextReturned: false,
    },
    microcompactPreview: {
      protected: classification.protected,
      compactable: classification.compactable,
      reason: classification.reason,
      placeholderChars,
      reclaimedChars,
      placeholderKind: classification.compactable ? "structural_historical_tool_result_placeholder" : "none",
      wouldMutatePersistedLogs: false,
      wouldMutateRuntimeMessages: false,
    },
  };
}

function buildGovernance() {
  return {
    mode: "native_engineering_microcompact_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadCommandTranscriptLedger: true,
    canReadVerificationEvidence: true,
    canReadRecoveryEvidence: true,
    canMutateRuntimeMessages: false,
    canMutatePersistedLogs: false,
    canExecuteCommand: false,
    canCreateTask: false,
    canCreateApproval: false,
    canCallProvider: false,
    observerVisible: true,
  };
}

export function buildNativeEngineeringMicrocompactEvidence({
  transcriptRecords = [],
  verificationEvidence = null,
  recoveryEvidence = null,
  tasks = new Map(),
  limit = DEFAULT_LIMIT,
  thresholdChars = DEFAULT_THRESHOLD_CHARS,
  protectRecentItems = DEFAULT_PROTECT_RECENT_ITEMS,
} = {}) {
  const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const safeThresholdChars = normalisePositiveInteger(thresholdChars, DEFAULT_THRESHOLD_CHARS, MAX_THRESHOLD_CHARS);
  const safeProtectRecentItems = normaliseNonNegativeInteger(
    protectRecentItems,
    DEFAULT_PROTECT_RECENT_ITEMS,
    MAX_PROTECT_RECENT_ITEMS,
  );
  const selectedRecords = transcriptRecords.slice(0, safeLimit);
  const candidates = selectedRecords.map((record, index) => buildCandidate(record, index, {
    tasks,
    thresholdChars: safeThresholdChars,
    protectRecentItems: safeProtectRecentItems,
  }));
  const generatedAt = new Date().toISOString();
  const summary = candidates.reduce((accumulator, candidate) => {
    accumulator.totalItems += 1;
    accumulator.totalOriginalChars += candidate.output.totalChars;
    if (candidate.microcompactPreview.compactable) {
      accumulator.compactableItems += 1;
      accumulator.reclaimedChars += candidate.microcompactPreview.reclaimedChars;
    }
    if (candidate.microcompactPreview.protected) {
      accumulator.protectedItems += 1;
    }
    if (candidate.output.totalChars > accumulator.largestOriginalChars) {
      accumulator.largestOriginalChars = candidate.output.totalChars;
    }
    accumulator.byReason[candidate.microcompactPreview.reason] = (
      accumulator.byReason[candidate.microcompactPreview.reason] ?? 0
    ) + 1;
    return accumulator;
  }, {
    totalItems: 0,
    compactableItems: 0,
    protectedItems: 0,
    totalOriginalChars: 0,
    reclaimedChars: 0,
    largestOriginalChars: 0,
    byReason: {},
  });

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_REGISTRY,
    mode: "context-management-evidence-only",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "microcompact",
      intendedNativeCapabilityId: "sense.openclaw.engineering_context.microcompact_evidence",
      migrationMode: "context_budget_evidence_without_hidden_transcript_mutation",
    },
    capability: {
      id: "sense.openclaw.engineering_context.microcompact_evidence",
      sourceToolName: "microcompact",
      risk: "low",
      approvalRequired: false,
    },
    sourceRegistries: [
      "command-transcript-ledger",
      verificationEvidence?.registry ?? "openclaw-native-engineering-verification-evidence-v0",
      recoveryEvidence?.registry ?? "openclaw-native-engineering-recovery-evidence-v0",
    ],
    query: {
      limit: safeLimit,
      thresholdChars: safeThresholdChars,
      protectRecentItems: safeProtectRecentItems,
    },
    bounds: {
      maxItems: MAX_LIMIT,
      selectedItems: safeLimit,
      thresholdChars: safeThresholdChars,
      protectRecentItems: safeProtectRecentItems,
      noRawOutputText: true,
      noRuntimeMessageMutation: true,
      noPersistedLogMutation: true,
      noProviderCall: true,
    },
    governance: buildGovernance(),
    protectedEvidenceLinks: [
      "/commands/transcripts?limit=8",
      "/plugins/native-adapter/engineering-verification/evidence?limit=8",
      "/plugins/native-adapter/engineering-recovery/evidence?limit=8",
    ],
    verificationSummary: verificationEvidence?.summary ?? null,
    recoverySummary: recoveryEvidence?.summary ?? null,
    candidates,
    summary,
    auditEvidence: {
      operation: "microcompact_evidence",
      capabilityId: "sense.openclaw.engineering_context.microcompact_evidence",
      generatedAt,
      summary,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no hidden transcript mutation",
      "no runtime message mutation",
      "no persisted log mutation",
      "no command execution",
      "no task creation",
      "no approval creation",
      "no provider call",
    ],
  };
}
