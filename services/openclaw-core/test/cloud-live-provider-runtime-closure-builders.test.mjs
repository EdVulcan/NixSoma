import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeClosureBuilders } from "../src/cloud-live-provider-runtime-closure-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

function createClosureHarness(extraDeps = {}) {
  return createTaskLifecycleHarness({
    deps: {
      ...extraDeps,
    },
  });
}

test("cloud live-provider closure builders preserve local adapter completion read models", async () => {
  const { deps } = createClosureHarness();
  const builders = createCloudLiveProviderRuntimeClosureBuilders(deps);

  const completion = await builders.buildCloudConsciousnessLiveProviderRuntimeAdapterCompletion();
  const closureExit = await builders.buildCloudConsciousnessLiveProviderRuntimeAdapterClosureExit();

  assert.equal(completion.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-completion-v0");
  assert.equal(completion.summary.ready, true);
  assert.equal(completion.summary.methodCount, 6);
  assert.equal(completion.summary.localRuntimeAdapterComplete, true);
  assert.equal(completion.summary.networkEgress, false);
  assert.equal(closureExit.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-exit-v0");
  assert.equal(closureExit.summary.complete, true);
  assert.equal(closureExit.summary.adapterMethodTableClosed, true);
  assert.equal(closureExit.summary.liveProviderCallEnabled, false);
});

test("cloud live-provider closure builders create an approval-gated closure shell", async () => {
  const { deps, calls, events } = createClosureHarness();
  const builders = createCloudLiveProviderRuntimeClosureBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask({ confirm: false }),
    /requires confirm=true/,
  );

  const closureTask = await builders.createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask({ confirm: true });

  assert.equal(closureTask.registry, "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task-v0");
  assert.equal(closureTask.task.cloudConsciousnessLiveProviderRuntimeAdapterClosure.localRuntimeAdapterComplete, true);
  assert.equal(closureTask.task.cloudConsciousnessLiveProviderRuntimeAdapterClosure.adapterMethodTableClosed, true);
  assert.equal(closureTask.task.cloudConsciousnessLiveProviderRuntimeAdapterClosure.networkEgress, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 1);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 1);
  assert.equal(events.filter((event) => event.name === "task.created").length, 1);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 1);
});

test("cloud live-provider closure builders execute approved closure as deferred", async () => {
  const { deps, calls } = createClosureHarness({
    approvals: new Map([
      ["approval-closure", { id: "approval-closure", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
    ]),
  });
  const builders = createCloudLiveProviderRuntimeClosureBuilders(deps);

  const closureTask = await builders.executeCloudConsciousnessLiveProviderRuntimeAdapterClosureTask({
    id: "task-closure",
    type: "cloud_consciousness_live_provider_runtime_adapter_closure_task",
    approval: { requestId: "approval-closure" },
    cloudConsciousnessLiveProviderRuntimeAdapterClosure: {
      registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
    },
  });

  assert.equal(closureTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(closureTask.summary.localRuntimeAdapterComplete, true);
  assert.equal(closureTask.summary.endpointContacted, false);
  assert.equal(closureTask.summary.liveProviderCallEnabled, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 1);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 1);
});
