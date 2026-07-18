import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { observerClientConfigDomDeclarativeEvolutionScript } from "../src/client-script-config-dom-declarative-evolution.mjs";
import { observerClientDeclarativeEvolutionRefreshersScript } from "../src/client-script-refreshers-declarative-evolution.mjs";
import { observerClientDeclarativeEvolutionRenderersScript } from "../src/client-script-renderers-declarative-evolution.mjs";
import { observerDeclarativeEvolutionPanels } from "../src/observer-panels-declarative-evolution.mjs";

function element({ value = "" } = {}) {
  return {
    value,
    disabled: false,
    textContent: "",
    listeners: new Map(),
    focus() {
      this.focused = true;
    },
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
  };
}

function createRendererContext() {
  return {
    declarativeEvolutionActivationRegistry: element(),
    declarativeEvolutionHealthGateStatus: element(),
    declarativeEvolutionHostHealthStatus: element(),
    declarativeEvolutionHostHealthOracle: element(),
    declarativeEvolutionActivationReady: element(),
    declarativeEvolutionReviewJson: element(),
    declarativeEvolutionActivationTaskId: element(),
    declarativeEvolutionActivationApprovalId: element(),
    declarativeEvolutionDecisionTaskIdInput: element(),
    declarativeEvolutionExecutionTaskId: element(),
    declarativeEvolutionExecutionStatus: element(),
    declarativeEvolutionActivationButton: element(),
    declarativeEvolutionDecisionJson: element(),
    declarativeEvolutionExecutionJson: element(),
  };
}

test("Observer exposes the declarative-evolution activation decision panel", () => {
  const panel = observerDeclarativeEvolutionPanels();
  for (const token of [
    "declarative-evolution-source-task-id",
    "declarative-evolution-decision-task-id",
    "declarative-evolution-decision",
    "declarative-evolution-refresh-button",
    "declarative-evolution-decision-button",
    "declarative-evolution-activation-button",
    "declarative-evolution-host-health-oracle",
    "declarative-evolution-review-json",
    "declarative-evolution-decision-json",
    "declarative-evolution-execution-json",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.match(observerClientConfigDomDeclarativeEvolutionScript, /declarativeEvolutionSourceTaskIdInput/u);
  assert.match(observerClientDeclarativeEvolutionRefreshersScript, /confirm: true/u);
  assert.match(observerClientDeclarativeEvolutionRenderersScript, /candidateHash/u);
  assert.match(observerClientDeclarativeEvolutionRenderersScript, /rollbackEvidence/u);
});

test("Observer renders a compact host-health-bound activation review", () => {
  const context = createRendererContext();
  vm.runInNewContext(observerClientDeclarativeEvolutionRenderersScript, context);

  context.renderDeclarativeEvolutionActivationReview({
    ok: true,
    blocked: false,
    registry: "openclaw-native-declarative-evolution-activation-decision-v0",
    sourceTaskId: "staging-task-1",
    candidate: { candidateHash: "a".repeat(64), targetPath: "/etc/nixos/openclaw-managed.nix" },
    healthGate: {
      assessment: "eligible_for_activation_review",
      candidateHash: "a".repeat(64),
      stagedFileHash: "b".repeat(64),
      evaluatedClosurePath: "/nix/store/example-system",
    },
    hostHealth: {
      status: "healthy",
      hostHealthHash: "c".repeat(64),
      registry: "openclaw-native-declarative-evolution-host-health-oracle-v0",
      owner: "openclaw-core-host-health-oracle",
    },
    activationReady: true,
    binding: {
      sourceStagingTaskId: "staging-task-1",
      candidateHash: "a".repeat(64),
      stagedFileHash: "b".repeat(64),
      evaluatedClosurePath: "/nix/store/example-system",
      hostHealthHash: "c".repeat(64),
    },
    governance: { executesActivation: false, writesManagedConfig: false },
  });

  assert.equal(context.declarativeEvolutionActivationRegistry.textContent, "openclaw-native-declarative-evolution-activation-decision-v0");
  assert.equal(context.declarativeEvolutionHealthGateStatus.textContent, "eligible_for_activation_review");
  assert.equal(context.declarativeEvolutionHostHealthStatus.textContent, "healthy");
  assert.equal(context.declarativeEvolutionHostHealthOracle.textContent, "openclaw-core-host-health-oracle");
  assert.equal(context.declarativeEvolutionActivationReady.textContent, "true");
  assert.match(context.declarativeEvolutionReviewJson.textContent, /staging-task-1/u);
  assert.match(context.declarativeEvolutionReviewJson.textContent, /hostHealthHash/u);
  assert.match(context.declarativeEvolutionReviewJson.textContent, /hostHealthOracle/u);
  assert.match(context.declarativeEvolutionReviewJson.textContent, /closureIntegrityReceiptHash/u);
  assert.doesNotMatch(context.declarativeEvolutionReviewJson.textContent, /services\.openclaw\.components/u);
});

test("Observer renders manual rollback evidence in activation execution readback", () => {
  const context = createRendererContext();
  vm.runInNewContext(observerClientDeclarativeEvolutionRenderersScript, context);

  context.renderDeclarativeEvolutionActivationExecution({
    ok: false,
    task: {
      id: "activation-task-1",
      status: "failed",
      nativeDeclarativeEvolution: {
        activation: {
          candidateHash: "a".repeat(64),
        },
        execution: {
          status: "failed",
          activationExecuted: true,
          generationSwitched: true,
          postActivationHealth: { status: "degraded" },
          rollbackEvidence: {
            status: "manual_operator_required",
            owner: "deferred_manual_operator",
            governance: {
              automaticRollback: false,
              executesRollback: false,
            },
          },
          executionReceipt: { receiptHash: "b".repeat(64) },
        },
      },
    },
  });

  assert.equal(context.declarativeEvolutionExecutionStatus.textContent, "failed");
  assert.match(context.declarativeEvolutionExecutionJson.textContent, /manual_operator_required/u);
  assert.match(context.declarativeEvolutionExecutionJson.textContent, /deferred_manual_operator/u);
  assert.match(context.declarativeEvolutionExecutionJson.textContent, /automaticRollback/u);
  assert.match(context.declarativeEvolutionExecutionJson.textContent, /false/u);
});

test("Observer queues an explicit activation decision and refreshes existing read models", async () => {
  const sourceTaskIdInput = element({ value: "staging-task-1" });
  const decisionTaskIdInput = element({ value: "decision-task-1" });
  const decision = element({ value: "approve_activation_review" });
  const refreshButton = element();
  const decisionButton = element();
  const activationButton = element();
  const calls = [];
  const refreshes = [];
  const rendered = [];
  const context = {
    declarativeEvolutionSourceTaskIdInput: sourceTaskIdInput,
    declarativeEvolutionDecisionTaskIdInput: decisionTaskIdInput,
    declarativeEvolutionDecision: decision,
    declarativeEvolutionRefreshButton: refreshButton,
    declarativeEvolutionDecisionButton: decisionButton,
    declarativeEvolutionActivationButton: activationButton,
    declarativeEvolutionExecutionTaskId: element(),
    declarativeEvolutionExecutionStatus: element(),
    declarativeEvolutionDecisionJson: element(),
    declarativeEvolutionExecutionJson: element(),
    observerConfig: { coreUrl: "http://core.invalid" },
    formatError: (error) => String(error?.message ?? error),
    setControlMessage: (message) => calls.push(["message", message]),
    renderDeclarativeEvolutionActivationReview: (data) => rendered.push(["review", data]),
    renderDeclarativeEvolutionActivationDecision: (data) => rendered.push(["decision", data]),
    renderDeclarativeEvolutionActivationExecution: (data) => rendered.push(["execution", data]),
    fetchJson: async (url, options) => {
      calls.push(["fetch", url, options]);
      if (!options) {
        return { ok: true, activationReady: true };
      }
      return {
        ok: true,
        review: { ok: true, activationReady: true },
        task: { id: "activation-task-1", status: "queued" },
        approval: { id: "activation-approval-1", status: "pending" },
        approvalBinding: { decision: "approve_activation_review" },
      };
    },
    refreshRuntime: async () => refreshes.push("runtime"),
    refreshTaskList: async () => refreshes.push("tasks"),
    refreshTaskHistoryDetail: async () => refreshes.push("history"),
    refreshApprovalState: async () => refreshes.push("approvals"),
  };

  vm.runInNewContext(observerClientDeclarativeEvolutionRefreshersScript, context);
  await context.refreshDeclarativeEvolutionActivationDecision();
  await context.createDeclarativeEvolutionActivationDecision();
  await context.createDeclarativeEvolutionActivation();

  const fetchCalls = calls.filter(([kind]) => kind === "fetch");
  assert.equal(fetchCalls[0][1], "http://core.invalid/plugins/native-adapter/declarative-evolution/activation-decision?taskId=staging-task-1");
  assert.equal(fetchCalls[1][1], "http://core.invalid/plugins/native-adapter/declarative-evolution/activation-decisions");
  assert.deepEqual(JSON.parse(fetchCalls[1][2].body), {
    taskId: "staging-task-1",
    decision: "approve_activation_review",
    confirm: true,
  });
  assert.equal(fetchCalls[2][1], "http://core.invalid/plugins/native-adapter/declarative-evolution/activation-tasks");
  assert.deepEqual(JSON.parse(fetchCalls[2][2].body), {
    activationDecisionTaskId: "decision-task-1",
    confirm: true,
  });
  assert.deepEqual(rendered.map(([kind]) => kind), ["review", "review", "decision", "execution"]);
  assert.deepEqual(refreshes, ["runtime", "tasks", "history", "approvals", "runtime", "tasks", "history", "approvals"]);
  assert.match(calls.at(-1)[1], /Queued activation task activation-task-1/u);
  assert.equal(decisionButton.disabled, false);
  assert.equal(activationButton.disabled, false);
});
