import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildAiLocalOcrObservation } from "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import {
  buildAiWorkspaceProviderOcr,
  createAiWorkspaceOcrAssessment,
} from "../src/ai-workspace-ocr-assessment.mjs";

const NOW = "2026-07-29T06:00:00.000Z";
const TASK_ID = "task-ocr-assessment-1";
const OCR_CANARY = "NixSoma AI Workbench";

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
            pid: 999,
          }],
        },
      },
    },
  };
}

function reviewedTask(overrides = {}) {
  return {
    id: TASK_ID,
    goal: "Determine whether NixSoma AI Workbench is visible",
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

function observation({ sequence = 7, text = OCR_CANARY, items = null } = {}) {
  const values = items ?? [{ text, bounds: { x: 20, y: 30, width: 260, height: 28 } }];
  return buildAiLocalOcrObservation({
    observedAt: NOW,
    frame: {
      registry: "nixsoma-ai-compositor-frame-v0",
      socketName: "nixsoma-ai-0",
      width: 1280,
      height: 720,
      sha256: String(sequence).padStart(64, "a"),
      sequence,
      capturedAt: NOW,
    },
    surface: { surfaceId: 42, width: 1280, height: 720 },
    inventorySequence: 9,
    items: values.map((item, index) => ({
      ordinal: index + 1,
      text: item.text,
      confidence: 0.9,
      bounds: item.bounds,
    })),
    sourceItemCount: values.length,
    truncated: false,
  });
}

function harness({
  changedTask = false,
  changedOcr = false,
  invalidSurface = false,
  providerFailureReason = null,
  rejectAudit = false,
} = {}) {
  const calls = { provider: 0, prompts: [], audit: [], ocr: 0, tasks: 0 };
  const standingAdvisory = {
    config: { enforceLimits: false },
    state: { callsUsed: 4, tokensUsed: 4096 },
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
      assert.equal(context.workspace.localOcr.itemCount, 1);
      assert.equal(context.workspace.localOcr.items[0].text, OCR_CANARY);
      assert.equal(context.workspace.localOcr.contentHash, undefined);
      assert.equal(context.workspace.frame.sha256, undefined);
      assert.equal(prompt.includes(OCR_CANARY), true);
      assert.equal(prompt.includes(TASK_ID), false);
      assert.equal(prompt.includes("data:image"), false);
      const contextContentHash = hash(JSON.stringify(context));
      if (providerFailureReason) {
        return {
          ok: false,
          reason: providerFailureReason,
          evidence: {
            contextContentHash,
            requestContentHash: "b".repeat(64),
            responseContentHash: "c".repeat(64),
            budget: { limitsEnforced: false, callsUsed: 5, tokensUsed: 5120 },
          },
        };
      }
      const assistantContent = JSON.stringify({
        outcome: "complete",
        reason: "The OCR text establishes the task objective.",
        confidence: 0.95,
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
          budget: { limitsEnforced: false, callsUsed: 5, tokensUsed: 5120 },
        },
      };
    },
  };
  const owner = createAiWorkspaceOcrAssessment({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    now: () => NOW,
    getTaskById: (taskId) => {
      calls.tasks += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask(changedTask && calls.tasks > 1
        ? { goal: "Determine whether another label is visible", updatedAt: "2026-07-29T06:00:01.000Z" }
        : {});
    },
    fetchJson: async (url) => {
      if (url.endsWith("/work-view/local-ocr")) {
        calls.ocr += 1;
        return {
          ok: true,
          observation: observation({
            sequence: 6 + calls.ocr,
            text: changedOcr && calls.ocr > 1 ? "Different visible text" : OCR_CANARY,
          }),
        };
      }
      if (url.endsWith("/work-view/state")) {
        const state = workViewState();
        if (invalidSurface) state.workView.aiGraphicalSession.surfaceInventory.sequence = 10;
        return state;
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

test("OCR assessment sends bounded text without pixels and persists only compact evidence", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "assessed");
  assert.deepEqual(result.assessment, { outcome: "complete", confidence: 0.95 });
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.governance.ocrTextProviderEgress, true);
  assert.equal(result.governance.ocrTextPersistedLocally, false);
  assert.equal(result.governance.pixelsProviderEgress, false);
  assert.equal(result.governance.localOcrRevalidated, true);
  assert.equal(result.evidence.verificationFrameSequence > result.evidence.frameSequence, true);
  assert.match(result.evidence.ocrBindingHash, /^[a-f0-9]{64}$/u);
  assert.equal(calls.provider, 1);
  assert.equal(calls.ocr, 2);
  assert.equal(calls.audit[0].name, "ai_workspace.ocr_assessment_completed");
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(OCR_CANARY), false);
});

test("OCR assessment rejects changed task or recognized content after provider return", async () => {
  for (const options of [{ changedTask: true }, { changedOcr: true }]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.assessment.outcome, "unknown");
    assert.equal(result.governance.providerCalled, true);
    assert.equal(result.evidence.completionAudit, true);
    assert.equal(calls.audit[0].payload.status, "local_fallback");
    assert.equal(JSON.stringify(calls.audit).includes(OCR_CANARY), false);
  }
});

test("OCR assessment keeps pre-egress rejection event-free and audits provider fallback", async () => {
  const unavailable = harness({ invalidSurface: true });
  const preEgress = await unavailable.owner.invoke({ taskId: TASK_ID });
  assert.equal(preEgress.governance.providerCalled, false);
  assert.equal(unavailable.calls.audit.length, 0);

  const providerFailure = harness({ providerFailureReason: "provider_failed" });
  const postEgress = await providerFailure.owner.invoke({ taskId: TASK_ID });
  assert.equal(postEgress.governance.providerCalled, true);
  assert.equal(postEgress.evidence.completionAudit, true);
  assert.equal(providerFailure.calls.audit.length, 1);
});

test("OCR assessment requires its terminal audit", async () => {
  const { owner } = harness({ rejectAudit: true });
  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /OCR assessment audit/u);
});

test("provider OCR projection caps text and carries no standalone text hash", () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    text: `visible-${index}-${"x".repeat(50)}`,
    bounds: { x: 10, y: 10 + index * 10, width: 200, height: 9 },
  }));
  const projection = buildAiWorkspaceProviderOcr(observation({ items }));
  assert.equal(projection.itemCount <= 24, true);
  assert.equal(projection.characterCount <= 1200, true);
  assert.equal(projection.truncated, true);
  assert.equal(Object.hasOwn(projection, "contentHash"), false);
});
