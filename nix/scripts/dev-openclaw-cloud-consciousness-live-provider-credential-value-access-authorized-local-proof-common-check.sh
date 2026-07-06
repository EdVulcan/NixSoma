#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE78_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE78_PORT_BASE:-22700}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_78_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-78-credential-value-access-authorized-local-proof-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-78-credential-value-access-authorized-local-proof-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LOCAL_PROOF_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${PROOF_FILE:-}" "${RECORDED_FILE:-}"
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
  node - <<'EOF' "$LOCAL_PROOF_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const localProofRegistry = process.argv[2];
const html = fs.readFileSync(process.argv[3], "utf8");
const client = fs.readFileSync(process.argv[4], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Authorized Local Proof",
  "cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-authorized-local-proof",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route",
  localProofRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessAuthorizedLocalProof: { status: "passed", localProofRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
PHASE77_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-common-check.sh" >/dev/null

"$SCRIPT_DIR/dev-up.sh"
PROOF_FILE="$(mktemp)"
RECORDED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorized-local-proof" > "$PROOF_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorized-local-proof" '{"confirm":true}' > "$RECORDED_FILE"

node - <<'EOF' "$LOCAL_PROOF_REGISTRY" "$PLAN_DOC" "$PROOF_FILE" "$RECORDED_FILE"
const fs = require("node:fs");
const localProofRegistry = process.argv[2];
const doc = fs.readFileSync(process.argv[3], "utf8");
const proof = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const recorded = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof",
  "Requires Phase 77 approved-deferred credential value access authorization decision evidence",
  "credentialValueAccessAuthorizedLocalProofRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 78 plan doc missing ${token}`);
}
if (
  !proof.ok
  || proof.registry !== localProofRegistry
  || proof.status !== "credential_value_access_authorized_local_proof_ready_deferred"
  || proof.summary?.ready !== true
  || proof.summary?.credentialValueAccessAuthorizedLocalProofRecorded !== false
  || proof.summary?.credentialValueAccessAuthorizationDecisionApprovedDeferredFound !== true
) {
  throw new Error(`Phase 78 proof should be ready before recording: ${JSON.stringify(proof)}`);
}
if (
  !recorded.ok
  || recorded.registry !== localProofRegistry
  || recorded.status !== "credential_value_access_authorized_local_proof_recorded_deferred"
  || recorded.proof?.summary?.ready !== true
  || recorded.proof?.summary?.credentialValueAccessAuthorizedLocalProofRecorded !== true
  || recorded.proof?.summary?.credentialValueAccessAuthorized !== false
  || recorded.proof?.summary?.credentialValueAccessDenied !== true
  || recorded.proof?.summary?.credentialValueRead !== false
  || recorded.proof?.summary?.providerCredentialRead !== false
  || recorded.proof?.summary?.endpointContacted !== false
  || recorded.proof?.summary?.networkEgress !== false
  || recorded.proof?.summary?.liveProviderCallEnabled !== false
  || recorded.proof?.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route"
) {
  throw new Error(`Phase 78 should record local proof without credential reads or egress: ${JSON.stringify(recorded)}`);
}
const shell = recorded.task?.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision;
if (
  shell?.implementationStatus !== "credential_value_access_authorized_local_proof_recorded"
  || shell?.credentialValueAccessAuthorizedLocalProofRecorded !== true
  || shell?.credentialValueAccessAuthorized !== false
  || shell?.credentialValueRead !== false
  || shell?.providerCredentialRead !== false
) {
  throw new Error(`Phase 78 task shell should hold local proof evidence without reads: ${JSON.stringify(recorded.task)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessAuthorizedLocalProof: { status: "passed", sourceTaskId: recorded.proof.summary.sourceTaskId, localProofRegistry } }, null, 2));
EOF
