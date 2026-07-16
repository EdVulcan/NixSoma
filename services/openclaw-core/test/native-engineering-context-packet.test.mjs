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

test("engineering context packet keeps the execution task separate from an explicit source task", () => {
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [
      { taskId: "source-task", stdout: "source-evidence", stderr: "", command: "npm" },
      { taskId: "execution-task", stdout: "execution-evidence", stderr: "", command: "npm" },
    ],
    taskId: "execution-task",
    sourceTaskId: "source-task",
    thresholdChars: 10_000,
    protectRecentAssistantTurns: 0,
  });

  assert.equal(packet.summary.sourceTranscriptRecords, 1);
  assert.equal(packet.summary.sourceTaskId, "source-task");
  assert.equal(packet.provenance.taskId, "execution-task");
  assert.equal(packet.provenance.sourceTaskId, "source-task");
  assert.equal(JSON.stringify(packet).includes("source-evidence"), true);
  assert.equal(JSON.stringify(packet).includes("execution-evidence"), false);
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
      workViewObservationIncluded: true,
      workViewObservationStatus: "ready",
      workViewObservationFreshness: "fresh",
      workViewObservationSequence: 7,
      semanticTargetCount: 2,
      semanticActionDecisionStatus: "ready_for_target_selection",
      semanticActionDecisionReason: null,
      semanticActionReady: true,
      semanticActionOperatorControlId: null,
    },
    observation: {
      registry: "openclaw-native-engineering-work-view-observation-v0",
      status: "ready",
      freshness: "fresh",
      sequence: 7,
      visualFrame: { available: true, fresh: true, sha256: "a".repeat(64), width: 960, height: 540 },
      semanticTargets: { available: true, itemCount: 2, itemsRetained: false },
      pageReferencePresent: true,
      fullPayloadRetained: false,
    },
    governance: {
      exposesLeaseId: false,
      exposesActiveUrl: false,
      exposesVisualFrameBytes: false,
      exposesSemanticTargetItems: false,
    },
  };
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [],
    taskId: "selected",
    workViewAssociation,
  });

  assert.equal(packet.summary.workViewAssociationIncluded, true);
  assert.equal(packet.summary.workViewAssociationStatus, "bound");
  assert.equal(packet.summary.workViewObservationIncluded, true);
  assert.equal(packet.summary.workViewObservationStatus, "ready");
  assert.equal(packet.summary.semanticTargetCount, 2);
  assert.equal(packet.summary.semanticActionDecisionStatus, "ready_for_target_selection");
  assert.equal(packet.summary.semanticActionReady, true);
  assert.equal(packet.provenance.workViewAssociationRegistry, "openclaw-native-engineering-work-view-association-v0");
  assert.equal(packet.governance.readsTrustedWorkViewObservation, true);
  assert.equal(packet.messages.at(-3).toolName, "trusted_work_view");
  assert.equal(JSON.stringify(packet).includes("leaseId"), false);
  assert.equal(JSON.stringify(packet).includes("activeUrl"), false);
  assert.equal(packet.governance.readsTrustedWorkViewState, true);
});

test("engineering context packet protects explicit plan/todo guidance", () => {
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [],
    taskId: "task-plan-context",
    planTodoEvidence: {
      registry: "openclaw-native-engineering-plan-todo-evidence-v0",
      summary: {
        taskPlanCount: 1,
        todoSource: "workbench_storage",
        evidenceTodoCounts: { total: 1, pending: 1, in_progress: 0, done: 0 },
      },
      taskPlanEvidence: {
        selectedTaskId: "task-plan-context",
        count: 1,
        items: [{ taskId: "task-plan-context", todos: [{ id: "todo-1", description: "Run bounded verification", status: "pending" }] }],
      },
      workbenchStorage: { persisted: true, revision: 2, todoCount: 1 },
      nextGovernedActionSuggestion: {
        registry: "openclaw-native-engineering-plan-todo-next-action-v0",
        currentTodo: { id: "todo-1", status: "pending", descriptionPreview: "Run bounded verification" },
        suggestion: { actionId: "create_verification_task", existingObserverControlId: "engineering-verification-task-button" },
        governance: { guidanceOnly: true, executesAutomatically: false },
      },
    },
    thresholdChars: 1,
    protectRecentAssistantTurns: 0,
  });

  const planMessage = packet.messages.find((message) => message.evidenceKind === "engineering_plan_todo_evidence");
  assert.equal(planMessage?.toolName, "engineering_plan_todo");
  assert.equal(packet.summary.planTodoEvidenceIncluded, true);
  assert.equal(packet.summary.planTodoTodoSource, "workbench_storage");
  assert.equal(packet.summary.planTodoCurrentAction, "create_verification_task");
  assert.equal(packet.governance.readsPlanTodoEvidence, true);
  assert.equal(packet.summary.compactedMessages, 0);
  assert.equal(JSON.stringify(packet).includes('"executesAutomatically":true'), false);
});

test("engineering context packet carries bounded advisory experience memory as protected evidence", () => {
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords: [],
    taskId: "task-experience-context",
    experienceMemory: {
      ok: true,
      registry: "openclaw-native-engineering-experience-memory-v0",
      records: [{
        id: "experience-record-1",
        taskType: "system_task",
        lesson: "Reuse bounded verification evidence before retrying.",
        outcome: "failed",
        executionPhase: "verifying_result",
        applicabilityTokens: ["type:system_task", "verify"],
        confidence: 0.58,
        recordedAt: "2026-07-16T00:00:00.000Z",
        source: {
          registry: "openclaw-task-lifecycle-terminal-v0",
          taskId: "source-experience-task",
          outcomeHash: "a".repeat(64),
        },
      }],
      summary: {
        storedRecords: 1,
        recalledRecords: 1,
        status: "recalled",
        advisoryOnly: true,
      },
      bounds: { maxRecallRecords: 8 },
      governance: { advisoryOnly: true },
      auditEvidence: {
        summary: {
          storedRecords: 1,
          recalledRecords: 1,
          queryTokenCount: 2,
          queryHash: "b".repeat(64),
          advisoryOnly: true,
        },
      },
    },
    thresholdChars: 1,
    protectRecentAssistantTurns: 0,
  });

  const experienceMessage = packet.messages.find((message) => message.evidenceKind === "experience_memory_evidence");
  assert.equal(experienceMessage?.toolName, "experience_memory");
  assert.equal(packet.summary.experienceMemoryIncluded, true);
  assert.equal(packet.summary.experienceMemoryRecalled, 1);
  assert.equal(packet.summary.experienceMemoryStatus, "recalled");
  assert.equal(packet.summary.experienceMemoryAdvisoryOnly, true);
  assert.equal(packet.governance.readsExperienceMemory, true);
  assert.equal(packet.governance.experienceMemoryAdvisoryOnly, true);
  assert.deepEqual(packet.auditEvidence.summary.experienceMemory, {
    storedRecords: 1,
    recalledRecords: 1,
    queryTokenCount: 2,
    queryHash: "b".repeat(64),
    advisoryOnly: true,
  });
  assert.equal(JSON.stringify(packet.auditEvidence).includes("Reuse bounded"), false);
});
