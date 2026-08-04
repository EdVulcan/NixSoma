import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiWorkspaceNativeIntakeWorkflow,
} from "../src/ai-workspace-native-intake-workflow.mjs";

const TASK_ID = "task-native-intake-1";
const SURFACE_ID = 81;
const INVENTORY_SEQUENCE = 8;

function stoppedApplication() {
  return {
    registry: "nixsoma-ai-native-intake-lifecycle-v0",
    enabled: true,
    unitName: "nixsoma-ai-native-intake.service",
    status: "stopped",
    active: false,
    mainPid: null,
    matchingSurface: null,
    surfaceAttached: false,
    surfaceInventorySequence: 9,
    reused: false,
  };
}

function startedApplication() {
  return {
    registry: "nixsoma-ai-native-intake-lifecycle-v0",
    enabled: true,
    unitName: "nixsoma-ai-native-intake.service",
    status: "running",
    active: true,
    mainPid: 5252,
    matchingSurface: {
      surfaceId: SURFACE_ID,
      pid: 5252,
      width: 1280,
      height: 720,
      activated: true,
    },
    surfaceAttached: true,
    surfaceInventorySequence: INVENTORY_SEQUENCE,
    reused: false,
  };
}

function inputEvidence() {
  return {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: 7,
    byteLength: 7,
    maxChars: 32,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function typeResult(overrides = {}) {
  return {
    ok: true,
    registry: "nixsoma-ai-workspace-ocr-type-v0",
    status: "executed",
    decision: { actionId: "type_text", inputEvidence: inputEvidence() },
    action: {
      actionId: "type_text",
      inputEvidence: inputEvidence(),
      surfaceId: SURFACE_ID,
      inventorySequence: INVENTORY_SEQUENCE,
      executed: true,
    },
    evidence: {
      taskId: TASK_ID,
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      contextContentHash: "c".repeat(64),
      requestContentHash: "d".repeat(64),
      responseContentHash: "e".repeat(64),
      frameContentHash: "f".repeat(64),
      verificationFrameContentHash: "1".repeat(64),
      verificationFrameSequence: 12,
      postActionFrameContentHash: "2".repeat(64),
      postActionFrameSequence: 14,
      inputEvidence: inputEvidence(),
      receiptMatched: true,
      frameChanged: true,
      postActionVerified: true,
      completionAudit: true,
      expectedSurfaceBound: true,
    },
    governance: {
      providerCalled: true,
      actionExecuted: true,
      fixedApplicationSurfaceBound: true,
      taskObjectiveBound: true,
      taskObjectiveInputBound: true,
      currentFrameBound: true,
      currentActiveSurfaceBound: true,
      keyboardInput: true,
      providerGeneratedInput: true,
    },
    ...overrides,
  };
}

function harness({ result = typeResult(), stopThrows = false } = {}) {
  const calls = { lifecycle: [], type: [], audit: [] };
  const workflow = createAiWorkspaceNativeIntakeWorkflow({
    sessionManagerUrl: "http://127.0.0.1:4102",
    fetchJson: async (url) => {
      assert.equal(url, "http://127.0.0.1:4102/work-view/state");
      return {
        workView: {
          aiGraphicalSession: { nativeIntakeLifecycle: stoppedApplication() },
        },
      };
    },
    postJson: async (url, body, options) => {
      const operation = url.endsWith("/start") ? "start" : "stop";
      calls.lifecycle.push({ operation, url, body, options });
      if (operation === "stop" && stopThrows) throw new Error("transport unknown");
      return {
        ok: true,
        application: operation === "start" ? startedApplication() : stoppedApplication(),
      };
    },
    invokeType: async (input) => {
      calls.type.push(input);
      return result;
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: true };
    },
    now: () => "2026-08-04T08:00:00.000Z",
  });
  return { workflow, calls };
}

test("native intake workflow binds one type to the started surface and always stops", async () => {
  const { workflow, calls } = harness();
  const result = await workflow.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.terminalReason, "verified_native_intake_type");
  assert.deepEqual(calls.type, [{
    taskId: TASK_ID,
    expectedSurfaceBinding: {
      surfaceId: SURFACE_ID,
      inventorySequence: INVENTORY_SEQUENCE,
    },
  }]);
  assert.deepEqual(calls.lifecycle.map(({ operation }) => operation), ["start", "stop"]);
  assert.equal(calls.lifecycle[0].body.operatorActionSource,
    "ai_workspace_native_intake_workflow");
  assert.equal(calls.lifecycle[0].options.grantContext.capabilityId,
    "act.ai.workspace.native_intake_workflow");
  assert.equal(result.evidence.providerCallCount, 1);
  assert.equal(result.evidence.actionCount, 1);
  assert.equal(result.evidence.lifecycleActionCount, 2);
  assert.equal(result.evidence.lifecycleStartVerified, true);
  assert.equal(result.evidence.lifecycleStopVerified, true);
  assert.equal(result.evidence.workflowCompletionAudit, true);
  assert.equal(result.governance.maximumFixedActions, 3);
  assert.equal(result.governance.currentActiveSurfaceBound, true);
  assert.equal(result.governance.arbitraryProcessLaunch, false);
  assert.equal(result.governance.inputTextPersisted, false);
  assert.equal(calls.audit.at(-1).name, "ai_workspace.native_intake_workflow_completed");
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes("private input"), false);
});

test("native intake workflow stops after unverified type without retry", async () => {
  const unverified = typeResult({
    evidence: { ...typeResult().evidence, postActionVerified: false },
  });
  const { workflow, calls } = harness({ result: unverified });
  const result = await workflow.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "stopped_after_type");
  assert.equal(result.terminalReason, "native_intake_type_not_verified");
  assert.equal(calls.type.length, 1);
  assert.deepEqual(calls.lifecycle.map(({ operation }) => operation), ["start", "stop"]);
  assert.equal(result.evidence.lifecycleStopVerified, true);
  assert.equal(result.governance.automaticRepeat, false);
});

test("native intake workflow rejects type evidence from a different task", async () => {
  const mismatched = typeResult({
    evidence: { ...typeResult().evidence, taskId: "task-native-intake-other" },
  });
  const { workflow, calls } = harness({ result: mismatched });
  const result = await workflow.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "stopped_after_type");
  assert.equal(result.terminalReason, "native_intake_type_not_verified");
  assert.equal(calls.type.length, 1);
  assert.deepEqual(calls.lifecycle.map(({ operation }) => operation), ["start", "stop"]);
});

test("native intake workflow reports unknown cleanup and never repeats input", async () => {
  const { workflow, calls } = harness({ stopThrows: true });
  const result = await workflow.invoke({ taskId: TASK_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "cleanup_outcome_unknown");
  assert.equal(result.evidence.outcomeUnknown, true);
  assert.equal(result.evidence.lifecycleActionCount, null);
  assert.equal(result.evidence.lifecycleActionCountMinimum, 1);
  assert.equal(calls.type.length, 1);
  assert.deepEqual(calls.lifecycle.map(({ operation }) => operation), ["start", "stop"]);
});
