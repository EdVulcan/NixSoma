#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-sdk-source-review-scope-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9280}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9281}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9282}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9283}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9284}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9285}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9286}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9287}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9350}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-sdk-source-review-scope-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-sdk-source-review-scope-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src/nested" "$PLUGIN_SDK_DIR/types" "$PLUGIN_SDK_DIR/test"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-source-scope-fixture",
  "private": true,
  "scripts": {
    "build": "echo SOURCE_SCOPE_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$WORKSPACE_DIR/README.md" <<'MD'
SOURCE_SCOPE_ROOT_SECRET_README_CONTENT must not appear in source review scopes.
MD
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-source-scope-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing.js"
  },
  "scripts": {
    "build": "echo SOURCE_SCOPE_SDK_SECRET_BUILD_BODY",
    "test": "echo SOURCE_SCOPE_SDK_SECRET_TEST_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-source-scope-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/README.md" <<'MD'
SOURCE_SCOPE_SDK_SECRET_README_CONTENT must not appear in source review scopes.
MD
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SOURCE_SCOPE_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/src/nested/provider.ts" <<'TS'
export const SOURCE_SCOPE_NESTED_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export interface SourceScopeSecretType { value: "SOURCE_SCOPE_TYPES_SECRET_CONTENT"; }
TS
cat > "$PLUGIN_SDK_DIR/test/index.test.ts" <<'TS'
export const SOURCE_SCOPE_TEST_SECRET_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${SCOPE_FILE:-}" "${SUMMARY_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

SCOPE_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-source-review-scope" > "$SCOPE_FILE"
curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-source-review-scope/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$SCOPE_FILE" "$SUMMARY_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const scope = readJson(2);
const summary = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const raw = JSON.stringify({ scope, summary, history, approvals });

if (
  !scope.ok
  || scope.registry !== "openclaw-plugin-sdk-source-review-scope-v0"
  || scope.mode !== "scope-plan-only"
  || scope.sourceRegistry !== "openclaw-plugin-sdk-contract-review-v0"
  || scope.package?.name !== "@openclaw/plugin-sdk"
) {
  throw new Error(`source review scope mismatch: ${JSON.stringify(scope)}`);
}
const paths = new Set((scope.files ?? []).map((file) => file.relativePath));
for (const required of ["README.md", "package.json", "src/index.ts", "src/nested/provider.ts", "types/index.d.ts", "test/index.test.ts"]) {
  if (!paths.has(required)) {
    throw new Error(`source review scope missing ${required}: ${JSON.stringify([...paths])}`);
  }
}
if (!(scope.files ?? []).every((file) => file.contentRead === false && typeof file.sizeBytes === "number")) {
  throw new Error(`source review scope files should be metadata-only with sizes: ${JSON.stringify(scope.files)}`);
}
if (
  scope.summary?.canReadSourceFileContent !== false
  || scope.summary?.requiresApprovalBeforeContentRead !== true
  || scope.summary?.createsTask !== false
  || scope.summary?.createsApproval !== false
  || scope.summary?.canImportModule !== false
  || scope.summary?.canExecutePluginCode !== false
  || scope.summary?.canActivateRuntime !== false
  || scope.governance?.canReadSourceFileContent !== false
  || scope.governance?.createsTask !== false
  || scope.governance?.createsApproval !== false
) {
  throw new Error(`source review scope governance mismatch: ${JSON.stringify({ summary: scope.summary, governance: scope.governance })}`);
}
const contentGate = scope.gates?.find((gate) => gate.id === "content_read_approval_required");
if (!contentGate || contentGate.status !== "blocked" || contentGate.required !== true) {
  throw new Error(`content-read gate should remain blocked: ${JSON.stringify(contentGate)}`);
}
if (JSON.stringify(scope.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`source review scope summary endpoint should agree: ${JSON.stringify({ scope: scope.summary, summary: summary.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`source review scope must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`source review scope must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "SOURCE_SCOPE_ROOT_SECRET_BUILD_BODY",
  "SOURCE_SCOPE_ROOT_SECRET_README_CONTENT",
  "SOURCE_SCOPE_SDK_SECRET_BUILD_BODY",
  "SOURCE_SCOPE_SDK_SECRET_TEST_BODY",
  "SOURCE_SCOPE_SDK_SECRET_README_CONTENT",
  "SOURCE_SCOPE_SDK_SECRET_SOURCE_CONTENT",
  "SOURCE_SCOPE_NESTED_SECRET_SOURCE_CONTENT",
  "SOURCE_SCOPE_TYPES_SECRET_CONTENT",
  "SOURCE_SCOPE_TEST_SECRET_CONTENT",
  "999.0.0-source-scope-secret-version",
  "0.0.0-source-scope-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`source review scope must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSdkSourceReviewScope: {
    registry: scope.registry,
    mode: scope.mode,
    totalFiles: scope.summary.totalFiles,
    contentRead: scope.summary.canReadSourceFileContent,
    contentGate: contentGate.status,
  },
}, null, 2));
EOF
