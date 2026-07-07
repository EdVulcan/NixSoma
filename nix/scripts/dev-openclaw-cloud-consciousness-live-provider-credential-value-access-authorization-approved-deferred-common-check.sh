#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-prereq.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE73_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE73_PORT_BASE:-22200}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_73_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-73-credential-value-access-authorization-approved-deferred-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-73-credential-value-access-authorization-approved-deferred-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-v0"
CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-v0"

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
  node - <<'EOF' "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const credentialAccessAuthorizationTaskRegistry = process.argv[2];
const credentialAccessAuthorizationApprovedDeferredRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Authorization Approved Deferred",
  "cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-authorization-approved-deferred",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred",
  "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight",
  credentialAccessAuthorizationTaskRegistry,
  credentialAccessAuthorizationApprovedDeferredRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessAuthorizationApprovedDeferred: { status: "passed", credentialAccessAuthorizationTaskRegistry, credentialAccessAuthorizationApprovedDeferredRegistry } }, null, 2));
EOF
  exit 0
fi

openclaw_credential_value_local_read_prepare_prereq_state 73

"$SCRIPT_DIR/dev-up.sh"
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorization-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const credentialAccessAuthorizationTaskRegistry = process.argv[2];
const credentialAccessAuthorizationApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred",
  "Requires Phase 72 approved credential value access authorization task shell evidence",
  "credentialValueAccessAuthorizationDeferred: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 73 plan doc missing ${token}`);
}
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== credentialAccessAuthorizationApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_access_authorization_approved_deferred_ready"
  || approvedDeferred.summary?.ready !== true
  || approvedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || approvedDeferred.summary?.sourceRegistry !== credentialAccessAuthorizationTaskRegistry
  || approvedDeferred.summary?.credentialValueAccessAuthorizationTaskCreated !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorizationTaskApproved !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorizationDeferred !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorized !== false
  || approvedDeferred.summary?.credentialValueAccessDenied !== true
  || approvedDeferred.summary?.credentialValueIncluded !== false
  || approvedDeferred.summary?.credentialValueRead !== false
  || approvedDeferred.summary?.credentialValueExposed !== false
  || approvedDeferred.summary?.providerCredentialRead !== false
  || approvedDeferred.summary?.endpointContacted !== false
  || approvedDeferred.summary?.networkEgress !== false
  || approvedDeferred.summary?.liveProviderCallEnabled !== false
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight"
) {
  throw new Error(`Phase 73 should expose approved deferred access authorization evidence without credential reads or egress: ${JSON.stringify(approvedDeferred)}`);
}
const sourceTask = approvedDeferred.evidence?.approvedDeferredTask;
if (
  !sourceTask
  || sourceTask.status !== "completed"
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization?.registry !== credentialAccessAuthorizationTaskRegistry
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization?.implementationStatus !== "deferred_after_approval"
  || sourceTask.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_access_authorization_task_shell_deferred"
) {
  throw new Error(`Phase 73 approved deferred evidence should include the completed Phase 72 task shell: ${JSON.stringify(sourceTask)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessAuthorizationApprovedDeferred: { status: "passed", sourceTaskId: approvedDeferred.summary.sourceTaskId, credentialAccessAuthorizationTaskRegistry, credentialAccessAuthorizationApprovedDeferredRegistry } }, null, 2));
EOF
