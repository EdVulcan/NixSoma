#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-prereq.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE75_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE75_PORT_BASE:-22400}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_75_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-75-credential-value-access-authorization-decision-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-75-credential-value-access-authorization-decision-route-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0"
ACCESS_AUTHORIZATION_DECISION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route-v0"

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
  node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$ACCESS_AUTHORIZATION_DECISION_ROUTE_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const accessAuthorizationDecisionRouteRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Authorization Decision Route",
  "cloud-consciousness-live-provider-credential-value-access-authorization-decision-route-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-authorization-decision-route",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionRoute",
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell",
  finalReadinessPreflightRegistry,
  accessAuthorizationDecisionRouteRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessAuthorizationDecisionRoute: { status: "passed", finalReadinessPreflightRegistry, accessAuthorizationDecisionRouteRegistry } }, null, 2));
EOF
  exit 0
fi

openclaw_credential_value_local_read_prepare_prereq_state 75

"$SCRIPT_DIR/dev-up.sh"
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorization-decision-route" > "$ROUTE_FILE"

node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$ACCESS_AUTHORIZATION_DECISION_ROUTE_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const accessAuthorizationDecisionRouteRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route",
  "Requires Phase 74 final credential value readiness preflight evidence",
  "credentialValueAccessAuthorizationDecisionTaskCreated: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 75 plan doc missing ${token}`);
}
if (
  !route.ok
  || route.registry !== accessAuthorizationDecisionRouteRegistry
  || route.status !== "credential_value_access_authorization_decision_route_ready"
  || route.summary?.ready !== true
  || route.summary?.sourceRegistry !== finalReadinessPreflightRegistry
  || route.summary?.credentialValueFinalReadinessPreflightRecorded !== true
  || route.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell"
  || route.summary?.credentialValueAccessAuthorizationDecisionTaskCreated !== false
  || route.summary?.credentialValueAccessAuthorized !== false
  || route.summary?.credentialValueAccessDenied !== true
  || route.summary?.credentialValueIncluded !== false
  || route.summary?.credentialValueRead !== false
  || route.summary?.credentialValueExposed !== false
  || route.summary?.providerCredentialRead !== false
  || route.summary?.endpointContacted !== false
  || route.summary?.networkEgress !== false
  || route.summary?.liveProviderCallEnabled !== false
  || route.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell"
) {
  throw new Error(`Phase 75 should route to credential value access authorization decision task shell without reads or egress: ${JSON.stringify(route)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessAuthorizationDecisionRoute: { status: "passed", sourceTaskId: route.summary.sourceTaskId, finalReadinessPreflightRegistry, accessAuthorizationDecisionRouteRegistry } }, null, 2));
EOF
