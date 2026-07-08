import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeCredentialReferenceBuilders } from "../src/cloud-live-provider-runtime-credential-reference-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

function createRequestBuilderReadModel() {
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-request-builder-v0",
    providerRequest: {
      request: {
        method: "POST",
        path: "/v1/chat/completions",
        bodyText: "{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}",
        credentialReference: "openclaw://credential/provider/live-provider-fixture",
        credentialValue: null,
        endpoint: {
          contacted: false,
        },
      },
    },
    summary: {
      ready: true,
      credentialValueIncluded: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
  };
}

function createCredentialReferenceHarness(extraDeps = {}) {
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderRequestBuilder: async () => createRequestBuilderReadModel(),
      ...extraDeps,
    },
  });
}

test("cloud live-provider credential-reference builders preserve reference-only read models", async () => {
  const { deps } = createCredentialReferenceHarness();
  const builders = createCloudLiveProviderRuntimeCredentialReferenceBuilders(deps);

  const credentialResolver = await builders.buildCloudConsciousnessLiveProviderCredentialReferenceResolver();
  const noNetworkSender = await builders.buildCloudConsciousnessLiveProviderNoNetworkSender();

  assert.equal(credentialResolver.registry, "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-v0");
  assert.equal(credentialResolver.summary.ready, true);
  assert.equal(credentialResolver.summary.referenceOnly, true);
  assert.equal(credentialResolver.summary.credentialValueRead, false);
  assert.equal(noNetworkSender.registry, "openclaw-cloud-consciousness-live-provider-send-provider-request-v0");
  assert.equal(noNetworkSender.summary.ready, true);
  assert.equal(noNetworkSender.summary.dispatchDeferred, true);
  assert.equal(noNetworkSender.summary.networkEgress, false);
});

test("cloud live-provider credential-reference builders create approval-gated task shells", async () => {
  const { deps, calls, events } = createCredentialReferenceHarness();
  const builders = createCloudLiveProviderRuntimeCredentialReferenceBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderCredentialReferenceResolverTask({ confirm: false }),
    /requires confirm=true/,
  );
  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderNoNetworkSenderTask({ confirm: false }),
    /requires confirm=true/,
  );

  const credentialTask = await builders.createCloudConsciousnessLiveProviderCredentialReferenceResolverTask({ confirm: true });
  const senderTask = await builders.createCloudConsciousnessLiveProviderNoNetworkSenderTask({ confirm: true });

  assert.equal(credentialTask.registry, "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task-v0");
  assert.equal(credentialTask.task.cloudConsciousnessLiveProviderCredentialReferenceResolver.referenceOnly, true);
  assert.equal(credentialTask.task.cloudConsciousnessLiveProviderCredentialReferenceResolver.credentialValueRead, false);
  assert.equal(senderTask.registry, "openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0");
  assert.equal(senderTask.task.cloudConsciousnessLiveProviderNoNetworkSender.dispatchDeferred, true);
  assert.equal(senderTask.task.cloudConsciousnessLiveProviderNoNetworkSender.networkEgress, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 2);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 2);
  assert.equal(events.filter((event) => event.name === "task.created").length, 2);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 2);
});

test("cloud live-provider credential-reference builders execute approved shells as deferred", async () => {
  const { deps, calls } = createCredentialReferenceHarness({
    approvals: new Map([
      ["approval-credential-reference", { id: "approval-credential-reference", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-no-network-sender", { id: "approval-no-network-sender", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
    ]),
  });
  const builders = createCloudLiveProviderRuntimeCredentialReferenceBuilders(deps);

  const credentialTask = await builders.executeCloudConsciousnessLiveProviderCredentialReferenceResolverTask({
    id: "task-credential-reference",
    type: "cloud_consciousness_live_provider_credential_reference_resolver_task",
    approval: { requestId: "approval-credential-reference" },
    cloudConsciousnessLiveProviderCredentialReferenceResolver: {
      registry: "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task-v0",
    },
  });
  const senderTask = await builders.executeCloudConsciousnessLiveProviderNoNetworkSenderTask({
    id: "task-no-network-sender",
    type: "cloud_consciousness_live_provider_no_network_sender_task",
    approval: { requestId: "approval-no-network-sender" },
    cloudConsciousnessLiveProviderNoNetworkSender: {
      registry: "openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0",
    },
  });

  assert.equal(credentialTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(credentialTask.summary.credentialValueRead, false);
  assert.equal(senderTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(senderTask.summary.networkEgress, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 2);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 2);
});
