import { createHash } from "node:crypto";

import { systemdHealthServiceKeyForUnit } from "./systemd-repair-verification.mjs";
import {
  SYSTEMD_INCIDENT_EXPERIENCE_REGISTRY,
  validateSystemdIncidentReceiptTask,
} from "./systemd-incident-receipt.mjs";

export const NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY =
  "openclaw-native-engineering-experience-memory-v0";
export const NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY =
  "openclaw-native-engineering-experience-feedback-v0";

const DEFAULT_RECALL_LIMIT = 4;
const MAX_RECALL_LIMIT = 8;
const MAX_RECORDS = 200;
const MAX_FEEDBACK_OBSERVATIONS = 32;
const MAX_TASK_TYPE_CHARS = 80;
const MAX_LESSON_CHARS = 320;
const MAX_TOKEN_CHARS = 40;
const MAX_APPLICABILITY_TOKENS = 16;
const MAX_SOURCE_TASK_ID_CHARS = 120;
const MAX_NEXT_ACTION_CHARS = 240;
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "from",
  "into",
  "with",
  "this",
  "that",
  "then",
  "after",
  "before",
  "task",
  "work",
  "use",
  "using",
  "one",
]);
const SENSITIVE_WORDS = new Set([
  "api",
  "apikey",
  "credential",
  "key",
  "password",
  "passwd",
  "secret",
  "token",
  "bearer",
  "auth",
]);

function boundedText(value, maxChars) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function normaliseTaskType(value) {
  const text = boundedText(value, MAX_TASK_TYPE_CHARS).toLowerCase();
  return /^[a-z0-9][a-z0-9._-]*$/u.test(text) ? text : "generic_task";
}

function normaliseExecutionPhase(value) {
  const text = boundedText(value, 80).toLowerCase();
  return /^[a-z0-9][a-z0-9._-]*$/u.test(text) ? text : "terminal_review";
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function safeSourceTaskId(value) {
  const text = boundedText(value, MAX_SOURCE_TASK_ID_CHARS);
  return /^[a-zA-Z0-9._:-]+$/u.test(text) ? text : null;
}

function normaliseToken(value) {
  const token = boundedText(value, MAX_TOKEN_CHARS).toLowerCase();
  if (!/^[a-z][a-z0-9_-]*$/u.test(token)) return null;
  if (STOP_WORDS.has(token) || SENSITIVE_WORDS.has(token)) return null;
  if (/^(?:[a-f0-9]{24,}|[a-z0-9_-]{28,})$/u.test(token)) return null;
  return token;
}

function goalTokens(goal) {
  const text = boundedText(goal, 500)
    .replace(/https?:\/\/[^\s]+/giu, " ")
    .replace(/\b(password|passwd|secret|token|api[\s_-]?key|credential|bearer)(?:\s*(?::|=|\bis\b))?\s*[^\s,;]+/giu, " ")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gu, " ");
  return text
    .split(/[^a-zA-Z0-9_-]+/u)
    .map(normaliseToken)
    .filter(Boolean);
}

function taskTypeTokens(taskType) {
  return taskType
    .split(/[._-]+/u)
    .map(normaliseToken)
    .filter(Boolean);
}

function applicabilityTokens(taskType, goal, incidentPattern = null) {
  return [...new Set([
    `type:${taskType}`,
    ...(incidentPattern ? [`unit:${incidentPattern.targetUnit}`] : []),
    ...taskTypeTokens(taskType),
    ...goalTokens(goal),
  ])].slice(0, MAX_APPLICABILITY_TOKENS);
}

function experienceOutcome(task) {
  if (task?.status === "completed" || task?.outcome?.kind === "completed") return "completed";
  if (task?.status === "failed" || task?.outcome?.kind === "failed") return "failed";
  return null;
}

function lessonFor({ taskType, outcome, executionPhase, incidentPattern = null }) {
  const phase = boundedText(executionPhase, 80) || "terminal_review";
  if (incidentPattern) {
    return boundedText(
      incidentPattern.restoredHealthy
        ? `The governed ${incidentPattern.targetUnit} incident restored native and application health; reuse the fixed approval and post-health verification boundary.`
        : `The governed ${incidentPattern.targetUnit} incident did not restore health; compare bounded recovery evidence before another approved repair.`,
      MAX_LESSON_CHARS,
    );
  }
  if (outcome === "completed") {
    return boundedText(
      `A governed ${taskType} task completed at ${phase}; reuse bounded approval and verification boundaries for similar work.`,
      MAX_LESSON_CHARS,
    );
  }
  return boundedText(
    `A governed ${taskType} task failed at ${phase}; inspect recovery evidence before retrying and preserve the existing approval boundary.`,
    MAX_LESSON_CHARS,
  );
}

function buildSystemdIncidentPattern(task) {
  const validation = validateSystemdIncidentReceiptTask({ sourceTask: task });
  if (!validation.ok) return null;
  const receipt = validation.receipt;
  return {
    registry: SYSTEMD_INCIDENT_EXPERIENCE_REGISTRY,
    targetUnit: validation.targetUnit,
    healthServiceKey: validation.healthServiceKey,
    sourceReceiptHash: receipt.receiptHash,
    restoredHealthy: receipt.restoredHealthy === true,
    preHealthy: receipt.preHealth?.healthy === true,
    postHealthy: receipt.postHealth?.healthy === true,
    journalAvailable: receipt.journalEvidence.available === true,
    journalEntries: Number.isInteger(receipt.journalEvidence.returned)
      ? receipt.journalEvidence.returned
      : 0,
    restartCommandSucceeded: receipt.hostdReceipt?.commandSucceeded === true,
    nativeMutationObserved: receipt.hostdReceipt?.transport === "dbus_native"
      && receipt.hostdReceipt?.method === "org.freedesktop.systemd1.Manager.RestartUnit",
    journalMessagesIncluded: false,
    providerOutputIncluded: false,
  };
}

function normaliseIncidentTargetUnit(value) {
  const targetUnit = boundedText(value, 120);
  return systemdHealthServiceKeyForUnit(targetUnit) ? targetUnit : null;
}

function buildIncidentAdvisoryPattern(candidates, targetUnit) {
  const incidents = targetUnit
    ? candidates.filter(({ record }) => record.incidentPattern?.targetUnit === targetUnit)
    : [];
  const restoredMatches = incidents.filter(({ record }) => record.incidentPattern.restoredHealthy).length;
  const recoveryRequiredMatches = incidents.length - restoredMatches;
  const latest = [...incidents]
    .sort((left, right) => String(right.record.recordedAt).localeCompare(String(left.record.recordedAt)))[0]?.record;
  let pattern = "none";
  let nextAction = "No matching fixed-target incident history is available.";
  if (incidents.length > 0 && recoveryRequiredMatches === 0) {
    pattern = "repeatable_restoration";
    nextAction = "Reuse the fixed approval path and verify both native and application health.";
  } else if (incidents.length > 0 && restoredMatches === 0) {
    pattern = "repeated_recovery_required";
    nextAction = "Compare the latest bounded recovery evidence before another approved repair.";
  } else if (incidents.length > 0) {
    pattern = "mixed_restoration_outcomes";
    nextAction = "Compare restored and unresolved receipts before selecting another governed repair.";
  }
  return {
    targetUnit,
    matchedRecords: incidents.length,
    restoredMatches,
    recoveryRequiredMatches,
    latestRestoredHealthy: latest?.incidentPattern?.restoredHealthy ?? null,
    pattern,
    nextAction: boundedText(nextAction, MAX_NEXT_ACTION_CHARS),
  };
}

function buildAdvisoryPattern(candidates) {
  const completedMatches = candidates.filter(({ record }) => record.outcome === "completed").length;
  const failedMatches = candidates.filter(({ record }) => record.outcome === "failed").length;
  const terminalRecords = completedMatches + failedMatches;
  const latest = [...candidates]
    .sort((left, right) => String(right.record.recordedAt).localeCompare(String(left.record.recordedAt)))[0]?.record;
  let pattern = "no_terminal_history";
  let nextAction = "Follow the standard approval and verification boundaries for this task.";

  if (terminalRecords === 0) {
    pattern = candidates.length > 0 ? "non_terminal_history" : "no_match";
  } else if (failedMatches > 0 && completedMatches === 0) {
    pattern = "recovery_needed";
    nextAction = "Inspect the latest recovery evidence before retrying; preserve the approval boundary.";
  } else if (failedMatches > 0) {
    pattern = "mixed_outcomes";
    nextAction = "Compare prior completion and failure evidence before repeating; preserve approval and verification.";
  } else {
    pattern = "repeatable_success";
    nextAction = "Reuse the bounded approval path and attach verification evidence before reporting completion.";
  }

  return {
    matchedRecords: candidates.length,
    terminalRecords,
    completedMatches,
    failedMatches,
    completionRate: terminalRecords > 0
      ? Number((completedMatches / terminalRecords).toFixed(2))
      : null,
    latestOutcome: latest?.outcome ?? null,
    pattern,
    nextAction: boundedText(nextAction, MAX_NEXT_ACTION_CHARS),
  };
}

function normaliseLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_RECALL_LIMIT)
    : DEFAULT_RECALL_LIMIT;
}

function recordTokens(record) {
  return new Set(Array.isArray(record?.applicabilityTokens) ? record.applicabilityTokens : []);
}

function publicRecord(record, relevance) {
  return {
    id: record.id,
    taskType: record.taskType,
    lesson: record.lesson,
    outcome: record.outcome,
    executionPhase: record.executionPhase,
    applicabilityTokens: [...record.applicabilityTokens],
    confidence: record.confidence,
    recordedAt: record.recordedAt,
    source: {
      registry: record.source.registry,
      outcomeHash: record.source.outcomeHash,
    },
    incidentPattern: record.incidentPattern ? { ...record.incidentPattern } : null,
    feedback: feedbackSummary(record),
    relevance,
  };
}

function feedbackObservations(record) {
  return Array.isArray(record?.feedback?.observations)
    ? record.feedback.observations
      .filter((observation) => observation
        && typeof observation.key === "string"
        && (observation.outcome === "completed" || observation.outcome === "failed"))
      .slice(-MAX_FEEDBACK_OBSERVATIONS)
    : [];
}

function feedbackSummary(record) {
  const observations = feedbackObservations(record);
  const completed = observations.filter((observation) => observation.outcome === "completed").length;
  const failed = observations.length - completed;
  const latest = observations.at(-1) ?? null;
  return {
    registry: NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY,
    correlation: "same_task_type_subsequent_terminal_outcome",
    observedOutcomes: observations.length,
    completed,
    failed,
    completionRate: observations.length > 0
      ? Number((completed / observations.length).toFixed(2))
      : null,
    latestOutcome: latest?.outcome ?? null,
    latestObservedAt: latest?.observedAt ?? null,
    causalAttribution: false,
    advisoryUseProven: false,
  };
}

function aggregateFeedback(candidates) {
  const observations = new Map();
  let observedRecords = 0;
  for (const { record } of candidates) {
    const recordObservations = feedbackObservations(record);
    if (recordObservations.length > 0) observedRecords += 1;
    for (const observation of recordObservations) {
      observations.set(observation.key, observation);
    }
  }
  const ordered = [...observations.values()]
    .sort((left, right) => String(left.observedAt).localeCompare(String(right.observedAt)));
  const completed = ordered.filter((observation) => observation.outcome === "completed").length;
  const failed = ordered.length - completed;
  return {
    observedRecords,
    observedOutcomes: ordered.length,
    completed,
    failed,
    completionRate: ordered.length > 0
      ? Number((completed / ordered.length).toFixed(2))
      : null,
    latestOutcome: ordered.at(-1)?.outcome ?? null,
    latestObservedAt: ordered.at(-1)?.observedAt ?? null,
  };
}

function recordSubsequentOutcomeFeedback({ records, task, taskType, outcome, outcomeHash, observedAt }) {
  const sourceTaskId = safeSourceTaskId(task?.id);
  if (!sourceTaskId) return;
  const observation = {
    key: sha256(JSON.stringify({ sourceTaskId, outcomeHash })),
    outcome,
    observedAt,
  };
  for (const [recordTaskId, record] of records) {
    if (recordTaskId === task.id || record?.taskType !== taskType) continue;
    const observations = feedbackObservations(record);
    const existingIndex = observations.findIndex((item) => item.key === observation.key);
    if (existingIndex >= 0) observations[existingIndex] = observation;
    else observations.push(observation);
    record.feedback = {
      registry: NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY,
      correlation: "same_task_type_subsequent_terminal_outcome",
      observations: observations.slice(-MAX_FEEDBACK_OBSERVATIONS),
      causalAttribution: false,
      advisoryUseProven: false,
    };
  }
}

export function createNativeEngineeringExperienceMemory({ records = new Map(), now = () => new Date().toISOString() } = {}) {
  if (!(records instanceof Map)) {
    throw new Error("Native engineering experience memory requires a Map of records.");
  }

  function recordTaskExperience(task) {
    const outcome = experienceOutcome(task);
    if (!outcome || !task?.id) return null;

    const taskType = normaliseTaskType(task.type);
    const executionPhase = normaliseExecutionPhase(task.executionPhase);
    const incidentPattern = buildSystemdIncidentPattern(task);
    const tokens = applicabilityTokens(taskType, task.goal, incidentPattern);
    const sourceTaskId = safeSourceTaskId(task.id);
    const outcomeHash = sha256(JSON.stringify({
      taskType,
      outcome,
      executionPhase,
      applicabilityTokens: tokens,
      incidentPattern,
    }));
    const recordedAt = now();
    recordSubsequentOutcomeFeedback({
      records,
      task,
      taskType,
      outcome,
      outcomeHash,
      observedAt: recordedAt,
    });
    const record = {
      id: `experience-${outcomeHash.slice(0, 16)}`,
      schema: "openclaw.native_engineering_experience.v0",
      recordedAt,
      taskType,
      lesson: lessonFor({ taskType, outcome, executionPhase, incidentPattern }),
      outcome,
      executionPhase,
      applicabilityTokens: tokens,
      incidentPattern,
      feedback: {
        registry: NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY,
        correlation: "same_task_type_subsequent_terminal_outcome",
        observations: [],
        causalAttribution: false,
        advisoryUseProven: false,
      },
      confidence: outcome === "completed" ? 0.72 : 0.58,
      source: {
        registry: "openclaw-task-lifecycle-terminal-v0",
        taskId: sourceTaskId,
        outcomeHash,
      },
      governance: {
        advisoryOnly: true,
        createsTask: false,
        createsApproval: false,
        executesAction: false,
        callsProvider: false,
        networkEgress: false,
      },
    };

    records.set(task.id, record);
    while (records.size > MAX_RECORDS) {
      const oldestKey = records.keys().next().value;
      if (oldestKey === undefined) break;
      records.delete(oldestKey);
    }
    return record;
  }

  function buildExperienceMemoryReadModel({ taskType, goal, incidentTargetUnit, limit } = {}) {
    const selectedTaskType = normaliseTaskType(taskType);
    const selectedIncidentTargetUnit = normaliseIncidentTargetUnit(incidentTargetUnit);
    const queryTokens = new Set(applicabilityTokens(
      selectedTaskType,
      goal,
      selectedIncidentTargetUnit ? { targetUnit: selectedIncidentTargetUnit } : null,
    ));
    const matchingCandidates = [...records.values()]
      .map((record) => {
        if (selectedIncidentTargetUnit
          && record.incidentPattern
          && record.incidentPattern.targetUnit !== selectedIncidentTargetUnit) {
          return { record, relevance: 0 };
        }
        const matches = [...queryTokens].filter((token) => recordTokens(record).has(token)).length;
        const exactType = record.taskType === selectedTaskType;
        const exactIncidentTarget = record.incidentPattern?.targetUnit === selectedIncidentTargetUnit;
        const relevance = (exactIncidentTarget ? 1_000 : 0) + (exactType ? 100 : 0) + matches;
        return { record, relevance };
      })
      .filter(({ relevance }) => relevance > 0)
      .sort((left, right) => right.relevance - left.relevance
        || String(right.record.recordedAt).localeCompare(String(left.record.recordedAt)))
    const candidates = matchingCandidates.slice(0, normaliseLimit(limit));
    const recalledRecords = candidates.map(({ record, relevance }) => publicRecord(record, relevance));
    const pattern = buildAdvisoryPattern(matchingCandidates);
    const incidentPattern = buildIncidentAdvisoryPattern(matchingCandidates, selectedIncidentTargetUnit);
    const feedback = aggregateFeedback(matchingCandidates);
    const generatedAt = now();
    const queryHash = sha256(JSON.stringify({
      taskType: selectedTaskType,
      tokens: [...queryTokens],
      incidentTargetUnit: selectedIncidentTargetUnit,
    }));

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY,
      mode: "bounded_advisory_experience_recall",
      generatedAt,
      records: recalledRecords,
      summary: {
        storedRecords: records.size,
        recalledRecords: recalledRecords.length,
        matchedRecords: pattern.matchedRecords,
        terminalRecords: pattern.terminalRecords,
        completedMatches: pattern.completedMatches,
        failedMatches: pattern.failedMatches,
        completionRate: pattern.completionRate,
        latestOutcome: pattern.latestOutcome,
        pattern: pattern.pattern,
        nextAction: pattern.nextAction,
        incidentTargetUnit: incidentPattern.targetUnit,
        incidentMatchedRecords: incidentPattern.matchedRecords,
        incidentRestoredMatches: incidentPattern.restoredMatches,
        incidentRecoveryRequiredMatches: incidentPattern.recoveryRequiredMatches,
        incidentLatestRestoredHealthy: incidentPattern.latestRestoredHealthy,
        incidentPattern: incidentPattern.pattern,
        incidentNextAction: incidentPattern.nextAction,
        feedbackObservedRecords: feedback.observedRecords,
        feedbackObservedOutcomes: feedback.observedOutcomes,
        feedbackCompleted: feedback.completed,
        feedbackFailed: feedback.failed,
        feedbackCompletionRate: feedback.completionRate,
        feedbackLatestOutcome: feedback.latestOutcome,
        feedbackLatestObservedAt: feedback.latestObservedAt,
        feedbackCorrelation: "same_task_type_subsequent_terminal_outcome",
        feedbackCausalAttribution: false,
        feedbackAdvisoryUseProven: false,
        matchedTaskType: recalledRecords.some((record) => record.taskType === selectedTaskType),
        queryTokenCount: queryTokens.size,
        status: recalledRecords.length > 0 ? "recalled" : records.size > 0 ? "no_match" : "empty",
        advisoryOnly: true,
      },
      bounds: {
        maxRecords: MAX_RECORDS,
        maxRecallRecords: MAX_RECALL_LIMIT,
        selectedRecallRecords: recalledRecords.length,
        maxLessonChars: MAX_LESSON_CHARS,
        maxFeedbackObservationsPerRecord: MAX_FEEDBACK_OBSERVATIONS,
      },
      governance: {
        advisoryOnly: true,
        mutatesRecords: false,
        createsTask: false,
        createsApproval: false,
        executesAction: false,
        callsProvider: false,
        networkEgress: false,
        feedbackChangesExecutionPolicy: false,
      },
      auditEvidence: {
        operation: "engineering_experience_memory_recalled",
        generatedAt,
        inputContentRecorded: false,
        outputContentRecorded: false,
        summary: {
          storedRecords: records.size,
          recalledRecords: recalledRecords.length,
          matchedRecords: pattern.matchedRecords,
          completedMatches: pattern.completedMatches,
          failedMatches: pattern.failedMatches,
          completionRate: pattern.completionRate,
          pattern: pattern.pattern,
          incidentTargetUnit: incidentPattern.targetUnit,
          incidentMatchedRecords: incidentPattern.matchedRecords,
          incidentRestoredMatches: incidentPattern.restoredMatches,
          incidentRecoveryRequiredMatches: incidentPattern.recoveryRequiredMatches,
          incidentLatestRestoredHealthy: incidentPattern.latestRestoredHealthy,
          incidentPattern: incidentPattern.pattern,
          feedbackObservedRecords: feedback.observedRecords,
          feedbackObservedOutcomes: feedback.observedOutcomes,
          feedbackCompleted: feedback.completed,
          feedbackFailed: feedback.failed,
          feedbackCompletionRate: feedback.completionRate,
          feedbackLatestOutcome: feedback.latestOutcome,
          feedbackCorrelation: "same_task_type_subsequent_terminal_outcome",
          feedbackCausalAttribution: false,
          feedbackAdvisoryUseProven: false,
          queryTokenCount: queryTokens.size,
          queryHash,
          advisoryOnly: true,
        },
      },
    };
  }

  return {
    recordTaskExperience,
    buildExperienceMemoryReadModel,
  };
}
