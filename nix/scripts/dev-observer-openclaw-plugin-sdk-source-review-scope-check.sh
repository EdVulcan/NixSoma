#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-sdk-source-review-scope-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9290}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9291}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9292}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9293}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9294}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9295}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9296}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9297}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9360}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-sdk-source-review-scope-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-plugin-sdk-source-review-scope-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$PLUGIN_SDK_DIR/test"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-source-scope-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_SOURCE_SCOPE_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$WORKSPACE_DIR/README.md" <<'MD'
OBSERVER_SOURCE_SCOPE_ROOT_SECRET_README_CONTENT must not appear in source review scopes.
MD
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-observer-source-scope-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_SOURCE_SCOPE_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-source-scope-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/README.md" <<'MD'
OBSERVER_SOURCE_SCOPE_SDK_SECRET_README_CONTENT must not appear in source review scopes.
MD
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_SOURCE_SCOPE_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export interface ObserverSourceScopeSecretType { value: "OBSERVER_SOURCE_SCOPE_TYPES_SECRET_CONTENT"; }
TS
cat > "$PLUGIN_SDK_DIR/test/index.test.ts" <<'TS'
export const OBSERVER_SOURCE_SCOPE_TEST_SECRET_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${SCOPE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
SCOPE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-source-review-scope" > "$SCOPE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$SCOPE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const scope = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, scope, history, approvals });

for (const token of [
  "OpenClaw Plugin SDK Source Review Scope",
  "plugin-sdk-source-scope-registry",
  "plugin-sdk-source-scope-total",
  "plugin-sdk-source-scope-content",
  "plugin-sdk-source-scope-approval",
  "plugin-sdk-source-scope-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/workspaces/openclaw-plugin-sdk-source-review-scope",
  "refreshPluginSdkSourceReviewScope",
  "renderPluginSdkSourceReviewScope",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !scope.ok
  || scope.registry !== "openclaw-plugin-sdk-source-review-scope-v0"
  || scope.summary?.canReadSourceFileContent !== false
  || scope.summary?.requiresApprovalBeforeContentRead !== true
  || scope.governance?.createsTask !== false
  || scope.governance?.createsApproval !== false
) {
  throw new Error(`Observer source review scope response mismatch: ${JSON.stringify(scope)}`);
}
if (!(scope.files ?? []).some((file) => file.relativePath === "src/index.ts" && file.contentRead === false)) {
  throw new Error(`Observer source review scope should show metadata-only source candidates: ${JSON.stringify(scope.files)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer source review scope must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer source review scope must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_SOURCE_SCOPE_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_SOURCE_SCOPE_ROOT_SECRET_README_CONTENT",
  "OBSERVER_SOURCE_SCOPE_SDK_SECRET_BUILD_BODY",
  "OBSERVER_SOURCE_SCOPE_SDK_SECRET_README_CONTENT",
  "OBSERVER_SOURCE_SCOPE_SDK_SECRET_SOURCE_CONTENT",
  "OBSERVER_SOURCE_SCOPE_TYPES_SECRET_CONTENT",
  "OBSERVER_SOURCE_SCOPE_TEST_SECRET_CONTENT",
  "999.0.0-observer-source-scope-secret-version",
  "0.0.0-observer-source-scope-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer source review scope must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginSdkSourceReviewScope: {
    html: "visible",
    registry: scope.registry,
    totalFiles: scope.summary.totalFiles,
    contentRead: scope.summary.canReadSourceFileContent,
    approvalBeforeContentRead: scope.summary.requiresApprovalBeforeContentRead,
  },
}, null, 2));
EOF
