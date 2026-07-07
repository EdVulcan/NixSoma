#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE115_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE115_PORT_BASE:-26400}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_115_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-115-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-115-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0"
LOCAL_READ_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0"
PHASE114_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-114-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-check.json"
PHASE114_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-114-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-check.json"

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
  node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$LOCAL_READ_ROUTE_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const localReadRouteRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Local Read Route",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell",
  finalReadinessPreflightRegistry,
  localReadRouteRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute: { status: "passed", finalReadinessPreflightRegistry, localReadRouteRegistry } }, null, 2));
EOF
  exit 0
fi

if ! declare -F openclaw_dev_services_already_up >/dev/null || ! openclaw_dev_services_already_up; then
  rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
  if [[ -f "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh" ]]; then
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh"
  fi

  if ! declare -F openclaw_reuse_prereq_state >/dev/null \
    || ! openclaw_reuse_prereq_state \
      "$PHASE114_CORE_STATE" \
      "$PHASE114_SYSTEM_HEAL_STATE" \
      "$OPENCLAW_CORE_STATE_FILE" \
      "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
      "phase-114-result-envelope-creation-execution-attempt-final-readiness-preflight" \
      "$FINAL_READINESS_PREFLIGHT_REGISTRY" \
      "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_final_readiness_preflight_recorded"; then
    PHASE114_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
      bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-common-check.sh" >/dev/null
  fi
else
  echo "Using already-running OpenClaw dev services as the live Phase 114 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route" > "$ROUTE_FILE"

node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$LOCAL_READ_ROUTE_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const localReadRouteRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route",
  "Requires Phase 114 credential value local read execution local-read attempt local-read result envelope creation execution attempt final readiness preflight evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 115 plan doc missing ${token}`);
}
if (
  !route.ok
  || route.registry !== localReadRouteRegistry
  || route.status !== "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_route_ready"
  || route.summary?.ready !== true
  || route.summary?.sourceRegistry !== finalReadinessPreflightRegistry
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded !== true
  || route.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell"
  || route.summary?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated !== false
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
  || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell"
) {
  throw new Error(`Phase 115 should route to credential value result envelope creation execution attempt local-read task shell without reading credentials, creating envelopes, or egress: ${JSON.stringify(route)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute: { status: "passed", sourceTaskId: route.summary.sourceTaskId, finalReadinessPreflightRegistry, localReadRouteRegistry } }, null, 2));
EOF
