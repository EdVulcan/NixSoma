#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-lsp-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10240}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10241}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10242}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10243}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10244}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10245}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10246}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10247}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10248}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-lsp-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-lsp-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_LSP_EVIDENCE"
mkdir -p "$WORKSPACE_DIR/scripts" "$WORKSPACE_DIR/python"
cat > "$WORKSPACE_DIR/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext"
  }
}
JSON
cat > "$WORKSPACE_DIR/scripts/tool.mjs" <<'JS'
export const lspScriptMarker = "OpenClaw LSP evidence javascript";
JS
cat > "$WORKSPACE_DIR/pyproject.toml" <<'TOML'
[project]
name = "openclaw-lsp-evidence-fixture"
TOML
cat > "$WORKSPACE_DIR/python/agent.py" <<'PY'
def lsp_agent_marker():
    return "OpenClaw LSP evidence python"
PY
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${CHECK_FILE:-}" \
    "${POSITION_FILE:-}" \
    "${BAD_PATH_FILE:-}" \
    "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CHECK_FILE="$(mktemp)"
POSITION_FILE="$(mktemp)"
BAD_PATH_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=check&language=typescript&limit=200" > "$CHECK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=definition&language=typescript&relativePath=src/app.ts&line=2&character=14&limit=200" > "$POSITION_FILE"
BAD_STATUS="$(curl --silent --output "$BAD_PATH_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=hover&language=typescript&relativePath=.cache/leak.ts")"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$CHECK_FILE" "$POSITION_FILE" "$BAD_PATH_FILE" "$BAD_STATUS" "$ADAPTER_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const check = readJson(2);
const position = readJson(3);
const bad = readJson(4);
const badStatus = process.argv[5];
const adapter = readJson(6);
const raw = JSON.stringify({ check, position, bad, adapter });

if (
  !check.ok
  || check.registry !== "openclaw-native-engineering-lsp-evidence-v0"
  || check.mode !== "lsp-contract-and-availability-evidence-only"
  || check.capability?.id !== "sense.openclaw.engineering_tool.lsp_evidence"
  || check.summary?.selectedAction !== "check"
  || !check.summary?.detectedLanguages?.includes("typescript")
  || !check.summary?.detectedLanguages?.includes("javascript")
  || !check.summary?.detectedLanguages?.includes("python")
  || check.serverReadiness?.status !== "not_checked"
  || check.serverReadiness?.wouldRunVersionCommand !== false
  || check.serverReadiness?.canStartServer !== false
  || check.serverReadiness?.canSendJsonRpcRequest !== false
  || check.governance?.canReadWorkspaceMetadata !== true
  || check.governance?.canReadSourceFileContent !== false
  || check.governance?.canCheckServerBinary !== false
  || check.governance?.canStartLspServer !== false
  || check.governance?.canOpenFileInServer !== false
  || check.governance?.canSendJsonRpcRequest !== false
  || check.governance?.canExecuteCommand !== false
  || check.governance?.canMutate !== false
  || check.governance?.canCreateTask !== false
  || check.governance?.canCreateApproval !== false
  || check.governance?.canCallProvider !== false
  || check.bounds?.workspaceRootConstrained !== true
  || check.bounds?.noSourceFileContentRead !== true
  || check.bounds?.noServerBinaryCheck !== true
  || check.bounds?.noLspServerStart !== true
  || check.bounds?.noJsonRpcRequest !== true
  || check.bounds?.noCommandExecution !== true
  || check.auditEvidence?.operation !== "lsp_evidence"
) {
  throw new Error(`LSP check evidence mismatch: ${JSON.stringify(check)}`);
}
if (
  !position.ok
  || position.summary?.selectedAction !== "definition"
  || position.requestedPosition?.required !== true
  || position.requestedPosition?.valid !== true
  || position.requestedPosition?.relativePath !== "src/app.ts"
  || position.requestedPosition?.contentRead !== false
  || position.summary?.canResolveSymbolNow !== false
) {
  throw new Error(`LSP position evidence mismatch: ${JSON.stringify(position)}`);
}
if (badStatus !== "400" || bad.ok !== false || !String(bad.error ?? "").includes("hidden/generated/cache")) {
  throw new Error(`LSP skipped-directory path should be rejected with 400: status=${badStatus} body=${JSON.stringify(bad)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.lsp_evidence")
  || adapter.summary?.canReadEngineeringLspEvidence !== true
) {
  throw new Error(`native adapter missing LSP evidence capability: ${JSON.stringify(adapter)}`);
}
for (const token of [
  "no server binary version check",
  "no LSP server process start",
  "no file content read into LSP",
  "no definition/references/hover JSON-RPC request",
  "ENGINEERING_LSP_EVIDENCE_NODE_MODULES_SECRET",
  "ENGINEERING_LSP_EVIDENCE_CACHE_SECRET",
  "ENGINEERING_LSP_EVIDENCE_GENERATED_SECRET",
]) {
  const shouldExist = token.startsWith("no ");
  const exists = raw.includes(token);
  if (shouldExist && !exists) {
    throw new Error(`LSP evidence missing boundary token: ${token}`);
  }
  if (!shouldExist && exists) {
    throw new Error(`LSP evidence leaked skipped fixture secret: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringLspEvidence: {
    registry: check.registry,
    languages: check.summary.detectedLanguages,
    serverStatus: check.serverReadiness.status,
    badPathStatus: badStatus,
    jsonRpcSent: check.summary.jsonRpcSent,
  },
}, null, 2));
EOF
