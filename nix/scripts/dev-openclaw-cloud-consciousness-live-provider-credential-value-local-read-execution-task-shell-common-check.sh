#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-prereq.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE84_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE84_PORT_BASE:-23300}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_84_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-84-credential-value-local-read-execution-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-84-credential-value-local-read-execution-task-shell-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LOCAL_READ_EXECUTION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route-v0"
LOCAL_READ_EXECUTION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-v0"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}"
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
  node - <<'EOF' "$LOCAL_READ_EXECUTION_ROUTE_REGISTRY" "$LOCAL_READ_EXECUTION_TASK_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const localReadExecutionRouteRegistry = process.argv[2];
const localReadExecutionTaskRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Task Shell",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-tasks",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTaskShell",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred",
  localReadExecutionRouteRegistry,
  localReadExecutionTaskRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionTaskShell: { status: "passed", localReadExecutionRouteRegistry, localReadExecutionTaskRegistry } }, null, 2));
EOF
  exit 0
fi

openclaw_credential_value_local_read_prepare_prereq_state 84

"$SCRIPT_DIR/dev-up.sh"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-84-check","reason":"Approve credential value local read execution task shell while keeping credential values unread."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'EOF' "$LOCAL_READ_EXECUTION_ROUTE_REGISTRY" "$LOCAL_READ_EXECUTION_TASK_REGISTRY" "$PLAN_DOC" "$TASK_FILE" "$STEP_FILE"
const fs = require("node:fs");
const localReadExecutionRouteRegistry = process.argv[2];
const localReadExecutionTaskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const taskRecord = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const stepRecord = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell",
  "Requires Phase 83 credential value local read execution route evidence",
  "credentialValueLocalReadExecutionTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 84 plan doc missing ${token}`);
}
const taskShell = taskRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution;
const completedShell = stepRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution;
if (
  !taskRecord.ok
  || taskRecord.registry !== localReadExecutionTaskRegistry
  || taskRecord.approval?.status !== "pending"
  || taskShell?.registry !== localReadExecutionTaskRegistry
  || taskShell?.sourceRegistry !== localReadExecutionRouteRegistry
  || taskShell?.implementationStatus !== "task_shell_only"
  || taskShell?.credentialValueLocalReadExecutionTaskCreated !== true
  || taskShell?.credentialValueLocalReadExecutionTaskApproved !== false
  || taskShell?.credentialValueLocalReadExecutionDeferred !== true
  || !stepRecord.ok
  || stepRecord.task?.status !== "completed"
  || stepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_local_read_execution_task_shell_deferred"
  || completedShell?.registry !== localReadExecutionTaskRegistry
  || completedShell?.implementationStatus !== "deferred_after_approval"
  || completedShell?.credentialValueLocalReadExecutionTaskCreated !== true
  || completedShell?.credentialValueLocalReadExecutionTaskApproved !== true
  || completedShell?.credentialValueLocalReadExecutionDeferred !== true
) {
  throw new Error(`Phase 84 should create and approve deferred credential value local read execution task shell evidence: ${JSON.stringify({ taskRecord, stepRecord })}`);
}
if (
  completedShell.credentialValueIncluded !== false
  || completedShell.credentialValueRead !== false
  || completedShell.credentialValueExposed !== false
  || completedShell.providerCredentialRead !== false
  || completedShell.endpointContacted !== false
  || completedShell.networkEgress !== false
  || completedShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 84 local read execution task shell must not read credentials or perform egress: ${JSON.stringify(stepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionTaskShell: { status: "passed", taskId: taskRecord.task.id, completedTaskId: stepRecord.task.id, sourceTaskId: taskShell.sourceTaskId, localReadExecutionRouteRegistry, localReadExecutionTaskRegistry } }, null, 2));
EOF
