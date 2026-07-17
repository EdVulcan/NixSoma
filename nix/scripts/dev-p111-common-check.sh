#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 111
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
RESULT_ENVELOPE_CREATION_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-v0"
PHASE110_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-110-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-check.json"
PHASE110_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-110-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-check.json"

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
  openclaw_result_envelope_assert_observer_manifest_surface "$OPENCLAW_RESULT_ENVELOPE_PHASE" "$HTML_FILE" "$CLIENT_FILE"
  exit 0
fi

openclaw_result_envelope_prepare_prereq_state \
  "$SCRIPT_DIR" \
  "$PHASE110_CORE_STATE" \
  "$PHASE110_SYSTEM_HEAL_STATE" \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "phase-110-result-envelope-creation-execution-final-readiness-preflight" \
  "$RESULT_ENVELOPE_CREATION_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY" \
  "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight_recorded" \
  "PHASE110_PORT_BASE" \
  "dev-p110-common-check.sh"

"$SCRIPT_DIR/dev-up.sh"
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route" > "$ROUTE_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_ROUTE_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const attemptRouteRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route",
  "Requires Phase 110 credential value local read execution local-read attempt local-read result envelope creation execution final readiness preflight evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated: false",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 111 plan doc missing ${token}`);
}
if (
  !route.ok
  || route.registry !== attemptRouteRegistry
  || route.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_route_ready"
  || route.summary?.ready !== true
  || route.summary?.sourceRegistry !== finalReadinessPreflightRegistry
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded !== true
  || route.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated !== false
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || route.summary?.credentialValueRead !== false
  || route.summary?.credentialValueIncluded !== false
  || route.summary?.credentialValueExposed !== false
  || route.summary?.providerCredentialRead !== false
  || route.summary?.endpointContacted !== false
  || route.summary?.networkEgress !== false
  || route.summary?.providerResponseCreated !== false
  || route.summary?.rollbackExecuted !== false
  || route.summary?.rollbackCommandCreated !== false
  || route.summary?.hostMutation !== false
  || route.summary?.transmitsExternally !== false
  || route.summary?.liveProviderCallEnabled !== false
  || route.summary?.launchAuthorized !== false
  || route.summary?.launchExecuted !== false
  || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"
) {
  throw new Error(`Phase 111 should route to result envelope creation execution attempt task shell without reading credentials, creating envelopes, or egress: ${JSON.stringify(route)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute: { status: "passed", sourceTaskId: route.summary.sourceTaskId, finalReadinessPreflightRegistry, attemptRouteRegistry } }, null, 2));
EOF
