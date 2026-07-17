#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-sdk-source-content-review-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9300}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9301}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9302}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9303}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9304}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9305}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9306}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9307}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9370}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-sdk-source-content-review-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-sdk-source-content-review-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$PLUGIN_SDK_DIR/test"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-source-content-fixture",
  "private": true,
  "scripts": {
    "build": "echo SOURCE_CONTENT_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-source-content-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SOURCE_CONTENT_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-source-content-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/README.md" <<'MD'
SOURCE_CONTENT_SDK_SECRET_README_CONTENT must not appear in source content reviews.
MD
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
import type { PluginPolicy } from "../types/index";

export interface CapabilityContract {
  pluginId: string;
  capabilityId: string;
  policy: PluginPolicy;
}

export type CapabilityRisk = "low" | "high";

export function createCapabilityContract(): CapabilityContract {
  const SOURCE_CONTENT_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
  return {
    pluginId: SOURCE_CONTENT_SDK_SECRET_SOURCE_CONTENT,
    capabilityId: "capability.invoke",
    policy: { approval: true },
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export interface PluginPolicy {
  approval: boolean;
}
export type SOURCE_CONTENT_TYPES_SECRET_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/test/index.test.ts" <<'TS'
export const SOURCE_CONTENT_TEST_SECRET_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${REVIEW_FILE:-}" "${SUMMARY_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

REVIEW_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-source-content-review" > "$REVIEW_FILE"
curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-source-content-review/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$REVIEW_FILE" "$SUMMARY_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const review = readJson(2);
const summary = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const raw = JSON.stringify({ review, summary, history, approvals });

if (
  !review.ok
  || review.registry !== "openclaw-plugin-sdk-source-content-review-v0"
  || review.mode !== "content-review-derived-signals"
  || review.sourceRegistry !== "openclaw-plugin-sdk-source-review-scope-v0"
  || review.package?.name !== "@openclaw/plugin-sdk"
) {
  throw new Error(`source content review mismatch: ${JSON.stringify(review)}`);
}
if (
  review.summary?.contentRead < 3
  || review.summary?.exportStatements < 4
  || review.summary?.interfaceDeclarations < 1
  || review.summary?.typeDeclarations < 1
  || review.summary?.functionDeclarations < 1
  || review.summary?.canReadSourceFileContent !== true
  || review.summary?.exposesSourceFileContent !== false
  || review.summary?.canImportModule !== false
  || review.summary?.canExecutePluginCode !== false
  || review.summary?.canActivateRuntime !== false
  || review.summary?.createsTask !== false
  || review.summary?.createsApproval !== false
) {
  throw new Error(`source content review summary mismatch: ${JSON.stringify(review.summary)}`);
}
const sourceFile = review.files?.find((file) => file.relativePath === "src/index.ts");
if (
  !sourceFile
  || sourceFile.contentRead !== true
  || sourceFile.contentExposed !== false
  || sourceFile.signals?.exportStatements < 3
  || sourceFile.signals?.interfaceDeclarations < 1
  || sourceFile.signals?.typeDeclarations < 1
  || sourceFile.signals?.functionDeclarations < 1
) {
  throw new Error(`source file derived signals mismatch: ${JSON.stringify(sourceFile)}`);
}
if (
  review.governance?.mode !== "plugin_sdk_source_content_review_derived_signals"
  || review.governance?.canReadSourceFileContent !== true
  || review.governance?.exposesSourceFileContent !== false
  || review.governance?.canImportModule !== false
  || review.governance?.canExecutePluginCode !== false
  || review.governance?.canActivateRuntime !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
) {
  throw new Error(`source content review governance mismatch: ${JSON.stringify(review.governance)}`);
}
if (JSON.stringify(review.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`source content review summary endpoint should agree: ${JSON.stringify({ review: review.summary, summary: summary.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`source content review must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`source content review must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "SOURCE_CONTENT_ROOT_SECRET_BUILD_BODY",
  "SOURCE_CONTENT_SDK_SECRET_BUILD_BODY",
  "SOURCE_CONTENT_SDK_SECRET_README_CONTENT",
  "SOURCE_CONTENT_SDK_SECRET_SOURCE_CONTENT",
  "SOURCE_CONTENT_TYPES_SECRET_CONTENT",
  "SOURCE_CONTENT_TEST_SECRET_CONTENT",
  "999.0.0-source-content-secret-version",
  "0.0.0-source-content-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`source content review must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSdkSourceContentReview: {
    registry: review.registry,
    mode: review.mode,
    contentRead: review.summary.contentRead,
    exportStatements: review.summary.exportStatements,
    exposesSourceFileContent: review.summary.exposesSourceFileContent,
  },
}, null, 2));
EOF
