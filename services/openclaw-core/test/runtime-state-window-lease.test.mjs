import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createRuntimeState } from "../src/runtime-state.mjs";

test("core state persists compact window lease records across restart", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-core-window-lease-state-"));
  const stateFilePath = path.join(root, "state.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const runtime = createRuntimeState({ stateFilePath, getTaskById: () => null });
  runtime.boundedOperatorWindowLeases.set("lease-1", {
    id: "lease-1",
    status: "paused",
    windowCount: 3,
    windowsCompleted: 1,
    remainingWindows: 2,
    maxStepsPerWindow: 2,
    intervalMs: 1000,
    deadlineAt: "2026-08-01T13:01:00.000Z",
    nextWindowAt: "2026-08-01T13:00:10.000Z",
    stopReason: "core_restart_requires_explicit_rearm",
    lastRunSessionId: "run-1",
    lastResult: { ran: true, count: 1, blocked: false, reason: null },
  });
  runtime.persistState.flush();

  const persisted = JSON.parse(readFileSync(stateFilePath, "utf8"));
  assert.equal(persisted.boundedOperatorWindowLeases.length, 1);
  assert.equal(persisted.boundedOperatorWindowLeases[0].id, "lease-1");
  assert.equal(persisted.boundedOperatorWindowLeases[0].remainingWindows, 2);

  const restored = createRuntimeState({ stateFilePath, getTaskById: () => null });
  restored.loadPersistentState();
  assert.equal(restored.boundedOperatorWindowLeases.size, 1);
  assert.equal(restored.boundedOperatorWindowLeases.get("lease-1").status, "paused");
  assert.equal(restored.boundedOperatorWindowLeases.get("lease-1").lastRunSessionId, "run-1");
});
