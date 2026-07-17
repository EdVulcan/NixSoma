#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE98_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE98_PORT_BASE:-24700}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_98_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-98-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-98-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LOCAL_READ_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-v0"
LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-v0"
LOCAL_READ_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-v0"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


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
  node - <<'EOF' "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Final Readiness Preflight",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route",
  approvedDeferredRegistry,
  finalReadinessPreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight: { status: "passed", approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
  exit 0
fi

openclaw_credential_value_local_read_attempt_prepare_prereq_state 98

"$SCRIPT_DIR/dev-up.sh"
BEFORE_FILE="$(mktemp)"
RECORD_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight" > "$BEFORE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight" '{"confirm":true}' > "$RECORD_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight" > "$AFTER_FILE"

node - <<'EOF' "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$LOCAL_READ_FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$BEFORE_FILE" "$RECORD_FILE" "$AFTER_FILE"
const fs = require("node:fs");
const approvedDeferredRegistry = process.argv[2];
const finalReadinessPreflightRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const record = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight",
  "Requires Phase 97 credential value local read execution local-read attempt local-read approved-deferred evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 98 plan doc missing ${token}`);
}
if (
  !before.ok
  || before.registry !== finalReadinessPreflightRegistry
  || before.status !== "credential_value_local_read_execution_local_read_attempt_local_read_final_readiness_preflight_ready_deferred"
  || before.summary?.ready !== true
  || before.summary?.sourceRegistry !== approvedDeferredRegistry
  || before.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflightRecorded !== false
  || !record.ok
  || record.registry !== finalReadinessPreflightRegistry
  || record.status !== "credential_value_local_read_execution_local_read_attempt_local_read_final_readiness_preflight_recorded_deferred"
  || record.preflight?.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflightRecorded !== true
  || !after.ok
  || after.summary?.ready !== true
  || after.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflightRecorded !== true
  || after.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route"
) {
  throw new Error(`Phase 98 should record final readiness preflight and route next without reading credentials: ${JSON.stringify({ before, record, after })}`);
}
for (const payload of [before.summary, record.preflight.summary, after.summary]) {
  if (
    payload.credentialValueRead !== false
    || payload.credentialValueIncluded !== false
    || payload.credentialValueExposed !== false
    || payload.providerCredentialRead !== false
    || payload.endpointContacted !== false
    || payload.networkEgress !== false
    || payload.liveProviderCallEnabled !== false
  ) {
    throw new Error(`Phase 98 must not read credentials or perform egress: ${JSON.stringify(payload)}`);
  }
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight: { status: "passed", sourceTaskId: after.summary.sourceTaskId, approvedDeferredRegistry, finalReadinessPreflightRegistry } }, null, 2));
EOF
