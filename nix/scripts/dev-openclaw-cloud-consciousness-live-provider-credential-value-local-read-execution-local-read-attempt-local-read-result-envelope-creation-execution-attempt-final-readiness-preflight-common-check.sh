#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE114_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE114_PORT_BASE:-26300}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_114_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-114-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-114-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0"
PHASE112_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-112-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-check.json"
PHASE112_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-112-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-check.json"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${BEFORE_FILE:-}" "${RECORD_FILE:-}" "${AFTER_FILE:-}" "${APPROVED_AFTER_FILE:-}"
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
  node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Final Readiness Preflight",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route",
  approvedDeferredRegistry,
  finalReadinessPreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight: { status: "passed", approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
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
    "$PHASE112_CORE_STATE" \
    "$PHASE112_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-112-result-envelope-creation-execution-attempt-task-shell" \
    "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY" \
    "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred"; then
  PHASE113_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-common-check.sh" >/dev/null
fi

"$SCRIPT_DIR/dev-up.sh"
BEFORE_FILE="$(mktemp)"
RECORD_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
APPROVED_AFTER_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight" > "$BEFORE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight" '{"confirm":true}' > "$RECORD_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight" > "$AFTER_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred" > "$APPROVED_AFTER_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_APPROVED_DEFERRED_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$BEFORE_FILE" "$RECORD_FILE" "$AFTER_FILE" "$APPROVED_AFTER_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const record = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const approvedAfter = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight",
  "Requires Phase 113 credential value local read execution local-read attempt local-read result envelope creation execution attempt approved-deferred evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 114 plan doc missing ${token}`);
}
if (
  !before.ok
  || before.registry !== finalReadinessPreflightRegistry
  || before.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_ready_deferred"
  || before.summary?.ready !== true
  || before.summary?.sourceRegistry !== approvedDeferredRegistry
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded !== false
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !record.ok
  || record.registry !== finalReadinessPreflightRegistry
  || record.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded_deferred"
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded !== true
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !after.ok
  || after.summary?.ready !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || after.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route"
  || approvedAfter.summary?.ready !== true
) {
  throw new Error(`Phase 114 should record result envelope creation execution attempt final readiness preflight without reading credentials or creating envelopes: ${JSON.stringify({ before, record, after, approvedAfter })}`);
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
    throw new Error(`Phase 114 must not read credentials, create envelopes, perform egress, roll back, mutate host state, or launch: ${JSON.stringify(payload)}`);
  }
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight: { status: "passed", sourceTaskId: after.summary.sourceTaskId, approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
