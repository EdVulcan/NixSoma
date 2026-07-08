import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeRealLaunchBuilders } from "../src/cloud-live-provider-runtime-real-launch-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

function createClosureExitReadModel() {
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-exit-v0",
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-real-launch-route-review",
    },
    summary: {
      ready: true,
      complete: true,
      completionPercent: 100,
      phase: "phase-55",
      localRuntimeAdapterComplete: true,
      adapterMethodTableClosed: true,
      methodCount: 6,
      implementedMethodCount: 6,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    },
  };
}

function createApprovedDeferredRealLaunchTask() {
  return {
    id: "task-real-launch",
    type: "cloud_consciousness_live_provider_real_launch_task",
    status: "completed",
    updatedAt: "2026-07-08T00:00:00.000Z",
    outcome: {
      details: {
        phase: "cloud_consciousness_live_provider_real_launch_deferred",
      },
    },
    cloudConsciousnessLiveProviderRealLaunch: {
      registry: "openclaw-cloud-consciousness-live-provider-real-launch-task-v0",
      operatorApprovalCaptured: true,
      launchExecutionDeferred: true,
      approvedAt: "2026-07-08T00:00:00.000Z",
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
    },
  };
}

function createRealLaunchHarness(extraDeps = {}) {
  const taskStore = new Map();
  if (Array.isArray(extraDeps.tasks)) {
    for (const task of extraDeps.tasks) {
      taskStore.set(task.id, task);
    }
  }
  const { tasks: _tasks, ...deps } = extraDeps;
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit: async () => createClosureExitReadModel(),
      getTaskById: (id) => taskStore.get(id) ?? null,
      listTasks: () => [...taskStore.values()],
      ...deps,
    },
  });
}

test("cloud live-provider real-launch builders preserve route review read model", async () => {
  const { deps } = createRealLaunchHarness();
  const builders = createCloudLiveProviderRuntimeRealLaunchBuilders(deps);

  const routeReview = await builders.buildCloudConsciousnessLiveProviderRealLaunchRouteReview();

  assert.equal(routeReview.registry, "openclaw-cloud-consciousness-live-provider-real-launch-route-review-v0");
  assert.equal(routeReview.summary.ready, true);
  assert.equal(routeReview.summary.routeReviewOnly, true);
  assert.equal(routeReview.summary.launchAuthorized, false);
  assert.equal(routeReview.summary.networkEgress, false);
  assert.equal(routeReview.next.recommendedSlice, "openclaw-cloud-consciousness-live-provider-real-launch-task");
});

test("cloud live-provider real-launch builders create approval-gated launch task shell", async () => {
  const { deps, calls, events } = createRealLaunchHarness();
  const builders = createCloudLiveProviderRuntimeRealLaunchBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderRealLaunchTask({ confirm: false }),
    /requires confirm=true/,
  );

  const launchTask = await builders.createCloudConsciousnessLiveProviderRealLaunchTask({ confirm: true });

  assert.equal(launchTask.registry, "openclaw-cloud-consciousness-live-provider-real-launch-task-v0");
  assert.equal(launchTask.task.cloudConsciousnessLiveProviderRealLaunch.implementationStatus, "task_shell_only");
  assert.equal(launchTask.task.cloudConsciousnessLiveProviderRealLaunch.launchAuthorized, false);
  assert.equal(launchTask.task.cloudConsciousnessLiveProviderRealLaunch.liveProviderCallEnabled, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 1);
});

test("cloud live-provider real-launch builders execute approved launch shell as deferred", async () => {
  const { deps, calls } = createRealLaunchHarness({
    approvals: new Map([
      ["approval-real-launch", { id: "approval-real-launch", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
    ]),
  });
  const builders = createCloudLiveProviderRuntimeRealLaunchBuilders(deps);

  const launchTask = await builders.executeCloudConsciousnessLiveProviderRealLaunchTask({
    id: "task-real-launch",
    type: "cloud_consciousness_live_provider_real_launch_task",
    approval: { requestId: "approval-real-launch" },
    cloudConsciousnessLiveProviderRealLaunch: {
      registry: "openclaw-cloud-consciousness-live-provider-real-launch-task-v0",
    },
  });

  assert.equal(launchTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(launchTask.summary.operatorApprovalCaptured, true);
  assert.equal(launchTask.summary.launchExecuted, false);
  assert.equal(launchTask.summary.networkEgress, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});

test("cloud live-provider real-launch builders record execution preflight from approved deferred evidence", async () => {
  const sourceTask = createApprovedDeferredRealLaunchTask();
  const { deps, calls } = createRealLaunchHarness({
    tasks: [sourceTask],
  });
  const builders = createCloudLiveProviderRuntimeRealLaunchBuilders(deps);

  const preflight = await builders.buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight();
  const recorded = await builders.recordCloudConsciousnessLiveProviderRealLaunchExecutionPreflight({ confirm: true });

  assert.equal(preflight.registry, "openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0");
  assert.equal(preflight.summary.approvedDeferredEvidenceFound, true);
  assert.equal(preflight.summary.launchAuthorized, false);
  assert.equal(recorded.registry, "openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0");
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.executionPreflightRecorded, true);
  assert.equal(recorded.task.cloudConsciousnessLiveProviderRealLaunch.launchExecuted, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});
