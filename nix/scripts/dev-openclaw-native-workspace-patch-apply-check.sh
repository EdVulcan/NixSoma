#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-patch-apply-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/native-edit.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
UNRELATED_SECRET="NATIVE_WORKSPACE_PATCH_UNRELATED_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9510}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9511}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9512}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9513}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9514}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9515}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9516}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9517}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9580}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-patch-apply-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-patch-apply-check-events.jsonl}"

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
omega context
$UNRELATED_SECRET
EOF

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

curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&search=before&replacement=after&contextLines=1" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"search\":\"before\",\"replacement\":\"after\",\"occurrence\":1,\"contextLines\":1,\"confirm\":true}" \
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
  || draft.registry !== "openclaw-native-workspace-patch-apply-draft-v0"
  || draft.capability?.id !== "act.openclaw.workspace_patch_apply"
  || draft.capability?.approvalRequired !== true
  || draft.target?.contentExposed !== false
  || draft.target?.diffPreviewExposed !== true
  || draft.diffPreview?.format !== "bounded-line-diff-v0"
  || !draft.diffPreview?.lines?.some((line) => line.type === "remove" && line.text === "before")
  || !draft.diffPreview?.lines?.some((line) => line.type === "add" && line.text === "after")
  || draft.draft?.governance?.usesFilesystemWriteCapability !== true
) {
  throw new Error(`draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-workspace-patch-apply-task-v0"
  || task.mode !== "diff-preview-approval-gated"
  || task.capability?.id !== "act.openclaw.workspace_patch_apply"
  || task.approval?.status !== "pending"
  || task.task?.approval?.required !== true
  || task.task?.plan?.capabilitySummary?.ids?.includes("act.filesystem.write_text") !== true
  || !task.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
  || task.governance?.createsTask !== true
  || task.governance?.createsApproval !== true
  || task.governance?.usesFilesystemWriteCapability !== true
  || task.governance?.exposesFullContent !== false
  || task.governance?.exposesDiffPreview !== true
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
if (!fs.readFileSync(targetFile, "utf8").includes("before")) {
  throw new Error("workspace patch applied before approval");
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("patch preview leaked unrelated file content outside the bounded diff");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"approvedBy":"milestone-check","reason":"Approve bounded native OpenClaw workspace patch apply."}' \
  "$CORE_URL/approvals/$APPROVAL_ID/approve" > "$APPROVE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=10" > "$LEDGER_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$APPROVE_FILE" "$STEP_FILE" "$HISTORY_FILE" "$LEDGER_FILE" "$TASKS_FILE" "$TARGET_FILE" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const approve = readJson(2);
const step = readJson(3);
const history = readJson(4);
const ledger = readJson(5);
const tasks = readJson(6);
const targetFile = process.argv[7];
const unrelatedSecret = process.argv[8];
const raw = JSON.stringify({ approve, step, history, ledger, tasks });
const finalText = fs.readFileSync(targetFile, "utf8");

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
if (!finalText.includes("after") || finalText.includes("\nbefore\n") || !finalText.includes(unrelatedSecret)) {
  throw new Error(`approved workspace patch did not produce expected final content: ${finalText}`);
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
if (raw.includes(unrelatedSecret)) {
  throw new Error("patch apply leaked unrelated file content through public responses");
}

console.log(JSON.stringify({
  openclawNativeWorkspacePatchApply: {
    task: step.task.id,
    approval: approve.approval.id,
    path: targetFile,
    capabilityHistory: history.summary.byCapability,
    ledgerWrites: ledger.summary.write_text,
  },
}, null, 2));
EOF
