#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE62_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE62_PORT_BASE:-21100}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_62_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-62-egress-execution-route-task-preflight-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-62-egress-execution-route-task-preflight-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-task-v0"
PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0"
CREDENTIAL_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0"
ENDPOINT_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0"
ROUTE_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0"
ROUTE_PREFLIGHT_STATUS="egress_execution_route_task_preflight_recorded_deferred"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase62-prereq"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${PREFLIGHT_FILE:-}" "${BEFORE_FILE:-}" "${CREDENTIAL_GATE_FILE:-}" "${ENDPOINT_GATE_FILE:-}" "${ROUTE_PREFLIGHT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const html = fs.readFileSync(process.argv[7], "utf8");
const client = fs.readFileSync(process.argv[8], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Egress Execution Route Task Preflight",
  "cloud-consciousness-live-provider-egress-execution-route-task-preflight-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-egress-execution-route-task-preflight",
  "refreshCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight",
  "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell",
  taskRegistry,
  preflightRegistry,
  credentialGateRegistry,
  endpointGateRegistry,
  routePreflightRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessEgressExecutionRouteTaskPreflight: { status: "passed", taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry } }, null, 2));
EOF
  exit 0
fi

BEFORE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-egress-execution-route-task-preflight" > "$BEFORE_FILE"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
PREFLIGHT_FILE="$(mktemp)"
CREDENTIAL_GATE_FILE="$(mktemp)"
ENDPOINT_GATE_FILE="$(mktemp)"
ROUTE_PREFLIGHT_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-62-check","reason":"Approve real launch task shell before execution preflight and egress execution route task preflight."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-execution-preflight" '{"confirm":true}' > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-gate" '{"confirm":true}' > "$CREDENTIAL_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-endpoint-network-egress-gate" '{"confirm":true}' > "$ENDPOINT_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-egress-execution-route-task-preflight" '{"confirm":true}' > "$ROUTE_PREFLIGHT_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$ROUTE_PREFLIGHT_STATUS" "$PLAN_DOC" "$BEFORE_FILE" "$PREFLIGHT_FILE" "$CREDENTIAL_GATE_FILE" "$ENDPOINT_GATE_FILE" "$ROUTE_PREFLIGHT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const routePreflightStatus = process.argv[7];
const doc = fs.readFileSync(process.argv[8], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[9], "utf8"));
const preflightRecord = JSON.parse(fs.readFileSync(process.argv[10], "utf8"));
const credentialGateRecord = JSON.parse(fs.readFileSync(process.argv[11], "utf8"));
const endpointGateRecord = JSON.parse(fs.readFileSync(process.argv[12], "utf8"));
const routePreflightRecord = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight",
  "Requires Phase 61 endpoint/network egress gate evidence",
  "egressExecutionRouteTaskPreflightRecorded: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 62 plan doc missing ${token}`);
}
if (before.summary?.endpointNetworkEgressGateFound !== false || before.summary?.ready !== false) {
  throw new Error(`Phase 62 preflight should wait for Phase 61 evidence before endpoint gate: ${JSON.stringify(before)}`);
}
if (!preflightRecord.ok || preflightRecord.registry !== preflightRegistry || preflightRecord.status !== "real_launch_execution_preflight_recorded") {
  throw new Error(`Phase 62 prerequisite should record Phase 59 preflight: ${JSON.stringify(preflightRecord)}`);
}
if (!credentialGateRecord.ok || credentialGateRecord.registry !== credentialGateRegistry || credentialGateRecord.status !== "credential_value_access_gate_recorded_denied") {
  throw new Error(`Phase 62 prerequisite should record Phase 60 credential gate: ${JSON.stringify(credentialGateRecord)}`);
}
if (!endpointGateRecord.ok || endpointGateRecord.registry !== endpointGateRegistry || endpointGateRecord.status !== "endpoint_network_egress_gate_recorded_denied") {
  throw new Error(`Phase 62 prerequisite should record Phase 61 endpoint network egress gate: ${JSON.stringify(endpointGateRecord)}`);
}
const shell = routePreflightRecord.task?.cloudConsciousnessLiveProviderRealLaunch;
const preflight = routePreflightRecord.preflight;
if (
  !routePreflightRecord.ok
  || routePreflightRecord.registry !== routePreflightRegistry
  || routePreflightRecord.status !== routePreflightStatus
  || preflight?.registry !== routePreflightRegistry
  || preflight?.summary?.ready !== true
  || preflight?.summary?.endpointNetworkEgressGateFound !== true
  || shell?.registry !== taskRegistry
  || shell?.implementationStatus !== "egress_execution_route_task_preflight_recorded"
  || shell?.executionPreflightRecorded !== true
  || shell?.executionPreflightRegistry !== preflightRegistry
  || shell?.credentialValueAccessGateRecorded !== true
  || shell?.credentialValueAccessGateRegistry !== credentialGateRegistry
  || shell?.endpointNetworkEgressGateRecorded !== true
  || shell?.endpointNetworkEgressGateRegistry !== endpointGateRegistry
  || shell?.egressExecutionRouteTaskPreflightRecorded !== true
  || shell?.egressExecutionRouteTaskPreflightRegistry !== routePreflightRegistry
) {
  throw new Error(`Phase 62 should record egress execution route task preflight evidence: ${JSON.stringify(routePreflightRecord)}`);
}
if (
  shell.credentialValueAccessAuthorized !== false
  || shell.credentialValueAccessDenied !== true
  || shell.endpointNetworkEgressAuthorized !== false
  || shell.endpointNetworkEgressDenied !== true
  || shell.launchAuthorized !== false
  || shell.launchExecuted !== false
  || shell.credentialValueIncluded !== false
  || shell.credentialValueRead !== false
  || shell.credentialValueExposed !== false
  || shell.providerCredentialRead !== false
  || shell.endpointContacted !== false
  || shell.networkEgress !== false
  || shell.egressExecutionTaskCreated !== false
  || shell.egressExecutionTaskApproved !== false
  || shell.providerResponseCreated !== false
  || shell.rollbackExecuted !== false
  || shell.hostMutation !== false
  || shell.liveProviderCallEnabled !== false
  || preflight.summary.egressExecutionTaskCreated !== false
  || preflight.summary.egressExecutionTaskApproved !== false
  || preflight.summary.credentialValueRead !== false
  || preflight.summary.endpointContacted !== false
  || preflight.summary.networkEgress !== false
  || preflight.summary.providerResponseCreated !== false
  || preflight.summary.rollbackExecuted !== false
  || preflight.summary.hostMutation !== false
  || preflight.summary.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 62 egress execution route task preflight must not create tasks or perform credential or egress activity: ${JSON.stringify(routePreflightRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessEgressExecutionRouteTaskPreflight: { status: "passed", taskId: routePreflightRecord.task.id, taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry } }, null, 2));
EOF
