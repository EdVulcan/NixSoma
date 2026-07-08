import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeInitialBuilders } from "../src/cloud-live-provider-runtime-initial-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

function createInitialRuntimeHarness(extraDeps = {}) {
  return createTaskLifecycleHarness({
    deps: {
      buildRuntimeImplementationPlan: async () => ({
        ok: true,
        registry: "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan-v0",
        summary: {
          ready: true,
          complete: true,
          completionPercent: 100,
          callsCloudModel: false,
          transmitsExternally: false,
          providerSdkLoaded: false,
          providerCredentialRead: false,
          credentialValueRead: false,
          endpointContacted: false,
          liveProviderCallEnabled: false,
        },
      }),
      ...extraDeps,
    },
  });
}

test("cloud live-provider runtime initial builders preserve no-egress read models", async () => {
  const { deps } = createInitialRuntimeHarness();
  const builders = createCloudLiveProviderRuntimeInitialBuilders(deps);

  const adapterImplementation = await builders.buildCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation();
  const moduleContract = await builders.buildCloudConsciousnessLiveProviderRuntimeAdapterModuleContract();
  const requestBuilder = await builders.buildCloudConsciousnessLiveProviderRequestBuilder();

  assert.equal(adapterImplementation.registry, "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-v0");
  assert.equal(adapterImplementation.summary.implementsRuntimeAdapter, false);
  assert.equal(moduleContract.summary.moduleBoundaryDefined, true);
  assert.equal(moduleContract.summary.implementsRuntimeAdapter, false);
  assert.equal(requestBuilder.registry, "openclaw-cloud-consciousness-live-provider-request-builder-v0");
  assert.equal(requestBuilder.summary.credentialValueIncluded, false);
  assert.equal(requestBuilder.summary.networkEgress, false);
});

test("cloud live-provider runtime initial builders create approval-gated task shells", async () => {
  const { deps, calls, events } = createInitialRuntimeHarness();
  const builders = createCloudLiveProviderRuntimeInitialBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderRuntimeImplementationTask({ confirm: false }),
    /requires confirm=true/,
  );

  const implementation = await builders.createCloudConsciousnessLiveProviderRuntimeImplementationTask({ confirm: true });
  const adapterImplementation = await builders.createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask({ confirm: true });
  const moduleTask = await builders.createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask({ confirm: true });
  const requestBuilder = await builders.createCloudConsciousnessLiveProviderRequestBuilderTask({ confirm: true });

  assert.equal(implementation.registry, "openclaw-cloud-consciousness-live-provider-runtime-implementation-task-v0");
  assert.equal(implementation.task.cloudConsciousnessLiveProviderRuntimeImplementation.providerSdkLoaded, false);
  assert.equal(adapterImplementation.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0");
  assert.equal(adapterImplementation.task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation.implementsRuntimeAdapter, false);
  assert.equal(moduleTask.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0");
  assert.equal(moduleTask.task.cloudConsciousnessLiveProviderRuntimeAdapterModule.writesSource, false);
  assert.equal(requestBuilder.registry, "openclaw-cloud-consciousness-live-provider-request-builder-task-v0");
  assert.equal(requestBuilder.task.cloudConsciousnessLiveProviderRequestBuilder.credentialValueIncluded, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 4);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 4);
  assert.equal(events.filter((event) => event.name === "task.created").length, 4);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 4);
});

test("cloud live-provider runtime initial builders execute approved shells as deferred", async () => {
  const { deps, calls } = createInitialRuntimeHarness({
    approvals: new Map([
      ["approval-runtime-implementation", { id: "approval-runtime-implementation", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-adapter-implementation", { id: "approval-adapter-implementation", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-module", { id: "approval-module", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-request-builder", { id: "approval-request-builder", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
    ]),
  });
  const builders = createCloudLiveProviderRuntimeInitialBuilders(deps);

  const implementation = await builders.executeCloudConsciousnessLiveProviderRuntimeImplementationTask({
    id: "task-runtime-implementation",
    type: "cloud_consciousness_live_provider_runtime_implementation_task",
    approval: { requestId: "approval-runtime-implementation" },
    cloudConsciousnessLiveProviderRuntimeImplementation: {
      registry: "openclaw-cloud-consciousness-live-provider-runtime-implementation-task-v0",
    },
  });
  const adapterImplementation = await builders.executeCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask({
    id: "task-adapter-implementation",
    type: "cloud_consciousness_live_provider_runtime_adapter_implementation_task",
    approval: { requestId: "approval-adapter-implementation" },
    cloudConsciousnessLiveProviderRuntimeAdapterImplementation: {
      registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0",
    },
  });
  const moduleTask = await builders.executeCloudConsciousnessLiveProviderRuntimeAdapterModuleTask({
    id: "task-module",
    type: "cloud_consciousness_live_provider_runtime_adapter_module_task",
    approval: { requestId: "approval-module" },
    cloudConsciousnessLiveProviderRuntimeAdapterModule: {
      registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
    },
  });
  const requestBuilder = await builders.executeCloudConsciousnessLiveProviderRequestBuilderTask({
    id: "task-request-builder",
    type: "cloud_consciousness_live_provider_request_builder_task",
    approval: { requestId: "approval-request-builder" },
    cloudConsciousnessLiveProviderRequestBuilder: {
      registry: "openclaw-cloud-consciousness-live-provider-request-builder-task-v0",
    },
  });

  assert.equal(implementation.summary.implementationStatus, "deferred_after_approval");
  assert.equal(implementation.summary.liveProviderCallEnabled, false);
  assert.equal(adapterImplementation.summary.implementationStatus, "deferred_after_approval");
  assert.equal(adapterImplementation.summary.networkEgress, false);
  assert.equal(moduleTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(moduleTask.summary.writesSource, false);
  assert.equal(requestBuilder.summary.implementationStatus, "deferred_after_approval");
  assert.equal(requestBuilder.summary.credentialValueIncluded, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 4);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 4);
});
