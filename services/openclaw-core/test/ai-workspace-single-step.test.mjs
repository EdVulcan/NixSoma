import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createAiWorkspaceSingleStep } from "../src/ai-workspace-single-step.mjs";

const NOW = "2026-07-28T08:00:00.000Z";

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

function workView(sequence = 9) {
  return {
    status: "prepared",
    helperRuntime: { status: "active", actionAuthority: "active", leaseMatched: true },
    aiGraphicalSession: {
      ready: true,
      browserAttachment: { attached: true },
      surfaceInventory: {
        available: true,
        socketName: "nixsoma-ai-0",
        sequence,
        count: 1,
        surfaces: [{ surfaceId: 7, width: 1280, height: 720, activated: true, pid: 999 }],
      },
    },
  };
}

function harness({
  actionId = "scroll_down",
  invalidContext = false,
  changedContext = false,
  rejectedAuditName = null,
} = {}) {
  const calls = { fetch: [], post: [], audit: [], decision: [] };
  let captureSequence = 4;
  let stateReads = 0;
  const standingAdvisory = {
    config: { maxCallsPerDay: 3, maxTokensPerDay: 4096 },
    state: { day: "2026-07-28", callsUsed: 1, tokensUsed: 1024 },
    async requestDecision(options) {
      calls.decision.push(options);
      let context;
      try {
        context = await options.buildContext(NOW);
      } catch {
        return { ok: false, reason: "context_unavailable" };
      }
      const prompt = options.buildPrompt(context);
      assert.equal(prompt.includes("pid"), false);
      assert.equal(prompt.includes("sha256"), false);
      assert.equal(prompt.includes("data:image"), false);
      const assistantContent = JSON.stringify({
        actionId,
        reason: "Bounded test decision.",
        confidence: 0.8,
      });
      const parsed = options.parseResponse({
        contract: options.responseContract,
        assistantContent,
        responseContentHash: hash(assistantContent),
      });
      return {
        ok: true,
        parsed,
        evidence: {
          contextContentHash: hash(JSON.stringify(context)),
          requestContentHash: "b".repeat(64),
          responseContentHash: hash(assistantContent),
          actionId,
          model: "deepseek-chat",
          usage: { total_tokens: 80 },
          budget: { callsUsed: 1, callsLimit: 3, tokensUsed: 1024, tokensLimit: 4096 },
        },
      };
    },
  };
  const owner = createAiWorkspaceSingleStep({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenActUrl: "http://127.0.0.1:4105",
    now: () => NOW,
    fetchJson: async (url) => {
      calls.fetch.push(url);
      if (url.endsWith("/work-view/compositor-frame")) {
        captureSequence += 1;
        return { ok: true, frame: frame(captureSequence, String(captureSequence).padStart(64, "a")) };
      }
      stateReads += 1;
      const value = workView(changedContext && stateReads > 1 ? 10 : 9);
      if (invalidContext) value.helperRuntime.actionAuthority = "suspended";
      return { ok: true, workView: value };
    },
    postJson: async (url, body, options) => {
      calls.post.push({ url, body, options });
      return {
        ok: true,
        action: {
          result: "executed-ai-compositor",
          mediation: {
            accepted: true,
            nativeInput: {
              operation: "pointer_scroll",
              direction: body.direction,
              surfaceId: body.surfaceId,
              inventorySequence: body.inventorySequence,
              frame: { sha256: body.compositorFrame.sha256, sequence: body.compositorFrame.sequence },
              postFrame: { sha256: "f".repeat(64), sequence: body.compositorFrame.sequence + 1 },
              receiptMatched: true,
              inventoryMatched: true,
              surfaceMatched: true,
              frameChanged: true,
            },
          },
        },
      };
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: name !== rejectedAuditName };
    },
  });
  return { owner, calls };
}

test("AI workspace single-step executes one provider-selected governed scroll", async () => {
  const { owner, calls } = harness();

  const result = await owner.invoke();

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "scroll_down");
  assert.equal(result.action.executed, true);
  assert.equal(result.governance.maximumActions, 1);
  assert.equal(result.governance.automaticRepeat, false);
  assert.equal(result.governance.currentActiveSurfaceBound, true);
  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].url, "http://127.0.0.1:4105/act/mouse/scroll");
  assert.equal(calls.post[0].body.direction, "down");
  assert.deepEqual(calls.post[0].options.grantContext, {
    taskId: null,
    stepId: null,
    capabilityId: "act.screen.pointer_keyboard",
    intent: "mouse.scroll",
  });
  assert.deepEqual(calls.audit.map((item) => item.name), [
    "ai_workspace.single_step_action_authorized",
    "ai_workspace.single_step_completed",
  ]);
  assert.equal(JSON.stringify(result).includes("pid"), false);
});

test("AI workspace single-step honors provider no-op without actuator contact", async () => {
  const { owner, calls } = harness({ actionId: "no_op" });

  const result = await owner.invoke();

  assert.equal(result.status, "no_op");
  assert.equal(result.evidence.actionExecuted, false);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
});

test("AI workspace single-step fails local before provider when authority is not ready", async () => {
  const { owner, calls } = harness({ invalidContext: true });

  const result = await owner.invoke();

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_context_unavailable");
  assert.equal(calls.post.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("AI workspace single-step rejects changed inventory before actuator contact", async () => {
  const { owner, calls } = harness({ changedContext: true });

  const result = await owner.invoke();

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_execution_context_changed");
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step requires action audit before actuator contact", async () => {
  const { owner, calls } = harness({
    rejectedAuditName: "ai_workspace.single_step_action_authorized",
  });

  await assert.rejects(owner.invoke(), /required AI workspace single-step audit/u);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step does not retry an executed action when completion audit fails", async () => {
  const { owner, calls } = harness({
    rejectedAuditName: "ai_workspace.single_step_completed",
  });

  const result = await owner.invoke();

  assert.equal(result.status, "executed_completion_audit_unavailable");
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.completionAudit, false);
  assert.equal(calls.post.length, 1);
});
