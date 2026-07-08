import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialValueLocalReadExecutionLocalReadBuilders } from "../src/cloud-live-provider-runtime-credential-value-local-read-execution-local-read-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const LOCAL_READ_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight-v0";
const LOCAL_READ_EXECUTION_LOCAL_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-v0";
const LOCAL_READ_EXECUTION_LOCAL_READ_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-approved-deferred-v0";
const LOCAL_READ_EXECUTION_LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-v0";

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

function createExecutionLocalReadTask({ shell = {} } = {}) {
  return {
    id: "task-execution-local-read",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-execution-local-read",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead: {
      registry: LOCAL_READ_EXECUTION_LOCAL_READ_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadExecutionFinalReadinessPreflightRecorded: true,
      credentialValueLocalReadExecutionLocalReadTaskCreated: true,
      credentialValueLocalReadExecutionLocalReadTaskApproved: true,
      credentialValueLocalReadExecutionLocalReadDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createExecutionLocalReadHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight: async () => ({
        ok: true,
        registry: LOCAL_READ_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY,
        preflight: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          complete: true,
          credentialValueLocalReadExecutionFinalReadinessPreflightRecorded: true,
          sourceTaskId: "task-local-read-execution",
          credentialValueRead: false,
          credentialValueIncluded: false,
          credentialValueExposed: false,
          providerCredentialRead: false,
          endpointContacted: false,
          networkEgress: false,
          transmitsExternally: false,
          liveProviderCallEnabled: false,
        },
      }),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("credential value execution local-read builders preserve Phase 87 route and Phase 88 task shell", async () => {
  const { deps, calls, events } = createExecutionLocalReadHarness();
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadExecutionLocalReadBuilders(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadRoute();
  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTask({ confirm: true });

  assert.equal(route.registry, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route-v0");
  assert.equal(route.summary.finalReadinessPreflightFound, true);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(taskShell.registry, LOCAL_READ_EXECUTION_LOCAL_READ_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead.credentialValueLocalReadExecutionLocalReadTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("credential value execution local-read builders execute Phase 88 shell and read Phase 89 evidence", async () => {
  const approvedHarness = createExecutionLocalReadHarness({
    approvals: new Map([
      ["approval-execution-local-read", {
        id: "approval-execution-local-read",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueLocalReadExecutionLocalReadBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTask({
    id: "task-execution-local-read",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_task",
    approval: { requestId: "approval-execution-local-read" },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead: {
      registry: LOCAL_READ_EXECUTION_LOCAL_READ_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_local_read_execution_local_read_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueLocalReadExecutionLocalReadTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createExecutionLocalReadTask();
  const { deps } = createExecutionLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadExecutionLocalReadBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferred();

  assert.equal(readback.registry, LOCAL_READ_EXECUTION_LOCAL_READ_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight");
});

test("credential value execution local-read builders build and record Phase 90 final readiness", async () => {
  const sourceTask = createExecutionLocalReadTask();
  const { deps, calls } = createExecutionLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadExecutionLocalReadBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadFinalReadinessPreflight({ confirm: true });

  assert.equal(preflight.registry, LOCAL_READ_EXECUTION_LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.credentialValueLocalReadExecutionLocalReadApprovedDeferredFound, true);
  assert.equal(preflight.summary.credentialValueRead, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead.credentialValueLocalReadExecutionLocalReadFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.summary.credentialValueLocalReadExecutionLocalReadFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-route");
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
});
