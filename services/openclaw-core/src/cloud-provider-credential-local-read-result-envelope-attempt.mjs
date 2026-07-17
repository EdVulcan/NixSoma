import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0";
const EXECUTION_ATTEMPT_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-route-v0";
const EXECUTION_ATTEMPT_TASK_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
const EXECUTION_FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded";
const EXECUTION_ATTEMPT_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated";

export function createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRuntime(context) {
  const {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight,
  } = context;

  async function buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute() {
    const finalReadinessPreflight =
      await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight();
    const decision = {
      decision: "route_to_approval_gated_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task",
      selectedSlice: EXECUTION_ATTEMPT_TASK_SLUG,
      reason: "The result envelope creation execution final readiness preflight is recorded; the next gate is a separate approval-gated result envelope creation execution attempt task shell before any credential value can be read or represented.",
      requiredBeforeCredentialValueRead: [
        "separate approval-gated credential value local read result envelope creation execution attempt task shell",
        "redaction-safe local result envelope creation execution attempt contract that never exposes credential values",
        "explicit local-only proof that endpoint/network egress remains unauthorized",
        "provider request assembly, provider response creation, rollback, host mutation, and live calls remain separately gated",
      ],
      credentialReference: finalReadinessPreflight.preflight?.credentialReference ?? "openclaw://credential/provider/live-provider-fixture",
      [EXECUTION_FINAL_READINESS_RECORDED_FIELD]:
        finalReadinessPreflight.summary?.[EXECUTION_FINAL_READINESS_RECORDED_FIELD] === true,
      [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: false,
      credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
      credentialValueRead: false,
      credentialValueIncluded: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
    };
    const checks = [
      {
        id: "phase-130-result-envelope-creation-execution-final-readiness-preflight-recorded",
        label: "Phase 130 credential value result envelope creation execution final readiness preflight is recorded",
        passed: finalReadinessPreflight.summary?.ready === true
          && finalReadinessPreflight.summary?.[EXECUTION_FINAL_READINESS_RECORDED_FIELD] === true,
        evidence: finalReadinessPreflight.summary?.sourceTaskId ?? null,
      },
      {
        id: "credential-value-still-unread",
        label: "Credential value remains unread, unexposed, and outside provider reads",
        passed: finalReadinessPreflight.summary?.credentialValueRead === false
          && finalReadinessPreflight.summary?.credentialValueIncluded === false
          && finalReadinessPreflight.summary?.credentialValueExposed === false
          && finalReadinessPreflight.summary?.providerCredentialRead === false
          && decision.credentialValueRead === false,
        evidence: decision.credentialReference,
      },
      {
        id: "result-envelope-creation-execution-attempt-task-not-created",
        label: "Result envelope creation execution attempt route does not create a task or result envelope",
        passed: decision[EXECUTION_ATTEMPT_TASK_CREATED_FIELD] === false
          && decision.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated === false,
        evidence: decision.selectedSlice,
      },
      {
        id: "no-endpoint-network-rollback-mutation-launch-or-live-call",
        label: "Result envelope creation execution attempt route does not contact endpoints, transmit externally, roll back, mutate host state, launch, or enable live provider calls",
        passed: finalReadinessPreflight.summary?.endpointContacted === false
          && finalReadinessPreflight.summary?.networkEgress === false
          && finalReadinessPreflight.summary?.providerResponseCreated === false
          && finalReadinessPreflight.summary?.rollbackExecuted === false
          && finalReadinessPreflight.summary?.rollbackCommandCreated === false
          && finalReadinessPreflight.summary?.hostMutation === false
          && finalReadinessPreflight.summary?.transmitsExternally === false
          && finalReadinessPreflight.summary?.liveProviderCallEnabled === false
          && finalReadinessPreflight.summary?.launchAuthorized === false
          && finalReadinessPreflight.summary?.launchExecuted === false,
        evidence: "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_route_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: EXECUTION_ATTEMPT_ROUTE_REGISTRY,
      mode: "phase_131_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_route",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_route_ready" : "waiting_for_phase_130_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight",
      governance: liveProviderPhaseGovernance.phase131Governance({
        [EXECUTION_FINAL_READINESS_RECORDED_FIELD]:
          finalReadinessPreflight.summary?.[EXECUTION_FINAL_READINESS_RECORDED_FIELD] === true,
      }),
      decision,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-131",
        finalReadinessPreflightFound: finalReadinessPreflight.summary?.ready === true,
        [EXECUTION_FINAL_READINESS_RECORDED_FIELD]:
          finalReadinessPreflight.summary?.[EXECUTION_FINAL_READINESS_RECORDED_FIELD] === true,
        sourceTaskId: finalReadinessPreflight.summary?.sourceTaskId ?? null,
        sourceRegistry: EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY,
        selectedSlice: decision.selectedSlice,
        [EXECUTION_ATTEMPT_TASK_CREATED_FIELD]: false,
        credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
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
      },
      evidence: {
        finalReadinessPreflight,
      },
      next: {
        recommendedSlice: EXECUTION_ATTEMPT_TASK_SLUG,
        boundary: "credential value reads, local read result envelope creation, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }

  return {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute,
  };
}
