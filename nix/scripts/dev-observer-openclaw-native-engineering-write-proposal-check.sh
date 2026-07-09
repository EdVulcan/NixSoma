#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-write-proposal-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
NEW_SECRET="OBSERVER_ENGINEERING_WRITE_PROPOSAL_NEW_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10300}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10301}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10302}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10303}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10304}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10305}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10306}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10307}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10308}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-write-proposal-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-write-proposal-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_WRITE_PROPOSAL"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${EVIDENCE_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"

content="$(node - <<'EOF' "$NEW_SECRET"
const secret = process.argv[2];
process.stdout.write(encodeURIComponent(`observer write proposal line\n${secret}\n`));
EOF
)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-proposal/draft?relativePath=src/observer-write.txt&content=$content&overwrite=false&contextLines=1" > "$EVIDENCE_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$EVIDENCE_FILE" "$WORKSPACE_DIR" "$NEW_SECRET"
const fs = require("node:fs");
const path = require("node:path");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const evidence = readJson(4);
const workspaceDir = process.argv[5];
const newSecret = process.argv[6];
const raw = JSON.stringify({ evidence });
const newPath = path.join(workspaceDir, "src", "observer-write.txt");

for (const token of [
  "OpenClaw Engineering Write Proposal",
  "engineering-write-proposal-registry",
  "engineering-write-proposal-kind",
  "engineering-write-proposal-target",
  "engineering-write-proposal-bytes",
  "engineering-write-proposal-mutation",
  "engineering-write-proposal-mode",
  "engineering-write-proposal-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering write proposal token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-write-proposal/draft",
  "refreshEngineeringWriteProposal",
  "renderEngineeringWriteProposal",
  "Native engineering write proposal",
  "act.openclaw.engineering_tool.write_proposal",
  "source-write-proposal-diff-metadata-preview-only",
  "redacted diff metadata",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering write proposal token: ${token}`);
  }
}
if (fs.existsSync(newPath)) {
  throw new Error(`Observer write proposal must not create ${newPath}`);
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-write-proposal-v0"
  || evidence.summary?.proposalKind !== "create_file_proposal"
  || evidence.summary?.createsTask !== false
  || evidence.summary?.createsApproval !== false
  || evidence.target?.contentExposed !== false
  || evidence.target?.diffPreviewTextExposed !== false
  || evidence.diffPreview?.contentExposed !== false
  || evidence.governance?.canWriteFile !== false
  || evidence.governance?.requiresApprovalBeforeWrite !== true
  || evidence.bounds?.noFilesystemWrite !== true
) {
  throw new Error(`Observer write proposal evidence mismatch: ${JSON.stringify(evidence)}`);
}
if (raw.includes(newSecret)) {
  throw new Error("Observer write proposal response leaked proposed content secret");
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringWriteProposal: {
    html: "visible",
    client: "visible",
    registry: evidence.registry,
    kind: evidence.summary.proposalKind,
    createdFileExists: fs.existsSync(newPath),
  },
}, null, 2));
EOF
