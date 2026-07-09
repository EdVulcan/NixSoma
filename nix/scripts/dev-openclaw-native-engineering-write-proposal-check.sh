#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-write-proposal-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
OLD_SECRET="ENGINEERING_WRITE_PROPOSAL_OLD_SECRET_DO_NOT_LEAK"
NEW_SECRET="ENGINEERING_WRITE_PROPOSAL_NEW_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10280}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10281}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10282}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10283}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10284}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10285}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10286}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10287}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10288}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-write-proposal-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-write-proposal-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_WRITE_PROPOSAL"
cat > "$WORKSPACE_DIR/src/existing-write.txt" <<TXT
old write proposal line
$OLD_SECRET
TXT
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${CREATE_FILE:-}" \
    "${OVERWRITE_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${BAD_PATH_FILE:-}" \
    "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CREATE_FILE="$(mktemp)"
OVERWRITE_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
BAD_PATH_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

create_content="$(node - <<'EOF' "$NEW_SECRET"
const secret = process.argv[2];
process.stdout.write(encodeURIComponent(`new write proposal line\n${secret}\n`));
EOF
)"
overwrite_content="$(node - <<'EOF' "$NEW_SECRET"
const secret = process.argv[2];
process.stdout.write(encodeURIComponent(`replacement write proposal line\n${secret}\n`));
EOF
)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-proposal/draft?relativePath=src/new-write.txt&content=$create_content&overwrite=false&contextLines=1" > "$CREATE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-proposal/draft?relativePath=src/existing-write.txt&content=$overwrite_content&overwrite=true&contextLines=1" > "$OVERWRITE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-proposal/draft?relativePath=src/existing-write.txt&content=$overwrite_content&overwrite=false" > "$BLOCKED_FILE"
BAD_STATUS="$(curl --silent --output "$BAD_PATH_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-write-proposal/draft?relativePath=.cache/leak-write.txt&content=$create_content&overwrite=true")"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$CREATE_FILE" "$OVERWRITE_FILE" "$BLOCKED_FILE" "$BAD_PATH_FILE" "$BAD_STATUS" "$ADAPTER_FILE" "$WORKSPACE_DIR" "$OLD_SECRET" "$NEW_SECRET"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const create = readJson(2);
const overwrite = readJson(3);
const blocked = readJson(4);
const bad = readJson(5);
const badStatus = process.argv[6];
const adapter = readJson(7);
const workspaceDir = process.argv[8];
const oldSecret = process.argv[9];
const newSecret = process.argv[10];
const raw = JSON.stringify({ create, overwrite, blocked, bad, adapter });
const newPath = path.join(workspaceDir, "src", "new-write.txt");
const existingPath = path.join(workspaceDir, "src", "existing-write.txt");
const existingText = fs.readFileSync(existingPath, "utf8");

if (fs.existsSync(newPath)) {
  throw new Error(`write proposal must not create ${newPath}`);
}
if (!existingText.includes(oldSecret) || existingText.includes("replacement write proposal line")) {
  throw new Error("write proposal must not mutate the existing target");
}
if (
  !create.ok
  || create.registry !== "openclaw-native-engineering-write-proposal-v0"
  || create.mode !== "source-write-proposal-diff-metadata-preview-only"
  || create.capability?.id !== "act.openclaw.engineering_tool.write_proposal"
  || create.summary?.proposalKind !== "create_file_proposal"
  || create.summary?.createsTask !== false
  || create.summary?.createsApproval !== false
  || create.summary?.canMutate !== false
  || create.target?.exists !== false
  || create.target?.contentExposed !== false
  || create.target?.diffPreviewTextExposed !== false
  || create.diffPreview?.contentExposed !== false
  || !create.diffPreview?.lines?.every((line) => line.textRedacted === true)
  || create.governance?.canWriteFile !== false
  || create.governance?.canOverwriteFile !== false
  || create.governance?.requiresApprovalBeforeWrite !== true
  || create.bounds?.noFilesystemWrite !== true
  || create.auditEvidence?.operation !== "write_proposal"
) {
  throw new Error(`create write proposal mismatch: ${JSON.stringify(create)}`);
}
if (
  !overwrite.ok
  || overwrite.summary?.proposalKind !== "overwrite_file_proposal"
  || overwrite.target?.exists !== true
  || !overwrite.target?.existingSha256
  || !overwrite.target?.proposedSha256
  || overwrite.validation?.target?.overwriteAllowedByRequest !== true
  || overwrite.governance?.canMutate !== false
) {
  throw new Error(`overwrite write proposal mismatch: ${JSON.stringify(overwrite)}`);
}
if (
  blocked.ok !== false
  || blocked.blocked !== true
  || blocked.target?.blockedReason !== "target_exists_overwrite_false"
  || blocked.governance?.canMutate !== false
) {
  throw new Error(`blocked write proposal mismatch: ${JSON.stringify(blocked)}`);
}
if (badStatus !== "400" || bad.ok !== false || !String(bad.error ?? "").includes("hidden/generated/cache")) {
  throw new Error(`hidden/cache write proposal path should be rejected with 400: status=${badStatus} body=${JSON.stringify(bad)}`);
}
if (
  !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.write_proposal")
  || adapter.summary?.canBuildEngineeringWriteProposals !== true
) {
  throw new Error(`native adapter missing write proposal capability: ${JSON.stringify(adapter)}`);
}
if (raw.includes(oldSecret) || raw.includes(newSecret)) {
  throw new Error("write proposal response leaked old or new content secret");
}

console.log(JSON.stringify({
  openclawNativeEngineeringWriteProposal: {
    registry: create.registry,
    createKind: create.summary.proposalKind,
    overwriteKind: overwrite.summary.proposalKind,
    blockedReason: blocked.target.blockedReason,
    badPathStatus: badStatus,
    createdFileExists: fs.existsSync(newPath),
  },
}, null, 2));
EOF
