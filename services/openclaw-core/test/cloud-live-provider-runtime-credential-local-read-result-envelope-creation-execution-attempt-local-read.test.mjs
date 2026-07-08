import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime } from "../src/cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0";
const LOCAL_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0";
const LOCAL_READ_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred-v0";

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

function createApprovedDeferredLocalReadTask({ shell = {} } = {}) {
  return {
    id: "task-result-envelope-creation-execution-attempt-local-read",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task",
    status: "completed",
    updatedAt: "2026-07-09T00:00:00.000Z",
    approval: {
      requestId: "approval-result-envelope-creation-execution-attempt-local-read",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead: {
      registry: LOCAL_READ_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadDeferred: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createLocalReadHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight: async () => ({
        ok: true,
        registry: FINAL_READINESS_PREFLIGHT_REGISTRY,
        preflight: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded: true,
          sourceTaskId: "task-result-envelope-creation-execution-attempt",
          ...deferredCredentialFlags(),
        },
      }),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("credential local-read result-envelope creation execution attempt local-read builders read Phase 117 approved deferred evidence", async () => {
  const sourceTask = createApprovedDeferredLocalReadTask();
  const { deps } = createLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferred();

  assert.equal(readback.registry, LOCAL_READ_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_approved_deferred_ready");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.sourceRegistry, LOCAL_READ_TASK_REGISTRY);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved, true);
  assert.equal(readback.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.summary.networkEgress, false);
  assert.equal(readback.evidence.approvedDeferredTask.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead.registry, LOCAL_READ_TASK_REGISTRY);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight");
});
