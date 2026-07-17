#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 118
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
LOCAL_READ_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0"
LOCAL_READ_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred-v0"
LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight-v0"
PHASE116_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-116-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell-check.json"
PHASE116_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-116-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell-check.json"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

if [[ -f "$SCRIPT_DIR/dev-openclaw-service-reuse.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-service-reuse.sh"
fi

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${BEFORE_FILE:-}" "${RECORD_FILE:-}" "${AFTER_FILE:-}" "${APPROVED_AFTER_FILE:-}"
  if declare -F openclaw_dev_cleanup_for_check >/dev/null; then
    openclaw_dev_cleanup_for_check "$SCRIPT_DIR"
  else
    "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if declare -F openclaw_dev_down_before_check >/dev/null; then
  openclaw_dev_down_before_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
fi

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  if declare -F openclaw_dev_up_for_check >/dev/null; then
    openclaw_dev_up_for_check "$SCRIPT_DIR"
  else
    "$SCRIPT_DIR/dev-up.sh"
  fi
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  openclaw_result_envelope_assert_observer_manifest_surface "$OPENCLAW_RESULT_ENVELOPE_PHASE" "$HTML_FILE" "$CLIENT_FILE"
  exit 0
fi

if ! declare -F openclaw_dev_services_already_up >/dev/null || ! openclaw_dev_services_already_up; then
  openclaw_result_envelope_prepare_prereq_state \
    "$SCRIPT_DIR" \
    "$PHASE116_CORE_STATE" \
    "$PHASE116_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-116-result-envelope-creation-execution-attempt-local-read-task-shell" \
    "$LOCAL_READ_TASK_REGISTRY" \
    "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_task_shell_deferred" \
    "PHASE117_PORT_BASE" \
    "dev-p117-common-check.sh"
else
  echo "Using already-running OpenClaw dev services as the live Phase 117 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
BEFORE_FILE="$(mktemp)"
RECORD_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
APPROVED_AFTER_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight" > "$BEFORE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight" '{"confirm":true}' > "$RECORD_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight" > "$AFTER_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred" > "$APPROVED_AFTER_FILE"

node - <<'EOF' "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$BEFORE_FILE" "$RECORD_FILE" "$AFTER_FILE" "$APPROVED_AFTER_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const record = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const approvedAfter = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight",
  "Requires Phase 117 credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read approved-deferred evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 118 plan doc missing ${token}`);
}
if (
  !before.ok
  || before.registry !== finalReadinessPreflightRegistry
  || before.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_final_readiness_preflight_ready_deferred"
  || before.summary?.ready !== true
  || before.summary?.sourceRegistry !== approvedDeferredRegistry
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflightRecorded !== false
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !record.ok
  || record.registry !== finalReadinessPreflightRegistry
  || record.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_final_readiness_preflight_recorded_deferred"
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflightRecorded !== true
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !after.ok
  || after.summary?.ready !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflightRecorded !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || after.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-route"
  || approvedAfter.summary?.ready !== true
) {
  throw new Error(`Phase 118 should record result envelope creation execution attempt local-read final readiness preflight without reading credentials or creating envelopes: ${JSON.stringify({ before, record, after, approvedAfter })}`);
}
for (const payload of [before.summary, record.preflight.summary, after.summary, approvedAfter.summary]) {
  if (
    payload.credentialValueRead !== false
    || payload.credentialValueIncluded !== false
    || payload.credentialValueExposed !== false
    || payload.providerCredentialRead !== false
    || payload.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
    || payload.endpointContacted !== false
    || payload.networkEgress !== false
    || payload.providerResponseCreated !== false
    || payload.rollbackExecuted !== false
    || payload.rollbackCommandCreated !== false
    || payload.hostMutation !== false
    || payload.transmitsExternally !== false
    || payload.liveProviderCallEnabled !== false
    || payload.launchAuthorized !== false
    || payload.launchExecuted !== false
  ) {
    throw new Error(`Phase 118 must not read credentials, create envelopes, perform egress, roll back, mutate host state, or launch: ${JSON.stringify(payload)}`);
  }
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflight: { status: "passed", sourceTaskId: after.summary.sourceTaskId, approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
