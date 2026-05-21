#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6500}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6501}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6502}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6503}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6504}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6505}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6506}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6507}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6570}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-directory-execution-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-directory-execution-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve visible ledger directory creation."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created")"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created" "$approved" "$step" "$task_state"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);
const taskState = JSON.parse(process.argv[7]);

for (const token of [
  "Body Evidence Ledger Directory Task",
  "create-body-evidence-ledger-directory-task-button",
  "body-evidence-ledger-directory-task-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "createBodyEvidenceLedgerDirectoryTask",
  "/body/evidence-ledger/directory-tasks",
  "openclaw-body-evidence-ledger-directory-task-v0",
  "bodyEvidenceLedgerDirectory",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!created.ok || created.approval?.status !== "pending") {
  throw new Error(`Observer should create pending directory task approval: ${JSON.stringify(created)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`Observer approval path should approve directory task: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`Observer-visible operator step should run directory execution: ${JSON.stringify(step)}`);
}
const finalTask = step.task ?? taskState.task;
if (finalTask?.bodyEvidenceLedgerDirectory?.directoryExists !== true
  || finalTask?.bodyEvidenceLedgerDirectory?.durableStorageWritten !== false
  || finalTask?.bodyEvidenceLedgerDirectory?.recordWritesEnabled !== false) {
  throw new Error(`Observer-visible task detail should expose directory-only result: ${JSON.stringify(finalTask)}`);
}
if (finalTask.bodyEvidenceLedgerDirectory?.mkdirResult?.registry !== "openclaw-body-evidence-ledger-directory-execution-v0") {
  throw new Error(`Observer-visible task detail should expose directory execution registry: ${JSON.stringify(finalTask.bodyEvidenceLedgerDirectory)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerDirectoryExecution: {
    status: "passed",
    panel: "Body Evidence Ledger Directory Task",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    directoryExists: finalTask.bodyEvidenceLedgerDirectory.directoryExists,
    durableStorageWritten: finalTask.bodyEvidenceLedgerDirectory.durableStorageWritten,
  },
}, null, 2));
EOF
