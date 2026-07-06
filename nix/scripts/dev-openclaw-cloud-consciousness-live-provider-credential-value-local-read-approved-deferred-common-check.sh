#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE81_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE81_PORT_BASE:-23000}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_81_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-81-credential-value-local-read-approved-deferred-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-81-credential-value-local-read-approved-deferred-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LOCAL_READ_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0"
LOCAL_READ_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-v0"

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
  node - <<'EOF' "$LOCAL_READ_TASK_REGISTRY" "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const localReadTaskRegistry = process.argv[2];
const localReadApprovedDeferredRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Approved Deferred",
  "cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-approved-deferred",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadApprovedDeferred",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight",
  localReadTaskRegistry,
  localReadApprovedDeferredRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadApprovedDeferred: { status: "passed", localReadTaskRegistry, localReadApprovedDeferredRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
PHASE80_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell-common-check.sh" >/dev/null

"$SCRIPT_DIR/dev-up.sh"
APPROVED_DEFERRED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-approved-deferred" > "$APPROVED_DEFERRED_FILE"

node - <<'EOF' "$LOCAL_READ_TASK_REGISTRY" "$LOCAL_READ_APPROVED_DEFERRED_REGISTRY" "$PLAN_DOC" "$APPROVED_DEFERRED_FILE"
const fs = require("node:fs");
const localReadTaskRegistry = process.argv[2];
const localReadApprovedDeferredRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred",
  "Requires Phase 80 approved credential value local read task shell evidence",
  "credentialValueLocalReadDeferred: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 81 plan doc missing ${token}`);
}
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== localReadApprovedDeferredRegistry
  || approvedDeferred.status !== "credential_value_local_read_approved_deferred_ready"
  || approvedDeferred.summary?.ready !== true
  || approvedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || approvedDeferred.summary?.sourceRegistry !== localReadTaskRegistry
  || approvedDeferred.summary?.credentialValueLocalReadTaskCreated !== true
  || approvedDeferred.summary?.credentialValueLocalReadTaskApproved !== true
  || approvedDeferred.summary?.credentialValueLocalReadDeferred !== true
  || approvedDeferred.summary?.credentialValueIncluded !== false
  || approvedDeferred.summary?.credentialValueRead !== false
  || approvedDeferred.summary?.credentialValueExposed !== false
  || approvedDeferred.summary?.providerCredentialRead !== false
  || approvedDeferred.summary?.endpointContacted !== false
  || approvedDeferred.summary?.networkEgress !== false
  || approvedDeferred.summary?.liveProviderCallEnabled !== false
  || approvedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight"
) {
  throw new Error(`Phase 81 should expose approved deferred local read evidence without credential reads or egress: ${JSON.stringify(approvedDeferred)}`);
}
const sourceTask = approvedDeferred.evidence?.approvedDeferredTask;
if (
  !sourceTask
  || sourceTask.status !== "completed"
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueLocalRead?.registry !== localReadTaskRegistry
  || sourceTask.cloudConsciousnessLiveProviderCredentialValueLocalRead?.implementationStatus !== "deferred_after_approval"
  || sourceTask.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_local_read_task_shell_deferred"
) {
  throw new Error(`Phase 81 approved deferred evidence should include the completed Phase 80 task shell: ${JSON.stringify(sourceTask)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadApprovedDeferred: { status: "passed", sourceTaskId: approvedDeferred.summary.sourceTaskId, localReadTaskRegistry, localReadApprovedDeferredRegistry } }, null, 2));
EOF
