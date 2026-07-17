import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionActivationBuilders,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
} from "../src/native-declarative-evolution-activation.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
} from "../src/native-declarative-evolution-activation-decision.mjs";

const candidateHash = "a".repeat(64);
const stagedFileHash = "b".repeat(64);
const closurePath = "/nix/store/abc123-openclaw-system";
const derivationPath = "/nix/store/def456-openclaw-system.drv";
const narHash = "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";
const closureIntegrityReceiptHash = "d".repeat(64);
const approvalRecordHash = "e".repeat(64);
const hostHealthHash = "c".repeat(64);

function createHarness() {
  const stagingTask = {
    id: "task-staging",
    type: "native_declarative_evolution_staging",
    status: "completed",
    nativeDeclarativeEvolution: {
      execution: { staging: { path: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix` } },
    },
  };
  const decisionTask = {
    id: "task-decision",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
    status: "completed",
    nativeDeclarativeEvolution: {
      execution: {
        activation: "approved_for_future_activation",
        sourceStagingTaskId: stagingTask.id,
        candidateHash,
        stagedFileHash,
        evaluatedClosurePath: closurePath,
        derivationPath,
        narHash,
        closureIntegrityReceiptHash,
        approvalRecordHash,
        hostHealthHash,
      },
    },
  };
  const tasks = new Map([[stagingTask.id, stagingTask], [decisionTask.id, decisionTask]]);
  let sequence = 0;
  const events = [];
  const review = {
    blocked: false,
    activationReady: true,
    candidate: { targetPath: "/etc/nixos/openclaw-managed.nix" },
    hostHealth: { status: "healthy" },
    binding: {
      sourceStagingTaskId: stagingTask.id,
      candidateHash,
      stagedFileHash,
      evaluatedClosurePath: closurePath,
      derivationPath,
      narHash,
      closureIntegrityReceiptHash,
      approvalRecordHash,
      hostHealthHash,
    },
  };
  const builders = createNativeDeclarativeEvolutionActivationBuilders({
    tasks,
    buildNativeDeclarativeEvolutionActivationDecisionReview: async () => review,
    autonomyMode: "guardian",
    evaluatePolicyIntent: () => ({ decision: "require_approval", approved: false }),
    createTask: (input) => {
      const task = { id: `task-activation-${++sequence}`, status: "queued", ...input };
      tasks.set(task.id, task);
      return task;
    },
    createApprovalRequestForTask: (task) => {
      task.approval = { requestId: `approval-${task.id}`, status: "pending", binding: task.nativeDeclarativeEvolution.approvalBinding };
      return task.approval;
    },
    supersedeOtherActiveTasks: () => [],
    reconcileRuntimeState: () => {},
    persistState: () => {},
    publishEvent: async (name, body) => events.push({ name, body }),
    publishTaskApprovalIfPending: async () => {},
    serialiseTask: (task) => task,
    serialisePlanForPublic: (plan) => plan,
    now: () => "2026-07-17T23:00:00.000Z",
  });
  return { builders, tasks, events, decisionTask, stagingTask };
}

test("activation task builder requires an approved decision and binds the staging path", async () => {
  const { builders, events } = createHarness();
  await assert.rejects(
    () => builders.createNativeDeclarativeEvolutionActivationTask({ activationDecisionTaskId: "task-decision", confirm: false }),
    /requires confirm=true/,
  );
  const result = await builders.createNativeDeclarativeEvolutionActivationTask({
    activationDecisionTaskId: "task-decision",
    confirm: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.registry, NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY);
  assert.equal(result.task.type, NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE);
  assert.equal(result.approvalBinding.candidateHash, candidateHash);
  assert.equal(result.approvalBinding.stagingPath.endsWith(`${candidateHash}.nix`), true);
  assert.equal(result.governance.activationOwner, "openclaw-hostd");
  assert.equal(result.governance.healthOwner, "openclaw-system-sense");
  assert.equal(result.governance.automaticRollback, false);
  assert.equal(JSON.stringify(result).includes("services.openclaw.enable"), false);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("activation task builder fails closed when the decision is not approved", async () => {
  const { builders, decisionTask } = createHarness();
  decisionTask.nativeDeclarativeEvolution.execution.activation = "rejected";
  await assert.rejects(
    () => builders.buildNativeDeclarativeEvolutionActivationTaskDraft({ activationDecisionTaskId: decisionTask.id }),
    /completed approved activation decision/,
  );
});
