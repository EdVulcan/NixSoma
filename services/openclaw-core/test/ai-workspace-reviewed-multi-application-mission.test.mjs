import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiWorkspaceReviewedMultiApplicationMission,
  createAiWorkspaceReviewedMultiApplicationMissionPreflight,
} from "../src/ai-workspace-reviewed-multi-application-mission.mjs";

const TASK_ID = "task-multi-app-1";
const INPUT_TEXT = "MISSION_7";
const TASK_BINDING = {
  taskId: TASK_ID,
  objectiveContentHash: "a".repeat(64),
  taskVersionHash: "b".repeat(64),
};

function expectedInputEvidence(maxChars = 32) {
  return {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: INPUT_TEXT.length,
    byteLength: INPUT_TEXT.length,
    maxChars,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function prepared(overrides = {}) {
  return {
    ok: true,
    taskBinding: TASK_BINDING,
    transientInputText: INPUT_TEXT,
    inputEvidence: expectedInputEvidence(),
    ...overrides,
  };
}

function browserResult(overrides = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-semantic-form-workflow-v0",
    status: "completed",
    steps: [
      { actionId: "type_item", inputEvidence: expectedInputEvidence(200) },
      { actionId: "click_item", inputEvidence: null },
    ],
    evidence: {
      ...TASK_BINDING,
      stepCount: 2,
      providerCallCount: 2,
      providerCallCountMinimum: 2,
      actionCount: 2,
      actionCountMinimum: 2,
      continuationAudit: true,
      workflowCompletionAudit: true,
      taskObjectiveInputBound: true,
      outcomeUnknown: false,
    },
    governance: { taskObjectiveInputBound: true },
    ...overrides,
  };
}

function nativeResult(overrides = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-native-intake-workflow-v0",
    status: "completed",
    typeStep: {
      actionId: "type_text",
      inputEvidence: expectedInputEvidence(),
      expectedSurfaceBound: true,
    },
    evidence: {
      ...TASK_BINDING,
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
    governance: { taskObjectiveBound: true },
    ...overrides,
  };
}

function harness({
  preparations = [prepared(), prepared()],
  browser = browserResult(),
  native = nativeResult(),
  rejectContinuationAudit = false,
} = {}) {
  const queue = [...preparations];
  const calls = { order: [], browser: [], native: [], audit: [] };
  const mission = createAiWorkspaceReviewedMultiApplicationMission({
    prepare: async () => {
      calls.order.push("prepare");
      return queue.shift();
    },
    invokeBrowserWorkflow: async (input) => {
      calls.order.push("browser");
      calls.browser.push(input);
      if (browser instanceof Error) throw browser;
      return browser;
    },
    invokeNativeWorkflow: async (input) => {
      calls.order.push("native");
      calls.native.push(input);
      if (native instanceof Error) throw native;
      return native;
    },
    publishAuditEvent: async (name, payload) => {
      calls.order.push(`audit:${name}`);
      calls.audit.push({ name, payload });
      return {
        ok: !(rejectContinuationAudit
          && name === "ai_workspace.reviewed_multi_application_continuation_authorized"),
      };
    },
    now: () => "2026-08-04T09:00:00.000Z",
  });
  return { calls, mission };
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
      aiGraphicalSession: {
        nativeIntakeLifecycle: {
          registry: "nixsoma-ai-native-intake-lifecycle-v0",
          unitName: "nixsoma-ai-native-intake.service",
          enabled: true,
          status: "stopped",
          active: false,
          surfaceAttached: false,
          matchingSurface: null,
        },
      },
    },
  };
}

function reviewedTask() {
  return {
    id: TASK_ID,
    goal: `Enter exact text "${INPUT_TEXT}" in the current browser form, submit it, then type it into the fixed native intake`,
    status: "running",
    updatedAt: "2026-08-04T08:59:00.000Z",
    policy: { decision: { decision: "allow" } },
    workView: {
      workViewId: "work-view-primary",
      sessionId: "session-current",
      trustedBinding: {
        registry: "openclaw-native-engineering-work-view-bind-v0",
        mode: "operator_reviewed",
        authorityStatus: "authoritative",
        leaseMatched: true,
        boundAt: "2026-08-04T08:58:00.000Z",
      },
    },
  };
}

test("multi-application preflight requires one current exact-input task and stopped native app", async () => {
  const task = reviewedTask();
  const state = workViewState();
  const prepare = createAiWorkspaceReviewedMultiApplicationMissionPreflight({
    fetchJson: async () => state,
    sessionManagerUrl: "http://127.0.0.1:4102",
    getTaskById: () => task,
  });

  const result = await prepare({ taskId: TASK_ID });
  assert.equal(result.ok, true);
  assert.equal(result.transientInputText, INPUT_TEXT);
  assert.deepEqual(result.inputEvidence, expectedInputEvidence());
  assert.equal(JSON.stringify(result.taskBinding).includes(INPUT_TEXT), false);

  task.goal = "Complete the current form";
  assert.equal((await prepare({ taskId: TASK_ID })).reason,
    "mission_exact_input_objective_required");
  task.goal = `Enter exact text "${INPUT_TEXT}" in the current browser form, submit it, then type it into the fixed native intake`;
  state.workView.aiGraphicalSession.nativeIntakeLifecycle.status = "running";
  state.workView.aiGraphicalSession.nativeIntakeLifecycle.active = true;
  assert.equal((await prepare({ taskId: TASK_ID })).reason,
    "mission_native_intake_not_stopped");
});

test("reviewed multi-application mission verifies browser then native under one task", async () => {
  const { calls, mission } = harness();
  const result = await mission.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.terminalReason, "verified_browser_then_native_intake");
  assert.deepEqual(result.applications.map((item) => item.applicationId), [
    "fixed_browser_form",
    "fixed_native_intake",
  ]);
  assert.deepEqual(calls.browser, [{
    taskId: TASK_ID,
    expectedTaskBinding: TASK_BINDING,
    expectedInputText: INPUT_TEXT,
  }]);
  assert.deepEqual(calls.native, [{
    taskId: TASK_ID,
    expectedTaskBinding: TASK_BINDING,
    expectedInputText: INPUT_TEXT,
  }]);
  assert.equal(result.evidence.providerCallCount, 3);
  assert.equal(result.evidence.actionCount, 3);
  assert.equal(result.evidence.lifecycleActionCount, 2);
  assert.equal(result.evidence.fixedActionCount, 5);
  assert.equal(result.evidence.continuationAudit, true);
  assert.equal(result.evidence.missionCompletionAudit, true);
  assert.equal(result.governance.sameReviewedTaskAcrossApplications, true);
  assert.equal(result.governance.sameExactObjectiveInputAcrossApplications, true);
  assert.deepEqual(calls.order, [
    "prepare",
    "browser",
    "prepare",
    "audit:ai_workspace.reviewed_multi_application_continuation_authorized",
    "native",
    "audit:ai_workspace.reviewed_multi_application_mission_completed",
  ]);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(INPUT_TEXT), false);
});

test("reviewed multi-application mission stops before native on browser failure or drift", async () => {
  const stopped = harness({
    browser: browserResult({
      ok: false,
      status: "stopped_after_type",
      steps: [{ actionId: "type_item", inputEvidence: expectedInputEvidence(200) }],
      evidence: {
        ...TASK_BINDING,
        stepCount: 1,
        providerCallCount: 1,
        providerCallCountMinimum: 1,
        actionCount: 1,
        actionCountMinimum: 1,
        continuationAudit: false,
        workflowCompletionAudit: true,
        taskObjectiveInputBound: true,
        outcomeUnknown: false,
      },
    }),
  });
  const stoppedResult = await stopped.mission.invoke({ taskId: TASK_ID });
  assert.equal(stoppedResult.status, "stopped_after_browser");
  assert.equal(stopped.calls.native.length, 0);

  const drift = harness({
    preparations: [
      prepared(),
      prepared({
        taskBinding: { ...TASK_BINDING, taskVersionHash: "c".repeat(64) },
      }),
    ],
  });
  const driftResult = await drift.mission.invoke({ taskId: TASK_ID });
  assert.equal(driftResult.terminalReason,
    "multi_application_mission_precondition_changed");
  assert.equal(drift.calls.native.length, 0);
});

test("reviewed multi-application mission never retries an unknown native outcome", async () => {
  const { calls, mission } = harness({ native: new Error("transport unknown") });
  const result = await mission.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "native_outcome_unknown");
  assert.equal(result.evidence.providerCallCount, null);
  assert.equal(result.evidence.providerCallCountMinimum, 2);
  assert.equal(result.evidence.actionCount, null);
  assert.equal(result.evidence.actionCountMinimum, 2);
  assert.equal(result.governance.automaticRepeat, false);
  assert.equal(result.governance.retry, false);
  assert.equal(calls.native.length, 1);
});

test("reviewed multi-application mission requires durable cross-application continuation", async () => {
  const { calls, mission } = harness({ rejectContinuationAudit: true });
  const result = await mission.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "stopped_after_browser");
  assert.equal(result.terminalReason, "multi_application_continuation_audit_unavailable");
  assert.equal(result.evidence.continuationAudit, false);
  assert.equal(calls.native.length, 0);
});
