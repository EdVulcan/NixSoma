#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 117
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
LOCAL_READ_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0"
LOCAL_READ_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred-v0"
PHASE116_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-116-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell-check.json"
PHASE116_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-116-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell-check.json"

if [[ -f "$SCRIPT_DIR/dev-openclaw-service-reuse.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-service-reuse.sh"
fi

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${APPROVED_DEFERRED_FILE:-}"
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
    "PHASE116_PORT_BASE" \
    "dev-p116-common-check.sh"
else
  echo "Using already-running OpenClaw dev services as the live Phase 116 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$LOCAL_READ_TASK_REGISTRY" "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const localReadTaskRegistry = process.argv[2];
const localReadApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred",
  "Requires Phase 116 credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read task shell evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 117 plan doc missing ${token}`);
}
const summary = approvedDeferred.summary ?? {};
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== localReadApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_approved_deferred_ready"
  || summary.ready !== true
  || summary.sourceRegistry !== localReadTaskRegistry
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadDeferred !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || summary.credentialValueRead !== false
  || summary.credentialValueIncluded !== false
  || summary.credentialValueExposed !== false
  || summary.providerCredentialRead !== false
  || summary.endpointContacted !== false
  || summary.networkEgress !== false
  || summary.providerResponseCreated !== false
  || summary.rollbackExecuted !== false
  || summary.rollbackCommandCreated !== false
  || summary.hostMutation !== false
  || summary.transmitsExternally !== false
  || summary.liveProviderCallEnabled !== false
  || summary.launchAuthorized !== false
  || summary.launchExecuted !== false
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight"
) {
  throw new Error(`Phase 117 should expose approved deferred result envelope creation execution attempt local-read evidence without reading credentials, creating envelopes, or egress: ${JSON.stringify(approvedDeferred)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferred: { status: "passed", sourceTaskId: summary.sourceTaskId, localReadTaskRegistry, localReadApprovedDeferredRegistry } }, null, 2));
EOF
