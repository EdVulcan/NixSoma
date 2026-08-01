import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeEngineeringExperienceMemory,
  NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY,
  NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY,
} from "../src/native-engineering-experience-memory.mjs";
import { createSystemdIncidentRepairTask } from "./systemd-incident-fixture.mjs";
import {
  buildExperienceConsumptionCandidate,
  finaliseExperienceConsumptionReceipt,
} from "../src/native-engineering-experience-consumption-receipt.mjs";
import { buildNativeEngineeringRecommendationOutcomeReceipt } from "../src/native-engineering-recommendation-outcome-receipt.mjs";
import {
  recommendationApplicationReceipt,
  recommendationExecutionReceipt,
} from "./native-engineering-recommendation-receipt-fixture.mjs";

function recommendationOutcomeReceipt({ withExecution = false } = {}) {
  const applicationReceipt = recommendationApplicationReceipt();
  return buildNativeEngineeringRecommendationOutcomeReceipt({
    applicationReceipt,
    executionReceipt: withExecution ? recommendationExecutionReceipt() : null,
    downstreamTaskId: "semantic-task-7",
    terminalOutcome: "completed",
    terminalPhase: "completed",
  });
}

test("experience memory records bounded terminal lessons without task details or sensitive goal values", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({
    records,
    now: () => "2026-07-16T00:00:00.000Z",
  });
  const task = {
    id: "experience-task-1",
    type: "system_task",
    goal: "verify context with api key sk-private-value-1234567890 password private-value https://example.invalid/private",
    status: "failed",
    executionPhase: "verifying_result",
    outcome: {
      kind: "failed",
      summary: "password=private-value",
      details: { command: "curl https://example.invalid/private", stdout: "private-value" },
    },
  };

  const record = memory.recordTaskExperience(task);

  assert.equal(record.schema, "openclaw.native_engineering_experience.v0");
  assert.equal(record.outcome, "failed");
  assert.equal(record.taskType, "system_task");
  assert.equal(record.executionPhase, "verifying_result");
  assert.equal(record.governance.advisoryOnly, true);
  assert.equal(JSON.stringify(record).includes("private-value"), false);
  assert.equal(JSON.stringify(record).includes("example.invalid"), false);
  assert.equal(JSON.stringify(record).includes("curl"), false);
  assert.equal(records.size, 1);
  assert.deepEqual(record.feedback.observations, []);
});

test("experience memory durably correlates bounded subsequent outcomes without claiming advisory use", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({
    records,
    now: (() => {
      let index = 0;
      return () => `2026-07-31T10:00:0${index++}.000Z`;
    })(),
  });
  const first = {
    id: "feedback-system-1",
    type: "system_task",
    goal: "verify bounded context",
    status: "completed",
    executionPhase: "completed",
  };
  const second = {
    id: "feedback-system-2",
    type: "system_task",
    goal: "verify another bounded context",
    status: "completed",
    executionPhase: "completed",
  };
  const third = {
    id: "feedback-system-3",
    type: "system_task",
    goal: "verify final bounded context",
    status: "failed",
    executionPhase: "verifying_result",
  };

  memory.recordTaskExperience(first);
  memory.recordTaskExperience(second);
  memory.recordTaskExperience(third);
  memory.recordTaskExperience(third);
  memory.recordTaskExperience({
    id: "feedback-browser-1",
    type: "browser_task",
    goal: "inspect the work view",
    status: "failed",
    executionPhase: "verifying_result",
  });

  const firstRecord = records.get(first.id);
  assert.equal(firstRecord.feedback.registry, NATIVE_ENGINEERING_EXPERIENCE_FEEDBACK_REGISTRY);
  assert.equal(firstRecord.feedback.observations.length, 2);
  assert.deepEqual(firstRecord.feedback.observations.map(({ outcome }) => outcome), ["completed", "failed"]);
  assert.equal(firstRecord.feedback.observations.every(({ key }) => /^[a-f0-9]{64}$/u.test(key)), true);
  assert.equal(JSON.stringify(firstRecord.feedback).includes(second.id), false);
  assert.equal(records.get(second.id).feedback.observations.length, 1);
  assert.equal(records.get(third.id).feedback.observations.length, 0);

  const recalled = memory.buildExperienceMemoryReadModel({
    taskType: "system_task",
    goal: "verify bounded context",
  });
  assert.equal(recalled.summary.feedbackObservedRecords, 2);
  assert.equal(recalled.summary.feedbackObservedOutcomes, 2);
  assert.equal(recalled.summary.feedbackCompleted, 1);
  assert.equal(recalled.summary.feedbackFailed, 1);
  assert.equal(recalled.summary.feedbackCompletionRate, 0.5);
  assert.equal(recalled.summary.feedbackLatestOutcome, "failed");
  assert.equal(recalled.summary.feedbackCorrelation, "same_task_type_subsequent_terminal_outcome");
  assert.equal(recalled.summary.feedbackCausalAttribution, false);
  assert.equal(recalled.summary.feedbackAdvisoryUseProven, false);
  assert.equal(recalled.records[0].feedback.causalAttribution, false);
  assert.equal(recalled.governance.feedbackChangesExecutionPolicy, false);
  assert.equal(recalled.auditEvidence.summary.feedbackObservedOutcomes, 2);
});

test("experience effectiveness is an explicit read-only observation, never an automatic policy", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({ records });
  for (const [id, status] of [["effectiveness-1", "completed"], ["effectiveness-2", "failed"]]) {
    memory.recordTaskExperience({
      id,
      type: "system_task",
      goal: "observe bounded effectiveness",
      status,
      executionPhase: status === "completed" ? "completed" : "verifying_result",
    });
  }

  const effectiveness = memory.buildExperienceEffectivenessReadModel({ taskType: "system_task" });
  assert.equal(effectiveness.registry, "openclaw-native-engineering-experience-effectiveness-v0");
  assert.deepEqual(effectiveness.groups[0], {
    taskType: "system_task",
    terminalRecords: 2,
    completed: 1,
    failed: 1,
    completionRate: 0.5,
    feedbackObservedOutcomes: 1,
    feedbackCompletionRate: 0,
    advisoryAppliedRecords: 0,
    status: "observed",
    causalAttribution: false,
    policyInfluence: false,
  });
  assert.equal(effectiveness.governance.readOnly, true);
  assert.equal(effectiveness.governance.changesExecutionPolicy, false);
  assert.equal(effectiveness.summary.automaticRanking, false);
});

test("experience memory preserves only a validated task-bound consumption receipt", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({ records });
  const receipt = finaliseExperienceConsumptionReceipt({
    candidate: buildExperienceConsumptionCandidate({
      experienceMemory: { records: [{ id: "experience-source-1" }] },
      executionTaskId: "provider-task-1",
      sourceTaskId: "source-task-1",
      contextContentHash: "a".repeat(64),
      responseContract: "engineering_recommendation_v0",
    }),
    providerResult: {
      ok: true,
      audit: {
        requestContentHash: "b".repeat(64),
        providerResponseCreated: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
      },
    },
  });
  const record = memory.recordTaskExperience({
    id: "provider-task-1",
    type: "cloud_provider_task",
    goal: "Review bounded engineering context.",
    status: "completed",
    executionPhase: "completed",
    cloudConsciousnessLiveProviderEgressExecution: {
      contextPacket: { experienceMemoryConsumptionReceipt: receipt },
    },
  });
  assert.equal(record.consumptionReceipt.receiptHash, receipt.receiptHash);
  assert.equal(record.consumptionReceipt.governance.providerConsumptionProven, true);
  assert.equal(memory.buildExperienceMemoryReadModel({
    taskType: "cloud_provider_task",
    goal: "Review bounded context.",
  }).records[0].consumptionReceipt.receiptHash, receipt.receiptHash);

  const changedReceipt = { ...receipt, sourceTaskId: "changed-source" };
  const changed = memory.recordTaskExperience({
    id: "provider-task-invalid",
    type: "cloud_provider_task",
    status: "completed",
    cloudConsciousnessLiveProviderEgressExecution: {
      contextPacket: { experienceMemoryConsumptionReceipt: changedReceipt },
    },
  });
  assert.equal(changed.consumptionReceipt, null);
});

test("experience memory preserves only a validated recommendation outcome receipt", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({ records });
  const receipt = recommendationOutcomeReceipt();
  const record = memory.recordTaskExperience({
    id: "semantic-task-7",
    type: "browser_task",
    goal: "Execute the reviewed semantic click task.",
    status: "completed",
    executionPhase: "completed",
    engineeringRecommendationOutcomeReceipt: receipt,
  });
  assert.equal(record.recommendationOutcomeReceipt.receiptHash, receipt.receiptHash);
  assert.equal(record.recommendationOutcomeReceipt.governance.causalAttribution, false);
  assert.equal(memory.buildExperienceMemoryReadModel({
    taskType: "browser_task",
    goal: "Execute reviewed semantic click task.",
  }).records[0].recommendationOutcomeReceipt.receiptHash, receipt.receiptHash);

  const changed = memory.recordTaskExperience({
    id: "semantic-task-invalid",
    type: "browser_task",
    status: "completed",
    engineeringRecommendationOutcomeReceipt: { ...receipt, downstreamTaskId: "changed-task" },
  });
  assert.equal(changed.recommendationOutcomeReceipt, null);
});

test("experience memory preserves the execution-bound recommendation outcome v1", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({ records });
  const receipt = recommendationOutcomeReceipt({ withExecution: true });
  const record = memory.recordTaskExperience({
    id: "semantic-task-7",
    type: "browser_task",
    status: "completed",
    executionPhase: "completed",
    engineeringRecommendationOutcomeReceipt: receipt,
  });

  assert.equal(record.recommendationOutcomeReceipt.registry,
    "openclaw-native-engineering-recommendation-outcome-receipt-v1");
  assert.equal(record.recommendationOutcomeReceipt.executionReceiptHash,
    receipt.executionReceiptHash);
  assert.equal(record.recommendationOutcomeReceipt.governance.downstreamActionExecutionProven, true);
  assert.equal(record.recommendationOutcomeReceipt.governance.recommendationEffectivenessProven, false);

  const changed = memory.recordTaskExperience({
    id: "semantic-task-invalid",
    type: "browser_task",
    status: "completed",
    engineeringRecommendationOutcomeReceipt: {
      ...receipt,
      executionReceiptHash: "f".repeat(64),
    },
  });
  assert.equal(changed.recommendationOutcomeReceipt, null);
});

test("experience memory recalls the most applicable bounded lessons", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({
    records,
    now: () => "2026-07-16T00:00:00.000Z",
  });
  memory.recordTaskExperience({
    id: "experience-system-1",
    type: "system_task",
    goal: "verify bounded context",
    status: "completed",
    executionPhase: "completed",
  });
  memory.recordTaskExperience({
    id: "experience-browser-1",
    type: "browser_task",
    goal: "open the work view",
    status: "failed",
    executionPhase: "acting_on_target",
  });

  const recalled = memory.buildExperienceMemoryReadModel({
    taskType: "system_task",
    goal: "verify context",
    limit: 4,
  });

  assert.equal(recalled.registry, NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY);
  assert.equal(recalled.summary.storedRecords, 2);
  assert.equal(recalled.summary.recalledRecords, 1);
  assert.equal(recalled.summary.matchedRecords, 1);
  assert.equal(recalled.summary.completedMatches, 1);
  assert.equal(recalled.summary.failedMatches, 0);
  assert.equal(recalled.summary.completionRate, 1);
  assert.equal(recalled.summary.latestOutcome, "completed");
  assert.equal(recalled.summary.pattern, "repeatable_success");
  assert.match(recalled.summary.nextAction, /verification evidence/);
  assert.equal(recalled.summary.status, "recalled");
  assert.equal(recalled.summary.advisoryOnly, true);
  assert.equal(recalled.records[0].taskType, "system_task");
  assert.equal(recalled.records[0].relevance >= 100, true);
  assert.equal(recalled.governance.createsTask, false);
  assert.equal(recalled.governance.callsProvider, false);
  assert.equal(recalled.auditEvidence.outputContentRecorded, false);

  const unrelated = memory.buildExperienceMemoryReadModel({
    taskType: "native_plugin_task",
    goal: "refresh plugin runtime",
  });
  assert.equal(unrelated.summary.recalledRecords, 0);
  assert.equal(unrelated.summary.matchedRecords, 0);
  assert.equal(unrelated.summary.pattern, "no_match");
  assert.equal(unrelated.summary.status, "no_match");
});

test("experience memory records and recalls a bounded fixed-target incident pattern", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({
    records,
    now: () => "2026-07-18T11:00:00.000Z",
  });
  const task = createSystemdIncidentRepairTask();

  const record = memory.recordTaskExperience(task);
  const recalled = memory.buildExperienceMemoryReadModel({
    taskType: "systemd_next_repair_task",
    goal: "Restore the fixed event-hub service and verify application health.",
    incidentTargetUnit: "openclaw-event-hub.service",
  });

  assert.equal(record.incidentPattern.registry, "openclaw-systemd-incident-experience-v0");
  assert.equal(record.incidentPattern.targetUnit, "openclaw-event-hub.service");
  assert.equal(record.incidentPattern.restoredHealthy, false);
  assert.equal(record.incidentPattern.journalEntries, 3);
  assert.equal(record.incidentPattern.journalMessagesIncluded, false);
  assert.equal(record.incidentPattern.providerOutputIncluded, false);
  assert.equal(recalled.summary.incidentMatchedRecords, 1);
  assert.equal(recalled.summary.incidentRestoredMatches, 0);
  assert.equal(recalled.summary.incidentRecoveryRequiredMatches, 1);
  assert.equal(recalled.summary.incidentLatestRestoredHealthy, false);
  assert.equal(recalled.summary.incidentPattern, "repeated_recovery_required");
  assert.match(recalled.summary.incidentNextAction, /recovery evidence/u);
  assert.equal(recalled.records[0].relevance > 1_000, true);
  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /private-health|private diagnostic|hostd-private-invocation/u);
  assert.doesNotMatch(serialized, /journal message|job\/72|kernel_so_peercred/u);

  const otherTarget = memory.buildExperienceMemoryReadModel({
    taskType: "systemd_next_repair_task",
    goal: "Restore a fixed service.",
    incidentTargetUnit: "openclaw-system-sense.service",
  });
  assert.equal(otherTarget.summary.incidentMatchedRecords, 0);
  assert.equal(otherTarget.summary.incidentPattern, "none");
  assert.equal(otherTarget.records.length, 0);

  const phaseOnlyRecords = new Map();
  const phaseOnlyMemory = createNativeEngineeringExperienceMemory({ records: phaseOnlyRecords });
  const phaseOnlyTask = createSystemdIncidentRepairTask({ id: "phase-only-systemd-incident" });
  const incidentReceipt = phaseOnlyTask.outcome.details.incidentReceipt;
  delete phaseOnlyTask.outcome;
  phaseOnlyTask.phaseHistory = [{
    phase: "systemd_next_repair_execution_failed",
    details: { incidentReceipt },
  }];
  const phaseOnlyRecord = phaseOnlyMemory.recordTaskExperience(phaseOnlyTask);
  assert.equal(phaseOnlyRecord.incidentPattern.targetUnit, "openclaw-event-hub.service");
  assert.equal(phaseOnlyRecord.incidentPattern.restoredHealthy, false);
});

test("experience memory derives a bounded recovery pattern from mixed terminal outcomes", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({
    records,
    now: (() => {
      let index = 0;
      return () => `2026-07-16T00:00:0${index++}.000Z`;
    })(),
  });
  memory.recordTaskExperience({
    id: "experience-mixed-completed",
    type: "system_task",
    goal: "verify bounded context",
    status: "completed",
    executionPhase: "completed",
  });
  memory.recordTaskExperience({
    id: "experience-mixed-failed",
    type: "system_task",
    goal: "verify bounded context",
    status: "failed",
    executionPhase: "verifying_result",
  });

  const recalled = memory.buildExperienceMemoryReadModel({
    taskType: "system_task",
    goal: "verify bounded context",
    limit: 1,
  });

  assert.equal(recalled.summary.recalledRecords, 1);
  assert.equal(recalled.summary.matchedRecords, 2);
  assert.equal(recalled.summary.terminalRecords, 2);
  assert.equal(recalled.summary.completedMatches, 1);
  assert.equal(recalled.summary.failedMatches, 1);
  assert.equal(recalled.summary.completionRate, 0.5);
  assert.equal(recalled.summary.latestOutcome, "failed");
  assert.equal(recalled.summary.pattern, "mixed_outcomes");
  assert.match(recalled.summary.nextAction, /Compare prior/);
  assert.equal(recalled.auditEvidence.summary.pattern, "mixed_outcomes");
  assert.equal(recalled.auditEvidence.summary.completionRate, 0.5);
});

test("experience memory keeps a bounded record window", () => {
  const records = new Map();
  const memory = createNativeEngineeringExperienceMemory({ records });
  for (let index = 0; index < 205; index += 1) {
    memory.recordTaskExperience({
      id: `experience-window-${index}`,
      type: "system_task",
      goal: `verify item ${index}`,
      status: "completed",
      executionPhase: "completed",
    });
  }

  assert.equal(records.size, 200);
  assert.equal(records.has("experience-window-0"), false);
  assert.equal(records.has("experience-window-204"), true);
  assert.equal(records.get("experience-window-5").feedback.observations.length, 32);
});
