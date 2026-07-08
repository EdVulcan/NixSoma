import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders } from "../src/cloud-live-provider-runtime-credential-value-local-read-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const ACCESS_AUTHORIZED_LOCAL_PROOF_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0";
const LOCAL_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0";
const LOCAL_READ_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-v0";
const LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-v0";
const LOCAL_READ_EXECUTION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-v0";
const LOCAL_READ_EXECUTION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred-v0";
const LOCAL_READ_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight-v0";

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

function createLocalReadTask({ shell = {} } = {}) {
  return {
    id: "task-local-read",
    type: "cloud_consciousness_live_provider_credential_value_local_read_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-local-read",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalRead: {
      registry: LOCAL_READ_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueAccessAuthorizedLocalProofRecorded: true,
      credentialValueLocalReadTaskCreated: true,
      credentialValueLocalReadTaskApproved: true,
      credentialValueLocalReadDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createLocalReadExecutionTask({ shell = {} } = {}) {
  return {
    id: "task-local-read-execution",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-local-read-execution",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_local_read_execution_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecution: {
      registry: LOCAL_READ_EXECUTION_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueLocalReadFinalReadinessPreflightRecorded: true,
      credentialValueLocalReadExecutionTaskCreated: true,
      credentialValueLocalReadExecutionTaskApproved: true,
      credentialValueLocalReadExecutionDeferred: true,
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
      buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof: async () => ({
        ok: true,
        registry: ACCESS_AUTHORIZED_LOCAL_PROOF_REGISTRY,
        proof: {
          credentialReference: "openclaw://credential/provider/live-provider-fixture",
        },
        summary: {
          ready: true,
          complete: true,
          credentialValueAccessAuthorizedLocalProofRecorded: true,
          sourceTaskId: "task-access-authorization-decision",
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

test("credential value local read builders preserve Phase 79 route and Phase 80 task shell", async () => {
  const { deps, calls, events } = createLocalReadHarness();
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadRoute();
  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadTask({ confirm: true });

  assert.equal(route.registry, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route-v0");
  assert.equal(route.summary.localProofFound, true);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(taskShell.registry, LOCAL_READ_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueLocalRead.credentialValueLocalReadTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueLocalRead.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("credential value local read builders execute Phase 80 shell and read Phase 81 evidence", async () => {
  const approvedHarness = createLocalReadHarness({
    approvals: new Map([
      ["approval-local-read", {
        id: "approval-local-read",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadTask({
    id: "task-local-read",
    type: "cloud_consciousness_live_provider_credential_value_local_read_task",
    approval: { requestId: "approval-local-read" },
    cloudConsciousnessLiveProviderCredentialValueLocalRead: {
      registry: LOCAL_READ_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_local_read_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueLocalReadTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createLocalReadTask();
  const { deps } = createLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadApprovedDeferred();

  assert.equal(readback.registry, LOCAL_READ_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight");
});

test("credential value local read builders record Phase 82 readiness and create Phase 83 execution shell", async () => {
  const sourceTask = createLocalReadTask();
  const { deps, calls } = createLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight({ confirm: true });

  assert.equal(preflight.registry, LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.credentialValueLocalReadApprovedDeferredFound, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueLocalRead.credentialValueLocalReadFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.summary.credentialValueLocalReadFinalReadinessPreflightRecorded, true);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const executionRoute = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionRoute();
  const executionTask = await builders.createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTask({ confirm: true });

  assert.equal(executionRoute.registry, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route-v0");
  assert.equal(executionRoute.summary.credentialValueLocalReadFinalReadinessPreflightRecorded, true);
  assert.equal(executionTask.registry, LOCAL_READ_EXECUTION_TASK_REGISTRY);
  assert.equal(executionTask.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution.credentialValueLocalReadExecutionTaskCreated, true);
  assert.equal(executionTask.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution.credentialValueRead, false);
});

test("credential value local read builders execute Phase 84 shell and read Phase 85 evidence", async () => {
  const approvedHarness = createLocalReadHarness({
    approvals: new Map([
      ["approval-local-read-execution", {
        id: "approval-local-read-execution",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTask({
    id: "task-local-read-execution",
    type: "cloud_consciousness_live_provider_credential_value_local_read_execution_task",
    approval: { requestId: "approval-local-read-execution" },
    cloudConsciousnessLiveProviderCredentialValueLocalReadExecution: {
      registry: LOCAL_READ_EXECUTION_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_local_read_execution_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueLocalReadExecutionTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createLocalReadExecutionTask();
  const { deps } = createLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionApprovedDeferred();

  assert.equal(readback.registry, LOCAL_READ_EXECUTION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight");
});

test("credential value local read builders build and record Phase 86 execution final readiness", async () => {
  const sourceTask = createLocalReadExecutionTask();
  const { deps, calls } = createLocalReadHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueLocalReadBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight({ confirm: true });

  assert.equal(preflight.registry, LOCAL_READ_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.credentialValueLocalReadExecutionApprovedDeferredFound, true);
  assert.equal(preflight.summary.credentialValueRead, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution.credentialValueLocalReadExecutionFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.summary.credentialValueLocalReadExecutionFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route");
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
});
