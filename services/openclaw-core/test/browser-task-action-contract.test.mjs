import test from "node:test";
import assert from "node:assert/strict";

import {
  BROWSER_TASK_ACTION_DESCRIPTORS,
  browserTaskActionsForExecution,
  capabilityIdForBrowserTaskAction,
  compactBrowserTaskVisualGrounding,
  executeBrowserTaskActionWithCaptureRecovery,
  materialiseBrowserTaskAction,
  normaliseBrowserTaskVerificationUrl,
  observedBrowserTaskUrl,
  screenActEndpointForBrowserTaskAction,
} from "../src/browser-task-action-contract.mjs";

test("browser task action contract retains compact visual grounding without frame data", () => {
  const frame = (sha256, sequence, pageUrl) => ({
    registry: "openclaw-browser-visual-frame-v0",
    sha256,
    sequence,
    pageUrl,
    capturedAt: "2026-07-11T01:00:00.000Z",
    fresh: true,
    width: 960,
    height: 540,
    byteLength: 12000,
    sourceScope: "ai_owned_active_page_only",
    dataUrl: "data:image/jpeg;base64,forbidden",
  });
  const evidence = compactBrowserTaskVisualGrounding({
    registry: "openclaw-trusted-work-view-visual-action-grounding-v0",
    required: true,
    status: "grounded",
    before: frame("a".repeat(64), 1, "https://example.com/before"),
    after: frame("b".repeat(64), 2, "https://example.com/after"),
    sequenceAdvanced: true,
  });
  assert.equal(evidence.status, "grounded");
  assert.equal(evidence.before.sequence, 1);
  assert.equal(evidence.after.sequence, 2);
  assert.equal(evidence.imageDataRetained, false);
  assert.equal(JSON.stringify(evidence).includes("data:image/"), false);
});

test("browser task action contract executes a recovered pending rule plan without duplicated request actions", () => {
  const planned = browserTaskActionsForExecution({
    type: "browser_task",
    plan: {
      strategy: "rule-v1",
      steps: [
        { phase: "preparing_work_view", kind: "work_view.prepare", status: "pending" },
        { phase: "acting_on_target", kind: "browser.new_tab", params: { url: "https://example.com/recovered" }, status: "pending" },
      ],
    },
  });
  assert.deepEqual(planned, [{
    kind: "browser.new_tab",
    params: { url: "https://example.com/recovered" },
  }]);

  const explicit = browserTaskActionsForExecution({
    type: "browser_task",
    plan: { strategy: "rule-v1", steps: planned },
  }, [{ kind: "keyboard.hotkey", params: { keys: ["CTRL", "L"] } }]);
  assert.deepEqual(explicit, [{ kind: "keyboard.hotkey", params: { keys: ["CTRL", "L"] } }]);

  const completed = browserTaskActionsForExecution({
    type: "browser_task",
    plan: {
      strategy: "rule-v1",
      steps: [{ phase: "acting_on_target", kind: "browser.new_tab", status: "completed" }],
    },
  });
  assert.deepEqual(completed, []);
});

test("browser task action contract maps new-tab to the existing governed transport", () => {
  assert.equal(screenActEndpointForBrowserTaskAction("browser.new_tab"), "/act/browser/new-tab");
  assert.equal(capabilityIdForBrowserTaskAction("browser.new_tab"), "act.browser.open");
  assert.equal(BROWSER_TASK_ACTION_DESCRIPTORS.filter((entry) => entry.kind === "browser.new_tab").length, 1);
});

test("browser task action contract materialises one current semantic click target", () => {
  const action = materialiseBrowserTaskAction({
    kind: "browser.semantic_click",
    params: { target: { name: "Inspect target", role: "link" } },
  }, {
    screen: {
      semanticTargets: {
        available: true,
        inventorySha256: "b".repeat(64),
        frame: { sha256: "a".repeat(64), sequence: 7 },
        items: [{
          targetId: "frame-7-target-4",
          role: "link",
          name: "Inspect target",
          visible: true,
          disabled: false,
        }],
      },
    },
  });
  assert.equal(action.kind, "browser.semantic_click");
  assert.deepEqual(action.params.semanticTarget, {
    registry: "openclaw-browser-semantic-target-reference-v0",
    operation: "click",
    targetId: "frame-7-target-4",
    inventorySha256: "b".repeat(64),
    frame: { sha256: "a".repeat(64), sequence: 7 },
    selectorsExposed: false,
    arbitraryPageScript: false,
  });
  assert.equal(screenActEndpointForBrowserTaskAction(action.kind), "/act/mouse/click");
  assert.equal(capabilityIdForBrowserTaskAction(action.kind), "act.screen.pointer_keyboard");
});

test("browser task action contract rejects ambiguous semantic target intent", () => {
  assert.throws(() => materialiseBrowserTaskAction({
    kind: "browser.semantic_click",
    params: { target: { name: "Duplicate" } },
  }, {
    screen: {
      semanticTargets: {
        available: true,
        inventorySha256: "b".repeat(64),
        frame: { sha256: "a".repeat(64), sequence: 2 },
        items: [1, 2].map((index) => ({
          targetId: `frame-2-target-${index}`,
          role: "button",
          name: "Duplicate",
          visible: true,
          disabled: false,
        })),
      },
    },
  }), /semantic_target_selection_ambiguous/u);
});

test("browser task action contract materialises transient semantic type input", () => {
  const action = materialiseBrowserTaskAction({
    kind: "browser.semantic_type",
    params: { target: { name: "Work", role: "textbox" }, text: "transient private input" },
  }, {
    screen: {
      semanticTargets: {
        available: true,
        inventorySha256: "b".repeat(64),
        frame: { sha256: "a".repeat(64), sequence: 9 },
        items: [{
          targetId: "frame-9-target-1",
          role: "textbox",
          name: "Work",
          visible: true,
          disabled: false,
        }],
      },
    },
  });
  assert.equal(action.params.semanticTarget.operation, "type");
  assert.equal(action.params.text, "transient private input");
  assert.equal(screenActEndpointForBrowserTaskAction(action.kind), "/act/keyboard/type");
  assert.equal(capabilityIdForBrowserTaskAction(action.kind), "act.screen.pointer_keyboard");
});

test("browser task action recovery prepares once and retries a capture interruption", async () => {
  const calls = [];
  const responses = [
    { ok: true, action: { result: "blocked-or-degraded", mediation: { reason: "trusted_sidecar_capture_source_unavailable" } } },
    { ok: true, action: { result: "executed-browser-runtime", mediation: { accepted: true, transport: "trusted-sidecar-ipc" } } },
  ];
  const result = await executeBrowserTaskActionWithCaptureRecovery({
    action: { kind: "browser.new_tab", params: { url: "https://example.com/recovered" } },
    postAction: async (endpoint, params) => {
      calls.push({ kind: "action", endpoint, params });
      return responses.shift();
    },
    prepareWorkView: async () => {
      calls.push({ kind: "prepare" });
      return { ok: true };
    },
  });
  assert.deepEqual(calls.map((call) => call.kind), ["action", "prepare", "action"]);
  assert.equal(result.action.result, "executed-browser-runtime");
  assert.deepEqual(result.action.recovery, {
    attempted: true,
    boundedAttempts: 1,
    reason: "trusted_sidecar_capture_source_unavailable",
    action: "prepare_work_view",
    prepareOk: true,
    firstResult: "blocked-or-degraded",
    retryResult: "executed-browser-runtime",
  });
});

test("browser task action recovery does not retry unrelated action failures", async () => {
  let prepareCalls = 0;
  const result = await executeBrowserTaskActionWithCaptureRecovery({
    action: { kind: "mouse.click", params: { x: 1, y: 2 } },
    postAction: async () => ({
      ok: true,
      action: { result: "blocked-or-degraded", mediation: { reason: "trusted_helper_lease_not_ready" } },
    }),
    prepareWorkView: async () => {
      prepareCalls += 1;
      return { ok: true };
    },
  });
  assert.equal(prepareCalls, 0);
  assert.equal(result.action.recovery, undefined);
});

test("browser task semantic action recovery refreshes authority before retry", async () => {
  const calls = [];
  const firstAction = { kind: "browser.semantic_click", params: { semanticTarget: { targetId: "frame-1-target-1" } } };
  const refreshedAction = { kind: "browser.semantic_click", params: { semanticTarget: { targetId: "frame-2-target-1" } } };
  const result = await executeBrowserTaskActionWithCaptureRecovery({
    action: firstAction,
    postAction: async (endpoint, params) => {
      calls.push({ endpoint, targetId: params.semanticTarget.targetId });
      return calls.length === 1
        ? { action: { mediation: { reason: "trusted_sidecar_capture_stale" } } }
        : { action: { result: "executed-browser-runtime" } };
    },
    prepareWorkView: async () => ({ ok: true }),
    refreshAction: async () => refreshedAction,
  });
  assert.deepEqual(calls, [
    { endpoint: "/act/mouse/click", targetId: "frame-1-target-1" },
    { endpoint: "/act/mouse/click", targetId: "frame-2-target-1" },
  ]);
  assert.equal(result.action.result, "executed-browser-runtime");
});

test("browser task verification prefers the post-action observed URL over stale session metadata", () => {
  assert.equal(observedBrowserTaskUrl({
    workViewSummary: { url: "https://example.com/after-action" },
    workView: { activeUrl: "https://example.com/before-action" },
  }), "https://example.com/after-action");
  assert.equal(observedBrowserTaskUrl({
    workView: { activeUrl: "https://example.com/session-only" },
  }), "https://example.com/session-only");
});

test("browser task verification canonicalises only the HTTP(S) origin slash", () => {
  assert.equal(normaliseBrowserTaskVerificationUrl("https://www.baidu.com"), "https://www.baidu.com");
  assert.equal(normaliseBrowserTaskVerificationUrl("https://www.baidu.com/"), "https://www.baidu.com");
  assert.equal(normaliseBrowserTaskVerificationUrl("https://www.baidu.com?tab=home"), "https://www.baidu.com?tab=home");
  assert.equal(normaliseBrowserTaskVerificationUrl("https://www.baidu.com/?tab=home"), "https://www.baidu.com?tab=home");
  assert.equal(normaliseBrowserTaskVerificationUrl("https://www.baidu.com/search/"), "https://www.baidu.com/search/");
  assert.equal(normaliseBrowserTaskVerificationUrl("file:///tmp/secret"), "file:///tmp/secret");
  assert.equal(normaliseBrowserTaskVerificationUrl("not a url"), "not a url");
});

test("browser task action contract preserves the legacy unknown-action click fallback", () => {
  assert.equal(screenActEndpointForBrowserTaskAction("legacy.unknown"), "/act/mouse/click");
  assert.equal(capabilityIdForBrowserTaskAction("legacy.unknown"), null);
});
