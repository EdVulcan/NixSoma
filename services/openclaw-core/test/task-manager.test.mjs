import assert from "node:assert/strict";
import test from "node:test";

import { createTaskManager } from "../src/task-manager.mjs";
import { EXECUTION_RESERVATION_REGISTRY } from "../src/capability-runtime-approval-binding.mjs";

function createHarness({ buildRulePlan = () => null, shouldBuildPlan = () => false, recordTaskExperience = () => null } = {}) {
  const tasks = new Map();
  const runtimeState = {
    status: "idle",
    currentTaskId: null,
    paused: false,
  };

  const manager = createTaskManager({
    state: {
      tasks,
      runtimeState,
      ACTIVE_TASK_STATUSES: new Set(["queued", "running", "paused"]),
      MAX_TASK_ENTRIES: 50,
      MAX_PHASE_HISTORY_ENTRIES: 20,
      STATUS_PRIORITY: {
        running: 1,
        paused: 2,
        queued: 3,
        failed: 4,
        completed: 5,
        superseded: 6,
      },
      persistState: () => {},
      approvals: new Map(),
      updateRuntimeState: (nextState) => {
        Object.assign(runtimeState, nextState);
      },
      getCurrentTask: () => tasks.get(runtimeState.currentTaskId) ?? null,
    },
    buildRulePlan,
    shouldBuildPlan,
    serialisePlanForPublic: (plan) => plan,
    createApprovalRequestForTask: () => null,
    ensureTaskPolicy: () => {},
    updatePlanForPhase: () => {},
    publishEvent: async () => {},
    recordTaskExperience,
  });

  return { manager, tasks };
}

test("task manager stores a compact browser execution binding on planned tasks", () => {
  const { manager } = createHarness({
    shouldBuildPlan: () => true,
    buildRulePlan: ({ targetUrl, actions }) => ({
      strategy: "rule-v1",
      targetUrl,
      steps: (actions ?? []).map((action) => ({
        phase: "acting_on_target",
        kind: action.kind,
        status: "pending",
        params: action.params,
      })),
    }),
  });

  const task = manager.createTask({
    goal: "Bind planned browser execution inputs",
    type: "browser_task",
    targetUrl: "https://example.com/work",
    includePlan: true,
    actions: [{ kind: "keyboard.type", params: { text: "private transient value" } }],
  });

  assert.equal(task.operatorExecutionBinding?.registry, "openclaw-browser-task-execution-binding-v0");
  assert.equal(task.operatorExecutionBinding?.inputTextBound, false);
  assert.doesNotMatch(JSON.stringify(task.operatorExecutionBinding), /private transient value/u);
  assert.equal(manager.serialiseTask(task).operatorExecutionBinding.actionCount, 1);
});

test("task manager recomputes provider recommendation provenance before serializing a semantic-click task", () => {
  const { manager } = createHarness();
  const providerTask = manager.createTask({
    goal: "Completed provider recommendation source",
    type: "cloud_consciousness_live_provider_egress_execution_task",
  });
  providerTask.cloudConsciousnessLiveProviderEgressExecution = {
    registry: "openclaw-cloud-consciousness-live-provider-live-execution-v0",
    responseContract: "engineering_recommendation_v0",
    recommendation: {
      registry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
      contract: "engineering_recommendation_v0",
      valid: true,
      actionId: "create_semantic_click_task",
    },
  };
  manager.completeTask(providerTask, { summary: "Provider recommendation completed." });

  const task = manager.createTask({
    goal: "Create the reviewed semantic click task",
    type: "browser_task",
    engineeringRecommendationLink: {
      sourceTaskId: providerTask.id,
      sourceRegistry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
      contract: "engineering_recommendation_v0",
      actionId: "create_semantic_click_task",
      expectedObserverControlId: "create-semantic-click-task-button",
      existingCapabilityId: "plan.openclaw.browser.semantic_click_task",
      requiresApproval: true,
      createsTaskAutomatically: false,
      createsApprovalAutomatically: false,
      executesAutomatically: false,
    },
  });

  assert.equal(task.engineeringRecommendationLink.registry, "openclaw-native-engineering-recommendation-link-v0");
  assert.equal(task.engineeringRecommendationLink.source.taskId, providerTask.id);
  assert.equal(task.engineeringRecommendationLink.source.taskStatus, "completed");
  assert.equal(task.engineeringRecommendationLink.action.actionId, "create_semantic_click_task");
  assert.equal(task.engineeringRecommendationLink.governance.providerCallAllowed, false);
  assert.equal(manager.serialiseTask(task).engineeringRecommendationLink.source.taskId, providerTask.id);

  assert.throws(() => manager.createTask({
    goal: "Reject a cross-task recommendation link",
    type: "browser_task",
    engineeringRecommendationLink: {
      sourceTaskId: "missing-provider-task",
      sourceRegistry: "openclaw-cloud-consciousness-live-provider-engineering-recommendation-v0",
      contract: "engineering_recommendation_v0",
      actionId: "create_semantic_click_task",
      expectedObserverControlId: "create-semantic-click-task-button",
      existingCapabilityId: "plan.openclaw.browser.semantic_click_task",
      requiresApproval: true,
      createsTaskAutomatically: false,
      createsApprovalAutomatically: false,
      executesAutomatically: false,
    },
  }), /source task does not exist/u);
});

test("task manager records experience at both terminal lifecycle boundaries", () => {
  const experiences = [];
  const { manager } = createHarness({
    recordTaskExperience: (task) => {
      experiences.push({ id: task.id, outcome: task.outcome?.kind, phase: task.executionPhase });
    },
  });
  const completed = manager.createTask({ goal: "Complete one governed task", type: "system_task" });
  const failed = manager.createTask({ goal: "Fail one governed task", type: "system_task" });

  manager.completeTask(completed, { summary: "completed" });
  manager.failTask(failed, "bounded failure");

  assert.deepEqual(experiences, [
    { id: completed.id, outcome: "completed", phase: "completed" },
    { id: failed.id, outcome: "failed", phase: "failed" },
  ]);
});

test("task manager records delegated terminal phases exactly once", async () => {
  const experiences = [];
  const { manager } = createHarness({
    recordTaskExperience: (task) => {
      experiences.push({ id: task.id, status: task.status, phase: task.executionPhase });
    },
  });
  const task = manager.createTask({
    goal: "Complete through a delegated executor phase",
    type: "systemd_next_repair_task",
  });

  await manager.setTaskPhase(task, "systemd_next_repair_execution_failed", {
    status: "failed",
    details: { incidentReceipt: { registry: "test-receipt" } },
  });
  await manager.setTaskPhase(task, "systemd_next_repair_execution_failed", { status: "failed" });

  assert.deepEqual(experiences, [{
    id: task.id,
    status: "failed",
    phase: "systemd_next_repair_execution_failed",
  }]);
});

test("task manager centralizes extension field creation and serialization", () => {
  const { manager } = createHarness();
  const body = {
    goal: "Exercise task extension field descriptors",
    type: "descriptor_regression_task",
    sourceCommand: {
      registry: "openclaw-source-command-v0",
      nested: { copied: true },
    },
    engineeringPlanTodoSuggestionLink: {
      registry: "openclaw-native-engineering-plan-todo-suggestion-link-v0",
      source: { taskId: "source-plan-task" },
    },
    systemdRepair: { registry: "openclaw-systemd-repair-v0" },
    systemdNextRepair: { registry: "openclaw-systemd-next-repair-v0" },
    systemdIncidentObservation: {
      registry: "openclaw-fixed-unit-incident-observation-v0",
      target: { unit: "openclaw-system-heal.service" },
    },
    cloudConsciousnessLiveProviderExecutionPlan: {
      registry: "openclaw-cloud-live-provider-execution-plan-v0",
    },
    bodyEvidenceLedgerDirectory: {
      registry: "openclaw-body-evidence-ledger-directory-task-v0",
    },
  };

  const task = manager.createTask(body);
  body.sourceCommand.nested.copied = false;
  body.engineeringPlanTodoSuggestionLink.source.taskId = "mutated";

  assert.equal(task.sourceCommand.nested.copied, true);
  assert.equal(task.engineeringPlanTodoSuggestionLink.source.taskId, "source-plan-task");
  assert.deepEqual(task.systemdRepair, { registry: "openclaw-systemd-repair-v0" });
  assert.deepEqual(task.systemdNextRepair, { registry: "openclaw-systemd-next-repair-v0" });
  assert.equal(task.systemdIncidentObservation.target.unit, "openclaw-system-heal.service");
  assert.deepEqual(task.cloudConsciousnessLiveProviderExecutionPlan, {
    registry: "openclaw-cloud-live-provider-execution-plan-v0",
  });
  assert.equal(task.bodyEvidenceLedgerDirectory, undefined);

  let serialized = manager.serialiseTask(task);
  assert.equal(serialized.engineeringPlanTodoSuggestionLink.source.taskId, "source-plan-task");
  assert.equal(serialized.systemdIncidentObservation.registry, "openclaw-fixed-unit-incident-observation-v0");
  assert.equal(serialized.bodyEvidenceLedgerDirectory, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt, null);
  assert.equal(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead, null);

  task.bodyEvidenceLedgerDirectory = {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
  };
  task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope = {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-task-v0",
  };
  task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation = {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0",
  };
  task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution = {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-v0",
  };
  task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt = {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
  };
  task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead = {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0",
  };
  serialized = manager.serialiseTask(task);
  assert.deepEqual(serialized.bodyEvidenceLedgerDirectory, {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
  });
  assert.deepEqual(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope, {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-task-v0",
  });
  assert.deepEqual(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation, {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0",
  });
  assert.deepEqual(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution, {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-v0",
  });
  assert.deepEqual(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt, {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
  });
  assert.deepEqual(serialized.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead, {
    registry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0",
  });
});

test("task manager reconciles only running browser rule plans after core restart", () => {
  const { manager, tasks } = createHarness();
  const runningTask = {
    id: "running-browser-task",
    type: "browser_task",
    goal: "Continue after core restart",
    status: "running",
    targetUrl: "https://example.com/core-restart",
    executionPhase: "preparing_work_view",
    plan: {
      strategy: "rule-v1",
      status: "running",
      steps: [{
        phase: "acting_on_target",
        kind: "browser.new_tab",
        status: "pending",
        params: { url: "https://example.com/core-restart/recovered" },
      }],
    },
    phaseHistory: [],
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
  const queuedTask = {
    ...structuredClone(runningTask),
    id: "queued-browser-task",
    status: "queued",
  };
  const pausedTask = {
    ...structuredClone(runningTask),
    id: "paused-browser-task",
    status: "paused",
  };
  tasks.set(runningTask.id, runningTask);
  tasks.set(queuedTask.id, queuedTask);
  tasks.set(pausedTask.id, pausedTask);

  const interrupted = manager.reconcileInterruptedTasksAtStartup();

  assert.deepEqual(interrupted.map((task) => task.id), [runningTask.id]);
  assert.equal(runningTask.status, "failed");
  assert.equal(runningTask.outcome.details.coreRuntimeInterruption.stage, "preparing_work_view");
  assert.equal(runningTask.outcome.details.coreRuntimeInterruption.automaticRestart, false);
  assert.equal(runningTask.outcome.details.recoveryEvidence.kind, "core-runtime-recovery-evidence");
  assert.equal(runningTask.outcome.details.recoveryEvidence.recommendation.strategy, "recover_persisted_task_after_core_restart");
  assert.equal(manager.isRecoverableTask(runningTask), true);
  assert.equal(queuedTask.status, "queued");
  assert.equal(pausedTask.status, "paused");
});

test("task manager fails active capability reservations closed after core restart", () => {
  const { manager, tasks } = createHarness();
  const task = {
    id: "running-command-task",
    type: "system_task",
    goal: "Execute one approved command",
    status: "running",
    executionPhase: "acting_on_target",
    plan: {
      strategy: "rule-v1",
      status: "running",
      steps: [{
        id: "command-step",
        phase: "acting_on_target",
        status: "running",
        capabilityId: "act.system.command.execute",
        executionReservation: {
          registry: EXECUTION_RESERVATION_REGISTRY,
          reservationId: "reservation-restart",
          taskId: "running-command-task",
          stepId: "command-step",
          capabilityId: "act.system.command.execute",
          requestHash: "a".repeat(64),
          status: "running",
          reservedAt: "2026-07-10T00:00:00.000Z",
          startedAt: "2026-07-10T00:00:00.001Z",
          expiresAt: "2026-07-10T00:05:00.000Z",
        },
      }],
    },
    phaseHistory: [],
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
  tasks.set(task.id, task);

  const recovered = manager.reconcileInterruptedCapabilityReservationsAtStartup();

  assert.deepEqual(recovered, [{
    taskId: task.id,
    stepId: "command-step",
    reservationId: "reservation-restart",
    capabilityId: "act.system.command.execute",
    requestHash: "a".repeat(64),
  }]);
  assert.equal(task.status, "failed");
  assert.equal(task.plan.steps[0].status, "failed");
  assert.equal(task.plan.steps[0].executionReceipt.status, "recovered_aborted");
  assert.equal(task.outcome.details.automaticReplay, false);
});

test("task manager binds trusted work-view metadata without changing task execution state", () => {
  const { manager } = createHarness();
  const task = manager.createTask({
    goal: "Bind an engineering task to the current work view",
    type: "native_engineering_lsp_lifecycle",
    includePlan: true,
  });
  manager.completeTask(task, { summary: "Completed before binding." });
  const before = {
    status: task.status,
    executionPhase: task.executionPhase,
    planStatus: task.plan?.status,
    phaseHistoryLength: task.phaseHistory.length,
  };

  const bound = manager.bindTaskToTrustedWorkView(task, {
    workViewId: "work-view-primary",
    sessionId: "session-current",
    status: "ready",
    visibility: "hidden",
    mode: "background",
    helperStatus: "active",
    displayTarget: "workspace-2",
    operatorActionSource: "test_operator_bind",
  });

  assert.equal(bound.status, before.status);
  assert.equal(bound.executionPhase, before.executionPhase);
  assert.equal(bound.plan?.status, before.planStatus);
  assert.equal(bound.phaseHistory.length, before.phaseHistoryLength);
  assert.deepEqual(bound.workView.trustedBinding, {
    registry: "openclaw-native-engineering-work-view-bind-v0",
    mode: "operator_reviewed",
    source: "test_operator_bind",
    authorityStatus: "authoritative",
    leaseMatched: true,
    boundAt: bound.updatedAt,
  });
});
