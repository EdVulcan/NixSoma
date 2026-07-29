import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildAiLocalOcrObservation } from
  "../../../packages/shared-utils/src/ai-local-ocr.mjs";
import { createAiWorkspaceOcrFocusType } from
  "../src/ai-workspace-ocr-focus-type.mjs";

const NOW = "2026-07-29T15:00:00.000Z";
const TASK_ID = "task-ocr-focus-type-1";
const TARGET = "Customername";
const ITEM_TEXT = "Customername:[ ]";
const INPUT = "QWERTY";

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
    goal: `Focus the OCR item containing "${TARGET}" and type exact text "${INPUT}" into the active surface`,
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
  inputVisible = false,
  focused = false,
  inventorySequence = 9,
} = {}) {
  const items = [];
  if (targetVisible) {
    items.push({
      text: ITEM_TEXT,
      bounds: { x: 10, y: 100, width: 340, height: 22 },
    });
  } else {
    items.push({ text: "Telephone: |", bounds: { x: 10, y: 140, width: 200, height: 22 } });
  }
  if (focused) {
    items.push({ text: "Focused field", bounds: { x: 360, y: 100, width: 120, height: 22 } });
  }
  if (inputVisible) {
    items.push({ text: INPUT, bounds: { x: 180, y: 100, width: 100, height: 22 } });
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

function nativeClick(body) {
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
}

function nativeType(body) {
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
          postFrame: { sha256: "d".repeat(64), sequence: 11 },
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
}

function harness({
  actionId = "focus_and_type",
  itemOrdinal = 1,
  providerInput = INPUT,
  changedTask = false,
  changedVerificationOcr = false,
  inputAlreadyVisible = false,
  rejectClick = false,
  rejectType = false,
  throwClick = false,
  throwType = false,
  staleFocusFrame = false,
  omitInputAfterAction = false,
  rejectAudit = false,
} = {}) {
  const calls = {
    provider: 0,
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
      assert.equal(context.workspace.localOcr.items[0].text, ITEM_TEXT);
      assert.equal(context.taskObjective.statement, reviewedTask().goal);
      assert.equal(context.workspace.frame.sha256, undefined);
      const assistantContent = JSON.stringify({
        actionId,
        itemOrdinal: actionId === "focus_and_type" ? itemOrdinal : null,
        inputText: actionId === "focus_and_type" ? providerInput : null,
        reason: actionId === "focus_and_type"
          ? "The fixed target and value match."
          : "No action.",
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
  const owner = createAiWorkspaceOcrFocusType({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenActUrl: "http://127.0.0.1:4105",
    now: () => NOW,
    getTaskById: (taskId) => {
      calls.task += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask(changedTask && calls.task > 1
        ? { goal: 'Focus the OCR item containing "Other" and type exact text "QWERTY" into the active surface', updatedAt: "2026-07-29T15:00:01.000Z" }
        : {});
    },
    fetchJson: async (url) => {
      if (url.endsWith("/work-view/local-ocr")) {
        calls.ocr += 1;
        if (calls.ocr === 1) return { observation: observation(7, { inputVisible: inputAlreadyVisible }) };
        if (calls.ocr === 2) {
          return { observation: observation(8, {
            targetVisible: !changedVerificationOcr,
            inputVisible: inputAlreadyVisible,
          }) };
        }
        if (calls.ocr === 3) {
          return { observation: observation(staleFocusFrame ? 9 : 10, {
            focused: true,
            inventorySequence: 10,
          }) };
        }
        return { observation: observation(12, {
          focused: true,
          inputVisible: !omitInputAfterAction,
          inventorySequence: 11,
        }) };
      }
      if (url.endsWith("/work-view/state")) {
        return workViewState(calls.ocr >= 4 ? 11 : calls.ocr >= 3 ? 10 : 9);
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
    postJson: async (url, body, options) => {
      calls.action.push({ url, body: structuredClone(body), options });
      if (url.endsWith("/act/mouse/click")) {
        if (throwClick) throw new Error("click transport detail");
        return rejectClick ? { ok: false } : nativeClick(body);
      }
      if (url.endsWith("/act/keyboard/type")) {
        if (throwType) throw new Error("type transport detail");
        return rejectType ? { ok: false } : nativeType(body);
      }
      throw new Error(`unexpected post: ${url}`);
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: !rejectAudit };
    },
  });
  return { owner, calls };
}

test("OCR focus type executes one fixed click then type and verifies final OCR", async () => {
  const { owner, calls } = harness();
  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.decision.actionId, "focus_and_type");
  assert.equal(result.decision.itemOrdinal, 1);
  assert.equal(result.decision.inputEvidence.charCount, INPUT.length);
  assert.equal(Object.hasOwn(result.decision, "inputText"), false);
  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[0].actionId, "focus_item");
  assert.equal(result.actions[0].x, 180);
  assert.equal(result.actions[0].y, 111);
  assert.equal(result.actions[1].actionId, "type_text");
  assert.equal(result.evidence.actionCount, 2);
  assert.equal(result.evidence.focusActionVerified, true);
  assert.equal(result.evidence.verificationSurfaceId, 42);
  assert.equal(result.evidence.focusSurfaceId, 42);
  assert.equal(result.evidence.postActionSurfaceId, 42);
  assert.equal(result.evidence.postActionVerified, true);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(result.governance.maximumProviderCalls, 1);
  assert.equal(result.governance.maximumActions, 2);
  assert.equal(result.governance.fixedActionSequence, true);
  assert.equal(result.governance.automaticContinuation, false);
  assert.equal(result.governance.enterKeyInput, false);
  assert.equal(calls.provider, 1);
  assert.equal(calls.ocr, 4);
  assert.equal(calls.action.length, 2);
  assert.equal(calls.action[0].url.endsWith("/act/mouse/click"), true);
  assert.equal(calls.action[1].url.endsWith("/act/keyboard/type"), true);
  assert.equal(calls.action[1].body.text, INPUT);
  assert.deepEqual(calls.audit.map((entry) => entry.name), [
    "ai_workspace.ocr_focus_type_focus_authorized",
    "ai_workspace.ocr_focus_type_type_authorized",
    "ai_workspace.ocr_focus_type_completed",
  ]);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(INPUT), false);
  assert.equal(JSON.stringify(result).includes(ITEM_TEXT), false);
  assert.equal(calls.parsed.decision.inputText, null);
});

test("OCR focus type no-op remains provider-bound and action-free", async () => {
  const { owner, calls } = harness({ actionId: "no_op" });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "no_action");
  assert.equal(result.actions.length, 0);
  assert.equal(result.evidence.actionCount, 0);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.ocr, 2);
  assert.equal(calls.action.length, 0);
});

test("OCR focus type rejects unbound provider target or input before action", async () => {
  for (const options of [
    { itemOrdinal: 2 },
    { providerInput: "OTHER" },
    { changedVerificationOcr: true },
    { inputAlreadyVisible: true },
    { changedTask: true },
  ]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.evidence.actionCount, 0);
    assert.equal(calls.action.length, 0);
    assert.equal(JSON.stringify({ result, audit: calls.audit }).includes("OTHER"), false);
  }
});

test("OCR focus type stops without replay when either native action fails", async () => {
  for (const options of [
    { rejectClick: true },
    { throwClick: true },
    { rejectType: true },
    { throwType: true },
  ]) {
    const { owner, calls } = harness(options);
    const result = await owner.invoke({ taskId: TASK_ID });
    assert.equal(result.status, "local_fallback");
    assert.equal(result.evidence.completionAudit, true);
    assert.equal(calls.action.length, options.rejectClick || options.throwClick ? 1 : 2);
    assert.equal(result.evidence.actionCount, options.rejectClick || options.throwClick ? 0 : 1);
    assert.equal(JSON.stringify({ result, audit: calls.audit }).includes(INPUT), false);
  }
});

test("OCR focus type preserves both receipts when final OCR cannot verify", async () => {
  const { owner, calls } = harness({ omitInputAfterAction: true });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "local_fallback");
  assert.equal(result.actions.length, 2);
  assert.equal(result.evidence.actionCount, 2);
  assert.equal(result.evidence.focusActionVerified, true);
  assert.equal(result.evidence.typeActionExecuted, true);
  assert.equal(result.evidence.postActionVerified, false);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.action.length, 2);
});

test("OCR focus type does not claim a failed focus revalidation", async () => {
  const { owner, calls } = harness({ staleFocusFrame: true });
  const result = await owner.invoke({ taskId: TASK_ID });
  assert.equal(result.status, "local_fallback");
  assert.equal(result.actions.length, 1);
  assert.equal(result.evidence.focusActionExecuted, true);
  assert.equal(result.evidence.focusContextObserved, true);
  assert.equal(result.evidence.focusActionVerified, false);
  assert.equal(result.governance.focusRevalidated, false);
  assert.equal(calls.action.length, 1);
});

test("OCR focus type requires both action audits and terminal audit", async () => {
  const { owner } = harness({ rejectAudit: true });
  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /OCR focus type audit/u);
});
