import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiWorkspaceSemanticFormWorkflow,
} from "../src/ai-workspace-semantic-form-workflow.mjs";

const taskBinding = {
  taskId: "task-form-1",
  objectiveContentHash: "a".repeat(64),
  taskVersionHash: "b".repeat(64),
};
const inputEvidence = {
  registry: "openclaw-write-only-input-evidence-v0",
  charCount: 7,
  byteLength: 7,
  maxChars: 80,
  truncated: false,
  textExposed: false,
  persisted: false,
};

function typeResult(overrides = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-single-step-v0",
    status: "executed",
    decision: { actionId: "type_item", itemOrdinal: 1, inputEvidence },
    action: { actionId: "type_item", itemOrdinal: 1, inputEvidence, executed: true },
    evidence: {
      ...taskBinding,
      responseContentHash: "c".repeat(64),
      sceneContentHash: "d".repeat(64),
      inputEvidence,
      postActionVerified: true,
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      actionExecuted: true,
      semanticSceneBound: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      semanticItemOrdinalBound: true,
      currentBrowserSurfaceBound: true,
      taskObjectiveBound: true,
      keyboardInput: true,
      providerGeneratedInput: true,
    },
    ...overrides,
  };
}

function submitResult(overrides = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-single-step-v0",
    status: "executed",
    decision: { actionId: "click_item", itemOrdinal: 2, inputEvidence: null },
    action: { actionId: "click_item", itemOrdinal: 2, executed: true },
    evidence: {
      ...taskBinding,
      responseContentHash: "e".repeat(64),
      sceneContentHash: "f".repeat(64),
      postActionVerified: true,
      completionAudit: true,
    },
    governance: {
      providerCalled: true,
      actionExecuted: true,
      semanticSceneBound: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      semanticItemOrdinalBound: true,
      currentBrowserSurfaceBound: true,
      taskObjectiveBound: true,
      semanticSubmitTargetBound: true,
      keyboardInput: false,
    },
    ...overrides,
  };
}

test("semantic form workflow continues only from exact verified type evidence", async () => {
  const audits = [];
  let submitInput = null;
  const workflow = createAiWorkspaceSemanticFormWorkflow({
    invokeType: async () => typeResult(),
    invokeSubmit: async (input) => {
      submitInput = input;
      return submitResult();
    },
    publishAuditEvent: async (name, payload) => {
      audits.push({ name, payload });
      return { ok: true };
    },
    now: () => "2026-08-04T06:00:00.000Z",
  });

  const result = await workflow.invoke({ taskId: taskBinding.taskId });
  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.terminalReason, "verified_type_then_submit");
  assert.deepEqual(submitInput.expectedTaskBinding, taskBinding);
  assert.deepEqual(result.steps.map((step) => step.actionId), ["type_item", "click_item"]);
  assert.equal(result.steps[0].inputEvidence.charCount, 7);
  assert.equal(JSON.stringify(result).includes("bounded value"), false);
  assert.equal(result.evidence.providerCallCount, 2);
  assert.equal(result.evidence.actionCount, 2);
  assert.equal(result.evidence.continuationAudit, true);
  assert.equal(result.evidence.workflowCompletionAudit, true);
  assert.equal(result.governance.continuationAfterVerifiedTypeOnly, true);
  assert.equal(result.governance.boundedAutomaticContinuation, true);
  assert.equal(result.governance.automaticTaskCompletion, false);
  assert.deepEqual(audits.map(({ name }) => name), [
    "ai_workspace.semantic_form_continuation_authorized",
    "ai_workspace.semantic_form_workflow_completed",
  ]);
});

test("semantic form workflow carries one exact input only into its type step", async () => {
  let typeInput = null;
  let submitInput = null;
  const workflow = createAiWorkspaceSemanticFormWorkflow({
    invokeType: async (input) => {
      typeInput = input;
      return typeResult({
        governance: {
          ...typeResult().governance,
          taskObjectiveInputBound: true,
        },
      });
    },
    invokeSubmit: async (input) => {
      submitInput = input;
      return submitResult();
    },
  });

  const result = await workflow.invoke({
    taskId: taskBinding.taskId,
    expectedTaskBinding: taskBinding,
    expectedInputText: "private exact value",
  });
  assert.equal(result.ok, true);
  assert.equal(typeInput.expectedInputText, "private exact value");
  assert.equal("expectedInputText" in submitInput, false);
  assert.equal(result.evidence.taskObjectiveInputBound, true);
  assert.equal(result.governance.taskObjectiveInputBound, true);
  assert.equal(JSON.stringify(result).includes("private exact value"), false);
});

test("semantic form workflow stops before submit when type evidence is unverified", async () => {
  let submitCalls = 0;
  const workflow = createAiWorkspaceSemanticFormWorkflow({
    invokeType: async () => typeResult({
      evidence: {
        ...typeResult().evidence,
        postActionVerified: false,
      },
    }),
    invokeSubmit: async () => {
      submitCalls += 1;
      return submitResult();
    },
  });

  const result = await workflow.invoke({ taskId: taskBinding.taskId });
  assert.equal(result.ok, false);
  assert.equal(result.status, "stopped_after_type");
  assert.equal(result.terminalReason, "type_step_not_verified");
  assert.equal(result.steps.length, 1);
  assert.equal(result.evidence.actionCount, 1);
  assert.equal(result.governance.continuedAfterVerifiedType, false);
  assert.equal(submitCalls, 0);

  const incompleteBinding = createAiWorkspaceSemanticFormWorkflow({
    invokeType: async () => typeResult({
      evidence: {
        ...typeResult().evidence,
        responseContentHash: null,
      },
    }),
    invokeSubmit: async () => {
      submitCalls += 1;
      return submitResult();
    },
  });
  const incomplete = await incompleteBinding.invoke({ taskId: taskBinding.taskId });
  assert.equal(incomplete.status, "stopped_after_type");
  assert.equal(incomplete.terminalReason, "type_step_not_verified");
  assert.equal(submitCalls, 0);
});

test("semantic form workflow never retries an unknown submit outcome", async () => {
  let submitCalls = 0;
  const workflow = createAiWorkspaceSemanticFormWorkflow({
    invokeType: async () => typeResult(),
    invokeSubmit: async () => {
      submitCalls += 1;
      throw new Error("transport outcome unknown");
    },
  });

  const result = await workflow.invoke({ taskId: taskBinding.taskId });
  assert.equal(result.ok, false);
  assert.equal(result.status, "submit_step_outcome_unknown");
  assert.equal(result.evidence.outcomeUnknown, true);
  assert.equal(result.evidence.providerCallCount, null);
  assert.equal(result.evidence.providerCallCountMinimum, 1);
  assert.equal(result.governance.automaticRepeat, false);
  assert.equal(submitCalls, 1);
});
