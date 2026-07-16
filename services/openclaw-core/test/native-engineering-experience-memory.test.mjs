import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeEngineeringExperienceMemory,
  NATIVE_ENGINEERING_EXPERIENCE_MEMORY_REGISTRY,
} from "../src/native-engineering-experience-memory.mjs";

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
});
