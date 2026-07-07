#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE106_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE106_PORT_BASE:-25500}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_106_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-106-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-106-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
RESULT_ENVELOPE_CREATION_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-v0"
RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${BEFORE_FILE:-}" "${RECORD_FILE:-}" "${AFTER_FILE:-}"
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
  node - <<'EOF' "$RESULT_ENVELOPE_CREATION_APPROVED_DEFERRED_REGISTRY" "$RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Final Readiness Preflight",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route",
  approvedDeferredRegistry,
  finalReadinessPreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight: { status: "passed", approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
PHASE105_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-common-check.sh" >/dev/null

"$SCRIPT_DIR/dev-up.sh"
BEFORE_FILE="$(mktemp)"
RECORD_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight" > "$BEFORE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight" '{"confirm":true}' > "$RECORD_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight" > "$AFTER_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_APPROVED_DEFERRED_REGISTRY" "$RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$BEFORE_FILE" "$RECORD_FILE" "$AFTER_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const record = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
  "Requires Phase 105 credential value local read execution local-read attempt local-read result envelope creation approved-deferred evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 106 plan doc missing ${token}`);
}
if (
  !before.ok
  || before.registry !== finalReadinessPreflightRegistry
  || before.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_final_readiness_preflight_ready_deferred"
  || before.summary?.ready !== true
  || before.summary?.sourceRegistry !== approvedDeferredRegistry
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded !== false
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !record.ok
  || record.registry !== finalReadinessPreflightRegistry
  || record.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_final_readiness_preflight_recorded_deferred"
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded !== true
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !after.ok
  || after.summary?.ready !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || after.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route"
) {
  throw new Error(`Phase 106 should record result envelope creation final readiness preflight without reading credentials or creating envelopes: ${JSON.stringify({ before, record, after })}`);
}
for (const payload of [before.summary, record.preflight.summary, after.summary]) {
  if (
    payload.credentialValueRead !== false
    || payload.credentialValueIncluded !== false
    || payload.credentialValueExposed !== false
    || payload.providerCredentialRead !== false
    || payload.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
    || payload.endpointContacted !== false
    || payload.networkEgress !== false
    || payload.liveProviderCallEnabled !== false
  ) {
    throw new Error(`Phase 106 must not read credentials, create envelopes, or perform egress: ${JSON.stringify(payload)}`);
  }
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight: { status: "passed", sourceTaskId: after.summary.sourceTaskId, approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
