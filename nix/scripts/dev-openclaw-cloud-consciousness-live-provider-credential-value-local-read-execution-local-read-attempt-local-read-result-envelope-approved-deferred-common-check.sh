#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE101_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE101_PORT_BASE:-25000}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_101_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-101-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-101-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
RESULT_ENVELOPE_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-v0"
RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-v0"
PHASE100_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-100-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-check.json"
PHASE100_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-100-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-check.json"

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
  node - <<'EOF' "$RESULT_ENVELOPE_TASK_REGISTRY" "$RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const resultEnvelopeTaskRegistry = process.argv[2];
const resultEnvelopeApprovedDeferredRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Approved Deferred",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferred",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
  resultEnvelopeTaskRegistry,
  resultEnvelopeApprovedDeferredRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferred: { status: "passed", resultEnvelopeTaskRegistry, resultEnvelopeApprovedDeferredRegistry } }, null, 2));
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
    "$PHASE100_CORE_STATE" \
    "$PHASE100_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-100-result-envelope-task-shell-approved-deferred-state" \
    "$RESULT_ENVELOPE_TASK_REGISTRY" \
    "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_task_shell_deferred"; then
  PHASE100_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-common-check.sh" >/dev/null
fi

"$SCRIPT_DIR/dev-up.sh"
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_TASK_REGISTRY" "$RESULT_ENVELOPE_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const resultEnvelopeTaskRegistry = process.argv[2];
const resultEnvelopeApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
  "Requires Phase 100 credential value local read execution local-read attempt local-read result envelope task shell evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 101 plan doc missing ${token}`);
}
const summary = approvedDeferred.summary ?? {};
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== resultEnvelopeApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_approved_deferred_ready"
  || summary.ready !== true
  || summary.sourceRegistry !== resultEnvelopeTaskRegistry
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskCreated !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskApproved !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeDeferred !== true
  || summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || summary.credentialValueRead !== false
  || summary.credentialValueIncluded !== false
  || summary.credentialValueExposed !== false
  || summary.providerCredentialRead !== false
  || summary.endpointContacted !== false
  || summary.networkEgress !== false
  || summary.liveProviderCallEnabled !== false
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight"
) {
  throw new Error(`Phase 101 should expose approved deferred result envelope evidence without reading credentials, creating envelopes, or egress: ${JSON.stringify(approvedDeferred)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferred: { status: "passed", sourceTaskId: summary.sourceTaskId, resultEnvelopeTaskRegistry, resultEnvelopeApprovedDeferredRegistry } }, null, 2));
EOF
