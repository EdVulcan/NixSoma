import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeEngineeringEditExecutionEvidence,
  NATIVE_ENGINEERING_EDIT_EXECUTION_EVIDENCE_REGISTRY,
} from "../src/native-engineering-edit-execution-evidence-builders.mjs";

test("native engineering edit execution evidence attaches approved patch tasks to proposal metadata", () => {
  const tasks = new Map([
    ["task-edit", {
      id: "task-edit",
      status: "completed",
      closedAt: "2026-07-09T00:00:00.000Z",
      engineeringEditProposal: {
        registry: "openclaw-native-engineering-edit-proposal-v0",
        proposalId: "proposal-1",
        proposalKind: "exact_replacement_diff_preview",
        sourceCapabilityId: "act.openclaw.engineering_tool.edit_proposal",
        approvedMutationCapabilityId: "act.openclaw.workspace_patch_apply",
        target: {
          relativePath: "package.json",
          originalBytes: 40,
          proposedBytes: 48,
          originalSha256: "old-hash",
          proposedSha256: "new-hash",
          changedAtLine: 4,
          contentExposed: false,
          diffPreviewExposed: true,
        },
        contentExposed: false,
        diffPreviewExposed: true,
      },
    }],
  ]);
  const response = buildNativeEngineeringEditExecutionEvidence({
    tasks,
    filesystemChanges: [{
      id: "write-1",
      taskId: "task-edit",
      capabilityId: "act.filesystem.write_text",
      change: "write_text",
      path: "/workspace/package.json",
      contentBytes: 48,
      overwrite: true,
      policy: { decision: "audit_only", approved: true, risk: "high" },
    }],
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, NATIVE_ENGINEERING_EDIT_EXECUTION_EVIDENCE_REGISTRY);
  assert.equal(response.capability.id, "sense.openclaw.engineering_tool.edit_execution_evidence");
  assert.equal(response.summary.total, 1);
  assert.equal(response.summary.passed, 1);
  assert.equal(response.summary.withEngineeringProposal, 1);
  assert.equal(response.evidence[0].validation.ok, true);
  assert.equal(response.evidence[0].proposal.proposalId, "proposal-1");
  assert.equal(response.evidence[0].proposal.contentExposed, false);
  assert.equal(response.evidence[0].proposal.diffPreviewExposed, true);
  assert.equal(response.governance.canWriteFile, false);
  assert.equal(response.governance.canCreateTask, false);
  assert.equal(response.bounds.noFilesystemWrite, true);
});

test("native engineering edit execution evidence marks missing proposal metadata as failed evidence", () => {
  const response = buildNativeEngineeringEditExecutionEvidence({
    tasks: new Map([["task-edit", { id: "task-edit", status: "completed" }]]),
    filesystemChanges: [{
      id: "write-1",
      taskId: "task-edit",
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
    response.evidence[0].validation.failedChecks.some((check) => check.name === "engineering_edit_proposal_attached"),
    true,
  );
});
