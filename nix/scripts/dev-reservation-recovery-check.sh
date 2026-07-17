#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/reservation-recovery-fixture"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10270}"
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-reservation-recovery-check}"
export OPENCLAW_DEV_STATE_FILE="${OPENCLAW_DEV_STATE_FILE:-$REPO_ROOT/.artifacts/dev-services-unix-$OPENCLAW_DEV_RUN_ID.tsv}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-$OPENCLAW_DEV_RUN_ID.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-$OPENCLAW_DEV_RUN_ID-events.jsonl}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-$REPO_ROOT/.artifacts/openclaw-operator-token-$OPENCLAW_DEV_RUN_ID}"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="${OPENCLAW_SYSTEM_ALLOWED_ROOTS:-$FIXTURE_DIR}"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="${OPENCLAW_SYSTEM_COMMAND_ALLOWLIST:-echo,printf,pwd,whoami,ls,cat,head,tail,wc,sleep}"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="${OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS:-12000}"
export OPENCLAW_CAPABILITY_EXECUTION_RESERVATION_TTL_MS="${OPENCLAW_CAPABILITY_EXECUTION_RESERVATION_TTL_MS:-30000}"
export OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE="${OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE:-$REPO_ROOT/.artifacts/openclaw-execution-grant-$OPENCLAW_DEV_RUN_ID-private.pem}"
export OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE="${OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE:-$REPO_ROOT/.artifacts/openclaw-execution-grant-$OPENCLAW_DEV_RUN_ID-public.pem}"

cd "$REPO_ROOT"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"

cleanup() {
  if [[ -n "${OPERATOR_PID:-}" ]]; then
    kill "$OPERATOR_PID" >/dev/null 2>&1 || true
    wait "$OPERATOR_PID" >/dev/null 2>&1 || true
  fi
  rm -f \
    "${PLAN_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${OPERATOR_FILE:-}" \
    "${TASKS_FILE:-}"
  rm -rf "$FIXTURE_DIR"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
"$SCRIPT_DIR/dev-up.sh"

PLAN_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
OPERATOR_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

PLAN_BODY="$(node -e '
  const path = process.argv[1];
  console.log(JSON.stringify({
    goal: "Recover an interrupted governed command",
    type: "system_task",
    actions: [{
      kind: "system.command.execute",
      intent: "system.command.execute",
      params: { command: "sleep", args: ["5"], cwd: path },
    }],
  }));
' "$FIXTURE_DIR")"
post_json "$CORE_URL/tasks/plan" "$PLAN_BODY" > "$PLAN_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

TASK_ID="$(node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!response.ok || !response.task?.id) throw new Error("missing planned task: " + JSON.stringify(response));
  process.stdout.write(response.task.id);
' "$PLAN_FILE")"
APPROVAL_ID="$(node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!response.ok || response.ran !== false || response.blocked !== true || response.reason !== "policy_requires_approval") {
    throw new Error("expected approval gate: " + JSON.stringify(response));
  }
  const approvalId = response.approval?.id ?? response.task?.approval?.requestId;
  if (!approvalId) throw new Error("missing approval reference: " + JSON.stringify(response));
  process.stdout.write(approvalId);
' "$BLOCKED_FILE")"
post_json "$CORE_URL/approvals/$APPROVAL_ID/approve" '{"approvedBy":"reservation-recovery-check","reason":"Approve interrupted fixture command for recovery proof."}' > "$APPROVED_FILE"

post_json "$CORE_URL/operator/step" '{}' > "$OPERATOR_FILE" &
OPERATOR_PID=$!

running=0
for _ in $(seq 1 120); do
  if [[ -s "$OPENCLAW_CORE_STATE_FILE" ]] && node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const task = (state.tasks ?? []).find((candidate) => candidate.id === process.argv[2]);
    const step = task?.plan?.steps?.find((candidate) => candidate.phase === "acting_on_target");
    process.exit(step?.executionReservation?.status === "running" ? 0 : 1);
  ' "$OPENCLAW_CORE_STATE_FILE" "$TASK_ID"; then
    running=1
    break
  fi
  sleep 0.05
done
if [[ "$running" != "1" ]]; then
  echo "Core did not persist a running capability reservation before the interruption." >&2
  if [[ -f "$OPENCLAW_CORE_STATE_FILE" ]]; then
    node -e 'const fs = require("node:fs"); console.error(fs.readFileSync(process.argv[1], "utf8"));' "$OPENCLAW_CORE_STATE_FILE" || true
  fi
  exit 1
fi

CORE_PID="$(awk -F '\t' '$1 == "openclaw-core" { print $2; exit }' "$OPENCLAW_DEV_STATE_FILE")"
if [[ -z "$CORE_PID" ]]; then
  echo "Unable to find the managed Core PID for restart recovery." >&2
  exit 1
fi
kill "$CORE_PID"
wait "$OPERATOR_PID" >/dev/null 2>&1 || true
unset OPERATOR_PID

# Stop the remaining isolated services, then restart the same Core state file.
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail "$CORE_URL/tasks?limit=20" > "$TASKS_FILE"

node - <<'NODE' "$TASKS_FILE" "$TASK_ID" "$APPROVED_FILE"
const fs = require("node:fs");
const tasksResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const taskId = process.argv[3];
const approved = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const task = tasksResponse.items?.find((candidate) => candidate.id === taskId);
const step = task?.plan?.steps?.find((candidate) => candidate.phase === "acting_on_target");
const receipt = step?.executionReceipt;

if (approved.approval?.status !== "approved") {
  throw new Error("approval did not remain approved before restart: " + JSON.stringify(approved));
}
if (
  !tasksResponse.ok
  || !task
  || task.status !== "failed"
  || step.status !== "failed"
  || step.executionReservation !== null
  || receipt?.status !== "recovered_aborted"
  || receipt.reason !== "core_runtime_restart"
) {
  throw new Error("interrupted reservation was not failed closed on restart: " + JSON.stringify({ task, receipt }));
}

console.log(JSON.stringify({
  reservationRecovery: {
    taskId,
    taskStatus: task.status,
    stepStatus: step.status,
    receiptStatus: receipt.status,
    reason: receipt.reason,
    automaticReplay: false,
  },
}, null, 2));
NODE
