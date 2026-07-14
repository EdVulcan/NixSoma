import test from "node:test";
import assert from "node:assert/strict";

import { buildNativeEngineeringContextPacket } from "../src/native-engineering-context-packet.mjs";

test("engineering context packet redacts, compacts, and protects verification summaries", () => {
  const records = Array.from({ length: 4 }, (_, index) => ({
    taskId: `task-${index}`,
    index,
    invocationId: `invocation-${index}`,
    command: "npm",
    stdout: `${index === 0 ? "token=private-value " : ""}${String(index).repeat(2_000)}`,
    stderr: "",
    exitCode: 0,
    timedOut: false,
  }));
  const tasks = new Map(records.map((record) => [record.taskId, {
    id: record.taskId,
    type: "system_task",
    status: "completed",
    goal: `Verify task ${record.taskId}`,
    outcome: { kind: "completed" },
  }]));

  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: records,
    tasks,
    verificationEvidence: { registry: "verification-v0", summary: { total: 4, passed: 4 } },
    recoveryEvidence: { registry: "recovery-v0", summary: { totalFailures: 0 } },
    thresholdChars: 1_000,
    protectRecentAssistantTurns: 1,
  });

  assert.equal(packet.registry, "openclaw-native-engineering-context-packet-v0");
  assert.equal(packet.summary.sourceTranscriptRecords, 4);
  assert.equal(packet.summary.redactions, 1);
  assert.equal(packet.summary.compactedMessages > 0, true);
  assert.equal(JSON.stringify(packet).includes("private-value"), false);
  assert.equal(packet.messages.at(-2).evidenceKind, "verification_evidence");
  assert.equal(packet.messages.at(-1).evidenceKind, "recovery_evidence");
  assert.equal(packet.governance.callsProvider, false);
  assert.equal(packet.governance.networkEgress, false);
  assert.equal(packet.auditEvidence.inputContentRecorded, false);
});

test("engineering context packet filters one task and bounds output", () => {
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [
      { taskId: "selected", stdout: "A".repeat(20_000), stderr: "", command: "npm" },
      { taskId: "other", stdout: "other", stderr: "", command: "npm" },
    ],
    taskId: "selected",
    maxOutputChars: 500,
    thresholdChars: 10_000,
  });

  assert.equal(packet.summary.sourceTranscriptRecords, 1);
  assert.equal(packet.summary.truncatedOutputs, 1);
  assert.equal(packet.messages[1].content[0].text.length <= 510, true);
  assert.equal(packet.provenance.taskId, "selected");
});

test("engineering context packet carries compact trusted work-view association without lease or URL data", () => {
  const workViewAssociation = {
    ok: true,
    registry: "openclaw-native-engineering-work-view-association-v0",
    summary: {
      status: "bound",
      taskId: "selected",
      taskStatus: "running",
      workViewId: "work-view-primary",
      sessionStatus: "running",
      sessionIdentityStatus: "authoritative",
      helperStatus: "active",
      actionAuthority: "active",
      leaseMatched: true,
      bindingStatus: "bound",
      recoveryAction: "none",
    },
    governance: {
      exposesLeaseId: false,
      exposesActiveUrl: false,
    },
  };
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [],
    taskId: "selected",
    workViewAssociation,
  });

  assert.equal(packet.summary.workViewAssociationIncluded, true);
  assert.equal(packet.summary.workViewAssociationStatus, "bound");
  assert.equal(packet.provenance.workViewAssociationRegistry, "openclaw-native-engineering-work-view-association-v0");
  assert.equal(packet.messages.at(-3).toolName, "trusted_work_view");
  assert.equal(JSON.stringify(packet).includes("leaseId"), false);
  assert.equal(JSON.stringify(packet).includes("activeUrl"), false);
  assert.equal(packet.governance.readsTrustedWorkViewState, true);
});
