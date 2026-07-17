#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-multi-patch-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/native-multi-edit.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
UNRELATED_SECRET="NATIVE_WORKSPACE_MULTI_PATCH_UNRELATED_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9530}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9531}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9532}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9533}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9534}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9535}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9536}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9537}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9600}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-multi-patch-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-multi-patch-check-events.jsonl}"

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
cat > "$TARGET_FILE" <<EOF
alpha context
before
safe middle
$UNRELATED_SECRET
omega
tail context
EOF

cleanup() {
  rm -f "${DRAFT_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${APPROVE_FILE:-}" "${STEP_FILE:-}" "${HISTORY_FILE:-}" "${LEDGER_FILE:-}" "${APPROVAL_ID_FILE:-}"
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
APPROVAL_ID_FILE="$(mktemp)"

EDITS_JSON='[{"search":"before","replacement":"after","occurrence":1},{"search":"omega","replacement":"zeta","occurrence":1}]'
EDITS_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EDITS_JSON")"

curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$EDITS_ENCODED&contextLines=0" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"edits\":$EDITS_JSON,\"contextLines\":0,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply-tasks" > "$TASK_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$BLOCKED_FILE"

node - <<'EOF' "$DRAFT_FILE" "$TASK_FILE" "$BLOCKED_FILE" "$APPROVAL_ID_FILE" "$TARGET_FILE" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const draft = readJson(2);
const task = readJson(3);
const blocked = readJson(4);
const approvalIdFile = process.argv[5];
const targetFile = process.argv[6];
const unrelatedSecret = process.argv[7];
const raw = JSON.stringify({ draft, task, blocked });

if (
  !draft.ok
  || draft.capability?.id !== "act.openclaw.workspace_patch_apply"
  || draft.target?.editCount !== 2
  || draft.target?.contentExposed !== false
  || draft.target?.diffPreviewExposed !== true
  || draft.diffPreview?.format !== "bounded-multi-hunk-line-diff-v0"
  || draft.diffPreview?.hunkCount !== 2
  || !draft.diffPreview?.lines?.some((line) => line.hunk === 1 && line.type === "remove" && line.text === "before")
  || !draft.diffPreview?.lines?.some((line) => line.hunk === 1 && line.type === "add" && line.text === "after")
  || !draft.diffPreview?.lines?.some((line) => line.hunk === 2 && line.type === "remove" && line.text === "omega")
  || !draft.diffPreview?.lines?.some((line) => line.hunk === 2 && line.type === "add" && line.text === "zeta")
  || !draft.edits?.every((edit) => edit.searchExposed === false && edit.replacementExposed === false)
) {
  throw new Error(`multi-patch draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-workspace-patch-apply-task-v0"
  || task.target?.editCount !== 2
  || task.approval?.status !== "pending"
  || task.task?.approval?.required !== true
  || task.task?.plan?.capabilitySummary?.ids?.includes("act.filesystem.write_text") !== true
  || !task.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
) {
  throw new Error(`multi-patch task mismatch: ${JSON.stringify(task)}`);
}
if (blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`multi-patch pre-approval mismatch: ${JSON.stringify(blocked)}`);
}
if (!fs.readFileSync(targetFile, "utf8").includes("before")) {
  throw new Error("multi-patch applied before approval");
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("multi-patch preview leaked content between separated hunks");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"approvedBy":"milestone-check","reason":"Approve bounded native OpenClaw workspace multi-patch apply."}' \
  "$CORE_URL/approvals/$APPROVAL_ID/approve" > "$APPROVE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=10" > "$LEDGER_FILE"

node - <<'EOF' "$APPROVE_FILE" "$STEP_FILE" "$HISTORY_FILE" "$LEDGER_FILE" "$TARGET_FILE" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const approve = readJson(2);
const step = readJson(3);
const history = readJson(4);
const ledger = readJson(5);
const targetFile = process.argv[6];
const unrelatedSecret = process.argv[7];
const raw = JSON.stringify({ approve, step, history, ledger });
const finalText = fs.readFileSync(targetFile, "utf8");

if (approve.approval?.status !== "approved") {
  throw new Error(`multi-patch approval mismatch: ${JSON.stringify(approve)}`);
}
if (
  step.ran !== true
  || step.task?.status !== "completed"
  || step.execution?.capabilityInvocations?.some((item) => item.capabilityId === "act.filesystem.write_text" && item.invoked === true) !== true
) {
  throw new Error(`multi-patch operator mismatch: ${JSON.stringify(step)}`);
}
if (!finalText.includes("after") || !finalText.includes("zeta") || finalText.includes("\nbefore\n") || finalText.includes("\nomega\n") || !finalText.includes(unrelatedSecret)) {
  throw new Error(`multi-patch did not produce expected final content: ${finalText}`);
}
if (history.summary?.byCapability?.["act.filesystem.write_text"] !== 1) {
  throw new Error(`multi-patch filesystem write history mismatch: ${JSON.stringify(history)}`);
}
if (ledger.summary?.write_text < 1 || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile)) {
  throw new Error(`multi-patch filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("multi-patch leaked content between separated hunks after execution");
}

console.log(JSON.stringify({
  openclawNativeWorkspaceMultiPatch: {
    task: step.task.id,
    approval: approve.approval.id,
    ledgerWrites: ledger.summary.write_text,
  },
}, null, 2));
EOF
