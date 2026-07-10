import test from "node:test";
import assert from "node:assert/strict";

import {
  BROWSER_TASK_ACTION_DESCRIPTORS,
  browserTaskActionsForExecution,
  capabilityIdForBrowserTaskAction,
  executeBrowserTaskActionWithCaptureRecovery,
  observedBrowserTaskUrl,
  screenActEndpointForBrowserTaskAction,
} from "../src/browser-task-action-contract.mjs";

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

test("browser task verification prefers the post-action observed URL over stale session metadata", () => {
  assert.equal(observedBrowserTaskUrl({
    workViewSummary: { url: "https://example.com/after-action" },
    workView: { activeUrl: "https://example.com/before-action" },
  }), "https://example.com/after-action");
  assert.equal(observedBrowserTaskUrl({
    workView: { activeUrl: "https://example.com/session-only" },
  }), "https://example.com/session-only");
});

test("browser task action contract preserves the legacy unknown-action click fallback", () => {
  assert.equal(screenActEndpointForBrowserTaskAction("legacy.unknown"), "/act/mouse/click");
  assert.equal(capabilityIdForBrowserTaskAction("legacy.unknown"), null);
});
