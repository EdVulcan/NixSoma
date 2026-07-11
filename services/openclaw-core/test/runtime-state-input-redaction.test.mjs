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
