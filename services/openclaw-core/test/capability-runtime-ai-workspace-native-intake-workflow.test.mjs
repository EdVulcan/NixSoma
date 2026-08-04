import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_CAPABILITY_ID,
  createAiWorkspaceNativeIntakeWorkflowCapabilityHandlers,
} from "../src/capability-runtime-ai-workspace-native-intake-workflow.mjs";

const capability = { id: AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_CAPABILITY_ID };
const body = {
  capabilityId: AI_WORKSPACE_NATIVE_INTAKE_WORKFLOW_CAPABILITY_ID,
  taskId: "task-native-intake-1",
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

test("native intake capability accepts only one exact task-bound workflow request", async () => {
  const calls = [];
  const handlers = createAiWorkspaceNativeIntakeWorkflowCapabilityHandlers({
    runtime: {
      invoke: async (input) => {
        calls.push(input);
        return {
          ok: true,
          status: "completed",
          terminalReason: "verified_native_intake_type",
          application: {
            started: {
              registry: "nixsoma-ai-native-intake-lifecycle-v0",
              unitName: "nixsoma-ai-native-intake.service",
              status: "running",
              active: true,
              surfaceAttached: true,
              surfaceId: 81,
              inventorySequence: 8,
              activated: true,
            },
            stopped: {
              registry: "nixsoma-ai-native-intake-lifecycle-v0",
              unitName: "nixsoma-ai-native-intake.service",
              status: "stopped",
              active: false,
              surfaceAttached: false,
            },
          },
          typeStep: {
            status: "executed",
            actionId: "type_text",
            inputEvidence: {
              registry: "openclaw-write-only-input-evidence-v0",
              charCount: 7,
              byteLength: 7,
              maxChars: 32,
              textExposed: false,
              persisted: false,
            },
            providerCalled: true,
            actionExecuted: true,
            postActionVerified: true,
            completionAudit: true,
            expectedSurfaceBound: true,
          },
          evidence: {
            taskId: input.taskId,
            providerCallCount: 1,
            providerCallCountMinimum: 1,
            actionCount: 1,
            actionCountMinimum: 1,
            lifecycleActionCount: 2,
            lifecycleActionCountMinimum: 2,
            lifecycleStartVerified: true,
            lifecycleStopVerified: true,
            workflowCompletionAudit: true,
            outcomeUnknown: false,
          },
          governance: {
            exactFixedApplication: true,
            currentActiveSurfaceBound: true,
          },
        };
      },
    },
  });

  const authorization = handlers.authorizeRequest(capability, request, body).authorization;
  assert.equal(authorization.approved, true);
  assert.equal(authorization.policyId, "ai-workspace-explicit-native-intake-workflow");
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.deepEqual(calls, [{ taskId: body.taskId }]);
  assert.equal(summary.kind, "ai.workspace.native_intake_workflow");
  assert.equal(summary.providerCallCount, 1);
  assert.equal(summary.actionCount, 1);
  assert.equal(summary.lifecycleActionCount, 2);
  assert.equal(summary.lifecycleStartVerified, true);
  assert.equal(summary.lifecycleStopVerified, true);
  assert.equal(summary.typeStep.inputEvidence.textExposed, false);
  assert.equal(summary.arbitraryProcessLaunch, false);
  assert.equal(summary.inputTextPersisted, false);

  const widened = { ...body, params: { confirm: true, unit: "arbitrary.service" } };
  const widenedRequest = { ...request, params: widened.params };
  assert.equal(
    handlers.authorizeRequest(capability, widenedRequest, widened).authorization.approved,
    false,
  );
  assert.match(handlers.validateRequest(capability, widenedRequest, widened), /accepts only/u);
});
