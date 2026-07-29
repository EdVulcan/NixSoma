import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildAiLocalOcrObservation } from
  "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import { createAiWorkspaceOcrType } from "../src/ai-workspace-ocr-type.mjs";

const NOW = "2026-07-29T13:30:00.000Z";
const TASK_ID = "task-ocr-type-1";
const INPUT = "ZXCVBN";

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
    goal: `Type exact text "${INPUT}" into the active surface`,
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
  inputVisible = false,
  changed = false,
  inventorySequence = 9,
} = {}) {
  const items = [{
    text: "NixSoma AI Workbench",
    bounds: { x: 100, y: 80, width: 260, height: 40 },
  }];
  if (changed) {
    items.push({ text: "Changed before action", bounds: { x: 100, y: 140, width: 260, height: 40 } });
  }
  if (inputVisible) {
    items.push({ text: INPUT, bounds: { x: 100, y: 200, width: 180, height: 40 } });
  }
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
  actionId = "type_text",
  providerInput = INPUT,
  changedTask = false,
  changedVerificationOcr = false,
  inputAlreadyVisible = false,
  omitInputAfterAction = false,
  rejectAction = false,
  throwAction = false,
  rejectAudit = false,
} = {}) {
  const calls = {
    provider: 0,
    prompt: null,
    parsed: null,
    audit: [],
    ocr: 0,
    task: 0,
    action: [],
  };
  const standingAdvisory = {
    config: { enforceLimits: false },
    state: { callsUsed: 2, tokensUsed: 2048 },
    async requestDecision(options) {
      const context = await options.buildContext(NOW);
      calls.provider += 1;
      calls.prompt = options.buildPrompt(context);
      assert.equal(context.workspace.localOcr.items[0].text, "NixSoma AI Workbench");
      assert.equal(context.taskObjective.statement, reviewedTask().goal);
      assert.equal(context.workspace.frame.sha256, undefined);
      assert.equal(calls.prompt.includes(TASK_ID), false);
      const assistantContent = JSON.stringify({
        actionId,
        inputText: actionId === "type_text" ? providerInput : null,
        reason: actionId === "type_text" ? "The fixed objective names this exact value." : "No action.",
        confidence: 0.97,
      });
      calls.parsed = options.parseResponse({
        contract: options.responseContract,
        assistantContent,
        responseContentHash: hash(assistantContent),
      });
      return {
        ok: true,
        parsed: calls.parsed,
        evidence: {
          contextContentHash: hash(JSON.stringify(context)),
          requestContentHash: "b".repeat(64),
          responseContentHash: hash(assistantContent),
          budget: { limitsEnforced: false, callsUsed: 3, tokensUsed: 3072 },
        },
      };
    },
  };
  const owner = createAiWorkspaceOcrType({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenActUrl: "http://127.0.0.1:4105",
    now: () => NOW,
    getTaskById: (taskId) => {
      calls.task += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask(changedTask && calls.task > 1
        ? { goal: `Type exact text "OTHER" into the active surface`, updatedAt: "2026-07-29T13:30:01.000Z" }
        : {});
    },
    fetchJson: async (url) => {
      if (url.endsWith("/work-view/local-ocr")) {
        calls.ocr += 1;
        if (calls.ocr === 1) return { observation: observation(7, { inputVisible: inputAlreadyVisible }) };
        if (calls.ocr === 2) {
          return { observation: observation(8, {
            inputVisible: inputAlreadyVisible,
            changed: changedVerificationOcr,
          }) };
        }
        return { observation: observation(10, {
          inputVisible: !omitInputAfterAction,
          inventorySequence: 10,
        }) };
      }
      if (url.endsWith("/work-view/state")) return workViewState(calls.ocr >= 3 ? 10 : 9);
      throw new Error(`unexpected fetch: ${url}`);
    },
    postJson: async (url, body, options) => {
      calls.action.push({ url, body: structuredClone(body), options });
      if (throwAction) throw new Error("transport detail");
      if (rejectAction) return { ok: false };
      return {
        action: {
          kind: "keyboard.type",
          result: "executed-ai-compositor",
          mediation: {
            accepted: true,
            nativeInput: {
              operation: "keyboard_type",
              inputCharCount: body.text.length,
              inputTextExposed: false,
              inputTextPersisted: false,
              keyboardInput: true,
              hotkeyInput: false,
              enterKeyInput: false,
              automaticRepeat: false,
              surfaceId: body.surfaceId,
              inventorySequence: body.inventorySequence,
              frame: {
                sha256: body.compositorFrame.sha256,
                sequence: body.compositorFrame.sequence,
              },
              postFrame: { sha256: "c".repeat(64), sequence: 9 },
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

test("OCR type executes one objective-bound native type and verifies newer OCR", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.decision.actionId, "type_text");
  assert.equal(result.decision.inputEvidence.charCount, INPUT.length);
  assert.equal(Object.hasOwn(result.decision, "inputText"), false);
  assert.equal(result.action.surfaceId, 42);
  assert.equal(result.evidence.postActionFrameSequence, 10);
  assert.equal(result.evidence.postActionVerified, true);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(result.governance.taskObjectiveInputBound, true);
  assert.equal(result.governance.providerGeneratedInput, true);
  assert.equal(result.governance.hotkeyInput, false);
  assert.equal(result.governance.enterKeyInput, false);
  assert.equal(calls.provider, 1);
  assert.equal(calls.ocr, 3);
  assert.equal(calls.action.length, 1);
  assert.equal(calls.action[0].url, "http://127.0.0.1:4105/act/keyboard/type");
  assert.equal(calls.action[0].body.text, INPUT);
  assert.equal(calls.action[0].options.grantContext.taskId, TASK_ID);
  assert.deepEqual(calls.audit.map((entry) => entry.name), [
    "ai_workspace.ocr_type_action_authorized",
    "ai_workspace.ocr_type_completed",
  ]);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(INPUT), false);
  assert.equal(calls.parsed.decision.inputText, null);
});

test("OCR type no-op remains provider-bound and action-free", async () => {
  const { owner, calls } = harness({ actionId: "no_op" });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "no_action");
  assert.equal(result.action.executed, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.ocr, 2);
  assert.equal(calls.action.length, 0);
});

test("OCR type rejects provider input not named by the fixed objective", async () => {
  const { owner, calls } = harness({ providerInput: "OTHER" });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_ocr_type_input_not_objective_bound");
  assert.equal(result.action.executed, false);
  assert.equal(calls.action.length, 0);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes("OTHER"), false);
});

test("OCR type falls back on task/OCR drift, preexisting text, and owner rejection", async () => {
  for (const options of [
    { changedTask: true },
    { changedVerificationOcr: true },
    { inputAlreadyVisible: true },
    { rejectAction: true },
    { throwAction: true },
  ]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.action.executed, false);
    assert.equal(result.evidence.completionAudit, true);
    assert.equal(calls.audit.at(-1).name, "ai_workspace.ocr_type_completed");
    assert.equal(JSON.stringify(calls.audit).includes(INPUT), false);
  }
});

test("OCR type records executed fallback when post-action OCR cannot verify", async () => {
  const { owner, calls } = harness({ omitInputAfterAction: true });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "local_fallback");
  assert.equal(result.action.executed, true);
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.receiptMatched, true);
  assert.equal(result.evidence.postActionVerified, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.action.length, 1);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(INPUT), false);
});

test("OCR type requires pre-action and terminal audits", async () => {
  const { owner } = harness({ rejectAudit: true });
  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /OCR type audit/u);
});
