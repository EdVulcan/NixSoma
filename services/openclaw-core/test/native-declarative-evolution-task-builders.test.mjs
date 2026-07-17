import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionTaskBuilders,
  NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
} from "../src/native-declarative-evolution-task-builders.mjs";

function createHarness() {
  const calls = [];
  const events = [];
  let taskNumber = 0;
  const buildCandidate = async ({ changes }) => ({
    ok: true,
    registry: "openclaw-native-declarative-evolution-candidate-v0",
    candidateStatus: "validated",
    target: { path: "/etc/nixos/openclaw-managed.nix", activation: "manual-only" },
    changes,
    candidateHash: "a".repeat(64),
    candidateBytes: 180,
    candidateText: "secret candidate body must remain transient",
    validation: { status: "passed", mode: "test-validator", resultType: "set" },
  });
  const builders = createNativeDeclarativeEvolutionTaskBuilders({
    buildNativeDeclarativeEvolutionCandidate: buildCandidate,
    stagingDirectory: "/var/lib/openclaw/managed-config-staging",
    autonomyMode: "guardian",
    evaluatePolicyIntent: (input, context) => ({
      id: "policy-1",
      stage: context.stage,
      subject: { type: input.type, goal: input.goal, intent: input.policy.intent },
      domain: input.policy.domain,
      risk: input.policy.risk,
      decision: "require_approval",
      reason: "approval_required",
      approved: false,
      autonomyMode: "guardian",
      autonomous: false,
    }),
    createTask: (input) => {
      const task = { id: `task-${++taskNumber}`, status: "queued", ...input };
      calls.push({ name: "createTask", task });
      return task;
    },
    createApprovalRequestForTask: (task) => {
      const approval = {
        id: `approval-${task.id}`,
        status: "pending",
        taskId: task.id,
        binding: task.nativeDeclarativeEvolution?.approvalBinding ?? null,
      };
      task.approval = approval;
      calls.push({ name: "createApprovalRequestForTask", approval });
      return approval;
    },
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: () => calls.push({ name: "reconcileRuntimeState" }),
    persistState: () => calls.push({ name: "persistState" }),
    publishEvent: async (name, body) => events.push({ name, body }),
    publishTaskApprovalIfPending: async (task) => events.push({ name: "approval.pending", taskId: task.id }),
    serialiseTask: (task) => ({
      id: task.id,
      type: task.type,
      nativeDeclarativeEvolution: task.nativeDeclarativeEvolution ?? null,
      plan: task.plan,
    }),
    serialisePlanForPublic: (plan) => plan,
  });
  return { builders, calls, events };
}

test("declarative evolution staging task binds approval and execution to one candidate hash", async () => {
  const { builders, calls, events } = createHarness();
  const changes = [{ operation: "enable_component", component: "systemSense" }];
  const result = await builders.createNativeDeclarativeEvolutionStagingTask({ changes, confirm: true });

  assert.equal(result.ok, true);
  assert.equal(result.registry, NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY);
  assert.equal(result.task.type, NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE);
  assert.equal(result.task.nativeDeclarativeEvolution.candidate.candidateHash, "a".repeat(64));
  assert.equal(result.approval.binding.candidateHash, "a".repeat(64));
  assert.equal(result.approvalBinding.candidateHash, result.task.nativeDeclarativeEvolution.candidate.candidateHash);
  assert.equal(result.task.plan.governance.approvalBoundToCandidateHash, true);
  assert.equal(result.governance.createsTask, true);
  assert.equal(result.governance.createsApproval, true);
  assert.equal(JSON.stringify(result).includes("secret candidate body"), false);
  assert.equal(JSON.stringify(events).includes("secret candidate body"), false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 1);
});

test("declarative evolution staging task requires explicit confirmation", async () => {
  const { builders } = createHarness();
  await assert.rejects(
    () => builders.createNativeDeclarativeEvolutionStagingTask({ changes: [], confirm: false }),
    /requires confirm=true/,
  );
});
