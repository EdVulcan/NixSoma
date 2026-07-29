import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserCurrentTabCloseCapabilityHandlers } from "../src/capability-runtime-browser-current-tab-close.mjs";

const capability = { id: "act.browser.current_tab.close" };
const request = {
  operation: "browser.current_tab.close",
  intent: null,
  taskId: null,
  stepId: null,
  params: { confirm: true },
};
const rawBody = {
  capabilityId: capability.id,
  operation: request.operation,
  params: { confirm: true },
};

function ownerResponse(effect = {}) {
  return {
    ok: true,
    action: {
      kind: "browser.current_tab.close",
      result: "executed-browser-runtime",
      degraded: false,
      mediation: {
        attempted: true,
        accepted: true,
        status: "accepted",
        reason: null,
        leaseMatched: true,
        transport: "trusted-sidecar-ipc",
        effect: {
          registry: "openclaw-browser-current-tab-close-v0",
          operation: "browser.current_tab.close",
          status: "closed",
          tabCountBefore: 3,
          tabCountAfter: 2,
          currentTabClosed: true,
          activeTabChanged: true,
          lastTabPreserved: true,
          callerSelectedTab: false,
          automaticCleanup: false,
          browserProcessControlled: false,
          browserWindowControlled: false,
          desktopTakeover: false,
          ...effect,
        },
      },
    },
  };
}

test("current-tab close delegates one parameter-free action and keeps compact evidence", async () => {
  const calls = [];
  const handlers = createBrowserCurrentTabCloseCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async (url, body) => {
      calls.push({ url, body });
      return ownerResponse();
    },
  });

  assert.equal(handlers.validateRequest(capability, request, rawBody), null);
  const backend = await handlers.callBackend(capability);
  const summary = handlers.summariseResult(capability, backend.result);

  assert.deepEqual(calls, [{
    url: "http://screen-act/act/browser/current-tab/close",
    body: {},
  }]);
  assert.equal(backend.result.ok, true);
  assert.equal(backend.result.governance.currentTabOnly, true);
  assert.equal(backend.result.governance.callerTabSelection, false);
  assert.equal(backend.result.governance.automaticCleanup, false);
  assert.equal(backend.result.governance.maximumActions, 1);
  assert.equal(summary.browserRuntimeExecuted, true);
  assert.equal(summary.tabCountBefore, 3);
  assert.equal(summary.tabCountAfter, 2);
  assert.equal(summary.minimumTabPreserved, true);
  assert.equal(summary.noProcessOrWindowControl, true);
  assert.equal(summary.noPayloadExposure, true);
  assert.equal(JSON.stringify(backend.result).includes("tabId"), false);
  assert.equal(JSON.stringify(backend.result).includes("http"), false);
});

test("current-tab close rejects caller authority and fails closed on altered owner evidence", async () => {
  const handlers = createBrowserCurrentTabCloseCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async () => ownerResponse({ tabCountAfter: 1 }),
  });

  assert.match(handlers.validateRequest(capability, {
    ...request,
    params: { confirm: true, tabId: "caller-tab" },
  }, {
    ...rawBody,
    params: { confirm: true, tabId: "caller-tab" },
  }), /accepts only/u);
  assert.match(handlers.validateRequest(capability, {
    ...request,
    params: { confirm: false },
  }, {
    ...rawBody,
    params: { confirm: false },
  }), /confirm=true/u);
  assert.match(handlers.validateRequest(capability, request, {
    ...rawBody,
    automatic: true,
  }), /accepts only/u);

  const altered = await handlers.callBackend(capability);
  assert.equal(altered.result.ok, false);
  assert.equal(altered.result.summary.browserRuntimeExecuted, false);
  assert.equal(altered.result.action.mediation.effect.contractMatched, false);
});

test("current-tab close leaves unrelated capabilities untouched", async () => {
  const handlers = createBrowserCurrentTabCloseCapabilityHandlers({ screenActUrl: "http://screen-act" });
  assert.deepEqual(await handlers.callBackend({ id: "act.browser.open" }), {
    handled: false,
    result: null,
  });
  assert.equal(handlers.validateRequest({ id: "act.browser.open" }, request, rawBody), null);
  assert.equal(handlers.summariseResult({ id: "act.browser.open" }, {}), null);
});
