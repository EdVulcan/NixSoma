#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-text-write-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/native-write.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
SECRET_CONTENT="NATIVE_WORKSPACE_TEXT_WRITE_SECRET_CONTENT_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9490}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9491}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9492}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9493}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9494}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9495}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9496}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9497}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9560}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-text-write-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-text-write-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/src/agents/tools" "$WORKSPACE_DIR/scratch"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true
}
JSON

cleanup() {
  rm -f "${DRAFT_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${APPROVE_FILE:-}" "${STEP_FILE:-}" "${HISTORY_FILE:-}" "${LEDGER_FILE:-}" "${TASKS_FILE:-}" "${APPROVAL_ID_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

DRAFT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVE_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
LEDGER_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
APPROVAL_ID_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-text-write/draft?relativePath=$TARGET_RELATIVE_PATH" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"content\":\"$SECRET_CONTENT\",\"overwrite\":true,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-text-write-tasks" > "$TASK_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$BLOCKED_FILE"

node - <<'EOF' "$DRAFT_FILE" "$TASK_FILE" "$BLOCKED_FILE" "$APPROVAL_ID_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const crypto = require("node:crypto");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const draft = readJson(2);
const task = readJson(3);
const blocked = readJson(4);
const approvalIdFile = process.argv[5];
const targetFile = process.argv[6];
const secret = process.argv[7];
const raw = JSON.stringify({ draft, task, blocked });
const expectedHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");

if (
  !draft.ok
  || draft.registry !== "openclaw-native-workspace-text-write-draft-v0"
  || draft.capability?.id !== "act.openclaw.workspace_text_write"
  || draft.capability?.approvalRequired !== true
  || draft.target?.contentExposed !== false
  || draft.draft?.governance?.usesFilesystemWriteCapability !== true
) {
  throw new Error(`draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-workspace-text-write-task-v0"
  || task.mode !== "approval-gated"
  || task.capability?.id !== "act.openclaw.workspace_text_write"
  || task.target?.relativePath !== "scratch/native-write.txt"
  || task.target?.contentBytes !== Buffer.byteLength(secret, "utf8")
  || task.target?.contentSha256 !== expectedHash
  || task.target?.contentExposed !== false
  || task.approval?.status !== "pending"
  || task.task?.approval?.required !== true
  || task.task?.plan?.capabilitySummary?.ids?.includes("act.filesystem.write_text") !== true
  || !task.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
  || task.governance?.createsTask !== true
  || task.governance?.createsApproval !== true
  || task.governance?.usesFilesystemWriteCapability !== true
  || task.governance?.exposesContent !== false
) {
  throw new Error(`task mismatch: ${JSON.stringify(task)}`);
}
if (
  blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.approval?.status !== "pending"
) {
  throw new Error(`pre-approval operator mismatch: ${JSON.stringify(blocked)}`);
}
if (fs.existsSync(targetFile)) {
  throw new Error("workspace text write executed before approval");
}
if (raw.includes(secret)) {
  throw new Error("secret write content leaked through public draft/task/operator responses");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"approvedBy":"milestone-check","reason":"Approve bounded native OpenClaw workspace text write."}' \
  "$CORE_URL/approvals/$APPROVAL_ID/approve" > "$APPROVE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=10" > "$LEDGER_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$APPROVE_FILE" "$STEP_FILE" "$HISTORY_FILE" "$LEDGER_FILE" "$TASKS_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const approve = readJson(2);
const step = readJson(3);
const history = readJson(4);
const ledger = readJson(5);
const tasks = readJson(6);
const targetFile = process.argv[7];
const secret = process.argv[8];
const raw = JSON.stringify({ approve, step, history, ledger, tasks });

if (approve.approval?.status !== "approved" || approve.task?.approval?.required !== false) {
  throw new Error(`approval mismatch: ${JSON.stringify(approve)}`);
}
if (
  step.ran !== true
  || step.blocked !== false
  || step.task?.status !== "completed"
  || step.execution?.capabilityInvocations?.some((item) => item.capabilityId === "act.filesystem.write_text" && item.invoked === true) !== true
) {
  throw new Error(`approved operator execution mismatch: ${JSON.stringify(step)}`);
}
if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, "utf8") !== secret) {
  throw new Error("approved workspace text write did not create the expected file content");
}
if (
  history.summary?.byCapability?.["act.filesystem.write_text"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "act.filesystem.write_text" && entry.invoked === true && entry.policy?.approved === true)
) {
  throw new Error(`filesystem write history mismatch: ${JSON.stringify(history)}`);
}
if (
  ledger.summary?.write_text < 1
  || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile)
) {
  throw new Error(`filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (raw.includes(secret)) {
  throw new Error("secret write content leaked through approval/operator/history/ledger/task responses");
}

console.log(JSON.stringify({
  openclawNativeWorkspaceTextWrite: {
    task: step.task.id,
    approval: approve.approval.id,
    path: targetFile,
    capabilityHistory: history.summary.byCapability,
    ledgerWrites: ledger.summary.write_text,
  },
}, null, 2));
EOF
