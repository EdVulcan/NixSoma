import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellRuntime } from "../src/cloud-provider-credential-local-read-result-envelope-attempt-task-shell.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const EXECUTION_ATTEMPT_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-route-v0";
const EXECUTION_ATTEMPT_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0";
const EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0";
const EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0";
const EXECUTION_ATTEMPT_TASK_TYPE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task";
const EXECUTION_ATTEMPT_TASK_SHELL_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
const EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight";
const EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route";
const EXECUTION_ATTEMPT_TASK_FIELD =
  "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt";
const EXECUTION_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated";
const EXECUTION_ATTEMPT_TASK_APPROVED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved";
const EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred";

function createExecutionAttemptRouteHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute: async () => ({
        ok: true,
        registry: EXECUTION_ATTEMPT_ROUTE_REGISTRY,
        decision: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          sourceRegistry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0",
          sourceTaskId: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution",
          [EXECUTION_FINAL_READINESS_RECORDED_FIELD]: true,
          [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: false,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
          credentialValueRead: false,
          credentialValueIncluded: false,
          credentialValueExposed: false,
          providerCredentialRead: false,
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
        },
        next: {
          recommendedSlice: EXECUTION_ATTEMPT_TASK_SHELL_SLUG,
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

function createApprovedDeferredExecutionAttemptTask({ shell = {} } = {}) {
  return {
    id: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt",
    type: EXECUTION_ATTEMPT_TASK_TYPE,
    status: "completed",
    updatedAt: "2026-07-09T09:00:00.000Z",
    approval: {
      requestId: "approval-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred",
      },
    },
    [EXECUTION_ATTEMPT_TASK_FIELD]: {
      registry: EXECUTION_ATTEMPT_TASK_REGISTRY,
      sourceRegistry: EXECUTION_ATTEMPT_ROUTE_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      [EXECUTION_FINAL_READINESS_RECORDED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_APPROVED_FIELD]: true,
      [EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD]: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

test("credential local-read result-envelope creation execution attempt task shell stays approval gated and deferred", async () => {
  const { deps, calls, events } = createExecutionAttemptRouteHarness();
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellRuntime(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask({ confirm: true });
  const shell = taskShell.task[EXECUTION_ATTEMPT_TASK_FIELD];

  assert.equal(taskShell.registry, EXECUTION_ATTEMPT_TASK_REGISTRY);
  assert.equal(taskShell.sourceRegistry, EXECUTION_ATTEMPT_ROUTE_REGISTRY);
  assert.equal(taskShell.approval.status, "pending");
  assert.equal(shell.registry, EXECUTION_ATTEMPT_TASK_REGISTRY);
  assert.equal(shell.sourceRegistry, EXECUTION_ATTEMPT_ROUTE_REGISTRY);
  assert.equal(shell.implementationStatus, "task_shell_only");
  assert.equal(shell[EXECUTION_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(shell[EXECUTION_ATTEMPT_TASK_CREATED_FIELD], true);
  assert.equal(shell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], false);
  assert.equal(shell[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD], true);
  assert.equal(shell.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(shell.credentialValueRead, false);
  assert.equal(shell.credentialValueIncluded, false);
  assert.equal(shell.credentialValueExposed, false);
  assert.equal(shell.providerCredentialRead, false);
  assert.equal(shell.endpointContacted, false);
  assert.equal(shell.networkEgress, false);
  assert.equal(shell.providerResponseCreated, false);
  assert.equal(shell.rollbackExecuted, false);
  assert.equal(shell.rollbackCommandCreated, false);
  assert.equal(shell.hostMutation, false);
  assert.equal(shell.transmitsExternally, false);
  assert.equal(shell.liveProviderCallEnabled, false);
  assert.equal(shell.launchAuthorized, false);
  assert.equal(shell.launchExecuted, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(builders.isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(taskShell.task), true);

  taskShell.task.approval = { requestId: taskShell.approval.id, status: "pending" };
  const blocked = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(taskShell.task);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "approval_required");

  deps.approvals.set(taskShell.approval.id, {
    id: taskShell.approval.id,
    status: "approved",
    updatedAt: "2026-07-09T08:00:00.000Z",
  });
  const executed = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask(taskShell.task);
  const executedShell = executed.task[EXECUTION_ATTEMPT_TASK_FIELD];

  assert.equal(executed.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred_after_approval");
  assert.equal(executed.summary[EXECUTION_ATTEMPT_TASK_CREATED_FIELD], true);
  assert.equal(executed.summary[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], true);
  assert.equal(executed.summary[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD], true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(executed.summary.credentialValueIncluded, false);
  assert.equal(executed.summary.credentialValueExposed, false);
  assert.equal(executed.summary.endpointContacted, false);
  assert.equal(executed.summary.networkEgress, false);
  assert.equal(executed.summary.liveProviderCallEnabled, false);
  assert.equal(executedShell.implementationStatus, "deferred_after_approval");
  assert.equal(executedShell[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], true);
  assert.equal(executedShell.credentialValueRead, false);
  assert.equal(executedShell.endpointContacted, false);
  assert.equal(executedShell.networkEgress, false);
  assert.equal(executed.task.phase, "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred");
});

test("credential local-read result-envelope creation execution attempt approved deferred readback preserves Phase 133 boundary", async () => {
  const sourceTask = createApprovedDeferredExecutionAttemptTask();
  const { deps } = createExecutionAttemptRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellRuntime(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred();

  assert.equal(readback.registry, EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_approved_deferred_ready");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.sourceRegistry, EXECUTION_ATTEMPT_TASK_REGISTRY);
  assert.equal(readback.summary[EXECUTION_ATTEMPT_TASK_CREATED_FIELD], true);
  assert.equal(readback.summary[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], true);
  assert.equal(readback.summary[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD], true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.summary.credentialValueIncluded, false);
  assert.equal(readback.summary.credentialValueExposed, false);
  assert.equal(readback.summary.providerCredentialRead, false);
  assert.equal(readback.summary.endpointContacted, false);
  assert.equal(readback.summary.networkEgress, false);
  assert.equal(readback.summary.providerResponseCreated, false);
  assert.equal(readback.summary.rollbackExecuted, false);
  assert.equal(readback.summary.rollbackCommandCreated, false);
  assert.equal(readback.summary.hostMutation, false);
  assert.equal(readback.summary.transmitsExternally, false);
  assert.equal(readback.summary.liveProviderCallEnabled, false);
  assert.equal(readback.summary.launchAuthorized, false);
  assert.equal(readback.summary.launchExecuted, false);
  assert.equal(readback.evidence.approvedDeferredTask[EXECUTION_ATTEMPT_TASK_FIELD].registry, EXECUTION_ATTEMPT_TASK_REGISTRY);
  assert.equal(readback.next.recommendedSlice, EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_SLUG);
});

test("credential local-read result-envelope creation execution attempt final readiness preflight records local-only Phase 134 evidence", async () => {
  const sourceTask = createApprovedDeferredExecutionAttemptTask();
  const { deps, events } = createExecutionAttemptRouteHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellRuntime(deps);

  const before = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight();

  assert.equal(before.registry, EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(before.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_ready_deferred");
  assert.equal(before.summary.ready, true);
  assert.equal(before.summary.sourceRegistry, EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY);
  assert.equal(before.summary[EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD], false);
  assert.equal(before.summary[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], true);
  assert.equal(before.summary[EXECUTION_ATTEMPT_TASK_DEFERRED_FIELD], true);
  assert.equal(before.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(before.summary.credentialValueRead, false);
  assert.equal(before.summary.credentialValueIncluded, false);
  assert.equal(before.summary.credentialValueExposed, false);
  assert.equal(before.summary.providerCredentialRead, false);
  assert.equal(before.summary.endpointContacted, false);
  assert.equal(before.summary.networkEgress, false);
  assert.equal(before.summary.providerResponseCreated, false);
  assert.equal(before.summary.rollbackExecuted, false);
  assert.equal(before.summary.rollbackCommandCreated, false);
  assert.equal(before.summary.hostMutation, false);
  assert.equal(before.summary.transmitsExternally, false);
  assert.equal(before.summary.liveProviderCallEnabled, false);
  assert.equal(before.summary.launchAuthorized, false);
  assert.equal(before.summary.launchExecuted, false);
  assert.equal(before.next.recommendedSlice, EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG);

  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight({ confirm: true });
  const after = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight();
  const approvedAfter = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred();

  assert.equal(recorded.registry, EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(recorded.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded_deferred");
  assert.equal(recorded.preflight.summary[EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(recorded.preflight.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(after.summary.ready, true);
  assert.equal(after.summary[EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(after.summary.credentialValueRead, false);
  assert.equal(after.summary.endpointContacted, false);
  assert.equal(after.summary.networkEgress, false);
  assert.equal(after.next.recommendedSlice, EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_SLUG);
  assert.equal(approvedAfter.summary.ready, true);
  assert.equal(approvedAfter.summary[EXECUTION_ATTEMPT_TASK_APPROVED_FIELD], true);
  assert.equal(sourceTask[EXECUTION_ATTEMPT_TASK_FIELD][EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(events.filter((event) => event.name === "task.phase_changed").length, 1);
});
