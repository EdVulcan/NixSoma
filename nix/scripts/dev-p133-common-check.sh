#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 133
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_SLUG="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0"
PHASE132_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-132-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-check.json"
PHASE132_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-132-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-check.json"

if [[ -f "$SCRIPT_DIR/dev-openclaw-service-reuse.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-service-reuse.sh"
fi

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${READBACK_FILE:-}"
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
    "$PHASE132_CORE_STATE" \
    "$PHASE132_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-132-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-task-shell" \
    "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY" \
    "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred_after_approval" \
    "PHASE132_PORT_BASE" \
    "dev-p132-common-check.sh"
else
  echo "Using already-running OpenClaw dev services as the live Phase 132 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
READBACK_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred" > "$READBACK_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const approvedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred",
  "Requires Phase 132 credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution attempt task shell evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 133 plan doc missing ${token}`);
}
const taskApprovedField = "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved";
const taskCreatedField = "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated";
const taskDeferredField = "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred";
if (
  !readback.ok
  || readback.registry !== approvedDeferredRegistry
  || readback.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_attempt_approved_deferred_ready"
  || readback.summary?.ready !== true
  || readback.summary?.sourceRegistry !== taskRegistry
  || readback.summary?.approvedDeferredEvidenceFound !== true
  || readback.summary?.[taskCreatedField] !== true
  || readback.summary?.[taskApprovedField] !== true
  || readback.summary?.[taskDeferredField] !== true
  || readback.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
) {
  throw new Error(`Phase 133 should expose approved deferred credential value local read result envelope creation execution attempt evidence: ${JSON.stringify(readback)}`);
}
if (
  readback.summary.credentialValueIncluded !== false
  || readback.summary.credentialValueRead !== false
  || readback.summary.credentialValueExposed !== false
  || readback.summary.providerCredentialRead !== false
  || readback.summary.endpointContacted !== false
  || readback.summary.networkEgress !== false
  || readback.summary.providerResponseCreated !== false
  || readback.summary.rollbackExecuted !== false
  || readback.summary.rollbackCommandCreated !== false
  || readback.summary.hostMutation !== false
  || readback.summary.transmitsExternally !== false
  || readback.summary.liveProviderCallEnabled !== false
  || readback.summary.launchAuthorized !== false
  || readback.summary.launchExecuted !== false
) {
  throw new Error(`Phase 133 approved deferred readback must not read credentials, create envelopes, or perform egress: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred: { status: "passed", sourceTaskId: readback.summary.sourceTaskId, taskRegistry, approvedDeferredRegistry } }, null, 2));
EOF
