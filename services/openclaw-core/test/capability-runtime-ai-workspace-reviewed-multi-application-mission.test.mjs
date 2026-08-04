import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_CAPABILITY_ID,
  createAiWorkspaceReviewedMultiApplicationMissionCapabilityHandlers,
} from "../src/capability-runtime-ai-workspace-reviewed-multi-application-mission.mjs";

const capability = {
  id: AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_CAPABILITY_ID,
};
const body = {
  capabilityId: capability.id,
  taskId: "task-multi-app-1",
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

test("multi-application mission capability accepts only one exact reviewed task request", async () => {
  const calls = [];
  const handlers = createAiWorkspaceReviewedMultiApplicationMissionCapabilityHandlers({
    runtime: {
      invoke: async (input) => {
        calls.push(input);
        return {
          ok: true,
          status: "completed",
          terminalReason: "verified_browser_then_native_intake",
          applications: [
            {
              applicationId: "fixed_browser_form",
              registry: "nixsoma-ai-workspace-semantic-form-workflow-v0",
              status: "completed",
              stepCount: 2,
              actionSequence: ["type_item", "click_item"],
              providerCallCount: 2,
              providerCallCountMinimum: 2,
              actionCount: 2,
              actionCountMinimum: 2,
              lifecycleActionCount: 0,
              lifecycleActionCountMinimum: 0,
              continuationAudit: true,
              completionAudit: true,
              exactInputMatched: true,
              verified: true,
              outcomeUnknown: false,
            },
            {
              applicationId: "fixed_native_intake",
              registry: "nixsoma-ai-workspace-native-intake-workflow-v0",
              status: "completed",
              stepCount: 1,
              actionSequence: ["type_text"],
              providerCallCount: 1,
              providerCallCountMinimum: 1,
              actionCount: 1,
              actionCountMinimum: 1,
              lifecycleActionCount: 2,
              lifecycleActionCountMinimum: 2,
              completionAudit: true,
              exactInputMatched: true,
              lifecycleStartVerified: true,
              lifecycleStopVerified: true,
              verified: true,
              outcomeUnknown: false,
            },
          ],
          evidence: {
            taskId: input.taskId,
            objectiveContentHash: "a".repeat(64),
            taskVersionHash: "b".repeat(64),
            inputEvidence: {
              registry: "openclaw-write-only-input-evidence-v0",
              charCount: 9,
              byteLength: 9,
              maxChars: 32,
              truncated: false,
              textExposed: false,
              persisted: false,
            },
            applicationCount: 2,
            providerCallCount: 3,
            providerCallCountMinimum: 3,
            actionCount: 3,
            actionCountMinimum: 3,
            lifecycleActionCount: 2,
            lifecycleActionCountMinimum: 2,
            fixedActionCount: 5,
            fixedActionCountMinimum: 5,
            continuationAudit: true,
            missionCompletionAudit: true,
            outcomeUnknown: false,
          },
          governance: {
            continuedToNativeApplication: true,
            sameReviewedTaskAcrossApplications: true,
            sameExactObjectiveInputAcrossApplications: true,
          },
        };
      },
    },
  });

  const authorization = handlers.authorizeRequest(capability, request, body).authorization;
  assert.equal(authorization.approved, true);
  assert.equal(authorization.policyId,
    "ai-workspace-explicit-reviewed-multi-application-mission");
  assert.equal(handlers.validateRequest(capability, request, body), null);
  const backend = await handlers.callBackend(capability, request);
  const summary = handlers.summariseResult(capability, backend.result);

  assert.deepEqual(calls, [{ taskId: body.taskId }]);
  assert.equal(summary.kind, "ai.workspace.reviewed_multi_application_mission");
  assert.equal(summary.applicationCount, 2);
  assert.equal(summary.providerCallCount, 3);
  assert.equal(summary.actionCount, 3);
  assert.equal(summary.lifecycleActionCount, 2);
  assert.equal(summary.fixedActionCount, 5);
  assert.deepEqual(summary.fixedApplicationOrder, [
    "fixed_browser_form",
    "fixed_native_intake",
  ]);
  assert.equal(summary.inputEvidence.textExposed, false);
  assert.equal(summary.arbitraryApplicationSelection, false);
  assert.equal(summary.inputTextPersisted, false);

  const widened = { ...body, params: { confirm: true, order: ["native", "browser"] } };
  const widenedRequest = { ...request, params: widened.params };
  assert.equal(
    handlers.authorizeRequest(capability, widenedRequest, widened).authorization.approved,
    false,
  );
  assert.match(handlers.validateRequest(capability, widenedRequest, widened), /accepts only/u);
});
