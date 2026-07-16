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
    engineeringContextPacketSourceTask: element(),
    engineeringContextPacketProvider: element(),
    engineeringContextPacketAudit: element(),
    engineeringContextPacketWorkView: element(),
    engineeringContextPacketBinding: element(),
    engineeringContextPacketAuthority: element(),
    engineeringContextPacketCapture: element(),
    engineeringContextPacketTargets: element(),
    engineeringContextPacketSemanticAction: element(),
    engineeringContextPacketPlanTodo: element(),
    engineeringContextPacketExperienceMemory: element(),
    engineeringContextPacketExperienceMemoryPattern: element(),
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
    "engineering-context-packet-capture",
    "engineering-context-packet-targets",
    "engineering-context-packet-semantic-action",
    "engineering-context-packet-plan-todo",
    "engineering-context-packet-experience-memory",
    "engineering-context-packet-source-task",
    "engineering-context-packet-source-task-id-input",
    "engineering-context-packet-use-task-detail-button",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.equal(observerClientConfigDomEngineeringContextScript.includes("engineeringContextPacketRecovery"), true);
  assert.equal(observerClientEngineeringContextRefreshersScript.includes("runRecommendedWorkViewAction"), true);

  const context = rendererContext();
  vm.runInNewContext(observerClientEngineeringContextRenderersScript, context);
  context.renderEngineeringContextPacket({
    summary: {
      workViewAssociationIncluded: true,
      messageCount: 1,
      sourceTaskId: "task-source-1",
      planTodoEvidenceIncluded: true,
      planTodoTodoSource: "workbench_storage",
      planTodoCurrentAction: "create_verification_task",
      experienceMemoryIncluded: true,
      experienceMemoryRecalled: 2,
      experienceMemoryStored: 5,
      experienceMemoryMatched: 3,
      experienceMemoryCompletedMatches: 2,
      experienceMemoryFailedMatches: 1,
      experienceMemoryCompletionRate: 0.67,
      experienceMemoryLatestOutcome: "completed",
      experienceMemoryPattern: "mixed_outcomes",
      experienceMemoryNextAction: "Compare prior completion and failure evidence before repeating; preserve approval and verification.",
      experienceMemoryStatus: "recalled",
      experienceMemoryAdvisoryOnly: true,
      semanticActionDecisionStatus: "blocked",
      semanticActionDecisionReason: "work_view_authority_not_ready",
      semanticActionReady: false,
      semanticActionOperatorControlId: "engineering-context-packet-recovery-button",
    },
    governance: { callsProvider: false },
    workViewAssociation: {
      summary: {
        status: "authority_not_ready",
        workViewId: "work-view-primary",
        bindingStatus: "authority_not_ready",
        actionAuthority: "inactive",
        recoveryAction: "prepare_work_view",
      },
      observation: { status: "ready", freshness: "fresh", semanticTargets: { itemCount: 3 } },
    },
    messages: [],
  });

  assert.equal(context.engineeringContextPacketRecovery.textContent, "prepare_work_view");
  assert.equal(context.engineeringContextPacketSourceTask.textContent, "task-source-1");
  assert.equal(context.engineeringContextPacketRecoveryButton.textContent, "Prepare Trusted Work View");
  assert.equal(context.engineeringContextPacketRecoveryButton.hidden, false);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, false);
  assert.equal(context.engineeringContextPacketCapture.textContent, "ready/fresh");
  assert.equal(context.engineeringContextPacketTargets.textContent, "3");
  assert.equal(context.engineeringContextPacketSemanticAction.textContent, "blocked/work_view_authority_not_ready");
  assert.equal(context.engineeringContextPacketPlanTodo.textContent, "workbench_storage/create_verification_task");
  assert.equal(context.engineeringContextPacketExperienceMemory.textContent, "2/recalled");
  assert.equal(context.engineeringContextPacketExperienceMemoryPattern.textContent, "mixed_outcomes/0.67");
  assert.match(context.engineeringContextPacketJson.textContent, /recovery=prepare_work_view/);
  assert.match(context.engineeringContextPacketJson.textContent, /Experience Memory: included=true recalled=2 stored=5 matched=3 completed=2 failed=1 rate=0.67 latest=completed pattern=mixed_outcomes status=recalled advisoryOnly=true/);
  assert.match(context.engineeringContextPacketJson.textContent, /Experience Memory Next Action: Compare prior completion/);
  assert.match(context.engineeringContextPacketJson.textContent, /Semantic Action Decision: status=blocked reason=work_view_authority_not_ready ready=false control=engineering-context-packet-recovery-button/);

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
    engineeringContextPacketUseTaskDetailButton: element(),
    engineeringContextPacketSourceTaskIdInput: element(),
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
      return { invoked: true, result: { summary: { messageCount: 2 } } };
    },
  };

  vm.runInNewContext(observerClientEngineeringContextRefreshersScript, context);
  await context.prepareEngineeringContextWorkView();

  assert.deepEqual(calls.map(([kind]) => kind), ["recommended-action", "fetch", "render", "message", "message"]);
  assert.equal(calls[1][1], "http://core.invalid/capabilities/invoke");
  const packetRequest = JSON.parse(calls[1][2].body);
  assert.equal(packetRequest.capabilityId, "sense.openclaw.engineering_context.packet");
  assert.equal(packetRequest.params.includeWorkView, true);
  assert.equal(packetRequest.params.sourceTaskId, null);
  assert.match(calls.at(-1)[1], /Completed the trusted work-view recovery action/);
  assert.equal(context.engineeringContextPacketRecoveryButton.disabled, false);
});

test("context packet bind control explicitly requests rebind for stale task association", async () => {
  const calls = [];
  const context = {
    engineeringContextPacketBuildButton: element(),
    engineeringContextPacketBindWorkViewButton: element(),
    engineeringContextPacketRecoveryButton: element(),
    engineeringContextPacketUseTaskDetailButton: element(),
    engineeringContextPacketSourceTaskIdInput: element(),
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
      return { invoked: true, result: { ok: true, changed: true } };
    },
  };
  context.engineeringContextPacketBinding.textContent = "stale_session_binding";

  vm.runInNewContext(observerClientEngineeringContextRefreshersScript, context);
  await context.bindEngineeringContextTaskToWorkView();

  assert.equal(calls[0][1], "http://core.invalid/capabilities/invoke");
  const bindRequest = JSON.parse(calls[0][2].body);
  assert.equal(bindRequest.capabilityId, "act.openclaw.engineering_context.work_view_bind");
  assert.equal(bindRequest.taskId, "task-stale-context-1");
  assert.equal(bindRequest.params.confirm, true);
  assert.equal(bindRequest.params.rebind, true);
  assert.match(calls.at(-1)[1], /Rebound task task-stale-context-1/);
});

test("context packet source picker sends an independent source task and supports explicit task-detail shortcut", async () => {
  const calls = [];
  const context = {
    engineeringContextPacketBuildButton: element(),
    engineeringContextPacketBindWorkViewButton: element(),
    engineeringContextPacketRecoveryButton: element(),
    engineeringContextPacketUseTaskDetailButton: element(),
    engineeringContextPacketSourceTaskIdInput: element(),
    engineeringContextPacketAudit: element(),
    engineeringContextPacketBinding: element(),
    engineeringContextPacketJson: element(),
    taskDetailIdInput: { value: "task-execution-1" },
    observerConfig: { coreUrl: "http://core.invalid" },
    formatError: (error) => String(error?.message ?? error),
    setControlMessage: (message) => calls.push(["message", message]),
    renderEngineeringContextPacket: (data) => calls.push(["render", data]),
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      return { invoked: true, result: { summary: { messageCount: 1 } } };
    },
  };
  context.engineeringContextPacketSourceTaskIdInput.value = "task-source-1";

  vm.runInNewContext(observerClientEngineeringContextRefreshersScript, context);
  await context.refreshEngineeringContextPacket();

  const request = JSON.parse(calls.find(([kind]) => kind === "fetch")[2].body);
  assert.equal(request.capabilityId, "sense.openclaw.engineering_context.packet");
  assert.equal(request.params.taskId, "task-execution-1");
  assert.equal(request.params.sourceTaskId, "task-source-1");

  context.useEngineeringContextTaskDetailAsSource();
  assert.equal(context.engineeringContextPacketSourceTaskIdInput.value, "task-execution-1");
  assert.match(calls.at(-1)[1], /read-only context packet source/);
});
