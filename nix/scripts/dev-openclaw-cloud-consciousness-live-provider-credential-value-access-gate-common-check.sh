#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE60_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE60_PORT_BASE:-20900}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_60_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-60-credential-value-access-gate-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-60-credential-value-access-gate-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-task-v0"
PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0"
GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0"
GATE_STATUS="credential_value_access_gate_recorded_denied"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase60-prereq"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${PREFLIGHT_FILE:-}" "${BEFORE_FILE:-}" "${GATE_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$GATE_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const gateRegistry = process.argv[4];
const html = fs.readFileSync(process.argv[5], "utf8");
const client = fs.readFileSync(process.argv[6], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Gate",
  "cloud-consciousness-live-provider-credential-value-access-gate-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-gate",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessGate",
  "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate",
  taskRegistry,
  preflightRegistry,
  gateRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessGate: { status: "passed", taskRegistry, preflightRegistry, gateRegistry } }, null, 2));
EOF
  exit 0
fi

BEFORE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-gate" > "$BEFORE_FILE"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
PREFLIGHT_FILE="$(mktemp)"
GATE_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-60-check","reason":"Approve real launch task shell before execution preflight and credential value access gate."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-execution-preflight" '{"confirm":true}' > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-gate" '{"confirm":true}' > "$GATE_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$GATE_REGISTRY" "$GATE_STATUS" "$PLAN_DOC" "$BEFORE_FILE" "$PREFLIGHT_FILE" "$GATE_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const gateRegistry = process.argv[4];
const gateStatus = process.argv[5];
const doc = fs.readFileSync(process.argv[6], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const preflightRecord = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const gateRecord = JSON.parse(fs.readFileSync(process.argv[9], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-gate",
  "Requires Phase 59 execution preflight evidence",
  "credentialValueAccessGateRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 60 plan doc missing ${token}`);
}
if (before.summary?.executionPreflightFound !== false || before.summary?.ready !== false) {
  throw new Error(`Phase 60 gate should wait for Phase 59 evidence before preflight: ${JSON.stringify(before)}`);
}
if (!preflightRecord.ok || preflightRecord.registry !== preflightRegistry || preflightRecord.status !== "real_launch_execution_preflight_recorded") {
  throw new Error(`Phase 60 prerequisite should record Phase 59 preflight: ${JSON.stringify(preflightRecord)}`);
}
const shell = gateRecord.task?.cloudConsciousnessLiveProviderRealLaunch;
const gate = gateRecord.gate;
if (
  !gateRecord.ok
  || gateRecord.registry !== gateRegistry
  || gateRecord.status !== gateStatus
  || gate?.registry !== gateRegistry
  || gate?.summary?.ready !== true
  || gate?.summary?.executionPreflightFound !== true
  || shell?.registry !== taskRegistry
  || shell?.implementationStatus !== "credential_value_access_gate_recorded"
  || shell?.executionPreflightRecorded !== true
  || shell?.executionPreflightRegistry !== preflightRegistry
  || shell?.credentialValueAccessGateRecorded !== true
  || shell?.credentialValueAccessGateRegistry !== gateRegistry
) {
  throw new Error(`Phase 60 should record credential value access gate evidence: ${JSON.stringify(gateRecord)}`);
}
if (
  shell.credentialValueAccessAuthorized !== false
  || shell.credentialValueAccessDenied !== true
  || shell.launchAuthorized !== false
  || shell.launchExecuted !== false
  || shell.credentialValueIncluded !== false
  || shell.credentialValueRead !== false
  || shell.credentialValueExposed !== false
  || shell.providerCredentialRead !== false
  || shell.endpointContacted !== false
  || shell.networkEgress !== false
  || shell.providerResponseCreated !== false
  || shell.rollbackExecuted !== false
  || shell.hostMutation !== false
  || shell.liveProviderCallEnabled !== false
  || gate.summary.credentialValueRead !== false
  || gate.summary.endpointContacted !== false
  || gate.summary.networkEgress !== false
  || gate.summary.providerResponseCreated !== false
  || gate.summary.rollbackExecuted !== false
  || gate.summary.hostMutation !== false
  || gate.summary.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 60 credential value access gate must not perform credential or egress activity: ${JSON.stringify(gateRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessGate: { status: "passed", taskId: gateRecord.task.id, taskRegistry, preflightRegistry, gateRegistry } }, null, 2));
EOF
