#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE72_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE72_PORT_BASE:-22100}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_72_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-72-credential-value-access-authorization-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-72-credential-value-access-authorization-task-shell-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-task-v0"
PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0"
CREDENTIAL_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0"
ENDPOINT_GATE_REGISTRY="openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0"
ROUTE_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0"
EGRESS_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-egress-execution-task-v0"
CREDENTIAL_AUTH_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-authorization-route-v0"
CREDENTIAL_AUTH_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-v0"
CREDENTIAL_AUTH_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-authorization-approved-deferred-v0"
CREDENTIAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight-v0"
CREDENTIAL_READ_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-read-task-v0"
CREDENTIAL_READ_APPROVED_DEFERRED_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred-v0"
CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route-v0"
CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase72-prereq"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${PREFLIGHT_FILE:-}" "${BEFORE_FILE:-}" "${CREDENTIAL_GATE_FILE:-}" "${ENDPOINT_GATE_FILE:-}" "${ROUTE_PREFLIGHT_FILE:-}" "${EGRESS_TASK_FILE:-}" "${EGRESS_APPROVED_FILE:-}" "${EGRESS_STEP_FILE:-}" "${APPROVED_DEFERRED_FILE:-}" "${CREDENTIAL_AUTH_ROUTE_FILE:-}" "${CREDENTIAL_AUTH_TASK_FILE:-}" "${CREDENTIAL_AUTH_APPROVED_FILE:-}" "${CREDENTIAL_AUTH_STEP_FILE:-}" "${CREDENTIAL_AUTH_APPROVED_DEFERRED_FILE:-}" "${CREDENTIAL_READINESS_PREFLIGHT_FILE:-}" "${CREDENTIAL_READ_TASK_FILE:-}" "${CREDENTIAL_READ_APPROVED_FILE:-}" "${CREDENTIAL_READ_STEP_FILE:-}" "${CREDENTIAL_READ_APPROVED_DEFERRED_FILE:-}" "${CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_FILE:-}" "${CREDENTIAL_ACCESS_AUTHORIZATION_TASK_FILE:-}" "${CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_FILE:-}" "${CREDENTIAL_ACCESS_AUTHORIZATION_STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$EGRESS_TASK_REGISTRY" "$CREDENTIAL_AUTH_ROUTE_REGISTRY" "$CREDENTIAL_AUTH_TASK_REGISTRY" "$CREDENTIAL_AUTH_APPROVED_DEFERRED_REGISTRY" "$CREDENTIAL_READINESS_PREFLIGHT_REGISTRY" "$CREDENTIAL_READ_TASK_REGISTRY" "$CREDENTIAL_READ_APPROVED_DEFERRED_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const egressTaskRegistry = process.argv[7];
const credentialAuthRouteRegistry = process.argv[8];
const credentialAuthTaskRegistry = process.argv[9];
const credentialAuthApprovedDeferredRegistry = process.argv[10];
const credentialReadinessPreflightRegistry = process.argv[11];
const credentialReadTaskRegistry = process.argv[12];
const credentialReadApprovedDeferredRegistry = process.argv[13];
const credentialAccessAuthorizationRouteRegistry = process.argv[14];
const credentialAccessAuthorizationTaskRegistry = process.argv[15];
const html = fs.readFileSync(process.argv[16], "utf8");
const client = fs.readFileSync(process.argv[17], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Access Authorization Task Shell",
  "cloud-consciousness-live-provider-credential-value-access-authorization-task-shell-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-access-authorization-route",
  "/cloud-consciousness/live-provider-credential-value-access-authorization-tasks",
  "refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTaskShell",
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell",
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred",
  taskRegistry,
  preflightRegistry,
  credentialGateRegistry,
  endpointGateRegistry,
  routePreflightRegistry,
  egressTaskRegistry,
  credentialAuthRouteRegistry,
  credentialAuthTaskRegistry,
  credentialAuthApprovedDeferredRegistry,
  credentialReadinessPreflightRegistry,
  credentialReadTaskRegistry,
  credentialReadApprovedDeferredRegistry,
  credentialAccessAuthorizationRouteRegistry,
  credentialAccessAuthorizationTaskRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueAccessAuthorizationTaskShell: { status: "passed", taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry, egressTaskRegistry, credentialAuthRouteRegistry, credentialAuthTaskRegistry, credentialAuthApprovedDeferredRegistry, credentialReadinessPreflightRegistry, credentialReadTaskRegistry, credentialReadApprovedDeferredRegistry, credentialAccessAuthorizationRouteRegistry, credentialAccessAuthorizationTaskRegistry } }, null, 2));
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
EGRESS_TASK_FILE="$(mktemp)"
EGRESS_APPROVED_FILE="$(mktemp)"
EGRESS_STEP_FILE="$(mktemp)"
APPROVED_DEFERRED_FILE="$(mktemp)"
CREDENTIAL_AUTH_ROUTE_FILE="$(mktemp)"
CREDENTIAL_AUTH_TASK_FILE="$(mktemp)"
CREDENTIAL_AUTH_APPROVED_FILE="$(mktemp)"
CREDENTIAL_AUTH_STEP_FILE="$(mktemp)"
CREDENTIAL_AUTH_APPROVED_DEFERRED_FILE="$(mktemp)"
CREDENTIAL_READINESS_PREFLIGHT_FILE="$(mktemp)"
CREDENTIAL_READ_TASK_FILE="$(mktemp)"
CREDENTIAL_READ_APPROVED_FILE="$(mktemp)"
CREDENTIAL_READ_STEP_FILE="$(mktemp)"
CREDENTIAL_READ_APPROVED_DEFERRED_FILE="$(mktemp)"
CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_FILE="$(mktemp)"
CREDENTIAL_ACCESS_AUTHORIZATION_TASK_FILE="$(mktemp)"
CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_FILE="$(mktemp)"
CREDENTIAL_ACCESS_AUTHORIZATION_STEP_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-72-check","reason":"Approve real launch task shell before execution preflight and credential value access authorization task shell."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-execution-preflight" '{"confirm":true}' > "$PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-gate" '{"confirm":true}' > "$CREDENTIAL_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-endpoint-network-egress-gate" '{"confirm":true}' > "$ENDPOINT_GATE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-egress-execution-route-task-preflight" '{"confirm":true}' > "$ROUTE_PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-egress-execution-tasks" '{"confirm":true}' > "$EGRESS_TASK_FILE"
egress_approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing egress approval id"); console.log(data.approval.id)' "$EGRESS_TASK_FILE")"
post_json "$CORE_URL/approvals/$egress_approval_id/approve" '{"approvedBy":"phase-72-check","reason":"Approve credential value access authorization task shell while keeping endpoint contact and network egress deferred."}' > "$EGRESS_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EGRESS_STEP_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-egress-execution-approved-deferred" > "$APPROVED_DEFERRED_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-authorization-route" > "$CREDENTIAL_AUTH_ROUTE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-authorization-tasks" '{"confirm":true}' > "$CREDENTIAL_AUTH_TASK_FILE"
credential_auth_approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing credential auth approval id"); console.log(data.approval.id)' "$CREDENTIAL_AUTH_TASK_FILE")"
post_json "$CORE_URL/approvals/$credential_auth_approval_id/approve" '{"approvedBy":"phase-72-check","reason":"Approve credential value access authorization task shell while keeping credential values unread."}' > "$CREDENTIAL_AUTH_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$CREDENTIAL_AUTH_STEP_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-authorization-approved-deferred" > "$CREDENTIAL_AUTH_APPROVED_DEFERRED_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-readiness-preflight" '{"confirm":true}' > "$CREDENTIAL_READINESS_PREFLIGHT_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-read-tasks" '{"confirm":true}' > "$CREDENTIAL_READ_TASK_FILE"
credential_read_approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing credential read approval id"); console.log(data.approval.id)' "$CREDENTIAL_READ_TASK_FILE")"
post_json "$CORE_URL/approvals/$credential_read_approval_id/approve" '{"approvedBy":"phase-72-check","reason":"Approve credential value access authorization task shell while keeping the credential value unread."}' > "$CREDENTIAL_READ_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$CREDENTIAL_READ_STEP_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-read-approved-deferred" > "$CREDENTIAL_READ_APPROVED_DEFERRED_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorization-route" > "$CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-access-authorization-tasks" '{"confirm":true}' > "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_FILE"
credential_access_authorization_approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing credential access authorization approval id"); console.log(data.approval.id)' "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_FILE")"
post_json "$CORE_URL/approvals/$credential_access_authorization_approval_id/approve" '{"approvedBy":"phase-72-check","reason":"Approve credential value access authorization task shell while keeping credential access unauthorized and credential values unread."}' > "$CREDENTIAL_ACCESS_AUTHORIZATION_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$CREDENTIAL_ACCESS_AUTHORIZATION_STEP_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$PREFLIGHT_REGISTRY" "$CREDENTIAL_GATE_REGISTRY" "$ENDPOINT_GATE_REGISTRY" "$ROUTE_PREFLIGHT_REGISTRY" "$EGRESS_TASK_REGISTRY" "$CREDENTIAL_AUTH_ROUTE_REGISTRY" "$CREDENTIAL_AUTH_TASK_REGISTRY" "$CREDENTIAL_AUTH_APPROVED_DEFERRED_REGISTRY" "$CREDENTIAL_READINESS_PREFLIGHT_REGISTRY" "$CREDENTIAL_READ_TASK_REGISTRY" "$CREDENTIAL_READ_APPROVED_DEFERRED_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_REGISTRY" "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_REGISTRY" "$PLAN_DOC" "$BEFORE_FILE" "$PREFLIGHT_FILE" "$CREDENTIAL_GATE_FILE" "$ENDPOINT_GATE_FILE" "$ROUTE_PREFLIGHT_FILE" "$EGRESS_TASK_FILE" "$EGRESS_STEP_FILE" "$APPROVED_DEFERRED_FILE" "$CREDENTIAL_AUTH_ROUTE_FILE" "$CREDENTIAL_AUTH_TASK_FILE" "$CREDENTIAL_AUTH_STEP_FILE" "$CREDENTIAL_AUTH_APPROVED_DEFERRED_FILE" "$CREDENTIAL_READINESS_PREFLIGHT_FILE" "$CREDENTIAL_READ_TASK_FILE" "$CREDENTIAL_READ_STEP_FILE" "$CREDENTIAL_READ_APPROVED_DEFERRED_FILE" "$CREDENTIAL_ACCESS_AUTHORIZATION_ROUTE_FILE" "$CREDENTIAL_ACCESS_AUTHORIZATION_TASK_FILE" "$CREDENTIAL_ACCESS_AUTHORIZATION_STEP_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const preflightRegistry = process.argv[3];
const credentialGateRegistry = process.argv[4];
const endpointGateRegistry = process.argv[5];
const routePreflightRegistry = process.argv[6];
const egressTaskRegistry = process.argv[7];
const credentialAuthRouteRegistry = process.argv[8];
const credentialAuthTaskRegistry = process.argv[9];
const credentialAuthApprovedDeferredRegistry = process.argv[10];
const credentialReadinessPreflightRegistry = process.argv[11];
const credentialReadTaskRegistry = process.argv[12];
const credentialReadApprovedDeferredRegistry = process.argv[13];
const credentialAccessAuthorizationRouteRegistry = process.argv[14];
const credentialAccessAuthorizationTaskRegistry = process.argv[15];
const doc = fs.readFileSync(process.argv[16], "utf8");
const before = JSON.parse(fs.readFileSync(process.argv[17], "utf8"));
const preflightRecord = JSON.parse(fs.readFileSync(process.argv[18], "utf8"));
const credentialGateRecord = JSON.parse(fs.readFileSync(process.argv[19], "utf8"));
const endpointGateRecord = JSON.parse(fs.readFileSync(process.argv[20], "utf8"));
const routePreflightRecord = JSON.parse(fs.readFileSync(process.argv[21], "utf8"));
const egressTaskRecord = JSON.parse(fs.readFileSync(process.argv[22], "utf8"));
const egressStepRecord = JSON.parse(fs.readFileSync(process.argv[23], "utf8"));
const approvedDeferred = JSON.parse(fs.readFileSync(process.argv[24], "utf8"));
const credentialAuthRoute = JSON.parse(fs.readFileSync(process.argv[25], "utf8"));
const credentialAuthTaskRecord = JSON.parse(fs.readFileSync(process.argv[26], "utf8"));
const credentialAuthStepRecord = JSON.parse(fs.readFileSync(process.argv[27], "utf8"));
const credentialAuthApprovedDeferred = JSON.parse(fs.readFileSync(process.argv[28], "utf8"));
const credentialReadinessPreflight = JSON.parse(fs.readFileSync(process.argv[29], "utf8"));
const credentialReadTask = JSON.parse(fs.readFileSync(process.argv[30], "utf8"));
const credentialReadStep = JSON.parse(fs.readFileSync(process.argv[31], "utf8"));
const credentialReadApprovedDeferred = JSON.parse(fs.readFileSync(process.argv[32], "utf8"));
const credentialAccessAuthorizationRoute = JSON.parse(fs.readFileSync(process.argv[33], "utf8"));
const credentialAccessAuthorizationTaskRecord = JSON.parse(fs.readFileSync(process.argv[34], "utf8"));
const credentialAccessAuthorizationStepRecord = JSON.parse(fs.readFileSync(process.argv[35], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell",
  "Requires Phase 71 credential value access authorization route evidence",
  "credentialValueAccessAuthorizationTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 72 plan doc missing ${token}`);
}
if (before.summary?.endpointNetworkEgressGateFound !== false || before.summary?.ready !== false) {
  throw new Error(`Phase 64 prerequisite chain should start without Phase 62 evidence: ${JSON.stringify(before)}`);
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
  throw new Error(`Phase 64 prerequisite should record Phase 62 egress route/task preflight: ${JSON.stringify(routePreflightRecord)}`);
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
  throw new Error(`Phase 64 prerequisite should create and approve deferred egress execution task shell evidence: ${JSON.stringify({ egressTaskRecord, egressStepRecord })}`);
}
if (
  !approvedDeferred.ok
  || approvedDeferred.registry !== "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-v0"
  || approvedDeferred.summary?.ready !== true
  || approvedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || approvedDeferred.summary?.sourceTaskId !== egressStepRecord.task?.id
) {
  throw new Error(`Phase 66 prerequisite should expose approved deferred egress evidence: ${JSON.stringify(approvedDeferred)}`);
}
if (
  !credentialAuthRoute.ok
  || credentialAuthRoute.registry !== credentialAuthRouteRegistry
  || credentialAuthRoute.status !== "credential_value_authorization_route_ready"
  || credentialAuthRoute.summary?.ready !== true
  || credentialAuthRoute.summary?.credentialValueAuthorizationTaskCreated !== false
) {
  throw new Error(`Phase 66 prerequisite should expose credential value authorization route: ${JSON.stringify(credentialAuthRoute)}`);
}
const credentialTaskShell = credentialAuthTaskRecord.task?.cloudConsciousnessLiveProviderCredentialValueAuthorization;
const completedCredentialShell = credentialAuthStepRecord.task?.cloudConsciousnessLiveProviderCredentialValueAuthorization;
if (
  !credentialAuthTaskRecord.ok
  || credentialAuthTaskRecord.registry !== credentialAuthTaskRegistry
  || credentialAuthTaskRecord.approval?.status !== "pending"
  || credentialTaskShell?.registry !== credentialAuthTaskRegistry
  || credentialTaskShell?.sourceRegistry !== credentialAuthRouteRegistry
  || credentialTaskShell?.implementationStatus !== "task_shell_only"
  || credentialTaskShell?.credentialValueAuthorizationTaskCreated !== true
  || credentialTaskShell?.credentialValueAuthorizationTaskApproved !== false
  || !credentialAuthStepRecord.ok
  || credentialAuthStepRecord.task?.status !== "completed"
  || credentialAuthStepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_authorization_task_shell_deferred"
  || completedCredentialShell?.registry !== credentialAuthTaskRegistry
  || completedCredentialShell?.implementationStatus !== "deferred_after_approval"
  || completedCredentialShell?.credentialValueAuthorizationTaskCreated !== true
  || completedCredentialShell?.credentialValueAuthorizationTaskApproved !== true
  || completedCredentialShell?.credentialValueAuthorizationDeferred !== true
) {
  throw new Error(`Phase 67 prerequisite should create and approve deferred credential value authorization task shell evidence: ${JSON.stringify({ credentialAuthTaskRecord, credentialAuthStepRecord })}`);
}
if (
  completedCredentialShell.credentialValueAccessAuthorized !== false
  || completedCredentialShell.credentialValueAccessDenied !== true
  || completedCredentialShell.credentialValueIncluded !== false
  || completedCredentialShell.credentialValueRead !== false
  || completedCredentialShell.credentialValueExposed !== false
  || completedCredentialShell.providerCredentialRead !== false
  || completedCredentialShell.endpointContacted !== false
  || completedCredentialShell.networkEgress !== false
  || completedCredentialShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 66 credential value access authorization task shell must not read credentials or perform egress: ${JSON.stringify(credentialAuthStepRecord)}`);
}
if (
  !credentialAuthApprovedDeferred.ok
  || credentialAuthApprovedDeferred.registry !== credentialAuthApprovedDeferredRegistry
  || credentialAuthApprovedDeferred.status !== "credential_value_authorization_approved_deferred_ready"
  || credentialAuthApprovedDeferred.summary?.ready !== true
  || credentialAuthApprovedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || credentialAuthApprovedDeferred.summary?.sourceTaskId !== credentialAuthStepRecord.task?.id
  || credentialAuthApprovedDeferred.summary?.credentialValueAuthorizationTaskApproved !== true
  || credentialAuthApprovedDeferred.summary?.credentialValueAuthorizationDeferred !== true
  || credentialAuthApprovedDeferred.summary?.credentialValueRead !== false
  || credentialAuthApprovedDeferred.summary?.endpointContacted !== false
  || credentialAuthApprovedDeferred.summary?.networkEgress !== false
  || credentialAuthApprovedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight"
) {
  throw new Error(`Phase 69 prerequisite should expose Phase 67 approved deferred credential value authorization evidence: ${JSON.stringify(credentialAuthApprovedDeferred)}`);
}
if (
  !credentialReadinessPreflight.ok
  || credentialReadinessPreflight.registry !== credentialReadinessPreflightRegistry
  || credentialReadinessPreflight.status !== "credential_value_readiness_preflight_recorded_deferred"
  || credentialReadinessPreflight.task?.id !== credentialAuthStepRecord.task?.id
  || credentialReadinessPreflight.preflight?.registry !== credentialReadinessPreflightRegistry
  || credentialReadinessPreflight.preflight?.summary?.ready !== true
  || credentialReadinessPreflight.preflight?.summary?.credentialValueReadinessPreflightRecorded !== true
  || credentialReadinessPreflight.preflight?.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-read-task-shell"
) {
  throw new Error(`Phase 69 prerequisite should record Phase 68 credential value readiness preflight: ${JSON.stringify(credentialReadinessPreflight)}`);
}
const readinessShell = credentialReadinessPreflight.task?.cloudConsciousnessLiveProviderCredentialValueAuthorization;
if (
  readinessShell?.implementationStatus !== "credential_value_readiness_preflight_recorded"
  || readinessShell?.credentialValueReadinessPreflightRecorded !== true
  || readinessShell?.credentialValueReadinessPreflightRegistry !== credentialReadinessPreflightRegistry
  || readinessShell?.credentialValueAuthorizationTaskApproved !== true
  || readinessShell?.credentialValueAuthorizationDeferred !== true
  || readinessShell?.credentialValueAccessAuthorized !== false
  || readinessShell?.credentialValueAccessDenied !== true
  || readinessShell?.credentialValueIncluded !== false
  || readinessShell?.credentialValueRead !== false
  || readinessShell?.credentialValueExposed !== false
  || readinessShell?.providerCredentialRead !== false
  || readinessShell?.endpointContacted !== false
  || readinessShell?.networkEgress !== false
  || readinessShell?.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 69 prerequisite readiness shell must remain no-read/no-egress: ${JSON.stringify(credentialReadinessPreflight)}`);
}
const readTaskShell = credentialReadTask.task?.cloudConsciousnessLiveProviderCredentialValueRead;
const completedReadShell = credentialReadStep.task?.cloudConsciousnessLiveProviderCredentialValueRead;
if (
  !credentialReadTask.ok
  || credentialReadTask.registry !== credentialReadTaskRegistry
  || credentialReadTask.approval?.status !== "pending"
  || readTaskShell?.registry !== credentialReadTaskRegistry
  || readTaskShell?.sourceRegistry !== credentialReadinessPreflightRegistry
  || readTaskShell?.sourceTaskId !== credentialAuthStepRecord.task?.id
  || readTaskShell?.implementationStatus !== "task_shell_only"
  || readTaskShell?.credentialValueReadinessPreflightRecorded !== true
  || readTaskShell?.credentialValueReadTaskCreated !== true
  || readTaskShell?.credentialValueReadTaskApproved !== false
  || readTaskShell?.credentialValueReadDeferred !== true
  || !credentialReadStep.ok
  || credentialReadStep.task?.status !== "completed"
  || credentialReadStep.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_read_task_shell_deferred"
  || completedReadShell?.registry !== credentialReadTaskRegistry
  || completedReadShell?.implementationStatus !== "deferred_after_approval"
  || completedReadShell?.credentialValueReadTaskCreated !== true
  || completedReadShell?.credentialValueReadTaskApproved !== true
  || completedReadShell?.credentialValueReadDeferred !== true
) {
  throw new Error(`Phase 69 should create and approve deferred credential value access authorization task shell evidence: ${JSON.stringify({ credentialReadTask, credentialReadStep })}`);
}
if (
  completedReadShell.credentialValueAccessAuthorized !== false
  || completedReadShell.credentialValueAccessDenied !== true
  || completedReadShell.credentialValueIncluded !== false
  || completedReadShell.credentialValueRead !== false
  || completedReadShell.credentialValueExposed !== false
  || completedReadShell.providerCredentialRead !== false
  || completedReadShell.endpointContacted !== false
  || completedReadShell.networkEgress !== false
  || completedReadShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 69 read task shell must not read credentials or perform egress: ${JSON.stringify(credentialReadStep)}`);
}
if (
  !credentialReadApprovedDeferred.ok
  || credentialReadApprovedDeferred.registry !== credentialReadApprovedDeferredRegistry
  || credentialReadApprovedDeferred.status !== "credential_value_read_approved_deferred_ready"
  || credentialReadApprovedDeferred.summary?.ready !== true
  || credentialReadApprovedDeferred.summary?.approvedDeferredEvidenceFound !== true
  || credentialReadApprovedDeferred.summary?.sourceTaskId !== credentialReadStep.task?.id
  || credentialReadApprovedDeferred.summary?.credentialValueReadTaskCreated !== true
  || credentialReadApprovedDeferred.summary?.credentialValueReadTaskApproved !== true
  || credentialReadApprovedDeferred.summary?.credentialValueReadDeferred !== true
  || credentialReadApprovedDeferred.summary?.credentialValueAccessAuthorized !== false
  || credentialReadApprovedDeferred.summary?.credentialValueAccessDenied !== true
  || credentialReadApprovedDeferred.summary?.credentialValueIncluded !== false
  || credentialReadApprovedDeferred.summary?.credentialValueRead !== false
  || credentialReadApprovedDeferred.summary?.credentialValueExposed !== false
  || credentialReadApprovedDeferred.summary?.providerCredentialRead !== false
  || credentialReadApprovedDeferred.summary?.endpointContacted !== false
  || credentialReadApprovedDeferred.summary?.networkEgress !== false
  || credentialReadApprovedDeferred.summary?.liveProviderCallEnabled !== false
  || credentialReadApprovedDeferred.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route"
) {
  throw new Error(`Phase 70 should expose approved deferred credential value read evidence without credential reads or egress: ${JSON.stringify(credentialReadApprovedDeferred)}`);
}
if (
  !credentialAccessAuthorizationRoute.ok
  || credentialAccessAuthorizationRoute.registry !== credentialAccessAuthorizationRouteRegistry
  || credentialAccessAuthorizationRoute.status !== "credential_value_access_authorization_route_ready"
  || credentialAccessAuthorizationRoute.summary?.ready !== true
  || credentialAccessAuthorizationRoute.summary?.approvedDeferredEvidenceFound !== true
  || credentialAccessAuthorizationRoute.summary?.sourceTaskId !== credentialReadStep.task?.id
  || credentialAccessAuthorizationRoute.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell"
  || credentialAccessAuthorizationRoute.summary?.credentialValueAccessAuthorizationTaskCreated !== false
  || credentialAccessAuthorizationRoute.summary?.credentialValueAccessAuthorized !== false
  || credentialAccessAuthorizationRoute.summary?.credentialValueAccessDenied !== true
  || credentialAccessAuthorizationRoute.summary?.credentialValueIncluded !== false
  || credentialAccessAuthorizationRoute.summary?.credentialValueRead !== false
  || credentialAccessAuthorizationRoute.summary?.credentialValueExposed !== false
  || credentialAccessAuthorizationRoute.summary?.providerCredentialRead !== false
  || credentialAccessAuthorizationRoute.summary?.endpointContacted !== false
  || credentialAccessAuthorizationRoute.summary?.networkEgress !== false
  || credentialAccessAuthorizationRoute.summary?.liveProviderCallEnabled !== false
  || credentialAccessAuthorizationRoute.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell"
) {
  throw new Error(`Phase 71 should route to credential value access authorization task shell without credential reads or egress: ${JSON.stringify(credentialAccessAuthorizationRoute)}`);
}
const accessAuthorizationTaskShell = credentialAccessAuthorizationTaskRecord.task?.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization;
const completedAccessAuthorizationShell = credentialAccessAuthorizationStepRecord.task?.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization;
if (
  !credentialAccessAuthorizationTaskRecord.ok
  || credentialAccessAuthorizationTaskRecord.registry !== credentialAccessAuthorizationTaskRegistry
  || credentialAccessAuthorizationTaskRecord.approval?.status !== "pending"
  || accessAuthorizationTaskShell?.registry !== credentialAccessAuthorizationTaskRegistry
  || accessAuthorizationTaskShell?.sourceRegistry !== credentialAccessAuthorizationRouteRegistry
  || accessAuthorizationTaskShell?.sourceTaskId !== credentialReadStep.task?.id
  || accessAuthorizationTaskShell?.implementationStatus !== "task_shell_only"
  || accessAuthorizationTaskShell?.credentialValueAccessAuthorizationTaskCreated !== true
  || accessAuthorizationTaskShell?.credentialValueAccessAuthorizationTaskApproved !== false
  || accessAuthorizationTaskShell?.credentialValueAccessAuthorizationDeferred !== true
  || !credentialAccessAuthorizationStepRecord.ok
  || credentialAccessAuthorizationStepRecord.task?.status !== "completed"
  || credentialAccessAuthorizationStepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_access_authorization_task_shell_deferred"
  || completedAccessAuthorizationShell?.registry !== credentialAccessAuthorizationTaskRegistry
  || completedAccessAuthorizationShell?.implementationStatus !== "deferred_after_approval"
  || completedAccessAuthorizationShell?.credentialValueAccessAuthorizationTaskCreated !== true
  || completedAccessAuthorizationShell?.credentialValueAccessAuthorizationTaskApproved !== true
  || completedAccessAuthorizationShell?.credentialValueAccessAuthorizationDeferred !== true
) {
  throw new Error(`Phase 72 should create and approve deferred credential value access authorization task shell evidence: ${JSON.stringify({ credentialAccessAuthorizationTaskRecord, credentialAccessAuthorizationStepRecord })}`);
}
if (
  completedAccessAuthorizationShell.credentialValueAccessAuthorized !== false
  || completedAccessAuthorizationShell.credentialValueAccessDenied !== true
  || completedAccessAuthorizationShell.credentialValueIncluded !== false
  || completedAccessAuthorizationShell.credentialValueRead !== false
  || completedAccessAuthorizationShell.credentialValueExposed !== false
  || completedAccessAuthorizationShell.providerCredentialRead !== false
  || completedAccessAuthorizationShell.endpointContacted !== false
  || completedAccessAuthorizationShell.networkEgress !== false
  || completedAccessAuthorizationShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 72 credential value access authorization task shell must not authorize access, read credentials, or perform egress: ${JSON.stringify(credentialAccessAuthorizationStepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueAccessAuthorizationTaskShell: { status: "passed", taskId: credentialAccessAuthorizationTaskRecord.task.id, completedTaskId: credentialAccessAuthorizationStepRecord.task.id, sourceTaskId: accessAuthorizationTaskShell.sourceTaskId, taskRegistry, preflightRegistry, credentialGateRegistry, endpointGateRegistry, routePreflightRegistry, egressTaskRegistry, credentialAuthRouteRegistry, credentialAuthTaskRegistry, credentialAuthApprovedDeferredRegistry, credentialReadinessPreflightRegistry, credentialReadTaskRegistry, credentialReadApprovedDeferredRegistry, credentialAccessAuthorizationRouteRegistry, credentialAccessAuthorizationTaskRegistry } }, null, 2));
EOF
