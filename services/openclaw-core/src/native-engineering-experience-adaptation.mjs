import { createHash, randomInt, randomUUID } from "node:crypto";

import {
  validateNativeEngineeringRecommendationFeedbackReceipt,
} from "./native-engineering-recommendation-feedback.mjs";
import {
  validateNativeEngineeringRecommendationOutcomeReceipt,
} from "./native-engineering-recommendation-outcome-receipt.mjs";

export const NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_REGISTRY =
  "nixsoma-controlled-experience-adaptation-v0";
export const NATIVE_ENGINEERING_EXPERIENCE_EXPERIMENT_REGISTRY =
  "nixsoma-experience-ranking-experiment-v0";
export const NATIVE_ENGINEERING_EXPERIENCE_PROFILE_REGISTRY =
  "nixsoma-experience-ranking-profile-v0";
export const NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE =
  Symbol("nixsoma-experience-adaptation-evidence");

const ENGINEERING_RECOMMENDATION_CONTRACT = "engineering_recommendation_v0";
const BASELINE_MODE = "baseline";
const ADAPTIVE_MODE = "feedback_weighted";
const MIN_TRIALS = 8;
const MAX_TRIALS = 32;
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 30 * 24 * 60;
const MAX_EXPERIMENTS = 16;
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SAFE_TASK_TYPE = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const OPEN_STATUSES = new Set(["armed", "collecting", "paused_after_restart"]);

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function normaliseTaskType(value) {
  const taskType = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!SAFE_TASK_TYPE.test(taskType)) {
    throw new Error("Experience adaptation requires a bounded taskType.");
  }
  return taskType;
}

function boundedEvenInteger(value, min, max, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max || parsed % 2 !== 0) {
    throw new Error(`Experience adaptation ${label} must be an even integer from ${min} to ${max}.`);
  }
  return parsed;
}

function boundedInteger(value, min, max, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Experience adaptation ${label} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

function recordIds(readModel) {
  return Array.isArray(readModel?.records)
    ? readModel.records
      .map((record) => record?.id)
      .filter((id) => typeof id === "string" && SAFE_ID.test(id))
      .slice(0, 4)
    : [];
}

function sameOrder(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function logChoose(n, k) {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  const selected = Math.min(k, n - k);
  let result = 0;
  for (let index = 1; index <= selected; index += 1) {
    result += Math.log(n - selected + index) - Math.log(index);
  }
  return result;
}

function hypergeometricProbability(a, treatmentTotal, controlTotal, successTotal) {
  const total = treatmentTotal + controlTotal;
  return Math.exp(
    logChoose(treatmentTotal, a)
      + logChoose(controlTotal, successTotal - a)
      - logChoose(total, successTotal),
  );
}

function fisherExactTwoSided({ treatmentCompleted, treatmentTotal, baselineCompleted, baselineTotal }) {
  if (treatmentTotal <= 0 || baselineTotal <= 0) return null;
  const successTotal = treatmentCompleted + baselineCompleted;
  const minimum = Math.max(0, successTotal - baselineTotal);
  const maximum = Math.min(treatmentTotal, successTotal);
  const observed = hypergeometricProbability(
    treatmentCompleted,
    treatmentTotal,
    baselineTotal,
    successTotal,
  );
  let pValue = 0;
  for (let candidate = minimum; candidate <= maximum; candidate += 1) {
    const probability = hypergeometricProbability(candidate, treatmentTotal, baselineTotal, successTotal);
    if (probability <= observed + 1e-12) pValue += probability;
  }
  return Number(Math.min(1, pValue).toFixed(6));
}

function armSummary(assignments, mode) {
  const selected = assignments.filter((assignment) => assignment.rankingMode === mode);
  const terminal = selected.filter((assignment) => assignment.terminalOutcome != null);
  const completed = terminal.filter((assignment) => assignment.terminalOutcome === "completed").length;
  const feedback = terminal.map((assignment) => assignment.feedbackRating).filter(Boolean);
  return {
    assigned: selected.length,
    terminal: terminal.length,
    completed,
    failed: terminal.length - completed,
    completionRate: terminal.length > 0 ? Number((completed / terminal.length).toFixed(4)) : null,
    feedbackRecorded: feedback.length,
    helpful: feedback.filter((rating) => rating === "helpful").length,
    notHelpful: feedback.filter((rating) => rating === "not_helpful").length,
    uncertain: feedback.filter((rating) => rating === "uncertain").length,
  };
}

function analyseExperiment(experiment) {
  const baseline = armSummary(experiment.assignments, BASELINE_MODE);
  const feedbackWeighted = armSummary(experiment.assignments, ADAPTIVE_MODE);
  const complete = experiment.assignments.length === experiment.trialLimit
    && baseline.terminal === baseline.assigned
    && feedbackWeighted.terminal === feedbackWeighted.assigned
    && baseline.assigned === feedbackWeighted.assigned;
  const completionRateDifference = complete
    ? Number((feedbackWeighted.completionRate - baseline.completionRate).toFixed(4))
    : null;
  const exactTestPValue = complete
    ? fisherExactTwoSided({
        treatmentCompleted: feedbackWeighted.completed,
        treatmentTotal: feedbackWeighted.terminal,
        baselineCompleted: baseline.completed,
        baselineTotal: baseline.terminal,
      })
    : null;
  const evidenceSupportsRankingChange = complete
    && Math.abs(completionRateDifference) >= 0.25
    && exactTestPValue <= 0.05;
  const candidateRankingMode = evidenceSupportsRankingChange
    ? completionRateDifference > 0 ? ADAPTIVE_MODE : BASELINE_MODE
    : "no_change";
  const evidence = {
    experimentId: experiment.id,
    taskType: experiment.taskType,
    trialLimit: experiment.trialLimit,
    model: experiment.model ?? null,
    baseline,
    feedbackWeighted,
    complete,
    completionRateDifference,
    exactTest: "fisher_two_sided",
    exactTestPValue,
    minimumAbsoluteEffect: 0.25,
    maximumPValue: 0.05,
    candidateRankingMode,
    evidenceSupportsRankingChange,
    randomizedAssignment: true,
    pairedBalance: true,
    predeclaredDecisionRule: true,
    causalScope: "bounded_recall_ordering_experiment",
    generalCausalAttribution: false,
  };
  return {
    ...evidence,
    evidenceHash: sha256(JSON.stringify(evidence)),
  };
}

function publicAssignment(assignment) {
  return {
    index: assignment.index,
    providerTaskId: assignment.providerTaskId,
    sourceTaskId: assignment.sourceTaskId,
    rankingMode: assignment.rankingMode,
    assignedAt: assignment.assignedAt,
    assignmentHash: assignment.assignmentHash,
    selectedRecordSetHash: assignment.selectedRecordSetHash,
    terminalOutcome: assignment.terminalOutcome,
    downstreamTaskId: assignment.downstreamTaskId,
    outcomeReceiptHash: assignment.outcomeReceiptHash,
    feedbackRating: assignment.feedbackRating,
    feedbackReceiptHash: assignment.feedbackReceiptHash,
    observedAt: assignment.observedAt,
  };
}

function publicProfile(profile) {
  return profile ? { ...profile } : null;
}

function publicExperiment(experiment) {
  const analysis = analyseExperiment(experiment);
  return {
    registry: experiment.registry,
    id: experiment.id,
    status: experiment.status,
    taskType: experiment.taskType,
    trialLimit: experiment.trialLimit,
    createdAt: experiment.createdAt,
    deadlineAt: experiment.deadlineAt,
    pausedAt: experiment.pausedAt ?? null,
    completedAt: experiment.completedAt ?? null,
    cancelledAt: experiment.cancelledAt ?? null,
    model: experiment.model ?? null,
    assignments: experiment.assignments.map(publicAssignment),
    analysis,
    activatedProfileId: experiment.activatedProfileId ?? null,
    governance: {
      finite: true,
      callerSelectsArm: false,
      automaticTaskCreation: false,
      automaticProviderCall: false,
      automaticExecution: false,
      changesExecutionPolicy: false,
      changesAuthority: false,
      operatorActivationRequired: true,
      generalCausalAttribution: false,
    },
  };
}

export function createNativeEngineeringExperienceAdaptation({
  experiments = new Map(),
  profiles = new Map(),
  persistState = () => {},
  now = () => new Date().toISOString(),
  createId = () => randomUUID(),
  nextRandomArm = () => randomInt(2),
} = {}) {
  if (!(experiments instanceof Map) || !(profiles instanceof Map)) {
    throw new Error("Experience adaptation requires experiment and profile Maps.");
  }

  function persistNow() {
    persistState();
    persistState.flush?.();
  }

  function refreshStatus(experiment) {
    if (!experiment || !OPEN_STATUSES.has(experiment.status)) return false;
    const analysis = analyseExperiment(experiment);
    if (analysis.complete) {
      experiment.status = "completed";
      experiment.completedAt ??= now();
      return true;
    }
    if (Date.parse(now()) >= Date.parse(experiment.deadlineAt)) {
      experiment.status = "expired";
      experiment.expiredAt = now();
      return true;
    }
    const nextStatus = experiment.assignments.length >= experiment.trialLimit
      ? "collecting"
      : experiment.status;
    if (nextStatus !== experiment.status) {
      experiment.status = nextStatus;
      return true;
    }
    return false;
  }

  function findExperiment(id) {
    const experiment = typeof id === "string" ? experiments.get(id) : null;
    if (!experiment) throw new Error("Experience adaptation experiment does not exist.");
    if (refreshStatus(experiment)) persistNow();
    return experiment;
  }

  function openExperimentForTaskType(taskType) {
    const experiment = [...experiments.values()]
      .filter((candidate) => candidate.taskType === taskType && OPEN_STATUSES.has(candidate.status))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0] ?? null;
    if (experiment && refreshStatus(experiment)) persistNow();
    return experiment && OPEN_STATUSES.has(experiment.status) ? experiment : null;
  }

  function arm({ confirm = false, taskType, trialLimit, durationMinutes } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation is required to arm an experience adaptation experiment.");
    const selectedTaskType = normaliseTaskType(taskType);
    const selectedTrialLimit = boundedEvenInteger(trialLimit, MIN_TRIALS, MAX_TRIALS, "trialLimit");
    const selectedDuration = boundedInteger(
      durationMinutes,
      MIN_DURATION_MINUTES,
      MAX_DURATION_MINUTES,
      "durationMinutes",
    );
    if (openExperimentForTaskType(selectedTaskType)) {
      throw new Error("An open experience adaptation experiment already exists for this taskType.");
    }
    let refreshed = false;
    for (const candidate of experiments.values()) {
      refreshed = refreshStatus(candidate) || refreshed;
    }
    if (refreshed) persistNow();
    while (experiments.size >= MAX_EXPERIMENTS) {
      const activeProfileExperimentIds = new Set(
        [...profiles.values()].map((profile) => profile.sourceExperimentId),
      );
      const removableId = [...experiments.entries()]
        .find(([, candidate]) => (
          !OPEN_STATUSES.has(candidate.status)
          && !activeProfileExperimentIds.has(candidate.id)
        ))?.[0];
      if (!removableId) {
        throw new Error(
          "Experience adaptation storage is full; finish, cancel, or revoke retained experiment evidence before arming another experiment.",
        );
      }
      experiments.delete(removableId);
    }
    const createdAt = now();
    const experiment = {
      registry: NATIVE_ENGINEERING_EXPERIENCE_EXPERIMENT_REGISTRY,
      id: `experience-experiment-${createId()}`,
      status: "armed",
      taskType: selectedTaskType,
      trialLimit: selectedTrialLimit,
      createdAt,
      deadlineAt: new Date(Date.parse(createdAt) + selectedDuration * 60_000).toISOString(),
      model: null,
      assignments: [],
      activatedProfileId: null,
    };
    experiments.set(experiment.id, experiment);
    persistNow();
    return publicExperiment(experiment);
  }

  function chooseRankingMode(experiment) {
    const index = experiment.assignments.length;
    if (index % 2 === 1) {
      return experiment.assignments[index - 1].rankingMode === BASELINE_MODE
        ? ADAPTIVE_MODE
        : BASELINE_MODE;
    }
    return nextRandomArm() === 0 ? BASELINE_MODE : ADAPTIVE_MODE;
  }

  function selectProviderExperience({
    taskType,
    goal,
    limit = 4,
    sourceTaskId,
    executionTaskId,
    responseContract,
    model = null,
    buildReadModel,
  } = {}) {
    if (typeof buildReadModel !== "function") {
      throw new Error("Experience adaptation requires the existing memory read owner.");
    }
    const selectedTaskType = normaliseTaskType(taskType);
    const baseline = buildReadModel({ taskType: selectedTaskType, goal, limit, rankingMode: BASELINE_MODE });
    if (responseContract !== ENGINEERING_RECOMMENDATION_CONTRACT
      || !SAFE_ID.test(sourceTaskId ?? "")
      || !SAFE_ID.test(executionTaskId ?? "")) {
      return baseline;
    }

    const experiment = openExperimentForTaskType(selectedTaskType);
    const profile = profiles.get(selectedTaskType) ?? null;
    if (!experiment && !profile) return baseline;
    const weighted = buildReadModel({ taskType: selectedTaskType, goal, limit, rankingMode: ADAPTIVE_MODE });
    const baselineIds = recordIds(baseline);
    const weightedIds = recordIds(weighted);
    let assignment = experiment?.assignments.find((item) => item.providerTaskId === executionTaskId) ?? null;

    if (experiment?.status === "armed" && !assignment && experiment.assignments.length < experiment.trialLimit) {
      const selectedModel = typeof model === "string" && model.trim() ? model.trim().slice(0, 120) : "default";
      const modelMatches = experiment.model == null || experiment.model === selectedModel;
      if (modelMatches && baselineIds.length > 1 && !sameOrder(baselineIds, weightedIds)) {
        experiment.model ??= selectedModel;
        const rankingMode = chooseRankingMode(experiment);
        const selectedIds = rankingMode === ADAPTIVE_MODE ? weightedIds : baselineIds;
        const binding = {
          experimentId: experiment.id,
          index: experiment.assignments.length + 1,
          providerTaskId: executionTaskId,
          sourceTaskId,
          rankingMode,
          baselineRecordSetHash: sha256(JSON.stringify(baselineIds)),
          feedbackRecordSetHash: sha256(JSON.stringify(weightedIds)),
          selectedRecordSetHash: sha256(JSON.stringify(selectedIds)),
        };
        assignment = {
          ...binding,
          assignedAt: now(),
          assignmentHash: sha256(JSON.stringify(binding)),
          terminalOutcome: null,
          downstreamTaskId: null,
          outcomeReceiptHash: null,
          feedbackRating: null,
          feedbackReceiptHash: null,
          observedAt: null,
        };
        experiment.assignments.push(assignment);
        refreshStatus(experiment);
        persistNow();
      }
    }

    const rankingMode = assignment?.rankingMode ?? profile?.rankingMode ?? BASELINE_MODE;
    const selected = rankingMode === ADAPTIVE_MODE ? weighted : baseline;
    const evidence = {
      registry: NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_REGISTRY,
      rankingMode,
      experimentId: assignment?.experimentId ?? null,
      assignmentIndex: assignment?.index ?? null,
      assignmentHash: assignment?.assignmentHash ?? null,
      randomizedAssignment: Boolean(assignment),
      callerSelectedArm: false,
      activeProfileId: profile?.id ?? null,
      profileEvidenceHash: profile?.evidenceHash ?? null,
      changesExecutionPolicy: false,
      changesAuthority: false,
    };
    Object.defineProperty(selected, NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE, {
      value: evidence,
      enumerable: false,
    });
    return selected;
  }

  function recordTerminalOutcome({ task, providerTask } = {}) {
    const outcome = validateNativeEngineeringRecommendationOutcomeReceipt(
      task?.engineeringRecommendationOutcomeReceipt,
    );
    if (!outcome || outcome.downstreamTaskId !== task?.id || outcome.terminalOutcome !== task?.status) return null;
    const assignmentEntry = [...experiments.values()]
      .flatMap((experiment) => experiment.assignments.map((assignment) => ({ experiment, assignment })))
      .find(({ assignment }) => assignment.providerTaskId === outcome.providerTaskId);
    if (!assignmentEntry) return null;
    const { experiment, assignment } = assignmentEntry;
    const contextPacket = providerTask?.cloudConsciousnessLiveProviderEgressExecution?.contextPacket;
    if (providerTask?.id !== outcome.providerTaskId
      || providerTask.status !== "completed"
      || contextPacket?.experienceAdaptationAssignmentHash !== assignment.assignmentHash
      || contextPacket?.experienceMemoryRankingMode !== assignment.rankingMode) {
      return null;
    }
    if (assignment.outcomeReceiptHash) {
      return assignment.outcomeReceiptHash === outcome.receiptHash ? publicExperiment(experiment) : null;
    }
    assignment.terminalOutcome = outcome.terminalOutcome;
    assignment.downstreamTaskId = task.id;
    assignment.outcomeReceiptHash = outcome.receiptHash;
    assignment.observedAt = outcome.observedAt;
    refreshStatus(experiment);
    persistNow();
    return publicExperiment(experiment);
  }

  function recordOperatorFeedback({ task, receipt } = {}) {
    const feedback = validateNativeEngineeringRecommendationFeedbackReceipt(receipt);
    const outcome = validateNativeEngineeringRecommendationOutcomeReceipt(
      task?.engineeringRecommendationOutcomeReceipt,
    );
    if (!feedback || !outcome || feedback.taskId !== task?.id || feedback.terminalOutcome !== task.status) return null;
    const assignmentEntry = [...experiments.values()]
      .flatMap((experiment) => experiment.assignments.map((assignment) => ({ experiment, assignment })))
      .find(({ assignment }) => assignment.providerTaskId === outcome.providerTaskId);
    if (!assignmentEntry || assignmentEntry.assignment.outcomeReceiptHash !== outcome.receiptHash) return null;
    const { experiment, assignment } = assignmentEntry;
    if (assignment.feedbackReceiptHash && assignment.feedbackReceiptHash !== feedback.receiptHash) return null;
    assignment.feedbackRating = feedback.rating;
    assignment.feedbackReceiptHash = feedback.receiptHash;
    persistState();
    return publicExperiment(experiment);
  }

  function rearm(id, { confirm = false } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation is required to re-arm an experience adaptation experiment.");
    const experiment = findExperiment(id);
    if (experiment.status !== "paused_after_restart") {
      throw new Error("Only a restart-paused experience adaptation experiment can be re-armed.");
    }
    experiment.status = experiment.assignments.length >= experiment.trialLimit ? "collecting" : "armed";
    experiment.pausedAt = null;
    experiment.rearmedAt = now();
    persistNow();
    return publicExperiment(experiment);
  }

  function cancel(id, { confirm = false } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation is required to cancel an experience adaptation experiment.");
    const experiment = findExperiment(id);
    if (!OPEN_STATUSES.has(experiment.status)) {
      throw new Error("Only an open experience adaptation experiment can be cancelled.");
    }
    experiment.status = "cancelled";
    experiment.cancelledAt = now();
    persistNow();
    return publicExperiment(experiment);
  }

  function activateProfile({ confirm = false, experimentId, evidenceHash } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation is required to activate an experience ranking profile.");
    const experiment = findExperiment(experimentId);
    const analysis = analyseExperiment(experiment);
    if (experiment.status !== "completed"
      || analysis.evidenceHash !== evidenceHash
      || analysis.evidenceSupportsRankingChange !== true
      || ![BASELINE_MODE, ADAPTIVE_MODE].includes(analysis.candidateRankingMode)) {
      throw new Error("Experience ranking activation requires exact completed experiment evidence supporting a change.");
    }
    const existing = profiles.get(experiment.taskType) ?? null;
    if (existing
      && existing.id === experiment.activatedProfileId
      && existing.sourceExperimentId === experiment.id
      && existing.evidenceHash === analysis.evidenceHash
      && existing.rankingMode === analysis.candidateRankingMode) {
      return publicProfile(existing);
    }
    const profile = {
      registry: NATIVE_ENGINEERING_EXPERIENCE_PROFILE_REGISTRY,
      id: `experience-profile-${createId()}`,
      taskType: experiment.taskType,
      rankingMode: analysis.candidateRankingMode,
      sourceExperimentId: experiment.id,
      evidenceHash: analysis.evidenceHash,
      activatedAt: now(),
      governance: {
        explicitOperatorActivation: true,
        recallOrderingOnly: true,
        changesExecutionPolicy: false,
        changesAuthority: false,
        createsTask: false,
        createsApproval: false,
        executesAction: false,
        callsProvider: false,
      },
    };
    profiles.set(profile.taskType, profile);
    experiment.activatedProfileId = profile.id;
    persistNow();
    return publicProfile(profile);
  }

  function revokeProfile(taskType, { confirm = false } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation is required to revoke an experience ranking profile.");
    const selectedTaskType = normaliseTaskType(taskType);
    const profile = profiles.get(selectedTaskType);
    if (!profile) throw new Error("Experience ranking profile does not exist.");
    profiles.delete(selectedTaskType);
    persistNow();
    return { ...publicProfile(profile), revokedAt: now(), status: "revoked" };
  }

  function reconcileOnStartup() {
    let changed = false;
    for (const experiment of experiments.values()) {
      if (experiment.status === "armed" || experiment.status === "collecting") {
        experiment.status = "paused_after_restart";
        experiment.pausedAt = now();
        changed = true;
      }
    }
    if (changed) persistNow();
    return changed;
  }

  function readModel({ taskType = null } = {}) {
    const selectedTaskType = taskType == null || taskType === "" ? null : normaliseTaskType(taskType);
    let changed = false;
    for (const experiment of experiments.values()) changed = refreshStatus(experiment) || changed;
    if (changed) persistNow();
    const selectedExperiments = [...experiments.values()]
      .filter((experiment) => !selectedTaskType || experiment.taskType === selectedTaskType)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .map(publicExperiment);
    const selectedProfiles = [...profiles.values()]
      .filter((profile) => !selectedTaskType || profile.taskType === selectedTaskType)
      .sort((left, right) => String(left.taskType).localeCompare(String(right.taskType)))
      .map(publicProfile);
    return {
      ok: true,
      registry: NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_REGISTRY,
      experiments: selectedExperiments,
      profiles: selectedProfiles,
      summary: {
        experimentCount: selectedExperiments.length,
        openExperiments: selectedExperiments.filter((experiment) => OPEN_STATUSES.has(experiment.status)).length,
        completedExperiments: selectedExperiments.filter((experiment) => experiment.status === "completed").length,
        activeProfiles: selectedProfiles.length,
      },
      bounds: {
        minimumTrials: MIN_TRIALS,
        maximumTrials: MAX_TRIALS,
        minimumDurationMinutes: MIN_DURATION_MINUTES,
        maximumDurationMinutes: MAX_DURATION_MINUTES,
        maximumStoredExperiments: MAX_EXPERIMENTS,
      },
      governance: {
        finiteExperiments: true,
        pairedRandomAssignment: true,
        callerSelectsArm: false,
        exactEvidenceActivation: true,
        operatorActivationRequired: true,
        recallOrderingOnly: true,
        changesExecutionPolicy: false,
        changesAuthority: false,
        automaticTaskCreation: false,
        automaticProviderCall: false,
        automaticExecution: false,
        generalCausalAttribution: false,
      },
    };
  }

  return {
    arm,
    selectProviderExperience,
    recordTerminalOutcome,
    recordOperatorFeedback,
    rearm,
    cancel,
    activateProfile,
    revokeProfile,
    reconcileOnStartup,
    readModel,
  };
}
