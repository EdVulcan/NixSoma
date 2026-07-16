import { createHash } from "node:crypto";

export const NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY =
  "openclaw-native-engineering-experience-memory-v0";

const DEFAULT_RECALL_LIMIT = 4;
const MAX_RECALL_LIMIT = 8;
const MAX_RECORDS = 200;
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

function applicabilityTokens(taskType, goal) {
  return [...new Set([
    `type:${taskType}`,
    ...taskTypeTokens(taskType),
    ...goalTokens(goal),
  ])].slice(0, MAX_APPLICABILITY_TOKENS);
}

function experienceOutcome(task) {
  if (task?.status === "completed" || task?.outcome?.kind === "completed") return "completed";
  if (task?.status === "failed" || task?.outcome?.kind === "failed") return "failed";
  return null;
}

function lessonFor({ taskType, outcome, executionPhase }) {
  const phase = boundedText(executionPhase, 80) || "terminal_review";
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
    relevance,
  };
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
    const tokens = applicabilityTokens(taskType, task.goal);
    const sourceTaskId = safeSourceTaskId(task.id);
    const outcomeHash = sha256(JSON.stringify({
      taskType,
      outcome,
      executionPhase,
      applicabilityTokens: tokens,
    }));
    const record = {
      id: `experience-${outcomeHash.slice(0, 16)}`,
      schema: "openclaw.native_engineering_experience.v0",
      recordedAt: now(),
      taskType,
      lesson: lessonFor({ taskType, outcome, executionPhase }),
      outcome,
      executionPhase,
      applicabilityTokens: tokens,
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

  function buildExperienceMemoryReadModel({ taskType, goal, limit } = {}) {
    const selectedTaskType = normaliseTaskType(taskType);
    const queryTokens = new Set(applicabilityTokens(selectedTaskType, goal));
    const matchingCandidates = [...records.values()]
      .map((record) => {
        const matches = [...queryTokens].filter((token) => recordTokens(record).has(token)).length;
        const exactType = record.taskType === selectedTaskType;
        const relevance = (exactType ? 100 : 0) + matches;
        return { record, relevance };
      })
      .filter(({ relevance }) => relevance > 0)
      .sort((left, right) => right.relevance - left.relevance
        || String(right.record.recordedAt).localeCompare(String(left.record.recordedAt)))
    const candidates = matchingCandidates.slice(0, normaliseLimit(limit));
    const recalledRecords = candidates.map(({ record, relevance }) => publicRecord(record, relevance));
    const pattern = buildAdvisoryPattern(matchingCandidates);
    const generatedAt = now();
    const queryHash = sha256(JSON.stringify({ taskType: selectedTaskType, tokens: [...queryTokens] }));

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
      },
      governance: {
        advisoryOnly: true,
        mutatesRecords: false,
        createsTask: false,
        createsApproval: false,
        executesAction: false,
        callsProvider: false,
        networkEgress: false,
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
