import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeEngineeringWriteExecutionEvidence,
  NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_REGISTRY,
} from "../src/native-engineering-write-execution-evidence-builders.mjs";

test("native engineering write execution evidence attaches approved writes to proposal metadata", () => {
  const tasks = new Map([
    ["task-write", {
      id: "task-write",
      status: "completed",
      closedAt: "2026-07-09T00:00:00.000Z",
      engineeringWriteProposal: {
        registry: "openclaw-native-engineering-write-proposal-v0",
        proposalId: "proposal-1",
        proposalKind: "create_file_proposal",
        sourceCapabilityId: "act.openclaw.engineering_tool.write_proposal",
        approvedMutationCapabilityId: "act.openclaw.workspace_text_write",
        target: {
          relativePath: "src/out.txt",
          exists: false,
          proposedBytes: 12,
          proposedSha256: "abc123",
          overwriteRequested: false,
          contentExposed: false,
        },
        contentExposed: false,
      },
    }],
  ]);
  const response = buildNativeEngineeringWriteExecutionEvidence({
    tasks,
    filesystemChanges: [{
      id: "write-1",
      taskId: "task-write",
      capabilityId: "act.filesystem.write_text",
      change: "write_text",
      path: "/workspace/src/out.txt",
      contentBytes: 12,
      overwrite: false,
      policy: { decision: "audit_only", approved: true, risk: "high" },
    }],
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_REGISTRY);
  assert.equal(response.capability.id, "sense.openclaw.engineering_tool.write_execution_evidence");
  assert.equal(response.summary.total, 1);
  assert.equal(response.summary.passed, 1);
  assert.equal(response.summary.withEngineeringProposal, 1);
  assert.equal(response.evidence[0].validation.ok, true);
  assert.equal(response.evidence[0].proposal.proposalId, "proposal-1");
  assert.equal(response.evidence[0].proposal.contentExposed, false);
  assert.equal(response.governance.canWriteFile, false);
  assert.equal(response.governance.canCreateTask, false);
  assert.equal(response.bounds.noFilesystemWrite, true);
});

test("native engineering write execution evidence marks missing proposal metadata as failed evidence", () => {
  const response = buildNativeEngineeringWriteExecutionEvidence({
    tasks: new Map([["task-write", { id: "task-write", status: "completed" }]]),
    filesystemChanges: [{
      id: "write-1",
      taskId: "task-write",
      capabilityId: "act.filesystem.write_text",
      change: "write_text",
      contentBytes: 5,
      policy: { decision: "audit_only", approved: true },
    }],
  });

  assert.equal(response.summary.total, 1);
  assert.equal(response.summary.failed, 1);
  assert.equal(response.evidence[0].validation.ok, false);
  assert.equal(
    response.evidence[0].validation.failedChecks.some((check) => check.name === "engineering_write_proposal_attached"),
    true,
  );
});
