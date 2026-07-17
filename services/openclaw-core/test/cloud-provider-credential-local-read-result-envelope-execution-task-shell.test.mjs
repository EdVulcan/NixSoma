import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime } from "../src/cloud-provider-credential-local-read-result-envelope-execution-task-shell.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const EXECUTION_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-v0";
const EXECUTION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-v0";
const EXECUTION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-approved-deferred-v0";
const EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0";
const EXECUTION_TASK_SHELL_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell";
const EXECUTION_ATTEMPT_ROUTE_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-route";
const EXECUTION_TASK_FIELD =
  "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution";
const EXECUTION_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded";

function createExecutionRouteHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionRoute: async () => ({
        ok: true,
        registry: EXECUTION_ROUTE_REGISTRY,
        decision: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          sourceRegistry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0",
          sourceTaskId: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation",
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded: true,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated: false,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
          credentialValueRead: false,
          credentialValueIncluded: false,
          credentialValueExposed: false,
          providerCredentialRead: false,
          endpointContacted: false,
          networkEgress: false,
          providerResponseCreated: false,
          rollbackExecuted: false,
          hostMutation: false,
          liveProviderCallEnabled: false,
          launchExecuted: false,
        },
        next: {
          recommendedSlice: EXECUTION_TASK_SHELL_SLUG,
        },
      }),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

function deferredCredentialFlags() {
  return {
    credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
    credentialValueIncluded: false,
    credentialValueRead: false,
    credentialValueExposed: false,
    providerCredentialRead: false,
    endpointNetworkEgressAuthorized: false,
    endpointNetworkEgressDenied: true,
    endpointContacted: false,
    networkEgress: false,
    providerResponseCreated: false,
    rollbackExecuted: false,
    rollbackCommandCreated: false,
    hostMutation: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    launchAuthorized: false,
    launchExecuted: false,
  };
}

function createApprovedDeferredExecutionTask({ shell = {} } = {}) {
  return {
    id: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_task",
    status: "completed",
    updatedAt: "2026-07-09T03:00:00.000Z",
    approval: {
      requestId: "approval-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_task_shell_deferred",
      },
    },
    [EXECUTION_TASK_FIELD]: {
      registry: EXECUTION_TASK_REGISTRY,
      sourceRegistry: EXECUTION_ROUTE_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

test("credential local-read result-envelope creation execution task shell stays approval gated and deferred", async () => {
  const { deps, calls, events } = createExecutionRouteHarness();
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTask({ confirm: true });
  const shell = taskShell.task[EXECUTION_TASK_FIELD];

  assert.equal(taskShell.registry, EXECUTION_TASK_REGISTRY);
  assert.equal(taskShell.sourceRegistry, EXECUTION_ROUTE_REGISTRY);
  assert.equal(taskShell.approval.status, "pending");
  assert.equal(shell.registry, EXECUTION_TASK_REGISTRY);
  assert.equal(shell.sourceRegistry, EXECUTION_ROUTE_REGISTRY);
  assert.equal(shell.implementationStatus, "task_shell_only");
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded, true);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated, true);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved, false);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred, true);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(shell.credentialValueRead, false);
  assert.equal(shell.credentialValueIncluded, false);
  assert.equal(shell.credentialValueExposed, false);
  assert.equal(shell.providerCredentialRead, false);
  assert.equal(shell.endpointContacted, false);
  assert.equal(shell.networkEgress, false);
  assert.equal(shell.providerResponseCreated, false);
  assert.equal(shell.rollbackExecuted, false);
  assert.equal(shell.hostMutation, false);
  assert.equal(shell.liveProviderCallEnabled, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(builders.isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTask(taskShell.task), true);

  taskShell.task.approval = { requestId: taskShell.approval.id, status: "pending" };
  const blocked = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTask(taskShell.task);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "approval_required");

  deps.approvals.set(taskShell.approval.id, {
    id: taskShell.approval.id,
    status: "approved",
    updatedAt: "2026-07-09T02:00:00.000Z",
  });
  const executed = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTask(taskShell.task);
  const executedShell = executed.task[EXECUTION_TASK_FIELD];

  assert.equal(executed.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(executed.summary.credentialValueIncluded, false);
  assert.equal(executed.summary.credentialValueExposed, false);
  assert.equal(executed.summary.endpointContacted, false);
  assert.equal(executed.summary.networkEgress, false);
  assert.equal(executed.summary.liveProviderCallEnabled, false);
  assert.equal(executedShell.implementationStatus, "deferred_after_approval");
  assert.equal(executed.task.phase, "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_task_shell_deferred");
});

test("credential local-read result-envelope creation execution approved deferred readback preserves Phase 129 boundary", async () => {
  const sourceTask = createApprovedDeferredExecutionTask();
  const { deps } = createExecutionRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred();

  assert.equal(readback.registry, EXECUTION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_approved_deferred_ready");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.sourceRegistry, EXECUTION_TASK_REGISTRY);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.summary.credentialValueIncluded, false);
  assert.equal(readback.summary.credentialValueExposed, false);
  assert.equal(readback.summary.providerCredentialRead, false);
  assert.equal(readback.summary.endpointContacted, false);
  assert.equal(readback.summary.networkEgress, false);
  assert.equal(readback.summary.providerResponseCreated, false);
  assert.equal(readback.summary.rollbackExecuted, false);
  assert.equal(readback.summary.hostMutation, false);
  assert.equal(readback.summary.liveProviderCallEnabled, false);
  assert.equal(readback.evidence.approvedDeferredTask[EXECUTION_TASK_FIELD].registry, EXECUTION_TASK_REGISTRY);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight");
});

test("credential local-read result-envelope creation execution final readiness preflight records without weakening Phase 129 readback", async () => {
  const sourceTask = createApprovedDeferredExecutionTask();
  const { deps, calls, events } = createExecutionRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime(deps);

  const before = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight();
  assert.equal(before.registry, EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(before.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight_ready_deferred");
  assert.equal(before.summary.ready, true);
  assert.equal(before.summary.sourceRegistry, EXECUTION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(before.summary[EXECUTION_FINAL_READINESS_RECORDED_FIELD], false);
  assert.equal(before.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(before.next.recommendedSlice, EXECUTION_ATTEMPT_ROUTE_SLUG);

  const record = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight({ confirm: true });
  const recordedShell = sourceTask[EXECUTION_TASK_FIELD];

  assert.equal(record.registry, EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(record.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight_recorded_deferred");
  assert.equal(record.preflight.summary[EXECUTION_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(record.preflight.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(recordedShell.implementationStatus, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight_recorded");
  assert.equal(recordedShell[EXECUTION_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(recordedShell.credentialValueRead, false);
  assert.equal(recordedShell.credentialValueIncluded, false);
  assert.equal(recordedShell.credentialValueExposed, false);
  assert.equal(recordedShell.providerCredentialRead, false);
  assert.equal(recordedShell.endpointContacted, false);
  assert.equal(recordedShell.networkEgress, false);
  assert.equal(recordedShell.providerResponseCreated, false);
  assert.equal(recordedShell.rollbackExecuted, false);
  assert.equal(recordedShell.hostMutation, false);
  assert.equal(recordedShell.liveProviderCallEnabled, false);
  assert.equal(recordedShell.launchExecuted, false);
  assert.equal(calls.some((call) => call.name === "appendTaskPhase"), true);
  assert.equal(events.filter((event) => event.name === "task.phase_changed").length, 1);

  const after = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight();
  assert.equal(after.summary.ready, true);
  assert.equal(after.summary[EXECUTION_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(after.next.recommendedSlice, EXECUTION_ATTEMPT_ROUTE_SLUG);

  const approvedAfter = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred();
  assert.equal(approvedAfter.summary.ready, true);
  assert.equal(approvedAfter.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved, true);
  assert.equal(approvedAfter.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
});
