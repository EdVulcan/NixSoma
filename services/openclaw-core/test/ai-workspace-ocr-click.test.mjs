import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildAiLocalOcrObservation } from
  "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import { createAiWorkspaceOcrClick } from "../src/ai-workspace-ocr-click.mjs";

const NOW = "2026-07-29T07:00:00.000Z";
const TASK_ID = "task-ocr-click-1";
const TARGET = "Acknowledge action";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function workViewState(sequence = 9) {
  const helperRuntime = { status: "active", actionAuthority: "active", leaseMatched: true };
  return {
    session: { sessionId: "session-current", status: "running", role: "ai-work-view" },
    workView: {
      workViewId: "work-view-primary",
      status: "prepared",
      helperRuntime,
      trustedSession: {
        sessionIdentity: { status: "authoritative" },
        helperRuntime,
      },
      aiGraphicalSession: {
        ready: true,
        surfaceInventory: {
          available: true,
          socketName: "nixsoma-ai-0",
          sequence,
          count: 1,
          surfaces: [{
            surfaceId: 42,
            width: 1280,
            height: 720,
            activated: true,
          }],
        },
      },
    },
  };
}

function reviewedTask(overrides = {}) {
  return {
    id: TASK_ID,
    goal: "Click the visible Acknowledge action target once",
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

function observation(sequence, {
  targetVisible = true,
  changed = false,
  inventorySequence = 9,
} = {}) {
  const items = targetVisible
    ? [{ text: TARGET, bounds: { x: 100, y: 120, width: 200, height: 40 } }]
    : [{ text: changed ? "Unrelated changed text" : "OCR action completed: acknowledged",
      bounds: { x: 100, y: 120, width: 300, height: 40 } }];
  return buildAiLocalOcrObservation({
    observedAt: NOW,
    frame: {
      registry: "nixsoma-ai-compositor-frame-v0",
      socketName: "nixsoma-ai-0",
      width: 1280,
      height: 720,
      sha256: sequence.toString(16).padStart(64, "a"),
      sequence,
      capturedAt: NOW,
    },
    surface: { surfaceId: 42, width: 1280, height: 720 },
    inventorySequence,
    items: items.map((item, index) => ({
      ordinal: index + 1,
      text: item.text,
      confidence: 0.95,
      bounds: item.bounds,
    })),
    sourceItemCount: items.length,
    truncated: false,
  });
}

function harness({
  actionId = "click_item",
  changedTask = false,
  changedVerificationOcr = false,
  keepTargetAfterAction = false,
  rejectAction = false,
  throwAction = false,
  rejectAudit = false,
} = {}) {
  const calls = { provider: 0, prompt: null, audit: [], ocr: 0, task: 0, action: [] };
  const standingAdvisory = {
    config: { enforceLimits: false },
    state: { callsUsed: 2, tokensUsed: 2048 },
    async requestDecision(options) {
      const context = await options.buildContext(NOW);
      calls.provider += 1;
      calls.prompt = options.buildPrompt(context);
      assert.equal(context.workspace.localOcr.items[0].text, TARGET);
      assert.equal(context.workspace.frame.sha256, undefined);
      assert.equal(calls.prompt.includes(TARGET), true);
      assert.equal(calls.prompt.includes(TASK_ID), false);
      const assistantContent = JSON.stringify({
        actionId,
        itemOrdinal: actionId === "click_item" ? 1 : null,
        reason: actionId === "click_item" ? "The named item is the target." : "No action.",
        confidence: 0.96,
      });
      return {
        ok: true,
        parsed: options.parseResponse({
          contract: options.responseContract,
          assistantContent,
          responseContentHash: hash(assistantContent),
        }),
        evidence: {
          contextContentHash: hash(JSON.stringify(context)),
          requestContentHash: "b".repeat(64),
          responseContentHash: hash(assistantContent),
          budget: { limitsEnforced: false, callsUsed: 3, tokensUsed: 3072 },
        },
      };
    },
  };
  const owner = createAiWorkspaceOcrClick({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenActUrl: "http://127.0.0.1:4105",
    now: () => NOW,
    getTaskById: (taskId) => {
      calls.task += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask(changedTask && calls.task > 1
        ? { goal: "Click another target", updatedAt: "2026-07-29T07:00:01.000Z" }
        : {});
    },
    fetchJson: async (url) => {
      if (url.endsWith("/work-view/local-ocr")) {
        calls.ocr += 1;
        if (calls.ocr === 1) return { observation: observation(7) };
        if (calls.ocr === 2) {
          return { observation: observation(8, {
            targetVisible: !changedVerificationOcr,
            changed: changedVerificationOcr,
          }) };
        }
        return { observation: observation(9, {
          targetVisible: keepTargetAfterAction,
          inventorySequence: 10,
        }) };
      }
      if (url.endsWith("/work-view/state")) return workViewState(calls.ocr >= 3 ? 10 : 9);
      throw new Error(`unexpected fetch: ${url}`);
    },
    postJson: async (url, body, options) => {
      calls.action.push({ url, body, options });
      if (throwAction) throw new Error("transport detail");
      if (rejectAction) return { ok: false };
      return {
        action: {
          kind: "mouse.click",
          result: "executed-ai-compositor",
          mediation: {
            accepted: true,
            nativeInput: {
              operation: "pointer_click",
              x: body.x,
              y: body.y,
              surfaceId: body.surfaceId,
              inventorySequence: body.inventorySequence,
              receiptMatched: true,
              inventoryMatched: true,
              surfaceMatched: true,
              frameMatched: true,
              frameFresh: true,
              sequenceAdvanced: true,
              frameChanged: true,
            },
          },
        },
      };
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: !rejectAudit };
    },
  });
  return { owner, calls };
}

test("OCR click derives one same-surface click locally and verifies newer OCR", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.deepEqual(result.decision, { actionId: "click_item", itemOrdinal: 1, confidence: 0.96 });
  assert.equal(result.action.x, 200);
  assert.equal(result.action.y, 140);
  assert.equal(result.action.surfaceId, 42);
  assert.equal(result.evidence.postActionFrameSequence, 9);
  assert.equal(result.evidence.inventorySequence, 9);
  assert.equal(result.evidence.postActionVerified, true);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(result.governance.arbitraryPointerInput, false);
  assert.equal(calls.provider, 1);
  assert.equal(calls.ocr, 3);
  assert.equal(calls.action.length, 1);
  assert.equal(calls.action[0].options.grantContext.taskId, TASK_ID);
  assert.deepEqual(calls.audit.map((entry) => entry.name), [
    "ai_workspace.ocr_click_action_authorized",
    "ai_workspace.ocr_click_completed",
  ]);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(TARGET), false);
});

test("OCR click no-op remains provider-bound and action-free", async () => {
  const { owner, calls } = harness({ actionId: "no_op" });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "no_action");
  assert.equal(result.action.executed, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.ocr, 2);
  assert.equal(calls.action.length, 0);
});

test("OCR click falls back on task/OCR drift and owner rejection with terminal audit", async () => {
  for (const options of [
    { changedTask: true },
    { changedVerificationOcr: true },
    { rejectAction: true },
    { throwAction: true },
  ]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.action.executed, false);
    assert.equal(result.evidence.completionAudit, true);
    assert.equal(calls.audit.at(-1).name, "ai_workspace.ocr_click_completed");
    assert.equal(JSON.stringify(calls.audit).includes(TARGET), false);
  }
});

test("OCR click records executed fallback when post-action OCR cannot verify", async () => {
  const { owner, calls } = harness({ keepTargetAfterAction: true });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "local_fallback");
  assert.equal(result.action.executed, true);
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.receiptMatched, true);
  assert.equal(result.evidence.frameChanged, true);
  assert.equal(result.evidence.postActionVerified, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.action.length, 1);
});

test("OCR click requires pre-action and terminal audits", async () => {
  const { owner } = harness({ rejectAudit: true });
  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /OCR click audit/u);
});
