#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE74_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE74_PORT_BASE:-22300}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_74_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-74-credential-value-final-readiness-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-74-credential-value-final-readiness-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${PREFLIGHT_FILE:-}" "${RECORDED_FILE:-}"
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
  node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const html = fs.readFileSync(process.argv[3], "utf8");
const client = fs.readFileSync(process.argv[4], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Final Readiness Preflight",
  "cloud-consciousness-live-provider-credential-value-final-readiness-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-final-readiness-preflight",
  "refreshCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight",
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route",
  finalReadinessPreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueFinalReadinessPreflight: { status: "passed", finalReadinessPreflightRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
PHASE73_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-common-check.sh" >/dev/null

"$SCRIPT_DIR/dev-up.sh"
PREFLIGHT_FILE="$(mktemp)"
RECORDED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-final-readiness-preflight" > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-final-readiness-preflight" '{"confirm":true}' > "$RECORDED_FILE"

node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$PREFLIGHT_FILE" "$RECORDED_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const doc = fs.readFileSync(process.argv[3], "utf8");
const preflight = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const recorded = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight",
  "Requires Phase 73 approved-deferred credential value access authorization evidence",
  "credentialValueFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 74 plan doc missing ${token}`);
}
if (
  !preflight.ok
  || preflight.registry !== finalReadinessPreflightRegistry
  || preflight.status !== "credential_value_final_readiness_preflight_ready_deferred"
  || preflight.summary?.ready !== true
  || preflight.summary?.credentialValueFinalReadinessPreflightRecorded !== false
  || preflight.summary?.credentialValueAccessAuthorizationApprovedDeferredFound !== true
) {
  throw new Error(`Phase 74 preflight should be ready before recording: ${JSON.stringify(preflight)}`);
}
if (
  !recorded.ok
  || recorded.registry !== finalReadinessPreflightRegistry
  || recorded.status !== "credential_value_final_readiness_preflight_recorded_deferred"
  || recorded.preflight?.summary?.ready !== true
  || recorded.preflight?.summary?.credentialValueFinalReadinessPreflightRecorded !== true
  || recorded.preflight?.summary?.credentialValueAccessAuthorized !== false
  || recorded.preflight?.summary?.credentialValueAccessDenied !== true
  || recorded.preflight?.summary?.credentialValueRead !== false
  || recorded.preflight?.summary?.providerCredentialRead !== false
  || recorded.preflight?.summary?.endpointContacted !== false
  || recorded.preflight?.summary?.networkEgress !== false
  || recorded.preflight?.summary?.liveProviderCallEnabled !== false
  || recorded.preflight?.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route"
) {
  throw new Error(`Phase 74 should record final readiness preflight without credential reads or egress: ${JSON.stringify(recorded)}`);
}
const shell = recorded.task?.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization;
if (
  shell?.implementationStatus !== "credential_value_final_readiness_preflight_recorded"
  || shell?.credentialValueFinalReadinessPreflightRecorded !== true
  || shell?.credentialValueAccessAuthorized !== false
  || shell?.credentialValueRead !== false
  || shell?.providerCredentialRead !== false
) {
  throw new Error(`Phase 74 task shell should hold final readiness preflight evidence without reads: ${JSON.stringify(recorded.task)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueFinalReadinessPreflight: { status: "passed", sourceTaskId: recorded.preflight.summary.sourceTaskId, finalReadinessPreflightRegistry } }, null, 2));
EOF
