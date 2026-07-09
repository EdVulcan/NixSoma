import test from "node:test";
import assert from "node:assert/strict";

import { buildNativeEngineeringMicrocompactEvidence } from "../src/native-engineering-microcompact-evidence-builders.mjs";

function transcript({
  taskId,
  stdout,
  stderr = "",
  index = 0,
  state = "executed",
} = {}) {
  return {
    taskId,
    index,
    command: "npm",
    stdout,
    stderr,
    state,
    capabilityId: "act.system.command.execute",
    exitCode: 0,
    timedOut: false,
  };
}

test("native engineering microcompact evidence previews historical context savings without raw output", () => {
  const protectedOutput = `protected-${"A".repeat(1_500)}`;
  const compactableOutput = `compactable-${"B".repeat(1_700)}`;
  const response = buildNativeEngineeringMicrocompactEvidence({
    transcriptRecords: [
      transcript({ taskId: "task-latest", stdout: protectedOutput }),
      transcript({ taskId: "task-old", stdout: compactableOutput, index: 1 }),
      transcript({ taskId: "task-small", stdout: "small output", index: 2 }),
    ],
    tasks: new Map([
      ["task-latest", { id: "task-latest", status: "completed", outcome: { kind: "completed" } }],
      ["task-old", { id: "task-old", status: "completed", outcome: { kind: "completed" } }],
    ]),
    thresholdChars: 1_000,
    protectRecentItems: 1,
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, "openclaw-native-engineering-microcompact-evidence-v0");
  assert.equal(response.capability.id, "sense.openclaw.engineering_context.microcompact_evidence");
  assert.equal(response.governance.canMutateRuntimeMessages, false);
  assert.equal(response.governance.canMutatePersistedLogs, false);
  assert.equal(response.governance.canExecuteCommand, false);
  assert.equal(response.summary.totalItems, 3);
  assert.equal(response.summary.protectedItems, 1);
  assert.equal(response.summary.compactableItems, 1);
  assert.equal(response.summary.reclaimedChars > 1_000, true);
  assert.equal(response.candidates[0].microcompactPreview.reason, "protected_recent_engineering_evidence");
  assert.equal(response.candidates[1].microcompactPreview.compactable, true);
  assert.equal(response.candidates[1].output.sourceTextExposed, false);
  assert.equal(JSON.stringify(response).includes("compactable-BBBBB"), false);
  assert.equal(response.deferredExecutionBoundaries.includes("no hidden transcript mutation"), true);
});

test("native engineering microcompact evidence clamps query and keeps verification links", () => {
  const response = buildNativeEngineeringMicrocompactEvidence({
    transcriptRecords: [transcript({ taskId: "task-a", stdout: "C".repeat(600) })],
    verificationEvidence: {
      registry: "openclaw-native-engineering-verification-evidence-v0",
      summary: { total: 1, passed: 1 },
    },
    recoveryEvidence: {
      registry: "openclaw-native-engineering-recovery-evidence-v0",
      summary: { totalFailures: 0 },
    },
    limit: 999,
    thresholdChars: 999_999,
    protectRecentItems: 999,
  });

  assert.equal(response.query.limit, 100);
  assert.equal(response.query.thresholdChars, 100_000);
  assert.equal(response.query.protectRecentItems, 20);
  assert.equal(response.sourceRegistries.includes("openclaw-native-engineering-verification-evidence-v0"), true);
  assert.equal(response.sourceRegistries.includes("openclaw-native-engineering-recovery-evidence-v0"), true);
  assert.equal(response.protectedEvidenceLinks.includes("/plugins/native-adapter/engineering-verification/evidence?limit=8"), true);
  assert.deepEqual(response.verificationSummary, { total: 1, passed: 1 });
  assert.deepEqual(response.recoverySummary, { totalFailures: 0 });
});
