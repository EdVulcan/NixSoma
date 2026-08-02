import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeEngineeringExperienceAdaptation,
  NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE,
} from "../src/native-engineering-experience-adaptation.mjs";
import {
  buildNativeEngineeringRecommendationApplicationReceipt,
} from "../src/native-engineering-recommendation-application-receipt.mjs";
import {
  buildNativeEngineeringRecommendationFeedbackReceipt,
} from "../src/native-engineering-recommendation-feedback.mjs";
import {
  buildNativeEngineeringRecommendationOutcomeReceipt,
} from "../src/native-engineering-recommendation-outcome-receipt.mjs";

function memoryReadModel({ rankingMode = "baseline" } = {}) {
  const ids = rankingMode === "feedback_weighted"
    ? ["experience-helpful", "experience-neutral"]
    : ["experience-neutral", "experience-helpful"];
  return {
    ok: true,
    registry: "openclaw-native-engineering-experience-memory-v0",
    records: ids.map((id) => ({ id })),
    summary: { recalledRecords: ids.length },
    governance: { advisoryOnly: true },
  };
}

function applicationReceipt(providerTaskId, downstreamTaskId) {
  return buildNativeEngineeringRecommendationApplicationReceipt({
    recommendationLink: {
      registry: "openclaw-native-engineering-recommendation-link-v0",
      mode: "reviewed-provider-recommendation-to-semantic-click-task",
      generatedAt: "2026-08-02T15:00:00.000Z",
      source: {
        taskId: providerTaskId,
        taskType: "cloud_consciousness_live_provider_egress_execution_task",
        taskStatus: "completed",
        registry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
        contract: "engineering_recommendation_v0",
        responseContentHash: "a".repeat(64),
        evidence: "provider_execution_recommendation",
      },
      action: {
        actionId: "create_semantic_click_task",
        capabilityId: "plan.openclaw.browser.semantic_click_task",
        expectedObserverControlId: "create-semantic-click-task-button",
        requiresApproval: true,
      },
      governance: {
        operatorReviewRequired: true,
        targetSelectedFromCurrentWorkView: true,
        automaticTaskCreationAllowed: false,
        automaticApprovalAllowed: false,
        automaticExecutionAllowed: false,
        arbitraryEndpointAllowed: false,
        providerCallAllowed: false,
        credentialValueIncluded: false,
        pagePayloadIncluded: false,
      },
    },
    downstreamTaskId,
    downstreamTaskType: "browser_task",
  });
}

function terminalTask(providerTaskId, index, terminalOutcome) {
  const id = `downstream-${index}`;
  const outcome = buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt: applicationReceipt(providerTaskId, id),
    downstreamTaskId: id,
    terminalOutcome,
    terminalPhase: terminalOutcome,
  });
  return {
    id,
    status: terminalOutcome,
    engineeringRecommendationOutcomeReceipt: outcome,
  };
}

function harness(options = {}) {
  const experiments = new Map();
  const profiles = new Map();
  let persists = 0;
  const persistState = () => { persists += 1; };
  persistState.flush = () => { persists += 1; };
  const ids = ["experiment-id", "profile-id"];
  const owner = createNativeEngineeringExperienceAdaptation({
    experiments,
    profiles,
    persistState,
    now: () => "2026-08-02T15:00:00.000Z",
    createId: () => ids.shift(),
    nextRandomArm: () => options.randomArm ?? 0,
  });
  return { owner, experiments, profiles, persists: () => persists };
}

test("experience adaptation runs a finite balanced comparison and activates only exact supported evidence", () => {
  const { owner, persists } = harness();
  const armed = owner.arm({
    confirm: true,
    taskType: "browser_task",
    trialLimit: 8,
    durationMinutes: 60,
  });
  assert.equal(armed.status, "armed");
  assert.equal(armed.governance.callerSelectsArm, false);

  const selected = [];
  for (let index = 1; index <= 8; index += 1) {
    const providerTaskId = `provider-${index}`;
    const memory = owner.selectProviderExperience({
      taskType: "browser_task",
      goal: "Use bounded memory",
      sourceTaskId: `source-${index}`,
      executionTaskId: providerTaskId,
      responseContract: "engineering_recommendation_v0",
      model: "deepseek-chat",
      buildReadModel: memoryReadModel,
    });
    const evidence = memory[NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE];
    selected.push(evidence.rankingMode);
    const terminalOutcome = evidence.rankingMode === "feedback_weighted" ? "completed" : "failed";
    const task = terminalTask(providerTaskId, index, terminalOutcome);
    const providerTask = {
      id: providerTaskId,
      status: "completed",
      cloudConsciousnessLiveProviderEgressExecution: {
        contextPacket: {
          experienceAdaptationAssignmentHash: evidence.assignmentHash,
          experienceMemoryRankingMode: evidence.rankingMode,
        },
      },
    };
    owner.recordTerminalOutcome({ task, providerTask });
    if (index === 2) {
      const feedback = buildNativeEngineeringRecommendationFeedbackReceipt({
        taskId: task.id,
        recommendationOutcomeReceipt: task.engineeringRecommendationOutcomeReceipt,
        rating: "helpful",
      });
      owner.recordOperatorFeedback({ task, receipt: feedback });
    }
  }

  assert.deepEqual(selected, [
    "baseline", "feedback_weighted",
    "baseline", "feedback_weighted",
    "baseline", "feedback_weighted",
    "baseline", "feedback_weighted",
  ]);
  const state = owner.readModel({ taskType: "browser_task" });
  const experiment = state.experiments[0];
  assert.equal(experiment.status, "completed");
  assert.equal(experiment.analysis.baseline.completed, 0);
  assert.equal(experiment.analysis.feedbackWeighted.completed, 4);
  assert.equal(experiment.analysis.feedbackWeighted.helpful, 1);
  assert.equal(experiment.analysis.exactTestPValue, 0.028571);
  assert.equal(experiment.analysis.candidateRankingMode, "feedback_weighted");
  assert.equal(experiment.analysis.evidenceSupportsRankingChange, true);
  assert.equal(experiment.analysis.generalCausalAttribution, false);
  assert.throws(() => owner.activateProfile({
    confirm: true,
    experimentId: experiment.id,
    evidenceHash: "0".repeat(64),
  }), /exact completed experiment evidence/u);

  const profile = owner.activateProfile({
    confirm: true,
    experimentId: experiment.id,
    evidenceHash: experiment.analysis.evidenceHash,
  });
  assert.equal(profile.rankingMode, "feedback_weighted");
  assert.equal(profile.governance.recallOrderingOnly, true);
  assert.equal(owner.activateProfile({
    confirm: true,
    experimentId: experiment.id,
    evidenceHash: experiment.analysis.evidenceHash,
  }).id, profile.id);
  const profiledMemory = owner.selectProviderExperience({
    taskType: "browser_task",
    goal: "Use bounded memory",
    sourceTaskId: "source-after",
    executionTaskId: "provider-after",
    responseContract: "engineering_recommendation_v0",
    model: "deepseek-chat",
    buildReadModel: memoryReadModel,
  });
  assert.deepEqual(profiledMemory.records.map(({ id }) => id), [
    "experience-helpful",
    "experience-neutral",
  ]);
  assert.equal(
    profiledMemory[NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE].activeProfileId,
    profile.id,
  );
  assert.equal(persists() > 0, true);
});

test("experience adaptation rejects caller-shaped trials and pauses open work across restart", () => {
  const { owner } = harness({ randomArm: 1 });
  assert.throws(() => owner.arm({
    confirm: true,
    taskType: "browser_task",
    trialLimit: 7,
    durationMinutes: 60,
  }), /even integer from 8 to 32/u);
  assert.throws(() => owner.arm({
    confirm: false,
    taskType: "browser_task",
    trialLimit: 8,
    durationMinutes: 60,
  }), /Explicit confirmation/u);
  const experiment = owner.arm({
    confirm: true,
    taskType: "browser_task",
    trialLimit: 8,
    durationMinutes: 60,
  });
  owner.reconcileOnStartup();
  assert.equal(owner.readModel().experiments[0].status, "paused_after_restart");
  assert.throws(() => owner.rearm(experiment.id, { confirm: false }), /Explicit confirmation/u);
  assert.equal(owner.rearm(experiment.id, { confirm: true }).status, "armed");
  assert.equal(owner.cancel(experiment.id, { confirm: true }).status, "cancelled");
});

test("experience adaptation does not consume a trial when ranking orders are identical", () => {
  const { owner } = harness();
  owner.arm({
    confirm: true,
    taskType: "browser_task",
    trialLimit: 8,
    durationMinutes: 60,
  });
  const memory = owner.selectProviderExperience({
    taskType: "browser_task",
    goal: "No ranked variation",
    sourceTaskId: "source-same",
    executionTaskId: "provider-same",
    responseContract: "engineering_recommendation_v0",
    buildReadModel: () => ({ records: [{ id: "same-a" }, { id: "same-b" }] }),
  });
  assert.equal(memory[NATIVE_ENGINEERING_EXPERIENCE_ADAPTATION_EVIDENCE].assignmentHash, null);
  assert.equal(owner.readModel().experiments[0].assignments.length, 0);
});

test("experience adaptation never evicts open experiment evidence at the storage bound", () => {
  let id = 0;
  const owner = createNativeEngineeringExperienceAdaptation({
    experiments: new Map(),
    profiles: new Map(),
    createId: () => `bounded-${id += 1}`,
    now: () => "2026-08-02T15:00:00.000Z",
  });
  const experiments = Array.from({ length: 16 }, (_, index) => owner.arm({
    confirm: true,
    taskType: `browser_task_${index}`,
    trialLimit: 8,
    durationMinutes: 60,
  }));

  assert.throws(() => owner.arm({
    confirm: true,
    taskType: "browser_task_16",
    trialLimit: 8,
    durationMinutes: 60,
  }), /storage is full/u);
  assert.equal(owner.readModel().experiments.length, 16);
  assert.equal(owner.cancel(experiments[0].id, { confirm: true }).status, "cancelled");
  owner.arm({
    confirm: true,
    taskType: "browser_task_16",
    trialLimit: 8,
    durationMinutes: 60,
  });
  const retained = owner.readModel().experiments;
  assert.equal(retained.length, 16);
  assert.equal(retained.some((experiment) => experiment.id === experiments[0].id), false);
  assert.equal(retained.some((experiment) => experiment.taskType === "browser_task_16"), true);
});
