import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID,
  createAiWorkspaceSemanticSubmitCapabilityHandlers,
} from "../src/capability-runtime-ai-workspace-semantic-submit.mjs";
import { buildAiWorkspaceTaskObjectiveBinding } from "../src/ai-workspace-task-objective.mjs";

const TASK_ID = "task-reviewed-submit-1";
const TYPE_INVOCATION_ID = "type-invocation-1";
const NOW = "2026-07-31T08:30:00.000Z";

function task() {
  return {
    id: TASK_ID,
    goal: "Type the customer name and submit the form",
    status: "running",
    updatedAt: NOW,
    policy: { decision: { decision: "allow" } },
    workView: {
      workViewId: "work-view-primary",
      sessionId: "session-current",
      trustedBinding: {
        registry: "openclaw-native-engineering-work-view-bind-v0",
        mode: "operator_reviewed",
        authorityStatus: "authoritative",
        leaseMatched: true,
        boundAt: NOW,
      },
    },
  };
}

function workViewState() {
  return {
    session: {
      sessionId: "session-current",
      status: "running",
      role: "ai-work-view",
    },
    workView: {
      workViewId: "work-view-primary",
      status: "prepared",
      trustedSession: {
        sessionIdentity: { status: "authoritative" },
        helperRuntime: {
          status: "active",
          actionAuthority: "active",
          leaseMatched: true,
        },
      },
    },
  };
}

function createHarness({
  postActionVerified = true,
  laterAction = false,
  runtimeThrows = false,
  priorSemanticSubmitSummaries = [],
} = {}) {
  const currentTask = task();
  const currentWorkView = workViewState();
  const binding = buildAiWorkspaceTaskObjectiveBinding({
    task: currentTask,
    taskId: TASK_ID,
    workViewState: currentWorkView,
  });
  const hashes = {
    objectiveContentHash: binding.evidence.objectiveContentHash,
    taskVersionHash: binding.evidence.taskVersionHash,
    responseContentHash: "a".repeat(64),
    sceneContentHash: "b".repeat(64),
  };
  const inputEvidence = {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 12,
    byteLength: 12,
    maxChars: 200,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
  const invocation = {
    id: TYPE_INVOCATION_ID,
    at: "2026-07-31T08:29:30.000Z",
    capability: { id: "act.ai.workspace.single_step" },
    request: { taskId: TASK_ID },
    authorization: {
      policyId: "ai-workspace-explicit-single-step",
      approved: true,
    },
    policy: {
      decision: "audit_only",
      domain: "cross_boundary",
      approved: true,
    },
    invoked: true,
    blocked: false,
    summary: {
      kind: "ai.workspace.single_step",
      ok: true,
      status: "executed",
      actionId: "type_item",
      taskId: TASK_ID,
      ...hashes,
      inputEvidence,
      providerCalled: true,
      actionExecuted: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      semanticSceneBound: true,
      currentBrowserSurfaceBound: true,
      taskObjectiveBound: true,
      postActionVerified,
      completionAudit: true,
      providerGeneratedInput: true,
      inputTextPersisted: false,
      keyboardInput: true,
    },
  };
  const capabilityInvocationLog = [invocation];
  if (laterAction) {
    const semanticFormWorkflow = laterAction === "semantic_form_workflow";
    capabilityInvocationLog.push({
      id: "later-action",
      capability: {
        id: semanticFormWorkflow
          ? "act.ai.workspace.semantic_form_workflow"
          : "act.ai.workspace.single_step",
      },
      request: { taskId: TASK_ID },
      summary: semanticFormWorkflow
        ? { actionCountMinimum: 1 }
        : { actionExecuted: true },
    });
  }
  for (const [index, summary] of priorSemanticSubmitSummaries.entries()) {
    capabilityInvocationLog.push({
      id: `semantic-submit-${index + 1}`,
      capability: { id: AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID },
      request: { taskId: TASK_ID },
      summary,
    });
  }
  const calls = [];
  const handlers = createAiWorkspaceSemanticSubmitCapabilityHandlers({
    runtime: {
      invoke: async (input) => {
        calls.push({ name: "runtime", input });
        if (runtimeThrows) throw new Error("runtime unavailable");
        return {
          ok: true,
          registry: "nixsoma-ai-workspace-single-step-v0",
          status: "executed",
          decision: { actionId: "click_item", itemOrdinal: 2 },
          action: { actionId: "click_item", itemOrdinal: 2, executed: true },
          evidence: {
            responseContentHash: "c".repeat(64),
            sceneContentHash: "d".repeat(64),
            postActionVerified: true,
            completionAudit: true,
          },
          governance: {
            providerCalled: true,
            actionExecuted: true,
            semanticSubmitTargetBound: true,
          },
        };
      },
    },
    capabilityInvocationLog,
    taskManager: { getTaskById: () => currentTask },
    readWorkViewState: async () => currentWorkView,
    publishAuditEvent: async (name, payload) => {
      calls.push({ name, payload });
      return { ok: true };
    },
    now: () => NOW,
  });
  const request = {
    taskId: TASK_ID,
    stepId: null,
    operation: null,
    intent: null,
    params: {
      confirm: true,
      typeInvocationId: TYPE_INVOCATION_ID,
      ...hashes,
    },
  };
  const body = {
    capabilityId: AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID,
    taskId: TASK_ID,
    params: request.params,
  };
  return { handlers, request, body, calls };
}

const capability = { id: AI_WORKSPACE_SEMANTIC_SUBMIT_CAPABILITY_ID };

test("semantic submit accepts only the exact type receipt contract", () => {
  const { handlers, request, body } = createHarness();
  assert.equal(handlers.validateRequest(capability, request, body), null);
  assert.match(
    handlers.validateRequest(capability, {
      ...request,
      params: { ...request.params, itemOrdinal: 2 },
    }, body),
    /requires only taskId/u,
  );
});

test("semantic submit binds one verified type receipt to one constrained runtime call", async () => {
  const { handlers, request, calls } = createHarness();
  const response = await handlers.callBackend(capability, request);

  assert.equal(response.handled, true);
  assert.equal(response.result.status, "executed");
  assert.equal(response.result.action.actionId, "click_item");
  assert.equal(response.result.evidence.typeInvocationId, TYPE_INVOCATION_ID);
  assert.equal(response.result.evidence.priorTypeReceiptBound, true);
  assert.equal(response.result.governance.semanticSubmitTargetBound, true);
  assert.equal(response.result.governance.automaticTaskCompletion, false);
  assert.equal(JSON.stringify(response.result).includes("customer name"), false);
  assert.deepEqual(calls.map((call) => call.name), [
    "ai_workspace.semantic_submit_authorized",
    "runtime",
  ]);
  assert.deepEqual(calls[1].input.expectedTaskBinding, {
    taskId: TASK_ID,
    objectiveContentHash: request.params.objectiveContentHash,
    taskVersionHash: request.params.taskVersionHash,
  });

  const replay = await handlers.callBackend(capability, request);
  assert.equal(replay.result.reason, "type_receipt_not_current");
  assert.equal(calls.length, 2);
});

test("semantic submit rejects unverified or superseded type receipts before audit", async () => {
  const unverified = createHarness({ postActionVerified: false });
  const unverifiedResponse = await unverified.handlers.callBackend(capability, unverified.request);
  assert.equal(unverifiedResponse.result.reason, "type_receipt_invalid");
  assert.equal(unverified.calls.length, 0);

  const superseded = createHarness({ laterAction: true });
  const supersededResponse = await superseded.handlers.callBackend(capability, superseded.request);
  assert.equal(supersededResponse.result.reason, "type_receipt_not_current");
  assert.equal(superseded.calls.length, 0);

  const supersededByWorkflow = createHarness({ laterAction: "semantic_form_workflow" });
  const workflowResponse = await supersededByWorkflow.handlers.callBackend(
    capability,
    supersededByWorkflow.request,
  );
  assert.equal(workflowResponse.result.reason, "type_receipt_not_current");
  assert.equal(supersededByWorkflow.calls.length, 0);
});

test("semantic submit does not consume a receipt when an invalid request is durably recorded", async () => {
  const first = createHarness();
  const invalid = await first.handlers.callBackend(capability, {
    ...first.request,
    params: { ...first.request.params, responseContentHash: "f".repeat(64) },
  });
  assert.equal(invalid.result.reason, "type_receipt_invalid");

  const rebuilt = createHarness({
    priorSemanticSubmitSummaries: [
      first.handlers.summariseResult(capability, invalid.result),
    ],
  });
  const response = await rebuilt.handlers.callBackend(capability, rebuilt.request);
  assert.equal(response.result.status, "executed");
  assert.equal(rebuilt.calls.some((call) => call.name === "runtime"), true);
});

test("semantic submit durably consumes an audited receipt when execution fails", async () => {
  const first = createHarness({ runtimeThrows: true });
  const failed = await first.handlers.callBackend(capability, first.request);
  assert.equal(failed.result.reason, "semantic_submit_execution_failed");
  assert.equal(failed.result.evidence.priorTypeReceiptBound, true);
  assert.equal(failed.result.evidence.authorizationAudit, true);

  const rebuilt = createHarness({
    priorSemanticSubmitSummaries: [
      first.handlers.summariseResult(capability, failed.result),
    ],
  });
  const replay = await rebuilt.handlers.callBackend(capability, rebuilt.request);
  assert.equal(replay.result.reason, "type_receipt_not_current");
  assert.equal(rebuilt.calls.length, 0);
});
