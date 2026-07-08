import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders } from "../src/cloud-live-provider-runtime-credential-value-authorization-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const EGRESS_EXECUTION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-v0";
const CREDENTIAL_VALUE_AUTHORIZATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-v0";
const CREDENTIAL_VALUE_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-authorization-approved-deferred-v0";
const CREDENTIAL_VALUE_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight-v0";
const CREDENTIAL_VALUE_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-read-task-v0";
const CREDENTIAL_VALUE_READ_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred-v0";

function deferredCredentialFlags() {
  return {
    credentialValueAccessAuthorized: false,
    credentialValueAccessDenied: true,
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

function createCredentialValueAuthorizationTask({ phase, shell = {} }) {
  return {
    id: "task-credential-value-authorization",
    type: "cloud_consciousness_live_provider_credential_value_authorization_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-credential-value-authorization",
      status: "approved",
    },
    outcome: {
      details: { phase },
    },
    cloudConsciousnessLiveProviderCredentialValueAuthorization: {
      registry: CREDENTIAL_VALUE_AUTHORIZATION_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueAuthorizationTaskCreated: true,
      credentialValueAuthorizationTaskApproved: true,
      credentialValueAuthorizationDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createCredentialValueReadTask() {
  return {
    id: "task-credential-value-read",
    type: "cloud_consciousness_live_provider_credential_value_read_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-credential-value-read",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_read_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueRead: {
      registry: CREDENTIAL_VALUE_READ_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueReadTaskCreated: true,
      credentialValueReadTaskApproved: true,
      credentialValueReadDeferred: true,
      ...deferredCredentialFlags(),
    },
  };
}

function createCredentialValueAuthorizationHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred: async () => ({
        ok: true,
        registry: EGRESS_EXECUTION_APPROVED_DEFERRED_REGISTRY,
        summary: {
          ready: true,
          complete: true,
          approvedDeferredEvidenceFound: true,
          sourceTaskId: "task-egress-execution",
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

test("credential value authorization builders preserve Phase 65 route and Phase 66 task shell", async () => {
  const { deps, calls, events } = createCredentialValueAuthorizationHarness();
  const builders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute();
  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueAuthorizationTask({ confirm: true });

  assert.equal(route.registry, "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route-v0");
  assert.equal(route.summary.approvedDeferredEvidenceFound, true);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(taskShell.registry, CREDENTIAL_VALUE_AUTHORIZATION_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueAuthorization.credentialValueAuthorizationTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueAuthorization.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("credential value authorization builders execute approved Phase 66 shell and read Phase 67 evidence", async () => {
  const approvedHarness = createCredentialValueAuthorizationHarness({
    approvals: new Map([
      ["approval-credential-value-authorization", {
        id: "approval-credential-value-authorization",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueAuthorizationTask({
    id: "task-credential-value-authorization",
    type: "cloud_consciousness_live_provider_credential_value_authorization_task",
    approval: { requestId: "approval-credential-value-authorization" },
    cloudConsciousnessLiveProviderCredentialValueAuthorization: {
      registry: CREDENTIAL_VALUE_AUTHORIZATION_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_authorization_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueAuthorizationTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createCredentialValueAuthorizationTask({
    phase: "cloud_consciousness_live_provider_credential_value_authorization_task_shell_deferred",
  });
  const { deps } = createCredentialValueAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred();

  assert.equal(readback.registry, CREDENTIAL_VALUE_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight");
});

test("credential value authorization builders record Phase 68 readiness preflight", async () => {
  const sourceTask = createCredentialValueAuthorizationTask({
    phase: "cloud_consciousness_live_provider_credential_value_authorization_task_shell_deferred",
  });
  const { deps, calls } = createCredentialValueAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueReadinessPreflight({ confirm: true });

  assert.equal(preflight.registry, CREDENTIAL_VALUE_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.credentialValueAuthorizationApprovedDeferredFound, true);
  assert.equal(preflight.preflight.credentialValueRead, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueAuthorization.credentialValueReadinessPreflightRecorded, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueAuthorization.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});

test("credential value authorization builders create and execute Phase 69 read task shell", async () => {
  const sourceTask = createCredentialValueAuthorizationTask({
    phase: "cloud_consciousness_live_provider_credential_value_readiness_preflight",
    shell: {
      implementationStatus: "credential_value_readiness_preflight_recorded",
      credentialValueReadinessPreflightRecorded: true,
      credentialValueReadinessPreflightRegistry: CREDENTIAL_VALUE_READINESS_PREFLIGHT_REGISTRY,
    },
  });
  const { deps, calls, events } = createCredentialValueAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(deps);

  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueReadTask({ confirm: true });

  assert.equal(taskShell.registry, CREDENTIAL_VALUE_READ_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueRead.credentialValueReadTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueRead.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);

  const approvedHarness = createCredentialValueAuthorizationHarness({
    approvals: new Map([
      ["approval-credential-value-read", {
        id: "approval-credential-value-read",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(approvedHarness.deps);
  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueReadTask({
    id: "task-credential-value-read",
    type: "cloud_consciousness_live_provider_credential_value_read_task",
    approval: { requestId: "approval-credential-value-read" },
    cloudConsciousnessLiveProviderCredentialValueRead: {
      registry: CREDENTIAL_VALUE_READ_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_read_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueReadTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);
});

test("credential value authorization builders preserve Phase 70 read approved deferred readback", async () => {
  const sourceTask = createCredentialValueReadTask();
  const { deps } = createCredentialValueAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAuthorizationBuilders(deps);

  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred();

  assert.equal(readback.registry, CREDENTIAL_VALUE_READ_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.approvedDeferredEvidenceFound, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route");
});
