import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_CAPABILITY_ID,
  createAiWorkspaceSemanticFormWorkflowCapabilityHandlers,
} from "../src/capability-runtime-ai-workspace-semantic-form-workflow.mjs";

const capability = { id: AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_CAPABILITY_ID };
const body = {
  capabilityId: AI_WORKSPACE_SEMANTIC_FORM_WORKFLOW_CAPABILITY_ID,
  taskId: "task-form-1",
  params: { confirm: true },
};
const request = {
  capabilityId: body.capabilityId,
  taskId: body.taskId,
  stepId: null,
  operation: null,
  intent: null,
  params: body.params,
};

test("semantic form workflow capability enforces one exact task-bound request", async () => {
  const calls = [];
  const handlers = createAiWorkspaceSemanticFormWorkflowCapabilityHandlers({
    runtime: {
      invoke: async (input) => {
        calls.push(input);
        return {
          ok: true,
          status: "completed",
          terminalReason: "verified_type_then_submit",
          steps: [],
          evidence: {
            taskId: input.taskId,
            stepCount: 2,
            providerCallCount: 2,
            providerCallCountMinimum: 2,
            actionCount: 2,
            actionCountMinimum: 2,
            continuationAudit: true,
            workflowCompletionAudit: true,
            outcomeUnknown: false,
          },
          governance: {
            continuationAfterVerifiedTypeOnly: true,
            continuedAfterVerifiedType: true,
            boundedAutomaticContinuation: true,
          },
        };
      },
    },
  });

  const authorization = handlers.authorizeRequest(capability, request, body).authorization;
  assert.equal(authorization.approved, true);
  assert.equal(authorization.policyId, "ai-workspace-explicit-semantic-form-workflow");
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.deepEqual(calls, [{ taskId: body.taskId }]);
  assert.equal(summary.kind, "ai.workspace.semantic_form_workflow");
  assert.equal(summary.providerCallCount, 2);
  assert.equal(summary.actionCount, 2);
  assert.equal(summary.continuationAfterVerifiedTypeOnly, true);
  assert.equal(summary.workflowCompletionAudit, true);
  assert.equal(summary.inputTextExposed, false);
  assert.equal(summary.inputTextPersisted, false);
  assert.equal(summary.automaticTaskCompletion, false);

  const widened = {
    ...body,
    params: { confirm: true, action: "click_item" },
  };
  const widenedRequest = { ...request, params: widened.params };
  assert.equal(
    handlers.authorizeRequest(capability, widenedRequest, widened).authorization.approved,
    false,
  );
  assert.match(
    handlers.validateRequest(capability, widenedRequest, widened),
    /accepts only capabilityId/u,
  );
});
