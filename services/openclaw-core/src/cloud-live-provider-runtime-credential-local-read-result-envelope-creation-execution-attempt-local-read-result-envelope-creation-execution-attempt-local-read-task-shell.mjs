import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";
import { createResultEnvelopeTaskShellRuntime } from "./cloud-live-provider-runtime-result-envelope-task-shell-factory.mjs";

const LOCAL_READ_ROUTE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0";
const LOCAL_READ_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0";
const LOCAL_READ_TASK_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
const LOCAL_READ_APPROVED_DEFERRED_SLUG =
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred";
const LOCAL_READ_TASK_TYPE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task";
const LOCAL_READ_TASK_FIELD =
  "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead";
const LOCAL_READ_TASK_DEFERRED_PHASE =
  "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task_shell_deferred";
const FINAL_READINESS_RECORDED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded";
const LOCAL_READ_TASK_CREATED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated";
const LOCAL_READ_TASK_APPROVED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved";
const LOCAL_READ_TASK_DEFERRED_FIELD =
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadDeferred";

export function createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellRuntime(context) {
  const {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute,
  } = context;

  return createResultEnvelopeTaskShellRuntime({
    ...context,
    buildRoute:
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute,
  }, {
    createName: "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask",
    predicateName: "isCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask",
    executeName: "executeCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask",
    routeRegistry: LOCAL_READ_ROUTE_REGISTRY,
    taskRegistry: LOCAL_READ_TASK_REGISTRY,
    taskSlug: LOCAL_READ_TASK_SLUG,
    approvedDeferredSlug: LOCAL_READ_APPROVED_DEFERRED_SLUG,
    taskType: LOCAL_READ_TASK_TYPE,
    taskField: LOCAL_READ_TASK_FIELD,
    taskDeferredPhase: LOCAL_READ_TASK_DEFERRED_PHASE,
    phaseGovernance: liveProviderPhaseGovernance.phase136Governance,
    taskCreatedField: LOCAL_READ_TASK_CREATED_FIELD,
    taskApprovedField: LOCAL_READ_TASK_APPROVED_FIELD,
    taskDeferredField: LOCAL_READ_TASK_DEFERRED_FIELD,
    sourceReadinessFieldNames: [FINAL_READINESS_RECORDED_FIELD],
    routeReadyError: "Cloud consciousness live provider credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt local-read task requires a ready Phase 135 local-read route.",
    policyIntent: "cloud_consciousness.live_provider_call.credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task",
    policyTags: [
      "cloud_consciousness",
      "live_provider_call",
      "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read",
      "operator_reviewed",
    ],
    goal: "Prepare approval-gated credential value local read result envelope creation execution attempt local-read result envelope creation execution attempt local-read task shell without reading credential values or creating result envelopes",
    workViewStrategy: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read",
    planner: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0",
    strategy: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-shell",
    planSummary: "Create an approval-gated credential value local read result envelope creation execution attempt local-read result envelope creation execution attempt local-read task shell while keeping credential values unread, result envelopes uncreated, and endpoint/network activity disabled.",
    reviewStep: {
      id: "review-credential-value-local-read-result-envelope-creation-execution-attempt-local-read-route",
      phase: "review_live_provider_credential_value_local_read_result_envelope_creation_execution_attempt_local_read_route",
      title: "Review Phase 135 credential value local read result envelope creation execution attempt local-read result envelope creation execution attempt local-read route",
      status: "pending",
      requiresApproval: false,
    },
    approvalStepTitle: "Wait for operator approval before credential value local read result envelope creation execution attempt local-read shell can be recorded",
    deferredStep: {
      id: "defer-credential-value-local-read-result-envelope-creation-execution-attempt-local-read",
      phase: LOCAL_READ_TASK_DEFERRED_PHASE,
      title: "Record local-read result envelope creation execution attempt local-read task shell and defer credential value reads, envelope creation, and provider egress",
      status: "pending",
      requiresApproval: true,
      executesNow: false,
    },
    mode: "approval-gated-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task",
    executor: "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0",
    sourcePhase: "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_local_read_route",
    deferredReason: "credential value local read result envelope creation execution attempt local-read task shell approved; credential value read, result envelope creation, endpoint contact, and network egress remain deferred",
    completionSummary: "Approved credential value local read result envelope creation execution attempt local-read task shell recorded; credential values remain unread and result envelopes remain uncreated.",
  });
}
