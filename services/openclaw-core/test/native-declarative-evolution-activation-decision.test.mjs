import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionActivationDecisionBuilders,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
} from "../src/native-declarative-evolution-activation-decision.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
} from "../src/native-declarative-evolution-task-builders.mjs";

function createHarness({ health = null } = {}) {
  const events = [];
  const calls = [];
  const sourceTask = {
    id: "task-staging",
    type: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
    status: "completed",
  };
  const tasks = new Map([[sourceTask.id, sourceTask]]);
  const healthGate = {
    ok: true,
    blocked: false,
    registry: "openclaw-native-declarative-evolution-health-gate-v0",
    taskId: sourceTask.id,
    candidate: {
      candidateHash: "a".repeat(64),
      candidateBytes: 128,
      targetPath: "/etc/nixos/openclaw-managed.nix",
    },
    staging: {
      fileHash: "b".repeat(64),
      fileBytes: 128,
    },
    evaluatedClosure: {
      path: "/nix/store/abc123-openclaw-system",
    },
    failedChecks: [],
    assessment: {
      status: "eligible_for_activation_review",
      eligibleForActivationReview: true,
    },
  };
  let taskNumber = 0;
  const builders = createNativeDeclarativeEvolutionActivationDecisionBuilders({
    tasks,
    buildNativeDeclarativeEvolutionHealthGate: async ({ taskId }) => {
      calls.push({ name: "healthGate", taskId });
      return healthGate;
    },
    fetchJson: async (url) => {
      calls.push({ name: "health", url });
      return health ?? {
        ok: true,
        system: {
          timestamp: "2026-07-17T00:00:00.000Z",
          services: {
            core: { ok: true, status: "healthy" },
            systemSense: { ok: true, status: "healthy" },
          },
          alerts: [],
          network: { online: true },
        },
      };
    },
    systemSenseUrl: "http://127.0.0.1:4106",
    autonomyMode: "guardian",
    evaluatePolicyIntent: (input) => ({
      decision: "require_approval",
      approved: false,
      intent: input.policy.intent,
      risk: input.policy.risk,
    }),
    createTask: (input) => ({ id: `task-${++taskNumber}`, status: "queued", ...input }),
    createApprovalRequestForTask: (task) => {
      const approval = {
        id: `approval-${task.id}`,
        status: "pending",
        binding: task.nativeDeclarativeEvolution.approvalBinding,
      };
      task.approval = approval;
      return approval;
    },
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: () => {},
    persistState: () => {},
    publishEvent: async (name, body) => events.push({ name, body }),
    publishTaskApprovalIfPending: async () => {},
    serialiseTask: (task) => task,
    serialisePlanForPublic: (plan) => plan,
    now: () => "2026-07-17T00:01:00.000Z",
  });
  return { builders, tasks, events, calls, sourceTask };
}

test("activation decision review binds candidate, closure, and healthy host fingerprint", async () => {
  const { builders, calls } = createHarness();

  const review = await builders.buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId: "task-staging" });

  assert.equal(review.ok, true);
  assert.equal(review.blocked, false);
  assert.equal(review.registry, NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY);
  assert.equal(review.activationReady, true);
  assert.equal(review.hostHealth.status, "healthy");
  assert.equal(review.healthGate.candidateHash, "a".repeat(64));
  assert.equal(review.binding.stagedFileHash, "b".repeat(64));
  assert.equal(review.binding.evaluatedClosurePath, "/nix/store/abc123-openclaw-system");
  assert.match(review.binding.hostHealthHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(calls.map((call) => call.name), ["healthGate", "health"]);
});

test("activation decision blocks approval creation when host health is degraded", async () => {
  const { builders } = createHarness({
    health: {
      ok: true,
      system: {
        timestamp: "2026-07-17T00:00:00.000Z",
        services: { core: { ok: false, status: "failed" } },
        alerts: [{ code: "service.offline" }],
        network: { online: true },
      },
    },
  });

  const review = await builders.buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId: "task-staging" });
  assert.equal(review.activationReady, false);
  assert.equal(review.hostHealth.status, "degraded");
  await assert.rejects(
    () => builders.createNativeDeclarativeEvolutionActivationDecisionTask({
      taskId: "task-staging",
      decision: "approve_activation_review",
      confirm: true,
    }),
    /requires healthy host state/,
  );
});

test("activation decision task stores only compact binding and requires confirmation", async () => {
  const { builders, events } = createHarness();

  await assert.rejects(
    () => builders.createNativeDeclarativeEvolutionActivationDecisionTask({
      taskId: "task-staging",
      decision: "reject_activation",
      confirm: false,
    }),
    /requires confirm=true/,
  );
  const result = await builders.createNativeDeclarativeEvolutionActivationDecisionTask({
    taskId: "task-staging",
    decision: "reject_activation",
    confirm: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.task.type, NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE);
  assert.equal(result.approval.binding.decision, "reject_activation");
  assert.equal(result.task.nativeDeclarativeEvolution.activationDecision.candidateHash, "a".repeat(64));
  assert.equal(result.task.nativeDeclarativeEvolution.approvalBinding.decision, "reject_activation");
  assert.equal(result.task.nativeDeclarativeEvolution.approvalBinding.hostHealthHash.length, 64);
  assert.equal("review" in result.task.nativeDeclarativeEvolution.approvalBinding, false);
  assert.equal(result.task.nativeDeclarativeEvolution.governance.executesActivation, false);
  assert.equal(result.task.nativeDeclarativeEvolution.governance.switchesGeneration, false);
  assert.equal(JSON.stringify(result).includes("services.openclaw.components"), false);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(events.filter((event) => event.name === "task.planned").length, 1);
});

test("activation decision review fails closed for a non-staging source", async () => {
  const { builders, tasks } = createHarness();
  tasks.set("task-other", { id: "task-other", type: "browser_task", status: "completed" });

  const review = await builders.buildNativeDeclarativeEvolutionActivationDecisionReview({ taskId: "task-other" });
  assert.equal(review.ok, false);
  assert.equal(review.blocked, true);
  assert.equal(review.reason, "task_is_not_declarative_evolution_staging");
});
