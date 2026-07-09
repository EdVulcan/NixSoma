#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-acpx-codex-bridge-compatibility-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10220}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10221}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10222}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10223}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10224}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10225}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10226}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10227}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10228}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-acpx-codex-bridge-compatibility-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-acpx-codex-bridge-compatibility-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

state_has_acpx_records() {
  node - <<'EOF' "$OPENCLAW_CORE_STATE_FILE"
const fs = require("node:fs");
const file = process.argv[2];
if (!fs.existsSync(file)) {
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));
process.exit((data.acpxBridgeSessionRecords ?? []).length === 2 ? 0 : 1);
EOF
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${INITIAL_FILE:-}" \
    "${FIRST_FILE:-}" \
    "${SECOND_FILE:-}" \
    "${OVERWRITE_FILE:-}" \
    "${BEFORE_RESTART_FILE:-}" \
    "${AFTER_RESTART_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh" >/dev/null

INITIAL_FILE="$(mktemp)"
FIRST_FILE="$(mktemp)"
SECOND_FILE="$(mktemp)"
OVERWRITE_FILE="$(mktemp)"
BEFORE_RESTART_FILE="$(mktemp)"
AFTER_RESTART_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:missing" > "$INITIAL_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:one","agentId":"codex","recordId":"record-one","metadata":{"purpose":"first","authToken":"ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK"},"confirm":true}' > "$FIRST_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:two","agentId":"codex","recordId":"record-two","metadata":{"purpose":"second"},"confirm":true}' > "$SECOND_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:one","agentId":"codex","recordId":"record-one-updated","metadata":{"purpose":"updated","password":"ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK"},"confirm":true}' > "$OVERWRITE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:one" > "$BEFORE_RESTART_FILE"

node - <<'EOF' "$INITIAL_FILE" "$FIRST_FILE" "$SECOND_FILE" "$OVERWRITE_FILE" "$BEFORE_RESTART_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const initial = readJson(2);
const first = readJson(3);
const second = readJson(4);
const overwrite = readJson(5);
const before = readJson(6);
const raw = JSON.stringify({ initial, first, second, overwrite, before });

if (
  !initial.ok
  || initial.registry !== "openclaw-native-acpx-codex-bridge-compatibility-v0"
  || initial.compatibility?.posixCommand !== "npx"
  || initial.compatibility?.windowsCommandLesson !== "npx.cmd"
  || initial.authIsolation?.authJsonRead !== false
  || initial.authIsolation?.credentialValueRead !== false
  || initial.governance?.canReadCredentialValue !== false
  || initial.governance?.canCopyAuthMaterial !== false
  || initial.governance?.canWriteWrapper !== false
  || initial.governance?.canSpawnCodexAcp !== false
  || initial.persistence?.missingSessionReturnsNull !== true
) {
  throw new Error(`initial ACPX/Codex bridge compatibility mismatch: ${JSON.stringify(initial)}`);
}
if (!first.ok || first.summary?.created !== true || first.session?.revision !== 1) {
  throw new Error(`first ACPX/Codex session record should be created: ${JSON.stringify(first)}`);
}
if (!second.ok || second.summary?.created !== true || second.session?.sessionKey !== "agent:codex:two") {
  throw new Error(`second ACPX/Codex session record should be independent: ${JSON.stringify(second)}`);
}
if (
  !overwrite.ok
  || overwrite.summary?.overwritten !== true
  || overwrite.session?.revision !== 2
  || overwrite.session?.acpxRecordId !== "record-one-updated"
  || overwrite.session?.metadata?.password !== "[redacted-key]"
) {
  throw new Error(`ACPX/Codex session overwrite mismatch: ${JSON.stringify(overwrite)}`);
}
if (
  before.persistence?.totalRecords !== 2
  || before.persistence?.selectedRecord?.acpxRecordId !== "record-one-updated"
  || before.persistence?.selectedRecord?.revision !== 2
  || before.persistence?.supportsIndependentSessions !== true
  || before.persistence?.supportsOverwrite !== true
) {
  throw new Error(`ACPX/Codex bridge persistence readback mismatch: ${JSON.stringify(before)}`);
}
for (const secret of [
  "ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK",
  "ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK",
]) {
  if (raw.includes(secret)) {
    throw new Error(`ACPX/Codex bridge leaked secret-like metadata: ${secret}`);
  }
}
EOF

openclaw_wait_until 5 0.05 state_has_acpx_records
"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:one" > "$AFTER_RESTART_FILE"

node - <<'EOF' "$AFTER_RESTART_FILE"
const fs = require("node:fs");
const after = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (
  after.persistence?.totalRecords !== 2
  || after.persistence?.selectedRecord?.sessionKey !== "agent:codex:one"
  || after.persistence?.selectedRecord?.acpxRecordId !== "record-one-updated"
  || after.persistence?.selectedRecord?.revision !== 2
  || after.governance?.canReadCredentialValue !== false
  || after.governance?.canWriteWrapper !== false
  || after.governance?.canSpawnCodexAcp !== false
) {
  throw new Error(`ACPX/Codex persisted session records should restore after restart: ${JSON.stringify(after)}`);
}

console.log(JSON.stringify({
  openclawNativeAcpxCodexBridgeCompatibility: {
    registry: after.registry,
    totalRecords: after.persistence.totalRecords,
    selectedSession: after.persistence.selectedRecord.sessionKey,
    revision: after.persistence.selectedRecord.revision,
    credentialValueRead: after.governance.canReadCredentialValue,
    wrapperWritten: after.governance.canWriteWrapper,
    processSpawned: after.governance.canSpawnCodexAcp,
  },
}, null, 2));
EOF
