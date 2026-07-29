import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildWorkViewSemanticScene } from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import { createAiWorkspaceAssessment } from "../src/ai-workspace-assessment.mjs";

const NOW = "2026-07-28T08:00:00.000Z";
const TASK_ID = "task-reviewed-1";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function frame(sequence = 4, sha256 = "a".repeat(64)) {
  return {
    registry: "nixsoma-ai-compositor-frame-v0",
    available: true,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    socketName: "nixsoma-ai-0",
    mediaType: "image/png",
    encoding: "base64_data_url",
    width: 1280,
    height: 720,
    byteLength: 100,
    sha256,
    capturedAt: NOW,
    sequence,
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
  };
}

function workView(sequence = 9, pid = 999) {
  const helperRuntime = { status: "active", actionAuthority: "active", leaseMatched: true };
  return {
    workViewId: "work-view-primary",
    status: "prepared",
    helperRuntime,
    trustedSession: {
      sessionIdentity: { status: "authoritative" },
      helperRuntime,
    },
    aiGraphicalSession: {
      ready: true,
      browserAttachment: { attached: true },
      surfaceInventory: {
        available: true,
        socketName: "nixsoma-ai-0",
        sequence,
        count: 1,
        surfaces: [{ surfaceId: 7, width: 1280, height: 720, activated: true, pid }],
      },
    },
  };
}

function reviewedTask(overrides = {}) {
  return {
    id: TASK_ID,
    goal: "Determine whether the Learn more link is visible",
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
    ...overrides,
  };
}

function semanticScene({ name = "Learn more", frameSequence = 7 } = {}) {
  const visualFrame = {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: 120,
    sha256: String(frameSequence).padStart(64, "c"),
    capturedAt: NOW,
    sequence: frameSequence,
  };
  return buildWorkViewSemanticScene({
    browser: { running: true, browserPid: 999 },
    capture: {
      activeUrl: "https://private.invalid/must-not-egress",
      visualFrame,
      semanticTargets: {
        available: true,
        pageUrl: "https://private.invalid/must-not-egress",
        frame: visualFrame,
        items: [{
          targetId: "PRIVATE_TARGET_ID",
          role: "link",
          name,
          disabled: false,
          bounds: { x: 120, y: 180, width: 90, height: 24 },
          value: "PRIVATE_INPUT_VALUE",
          selector: "#private-selector",
        }],
      },
    },
    now: Date.parse(NOW),
  });
}

function harness({
  outcome = "complete",
  invalidContext = false,
  changedScene = false,
  changedTask = false,
  providerFailureReason = null,
  rejectAudit = false,
} = {}) {
  const calls = { provider: 0, prompts: [], audit: [] };
  let frameSequence = 4;
  let stateReads = 0;
  let sceneReads = 0;
  let taskReads = 0;
  const standingAdvisory = {
    config: { enforceLimits: false },
    state: { callsUsed: 3, tokensUsed: 3072 },
    async requestDecision(options) {
      let context;
      try {
        context = await options.buildContext(NOW);
      } catch {
        return { ok: false, reason: "context_unavailable" };
      }
      const prompt = options.buildPrompt(context);
      calls.prompts.push(prompt);
      calls.provider += 1;
      assert.equal(context.taskObjective.maximumActions, 0);
      assert.equal(context.requestedBehavior.maximumActions, 0);
      assert.equal(prompt.includes("Learn more"), true);
      assert.equal(prompt.includes(TASK_ID), false);
      assert.equal(prompt.includes("PRIVATE_TARGET_ID"), false);
      assert.equal(prompt.includes("PRIVATE_INPUT_VALUE"), false);
      assert.equal(prompt.includes("#private-selector"), false);
      assert.equal(prompt.includes("https://private.invalid"), false);
      const contextContentHash = hash(JSON.stringify(context));
      if (providerFailureReason) {
        return {
          ok: false,
          reason: providerFailureReason,
          evidence: {
            contextContentHash,
            requestContentHash: "b".repeat(64),
            responseContentHash: "d".repeat(64),
            budget: { limitsEnforced: false, callsUsed: 4, tokensUsed: 4096 },
          },
        };
      }
      const assistantContent = JSON.stringify({
        outcome,
        reason: "The visible semantic scene establishes the objective.",
        confidence: 0.85,
      });
      return {
        ok: true,
        parsed: options.parseResponse({
          contract: options.responseContract,
          assistantContent,
          responseContentHash: hash(assistantContent),
        }),
        evidence: {
          contextContentHash,
          requestContentHash: "b".repeat(64),
          responseContentHash: hash(assistantContent),
          budget: { limitsEnforced: false, callsUsed: 4, tokensUsed: 4096 },
        },
      };
    },
  };
  const owner = createAiWorkspaceAssessment({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenSenseUrl: "http://127.0.0.1:4104",
    now: () => NOW,
    getTaskById: (taskId) => {
      taskReads += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask(changedTask && taskReads > 1
        ? { goal: "Determine whether Documentation is visible", updatedAt: "2026-07-28T08:00:01.000Z" }
        : {});
    },
    fetchJson: async (url) => {
      if (url.endsWith("/work-view/compositor-frame")) {
        frameSequence += 1;
        return { ok: true, frame: frame(frameSequence, String(frameSequence).padStart(64, "a")) };
      }
      if (url.endsWith("/work-view/state")) {
        stateReads += 1;
        const value = workView();
        if (invalidContext) value.helperRuntime.actionAuthority = "suspended";
        return {
          ok: true,
          session: { sessionId: "session-current", status: "running", role: "ai-work-view" },
          workView: value,
        };
      }
      if (url.endsWith("/screen/semantic-scene")) {
        sceneReads += 1;
        return { ok: true, scene: semanticScene({
          name: changedScene && sceneReads > 1 ? "Documentation" : "Learn more",
          frameSequence: sceneReads + 6,
        }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: !rejectAudit };
    },
  });
  return { owner, calls };
}

test("AI workspace assessment returns one scene-bound outcome without action or task mutation", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "assessed");
  assert.deepEqual(result.assessment, { outcome: "complete", confidence: 0.85 });
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.governance.maximumProviderCalls, 1);
  assert.equal(result.governance.maximumActions, 0);
  assert.equal(result.governance.actionExecuted, false);
  assert.equal(result.governance.taskMutated, false);
  assert.equal(result.governance.automaticContinuation, false);
  assert.equal(result.governance.semanticSceneBound, true);
  assert.equal(result.governance.taskObjectiveBound, true);
  assert.equal(result.governance.pixelsProviderEgress, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.audit[0].name, "ai_workspace.assessment_completed");
  assert.equal(calls.audit[0].payload.outcome, "complete");
  assert.equal(JSON.stringify(result).includes("visible semantic scene"), false);
});

test("AI workspace assessment rejects changed task or semantic content after provider return", async () => {
  for (const options of [{ changedTask: true }, { changedScene: true }]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.assessment.outcome, "unknown");
    assert.equal(result.governance.providerCalled, true);
    assert.equal(result.evidence.completionAudit, true);
    assert.equal(calls.audit[0].payload.status, "local_fallback");
  }
});

test("AI workspace assessment keeps pre-egress rejection event-free and audits provider fallback", async () => {
  const unavailable = harness({ invalidContext: true });
  const preEgress = await unavailable.owner.invoke({ taskId: TASK_ID });
  assert.equal(preEgress.status, "local_fallback");
  assert.equal(preEgress.governance.providerCalled, false);
  assert.equal(unavailable.calls.audit.length, 0);

  const providerFailure = harness({ providerFailureReason: "response_invalid" });
  const postEgress = await providerFailure.owner.invoke({ taskId: TASK_ID });
  assert.equal(postEgress.governance.providerCalled, true);
  assert.equal(postEgress.evidence.completionAudit, true);
  assert.equal(providerFailure.calls.audit.length, 1);
});

test("AI workspace assessment rejects an expected task-binding mismatch before provider egress", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({
    taskId: TASK_ID,
    expectedTaskBinding: {
      taskId: TASK_ID,
      objectiveContentHash: "0".repeat(64),
      taskVersionHash: "1".repeat(64),
    },
  });

  assert.equal(result.status, "local_fallback");
  assert.equal(
    result.fallback.reason,
    "ai_workspace_assessment_task_objective_changed_before_egress",
  );
  assert.equal(result.governance.providerCalled, false);
  assert.equal(calls.provider, 0);
  assert.equal(calls.prompts.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("AI workspace assessment requires its terminal audit", async () => {
  const { owner } = harness({ rejectAudit: true });
  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /assessment audit/u);
});
