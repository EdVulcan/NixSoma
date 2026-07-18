import { buildNativeEngineeringMicrocompactProjection } from "./native-engineering-microcompact-projection.mjs";

export const NATIVE_ENGINEERING_CONTEXT_PACKET_REGISTRY =
  "openclaw-native-engineering-context-packet-v0";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const DEFAULT_MAX_OUTPUT_CHARS = 4_000;
const MAX_OUTPUT_CHARS = 12_000;

function boundedPositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function taskList(tasks) {
  if (tasks instanceof Map) return [...tasks.values()];
  return Array.isArray(tasks) ? tasks : [];
}

function findTask(tasks, taskId) {
  return taskList(tasks).find((task) => task?.id === taskId) ?? null;
}

function truncatePair(stdout, stderr, maxChars) {
  const stdoutText = String(stdout ?? "");
  const stderrText = String(stderr ?? "");
  const selectedStdout = stdoutText.slice(0, maxChars);
  const remaining = Math.max(0, maxChars - selectedStdout.length);
  const selectedStderr = stderrText.slice(0, remaining);
  return {
    stdout: selectedStdout,
    stderr: selectedStderr,
    truncated: selectedStdout.length < stdoutText.length || selectedStderr.length < stderrText.length,
  };
}

function redactCredentialLikeText(value) {
  let redactions = 0;
  let text = String(value ?? "");
  const replace = (pattern, replacement) => {
    text = text.replace(pattern, (...args) => {
      redactions += 1;
      return typeof replacement === "function" ? replacement(...args) : replacement;
    });
  };
  replace(/\b(password|passwd|secret|token|api[_-]?key|credential)\s*[:=]\s*([^\s,;]+)/giu, (_match, key) => `${key}=<redacted>`);
  replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gu, "Bearer <redacted>");
  replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gu, "<redacted-key>");
  return { text, redactions };
}

function taskContextMessage(record, task) {
  return {
    role: "assistant",
    contextKind: "engineering_task_summary",
    taskId: record.taskId ?? null,
    content: [{
      type: "text",
      text: JSON.stringify({
        taskId: record.taskId ?? null,
        taskType: task?.type ?? null,
        status: task?.status ?? record.taskStatus ?? null,
        outcome: task?.outcome?.kind ?? record.taskOutcome ?? null,
        goal: typeof task?.goal === "string" ? task.goal.slice(0, 500) : null,
      }),
    }],
  };
}

function transcriptContextMessage(record, maxOutputChars) {
  const output = truncatePair(record.stdout, record.stderr, maxOutputChars);
  const redacted = redactCredentialLikeText([
    output.stdout ? `stdout:\n${output.stdout}` : "",
    output.stderr ? `stderr:\n${output.stderr}` : "",
  ].filter(Boolean).join("\n"));
  return {
    message: {
      role: "toolResult",
      toolName: "governed_command",
      callId: record.invocationId ?? `${record.taskId ?? "no-task"}:${record.index ?? 0}`,
      taskId: record.taskId ?? null,
      commandShape: {
        command: record.command ?? null,
        argsAvailable: false,
      },
      result: {
        exitCode: record.exitCode ?? null,
        timedOut: record.timedOut === true,
        truncated: output.truncated,
      },
      content: [{ type: "text", text: redacted.text }],
    },
    redactions: redacted.redactions,
    outputTruncated: output.truncated,
  };
}

function protectedSummaryMessage(kind, summary) {
  return {
    role: "toolResult",
    toolName: kind,
    evidenceKind: `${kind}_evidence`,
    content: [{ type: "text", text: JSON.stringify(summary ?? {}) }],
  };
}

function planTodoContextSummary(planTodoEvidence) {
  if (!planTodoEvidence) {
    return null;
  }
  return {
    registry: planTodoEvidence.registry,
    summary: planTodoEvidence.summary ?? null,
    taskPlanEvidence: planTodoEvidence.taskPlanEvidence ?? null,
    workbenchStorage: planTodoEvidence.workbenchStorage ?? null,
    nextGovernedActionSuggestion: planTodoEvidence.nextGovernedActionSuggestion ?? null,
  };
}

export function buildNativeEngineeringContextPacket({
  transcriptRecords = [],
  tasks = new Map(),
  verificationEvidence = null,
  recoveryEvidence = null,
  taskId = null,
  sourceTaskId = null,
  limit = DEFAULT_LIMIT,
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  thresholdChars,
  protectRecentAssistantTurns,
  workViewAssociation = null,
  planTodoEvidence = null,
  experienceMemory = null,
} = {}) {
  const safeLimit = boundedPositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const safeMaxOutputChars = boundedPositiveInteger(maxOutputChars, DEFAULT_MAX_OUTPUT_CHARS, MAX_OUTPUT_CHARS);
  const selectedSourceTaskId = sourceTaskId ?? taskId;
  const selectedRecords = transcriptRecords
    .filter((record) => !selectedSourceTaskId || record.taskId === selectedSourceTaskId)
    .slice(0, safeLimit)
    .reverse();
  const sourceMessages = [];
  let redactions = 0;
  let truncatedOutputs = 0;

  for (const record of selectedRecords) {
    sourceMessages.push(taskContextMessage(record, findTask(tasks, record.taskId)));
    const transcript = transcriptContextMessage(record, safeMaxOutputChars);
    sourceMessages.push(transcript.message);
    redactions += transcript.redactions;
    if (transcript.outputTruncated) truncatedOutputs += 1;
  }
  if (workViewAssociation) {
    sourceMessages.push(protectedSummaryMessage("trusted_work_view", workViewAssociation.summary));
  }
  if (planTodoEvidence) {
    sourceMessages.push(protectedSummaryMessage("engineering_plan_todo", planTodoContextSummary(planTodoEvidence)));
  }
  if (experienceMemory) {
    sourceMessages.push(protectedSummaryMessage("experience_memory", experienceMemory));
  }
  sourceMessages.push(protectedSummaryMessage("verification", verificationEvidence?.summary));
  sourceMessages.push(protectedSummaryMessage("recovery", recoveryEvidence?.summary));

  const projection = buildNativeEngineeringMicrocompactProjection({
    messages: sourceMessages,
    thresholdChars,
    protectRecentAssistantTurns,
  });
  const generatedAt = new Date().toISOString();

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_CONTEXT_PACKET_REGISTRY,
    mode: "local_governed_engineering_context_assembly",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    capability: {
      id: "sense.openclaw.engineering_context.packet",
      risk: "medium",
      approvalRequired: false,
    },
    messages: projection.messages,
    summary: {
      sourceTranscriptRecords: selectedRecords.length,
      sourceTaskId: selectedSourceTaskId,
      messageCount: projection.messages.length,
      redactions,
      truncatedOutputs,
      compactedMessages: projection.summary.compactedMessages,
      reclaimedChars: projection.summary.reclaimedChars,
      verificationEvidenceProtected: true,
      recoveryEvidenceProtected: true,
      workViewAssociationIncluded: Boolean(workViewAssociation),
      workViewAssociationStatus: workViewAssociation?.summary?.status ?? null,
      workViewObservationIncluded: workViewAssociation?.observation != null,
      workViewObservationStatus: workViewAssociation?.summary?.workViewObservationStatus ?? null,
      workViewObservationFreshness: workViewAssociation?.summary?.workViewObservationFreshness ?? null,
      workViewObservationSequence: workViewAssociation?.summary?.workViewObservationSequence ?? null,
      semanticTargetCount: workViewAssociation?.summary?.semanticTargetCount ?? null,
      semanticActionDecisionStatus: workViewAssociation?.summary?.semanticActionDecisionStatus ?? null,
      semanticActionDecisionReason: workViewAssociation?.summary?.semanticActionDecisionReason ?? null,
      semanticActionReady: workViewAssociation?.summary?.semanticActionReady === true,
      semanticActionOperatorControlId: workViewAssociation?.summary?.semanticActionOperatorControlId ?? null,
      planTodoEvidenceIncluded: Boolean(planTodoEvidence),
      planTodoTodoSource: planTodoEvidence?.summary?.todoSource ?? null,
      planTodoCurrentAction: planTodoEvidence?.nextGovernedActionSuggestion?.suggestion?.actionId ?? null,
      experienceMemoryIncluded: Boolean(experienceMemory),
      experienceMemoryRecalled: experienceMemory?.summary?.recalledRecords ?? 0,
      experienceMemoryStored: experienceMemory?.summary?.storedRecords ?? 0,
      experienceMemoryMatched: experienceMemory?.summary?.matchedRecords ?? 0,
      experienceMemoryCompletedMatches: experienceMemory?.summary?.completedMatches ?? 0,
      experienceMemoryFailedMatches: experienceMemory?.summary?.failedMatches ?? 0,
      experienceMemoryCompletionRate: experienceMemory?.summary?.completionRate ?? null,
      experienceMemoryLatestOutcome: experienceMemory?.summary?.latestOutcome ?? null,
      experienceMemoryPattern: experienceMemory?.summary?.pattern ?? null,
      experienceMemoryNextAction: experienceMemory?.summary?.nextAction ?? null,
      experienceMemoryIncidentTargetUnit: experienceMemory?.summary?.incidentTargetUnit ?? null,
      experienceMemoryIncidentMatched: experienceMemory?.summary?.incidentMatchedRecords ?? 0,
      experienceMemoryIncidentRestored: experienceMemory?.summary?.incidentRestoredMatches ?? 0,
      experienceMemoryIncidentRecoveryRequired: experienceMemory?.summary?.incidentRecoveryRequiredMatches ?? 0,
      experienceMemoryIncidentLatestRestoredHealthy: experienceMemory?.summary?.incidentLatestRestoredHealthy ?? null,
      experienceMemoryIncidentPattern: experienceMemory?.summary?.incidentPattern ?? null,
      experienceMemoryIncidentNextAction: experienceMemory?.summary?.incidentNextAction ?? null,
      experienceMemoryStatus: experienceMemory?.summary?.status ?? null,
      experienceMemoryAdvisoryOnly: experienceMemory?.summary?.advisoryOnly === true,
    },
    bounds: {
      maxTranscriptRecords: MAX_LIMIT,
      selectedTranscriptRecords: safeLimit,
      maxOutputCharsPerRecord: safeMaxOutputChars,
      projection: projection.bounds,
      experienceMemory: experienceMemory?.bounds ?? null,
    },
    provenance: {
      transcriptRegistry: "command-transcript-ledger",
      verificationRegistry: verificationEvidence?.registry ?? null,
      recoveryRegistry: recoveryEvidence?.registry ?? null,
      taskId,
      sourceTaskId: selectedSourceTaskId,
      workViewAssociationRegistry: workViewAssociation?.registry ?? null,
      experienceMemoryRegistry: experienceMemory?.registry ?? null,
    },
    governance: {
      localAssemblyOnly: true,
      credentialLikeOutputRedacted: true,
      mutatesPersistedLogs: false,
      mutatesTaskState: false,
      callsProvider: false,
      networkEgress: false,
      readsCredentialStore: false,
      createsTask: false,
      createsApproval: false,
      readsTrustedWorkViewState: Boolean(workViewAssociation),
      readsTrustedWorkViewObservation: workViewAssociation?.observation != null,
      readsPlanTodoEvidence: Boolean(planTodoEvidence),
      readsExperienceMemory: Boolean(experienceMemory),
      experienceMemoryAdvisoryOnly: experienceMemory?.governance?.advisoryOnly === true,
      localServiceReadOnly: Boolean(workViewAssociation),
    },
    auditEvidence: {
      operation: "engineering_context_packet_built",
      generatedAt,
      inputContentRecorded: false,
      outputContentRecorded: false,
      summary: {
        sourceTranscriptRecords: selectedRecords.length,
        sourceTaskId: selectedSourceTaskId,
        messageCount: projection.messages.length,
        redactions,
        compactedMessages: projection.summary.compactedMessages,
          reclaimedChars: projection.summary.reclaimedChars,
          workViewAssociation: workViewAssociation?.summary ?? null,
          experienceMemory: experienceMemory?.auditEvidence?.summary ?? null,
        },
    },
    workViewAssociation,
  };
}
