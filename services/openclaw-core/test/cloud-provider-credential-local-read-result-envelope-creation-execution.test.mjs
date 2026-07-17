import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime } from "../src/cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-final-readiness-preflight-v0";
const CREATION_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-route-v0";
const CREATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-v0";
const CREATION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-approved-deferred-v0";
const CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0";
const CREATION_EXECUTION_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-v0";

function deferredCredentialFlags() {
  return {
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

function createApprovedDeferredCreationTask({ shell = {} } = {}) {
  return {
    id: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task",
    status: "completed",
    updatedAt: "2026-07-09T01:00:00.000Z",
    approval: {
      requestId: "approval-result-envelope-creation-execution-attempt-local-read-result-envelope-creation",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation: {
      registry: CREATION_TASK_REGISTRY,
      sourceRegistry: CREATION_ROUTE_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createRouteHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight: async () => ({
        ok: true,
        registry: FINAL_READINESS_PREFLIGHT_REGISTRY,
        preflight: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded: true,
          sourceTaskId: "task-result-envelope-creation-execution-attempt-local-read-result-envelope",
          ...deferredCredentialFlags(),
        },
      }),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("credential local-read result-envelope creation route preserves Phase 123 route-only boundary", async () => {
  const { deps } = createRouteHarness();
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRoute();

  assert.equal(route.registry, CREATION_ROUTE_REGISTRY);
  assert.equal(route.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_route_ready");
  assert.equal(route.summary.ready, true);
  assert.equal(route.summary.sourceRegistry, FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded, true);
  assert.equal(route.summary.selectedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-shell");
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated, false);
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(route.summary.credentialValueIncluded, false);
  assert.equal(route.summary.credentialValueExposed, false);
  assert.equal(route.summary.providerCredentialRead, false);
  assert.equal(route.summary.endpointContacted, false);
  assert.equal(route.summary.networkEgress, false);
  assert.equal(route.summary.providerResponseCreated, false);
  assert.equal(route.summary.rollbackExecuted, false);
  assert.equal(route.summary.hostMutation, false);
  assert.equal(route.summary.liveProviderCallEnabled, false);
  assert.equal(route.summary.launchExecuted, false);
  assert.equal(route.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-task-shell");
});

test("credential local-read result-envelope creation task shell stays approval gated and deferred", async () => {
  const { deps, calls, events } = createRouteHarness();
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask({ confirm: true });

  assert.equal(taskShell.registry, CREATION_TASK_REGISTRY);
  assert.equal(taskShell.sourceRegistry, CREATION_ROUTE_REGISTRY);
  assert.equal(taskShell.approval.status, "pending");
  const shell = taskShell.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation;
  assert.equal(shell.registry, CREATION_TASK_REGISTRY);
  assert.equal(shell.sourceRegistry, CREATION_ROUTE_REGISTRY);
  assert.equal(shell.implementationStatus, "task_shell_only");
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated, true);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved, false);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred, true);
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
  assert.equal(builders.isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(taskShell.task), true);

  taskShell.task.approval = { requestId: taskShell.approval.id, status: "pending" };
  const blocked = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(taskShell.task);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "approval_required");

  deps.approvals.set(taskShell.approval.id, {
    id: taskShell.approval.id,
    status: "approved",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  const executed = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTask(taskShell.task);

  assert.equal(executed.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred, true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(executed.summary.credentialValueIncluded, false);
  assert.equal(executed.summary.credentialValueExposed, false);
  assert.equal(executed.summary.endpointContacted, false);
  assert.equal(executed.summary.networkEgress, false);
  assert.equal(executed.summary.liveProviderCallEnabled, false);
  assert.equal(executed.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation.implementationStatus, "deferred_after_approval");
  assert.equal(executed.task.phase, "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_task_shell_deferred");
});

test("credential local-read result-envelope creation approved deferred readback preserves Phase 125 boundary", async () => {
  const sourceTask = createApprovedDeferredCreationTask();
  const { deps } = createRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationApprovedDeferred();

  assert.equal(readback.registry, CREATION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_approved_deferred_ready");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.sourceRegistry, CREATION_TASK_REGISTRY);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskCreated, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationDeferred, true);
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
  assert.equal(readback.evidence.approvedDeferredTask.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation.registry, CREATION_TASK_REGISTRY);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight");
});

test("credential local-read result-envelope creation final readiness preflight records Phase 126 without creating envelopes", async () => {
  const sourceTask = createApprovedDeferredCreationTask();
  const { deps, calls, events } = createRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(deps);

  const before = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight({ confirm: true });
  const after = recorded.preflight;
  const approvedAfter = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationApprovedDeferred();

  assert.equal(before.registry, CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(before.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_final_readiness_preflight_ready_deferred");
  assert.equal(before.summary.ready, true);
  assert.equal(before.summary.sourceRegistry, CREATION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(before.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded, false);
  assert.equal(before.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(before.summary.credentialValueRead, false);
  assert.equal(before.summary.networkEgress, false);
  assert.equal(recorded.registry, CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(recorded.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_final_readiness_preflight_recorded_deferred");
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded, true);
  assert.equal(after.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded, true);
  assert.equal(after.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(after.summary.credentialValueRead, false);
  assert.equal(after.summary.providerCredentialRead, false);
  assert.equal(after.summary.endpointContacted, false);
  assert.equal(after.summary.networkEgress, false);
  assert.equal(after.summary.providerResponseCreated, false);
  assert.equal(after.summary.rollbackExecuted, false);
  assert.equal(after.summary.hostMutation, false);
  assert.equal(after.summary.liveProviderCallEnabled, false);
  assert.equal(after.summary.launchExecuted, false);
  assert.equal(after.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route");
  assert.equal(approvedAfter.summary.ready, true);
  assert.equal(approvedAfter.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationTaskApproved, true);
  assert.equal(approvedAfter.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "persistState").length, 1);
  assert.equal(events.filter((event) => event.name === "task.phase_changed").length, 1);
});

test("credential local-read result-envelope creation execution route preserves Phase 127 route-only boundary", async () => {
  const sourceTask = createApprovedDeferredCreationTask({
    shell: {
      implementationStatus: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_final_readiness_preflight_recorded",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRegistry: CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY,
    },
  });
  const { deps } = createRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionRoute();

  assert.equal(route.registry, CREATION_EXECUTION_ROUTE_REGISTRY);
  assert.equal(route.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_route_ready");
  assert.equal(route.summary.ready, true);
  assert.equal(route.summary.sourceRegistry, CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded, true);
  assert.equal(route.summary.selectedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell");
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated, false);
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(route.summary.credentialValueIncluded, false);
  assert.equal(route.summary.credentialValueExposed, false);
  assert.equal(route.summary.providerCredentialRead, false);
  assert.equal(route.summary.endpointContacted, false);
  assert.equal(route.summary.networkEgress, false);
  assert.equal(route.summary.providerResponseCreated, false);
  assert.equal(route.summary.rollbackExecuted, false);
  assert.equal(route.summary.hostMutation, false);
  assert.equal(route.summary.liveProviderCallEnabled, false);
  assert.equal(route.summary.launchExecuted, false);
  assert.equal(route.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell");
});
