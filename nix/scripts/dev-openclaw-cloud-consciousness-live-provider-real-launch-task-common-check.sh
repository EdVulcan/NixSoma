#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE57_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE57_PORT_BASE:-19400}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_57_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-57-real-launch-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-57-real-launch-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
ROUTE_REVIEW_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-route-review-v0"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-real-launch-task-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase57-prereq"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${REVIEW_FILE:-}" "${TASK_FILE:-}" "${REJECT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$ROUTE_REVIEW_REGISTRY" "$TASK_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const routeReviewRegistry = process.argv[2];
const taskRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Real Launch Route Review",
  "cloud-consciousness-live-provider-real-launch-route-review-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-real-launch-route-review",
  "/cloud-consciousness/live-provider-real-launch-tasks",
  "refreshCloudConsciousnessLiveProviderRealLaunchRouteReview",
  routeReviewRegistry,
  taskRegistry,
  "Task Endpoint: /cloud-consciousness/live-provider-real-launch-tasks",
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessRealLaunchTask: { status: "passed", routeReviewRegistry, taskRegistry } }, null, 2));
EOF
  exit 0
fi

REVIEW_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-real-launch-route-review" > "$REVIEW_FILE"
REJECT_FILE="$(mktemp)"
status="$(curl --silent --output "$REJECT_FILE" --write-out "%{http_code}" -X POST "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" -H 'content-type: application/json' --data '{}')"
if [[ "$status" != "400" ]]; then
  echo "Expected real launch task without confirm=true to fail, got $status" >&2
  cat "$REJECT_FILE" >&2
  exit 1
fi

TASK_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-real-launch-tasks" '{"confirm":true}' > "$TASK_FILE"
node - <<'EOF' "$ROUTE_REVIEW_REGISTRY" "$TASK_REGISTRY" "$PLAN_DOC" "$REVIEW_FILE" "$TASK_FILE"
const fs = require("node:fs");
const routeReviewRegistry = process.argv[2];
const taskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const review = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-real-launch-task",
  "approval-gated real live-provider launch task shell",
  "launchExecuted: false",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 57 plan doc missing ${token}`);
}
if (review.registry !== routeReviewRegistry || review.summary?.ready !== true) {
  throw new Error(`Phase 57 prerequisite route review not ready: ${JSON.stringify(review)}`);
}
const shell = task.task?.cloudConsciousnessLiveProviderRealLaunch;
if (
  !task.ok
  || task.registry !== taskRegistry
  || task.sourceRegistry !== routeReviewRegistry
  || task.task?.type !== "cloud_consciousness_live_provider_real_launch_task"
  || task.approval?.status !== "pending"
  || shell?.registry !== taskRegistry
  || shell?.implementationStatus !== "task_shell_only"
  || shell?.localRuntimeAdapterComplete !== true
  || shell?.adapterMethodTableClosed !== true
  || shell?.methodCount !== 6
  || shell?.implementedMethodCount !== 6
  || shell?.launchAuthorized !== false
  || shell?.launchExecuted !== false
  || shell?.credentialValueRead !== false
  || shell?.endpointContacted !== false
  || shell?.networkEgress !== false
  || shell?.providerResponseCreated !== false
  || shell?.rollbackExecuted !== false
  || shell?.hostMutation !== false
  || shell?.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 57 real launch task should be a pending approval shell only: ${JSON.stringify(task)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessRealLaunchTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id, taskRegistry } }, null, 2));
EOF
