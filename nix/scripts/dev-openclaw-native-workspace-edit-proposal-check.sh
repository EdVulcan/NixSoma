#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-edit-proposal-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/native-edit-proposal.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
UNRELATED_SECRET="NATIVE_WORKSPACE_EDIT_PROPOSAL_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9590}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9591}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9592}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9593}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9594}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9595}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9596}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9597}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9660}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-edit-proposal-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-edit-proposal-check-events.jsonl}"

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
  rm -f "${DRAFT_FILE:-}" "${TASK_FILE:-}" "${APPROVAL_ID_FILE:-}" "${APPROVE_FILE:-}" "${STEP_FILE:-}" "${HISTORY_FILE:-}" "${LEDGER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

DRAFT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVAL_ID_FILE="$(mktemp)"
APPROVE_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
LEDGER_FILE="$(mktemp)"

EDITS_JSON='[{"kind":"replace_text","search":"before","replacement":"after","occurrence":1},{"kind":"replace_lines","startLine":5,"endLine":5,"replacement":"zeta\n"}]'
PROPOSAL_JSON='{"id":"proposal-check","title":"Refine scratch fixture","rationale":"Validate proposal envelope metadata without exposing patched file content.","targetContext":{"symbol":"scratchFixture","fileRole":"milestone fixture"}}'
EDITS_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EDITS_JSON")"
PROPOSAL_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$PROPOSAL_JSON")"

curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$EDITS_ENCODED&proposal=$PROPOSAL_ENCODED&contextLines=0" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"edits\":$EDITS_JSON,\"proposal\":$PROPOSAL_JSON,\"contextLines\":0,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply-tasks" > "$TASK_FILE"

node - <<'EOF' "$DRAFT_FILE" "$TASK_FILE" "$APPROVAL_ID_FILE" "$TARGET_FILE" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const draft = readJson(2);
const task = readJson(3);
const approvalIdFile = process.argv[4];
const targetFile = process.argv[5];
const unrelatedSecret = process.argv[6];
const raw = JSON.stringify({ draft, task });

if (
  !draft.ok
  || draft.proposal?.registry !== "openclaw-native-workspace-edit-proposal-v0"
  || draft.proposal?.title !== "Refine scratch fixture"
  || draft.proposal?.targetContext?.symbol !== "scratchFixture"
  || draft.proposal?.dryRun?.ok !== true
  || draft.proposal?.dryRun?.contentExposed !== false
  || draft.proposal?.dryRun?.editKinds?.includes("replace_lines") !== true
  || draft.proposal?.governance?.approvalRequired !== true
  || draft.proposal?.governance?.usesFilesystemWriteCapability !== true
) {
  throw new Error(`proposal draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !task.ok
  || task.proposal?.registry !== "openclaw-native-workspace-edit-proposal-v0"
  || task.proposal?.dryRun?.contentExposed !== false
  || task.task?.approval?.required !== true
  || !task.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
) {
  throw new Error(`proposal task mismatch: ${JSON.stringify(task)}`);
}
if (!fs.readFileSync(targetFile, "utf8").includes("before")) {
  throw new Error("proposal task applied before approval");
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("proposal envelope leaked unrelated file content");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"approvedBy":"milestone-check","reason":"Approve proposal-envelope workspace edit."}' \
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

if (approve.approval?.status !== "approved" || step.ran !== true || step.task?.status !== "completed") {
  throw new Error(`proposal execution mismatch: ${JSON.stringify({ approve, step })}`);
}
if (!finalText.includes("after") || !finalText.includes("zeta\n") || finalText.includes("\nbefore\n") || finalText.includes("\nomega\n") || !finalText.includes(unrelatedSecret)) {
  throw new Error(`proposal edit did not produce expected final content: ${finalText}`);
}
if (history.summary?.byCapability?.["act.filesystem.write_text"] !== 1) {
  throw new Error(`proposal history mismatch: ${JSON.stringify(history)}`);
}
if (ledger.summary?.write_text < 1 || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile)) {
  throw new Error(`proposal ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("proposal public execution responses leaked unrelated file content");
}

console.log(JSON.stringify({
  openclawNativeWorkspaceEditProposal: {
    task: step.task.id,
    approval: approve.approval.id,
    ledgerWrites: ledger.summary.write_text,
  },
}, null, 2));
EOF
