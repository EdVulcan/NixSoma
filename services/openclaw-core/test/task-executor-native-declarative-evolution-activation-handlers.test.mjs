import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionActivationDecisionTaskHandlers,
} from "../src/task-executor-native-declarative-evolution-activation-handlers.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
} from "../src/native-declarative-evolution-activation-decision.mjs";

function createTask(overrides = {}) {
  const binding = {
    kind: "native_declarative_evolution_activation_decision",
    sourceStagingTaskId: "task-staging",
    candidateHash: "a".repeat(64),
    stagedFileHash: "b".repeat(64),
    evaluatedClosurePath: "/nix/store/abc123-openclaw-system",
    hostHealthHash: "c".repeat(64),
    decision: "approve_activation_review",
  };
  return {
    id: "task-activation",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
    status: "queued",
    plan: { strategy: "native-declarative-evolution-activation-decision-v0" },
    policy: { decision: { decision: "audit_only", reason: "test" } },
    approval: { requestId: "approval-activation", status: "approved" },
    nativeDeclarativeEvolution: {
      activationDecision: binding,
      governance: {
        writesManagedConfig: false,
        switchesGeneration: false,
        executesActivation: false,
        executesRollback: false,
      },
    },
    ...overrides,
  };
}

function createHarness({ review = null, task = createTask(), approval = null } = {}) {
  const events = [];
  const approvals = new Map([["approval-activation", approval ?? {
    id: "approval-activation",
    status: "approved",
    binding: task.nativeDeclarativeEvolution.activationDecision,
  }]]);
  const state = { approvals };
  const taskManager = {
    serialiseTask: (value) => value,
    isActiveTask: () => true,
    setTaskPhase: async (value, phase, options) => {
      value.status = options.status;
      value.executionPhase = phase;
      return value;
    },
    completeTask: (value, details) => {
      value.status = "completed";
      value.outcome = { kind: "completed", details };
      return value;
    },
    failTask: (value, reason, details) => {
      value.status = "failed";
      value.outcome = { kind: "failed", reason, details };
      return value;
    },
  };
  const handlers = createNativeDeclarativeEvolutionActivationDecisionTaskHandlers({
    state,
    taskManager,
    approvalEngine: { serialiseApproval: (value) => value },
    policyEvaluator: {
      ensureTaskPolicy: (value) => value.policy,
      isPolicyExecutionAllowed: () => true,
    },
    planBuilder: {
      buildNativeDeclarativeEvolutionActivationDecisionReview: async () => review,
    },
    publishEvent: async (name, body) => events.push({ name, body }),
  });
  return { handlers, events, task, approvals };
}

function healthyReview(task = "task-staging") {
  return {
    ok: true,
    blocked: false,
    sourceTaskId: task,
    activationReady: true,
    hostHealth: { status: "healthy" },
    binding: {
      kind: "native_declarative_evolution_activation_decision",
      sourceStagingTaskId: "task-staging",
      candidateHash: "a".repeat(64),
      stagedFileHash: "b".repeat(64),
      evaluatedClosurePath: "/nix/store/abc123-openclaw-system",
      hostHealthHash: "c".repeat(64),
    },
  };
}

test("approved activation decision records future approval without activation", async () => {
  const task = createTask();
  const { handlers, events } = createHarness({ task, review: healthyReview() });
  const result = await handlers[0].execute(task);

  assert.equal(result.task.status, "completed");
  assert.equal(result.activationDecision.activation, "approved_for_future_activation");
  assert.equal(result.activationDecision.governance.executesActivation, false);
  assert.equal(result.activationDecision.governance.switchesGeneration, false);
  assert.equal(result.activationDecision.governance.executesRollback, false);
  assert.equal(result.verification.ok, true);
  assert.equal(events.filter((event) => event.name === "task.completed").length, 1);
});

test("activation decision fails before any activation when host binding changes", async () => {
  const task = createTask();
  const review = healthyReview();
  review.binding.hostHealthHash = "d".repeat(64);
  const { handlers, events } = createHarness({ task, review });
  const result = await handlers[0].execute(task);

  assert.equal(result.task.status, "failed");
  assert.equal(result.task.outcome.details.reason, "activation_decision_binding_changed");
  assert.equal(events.filter((event) => event.name === "task.failed").length, 1);
  assert.equal(task.nativeDeclarativeEvolution.execution, undefined);
});

test("activation decision remains blocked until approval is present", async () => {
  const task = createTask({ approval: { requestId: "approval-activation", status: "pending" } });
  const { handlers } = createHarness({
    task,
    review: healthyReview(),
    approval: { id: "approval-activation", status: "pending", binding: task.nativeDeclarativeEvolution.activationDecision },
  });
  const result = await handlers[0].execute(task);

  assert.equal(result.blocked, true);
  assert.equal(result.reason, "policy_requires_approval");
  assert.equal(task.status, "queued");
});
