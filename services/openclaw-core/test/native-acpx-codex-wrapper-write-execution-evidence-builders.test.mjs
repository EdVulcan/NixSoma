import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeAcpxCodexWrapperWriteExecutionEvidence,
  NATIVE_ACPX_CODEX_WRAPPER_WRITE_EXECUTION_EVIDENCE_REGISTRY,
} from "../src/native-acpx-codex-wrapper-write-execution-evidence-builders.mjs";

test("native ACPX/Codex wrapper write execution evidence links approved write ledger to bridge metadata", () => {
  const tasks = new Map([
    ["task-acpx-write", {
      id: "task-acpx-write",
      status: "completed",
      closedAt: "2026-07-10T00:00:00.000Z",
      nativeAcpxCodexBridgeWrapper: {
        registry: "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0",
        proposalId: "proposal-1",
        sourceRegistry: "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0",
        sourceCapabilityId: "plan.openclaw.acpx_codex_bridge.wrapper_write",
        approvedMutationCapabilityId: "act.openclaw.workspace_text_write",
        target: {
          relativePath: ".openclaw/acpx/codex-bridge/codex-acp-test.sh",
          contentHash: "sha256:abc123",
          contentPreviewBytes: 123,
          contentPreviewExposed: false,
          chmodApplied: false,
        },
        command: {
          command: "npx.cmd",
          argsCount: 3,
          argsExposed: false,
          commandExecuted: false,
          processSpawned: false,
        },
        governance: {
          contentPreviewExposedOnTask: false,
          canReadCredentialValue: false,
          canCopyAuthMaterial: false,
          canSpawnCodexAcp: false,
        },
      },
    }],
  ]);
  const response = buildNativeAcpxCodexWrapperWriteExecutionEvidence({
    tasks,
    filesystemChanges: [{
      id: "write-1",
      taskId: "task-acpx-write",
      capabilityId: "act.filesystem.write_text",
      change: "write_text",
      path: "/workspace/.openclaw/acpx/codex-bridge/codex-acp-test.sh",
      contentBytes: 123,
      overwrite: true,
      policy: { decision: "audit_only", approved: true, risk: "high" },
    }],
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, NATIVE_ACPX_CODEX_WRAPPER_WRITE_EXECUTION_EVIDENCE_REGISTRY);
  assert.equal(response.capability.id, "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence");
  assert.equal(response.summary.total, 1);
  assert.equal(response.summary.passed, 1);
  assert.equal(response.summary.withWrapperProposal, 1);
  assert.equal(response.evidence[0].validation.ok, true);
  assert.equal(response.evidence[0].wrapper.target.contentPreviewExposed, false);
  assert.equal(response.evidence[0].wrapper.command.argsExposed, false);
  assert.equal(response.governance.canWriteFile, false);
  assert.equal(response.governance.canSpawnCodexAcp, false);
  assert.equal(response.recoveryRecommendation.needed, false);
});

test("native ACPX/Codex wrapper write execution evidence recommends recovery when ledger is missing", () => {
  const response = buildNativeAcpxCodexWrapperWriteExecutionEvidence({
    taskId: "task-acpx-write",
    tasks: new Map([["task-acpx-write", {
      id: "task-acpx-write",
      status: "completed",
      nativeAcpxCodexBridgeWrapper: {
        registry: "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0",
        approvedMutationCapabilityId: "act.openclaw.workspace_text_write",
      },
    }]]),
    filesystemChanges: [],
  });

  assert.equal(response.summary.total, 0);
  assert.equal(response.recoveryRecommendation.needed, true);
  assert.equal(response.recoveryRecommendation.status, "missing_filesystem_ledger");
  assert.equal(response.recoveryRecommendation.createsTask, false);
  assert.equal(response.bounds.noTaskCreation, true);
  assert.equal(response.bounds.noWrapperExecution, true);
});
