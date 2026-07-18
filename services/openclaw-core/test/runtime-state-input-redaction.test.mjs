import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createRuntimeState } from "../src/runtime-state.mjs";

function task(text, status = "queued") {
  return {
    id: "task-write-only-input",
    type: "browser_task",
    goal: "type once",
    status,
    plan: {
      steps: [{ kind: "keyboard.type", phase: "acting_on_target", params: { text } }],
    },
    createdAt: "2026-07-11T03:00:00.000Z",
    updatedAt: "2026-07-11T03:00:00.000Z",
  };
}

test("core state persists input evidence and requires re-entry after restart", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-core-input-state-"));
  const stateFilePath = path.join(root, "state.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const runtime = createRuntimeState({ stateFilePath, getTaskById: () => null });
  runtime.tasks.set("task-write-only-input", task("private-transient-input"));
  runtime.persistState();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const persistedText = readFileSync(stateFilePath, "utf8");
  const persisted = JSON.parse(persistedText);
  assert.equal(persistedText.includes("private-transient-input"), false);
  assert.equal(persisted.tasks[0].plan.steps[0].params.inputEvidence.charCount, 23);
  assert.equal("text" in persisted.tasks[0].plan.steps[0].params, false);

  writeFileSync(stateFilePath, `${JSON.stringify(persisted)}\n`, "utf8");
  const restored = createRuntimeState({ stateFilePath, getTaskById: () => null });
  restored.loadPersistentState();
  const restoredTask = restored.tasks.get("task-write-only-input");
  assert.equal(restoredTask.status, "failed");
  assert.equal(restoredTask.executionPhase, "input_reentry_required");
  assert.equal(restoredTask.outcome.details.inputTextPersisted, false);
  assert.equal(restoredTask.outcome.details.automaticReplay, false);
});

test("core state persists and restores bounded experience memory records", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-core-experience-state-"));
  const stateFilePath = path.join(root, "state.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const runtime = createRuntimeState({ stateFilePath, getTaskById: () => null });
  runtime.experienceMemoryRecords.set("experience-task-1", {
    id: "experience-record-1",
    schema: "openclaw.native_engineering_experience.v0",
    recordedAt: "2026-07-16T00:00:00.000Z",
    taskType: "system_task",
    lesson: "A bounded advisory lesson.",
    outcome: "completed",
    executionPhase: "completed",
    applicabilityTokens: ["type:system_task", "verify"],
    confidence: 0.72,
    source: {
      registry: "openclaw-task-lifecycle-terminal-v0",
      taskId: "experience-task-1",
      outcomeHash: "a".repeat(64),
    },
  });
  runtime.persistState();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const persisted = JSON.parse(readFileSync(stateFilePath, "utf8"));
  assert.equal(persisted.experienceMemoryRecords.length, 1);
  assert.equal(persisted.experienceMemoryRecords[0].lesson, "A bounded advisory lesson.");

  const restored = createRuntimeState({ stateFilePath, getTaskById: () => null });
  restored.loadPersistentState();
  assert.equal(restored.experienceMemoryRecords.size, 1);
  assert.equal(restored.experienceMemoryRecords.get("experience-task-1").taskType, "system_task");
});

test("core state persists and restores fixed-unit incident scheduler dedupe state", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-core-incident-scheduler-state-"));
  const stateFilePath = path.join(root, "state.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const runtime = createRuntimeState({ stateFilePath, getTaskById: () => null });
  Object.assign(runtime.fixedUnitIncidentSchedulerState, {
    registry: "openclaw-fixed-unit-incident-scheduler-v0",
    enabled: true,
    intervalMs: 300_000,
    lastTickAt: "2026-07-18T14:30:00.000Z",
    units: {
      "openclaw-system-heal.service": {
        status: "unhealthy",
        fingerprint: `sha256:${"a".repeat(64)}`,
        lastObservedAt: "2026-07-18T14:30:00.000Z",
        latestTaskId: "scheduled-task-1",
      },
    },
  });
  runtime.persistState.flush();

  const restored = createRuntimeState({ stateFilePath, getTaskById: () => null });
  restored.loadPersistentState();

  assert.equal(restored.fixedUnitIncidentSchedulerState.registry, "openclaw-fixed-unit-incident-scheduler-v0");
  assert.equal(
    restored.fixedUnitIncidentSchedulerState.units["openclaw-system-heal.service"].latestTaskId,
    "scheduled-task-1",
  );
});
