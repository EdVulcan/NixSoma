import test from "node:test";
import assert from "node:assert/strict";

import { createScreenActionCapabilityHandlers } from "../src/capability-runtime-screen-actions.mjs";

const capability = { id: "act.screen.pointer_keyboard" };

test("screen keyboard capability delegates keyboard.type and keeps input write-only", async () => {
  const calls = [];
  const input = "transient-input-secret";
  const handlers = createScreenActionCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async (url, body) => {
      calls.push({ url, body });
      return {
        ok: true,
        action: {
          kind: "keyboard.type",
          result: "executed-browser-runtime",
          degraded: false,
          params: { text: input },
          mediation: {
            attempted: true,
            accepted: true,
            status: "accepted",
            reason: "https://example.com/secret-error-url",
            leaseMatched: true,
            transport: "trusted-sidecar-ipc",
            visualGrounding: {
              required: true,
              status: "advanced",
              sequenceAdvanced: true,
              pageUrl: "https://example.com/private",
              dataUrl: "data:image/jpeg;base64,secret",
            },
          },
        },
      };
    },
  });

  const backend = await handlers.callBackend(capability, {
    operation: "keyboard.type",
    params: { text: input },
  });

  assert.equal(backend.handled, true);
  assert.deepEqual(calls, [{
    url: "http://screen-act/act/keyboard/type",
    body: { text: input },
  }]);
  assert.equal(backend.result.ok, true);
  assert.equal(backend.result.governance.ownerContractMatched, true);
  assert.equal(backend.result.governance.writesBrowserInput, true);
  assert.equal(backend.result.governance.exposesInputValue, false);
  assert.equal(backend.result.governance.browserNetworkNavigation, false);
  assert.equal(backend.result.summary.browserRuntimeExecuted, true);
  assert.equal(backend.result.summary.noPayloadExposure, true);
  assert.equal(backend.result.summary.noProviderEgress, true);
  assert.equal(backend.result.action.mediation.reason, "owner_rejected");
  assert.equal(handlers.summariseResult(capability, backend.result).inputValueExposed, false);
  assert.equal(JSON.stringify(backend.result).includes(input), false);
  assert.equal(JSON.stringify(backend.result).includes("data:image/jpeg"), false);
});

test("screen pointer capability delegates only a bounded left click", async () => {
  const calls = [];
  const handlers = createScreenActionCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async (url, body) => {
      calls.push({ url, body });
      return {
        ok: true,
        action: {
          kind: "mouse.click",
          result: "executed-browser-runtime",
          degraded: false,
          params: { x: 640, y: 360, button: "left" },
          mediation: {
            attempted: true,
            accepted: true,
            status: "accepted",
            reason: null,
            leaseMatched: true,
            transport: "trusted-sidecar-ipc",
            visualGrounding: {
              required: true,
              status: "advanced",
              sequenceAdvanced: true,
              pageUrl: "https://example.com/private",
              dataUrl: "data:image/jpeg;base64,secret",
            },
          },
        },
      };
    },
  });

  const backend = await handlers.callBackend(capability, {
    operation: "mouse.click",
    params: { x: 640, y: 360, button: "left" },
  });

  assert.deepEqual(calls, [{
    url: "http://screen-act/act/mouse/click",
    body: { x: 640, y: 360, button: "left" },
  }]);
  assert.equal(backend.result.ok, true);
  assert.equal(backend.result.registry, "openclaw-screen-pointer-capability-v0");
  assert.equal(backend.result.governance.pointerAction, true);
  assert.equal(backend.result.governance.writesBrowserInput, false);
  assert.equal(backend.result.governance.exposesSelectors, false);
  const summary = handlers.summariseResult(capability, backend.result);
  assert.equal(summary.kind, "mouse.click");
  assert.equal(summary.pointerAction, true);
  assert.equal(summary.noPayloadExposure, true);
  assert.equal(JSON.stringify(backend.result).includes("data:image/jpeg"), false);
});

test("screen action capability validates the fixed keyboard and pointer contracts", async () => {
  const handlers = createScreenActionCapabilityHandlers({ screenActUrl: "http://screen-act" });

  assert.equal(handlers.validateRequest(capability, {
    operation: "browser.new_tab",
    params: { text: "hello" },
  }), "Screen action capability only allows keyboard.type or mouse.click.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "keyboard.type",
    params: { text: "hello", semanticTarget: { targetId: "target-1" } },
  }), "Screen keyboard capability only accepts params.text.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "keyboard.type",
    params: { text: "x".repeat(2_001) },
  }), "Screen keyboard capability input must be within 2000 characters.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "keyboard.type",
    params: { text: "hello" },
  }), null);
  assert.equal(handlers.validateRequest(capability, {
    operation: "mouse.click",
    params: { x: 640, y: 360, button: "right" },
  }), "Screen pointer capability only allows the left button.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "mouse.click",
    params: { x: 960, y: 360, button: "left" },
  }), "Screen pointer capability x must be an integer between 0 and 959.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "mouse.click",
    params: { x: 640, y: 360, semanticTarget: { targetId: "target-1" } },
  }), "Screen pointer capability only accepts params.x, params.y, and left button.");
  assert.equal(handlers.validateRequest(capability, {
    operation: "mouse.click",
    params: { x: 640, y: 360, button: "left" },
  }), null);

  const mismatchedOwner = createScreenActionCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async () => ({
      ok: true,
      action: {
        kind: "mouse.click",
        result: "executed-browser-runtime",
        mediation: { attempted: true, accepted: true },
      },
    }),
  });
  const ownerResult = await mismatchedOwner.callBackend(capability, {
    operation: "keyboard.type",
    params: { text: "hello" },
  });
  assert.equal(ownerResult.result.ok, false);
  assert.equal(ownerResult.result.governance.ownerContractMatched, false);

  const unavailable = createScreenActionCapabilityHandlers({ screenActUrl: "http://screen-act" });
  const unavailableResult = await unavailable.callBackend(capability, {
    operation: "keyboard.type",
    params: { text: "hello" },
  });
  assert.equal(unavailableResult.result.action.mediation.reason, "screen_action_owner_unavailable");
});

test("screen action capability leaves unrelated capabilities untouched", async () => {
  const handlers = createScreenActionCapabilityHandlers({
    screenActUrl: "http://screen-act",
    postJson: async () => ({ ok: true }),
  });

  assert.deepEqual(await handlers.callBackend({ id: "sense.screen.observe" }, { params: {} }), {
    handled: false,
    result: null,
  });
  assert.equal(handlers.summariseResult({ id: "sense.screen.observe" }, {}), null);
  assert.equal(handlers.validateRequest({ id: "sense.screen.observe" }, { params: {} }), null);
});
