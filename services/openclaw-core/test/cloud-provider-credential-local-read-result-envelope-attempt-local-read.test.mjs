import test from "node:test";
import assert from "node:assert/strict";

import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime } from "../src/cloud-provider-credential-local-read-result-envelope-attempt-local-read.mjs";

const EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0";
const EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0";
const EXECUTION_ATTEMPT_LOCAL_READ_TASK_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
const EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_LOCAL_READ_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated";

function buildReadyFinalReadinessPreflight() {
  return {
    ok: true,
    registry: EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY,
    status: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded_deferred",
    preflight: {
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
    },
    summary: {
      ready: true,
      sourceTaskId: "task-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt",
      sourceRegistry: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0",
      [EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD]: true,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      credentialValueIncluded: false,
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
      launchAuthorized: false,
      launchExecuted: false,
    },
  };
}

test("credential local-read result-envelope creation execution attempt local-read route preserves Phase 135 route-only boundary", async () => {
  const builders = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight:
      async () => buildReadyFinalReadinessPreflight(),
  });

  const route = await builders.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute();

  assert.equal(route.registry, EXECUTION_ATTEMPT_LOCAL_READ_ROUTE_REGISTRY);
  assert.equal(route.status, "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_route_ready");
  assert.equal(route.summary.ready, true);
  assert.equal(route.summary.sourceRegistry, EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY);
  assert.equal(route.summary[EXECUTION_ATTEMPT_FINAL_READINESS_RECORDED_FIELD], true);
  assert.equal(route.summary.selectedSlice, EXECUTION_ATTEMPT_LOCAL_READ_TASK_SLUG);
  assert.equal(route.summary[EXECUTION_ATTEMPT_LOCAL_READ_TASK_CREATED_FIELD], false);
  assert.equal(route.summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated, false);
  assert.equal(route.summary.credentialValueRead, false);
  assert.equal(route.summary.credentialValueIncluded, false);
  assert.equal(route.summary.credentialValueExposed, false);
  assert.equal(route.summary.providerCredentialRead, false);
  assert.equal(route.summary.endpointContacted, false);
  assert.equal(route.summary.networkEgress, false);
  assert.equal(route.summary.providerResponseCreated, false);
  assert.equal(route.summary.rollbackExecuted, false);
  assert.equal(route.summary.rollbackCommandCreated, false);
  assert.equal(route.summary.hostMutation, false);
  assert.equal(route.summary.transmitsExternally, false);
  assert.equal(route.summary.liveProviderCallEnabled, false);
  assert.equal(route.summary.launchAuthorized, false);
  assert.equal(route.summary.launchExecuted, false);
  assert.equal(route.next.recommendedSlice, EXECUTION_ATTEMPT_LOCAL_READ_TASK_SLUG);
});
