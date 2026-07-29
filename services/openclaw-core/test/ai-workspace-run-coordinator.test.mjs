import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceRunCoordinator } from "../src/ai-workspace-run-coordinator.mjs";

const PRIVATE_TEXT = "private generated input";
const TASK_ID = "task-bounded-run-1";

function inputEvidence(text = PRIVATE_TEXT) {
  return {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: text.length,
    byteLength: Buffer.byteLength(text),
    maxChars: 2000,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function stepResult({
  actionId = "scroll_down",
  status = "executed",
  actionExecuted = actionId !== "no_op",
  executionSequence = 10,
  postSequence = 11,
  completionAudit = true,
} = {}) {
  const semanticType = actionId === "type_item";
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-single-step-v0",
    status,
    decision: {
      actionId,
      itemOrdinal: semanticType ? 1 : null,
      inputText: semanticType ? PRIVATE_TEXT : null,
      inputEvidence: semanticType ? inputEvidence() : null,
    },
    action: semanticType ? { itemOrdinal: 1, inputEvidence: inputEvidence() } : null,
    evidence: {
      taskId: TASK_ID,
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      contextContentHash: "c".repeat(64),
      requestContentHash: "d".repeat(64),
      responseContentHash: "e".repeat(64),
      sceneContentHash: "f".repeat(64),
      sceneItemCount: 4,
      actionExecuted,
      inputEvidence: semanticType ? inputEvidence() : null,
      executionFrame: { sequence: executionSequence },
      postFrame: { sequence: postSequence },
      receiptMatched: actionId.startsWith("scroll_") && actionExecuted,
      completionAudit,
      postActionVerified: semanticType && actionExecuted,
    },
    governance: {
      providerCalled: true,
      actionExecuted,
      currentFrameBound: actionExecuted,
      currentActiveSurfaceBound: actionExecuted,
      keyboardInput: semanticType,
      inputTextPersisted: false,
    },
  };
}

function assessmentResult({ outcome = "complete" } = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-task-assessment-v0",
    status: "assessed",
    assessment: { outcome, confidence: 0.9 },
    evidence: {
      taskId: TASK_ID,
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      contextContentHash: "c".repeat(64),
      requestContentHash: "d".repeat(64),
      responseContentHash: "e".repeat(64),
      sceneContentHash: "f".repeat(64),
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      semanticSceneBound: true,
      currentBrowserSurfaceBound: true,
      taskObjectiveBound: true,
      taskObjectiveProviderEgress: true,
      rawTaskGoalProviderEgress: false,
      pixelsProviderEgress: false,
      urlsProviderEgress: false,
      inputValuesProviderEgress: false,
      maximumActions: 0,
      actionExecuted: false,
      taskMutated: false,
      automaticContinuation: false,
      createsTask: false,
      createsApproval: false,
      mutatesHost: false,
    },
  };
}

function harness(results, {
  rejectContinuationAudit = false,
  rejectRunCompletionAudit = false,
  rejectAssessmentContinuationAudit = false,
} = {}) {
  const calls = { invoke: [], assessment: [], audit: [], order: [] };
  const queue = [...results];
  const coordinator = createAiWorkspaceRunCoordinator({
    singleStep: {
      async invoke(input) {
        calls.invoke.push(input);
        calls.order.push(`step:${calls.invoke.length}`);
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next;
      },
      localFallback(reason) {
        return stepResult({ actionId: "no_op", status: "local_fallback", actionExecuted: false, reason });
      },
    },
    assessment: {
      async invoke(input) {
        calls.assessment.push(input);
        calls.order.push("assessment");
        return assessmentResult();
      },
      localFallback: (reason) => ({
        registry: "nixsoma-ai-workspace-task-assessment-v0",
        status: "local_fallback",
        fallback: { reason },
      }),
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      calls.order.push(`audit:${name}`);
      return { ok: !(
        (rejectContinuationAudit && name === "ai_workspace.bounded_run_continuation_authorized")
        || (rejectRunCompletionAudit && name === "ai_workspace.bounded_run_completed")
        || (rejectAssessmentContinuationAudit
          && name === "ai_workspace.reviewed_cycle_assessment_authorized")
      ) };
    },
    now: () => "2026-07-29T01:00:00.000Z",
  });
  return { calls, coordinator };
}

test("bounded workspace run continues once after a verified scroll and keeps type input write-only", async () => {
  const { calls, coordinator } = harness([
    stepResult({ actionId: "scroll_down" }),
    stepResult({ actionId: "type_item" }),
  ]);

  const result = await coordinator.boundedRun.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.steps.length, 2);
  assert.deepEqual(result.steps.map((step) => step.actionId), ["scroll_down", "type_item"]);
  assert.deepEqual(result.steps.map((step) => step.completionAudit), [true, true]);
  assert.equal(result.steps[1].inputEvidence.charCount, PRIVATE_TEXT.length);
  assert.equal(result.evidence.providerCallCount, 2);
  assert.equal(result.evidence.actionCount, 2);
  assert.equal(result.evidence.continuationAudit, true);
  assert.equal(result.governance.continuedAfterVerifiedScroll, true);
  assert.equal(result.governance.terminalAfterSecondStep, true);
  assert.equal(result.governance.automaticRepeat, false);
  assert.equal(JSON.stringify(result).includes(PRIVATE_TEXT), false);
  assert.deepEqual(calls.invoke[1].expectedTaskBinding, {
    taskId: TASK_ID,
    objectiveContentHash: "a".repeat(64),
    taskVersionHash: "b".repeat(64),
  });
  assert.deepEqual(calls.order.slice(0, 3), [
    "step:1",
    "audit:ai_workspace.bounded_run_continuation_authorized",
    "step:2",
  ]);
  assert.equal(calls.audit.at(-1).name, "ai_workspace.bounded_run_completed");
  assert.equal(JSON.stringify(calls.audit).includes(PRIVATE_TEXT), false);
});

test("bounded workspace run stops after first no-op, click, or type", async (t) => {
  for (const actionId of ["no_op", "click_item", "type_item"]) {
    await t.test(actionId, async () => {
      const { calls, coordinator } = harness([
        stepResult({ actionId, actionExecuted: actionId !== "no_op" }),
        stepResult({ actionId: "scroll_down" }),
      ]);
      const result = await coordinator.boundedRun.invoke({ taskId: TASK_ID });
      assert.equal(result.status, "stopped_after_first");
      assert.equal(result.steps.length, 1);
      assert.equal(calls.invoke.length, 1);
      assert.equal(calls.audit.some((item) => item.name.endsWith("continuation_authorized")), false);
      assert.equal(JSON.stringify(result).includes(PRIVATE_TEXT), false);
    });
  }
});

test("bounded workspace run requires verified scroll and durable continuation audit", async () => {
  const unverified = harness([
    stepResult({ actionId: "scroll_down", postSequence: 10 }),
    stepResult({ actionId: "type_item" }),
  ]);
  const unverifiedResult = await unverified.coordinator.boundedRun.invoke({ taskId: TASK_ID });
  assert.equal(unverifiedResult.terminalReason, "first_step_unverified_scroll");
  assert.equal(unverified.calls.invoke.length, 1);

  const noAudit = harness([
    stepResult({ actionId: "scroll_down" }),
    stepResult({ actionId: "type_item" }),
  ], { rejectContinuationAudit: true });
  const noAuditResult = await noAudit.coordinator.boundedRun.invoke({ taskId: TASK_ID });
  assert.equal(noAuditResult.terminalReason, "continuation_audit_unavailable");
  assert.equal(noAuditResult.evidence.continuationAudit, false);
  assert.equal(noAudit.calls.invoke.length, 1);
});

test("bounded workspace run treats a local pre-egress fallback as a known terminal result", async () => {
  const fallback = stepResult({ actionId: "no_op", status: "local_fallback", actionExecuted: false });
  fallback.evidence.taskId = null;
  fallback.evidence.objectiveContentHash = null;
  fallback.evidence.taskVersionHash = null;
  fallback.governance.providerCalled = false;
  const { calls, coordinator } = harness([fallback, stepResult({ actionId: "type_item" })]);

  const result = await coordinator.boundedRun.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "stopped_after_first");
  assert.equal(result.terminalReason, "first_step_fallback");
  assert.equal(result.evidence.outcomeUnknown, false);
  assert.equal(result.evidence.providerCallCount, 0);
  assert.equal(result.evidence.actionCount, 0);
  assert.equal(calls.invoke.length, 1);
});

test("workspace run coordinator serializes bounded and single-step invocations", async () => {
  let releaseFirst;
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  const release = new Promise((resolve) => { releaseFirst = resolve; });
  const primitive = {
    async invoke() {
      firstStarted();
      await release;
      return stepResult({ actionId: "no_op", actionExecuted: false });
    },
    localFallback: (reason) => ({
      ok: true,
      registry: "nixsoma-ai-workspace-single-step-v0",
      status: "local_fallback",
      fallback: { reason, actionId: "no_op" },
      evidence: { actionExecuted: false },
      governance: { providerCalled: false, actionExecuted: false },
    }),
  };
  const assessment = {
    async invoke() {
      return { status: "assessed" };
    },
    localFallback: (reason) => ({
      status: "local_fallback",
      fallback: { reason },
      assessment: { outcome: "unknown", confidence: null },
    }),
  };
  const coordinator = createAiWorkspaceRunCoordinator({ singleStep: primitive, assessment });
  const bounded = coordinator.boundedRun.invoke({ taskId: TASK_ID });
  await started;

  const concurrent = await coordinator.singleStep.invoke({ taskId: TASK_ID });
  assert.equal(concurrent.status, "local_fallback");
  assert.equal(concurrent.fallback.reason, "workspace_run_in_flight");
  const concurrentAssessment = await coordinator.assessment.invoke({ taskId: TASK_ID });
  assert.equal(concurrentAssessment.status, "local_fallback");
  assert.equal(concurrentAssessment.fallback.reason, "workspace_run_in_flight");

  releaseFirst();
  const completed = await bounded;
  assert.equal(completed.status, "stopped_after_first");
});

test("workspace run coordinator blocks steps while assessment is in flight", async () => {
  let releaseAssessment;
  let assessmentStarted;
  const started = new Promise((resolve) => { assessmentStarted = resolve; });
  const release = new Promise((resolve) => { releaseAssessment = resolve; });
  const primitive = {
    async invoke() {
      return stepResult({ actionId: "no_op", actionExecuted: false });
    },
    localFallback: (reason) => ({
      status: "local_fallback",
      fallback: { reason, actionId: "no_op" },
    }),
  };
  const assessment = {
    async invoke() {
      assessmentStarted();
      await release;
      return { status: "assessed", assessment: { outcome: "complete", confidence: 1 } };
    },
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const coordinator = createAiWorkspaceRunCoordinator({ singleStep: primitive, assessment });
  const pendingAssessment = coordinator.assessment.invoke({ taskId: TASK_ID });
  await started;

  const concurrentStep = await coordinator.singleStep.invoke({ taskId: TASK_ID });
  const concurrentRun = await coordinator.boundedRun.invoke({ taskId: TASK_ID });
  assert.equal(concurrentStep.fallback.reason, "workspace_run_in_flight");
  assert.equal(concurrentRun.terminalReason, "workspace_run_in_flight");

  releaseAssessment();
  const completed = await pendingAssessment;
  assert.equal(completed.status, "assessed");
});

test("workspace run coordinator serializes OCR assessment with steps and semantic assessment", async () => {
  let releaseOcr;
  let ocrStarted;
  const started = new Promise((resolve) => { ocrStarted = resolve; });
  const release = new Promise((resolve) => { releaseOcr = resolve; });
  const singleStep = {
    invoke: async () => stepResult({ actionId: "no_op", actionExecuted: false }),
    localFallback: (reason) => ({
      status: "local_fallback",
      fallback: { reason },
    }),
  };
  const assessment = {
    invoke: async () => ({ status: "assessed" }),
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const ocrAssessment = {
    async invoke() {
      ocrStarted();
      await release;
      return { status: "assessed", assessment: { outcome: "complete", confidence: 1 } };
    },
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const coordinator = createAiWorkspaceRunCoordinator({
    singleStep,
    assessment,
    ocrAssessment,
  });
  const pending = coordinator.ocrAssessment.invoke({ taskId: TASK_ID });
  await started;

  const blockedStep = await coordinator.singleStep.invoke({ taskId: TASK_ID });
  const blockedAssessment = await coordinator.assessment.invoke({ taskId: TASK_ID });
  assert.equal(blockedStep.fallback.reason, "workspace_run_in_flight");
  assert.equal(blockedAssessment.fallback.reason, "workspace_run_in_flight");

  releaseOcr();
  assert.equal((await pending).status, "assessed");
});

test("workspace run coordinator serializes OCR click with every workspace decision", async () => {
  let releaseClick;
  let clickStarted;
  const started = new Promise((resolve) => { clickStarted = resolve; });
  const release = new Promise((resolve) => { releaseClick = resolve; });
  const singleStep = {
    invoke: async () => stepResult({ actionId: "no_op", actionExecuted: false }),
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const assessment = {
    invoke: async () => ({ status: "assessed" }),
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const ocrClick = {
    async invoke() {
      clickStarted();
      await release;
      return { status: "executed", action: { actionId: "click_item", executed: true } };
    },
    localFallback: (reason) => ({ status: "local_fallback", fallback: { reason } }),
  };
  const coordinator = createAiWorkspaceRunCoordinator({ singleStep, assessment, ocrClick });
  const pending = coordinator.ocrClick.invoke({ taskId: TASK_ID });
  await started;
  const blockedStep = await coordinator.singleStep.invoke({ taskId: TASK_ID });
  const blockedAssessment = await coordinator.assessment.invoke({ taskId: TASK_ID });
  assert.equal(blockedStep.fallback.reason, "workspace_run_in_flight");
  assert.equal(blockedAssessment.fallback.reason, "workspace_run_in_flight");
  releaseClick();
  assert.equal((await pending).status, "executed");
});

test("bounded workspace run reports an unknown second outcome without retry", async () => {
  const { calls, coordinator } = harness([
    stepResult({ actionId: "scroll_up" }),
    new Error("private actuator detail"),
  ]);

  const result = await coordinator.boundedRun.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "second_step_outcome_unknown");
  assert.equal(result.evidence.outcomeUnknown, true);
  assert.equal(result.evidence.providerCallCount, null);
  assert.equal(result.evidence.providerCallCountMinimum, 1);
  assert.equal(result.evidence.actionCount, null);
  assert.equal(result.evidence.actionCountMinimum, 1);
  assert.equal(calls.invoke.length, 2);
  assert.equal(JSON.stringify(result).includes("private actuator detail"), false);
});

test("reviewed workspace cycle assesses a complete receipt after one audited no-op run", async () => {
  const { calls, coordinator } = harness([
    stepResult({ actionId: "no_op", actionExecuted: false }),
  ]);

  const result = await coordinator.reviewedCycle.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "assessed");
  assert.equal(result.assessment.assessment.outcome, "complete");
  assert.equal(result.evidence.providerCallCount, 2);
  assert.equal(result.evidence.actionCount, 0);
  assert.equal(result.evidence.runCompletionAudit, true);
  assert.equal(result.evidence.assessmentContinuationAudit, true);
  assert.equal(result.evidence.assessmentCompletionAudit, true);
  assert.equal(result.evidence.cycleCompletionAudit, true);
  assert.equal(result.evidence.assessmentReceiptEligible, true);
  assert.equal(result.governance.automaticTaskCompletion, false);
  assert.equal(result.governance.requiresOperatorAcceptance, true);
  assert.equal(calls.assessment.length, 1);
  assert.deepEqual(calls.assessment[0].expectedTaskBinding, {
    taskId: TASK_ID,
    objectiveContentHash: "a".repeat(64),
    taskVersionHash: "b".repeat(64),
  });
  assert.deepEqual(calls.order, [
    "step:1",
    "audit:ai_workspace.bounded_run_completed",
    "audit:ai_workspace.reviewed_cycle_assessment_authorized",
    "assessment",
    "audit:ai_workspace.reviewed_cycle_completed",
  ]);
});

test("reviewed workspace cycle does not assess fallback or unaudited run evidence", async () => {
  const fallback = stepResult({
    actionId: "no_op",
    status: "local_fallback",
    actionExecuted: false,
  });
  fallback.evidence.taskId = null;
  fallback.evidence.objectiveContentHash = null;
  fallback.evidence.taskVersionHash = null;
  fallback.governance.providerCalled = false;
  const localFallback = harness([fallback]);
  const fallbackResult = await localFallback.coordinator.reviewedCycle.invoke({ taskId: TASK_ID });
  assert.equal(fallbackResult.terminalReason, "run_not_assessable");
  assert.equal(localFallback.calls.assessment.length, 0);

  const unaudited = harness([
    stepResult({ actionId: "no_op", actionExecuted: false }),
  ], { rejectRunCompletionAudit: true });
  const unauditedResult = await unaudited.coordinator.reviewedCycle.invoke({ taskId: TASK_ID });
  assert.equal(unauditedResult.terminalReason, "run_not_assessable");
  assert.equal(unauditedResult.evidence.runCompletionAudit, false);
  assert.equal(unaudited.calls.assessment.length, 0);
});
