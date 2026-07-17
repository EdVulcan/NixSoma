#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-symbol-lookup-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9470}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9471}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9472}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9473}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9474}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9475}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9476}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9477}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9540}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-symbol-lookup-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-symbol-lookup-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$TOOLS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-symbol-lookup-secret-version",
  "private": true,
  "scripts": {
    "build": "echo SYMBOL_LOOKUP_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
export interface WebFetchToolInput {
  url: string;
}
export function createWebFetchTool(input: WebFetchToolInput) {
  const SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET = "must-not-leak";
  return { tool: "web-fetch", capability: "network", input, secret: SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET };
}
TS
cat > "$TOOLS_DIR/sessions-list-tool.ts" <<'TS'
export type SessionListToolInput = { limit: number };
export function createSessionListTool(input: SessionListToolInput) {
  const SYMBOL_LOOKUP_SESSION_BODY_SECRET = "must-not-leak";
  return { tool: "sessions-list", input, secret: SYMBOL_LOOKUP_SESSION_BODY_SECRET };
}
TS
cat > "$TOOLS_DIR/web-search.ts" <<'TS'
export class WebSearchTool {
  run() {
    const SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET = "must-not-leak";
    return SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET;
  }
}
TS

cleanup() {
  rm -f "${CAPABILITIES_FILE:-}" "${LOOKUP_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CAPABILITIES_FILE="$(mktemp)"
LOOKUP_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-symbol-lookup?scope=tools&query=Fetch&limit=10" > "$LOOKUP_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.openclaw.workspace_symbol_lookup","intent":"openclaw.workspace.symbol_lookup","params":{"scope":"tools","query":"Fetch","limit":10}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.openclaw.workspace_symbol_lookup&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$CAPABILITIES_FILE" "$LOOKUP_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const capabilities = readJson(2);
const lookup = readJson(3);
const invoke = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ capabilities, lookup, invoke, history, approvals });

const capability = capabilities.capabilities?.find((item) => item.id === "sense.openclaw.workspace_symbol_lookup");
if (
  !capability
  || capability.service !== "openclaw-core"
  || capability.risk !== "low"
  || capability.governance !== "audit_only"
  || capability.requiresApproval === true
  || !capability.intents?.includes("openclaw.workspace.symbol_lookup")
) {
  throw new Error(`workspace symbol lookup capability mismatch: ${JSON.stringify(capability)}`);
}
if (
  !lookup.ok
  || lookup.registry !== "openclaw-native-plugin-adapter-v0"
  || lookup.mode !== "workspace-symbol-lookup-executable-read-only"
  || lookup.capability?.id !== "sense.openclaw.workspace_symbol_lookup"
  || lookup.query?.text !== "Fetch"
  || lookup.summary?.matchedSymbols !== 2
  || lookup.summary?.filesScanned < 1
  || lookup.summary?.declarationsScanned < 2
  || lookup.summary?.canExecuteQuery !== true
  || lookup.summary?.exposesSourceFileContent !== false
  || lookup.summary?.exposesFunctionBodies !== false
  || lookup.summary?.canExecuteToolCode !== false
  || lookup.governance?.outputMode !== "declaration_symbols_only"
  || !lookup.matches?.some((match) => match.symbolName === "WebFetchToolInput" && match.declarationKind === "interface")
  || !lookup.matches?.some((match) => match.symbolName === "createWebFetchTool" && match.declarationKind === "function")
  || !lookup.matches?.every((match) => match.contentRead === true && match.contentExposed === false && match.declarationPreviewExposed === true)
) {
  throw new Error(`workspace symbol lookup mismatch: ${JSON.stringify(lookup)}`);
}
if (
  !invoke.ok
  || invoke.invoked !== true
  || invoke.blocked !== false
  || invoke.capability?.id !== "sense.openclaw.workspace_symbol_lookup"
  || invoke.policy?.decision !== "audit_only"
  || invoke.summary?.kind !== "openclaw.workspace_symbol_lookup"
  || invoke.summary?.matchedSymbols !== 2
  || invoke.summary?.canExecuteQuery !== true
  || invoke.summary?.exposesFunctionBodies !== false
  || invoke.summary?.canExecuteToolCode !== false
) {
  throw new Error(`workspace symbol lookup invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (
  history.summary?.byCapability?.["sense.openclaw.workspace_symbol_lookup"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "sense.openclaw.workspace_symbol_lookup" && entry.invoked === true && entry.blocked === false)
) {
  throw new Error(`workspace symbol lookup history mismatch: ${JSON.stringify(history)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`workspace symbol lookup must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "SYMBOL_LOOKUP_ROOT_SECRET_BUILD_BODY",
  "SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET",
  "SYMBOL_LOOKUP_SESSION_BODY_SECRET",
  "SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET",
  "0.0.0-symbol-lookup-secret-version",
  "must-not-leak",
]) {
  if (raw.includes(secret)) {
    throw new Error(`workspace symbol lookup must not expose function bodies, scripts, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeWorkspaceSymbolLookup: {
    capability: capability.id,
    matches: lookup.summary.matchedSymbols,
    declarations: lookup.summary.declarationsScanned,
    policy: invoke.policy.decision,
    history: history.summary.byCapability,
  },
}, null, 2));
EOF
