import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createRuntimeState } from "../src/runtime-state.mjs";

test("core state persists compact renewable mission checkpoints", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-core-renewable-mission-state-"));
  const stateFilePath = path.join(root, "state.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const runtime = createRuntimeState({ stateFilePath, getTaskById: () => null });
  runtime.renewableOperatorMissions.set("mission-1", {
    id: "mission-1",
    status: "paused",
    epochsAuthorized: 8,
    epochsConsumed: 3,
    epochsCompleted: 2,
    remainingEpochs: 5,
    maxStepsPerEpoch: 4,
    epochIntervalMs: 60_000,
    maxNoProgressEpochs: 2,
    noProgressStreak: 0,
    deadlineAt: "2026-08-02T14:00:00.000Z",
    nextEpochAt: "2026-08-01T14:05:00.000Z",
    childLeaseId: null,
    lastLeaseId: "lease-3",
    renewalCount: 1,
    stopReason: "operator_paused",
    lastCheckpoint: {
      epoch: 3,
      status: "completed",
      stepCount: 2,
      runSessionId: "run-3",
      leaseId: "lease-3",
      at: "2026-08-01T14:03:00.000Z",
    },
  });
  runtime.persistState.flush();

  const persisted = JSON.parse(readFileSync(stateFilePath, "utf8"));
  assert.equal(persisted.renewableOperatorMissions.length, 1);
  assert.equal(persisted.renewableOperatorMissions[0].epochsConsumed, 3);
  assert.equal(persisted.renewableOperatorMissions[0].lastCheckpoint.runSessionId, "run-3");

  const restored = createRuntimeState({ stateFilePath, getTaskById: () => null });
  restored.loadPersistentState();
  assert.equal(restored.renewableOperatorMissions.size, 1);
  assert.equal(restored.renewableOperatorMissions.get("mission-1").status, "paused");
  assert.equal(restored.renewableOperatorMissions.get("mission-1").remainingEpochs, 5);
});
