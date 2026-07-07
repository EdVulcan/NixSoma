#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 109
RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-v0"
PHASE108_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-108-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-check.json"
PHASE108_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-108-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-check.json"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${APPROVED_DEFERRED_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  "$SCRIPT_DIR/dev-up.sh"
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_APPROVED_DEFERRED_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const resultEnvelopeCreationExecutionTaskRegistry = process.argv[2];
const resultEnvelopeCreationExecutionApprovedDeferredRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Approved Deferred",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight",
  resultEnvelopeCreationExecutionTaskRegistry,
  resultEnvelopeCreationExecutionApprovedDeferredRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred: { status: "passed", resultEnvelopeCreationExecutionTaskRegistry, resultEnvelopeCreationExecutionApprovedDeferredRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
if [[ -f "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh"
fi

if ! declare -F openclaw_reuse_prereq_state >/dev/null \
  || ! openclaw_reuse_prereq_state \
    "$PHASE108_CORE_STATE" \
    "$PHASE108_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-108-result-envelope-creation-execution-task-shell" \
    "$RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY" \
    "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_task_shell_deferred"; then
  PHASE108_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-common-check.sh" >/dev/null
fi

"$SCRIPT_DIR/dev-up.sh"
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const resultEnvelopeCreationExecutionTaskRegistry = process.argv[2];
const resultEnvelopeCreationExecutionApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred",
  "Requires Phase 108 credential value local read execution local-read attempt local-read result envelope creation execution task shell evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 109 plan doc missing ${token}`);
}
const summary = approvedDeferred.summary ?? {};
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== resultEnvelopeCreationExecutionApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_approved_deferred_ready"
  || summary.ready !== true
  || summary.sourceRegistry !== resultEnvelopeCreationExecutionTaskRegistry
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionDeferred !== true
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
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight"
) {
  throw new Error(`Phase 109 should expose approved deferred result envelope creation execution evidence without reading credentials, creating envelopes, or egress: ${JSON.stringify(approvedDeferred)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred: { status: "passed", sourceTaskId: summary.sourceTaskId, resultEnvelopeCreationExecutionTaskRegistry, resultEnvelopeCreationExecutionApprovedDeferredRegistry } }, null, 2));
EOF
