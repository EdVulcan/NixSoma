import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkspaceReviewedCycleCapabilityHandlers } from
  "../src/capability-runtime-ai-workspace-reviewed-cycle.mjs";

const capability = { id: "act.ai.workspace.reviewed_cycle" };

function result() {
  const assessment = {
    ok: true,
    status: "assessed",
    assessment: { outcome: "complete", confidence: 0.9 },
    evidence: {
      taskId: "task-1",
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      contextContentHash: "c".repeat(64),
      requestContentHash: "d".repeat(64),
      responseContentHash: "e".repeat(64),
      sceneContentHash: "f".repeat(64),
      sceneItemCount: 4,
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
    },
  };
  return {
    ok: true,
    status: "assessed",
    terminalReason: "assessment_terminal",
    run: {
      status: "stopped_after_first",
      terminalReason: "first_step_no_op",
      steps: [{
        index: 1,
        registry: "nixsoma-ai-workspace-single-step-v0",
        status: "executed",
        actionId: "no_op",
        providerCalled: true,
        actionExecuted: false,
        completionAudit: true,
        sceneContentHash: "f".repeat(64),
      }],
      evidence: {
        stepCount: 1,
        providerCallCount: 1,
        providerCallCountMinimum: 1,
        actionCount: 0,
        actionCountMinimum: 0,
        continuationAudit: false,
        runCompletionAudit: true,
        outcomeUnknown: false,
      },
    },
    assessment,
    evidence: {
      taskId: "task-1",
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      providerCallCount: 2,
      providerCallCountMinimum: 2,
      actionCount: 0,
      actionCountMinimum: 0,
      runCompletionAudit: true,
      assessmentContinuationAudit: true,
      assessmentCompletionAudit: true,
      cycleCompletionAudit: true,
      assessmentReceiptEligible: true,
      outcomeUnknown: false,
    },
    governance: {
      taskMutated: false,
      automaticTaskCompletion: false,
      requiresOperatorAcceptance: true,
      providerTriggeredCompletion: false,
    },
  };
}

test("reviewed-cycle capability authorizes one fixed task request and stores a compact receipt", async () => {
  let invoked = 0;
  const handlers = createAiWorkspaceReviewedCycleCapabilityHandlers({
    runtime: {
      invoke: async ({ taskId }) => {
        invoked += 1;
        assert.equal(taskId, "task-1");
        return result();
      },
    },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true },
  };
  const body = { capabilityId: capability.id, taskId: request.taskId, params: request.params };

  const authorization = handlers.authorizeRequest(capability, request, body);
  assert.equal(authorization.authorization.approved, true);
  assert.equal(authorization.authorization.policyId, "ai-workspace-explicit-reviewed-cycle");
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.equal(invoked, 1);
  assert.equal(summary.kind, "ai.workspace.reviewed_cycle");
  assert.equal(summary.assessment.outcome, "complete");
  assert.equal(summary.assessmentReceiptEligible, true);
  assert.equal(summary.automaticTaskCompletion, false);
  assert.equal(JSON.stringify(summary).includes("private provider reason"), false);
});

test("reviewed-cycle capability rejects caller-controlled cycle fields", () => {
  const handlers = createAiWorkspaceReviewedCycleCapabilityHandlers({
    runtime: { invoke: async () => result() },
  });
  const request = {
    taskId: "task-1",
    stepId: null,
    operation: null,
    intent: null,
    params: { confirm: true, maximumProviderCalls: 7 },
  };
  assert.match(handlers.validateRequest(capability, request, {
    capabilityId: capability.id,
    taskId: request.taskId,
    params: request.params,
  }), /accepts only/u);
});
