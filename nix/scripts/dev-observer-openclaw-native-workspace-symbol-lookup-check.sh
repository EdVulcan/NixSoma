#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-workspace-symbol-lookup-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9480}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9481}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9482}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9483}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9484}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9485}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9486}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9487}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9550}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-workspace-symbol-lookup-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-native-workspace-symbol-lookup-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$TOOLS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-symbol-lookup-secret-version",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_SYMBOL_LOOKUP_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
export interface ObserverWebFetchToolInput {
  url: string;
}
export function createObserverWebFetchTool(input: ObserverWebFetchToolInput) {
  const OBSERVER_SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET = "must-not-leak";
  return { tool: "web-fetch", capability: "network", input, secret: OBSERVER_SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET };
}
TS
cat > "$TOOLS_DIR/web-search.ts" <<'TS'
export class ObserverWebSearchTool {
  run() {
    const OBSERVER_SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET = "must-not-leak";
    return OBSERVER_SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET;
  }
}
TS
cat > "$TOOLS_DIR/sessions-list-tool.ts" <<'TS'
export type ObserverSessionListToolInput = { limit: number };
export function createObserverSessionListTool(input: ObserverSessionListToolInput) {
  const OBSERVER_SYMBOL_LOOKUP_SESSION_BODY_SECRET = "must-not-leak";
  return { tool: "sessions-list", input, secret: OBSERVER_SYMBOL_LOOKUP_SESSION_BODY_SECRET };
}
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${LOOKUP_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
LOOKUP_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-symbol-lookup?scope=tools&query=ObserverWebFetch&limit=10" > "$LOOKUP_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.openclaw.workspace_symbol_lookup","intent":"openclaw.workspace.symbol_lookup","params":{"scope":"tools","query":"ObserverWebFetch","limit":10}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.openclaw.workspace_symbol_lookup&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$LOOKUP_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const lookup = readJson(4);
const invoke = readJson(5);
const history = readJson(6);
const approvals = readJson(7);
const raw = JSON.stringify({ html, client, lookup, invoke, history, approvals });

for (const token of [
  "OpenClaw Symbol Lookup",
  "symbol-lookup-registry",
  "symbol-lookup-matches",
  "symbol-lookup-files",
  "symbol-lookup-execution",
  "symbol-lookup-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/capabilities/invoke",
  "refreshSymbolLookup",
  "renderSymbolLookup",
  "sense.openclaw.workspace_symbol_lookup",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
const symbolRefreshStart = client.indexOf("async function refreshSymbolLookup()");
const symbolRefreshEnd = client.indexOf("async function refreshEditTargetSelection()", symbolRefreshStart);
const symbolRefresh = client.slice(symbolRefreshStart, symbolRefreshEnd);
if (
  symbolRefreshStart < 0
  || symbolRefreshEnd < 0
  || !symbolRefresh.includes("/capabilities/invoke")
  || !symbolRefresh.includes('capabilityId: "sense.openclaw.workspace_symbol_lookup"')
  || symbolRefresh.includes("/plugins/native-adapter/workspace-symbol-lookup")
) {
  throw new Error("Observer symbol lookup refresh must use the common capability runtime.");
}
if (
  !lookup.ok
  || lookup.mode !== "workspace-symbol-lookup-executable-read-only"
  || lookup.capability?.id !== "sense.openclaw.workspace_symbol_lookup"
  || lookup.query?.text !== "ObserverWebFetch"
  || lookup.summary?.matchedSymbols !== 2
  || lookup.summary?.canExecuteQuery !== true
  || lookup.summary?.exposesSourceFileContent !== false
  || lookup.summary?.exposesFunctionBodies !== false
  || lookup.governance?.outputMode !== "declaration_symbols_only"
  || !lookup.matches?.some((match) => match.symbolName === "ObserverWebFetchToolInput")
  || !lookup.matches?.some((match) => match.symbolName === "createObserverWebFetchTool")
) {
  throw new Error(`Observer workspace symbol lookup mismatch: ${JSON.stringify(lookup)}`);
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
) {
  throw new Error(`Observer workspace symbol lookup invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (history.summary?.byCapability?.["sense.openclaw.workspace_symbol_lookup"] !== 1) {
  throw new Error(`Observer workspace symbol lookup history mismatch: ${JSON.stringify(history)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer workspace symbol lookup must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_SYMBOL_LOOKUP_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_SYMBOL_LOOKUP_WEB_FETCH_BODY_SECRET",
  "OBSERVER_SYMBOL_LOOKUP_WEB_SEARCH_BODY_SECRET",
  "OBSERVER_SYMBOL_LOOKUP_SESSION_BODY_SECRET",
  "0.0.0-observer-symbol-lookup-secret-version",
  "must-not-leak",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer workspace symbol lookup must not expose function bodies, scripts, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeWorkspaceSymbolLookup: {
    html: "visible",
    matches: lookup.summary.matchedSymbols,
    policy: invoke.policy.decision,
    history: history.summary.byCapability,
  },
}, null, 2));
EOF
