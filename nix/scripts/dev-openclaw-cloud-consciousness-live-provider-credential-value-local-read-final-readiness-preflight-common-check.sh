#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-prereq.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE82_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE82_PORT_BASE:-23100}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_82_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-82-credential-value-local-read-final-readiness-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-82-credential-value-local-read-final-readiness-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-v0"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


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
  "Cloud Consciousness Live Provider Credential Value Local Read Final Readiness Preflight",
  "cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route",
  finalReadinessPreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadFinalReadinessPreflight: { status: "passed", finalReadinessPreflightRegistry } }, null, 2));
EOF
  exit 0
fi

openclaw_credential_value_local_read_prepare_prereq_state 82

"$SCRIPT_DIR/dev-up.sh"
PREFLIGHT_FILE="$(mktemp)"
RECORDED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight" > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight" '{"confirm":true}' > "$RECORDED_FILE"

node - <<'EOF' "$FINAL_READINESS_PREFLIGHT_REGISTRY" "$PLAN_DOC" "$PREFLIGHT_FILE" "$RECORDED_FILE"
const fs = require("node:fs");
const finalReadinessPreflightRegistry = process.argv[2];
const doc = fs.readFileSync(process.argv[3], "utf8");
const preflight = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const recorded = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight",
  "Requires Phase 81 approved-deferred credential value local read evidence",
  "credentialValueLocalReadFinalReadinessPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 82 plan doc missing ${token}`);
}
if (
  !preflight.ok
  || preflight.registry !== finalReadinessPreflightRegistry
  || preflight.status !== "credential_value_local_read_final_readiness_preflight_ready_deferred"
  || preflight.summary?.ready !== true
  || preflight.summary?.credentialValueLocalReadFinalReadinessPreflightRecorded !== false
  || preflight.summary?.credentialValueLocalReadApprovedDeferredFound !== true
) {
  throw new Error(`Phase 82 preflight should be ready before recording: ${JSON.stringify(preflight)}`);
}
if (
  !recorded.ok
  || recorded.registry !== finalReadinessPreflightRegistry
  || recorded.status !== "credential_value_local_read_final_readiness_preflight_recorded_deferred"
  || recorded.preflight?.summary?.ready !== true
  || recorded.preflight?.summary?.credentialValueLocalReadFinalReadinessPreflightRecorded !== true
  || recorded.preflight?.summary?.credentialValueIncluded !== false
  || recorded.preflight?.summary?.credentialValueRead !== false
  || recorded.preflight?.summary?.credentialValueExposed !== false
  || recorded.preflight?.summary?.providerCredentialRead !== false
  || recorded.preflight?.summary?.endpointContacted !== false
  || recorded.preflight?.summary?.networkEgress !== false
  || recorded.preflight?.summary?.liveProviderCallEnabled !== false
  || recorded.preflight?.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route"
) {
  throw new Error(`Phase 82 should record local read final readiness preflight without credential reads or egress: ${JSON.stringify(recorded)}`);
}
const shell = recorded.task?.cloudConsciousnessLiveProviderCredentialValueLocalRead;
if (
  shell?.implementationStatus !== "credential_value_local_read_final_readiness_preflight_recorded"
  || shell?.credentialValueLocalReadFinalReadinessPreflightRecorded !== true
  || shell?.credentialValueIncluded !== false
  || shell?.credentialValueRead !== false
  || shell?.credentialValueExposed !== false
  || shell?.providerCredentialRead !== false
) {
  throw new Error(`Phase 82 task shell should hold final readiness preflight evidence without reads: ${JSON.stringify(recorded.task)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadFinalReadinessPreflight: { status: "passed", sourceTaskId: recorded.preflight.summary.sourceTaskId, finalReadinessPreflightRegistry } }, null, 2));
EOF
