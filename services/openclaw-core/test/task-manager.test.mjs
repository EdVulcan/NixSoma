import assert from "node:assert/strict";
import test from "node:test";

import { createTaskManager } from "../src/task-manager.mjs";

function createHarness() {
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
    buildRulePlan: () => null,
    shouldBuildPlan: () => false,
    serialisePlanForPublic: (plan) => plan,
    createApprovalRequestForTask: () => null,
    ensureTaskPolicy: () => {},
    updatePlanForPhase: () => {},
    publishEvent: async () => {},
  });

  return { manager, tasks };
}

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
  assert.deepEqual(task.cloudConsciousnessLiveProviderExecutionPlan, {
    registry: "openclaw-cloud-live-provider-execution-plan-v0",
  });
  assert.equal(task.bodyEvidenceLedgerDirectory, undefined);

  let serialized = manager.serialiseTask(task);
  assert.equal(serialized.engineeringPlanTodoSuggestionLink.source.taskId, "source-plan-task");
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
