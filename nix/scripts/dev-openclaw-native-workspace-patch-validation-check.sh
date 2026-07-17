#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-patch-validation-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="scratch/native-validation-edit.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
UNRELATED_SECRET="NATIVE_WORKSPACE_PATCH_VALIDATION_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9550}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9551}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9552}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9553}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9554}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9555}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9556}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9557}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9620}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-patch-validation-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-patch-validation-check-events.jsonl}"

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
  rm -f "${VALID_DRAFT_FILE:-}" "${VALID_TASK_FILE:-}" "${OVERLAP_FILE:-}" "${MISSING_FILE:-}" "${PREVIEW_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

VALID_DRAFT_FILE="$(mktemp)"
VALID_TASK_FILE="$(mktemp)"
OVERLAP_FILE="$(mktemp)"
MISSING_FILE="$(mktemp)"
PREVIEW_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

VALID_EDITS='[{"search":"before","replacement":"after","occurrence":1},{"search":"omega","replacement":"zeta","occurrence":1}]'
OVERLAP_EDITS='[{"search":"before","replacement":"after","occurrence":1},{"search":"before","replacement":"again","occurrence":1}]'
MISSING_EDITS='[{"search":"not-present","replacement":"after","occurrence":1}]'
LONG_REPLACEMENT="$(node -e 'process.stdout.write(Array.from({ length: 80 }, (_, index) => `line-${index}`).join("\n"))')"
PREVIEW_EDITS="$(node - "$LONG_REPLACEMENT" <<'NODE'
const replacement = process.argv[2];
process.stdout.write(JSON.stringify([{ search: "before", replacement, occurrence: 1 }]));
NODE
)"

encode_json() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"
}

curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$(encode_json "$VALID_EDITS")&contextLines=0" > "$VALID_DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"edits\":$VALID_EDITS,\"contextLines\":0,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply-tasks" > "$VALID_TASK_FILE"

curl --silent --show-error --output "$OVERLAP_FILE" --write-out "%{http_code}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$(encode_json "$OVERLAP_EDITS")&contextLines=0" | grep -qx "400"
curl --silent --show-error --output "$MISSING_FILE" --write-out "%{http_code}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$(encode_json "$MISSING_EDITS")&contextLines=0" | grep -qx "400"
curl --silent --show-error --output "$PREVIEW_FILE" --write-out "%{http_code}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?relativePath=$TARGET_RELATIVE_PATH&edits=$(encode_json "$PREVIEW_EDITS")&contextLines=0" | grep -qx "400"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$VALID_DRAFT_FILE" "$VALID_TASK_FILE" "$OVERLAP_FILE" "$MISSING_FILE" "$PREVIEW_FILE" "$TASKS_FILE" "$TARGET_FILE" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const validDraft = readJson(2);
const validTask = readJson(3);
const overlap = readJson(4);
const missing = readJson(5);
const preview = readJson(6);
const tasks = readJson(7);
const targetFile = process.argv[8];
const unrelatedSecret = process.argv[9];
const raw = JSON.stringify({ validDraft, validTask, overlap, missing, preview, tasks });

if (
  !validDraft.ok
  || validDraft.validation?.ok !== true
  || validDraft.validation?.structuredPatch?.checks?.allMatchesFound !== true
  || validDraft.validation?.structuredPatch?.checks?.overlappingEditsRejected !== true
  || validDraft.validation?.structuredPatch?.checks?.appliesAgainstOriginalContent !== true
  || validDraft.validation?.preview?.truncated !== false
  || validDraft.edits?.length !== 2
  || !validDraft.edits?.every((edit) => Number.isInteger(edit.originalStart) && Number.isInteger(edit.originalEnd))
) {
  throw new Error(`valid patch validation mismatch: ${JSON.stringify(validDraft)}`);
}
if (
  !validTask.ok
  || validTask.task?.approval?.required !== true
  || validTask.target?.editCount !== 2
  || validTask.validation?.ok !== true
  || !validTask.task?.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text" && String(step.params?.content ?? "").startsWith("[redacted:"))
) {
  throw new Error(`valid patch task validation mismatch: ${JSON.stringify(validTask)}`);
}
if (overlap.ok !== false || !String(overlap.error).includes("overlaps")) {
  throw new Error(`overlap validation did not fail safely: ${JSON.stringify(overlap)}`);
}
if (missing.ok !== false || !String(missing.error).includes("not found")) {
  throw new Error(`missing match validation did not fail safely: ${JSON.stringify(missing)}`);
}
if (preview.ok !== false || !String(preview.error).includes("preview")) {
  throw new Error(`preview validation did not fail safely: ${JSON.stringify(preview)}`);
}
if (!fs.readFileSync(targetFile, "utf8").includes("before")) {
  throw new Error("validation check applied patch before approval");
}
if (!tasks.items?.every((task) => task.approval?.status !== "approved" && task.status !== "completed")) {
  throw new Error(`validation check unexpectedly executed a task: ${JSON.stringify(tasks)}`);
}
if (raw.includes(unrelatedSecret)) {
  throw new Error("patch validation leaked unrelated file content");
}

console.log(JSON.stringify({
  openclawNativeWorkspacePatchValidation: {
    validTask: validTask.task.id,
    rejectedOverlap: overlap.error,
    rejectedMissing: missing.error,
    rejectedPreview: preview.error,
  },
}, null, 2));
EOF
