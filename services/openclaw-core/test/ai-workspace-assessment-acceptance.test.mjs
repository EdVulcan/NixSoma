import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_CAPABILITY_ID,
  createAiWorkspaceAssessmentAcceptanceCapabilityHandlers,
} from "../src/capability-runtime-ai-workspace-assessment-acceptance.mjs";
import { buildAiWorkspaceTaskObjectiveBinding } from "../src/ai-workspace-task-objective.mjs";

const TASK_ID = "task-reviewed-1";
const NOW = "2026-07-29T04:00:00.000Z";

function task() {
  return {
    id: TASK_ID,
    goal: "Confirm the visible completion marker",
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

function createHarness({ outcome = "complete", auditOk = true, mutateDuringAudit = false } = {}) {
  const currentTask = task();
  const currentWorkView = workViewState();
  const binding = buildAiWorkspaceTaskObjectiveBinding({
    task: currentTask,
    taskId: TASK_ID,
    workViewState: currentWorkView,
    maximumActions: 0,
  });
  const hashes = {
    objectiveContentHash: binding.evidence.objectiveContentHash,
    taskVersionHash: binding.evidence.taskVersionHash,
    responseContentHash: "a".repeat(64),
    sceneContentHash: "b".repeat(64),
  };
  const invocation = {
    id: "assessment-invocation-1",
    capability: { id: "sense.ai.workspace.assessment" },
    request: { taskId: TASK_ID },
    authorization: {
      policyId: "ai-workspace-explicit-task-assessment",
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
      kind: "ai.workspace.assessment",
      status: "assessed",
      outcome,
      confidence: 0.9,
      taskId: TASK_ID,
      ...hashes,
      completionAudit: true,
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
  const calls = [];
  const handlers = createAiWorkspaceAssessmentAcceptanceCapabilityHandlers({
    capabilityInvocationLog: [invocation],
    taskManager: {
      getTaskById: () => currentTask,
      completeTask: (value, details) => {
        calls.push({ name: "complete", details });
        value.status = "completed";
        value.updatedAt = "2026-07-29T04:00:01.000Z";
        value.closedAt = value.updatedAt;
        value.outcome = { kind: "completed", details };
        return value;
      },
      serialiseTask: (value) => ({
        id: value.id,
        status: value.status,
        outcome: value.outcome,
      }),
    },
    readWorkViewState: async () => currentWorkView,
    publishAuditEvent: async (name, payload) => {
      calls.push({ name, payload });
      if (mutateDuringAudit) currentTask.updatedAt = "2026-07-29T04:00:02.000Z";
      return { ok: auditOk };
    },
    publishEvent: async (name, payload) => {
      calls.push({ name, payload });
    },
    now: () => "2026-07-29T04:00:00.500Z",
  });
  const request = {
    taskId: TASK_ID,
    stepId: null,
    operation: null,
    intent: null,
    params: {
      confirm: true,
      assessmentInvocationId: invocation.id,
      ...hashes,
    },
  };
  const body = {
    capabilityId: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_CAPABILITY_ID,
    taskId: TASK_ID,
    params: request.params,
  };
  return { handlers, currentTask, calls, request, body };
}

const capability = { id: AI_WORKSPACE_ASSESSMENT_ACCEPTANCE_CAPABILITY_ID };

test("assessment acceptance requires only the exact receipt contract", () => {
  const { handlers, request, body } = createHarness();
  assert.equal(handlers.validateRequest(capability, request, body), null);
  assert.match(
    handlers.validateRequest(capability, {
      ...request,
      params: { ...request.params, reason: "caller controlled" },
    }, body),
    /requires only taskId/u,
  );
});

test("assessment acceptance audits before the existing task owner completes", async () => {
  const { handlers, currentTask, calls, request } = createHarness();
  const response = await handlers.callBackend(capability, request);

  assert.equal(response.handled, true);
  assert.equal(response.result.status, "accepted");
  assert.equal(response.result.task.status, "completed");
  assert.equal(response.result.evidence.requiredAudit, true);
  assert.equal(response.result.governance.providerTriggeredCompletion, false);
  assert.equal(currentTask.outcome.details.assessmentAcceptance.outcome, "complete");
  assert.equal(JSON.stringify(currentTask).includes("provider reason"), false);
  assert.deepEqual(calls.map((call) => call.name), [
    "ai_workspace.assessment_acceptance_authorized",
    "complete",
    "task.completed",
  ]);
});

test("assessment acceptance rejects non-complete and stale receipts without mutation", async () => {
  const nonComplete = createHarness({ outcome: "incomplete" });
  const nonCompleteResponse = await nonComplete.handlers.callBackend(capability, nonComplete.request);
  assert.equal(nonCompleteResponse.result.reason, "assessment_receipt_invalid");
  assert.equal(nonComplete.currentTask.status, "running");
  assert.equal(nonComplete.calls.length, 0);

  const stale = createHarness();
  stale.currentTask.updatedAt = "2026-07-29T04:00:03.000Z";
  const staleResponse = await stale.handlers.callBackend(capability, stale.request);
  assert.equal(staleResponse.result.reason, "task_version_changed");
  assert.equal(stale.currentTask.status, "running");
  assert.equal(stale.calls.length, 0);
});

test("assessment acceptance stops before mutation when required audit fails", async () => {
  const { handlers, currentTask, calls, request } = createHarness({ auditOk: false });
  await assert.rejects(
    handlers.callBackend(capability, request),
    /acceptance audit was not accepted/u,
  );
  assert.equal(currentTask.status, "running");
  assert.equal(calls.some((call) => call.name === "complete"), false);
});

test("assessment acceptance rechecks the task version after audit", async () => {
  const { handlers, currentTask, calls, request } = createHarness({ mutateDuringAudit: true });
  const response = await handlers.callBackend(capability, request);
  assert.equal(response.result.reason, "task_version_changed_after_audit");
  assert.equal(response.result.evidence.requiredAudit, true);
  assert.equal(currentTask.status, "running");
  assert.equal(calls.some((call) => call.name === "complete"), false);
});
