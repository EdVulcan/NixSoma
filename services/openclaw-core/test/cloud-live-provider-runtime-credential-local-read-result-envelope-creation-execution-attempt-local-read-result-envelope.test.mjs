import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime } from "../src/cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const LOCAL_READ_RESULT_ENVELOPE_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-task-v0";
const LOCAL_READ_RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-approved-deferred-v0";
const LOCAL_READ_RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-final-readiness-preflight-v0";

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

function createApprovedDeferredLocalReadResultEnvelopeTask({ shell = {} } = {}) {
  return {
    id: "task-result-envelope-creation-execution-attempt-local-read-result-envelope",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_task",
    status: "completed",
    updatedAt: "2026-07-09T00:00:00.000Z",
    approval: {
      requestId: "approval-result-envelope-creation-execution-attempt-local-read-result-envelope",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope: {
      registry: LOCAL_READ_RESULT_ENVELOPE_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflightRecorded: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createLocalReadResultEnvelopeHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflight: async () => ({
        ok: true,
        summary: { ready: true },
      }),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("credential local-read result-envelope approved deferred builders read Phase 121 evidence", async () => {
  const sourceTask = createApprovedDeferredLocalReadResultEnvelopeTask();
  const { deps } = createLocalReadResultEnvelopeHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeApprovedDeferred();

  assert.equal(readback.registry, LOCAL_READ_RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_approved_deferred_ready");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.sourceRegistry, LOCAL_READ_RESULT_ENVELOPE_TASK_REGISTRY);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeTaskApproved, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.summary.networkEgress, false);
  assert.equal(readback.evidence.approvedDeferredTask.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope.registry, LOCAL_READ_RESULT_ENVELOPE_TASK_REGISTRY);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-final-readiness-preflight");
});

test("credential local-read result-envelope builders build and record Phase 122 final readiness", async () => {
  const sourceTask = createApprovedDeferredLocalReadResultEnvelopeTask();
  const { deps, calls, events } = createLocalReadResultEnvelopeHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight({ confirm: true });
  const after = recorded.preflight;

  assert.equal(preflight.registry, LOCAL_READ_RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_final_readiness_preflight_ready_deferred");
  assert.equal(preflight.summary.ready, true);
  assert.equal(preflight.summary.sourceRegistry, LOCAL_READ_RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY);
  assert.equal(preflight.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded, false);
  assert.equal(preflight.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(preflight.summary.credentialValueRead, false);
  assert.equal(preflight.summary.networkEgress, false);
  assert.equal(recorded.registry, LOCAL_READ_RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(recorded.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_final_readiness_preflight_recorded_deferred");
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded, true);
  assert.equal(after.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded, true);
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
  assert.equal(after.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-route");
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "persistState").length, 1);
  assert.equal(events.filter((event) => event.name === "task.phase_changed").length, 1);
});
