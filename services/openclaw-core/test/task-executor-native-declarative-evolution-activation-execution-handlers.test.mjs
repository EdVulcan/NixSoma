import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  hashManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
} from "../src/native-declarative-evolution-activation.mjs";
import { createNativeDeclarativeEvolutionActivationTaskHandlers } from "../src/task-executor-native-declarative-evolution-activation-execution-handlers.mjs";
import { NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE } from "../src/native-declarative-evolution-activation-decision.mjs";
import { buildCapabilityApprovalBinding } from "../src/capability-runtime-approval-binding.mjs";

const candidateText = "{ services.openclaw.enable = true; }\n";
const candidateHash = createHash("sha256").update(candidateText).digest("hex");
const stagedFileHash = "b".repeat(64);
const closurePath = "/nix/store/abc123-openclaw-system";
const derivationPath = "/nix/store/def456-openclaw-system.drv";
const narHash = "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";
const closureIntegrityReceiptHash = "d".repeat(64);
const approvalRecordHash = "e".repeat(64);
const hostHealthHash = "c".repeat(64);

function createReceipt(taskId) {
  const receipt = {
    registry: HOSTD_ACTIVATION_RECEIPT_REGISTRY,
    version: 1,
    receiptId: "receipt-1",
    requestId: "request-1",
    operation: HOSTD_ACTIVATION_OPERATION,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
    candidateHash,
    candidateBytes: Buffer.byteLength(candidateText),
    evaluatedClosurePath: closurePath,
    sourceStagingTaskId: "task-staging",
    activationDecisionTaskId: "task-decision",
    activationTaskId: taskId,
    previousTargetHash: null,
    command: { executable: "/run/current-system/sw/bin/nixos-rebuild", args: ["switch", "--flake", "/etc/nixos#openclaw-local-dev"] },
    status: "passed",
    activationExecuted: true,
    generationSwitched: true,
    rollbackExecuted: false,
    startedAt: "2026-07-17T23:00:00.000Z",
    completedAt: "2026-07-17T23:00:01.000Z",
    result: { exitCode: 0, stdout: "", stderr: "" },
    error: null,
  };
  return { ...receipt, receiptHash: hashManagedConfigActivationReceipt(receipt) };
}

function createTask(overrides = {}) {
  const task = {
    id: "task-activation",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_TASK_TYPE,
    status: "queued",
    plan: { strategy: "native-declarative-evolution-activation-v0" },
    policy: { decision: { decision: "require_approval", approved: true } },
    approval: { requestId: "approval-activation", status: "approved" },
    nativeDeclarativeEvolution: {
      activation: {
        kind: "native_declarative_evolution_activation",
        activationDecisionTaskId: "task-decision",
        sourceStagingTaskId: "task-staging",
        candidateHash,
        stagedFileHash,
        stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
        evaluatedClosurePath: closurePath,
        derivationPath,
        narHash,
        closureIntegrityReceiptHash,
        approvalRecordHash,
        hostHealthHash,
        targetPath: HOSTD_ACTIVATION_TARGET_PATH,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      governance: {},
    },
    ...overrides,
  };
  task.approval.binding = task.nativeDeclarativeEvolution.activation;
  return task;
}

function createHarness({ task = createTask(), approved = true, changedHealth = false } = {}) {
  const events = [];
  const decisionTask = {
    id: "task-decision",
    type: NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_TASK_TYPE,
    status: "completed",
    nativeDeclarativeEvolution: { execution: { activation: "approved_for_future_activation" } },
  };
  const tasks = new Map([[decisionTask.id, decisionTask]]);
  const approvals = new Map([["approval-activation", {
    id: "approval-activation",
    status: approved ? "approved" : "pending",
    binding: task.approval?.binding ?? task.nativeDeclarativeEvolution.activation,
  }]]);
  let hostdCalls = 0;
  const state = { approvals, tasks, HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock" };
  const taskManager = {
    serialiseTask: (value) => value,
    isActiveTask: () => true,
    getTaskById: (id) => tasks.get(id) ?? null,
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
  const review = {
    blocked: false,
    activationReady: !changedHealth,
    binding: {
      sourceStagingTaskId: "task-staging",
      candidateHash,
      stagedFileHash,
      evaluatedClosurePath: closurePath,
      derivationPath,
      narHash,
      closureIntegrityReceiptHash,
      approvalRecordHash,
      hostHealthHash: changedHealth ? "d".repeat(64) : hostHealthHash,
    },
  };
  const handlers = createNativeDeclarativeEvolutionActivationTaskHandlers({
    state,
    taskManager,
    approvalEngine: { serialiseApproval: (value) => value },
    policyEvaluator: {
      ensureTaskPolicy: (value) => value.policy,
      isPolicyExecutionAllowed: () => true,
    },
    planBuilder: {
      buildNativeDeclarativeEvolutionActivationDecisionReview: async () => review,
      readNativeDeclarativeEvolutionHostHealth: async () => ({ status: "healthy", hostHealthHash: "e".repeat(64) }),
    },
    hostdActivationClient: async (input) => {
      hostdCalls += 1;
      assert.equal(input.activationTaskId, task.id);
      return { ok: true, requestId: "request-1", receipt: createReceipt(task.id) };
    },
    publishEvent: async (name, body) => events.push({ name, body }),
  });
  return { handlers, task, events, getHostdCalls: () => hostdCalls };
}

test("approved activation executes through hostd and binds post-activation health", async () => {
  const { handlers, task, events, getHostdCalls } = createHarness();
  const result = await handlers[0].execute(task);
  assert.equal(result.task.status, "completed");
  assert.equal(result.activation.activationExecuted, true);
  assert.equal(result.activation.generationSwitched, true);
  assert.equal(result.postActivationHealth.status, "healthy");
  assert.equal(result.executionReceipt.activationTaskId, task.id);
  assert.equal(getHostdCalls(), 1);
  assert.equal(events.filter((event) => event.name === "task.completed").length, 1);
});

test("activation does not call hostd without approval or after binding changes", async () => {
  const pending = createHarness({ approved: false });
  const pendingResult = await pending.handlers[0].execute(pending.task);
  assert.equal(pendingResult.blocked, true);
  assert.equal(pending.getHostdCalls(), 0);

  const changed = createHarness({ changedHealth: true });
  const changedResult = await changed.handlers[0].execute(changed.task);
  assert.equal(changedResult.task.status, "failed");
  assert.equal(changedResult.reason, "activation_binding_changed_before_hostd");
  assert.equal(changed.getHostdCalls(), 0);
});

test("activation executor accepts the current generic step-bound approval contract", async () => {
  const task = createTask({
    plan: {
      planId: "plan-generic-activation",
      strategy: "native-declarative-evolution-activation-v0",
      steps: [{
        id: "step-activate-managed-config",
        kind: "openclaw.declarative.evolution.activate_managed_config",
        capabilityId: "act.openclaw.declarative_evolution.activation",
        governance: "require_approval",
        requiresApproval: true,
        params: createTask().nativeDeclarativeEvolution.activation,
      }],
    },
  });
  task.approval.binding = buildCapabilityApprovalBinding({ task });
  const { handlers, task: harnessTask, getHostdCalls } = createHarness({ task });
  const result = await handlers[0].execute(harnessTask);

  assert.equal(result.task.status, "completed");
  assert.equal(result.activation.activationExecuted, true);
  assert.equal(getHostdCalls(), 1);
});
