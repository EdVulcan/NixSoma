#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6490}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6491}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6492}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6493}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6494}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6495}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6496}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6497}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6560}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-directory-execution-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-directory-execution-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded body evidence ledger directory creation."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created")"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$task_id")"
directory_exists="false"
if [[ -d "$LEDGER_DIR" ]]; then
  directory_exists="true"
fi
record_count="$(find "$LEDGER_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')"

node - <<'EOF' "$PLAN_FILE" "$created" "$approved" "$step" "$task_state" "$directory_exists" "$record_count"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const approved = JSON.parse(process.argv[4]);
const step = JSON.parse(process.argv[5]);
const taskState = JSON.parse(process.argv[6]);
const directoryExists = process.argv[7] === "true";
const recordCount = Number.parseInt(process.argv[8], 10);

for (const token of [
  "openclaw-body-evidence-ledger-directory-execution",
  "Body evidence ledger directory execution checkpoint",
  "Creates `.artifacts/openclaw-body-evidence-ledger`",
  "Does not write ledger records",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing directory execution token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-directory-task-v0") {
  throw new Error(`directory task should be created first: ${JSON.stringify(created)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`directory task approval should be approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run approved directory task: ${JSON.stringify(step)}`);
}
const finalTask = step.task ?? taskState.task;
if (finalTask?.status !== "completed" || finalTask?.outcome?.kind !== "completed") {
  throw new Error(`directory task should complete after approved mkdir: ${JSON.stringify(finalTask)}`);
}
const directory = finalTask.bodyEvidenceLedgerDirectory ?? {};
if (directory.displayPath !== ".artifacts/openclaw-body-evidence-ledger"
  || directory.directoryExists !== true
  || directory.durableStorageWritten !== false
  || directory.recordWritesEnabled !== false) {
  throw new Error(`directory task should record directory-only evidence: ${JSON.stringify(directory)}`);
}
const mkdirResult = directory.mkdirResult ?? {};
if (mkdirResult.registry !== "openclaw-body-evidence-ledger-directory-execution-v0"
  || mkdirResult.created !== true
  || mkdirResult.mode !== "mkdir") {
  throw new Error(`task detail should expose bounded directory execution result: ${JSON.stringify(directory)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.hostMutation !== true
  || details.directoryExists !== true
  || details.durableStorageWritten !== false
  || details.recordWritesEnabled !== false) {
  throw new Error(`directory execution outcome should preserve no-record-write boundary: ${JSON.stringify(details)}`);
}
if (!directoryExists) {
  throw new Error("approved directory execution should create .artifacts/openclaw-body-evidence-ledger");
}
if (recordCount !== 0) {
  throw new Error(`directory execution must not write ledger record files; found ${recordCount}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerDirectoryExecution: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    directoryExists,
    recordCount,
    durableStorageWritten: directory.durableStorageWritten,
  },
}, null, 2));
EOF
