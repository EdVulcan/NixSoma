import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientConfigDomEngineeringProviderHandoffScript } from "../src/client-script-config-dom-engineering-provider-handoff.mjs";
import { observerClientEngineeringProviderHandoffRefreshersScript } from "../src/client-script-refreshers-engineering-provider-handoff.mjs";
import { observerClientEngineeringProviderHandoffRenderersScript } from "../src/client-script-renderers-engineering-provider-handoff.mjs";
import { observerEngineeringContextPanels } from "../src/observer-panels-engineering-context.mjs";

function element({ value = "" } = {}) {
  return {
    disabled: false,
    textContent: "",
    value,
    listeners: new Map(),
    focus() {},
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
  };
}

test("Observer exposes the explicit pending provider handoff task control", async () => {
  const panel = observerEngineeringContextPanels();
  for (const token of [
    "engineering-provider-handoff-prompt-input",
    "engineering-provider-handoff-create-button",
    "engineering-provider-handoff-status",
    "engineering-provider-handoff-json",
    "Create Pending DeepSeek Handoff",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.match(observerClientConfigDomEngineeringProviderHandoffScript, /engineeringProviderHandoffPromptInput/);
  assert.match(observerClientEngineeringProviderHandoffRefreshersScript, /confirm: true/);
  assert.match(observerClientEngineeringProviderHandoffRenderersScript, /renderEngineeringProviderHandoff/);

  const calls = [];
  const context = {
    engineeringProviderHandoffPromptInput: element({ value: "Review the bounded local engineering state." }),
    engineeringProviderHandoffCreateButton: element(),
    engineeringProviderHandoffStatus: element(),
    engineeringProviderHandoffTask: element(),
    engineeringProviderHandoffApproval: element(),
    engineeringProviderHandoffJson: element(),
    observerConfig: { coreUrl: "http://core.invalid" },
    formatError: (error) => String(error?.message ?? error),
    setControlMessage: (message) => calls.push(["message", message]),
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      return {
        ok: true,
        invoked: true,
        capability: { id: "act.openclaw.engineering_context.provider_handoff_task" },
        result: {
          task: {
            id: "provider-task-1",
            status: "queued",
            cloudConsciousnessLiveProviderEgressExecution: {
              requestBinding: {
                provider: "deepseek",
                model: "deepseek-chat",
                requestContentHash: "r".repeat(64),
                requestContentIncluded: false,
                credentialValueIncluded: false,
              },
            },
          },
          approval: { id: "provider-approval-1", status: "pending" },
          governance: {
            createsTask: true,
            createsApproval: true,
            endpointContacted: false,
            networkEgress: false,
            providerCall: false,
          },
        },
        summary: {
          kind: "engineering.provider_handoff_task",
          requestBound: true,
          createsTask: true,
          createsApproval: true,
        },
      };
    },
  };

  vm.runInNewContext(observerClientEngineeringProviderHandoffRenderersScript, context);
  vm.runInNewContext(observerClientEngineeringProviderHandoffRefreshersScript, context);
  await context.createEngineeringProviderHandoffTask();

  const request = JSON.parse(calls[0][2].body);
  assert.equal(calls[0][1], "http://core.invalid/capabilities/invoke");
  assert.equal(request.capabilityId, "act.openclaw.engineering_context.provider_handoff_task");
  assert.equal(request.approved, true);
  assert.equal(request.params.confirm, true);
  assert.equal(request.params.liveProviderExecution.credentialReference, "openclaw://credential/deepseek-api-key");
  assert.equal(request.params.liveProviderExecution.requestEnvelope.model, "deepseek-chat");
  assert.equal(request.params.liveProviderExecution.requestEnvelope.messages[0].content, "Review the bounded local engineering state.");
  assert.equal(context.engineeringProviderHandoffStatus.textContent, "pending");
  assert.equal(context.engineeringProviderHandoffTask.textContent, "provider-task-1");
  assert.equal(context.engineeringProviderHandoffApproval.textContent, "provider-approval-1");
  assert.equal(context.engineeringProviderHandoffJson.textContent.includes("Review the bounded local engineering state."), false);
  assert.doesNotMatch(context.engineeringProviderHandoffJson.textContent, /sk-[A-Za-z0-9_-]{16,}/u);
  assert.match(calls.at(-1)[1], /Created pending DeepSeek handoff task provider-task-1/);
});
