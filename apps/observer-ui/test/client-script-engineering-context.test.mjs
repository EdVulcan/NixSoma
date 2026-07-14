import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientConfigDomEngineeringContextScript } from "../src/client-script-config-dom-engineering-context.mjs";
import { observerClientEngineeringContextRefreshersScript } from "../src/client-script-refreshers-engineering-context.mjs";
import { observerClientEngineeringContextRenderersScript } from "../src/client-script-renderers-engineering-context.mjs";
import { observerEngineeringContextPanels } from "../src/observer-panels-engineering-context.mjs";

function element({ hidden = false } = {}) {
  return {
    disabled: true,
    hidden,
    textContent: "",
    value: "",
    listeners: new Map(),
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
  };
}

function rendererContext() {
  return {
    engineeringContextPacketRegistry: element(),
    engineeringContextPacketRecords: element(),
    engineeringContextPacketMessages: element(),
    engineeringContextPacketRedactions: element(),
    engineeringContextPacketProvider: element(),
    engineeringContextPacketAudit: element(),
    engineeringContextPacketWorkView: element(),
    engineeringContextPacketBinding: element(),
    engineeringContextPacketAuthority: element(),
    engineeringContextPacketRecovery: element(),
    engineeringContextPacketBindWorkViewButton: element(),
    engineeringContextPacketRecoveryButton: element({ hidden: true }),
    engineeringContextPacketJson: element(),
  };
}

test("Observer exposes only the allowlisted trusted work-view recovery actions", () => {
  const panel = observerEngineeringContextPanels();
  for (const token of [
    "engineering-context-packet-recovery",
    "engineering-context-packet-recovery-button",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.equal(observerClientConfigDomEngineeringContextScript.includes("engineeringContextPacketRecovery"), true);
  assert.equal(observerClientEngineeringContextRefreshersScript.includes("runRecommendedWorkViewAction"), true);

  const context = rendererContext();
  vm.runInNewContext(observerClientEngineeringContextRenderersScript, context);
  context.renderEngineeringContextPacket({
    summary: { workViewAssociationIncluded: true, messageCount: 1 },
    governance: { callsProvider: false },
    workViewAssociation: {
      summary: {
        status: "authority_not_ready",
        workViewId: "work-view-primary",
        bindingStatus: "authority_not_ready",
        actionAuthority: "inactive",
        recoveryAction: "prepare_work_view",
      },
    },
    messages: [],
  });

  assert.equal(context.engineeringContextPacketRecovery.textContent, "prepare_work_view");
  assert.equal(context.engineeringContextPacketRecoveryButton.textContent, "Prepare Trusted Work View");
  assert.equal(context.engineeringContextPacketRecoveryButton.hidden, false);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, false);
  assert.match(context.engineeringContextPacketJson.textContent, /recovery=prepare_work_view/);

  context.renderEngineeringContextPacket({
    summary: { workViewAssociationIncluded: true, messageCount: 1 },
    governance: { callsProvider: false },
    workViewAssociation: { summary: { recoveryAction: "reveal_work_view" } },
    messages: [],
  });
  assert.equal(context.engineeringContextPacketRecoveryButton.textContent, "Reveal Trusted Work View");
  assert.equal(context.engineeringContextPacketRecoveryButton.hidden, false);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, false);

  context.renderEngineeringContextPacket({
    summary: { workViewAssociationIncluded: true, messageCount: 1 },
    governance: { callsProvider: false },
    workViewAssociation: { summary: { bindingStatus: "stale_session_binding", recoveryAction: "none" } },
    messages: [],
  });
  assert.equal(context.engineeringContextPacketBindWorkViewButton.textContent, "Rebind Task to Work View");

  context.renderEngineeringContextPacket({
    summary: { workViewAssociationIncluded: true, messageCount: 1 },
    governance: { callsProvider: false },
    workViewAssociation: { summary: { recoveryAction: "unknown_action" } },
    messages: [],
  });
  assert.equal(context.engineeringContextPacketRecoveryButton.hidden, true);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, true);
});

test("context packet recovery button reuses the existing reviewed action and refreshes readback", async () => {
  const calls = [];
  const context = {
    engineeringContextPacketBuildButton: element(),
    engineeringContextPacketBindWorkViewButton: element(),
    engineeringContextPacketRecoveryButton: element(),
    engineeringContextPacketAudit: element(),
    engineeringContextPacketBinding: element(),
    engineeringContextPacketJson: element(),
    taskDetailIdInput: { value: "task-context-1" },
    observerConfig: { coreUrl: "http://core.invalid" },
    formatError: (error) => String(error?.message ?? error),
    setControlMessage: (message) => calls.push(["message", message]),
    runRecommendedWorkViewAction: async () => calls.push(["recommended-action"]),
    renderEngineeringContextPacket: (data) => calls.push(["render", data]),
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      return { summary: { messageCount: 2 } };
    },
  };

  vm.runInNewContext(observerClientEngineeringContextRefreshersScript, context);
  await context.prepareEngineeringContextWorkView();

  assert.deepEqual(calls.map(([kind]) => kind), ["recommended-action", "fetch", "render", "message", "message"]);
  assert.equal(calls[1][1], "http://core.invalid/plugins/native-adapter/engineering-context/packet");
  assert.equal(JSON.parse(calls[1][2].body).includeWorkView, true);
  assert.match(calls.at(-1)[1], /Completed the trusted work-view recovery action/);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, false);
});

test("context packet bind control explicitly requests rebind for stale task association", async () => {
  const calls = [];
  const context = {
    engineeringContextPacketBuildButton: element(),
    engineeringContextPacketBindWorkViewButton: element(),
    engineeringContextPacketRecoveryButton: element(),
    engineeringContextPacketAudit: element(),
    engineeringContextPacketBinding: element(),
    engineeringContextPacketJson: element(),
    taskDetailIdInput: { value: "task-stale-context-1" },
    observerConfig: { coreUrl: "http://core.invalid" },
    formatError: (error) => String(error?.message ?? error),
    setControlMessage: (message) => calls.push(["message", message]),
    renderEngineeringContextPacket: () => {},
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      return { ok: true, changed: true };
    },
  };
  context.engineeringContextPacketBinding.textContent = "stale_session_binding";

  vm.runInNewContext(observerClientEngineeringContextRefreshersScript, context);
  await context.bindEngineeringContextTaskToWorkView();

  assert.equal(JSON.parse(calls[0][2].body).rebind, true);
  assert.match(calls.at(-1)[1], /Rebound task task-stale-context-1/);
});
