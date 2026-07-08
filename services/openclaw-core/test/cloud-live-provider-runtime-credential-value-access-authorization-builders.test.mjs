import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders } from "../src/cloud-live-provider-runtime-credential-value-access-authorization-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const CREDENTIAL_VALUE_READ_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred-v0";
const ACCESS_AUTHORIZATION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-v0";
const ACCESS_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-v0";
const FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0";
const ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-v0";
const ACCESS_AUTHORIZATION_DECISION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-v0";
const ACCESS_AUTHORIZED_LOCAL_PROOF_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0";

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

function createAccessAuthorizationTask({ shell = {} } = {}) {
  return {
    id: "task-access-authorization",
    type: "cloud_consciousness_live_provider_credential_value_access_authorization_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-access-authorization",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_access_authorization_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueAccessAuthorization: {
      registry: ACCESS_AUTHORIZATION_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueAccessAuthorizationTaskCreated: true,
      credentialValueAccessAuthorizationTaskApproved: true,
      credentialValueAccessAuthorizationDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createAccessAuthorizationDecisionTask({ shell = {} } = {}) {
  return {
    id: "task-access-authorization-decision",
    type: "cloud_consciousness_live_provider_credential_value_access_authorization_decision_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    approval: {
      requestId: "approval-access-authorization-decision",
      status: "approved",
    },
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_credential_value_access_authorization_decision_task_shell_deferred",
      },
    },
    cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision: {
      registry: ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY,
      implementationStatus: "deferred_after_approval",
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueAccessAuthorizationDecisionTaskCreated: true,
      credentialValueAccessAuthorizationDecisionTaskApproved: true,
      credentialValueAccessAuthorizationDecisionDeferred: true,
      ...deferredCredentialFlags(),
      ...shell,
    },
  };
}

function createAccessAuthorizationHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred: async () => ({
        ok: true,
        registry: CREDENTIAL_VALUE_READ_APPROVED_DEFERRED_REGISTRY,
        summary: {
          ready: true,
          complete: true,
          approvedDeferredEvidenceFound: true,
          sourceTaskId: "task-credential-value-read",
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

test("credential value access authorization builders preserve Phase 71 route and Phase 72 task shell", async () => {
  const { deps, calls, events } = createAccessAuthorizationHarness();
  const builders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(deps);

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute();
  const taskShell = await builders.createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask({ confirm: true });

  assert.equal(route.registry, "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route-v0");
  assert.equal(route.summary.approvedDeferredEvidenceFound, true);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(taskShell.registry, ACCESS_AUTHORIZATION_TASK_REGISTRY);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization.credentialValueAccessAuthorizationTaskCreated, true);
  assert.equal(taskShell.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization.credentialValueRead, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
});

test("credential value access authorization builders execute Phase 72 shell and read Phase 73 evidence", async () => {
  const approvedHarness = createAccessAuthorizationHarness({
    approvals: new Map([
      ["approval-access-authorization", {
        id: "approval-access-authorization",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask({
    id: "task-access-authorization",
    type: "cloud_consciousness_live_provider_credential_value_access_authorization_task",
    approval: { requestId: "approval-access-authorization" },
    cloudConsciousnessLiveProviderCredentialValueAccessAuthorization: {
      registry: ACCESS_AUTHORIZATION_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_access_authorization_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueAccessAuthorizationTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createAccessAuthorizationTask();
  const { deps } = createAccessAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred();

  assert.equal(readback.registry, ACCESS_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight");
});

test("credential value access authorization builders record Phase 74 final readiness and create Phase 75 decision shell", async () => {
  const accessTask = createAccessAuthorizationTask();
  const { deps, calls } = createAccessAuthorizationHarness({ tasks: [accessTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight({ confirm: true });

  assert.equal(preflight.registry, FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(preflight.summary.credentialValueAccessAuthorizationApprovedDeferredFound, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization.credentialValueFinalReadinessPreflightRecorded, true);
  assert.equal(recorded.preflight.summary.credentialValueFinalReadinessPreflightRecorded, true);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const decisionRoute = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionRoute();
  const decisionTask = await builders.createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTask({ confirm: true });

  assert.equal(decisionRoute.registry, "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route-v0");
  assert.equal(decisionRoute.summary.credentialValueFinalReadinessPreflightRecorded, true);
  assert.equal(decisionTask.registry, ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY);
  assert.equal(decisionTask.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision.credentialValueAccessAuthorizationDecisionTaskCreated, true);
  assert.equal(decisionTask.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision.credentialValueRead, false);
});

test("credential value access authorization builders execute Phase 76 shell and read Phase 77 evidence", async () => {
  const approvedHarness = createAccessAuthorizationHarness({
    approvals: new Map([
      ["approval-access-authorization-decision", {
        id: "approval-access-authorization-decision",
        status: "approved",
        updatedAt: "2026-07-08T00:00:00.000Z",
      }],
    ]),
  });
  const approvedBuilders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(approvedHarness.deps);

  const executed = await approvedBuilders.executeCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTask({
    id: "task-access-authorization-decision",
    type: "cloud_consciousness_live_provider_credential_value_access_authorization_decision_task",
    approval: { requestId: "approval-access-authorization-decision" },
    cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision: {
      registry: ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY,
    },
  });

  assert.equal(executed.status, "credential_value_access_authorization_decision_task_shell_deferred_after_approval");
  assert.equal(executed.summary.credentialValueAccessAuthorizationDecisionTaskApproved, true);
  assert.equal(executed.summary.credentialValueRead, false);
  assert.equal(approvedHarness.calls.filter((call) => call.name === "appendTaskPhase").length, 1);

  const sourceTask = createAccessAuthorizationDecisionTask();
  const { deps } = createAccessAuthorizationHarness({ tasks: [sourceTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(deps);
  const readback = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferred();

  assert.equal(readback.registry, ACCESS_AUTHORIZATION_DECISION_APPROVED_DEFERRED_REGISTRY);
  assert.equal(readback.summary.ready, true);
  assert.equal(readback.summary.credentialValueRead, false);
  assert.equal(readback.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof");
});

test("credential value access authorization builders build and record Phase 78 local proof without reading credentials", async () => {
  const decisionTask = createAccessAuthorizationDecisionTask();
  const { deps, calls } = createAccessAuthorizationHarness({ tasks: [decisionTask] });
  const builders = createCloudLiveProviderRuntimeCredentialValueAccessAuthorizationBuilders(deps);

  const proof = await builders.buildCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof();
  const recorded = await builders.recordCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof({ confirm: true });

  assert.equal(proof.registry, ACCESS_AUTHORIZED_LOCAL_PROOF_REGISTRY);
  assert.equal(proof.summary.credentialValueAccessAuthorizationDecisionApprovedDeferredFound, true);
  assert.equal(proof.summary.credentialValueRead, false);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision.credentialValueAccessAuthorizedLocalProofRecorded, true);
  assert.equal(recorded.proof.summary.credentialValueAccessAuthorizedLocalProofRecorded, true);
  assert.equal(recorded.proof.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route");
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
});
