import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialEgressGateBuilders } from "../src/cloud-live-provider-runtime-credential-egress-gate-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const REAL_LAUNCH_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-real-launch-task-v0";
const REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0";
const CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0";
const ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0";
const EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0";
const EGRESS_EXECUTION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0";

function baseRealLaunchFlags() {
  return {
    registry: REAL_LAUNCH_TASK_REGISTRY,
    operatorApprovalCaptured: true,
    launchExecutionDeferred: true,
    executionPreflightRecorded: true,
    executionPreflightRegistry: REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY,
    launchAuthorized: false,
    launchExecuted: false,
    credentialValueIncluded: false,
    credentialValueRead: false,
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
  };
}

function createRealLaunchTask({ id = "task-real-launch", phase, shell = {} }) {
  return {
    id,
    type: "cloud_consciousness_live_provider_real_launch_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    outcome: {
      details: { phase },
    },
    cloudConsciousnessLiveProviderRealLaunch: {
      ...baseRealLaunchFlags(),
      ...shell,
    },
  };
}

function createCredentialValueAccessGateTask() {
  return createRealLaunchTask({
    phase: "cloud_consciousness_live_provider_credential_value_access_gate",
    shell: {
      credentialValueAccessGateRecorded: true,
      credentialValueAccessGateRegistry: CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
    },
  });
}

function createEndpointNetworkEgressGateTask() {
  return createRealLaunchTask({
    phase: "cloud_consciousness_live_provider_endpoint_network_egress_gate",
    shell: {
      credentialValueAccessGateRecorded: true,
      credentialValueAccessGateRegistry: CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressGateRecorded: true,
      endpointNetworkEgressGateRegistry: ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
    },
  });
}

function createEgressRouteTaskPreflightTask() {
  return createRealLaunchTask({
    phase: "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
    shell: {
      credentialValueAccessGateRecorded: true,
      credentialValueAccessGateRegistry: CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressGateRecorded: true,
      endpointNetworkEgressGateRegistry: ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      egressExecutionRouteTaskPreflightRecorded: true,
      egressExecutionRouteTaskPreflightRegistry: EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
    },
  });
}

function createApprovedDeferredEgressExecutionTask() {
  return {
    id: "task-egress-execution",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-egress-execution",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderEgressExecution: {
      registry: EGRESS_EXECUTION_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      egressExecutionTaskCreated: true,
      egressExecutionTaskApproved: true,
      egressExecutionDeferred: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    },
  };
}

function createCredentialEgressHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight: async () => ({
        ok: true,
        registry: REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY,
        summary: {
          ready: true,
          complete: true,
          phase: "phase-59",
          approvedDeferredEvidenceFound: true,
        },
      }),
      isCloudConsciousnessLiveProviderRealLaunchTask: (task) => task?.type === "cloud_consciousness_live_provider_real_launch_task"
        && task?.cloudConsciousnessLiveProviderRealLaunch?.registry === REAL_LAUNCH_TASK_REGISTRY,
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("credential egress gate builders record Phase 60 credential value access gate", async () => {
  const sourceTask = createRealLaunchTask({
    phase: "cloud_consciousness_live_provider_real_launch_execution_preflight",
  });
  const { deps, calls } = createCredentialEgressHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps);

  await assert.rejects(
    () => builders.recordCloudConsciousnessLiveProviderCredentialValueAccessGate({ confirm: false }),
    /requires confirm=true/,
  );
  const gate = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessGate();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueAccessGate({ confirm: true });

  assert.equal(gate.registry, CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY);
  assert.equal(gate.summary.executionPreflightFound, true);
  assert.equal(gate.summary.credentialValueAccessAuthorized, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.credentialValueAccessGateRecorded, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});

test("credential egress gate builders record Phase 61 endpoint network egress gate", async () => {
  const sourceTask = createCredentialValueAccessGateTask();
  const { deps, calls } = createCredentialEgressHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps);

  const gate = await builders.buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate();
  const recorded = await builders.recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate({ confirm: true });

  assert.equal(gate.registry, ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY);
  assert.equal(gate.summary.credentialValueAccessGateFound, true);
  assert.equal(gate.summary.endpointNetworkEgressAuthorized, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.endpointNetworkEgressGateRecorded, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.networkEgress, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});

test("credential egress gate builders record Phase 62 egress execution route task preflight", async () => {
  const sourceTask = createEndpointNetworkEgressGateTask();
  const { deps, calls } = createCredentialEgressHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight({ confirm: true });

  assert.equal(preflight.registry, EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.endpointNetworkEgressGateFound, true);
  assert.equal(preflight.summary.egressExecutionTaskCreated, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.egressExecutionRouteTaskPreflightRecorded, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.endpointContacted, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});

test("credential egress gate builders create and execute Phase 63 egress execution task shell", async () => {
  const sourceTask = createEgressRouteTaskPreflightTask();
  const { deps, calls, events } = createCredentialEgressHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderEgressExecutionTask({ confirm: true });

  assert.equal(taskShell.registry, EGRESS_EXECUTION_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderEgressExecution.egressExecutionTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderEgressExecution.endpointContacted, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);

  const approvedHarness = createCredentialEgressHarness({
    approvals: new Map([
      ["approval-egress-execution", {
        id: "approval-egress-execution",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(approvedHarness.deps);
  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderEgressExecutionTask({
    id: "task-egress-execution",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    approval: { requestId: "approval-egress-execution" },
    cloudConsciousnessLiveProviderEgressExecution: {
      registry: EGRESS_EXECUTION_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "egress_execution_task_shell_deferred_after_approval");
  assert.equal(executed.summary.egressExecutionTaskApproved, true);
  assert.equal(executed.summary.networkEgress, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "completeTask").length, 1);
});

test("credential egress gate builders preserve Phase 64 approved deferred readback", async () => {
  const sourceTask = createApprovedDeferredEgressExecutionTask();
  const { deps } = createCredentialEgressHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred();

  assert.equal(readback.registry, "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-v0");
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.approvedDeferredEvidenceFound, true);
  assert.equal(readback.summary.endpointContacted, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route");
});
