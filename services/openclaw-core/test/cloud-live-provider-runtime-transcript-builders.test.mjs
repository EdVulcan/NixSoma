import test from "node:test";
import assert from "node:assert/strict";

import { createCloudLiveProviderRuntimeTranscriptBuilders } from "../src/cloud-live-provider-runtime-transcript-builders.mjs";
import { createTaskLifecycleHarness } from "./task-builder-harness.mjs";

const CREDENTIAL_REFERENCE = "openclaw://credential/provider/live-provider-fixture";

function createNoNetworkSenderReadModel() {
  const providerRequest = {
    request: {
      method: "POST",
      path: "/v1/chat/completions",
      headers: {
        "content-type": "application/json",
      },
      body: {
        metadata: {
          openclawRequestId: "test-request",
        },
        messages: [
          {
            role: "user",
            content: "hello",
          },
        ],
      },
      bodyText: "{\"metadata\":{\"openclawRequestId\":\"test-request\"},\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}",
      credentialReference: CREDENTIAL_REFERENCE,
      credentialValue: null,
      endpoint: {
        fingerprint: "test-endpoint",
        contacted: false,
      },
    },
  };
  const credentialResolution = {
    credential: {
      reference: CREDENTIAL_REFERENCE,
      value: null,
      resolvedValue: null,
    },
  };
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-send-provider-request-v0",
    egressEnvelope: {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-send-provider-request-v0",
      egressEnvelope: {
        dispatch: "deferred",
        method: "POST",
        path: "/v1/chat/completions",
        headers: {
          "content-type": "application/json",
          "x-openclaw-egress-mode": "disabled",
        },
        bodyText: providerRequest.request.bodyText,
        credentialReference: CREDENTIAL_REFERENCE,
        credentialValue: null,
        endpoint: {
          fingerprint: "test-endpoint",
          contacted: false,
        },
        response: null,
      },
      summary: {
        ready: true,
        dispatchDeferred: true,
        networkEgress: false,
      },
    },
    credentialResolver: {
      requestBuilder: {
        providerRequest,
      },
      credentialResolution,
    },
    summary: {
      ready: true,
      dispatchDeferred: true,
      networkEgress: false,
    },
  };
}

function createTranscriptHarness(extraDeps = {}) {
  return createTaskLifecycleHarness({
    deps: {
      buildCloudConsciousnessLiveProviderNoNetworkSender: async () => createNoNetworkSenderReadModel(),
      ...extraDeps,
    },
  });
}

test("cloud live-provider transcript builders preserve local-only read models", async () => {
  const { deps } = createTranscriptHarness();
  const builders = createCloudLiveProviderRuntimeTranscriptBuilders(deps);

  const transcriptRecorder = await builders.buildCloudConsciousnessLiveProviderEgressTranscriptRecorder();
  const responseVerifier = await builders.buildCloudConsciousnessLiveProviderResponseVerifier();
  const rollbackNote = await builders.buildCloudConsciousnessLiveProviderRollbackNote();

  assert.equal(transcriptRecorder.registry, "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-v0");
  assert.equal(transcriptRecorder.summary.ready, true);
  assert.equal(transcriptRecorder.summary.localOnly, true);
  assert.equal(transcriptRecorder.summary.networkEgress, false);
  assert.equal(responseVerifier.registry, "openclaw-cloud-consciousness-live-provider-response-verifier-v0");
  assert.equal(responseVerifier.summary.ready, true);
  assert.equal(responseVerifier.summary.providerResponseCreated, false);
  assert.equal(rollbackNote.registry, "openclaw-cloud-consciousness-live-provider-rollback-note-v0");
  assert.equal(rollbackNote.summary.ready, true);
  assert.equal(rollbackNote.summary.rollbackCommandCreated, false);
  assert.equal(rollbackNote.summary.hostMutation, false);
});

test("cloud live-provider transcript builders create approval-gated task shells", async () => {
  const { deps, calls, events } = createTranscriptHarness();
  const builders = createCloudLiveProviderRuntimeTranscriptBuilders(deps);

  await assert.rejects(
    () => builders.createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask({ confirm: false }),
    /requires confirm=true/,
  );

  const transcriptTask = await builders.createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask({ confirm: true });
  const responseTask = await builders.createCloudConsciousnessLiveProviderResponseVerifierTask({ confirm: true });
  const rollbackTask = await builders.createCloudConsciousnessLiveProviderRollbackNoteTask({ confirm: true });

  assert.equal(transcriptTask.registry, "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task-v0");
  assert.equal(transcriptTask.task.cloudConsciousnessLiveProviderEgressTranscriptRecorder.localOnly, true);
  assert.equal(responseTask.registry, "openclaw-cloud-consciousness-live-provider-response-verifier-task-v0");
  assert.equal(responseTask.task.cloudConsciousnessLiveProviderResponseVerifier.providerResponseCreated, false);
  assert.equal(rollbackTask.registry, "openclaw-cloud-consciousness-live-provider-rollback-note-task-v0");
  assert.equal(rollbackTask.task.cloudConsciousnessLiveProviderRollbackNote.rollbackExecuted, false);
  assert.equal(calls.filter((call) => call.name === "createTask").length, 3);
  assert.equal(calls.filter((call) => call.name === "createApprovalRequestForTask").length, 3);
  assert.equal(events.filter((event) => event.name === "task.created").length, 3);
  assert.equal(events.filter((event) => event.name === "approval.pending").length, 3);
});

test("cloud live-provider transcript builders execute approved shells as deferred", async () => {
  const { deps, calls } = createTranscriptHarness({
    approvals: new Map([
      ["approval-transcript", { id: "approval-transcript", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-response", { id: "approval-response", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
      ["approval-rollback", { id: "approval-rollback", status: "approved", updatedAt: "2026-07-08T00:00:00.000Z" }],
    ]),
  });
  const builders = createCloudLiveProviderRuntimeTranscriptBuilders(deps);

  const transcriptTask = await builders.executeCloudConsciousnessLiveProviderEgressTranscriptRecorderTask({
    id: "task-transcript",
    type: "cloud_consciousness_live_provider_egress_transcript_recorder_task",
    approval: { requestId: "approval-transcript" },
    cloudConsciousnessLiveProviderEgressTranscriptRecorder: {
      registry: "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task-v0",
    },
  });
  const responseTask = await builders.executeCloudConsciousnessLiveProviderResponseVerifierTask({
    id: "task-response",
    type: "cloud_consciousness_live_provider_response_verifier_task",
    approval: { requestId: "approval-response" },
    cloudConsciousnessLiveProviderResponseVerifier: {
      registry: "openclaw-cloud-consciousness-live-provider-response-verifier-task-v0",
    },
  });
  const rollbackTask = await builders.executeCloudConsciousnessLiveProviderRollbackNoteTask({
    id: "task-rollback",
    type: "cloud_consciousness_live_provider_rollback_note_task",
    approval: { requestId: "approval-rollback" },
    cloudConsciousnessLiveProviderRollbackNote: {
      registry: "openclaw-cloud-consciousness-live-provider-rollback-note-task-v0",
    },
  });

  assert.equal(transcriptTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(transcriptTask.summary.networkEgress, false);
  assert.equal(responseTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(responseTask.summary.providerResponseCreated, false);
  assert.equal(rollbackTask.summary.implementationStatus, "deferred_after_approval");
  assert.equal(rollbackTask.summary.hostMutation, false);
  assert.equal(calls.filter((call) => call.name === "appendTaskPhase").length, 3);
  assert.equal(calls.filter((call) => call.name === "completeTask").length, 3);
});
