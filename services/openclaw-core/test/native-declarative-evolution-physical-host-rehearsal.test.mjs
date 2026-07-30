import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import vm from "node:vm";

import { observerClientDeclarativeEvolutionRenderersScript } from "../../../apps/observer-ui/src/client-script-renderers-declarative-evolution.mjs";
import {
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  hashManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import { DELEGATED_PLAN_TASK_HANDLER_DESCRIPTORS } from "../src/task-executor-delegated-plan-handlers.mjs";
import { createTaskExecutor } from "../src/task-executor.mjs";

const candidateText = "{ services.openclaw.enable = true; }\n";
const candidateHash = createHash("sha256").update(candidateText).digest("hex");
const stagedFileHash = "b".repeat(64);
const closurePath = "/nix/store/abc123-openclaw-system";
const derivationPath = "/nix/store/def456-openclaw-system.drv";
const narHash = "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";
const closureIntegrityReceiptHash = "d".repeat(64);
const approvalRecordHash = "e".repeat(64);
const preActivationHealthHash = "c".repeat(64);
const postActivationHealthHash = "f".repeat(64);
const previousGenerationPath = "/nix/store/old123-nixos-system-nixos-test";

function createReceipt(taskId) {
  const receipt = {
    registry: HOSTD_ACTIVATION_RECEIPT_REGISTRY,
    version: 1,
    receiptId: "receipt-physical-rehearsal",
    requestId: "request-physical-rehearsal",
    operation: HOSTD_ACTIVATION_OPERATION,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
    candidateHash,
    candidateBytes: Buffer.byteLength(candidateText),
    evaluatedClosurePath: closurePath,
    sourceStagingTaskId: "task-staging-physical-rehearsal",
    activationDecisionTaskId: "task-decision-physical-rehearsal",
    activationTaskId: taskId,
    previousTargetHash: null,
    previousGenerationPath,
    activatedGenerationPath: closurePath,
    activatedProfilePath: closurePath,
    helperEvidence: {
      registry: HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
      candidateHash,
      evaluatedClosurePath: closurePath,
      previousTargetHash: null,
      generationBefore: previousGenerationPath,
      generationAfter: closurePath,
      profileAfter: closurePath,
      targetHashAfter: candidateHash,
      targetInstalled: true,
      rollbackExecuted: false,
    },
    command: {
      executable: "/run/current-system/sw/bin/nixos-rebuild",
      args: ["switch", "--flake", "/etc/nixos#openclaw-local-dev"],
    },
    status: "passed",
    activationExecuted: true,
    generationSwitched: true,
    rollbackExecuted: false,
    startedAt: "2026-07-18T03:00:00.000Z",
    completedAt: "2026-07-18T03:00:01.000Z",
    result: { exitCode: 0, stdout: "", stderr: "" },
    error: null,
  };
  return { ...receipt, receiptHash: hashManagedConfigActivationReceipt(receipt) };
}

function createTask() {
  const binding = {
    kind: "native_declarative_evolution_activation",
    activationDecisionTaskId: "task-decision-physical-rehearsal",
    sourceStagingTaskId: "task-staging-physical-rehearsal",
    candidateHash,
    stagedFileHash,
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
    evaluatedClosurePath: closurePath,
    derivationPath,
    narHash,
    closureIntegrityReceiptHash,
    approvalRecordHash,
    hostHealthHash: preActivationHealthHash,
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    expiresAt: "2099-07-18T03:05:00.000Z",
  };
  return {
    id: "task-activation-physical-rehearsal",
    type: "native_declarative_evolution_activation",
    status: "queued",
    plan: { strategy: "native-declarative-evolution-activation-v0" },
    policy: { decision: { decision: "audit_only", reason: "physical_rehearsal" } },
    approval: { requestId: "approval-physical-rehearsal", status: "approved", binding },
    nativeDeclarativeEvolution: { activation: binding, governance: {} },
  };
}

function createObserverElement() {
  return { textContent: "" };
}

function createObserverContext() {
  return {
    declarativeEvolutionExecutionTaskId: createObserverElement(),
    declarativeEvolutionExecutionStatus: createObserverElement(),
    declarativeEvolutionExecutionJson: createObserverElement(),
  };
}

function createHarness() {
  const task = createTask();
  const decisionTask = {
    id: "task-decision-physical-rehearsal",
    type: "native_declarative_evolution_activation_decision",
    status: "completed",
    nativeDeclarativeEvolution: {
      execution: { activation: "approved_for_future_activation" },
    },
  };
  const tasks = new Map([[decisionTask.id, decisionTask]]);
  const approvals = new Map([[
    task.approval.requestId,
    { id: task.approval.requestId, status: "approved", binding: task.approval.binding },
  ]]);
  const events = [];
  let hostdCalls = 0;
  let persistCalls = 0;
  const runtimeState = { currentTaskId: null, paused: false };
  const state = {
    tasks,
    approvals,
    policyAuditLog: [],
    capabilityInvocationLog: [],
    nativeEngineeringLspLifecycleRecords: new Map(),
    runtimeState,
    HOSTD_SOCKET_PATH: "/run/openclaw/hostd.sock",
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY: "openclaw-systemd-repair-execution-task-v0",
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY: "openclaw-systemd-next-repair-task-shell-v0",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY: "openclaw-systemd-next-repair-real-execution-v0",
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT: "openclaw-browser-runtime.service",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT: "openclaw-system-sense.service",
    getCurrentTask: () => tasks.get(runtimeState.currentTaskId) ?? null,
    updateRuntimeState: (patch) => Object.assign(runtimeState, patch),
    persistState: () => { persistCalls += 1; },
  };

  function appendTaskPhase(value, phase, details = null) {
    value.executionPhase = phase;
    value.phaseHistory = [...(value.phaseHistory ?? []), { phase, details }];
    return value;
  }

  function setTaskPhase(value, phase, { status = value.status, details = null } = {}) {
    value.status = status;
    appendTaskPhase(value, phase, details);
    return Promise.resolve(value);
  }

  function completeTask(value, details = null) {
    value.status = "completed";
    value.outcome = { kind: "completed", details };
    return value;
  }

  function failTask(value, reason, details = null) {
    value.status = "failed";
    value.outcome = { kind: "failed", reason, details };
    return value;
  }

  const planBuilder = {
    refreshNativePluginRuntimeRegistry: () => ({ ok: true, swapped: false }),
    buildNativeDeclarativeEvolutionActivationDecisionReview: async () => ({
      blocked: false,
      activationReady: true,
      binding: { ...task.approval.binding },
    }),
    readNativeDeclarativeEvolutionHostHealth: async () => ({
      registry: "openclaw-native-declarative-evolution-host-health-oracle-v0",
      owner: "openclaw-core-host-health-oracle",
      status: "degraded",
      hostHealthHash: postActivationHealthHash,
      failedChecks: ["servicesHealthy"],
    }),
  };
  for (const descriptor of DELEGATED_PLAN_TASK_HANDLER_DESCRIPTORS) {
    planBuilder[descriptor.predicate] = () => false;
    planBuilder[descriptor.execute] = async () => {
      throw new Error(`Unexpected delegated handler: ${descriptor.name}`);
    };
  }

  const executor = createTaskExecutor({
    client: {
      sessionManagerUrl: "http://127.0.0.1:4102",
      screenSenseUrl: "http://127.0.0.1:4104",
      screenActUrl: "http://127.0.0.1:4105",
      systemSenseUrl: "http://127.0.0.1:4106",
      fetchJson: async () => ({ ok: true }),
      postJson: async () => ({ ok: true }),
    },
    state,
    taskManager: {
      serialiseTask: (value) => value,
      buildTaskSummary: () => ({ total: tasks.size }),
      appendTaskPhase,
      setTaskPhase,
      completeTask,
      failTask,
      isActiveTask: (value) => ["queued", "running", "paused"].includes(value?.status),
      reconcileRuntimeState: () => {},
      getNextQueuedTask: () => null,
      getTaskById: (id) => tasks.get(id) ?? null,
    },
    planBuilder,
    approvalEngine: {
      serialiseApproval: (value) => value,
      buildApprovalSummary: () => ({ total: approvals.size }),
      createApprovalRequestForTask: () => null,
      publishTaskApprovalIfPending: async () => null,
    },
    workspaceOps: {},
    policyEvaluator: {
      ensureTaskPolicy: (value) => ({ decision: value.policy.decision }),
      recordPolicyDecision: () => null,
      evaluatePolicyIntent: () => ({ decision: "allow" }),
      isPolicyExecutionAllowed: (decision) => decision?.decision !== "deny" && decision?.decision !== "require_approval",
    },
    hostdActivationClient: async (input) => {
      hostdCalls += 1;
      assert.equal(input.socketPath, state.HOSTD_SOCKET_PATH);
      assert.equal(input.activationTaskId, task.id);
      return { ok: true, requestId: "request-physical-rehearsal", receipt: createReceipt(task.id) };
    },
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  return {
    task,
    executor,
    events,
    getHostdCalls: () => hostdCalls,
    getPersistCalls: () => persistCalls,
  };
}

test("physical-host rehearsal dispatches through Core executor and renders manual rollback evidence", async () => {
  const harness = createHarness();
  const result = await harness.executor.executeTaskWithRecovery(harness.task);
  const finalExecution = result.finalExecution;
  const task = finalExecution.task;
  const execution = task.nativeDeclarativeEvolution.execution;

  assert.equal(task.status, "failed");
  assert.equal(finalExecution.reason, "post_activation_health_degraded");
  assert.equal(harness.getHostdCalls(), 1);
  assert.equal(harness.getPersistCalls(), 0);
  assert.equal(execution.activationExecuted, true);
  assert.equal(execution.generationSwitched, true);
  assert.equal(execution.postActivationHealth.status, "degraded");
  assert.equal(execution.rollbackEvidence.status, "manual_operator_required");
  assert.equal(execution.rollbackEvidence.owner, "deferred_manual_operator");
  assert.equal(execution.rollbackEvidence.healthTransition.preActivationHealthHash, preActivationHealthHash);
  assert.equal(execution.rollbackEvidence.healthTransition.postActivationHealthHash, postActivationHealthHash);
  assert.equal(execution.governance.executesRollback, false);
  assert.equal(execution.governance.automaticRollback, false);
  assert.equal(execution.governance.rollbackEvidenceBound, true);
  assert.equal(harness.events.filter((event) => event.name === "task.failed").length, 1);

  const observer = createObserverContext();
  vm.runInNewContext(observerClientDeclarativeEvolutionRenderersScript, observer);
  observer.renderDeclarativeEvolutionActivationExecution({ ok: false, task });
  const readback = JSON.parse(observer.declarativeEvolutionExecutionJson.textContent);

  assert.equal(observer.declarativeEvolutionExecutionStatus.textContent, "failed");
  assert.equal(readback.rollbackEvidence.status, "manual_operator_required");
  assert.equal(readback.rollbackEvidence.owner, "deferred_manual_operator");
  assert.equal(readback.rollbackEvidence.governance.automaticRollback, false);
  assert.equal(readback.rollbackEvidence.governance.executesRollback, false);
});
