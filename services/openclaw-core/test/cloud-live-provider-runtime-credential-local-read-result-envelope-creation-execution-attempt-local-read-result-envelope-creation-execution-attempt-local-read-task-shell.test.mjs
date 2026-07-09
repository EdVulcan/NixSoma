import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellRuntime } from "../src/cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const LOCAL_READ_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0";
const LOCAL_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0";
const LOCAL_READ_TASK_SHELL_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
const LOCAL_READ_TASK_TYPE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task";
const LOCAL_READ_TASK_FIELD =
  "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead";
const FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded";
const LOCAL_READ_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated";
const LOCAL_READ_TASK_APPROVED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved";
const LOCAL_READ_TASK_DEFERRED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadDeferred";

function createLocalReadRouteHarness() {
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute: async () => ({
        ok: true,
        registry: LOCAL_READ_ROUTE_REGISTRY,
        decision: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          sourceRegistry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0",
          sourceTaskId: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt",
          [FINAL_READINESS_RECORDED_FIELD]: true,
          [LOCAL_READ_TASK_CREATED_FIELD]: false,
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
          recommendedSlice: LOCAL_READ_TASK_SHELL_SLUG,
        },
      }),
    },
  });
}

test("credential local-read result-envelope creation execution attempt local-read task shell stays approval gated and deferred", async () => {
  const { deps, calls, events } = createLocalReadRouteHarness();
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellRuntime(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask({ confirm: true });
  const shell = taskShell.task[LOCAL_READ_TASK_FIELD];

  assert.equal(taskShell.registry, LOCAL_READ_TASK_REGISTRY);
  assert.equal(taskShell.sourceRegistry, LOCAL_READ_ROUTE_REGISTRY);
  assert.equal(taskShell.approval.status, "pending");
  assert.equal(shell.registry, LOCAL_READ_TASK_REGISTRY);
  assert.equal(shell.sourceRegistry, LOCAL_READ_ROUTE_REGISTRY);
  assert.equal(shell.implementationStatus, "task_shell_only");
  assert.equal(shell[FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(shell[LOCAL_READ_TASK_CREATED_FIELD], true);
  assert.equal(shell[LOCAL_READ_TASK_APPROVED_FIELD], false);
  assert.equal(shell[LOCAL_READ_TASK_DEFERRED_FIELD], true);
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
  assert.equal(builders.isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask(taskShell.task), true);

  taskShell.task.approval = { requestId: taskShell.approval.id, status: "pending" };
  const blocked = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask(taskShell.task);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "approval_required");

  deps.approvals.set(taskShell.approval.id, {
    id: taskShell.approval.id,
    status: "approved",
    updatedAt: "2026-07-09T10:00:00.000Z",
  });
  const executed = await builders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask(taskShell.task);
  const executedShell = executed.task[LOCAL_READ_TASK_FIELD];

  assert.equal(executed.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task_shell_deferred_after_approval");
  assert.equal(executed.task.type, LOCAL_READ_TASK_TYPE);
  assert.equal(executed.summary[LOCAL_READ_TASK_CREATED_FIELD], true);
  assert.equal(executed.summary[LOCAL_READ_TASK_APPROVED_FIELD], true);
  assert.equal(executed.summary[LOCAL_READ_TASK_DEFERRED_FIELD], true);
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(executed.summary.credentialValueIncluded, false);
  assert.equal(executed.summary.credentialValueExposed, false);
  assert.equal(executed.summary.endpointContacted, false);
  assert.equal(executed.summary.networkEgress, false);
  assert.equal(executed.summary.liveProviderCallEnabled, false);
  assert.equal(executedShell.implementationStatus, "deferred_after_approval");
  assert.equal(executedShell[LOCAL_READ_TASK_APPROVED_FIELD], true);
  assert.equal(executedShell.credentialValueRead, false);
  assert.equal(executedShell.endpointContacted, false);
  assert.equal(executedShell.networkEgress, false);
  assert.equal(executed.task.phase, "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task_shell_deferred");
});
