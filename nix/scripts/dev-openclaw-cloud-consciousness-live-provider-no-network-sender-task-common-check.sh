#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE37_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE37_PORT_BASE:-8840}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_37_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-37-no-network-sender-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-37-no-network-sender-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
REGISTRY="openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase37-prereq"
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${REJECT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

DATA_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-no-network-sender" > "$DATA_FILE"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$REGISTRY" "$DATA_FILE" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const registry = process.argv[2];
const data = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider No-Network Sender",
  "cloud-consciousness-live-provider-no-network-sender-panel",
  "cloud-live-provider-no-network-sender-next",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-no-network-sender-tasks",
  registry,
  "Task Registry: openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0",
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!data.ok || data.summary?.ready !== true || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-send-provider-request-task") {
  throw new Error(`Observer Phase 37 prerequisite should be ready: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessLiveProviderNoNetworkSenderTask: { status: "passed", registry } }, null, 2));
EOF
  exit 0
fi

REJECT_FILE="$(mktemp)"
status="$(curl --silent --output "$REJECT_FILE" --write-out "%{http_code}" -X POST "$CORE_URL/cloud-consciousness/live-provider-no-network-sender-tasks" -H 'content-type: application/json' --data '{}')"
if [[ "$status" != "400" ]]; then
  echo "Expected no-network sender task without confirm=true to fail, got $status" >&2
  cat "$REJECT_FILE" >&2
  exit 1
fi

TASK_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-no-network-sender-tasks" '{"confirm":true}' > "$TASK_FILE"

node - <<'EOF' "$REGISTRY" "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const registry = process.argv[2];
const doc = fs.readFileSync(process.argv[3], "utf8");
const sender = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-no-network-sender-task",
  "approval-gated task shell",
  "live provider egress remains disabled",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 37 plan doc missing ${token}`);
}
if (!sender.ok || sender.summary?.ready !== true || sender.summary?.noNetworkProviderRequestSenderReady !== true) {
  throw new Error(`Phase 36 no-network sender prerequisite should be ready: ${JSON.stringify(sender.summary)}`);
}
if (
  !task.ok
  || task.registry !== registry
  || task.task?.type !== "cloud_consciousness_live_provider_no_network_sender_task"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.implementationStatus !== "task_shell_only"
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.noNetworkProviderRequestSenderReady !== true
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.dispatchDeferred !== true
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.credentialValueIncluded !== false
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.endpointContacted !== false
  || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.networkEgress !== false
) {
  throw new Error(`Phase 37 no-network sender task should be approval-gated shell only: ${JSON.stringify(task)}`);
}
const shell = task.task.cloudConsciousnessLiveProviderNoNetworkSender;
if (
  shell.providerSdkLoaded !== false
  || shell.providerCredentialRead !== false
  || shell.credentialValueRead !== false
  || shell.credentialValueExposed !== false
  || shell.transmitsExternally !== false
  || shell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 37 shell must keep all live activity disabled: ${JSON.stringify(shell)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProviderNoNetworkSenderTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id, registry } }, null, 2));
EOF
