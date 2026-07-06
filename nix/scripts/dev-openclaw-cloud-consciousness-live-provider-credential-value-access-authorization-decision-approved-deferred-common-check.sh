#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE77_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE77_PORT_BASE:-22600}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_77_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-77-credential-value-access-authorization-decision-approved-deferred-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-77-credential-value-access-authorization-decision-approved-deferred-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-v0"
ACCESS_AUTHORIZATION_DECISION_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-v0"

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
  node - <<'EOF' "$ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY" "$ACCESS_AUTHORIZATION_DECISION_APPROVED_DEFERRED_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const accessAuthorizationDecisionTaskRegistry = process.argv[2];
const accessAuthorizationDecisionApprovedDeferredRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Authorization Decision Approved Deferred",
  "cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-authorization-decision-approved-deferred",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferred",
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof",
  accessAuthorizationDecisionTaskRegistry,
  accessAuthorizationDecisionApprovedDeferredRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessAuthorizationDecisionApprovedDeferred: { status: "passed", accessAuthorizationDecisionTaskRegistry, accessAuthorizationDecisionApprovedDeferredRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
PHASE76_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell-common-check.sh" >/dev/null

"$SCRIPT_DIR/dev-up.sh"
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorization-decision-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$ACCESS_AUTHORIZATION_DECISION_TASK_REGISTRY" "$ACCESS_AUTHORIZATION_DECISION_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const accessAuthorizationDecisionTaskRegistry = process.argv[2];
const accessAuthorizationDecisionApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred",
  "Requires Phase 76 approved credential value access authorization decision task shell evidence",
  "credentialValueAccessAuthorizationDecisionDeferred: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 77 plan doc missing ${token}`);
}
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== accessAuthorizationDecisionApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_access_authorization_decision_approved_deferred_ready"
  || approvedDeferred.summary?.ready !== true
  || approvedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || approvedDeferred.summary?.sourceRegistry !== accessAuthorizationDecisionTaskRegistry
  || approvedDeferred.summary?.credentialValueAccessAuthorizationDecisionTaskCreated !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorizationDecisionTaskApproved !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorizationDecisionDeferred !== true
  || approvedDeferred.summary?.credentialValueAccessAuthorized !== false
  || approvedDeferred.summary?.credentialValueAccessDenied !== true
  || approvedDeferred.summary?.credentialValueIncluded !== false
  || approvedDeferred.summary?.credentialValueRead !== false
  || approvedDeferred.summary?.credentialValueExposed !== false
  || approvedDeferred.summary?.providerCredentialRead !== false
  || approvedDeferred.summary?.endpointContacted !== false
  || approvedDeferred.summary?.networkEgress !== false
  || approvedDeferred.summary?.liveProviderCallEnabled !== false
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof"
) {
  throw new Error(`Phase 77 should expose approved deferred decision evidence without credential reads or egress: ${JSON.stringify(approvedDeferred)}`);
}
const sourceTask = approvedDeferred.evidence?.approvedDeferredTask;
if (
  !sourceTask
  || sourceTask.status !== "completed"
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision?.registry !== accessAuthorizationDecisionTaskRegistry
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision?.implementationStatus !== "deferred_after_approval"
  || sourceTask.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_access_authorization_decision_task_shell_deferred"
) {
  throw new Error(`Phase 77 approved deferred evidence should include the completed Phase 76 task shell: ${JSON.stringify(sourceTask)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessAuthorizationDecisionApprovedDeferred: { status: "passed", sourceTaskId: approvedDeferred.summary.sourceTaskId, accessAuthorizationDecisionTaskRegistry, accessAuthorizationDecisionApprovedDeferredRegistry } }, null, 2));
EOF
