#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE63_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE63_PORT_BASE:-21200}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_63_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CLOUD_PROVIDER_ENDPOINT="${OPENCLAW_CLOUD_PROVIDER_ENDPOINT:-https://api.deepseek.com}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-63-egress-execution-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-63-egress-execution-task-shell-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-task-v0"
PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0"
CREDENTIAL_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0"
ENDPOINT_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0"
ROUTE_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0"
EGRESS_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-egress-execution-task-v0"
EGRESS_TASK_STATUS="egress_execution_task_shell_deferred_after_approval"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase63-prereq"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${PREFLIGHT_FILE:-}" "${BEFORE_FILE:-}" "${CREDENTIAL_GATE_FILE:-}" "${ENDPOINT_GATE_FILE:-}" "${ROUTE_PREFLIGHT_FILE:-}" "${ROUTE_TASK_FILE:-}" "${CAPABILITY_FILE:-}" "${EGRESS_APPROVED_FILE:-}" "${EGRESS_STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$EGRESS_TASK_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const egressTaskRegistry = process.argv[7];
const html = fs.readFileSync(process.argv[8], "utf8");
const client = fs.readFileSync(process.argv[9], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Egress Execution Task Shell",
  "cloud-consciousness-live-provider-egress-execution-task-shell-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-egress-execution-tasks",
  "refreshCloudConsciousnessLiveProviderEgressExecutionTaskShell",
  "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred",
  taskRegistry,
  preflightRegistry,
  credentialGateRegistry,
  endpointGateRegistry,
  routePreflightRegistry,
  egressTaskRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessEgressExecutionTaskShell: { status: "passed", taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry, egressTaskRegistry } }, null, 2));
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
ROUTE_TASK_FILE="$(mktemp)"
CAPABILITY_FILE="$(mktemp)"
EGRESS_APPROVED_FILE="$(mktemp)"
EGRESS_STEP_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-63-check","reason":"Approve real launch task shell before execution preflight and egress execution task shell."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-execution-preflight" '{"confirm":true}' > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-gate" '{"confirm":true}' > "$CREDENTIAL_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-endpoint-network-egress-gate" '{"confirm":true}' > "$ENDPOINT_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-egress-execution-route-task-preflight" '{"confirm":true}' > "$ROUTE_PREFLIGHT_FILE"
context_source_task_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.task?.id) throw new Error("missing context source task id"); console.log(data.task.id)' "$ROUTE_PREFLIGHT_FILE")"
egress_task_request="$(node -e 'const sourceTaskId=process.argv[1]; console.log(JSON.stringify({confirm:true,liveProviderExecution:{requested:true,credentialReference:"openclaw://credential/deepseek-api-key",requestEnvelope:{model:"deepseek-chat",messages:[{role:"user",content:"Phase 63 bounded provider binding fixture."}]},contextPacket:{requested:true,sourceTaskId},responseContract:null}}))' "$context_source_task_id")"
post_json "$CORE_URL/cloud-consciousness/live-provider-egress-execution-tasks" "$egress_task_request" > "$ROUTE_TASK_FILE"
capability_request="$(node -e 'const params=JSON.parse(process.argv[1]); console.log(JSON.stringify({capabilityId:"act.openclaw.engineering_context.provider_handoff_task",approved:true,params}))' "$egress_task_request")"
post_json "$CORE_URL/capabilities/invoke" "$capability_request" > "$CAPABILITY_FILE"
egress_approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.result?.approval?.id) throw new Error("missing egress approval id"); console.log(data.result.approval.id)' "$CAPABILITY_FILE")"
post_json "$CORE_URL/approvals/$egress_approval_id/approve" '{"approvedBy":"phase-63-check","reason":"Approve egress execution task shell while keeping endpoint contact and network egress deferred."}' > "$EGRESS_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EGRESS_STEP_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$EGRESS_TASK_REGISTRY" "$context_source_task_id" "$EGRESS_TASK_STATUS" "$PLAN_DOC" "$BEFORE_FILE" "$PREFLIGHT_FILE" "$CREDENTIAL_GATE_FILE" "$ENDPOINT_GATE_FILE" "$ROUTE_PREFLIGHT_FILE" "$ROUTE_TASK_FILE" "$CAPABILITY_FILE" "$EGRESS_STEP_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const egressTaskRegistry = process.argv[7];
const contextSourceTaskId = process.argv[8];
const egressTaskStatus = process.argv[9];
const doc = fs.readFileSync(process.argv[10], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[11], "utf8"));
const preflightRecord = JSON.parse(fs.readFileSync(process.argv[12], "utf8"));
const credentialGateRecord = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));
const endpointGateRecord = JSON.parse(fs.readFileSync(process.argv[14], "utf8"));
const routePreflightRecord = JSON.parse(fs.readFileSync(process.argv[15], "utf8"));
const routeTaskRecord = JSON.parse(fs.readFileSync(process.argv[16], "utf8"));
const egressCapabilityRecord = JSON.parse(fs.readFileSync(process.argv[17], "utf8"));
const egressTaskRecord = egressCapabilityRecord.result;
const egressStepRecord = JSON.parse(fs.readFileSync(process.argv[18], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell",
  "Requires Phase 62 egress execution route/task preflight evidence",
  "egressExecutionTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 63 plan doc missing ${token}`);
}
if (before.summary?.endpointNetworkEgressGateFound !== false || before.summary?.ready !== false) {
  throw new Error(`Phase 63 task shell readiness should wait for Phase 62 prerequisite chain: ${JSON.stringify(before)}`);
}
if (!preflightRecord.ok || preflightRecord.registry !== preflightRegistry || preflightRecord.status !== "real_launch_execution_preflight_recorded") {
  throw new Error(`Phase 63 prerequisite should record Phase 59 preflight: ${JSON.stringify(preflightRecord)}`);
}
if (!credentialGateRecord.ok || credentialGateRecord.registry !== credentialGateRegistry || credentialGateRecord.status !== "credential_value_access_gate_recorded_denied") {
  throw new Error(`Phase 63 prerequisite should record Phase 60 credential gate: ${JSON.stringify(credentialGateRecord)}`);
}
if (!endpointGateRecord.ok || endpointGateRecord.registry !== endpointGateRegistry || endpointGateRecord.status !== "endpoint_network_egress_gate_recorded_denied") {
  throw new Error(`Phase 63 prerequisite should record Phase 61 endpoint network egress gate: ${JSON.stringify(endpointGateRecord)}`);
}
if (!routePreflightRecord.ok || routePreflightRecord.registry !== routePreflightRegistry || routePreflightRecord.status !== "egress_execution_route_task_preflight_recorded_deferred") {
  throw new Error(`Phase 63 prerequisite should record Phase 62 egress route/task preflight: ${JSON.stringify(routePreflightRecord)}`);
}
if (
  !routeTaskRecord.ok
  || routeTaskRecord.registry !== egressTaskRegistry
  || routeTaskRecord.approval?.status !== "pending"
  || routeTaskRecord.task?.cloudConsciousnessLiveProviderEgressExecution?.requestBinding?.sourceTaskId !== contextSourceTaskId
  || routeTaskRecord.task?.cloudConsciousnessLiveProviderEgressExecution?.egressExecutionTaskCreated !== true
) {
  throw new Error(`Phase 63 dedicated egress task route should retain its pending request-bound shell contract: ${JSON.stringify(routeTaskRecord)}`);
}
if (
  !egressCapabilityRecord.ok
  || egressCapabilityRecord.invoked !== true
  || egressCapabilityRecord.capability?.id !== "act.openclaw.engineering_context.provider_handoff_task"
  || egressCapabilityRecord.policy?.decision !== "audit_only"
  || egressCapabilityRecord.summary?.kind !== "engineering.provider_handoff_task"
  || egressCapabilityRecord.summary?.requestBound !== true
  || egressCapabilityRecord.summary?.noProviderCall !== true
  || JSON.stringify(egressCapabilityRecord).includes("Phase 63 bounded provider binding fixture.")
) {
  throw new Error(`Phase 63 should create the egress shell through the approved common provider handoff capability without exposing prompt content: ${JSON.stringify(egressCapabilityRecord)}`);
}
const taskShell = egressTaskRecord.task?.cloudConsciousnessLiveProviderEgressExecution;
const completedShell = egressStepRecord.task?.cloudConsciousnessLiveProviderEgressExecution;
if (
  !egressTaskRecord.ok
  || egressTaskRecord.registry !== egressTaskRegistry
  || egressTaskRecord.approval?.status !== "pending"
  || taskShell?.registry !== egressTaskRegistry
  || taskShell?.sourceRegistry !== routePreflightRegistry
  || taskShell?.implementationStatus !== "task_shell_only"
  || taskShell?.requestBinding?.sourceTaskId !== contextSourceTaskId
  || taskShell?.egressExecutionTaskCreated !== true
  || taskShell?.egressExecutionTaskApproved !== false
  || !egressStepRecord.ok
  || egressStepRecord.task?.status !== "completed"
  || egressStepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_egress_execution_task_shell_deferred"
  || completedShell?.registry !== egressTaskRegistry
  || completedShell?.implementationStatus !== "deferred_after_approval"
  || completedShell?.egressExecutionTaskCreated !== true
  || completedShell?.egressExecutionTaskApproved !== true
  || completedShell?.egressExecutionDeferred !== true
) {
  throw new Error(`Phase 63 should create and approve deferred egress execution task shell evidence: ${JSON.stringify({ egressTaskRecord, egressStepRecord })}`);
}
if (
  completedShell.credentialValueAccessAuthorized !== false
  || completedShell.credentialValueAccessDenied !== true
  || completedShell.endpointNetworkEgressAuthorized !== false
  || completedShell.endpointNetworkEgressDenied !== true
  || completedShell.launchAuthorized !== false
  || completedShell.launchExecuted !== false
  || completedShell.credentialValueIncluded !== false
  || completedShell.credentialValueRead !== false
  || completedShell.credentialValueExposed !== false
  || completedShell.providerCredentialRead !== false
  || completedShell.endpointContacted !== false
  || completedShell.networkEgress !== false
  || completedShell.providerResponseCreated !== false
  || completedShell.rollbackExecuted !== false
  || completedShell.hostMutation !== false
  || completedShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 63 egress execution task shell must not perform credential or egress activity: ${JSON.stringify(egressStepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessEgressExecutionTaskShell: { status: "passed", taskId: egressTaskRecord.task.id, taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry, egressTaskRegistry } }, null, 2));
EOF
