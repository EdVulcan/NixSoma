#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 127
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-v0"
PHASE126_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-126-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json"
PHASE126_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-126-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json"

if [[ -f "$SCRIPT_DIR/dev-openclaw-service-reuse.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-service-reuse.sh"
fi

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${ROUTE_FILE:-}"
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
    "$PHASE126_CORE_STATE" \
    "$PHASE126_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-126-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-final-readiness-preflight" \
    "$RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY" \
    "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_final_readiness_preflight_recorded_deferred" \
    "PHASE126_PORT_BASE" \
    "dev-p126-common-check.sh"
else
  echo "Using already-running OpenClaw dev services as the live Phase 126 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route" > "$ROUTE_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const executionRouteRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route",
  "Requires Phase 126 credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation final readiness preflight evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated: false",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 127 plan doc missing ${token}`);
}
if (
  !route.ok
  || route.registry !== executionRouteRegistry
  || route.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_route_ready"
  || route.summary?.ready !== true
  || route.summary?.sourceRegistry !== finalReadinessPreflightRegistry
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded !== true
  || route.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell"
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== false
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || route.summary?.credentialValueRead !== false
  || route.summary?.credentialValueIncluded !== false
  || route.summary?.credentialValueExposed !== false
  || route.summary?.providerCredentialRead !== false
  || route.summary?.endpointContacted !== false
  || route.summary?.networkEgress !== false
  || route.summary?.providerResponseCreated !== false
  || route.summary?.rollbackExecuted !== false
  || route.summary?.hostMutation !== false
  || route.summary?.liveProviderCallEnabled !== false
  || route.summary?.launchExecuted !== false
  || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell"
) {
  throw new Error(`Phase 127 should route to result envelope creation execution task shell without reading credentials, creating envelopes, or egress: ${JSON.stringify(route)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionRoute: { status: "passed", sourceTaskId: route.summary.sourceTaskId, finalReadinessPreflightRegistry, executionRouteRegistry } }, null, 2));
EOF
