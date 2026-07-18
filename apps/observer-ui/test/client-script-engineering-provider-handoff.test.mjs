import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientConfigDomEngineeringProviderHandoffScript } from "../src/client-script-config-dom-engineering-provider-handoff.mjs";
import { observerClientEngineeringProviderHandoffRefreshersScript } from "../src/client-script-refreshers-engineering-provider-handoff.mjs";
import { observerClientEngineeringProviderHandoffRenderersScript } from "../src/client-script-renderers-engineering-provider-handoff.mjs";
import { observerEngineeringContextPanels } from "../src/observer-panels-engineering-context.mjs";

function element({ value = "", checked = false } = {}) {
  return {
    disabled: false,
    textContent: "",
    value,
    checked,
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
    "engineering-provider-handoff-include-systemd-incident",
    "Include systemd incident receipt",
    "Create Pending DeepSeek Handoff",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.match(observerClientConfigDomEngineeringProviderHandoffScript, /engineeringProviderHandoffPromptInput/);
  assert.match(observerClientConfigDomEngineeringProviderHandoffScript, /engineeringProviderHandoffSourceTaskIdInput/);
  assert.match(observerClientConfigDomEngineeringProviderHandoffScript, /engineeringProviderHandoffIncludeSystemdIncident/);
  assert.match(observerClientEngineeringProviderHandoffRefreshersScript, /confirm: true/);
  assert.match(observerClientEngineeringProviderHandoffRenderersScript, /renderEngineeringProviderHandoff/);

  const calls = [];
  const context = {
    engineeringProviderHandoffPromptInput: element({ value: "Review the bounded local engineering state." }),
    engineeringProviderHandoffSourceTaskIdInput: element({ value: "source-task-1" }),
    engineeringProviderHandoffResponseContract: element({ value: "engineering_recommendation_v0" }),
    engineeringProviderHandoffIncludeSystemdIncident: element({ checked: false }),
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
                sourceTaskId: "source-task-1",
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
  assert.equal(context.engineeringProviderHandoffPromptInput.disabled, false);
  assert.equal(context.engineeringProviderHandoffResponseContract.disabled, false);
  assert.equal(context.engineeringProviderHandoffResponseContract.value, "engineering_recommendation_v0");
  await context.createEngineeringProviderHandoffTask();

  const request = JSON.parse(calls[0][2].body);
  assert.equal(calls[0][1], "http://core.invalid/capabilities/invoke");
  assert.equal(request.capabilityId, "act.openclaw.engineering_context.provider_handoff_task");
  assert.equal(request.approved, true);
  assert.equal(request.params.confirm, true);
  assert.equal(request.params.liveProviderExecution.credentialReference, "openclaw://credential/deepseek-api-key");
  assert.equal(request.params.liveProviderExecution.requestEnvelope.model, "deepseek-chat");
  assert.equal(request.params.liveProviderExecution.requestEnvelope.messages[0].content, "Review the bounded local engineering state.");
  assert.deepEqual(request.params.liveProviderExecution.contextPacket, {
    requested: true,
    sourceTaskId: "source-task-1",
  });
  assert.equal(context.engineeringProviderHandoffStatus.textContent, "pending");
  assert.equal(context.engineeringProviderHandoffTask.textContent, "provider-task-1");
  assert.equal(context.engineeringProviderHandoffApproval.textContent, "provider-approval-1");
  assert.equal(context.engineeringProviderHandoffJson.textContent.includes("Review the bounded local engineering state."), false);
  assert.match(context.engineeringProviderHandoffJson.textContent, /sourceTask=source-task-1/);
  assert.doesNotMatch(context.engineeringProviderHandoffJson.textContent, /sk-[A-Za-z0-9_-]{16,}/u);
  assert.match(calls.at(-1)[1], /Created pending DeepSeek handoff task provider-task-1/);
});

test("Observer creates a fixed systemd incident handoff without caller request text", async () => {
  const calls = [];
  const context = {
    engineeringProviderHandoffPromptInput: element({ value: "" }),
    engineeringProviderHandoffSourceTaskIdInput: element({ value: "systemd-repair-task-1" }),
    engineeringProviderHandoffResponseContract: element({ value: "engineering_plan_v0" }),
    engineeringProviderHandoffIncludeSystemdIncident: element({ checked: true }),
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
            id: "provider-incident-task-1",
            status: "queued",
            cloudConsciousnessLiveProviderEgressExecution: {
              requestBinding: {
                provider: "deepseek",
                model: "deepseek-chat",
                sourceTaskId: "systemd-repair-task-1",
                requestContentHash: "r".repeat(64),
              },
              systemdIncidentContext: {
                registry: "openclaw-systemd-incident-provider-context-v0",
                target: { unit: "openclaw-event-hub.service", healthServiceKey: "eventHub" },
                restoredHealthy: false,
              },
            },
          },
          approval: { id: "provider-incident-approval-1", status: "pending" },
          governance: { createsTask: true, createsApproval: true, providerCall: false },
        },
        summary: { systemdIncidentContextIncluded: true },
      };
    },
  };

  vm.runInNewContext(observerClientEngineeringProviderHandoffRenderersScript, context);
  vm.runInNewContext(observerClientEngineeringProviderHandoffRefreshersScript, context);
  assert.equal(context.engineeringProviderHandoffPromptInput.disabled, true);
  assert.equal(context.engineeringProviderHandoffResponseContract.disabled, true);
  assert.equal(context.engineeringProviderHandoffResponseContract.value, "engineering_recommendation_v0");
  await context.createEngineeringProviderHandoffTask();

  const request = JSON.parse(calls[0][2].body);
  const execution = request.params.liveProviderExecution;
  assert.equal(execution.requestEnvelope, undefined);
  assert.equal(execution.responseContract, "engineering_recommendation_v0");
  assert.deepEqual(execution.contextPacket, {
    requested: true,
    sourceTaskId: "systemd-repair-task-1",
    includeSystemdIncidentReceipt: true,
  });
  assert.match(context.engineeringProviderHandoffJson.textContent, /Systemd incident: included=true/u);
  assert.match(context.engineeringProviderHandoffJson.textContent, /openclaw-event-hub\.service/u);
  assert.doesNotMatch(context.engineeringProviderHandoffJson.textContent, /private|journal message/u);
  assert.match(calls.at(-1)[1], /pending systemd incident diagnosis task provider-incident-task-1/u);
});
