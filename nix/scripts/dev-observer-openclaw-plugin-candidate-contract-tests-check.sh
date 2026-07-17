#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-candidate-contract-tests-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9970}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9971}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9972}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9973}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9974}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9975}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9976}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9977}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9999}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-candidate-contract-tests-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-candidate-contract-tests-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$SDK_SOURCE_DIR" \
  "$EXTENSIONS_DIR/web" \
  "$EXTENSIONS_DIR/memory"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ObserverPluginCandidateContractTest {
  capabilityId: string;
  category: string;
}
export function createObserverPluginCandidateContractTest(): ObserverPluginCandidateContractTest {
  return {
    capabilityId: "plan.openclaw.plugin_capability",
    category: "search_and_web",
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverPluginCandidateContractTestManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverPluginCandidateContractTestSource {
  capabilityId: string;
  approvalRequired: boolean;
}
export function defineObserverPluginCandidateContractTestSource(): ObserverPluginCandidateContractTestSource {
  return {
    capabilityId: "plan.openclaw.plugin_capability",
    approvalRequired: true,
  };
}
TS

cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["OBSERVER_PLUGIN_CANDIDATE_CONTRACT_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["OBSERVER_PLUGIN_CANDIDATE_CONTRACT_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${REPORT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
REPORT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-candidate-contract-tests?category=search_and_web&limit=4" > "$REPORT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$REPORT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const report = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const tasks = readJson(7);
const raw = JSON.stringify({ html, client, report, history, approvals, tasks });

for (const token of [
  "OpenClaw Plugin Candidate Contract Tests",
  "plugin-candidate-contract-tests-registry",
  "plugin-candidate-contract-tests-category",
  "plugin-candidate-contract-tests-required",
  "plugin-candidate-contract-tests-contracts",
  "plugin-candidate-contract-tests-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/plugin-candidate-contract-tests",
  "refreshPluginCandidateContractTests",
  "renderPluginCandidateContractTests",
  "openclaw-plugin-candidate-contract-tests-v0",
  "Candidate-native adapter contract tests",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !report.ok
  || report.registry !== "openclaw-plugin-candidate-contract-tests-v0"
  || report.summary?.candidateCount !== 1
  || report.summary?.requiredTests !== report.summary?.passedRequired
  || report.summary?.nativeAdapterContractTestsReady !== true
  || report.summary?.runtimeAdapterImplemented !== false
  || report.summary?.requiresApproval !== 1
  || report.governance?.selectedCategory !== "search_and_web"
  || report.governance?.canImportModule !== false
  || report.governance?.canExecutePluginCode !== false
  || report.governance?.canActivateRuntime !== false
  || report.governance?.createsTask !== false
  || report.governance?.createsApproval !== false
) {
  throw new Error(`Observer plugin candidate contract tests response mismatch: ${JSON.stringify(report)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer plugin candidate contract tests must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer plugin candidate contract tests must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`Observer plugin candidate contract tests must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "OBSERVER_PLUGIN_CANDIDATE_CONTRACT_SECRET_ENDPOINT_TOKEN",
  "OBSERVER_PLUGIN_CANDIDATE_CONTRACT_SECRET_AUTH_ENV",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer plugin candidate contract tests leaked manifest body, auth env var name, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginCandidateContractTests: {
    html: "visible",
    registry: report.registry,
    category: report.summary.selectedCategory,
    required: `${report.summary.passedRequired}/${report.summary.requiredTests}`,
    contracts: report.summary.adapterContractCount,
  },
}, null, 2));
EOF
