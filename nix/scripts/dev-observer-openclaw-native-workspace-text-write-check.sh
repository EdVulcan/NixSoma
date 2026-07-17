#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-workspace-text-write-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/observer-native-write.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
SECRET_CONTENT="OBSERVER_NATIVE_WORKSPACE_TEXT_WRITE_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9500}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9501}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9502}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9503}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9504}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9505}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9506}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9507}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9570}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-workspace-text-write-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-native-workspace-text-write-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

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
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${DRAFT_FILE:-}" "${TASK_FILE:-}" "${APPROVAL_ID_FILE:-}" "${APPROVE_FILE:-}" "${STEP_FILE:-}" "${HISTORY_FILE:-}" "${LEDGER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVAL_ID_FILE="$(mktemp)"
APPROVE_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
LEDGER_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-text-write/draft?relativePath=$TARGET_RELATIVE_PATH" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"content\":\"$SECRET_CONTENT\",\"overwrite\":true,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-text-write-tasks" > "$TASK_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$DRAFT_FILE" "$TASK_FILE" "$APPROVAL_ID_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const draft = readJson(4);
const task = readJson(5);
const approvalIdFile = process.argv[6];
const secret = process.argv[7];
const raw = JSON.stringify({ html, client, draft, task });

for (const token of [
  "OpenClaw Workspace Text Write",
  "workspace-text-write-registry",
  "workspace-text-write-capability",
  "workspace-text-write-approval",
  "workspace-text-write-content",
  "workspace-text-write-task-button",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/workspace-text-write/draft",
  "/plugins/native-adapter/workspace-text-write-tasks",
  "refreshWorkspaceTextWriteDraft",
  "renderWorkspaceTextWriteDraft",
  "createWorkspaceTextWriteApprovalTask",
  "act.openclaw.workspace_text_write",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !draft.ok
  || draft.capability?.id !== "act.openclaw.workspace_text_write"
  || draft.capability?.approvalRequired !== true
  || draft.target?.contentExposed !== false
  || draft.draft?.governance?.exposesContent !== false
) {
  throw new Error(`Observer draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-workspace-text-write-task-v0"
  || task.approval?.status !== "pending"
  || task.task?.approval?.required !== true
  || !task.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
) {
  throw new Error(`Observer task mismatch: ${JSON.stringify(task)}`);
}
if (raw.includes(secret)) {
  throw new Error("Observer workspace text write leaked raw content before execution");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"approvedBy":"observer-milestone-check","reason":"Approve observer native OpenClaw workspace text write."}' \
  "$CORE_URL/approvals/$APPROVAL_ID/approve" > "$APPROVE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=10" > "$LEDGER_FILE"

node - <<'EOF' "$APPROVE_FILE" "$STEP_FILE" "$HISTORY_FILE" "$LEDGER_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const approve = readJson(2);
const step = readJson(3);
const history = readJson(4);
const ledger = readJson(5);
const targetFile = process.argv[6];
const secret = process.argv[7];
const raw = JSON.stringify({ approve, step, history, ledger });

if (approve.approval?.status !== "approved") {
  throw new Error(`Observer approval mismatch: ${JSON.stringify(approve)}`);
}
if (
  step.ran !== true
  || step.task?.status !== "completed"
  || step.execution?.capabilityInvocations?.some((item) => item.capabilityId === "act.filesystem.write_text" && item.invoked === true) !== true
) {
  throw new Error(`Observer operator execution mismatch: ${JSON.stringify(step)}`);
}
if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, "utf8") !== secret) {
  throw new Error("Observer approved workspace text write did not create expected file content");
}
if (history.summary?.byCapability?.["act.filesystem.write_text"] !== 1) {
  throw new Error(`Observer filesystem write history mismatch: ${JSON.stringify(history)}`);
}
if (ledger.summary?.write_text < 1 || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile)) {
  throw new Error(`Observer filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (raw.includes(secret)) {
  throw new Error("Observer workspace text write leaked raw content after execution");
}

console.log(JSON.stringify({
  observerOpenClawNativeWorkspaceTextWrite: {
    html: "visible",
    task: step.task.id,
    approval: approve.approval.id,
    ledgerWrites: ledger.summary.write_text,
  },
}, null, 2));
EOF
