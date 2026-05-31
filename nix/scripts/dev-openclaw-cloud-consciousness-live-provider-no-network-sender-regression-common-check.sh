#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE39_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE39_PORT_BASE:-8880}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_39_PLAN.md"
MODULE_FILE="$REPO_ROOT/services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-39-no-network-sender-regression-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-39-no-network-sender-regression-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0"
SENDER_REGISTRY="openclaw-cloud-consciousness-live-provider-send-provider-request-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase39-prereq"
cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${SENDER_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${AFTER_SENDER_FILE:-}" "${BEFORE_FILE:-}" "${AFTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$SENDER_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const senderRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider No-Network Sender",
  "cloud-consciousness-live-provider-no-network-sender-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-no-network-sender",
  "/cloud-consciousness/live-provider-no-network-sender-tasks",
  taskRegistry,
  senderRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessNoNetworkSenderRegression: { status: "passed", taskRegistry, senderRegistry } }, null, 2));
EOF
  exit 0
fi

SENDER_FILE="$(mktemp)"
AFTER_SENDER_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
BEFORE_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$BEFORE_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-no-network-sender" > "$SENDER_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-no-network-sender-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-39-check","reason":"Approve no-network sender regression deferred shell."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-no-network-sender" > "$AFTER_SENDER_FILE"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$AFTER_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$SENDER_REGISTRY" "$PLAN_DOC" "$SENDER_FILE" "$TASK_FILE" "$STEP_FILE" "$AFTER_SENDER_FILE" "$BEFORE_FILE" "$AFTER_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const senderRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const sender = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const step = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const afterSender = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const beforeHash = fs.readFileSync(process.argv[9], "utf8").trim();
const afterHash = fs.readFileSync(process.argv[10], "utf8").trim();
for (const token of [
  "openclaw-cloud-consciousness-live-provider-no-network-sender-regression",
  "dispatch remains `deferred`",
  "no endpoint contact, network egress, response creation, or live provider call",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 39 plan doc missing ${token}`);
}
if (beforeHash !== afterHash) {
  throw new Error(`Runtime adapter module source should not change: ${beforeHash} !== ${afterHash}`);
}
if (!sender.ok || sender.registry !== senderRegistry || sender.summary?.ready !== true || sender.summary?.dispatchDeferred !== true) {
  throw new Error(`Phase 39 no-network sender prerequisite failed: ${JSON.stringify(sender.summary)}`);
}
if (!task.ok || task.registry !== taskRegistry || task.task?.cloudConsciousnessLiveProviderNoNetworkSender?.implementationStatus !== "task_shell_only") {
  throw new Error(`Phase 39 task shell failed: ${JSON.stringify(task.task?.cloudConsciousnessLiveProviderNoNetworkSender)}`);
}
const shell = step.task?.cloudConsciousnessLiveProviderNoNetworkSender;
if (!step.ok || shell?.registry !== taskRegistry || shell?.implementationStatus !== "deferred_after_approval") {
  throw new Error(`Phase 39 deferred step failed: ${JSON.stringify(step)}`);
}
for (const state of [sender.summary, afterSender.summary, shell]) {
  if (
    state.dispatchDeferred !== true
    || state.credentialValueIncluded !== false
    || state.endpointContacted !== false
    || state.networkEgress !== false
    || state.liveProviderCallEnabled !== false
  ) {
    throw new Error(`Phase 39 regression found live provider activity: ${JSON.stringify(state)}`);
  }
}
if (sender.egressEnvelope?.egressEnvelope?.response !== null || afterSender.egressEnvelope?.egressEnvelope?.response !== null) {
  throw new Error("No-network sender regression must not create provider responses.");
}
console.log(JSON.stringify({ openclawCloudConsciousnessNoNetworkSenderRegression: { status: "passed", taskId: step.task.id, taskRegistry, senderRegistry } }, null, 2));
EOF
