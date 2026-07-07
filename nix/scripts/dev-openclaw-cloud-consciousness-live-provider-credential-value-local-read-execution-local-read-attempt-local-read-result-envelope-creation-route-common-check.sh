#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 103
RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-v0"
RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-v0"
PHASE102_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-102-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-check.json"
PHASE102_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-102-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-check.json"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${ROUTE_FILE:-}"
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
  node - <<'EOF' "$RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY" "$RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const resultEnvelopeCreationRouteRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Route",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRoute",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell",
  finalReadinessPreflightRegistry,
  resultEnvelopeCreationRouteRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRoute: { status: "passed", finalReadinessPreflightRegistry, resultEnvelopeCreationRouteRegistry } }, null, 2));
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
    "$PHASE102_CORE_STATE" \
    "$PHASE102_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-102-result-envelope-final-readiness-preflight" \
    "$RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY" \
    "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_final_readiness_preflight_recorded"; then
  PHASE102_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-common-check.sh" >/dev/null
fi

"$SCRIPT_DIR/dev-up.sh"
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route" > "$ROUTE_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_FINAL_READINESS_PREFLIGHT_REGISTRY" "$RESULT_ENVELOPE_CREATION_ROUTE_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const resultEnvelopeCreationRouteRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
  "Requires Phase 102 credential value local read execution local-read attempt local-read result envelope final readiness preflight evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskCreated: false",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 103 plan doc missing ${token}`);
}
if (
  !route.ok
  || route.registry !== resultEnvelopeCreationRouteRegistry
  || route.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_route_ready"
  || route.summary?.ready !== true
  || route.summary?.sourceRegistry !== finalReadinessPreflightRegistry
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded !== true
  || route.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell"
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskCreated !== false
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || route.summary?.credentialValueRead !== false
  || route.summary?.credentialValueIncluded !== false
  || route.summary?.credentialValueExposed !== false
  || route.summary?.providerCredentialRead !== false
  || route.summary?.endpointContacted !== false
  || route.summary?.networkEgress !== false
  || route.summary?.liveProviderCallEnabled !== false
  || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell"
) {
  throw new Error(`Phase 103 should route to result envelope creation task shell without reading credentials, creating envelopes, or egress: ${JSON.stringify(route)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRoute: { status: "passed", sourceTaskId: route.summary.sourceTaskId, finalReadinessPreflightRegistry, resultEnvelopeCreationRouteRegistry } }, null, 2));
EOF
