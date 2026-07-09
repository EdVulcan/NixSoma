#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-lsp-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
FAKE_BIN_DIR="$FIXTURE_DIR/bin"

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
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_LSP_EVIDENCE"
mkdir -p "$WORKSPACE_DIR/scripts" "$WORKSPACE_DIR/python" "$FAKE_BIN_DIR"
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
cat > "$FAKE_BIN_DIR/typescript-language-server" <<'NODE'
#!/usr/bin/env node
process.stderr.write("openclaw-fixture-typescript-lsp-ready\n");
let input = "";
let sentInitialize = false;
let sentShutdown = false;
let sawDidOpen = false;
let sentSymbol = false;
function frame(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}
process.stdin.on("data", (chunk) => {
  input += chunk.toString("utf8");
  if (!sentInitialize && input.includes('"method":"initialize"')) {
    sentInitialize = true;
    frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } });
  }
  if (!sawDidOpen && input.includes('"method":"textDocument/didOpen"') && input.includes("OpenClawNeedle")) {
    sawDidOpen = true;
    process.stderr.write("openclaw-fixture-didopen-observed\n");
  }
  if (!sentSymbol && input.includes('"method":"textDocument/definition"') && input.includes("OpenClawNeedle")) {
    sentSymbol = true;
    process.stderr.write("openclaw-fixture-symbol-request-observed\n");
    frame({ jsonrpc: "2.0", id: 3, result: [{ uri: process.env.OPENCLAW_FAKE_LSP_TARGET_URI ?? "file:///openclaw/src/app.ts", range: { start: { line: 1, character: 14 }, end: { line: 1, character: 26 } } }] });
  }
  if (!sentShutdown && input.includes('"method":"shutdown"')) {
    sentShutdown = true;
    frame({ jsonrpc: "2.0", id: sentSymbol ? 4 : 2, result: null });
  }
  if (input.includes('"method":"exit"')) {
    setTimeout(() => process.exit(0), 10);
  }
});
setTimeout(() => process.exit(3), 5000);
NODE
chmod +x "$FAKE_BIN_DIR/typescript-language-server"
export PATH="$FAKE_BIN_DIR:$PATH"
export OPENCLAW_FAKE_LSP_TARGET_URI="$(node -e 'const { pathToFileURL } = require("node:url"); console.log(pathToFileURL(process.argv[1]).href);' "$WORKSPACE_DIR/src/app.ts")"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${CHECK_FILE:-}" \
    "${POSITION_FILE:-}" \
    "${BAD_PATH_FILE:-}" \
    "${DRAFT_FILE:-}" \
    "${ADAPTER_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_STEP_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${EXEC_STEP_FILE:-}" \
    "${TASK_READBACK_FILE:-}" \
    "${PROCESS_TASK_FILE:-}" \
    "${PROCESS_BLOCKED_STEP_FILE:-}" \
    "${PROCESS_APPROVED_FILE:-}" \
    "${PROCESS_STEP_FILE:-}" \
    "${PROCESS_TASK_READBACK_FILE:-}" \
    "${LIFECYCLE_STATE_AFTER_PROCESS_FILE:-}" \
    "${STOP_TASK_FILE:-}" \
    "${STOP_BLOCKED_STEP_FILE:-}" \
    "${STOP_APPROVED_FILE:-}" \
    "${STOP_STEP_FILE:-}" \
    "${STOP_TASK_READBACK_FILE:-}" \
    "${LIFECYCLE_STATE_AFTER_STOP_FILE:-}" \
    "${RESTART_TASK_FILE:-}" \
    "${RESTART_BLOCKED_STEP_FILE:-}" \
    "${RESTART_APPROVED_FILE:-}" \
    "${RESTART_STEP_FILE:-}" \
    "${RESTART_TASK_READBACK_FILE:-}" \
    "${LIFECYCLE_STATE_FILE:-}" \
    "${HANDSHAKE_TASK_FILE:-}" \
    "${HANDSHAKE_BLOCKED_STEP_FILE:-}" \
    "${HANDSHAKE_APPROVED_FILE:-}" \
    "${HANDSHAKE_STEP_FILE:-}" \
    "${HANDSHAKE_TASK_READBACK_FILE:-}" \
    "${HANDSHAKE_STATE_FILE:-}" \
    "${SOURCE_TRANSFER_FILE:-}" \
    "${SOURCE_TRANSFER_TASK_FILE:-}" \
    "${SOURCE_TRANSFER_BLOCKED_STEP_FILE:-}" \
    "${SOURCE_TRANSFER_APPROVED_FILE:-}" \
    "${SOURCE_TRANSFER_STEP_FILE:-}" \
    "${SOURCE_TRANSFER_TASK_READBACK_FILE:-}" \
    "${SOURCE_TRANSFER_STATE_FILE:-}" \
    "${SYMBOL_REQUEST_FILE:-}" \
    "${SYMBOL_REQUEST_TASK_FILE:-}" \
    "${SYMBOL_REQUEST_BLOCKED_STEP_FILE:-}" \
    "${SYMBOL_REQUEST_APPROVED_FILE:-}" \
    "${SYMBOL_REQUEST_STEP_FILE:-}" \
    "${SYMBOL_REQUEST_TASK_READBACK_FILE:-}" \
    "${SYMBOL_REQUEST_STATE_FILE:-}" \
    "${SYMBOL_TARGET_BRIDGE_FILE:-}" \
    "${SYMBOL_EDIT_SEED_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

CHECK_FILE="$(mktemp)"
POSITION_FILE="$(mktemp)"
BAD_PATH_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_STEP_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
EXEC_STEP_FILE="$(mktemp)"
TASK_READBACK_FILE="$(mktemp)"
PROCESS_TASK_FILE="$(mktemp)"
PROCESS_BLOCKED_STEP_FILE="$(mktemp)"
PROCESS_APPROVED_FILE="$(mktemp)"
PROCESS_STEP_FILE="$(mktemp)"
PROCESS_TASK_READBACK_FILE="$(mktemp)"
LIFECYCLE_STATE_AFTER_PROCESS_FILE="$(mktemp)"
STOP_TASK_FILE="$(mktemp)"
STOP_BLOCKED_STEP_FILE="$(mktemp)"
STOP_APPROVED_FILE="$(mktemp)"
STOP_STEP_FILE="$(mktemp)"
STOP_TASK_READBACK_FILE="$(mktemp)"
LIFECYCLE_STATE_AFTER_STOP_FILE="$(mktemp)"
RESTART_TASK_FILE="$(mktemp)"
RESTART_BLOCKED_STEP_FILE="$(mktemp)"
RESTART_APPROVED_FILE="$(mktemp)"
RESTART_STEP_FILE="$(mktemp)"
RESTART_TASK_READBACK_FILE="$(mktemp)"
LIFECYCLE_STATE_FILE="$(mktemp)"
HANDSHAKE_TASK_FILE="$(mktemp)"
HANDSHAKE_BLOCKED_STEP_FILE="$(mktemp)"
HANDSHAKE_APPROVED_FILE="$(mktemp)"
HANDSHAKE_STEP_FILE="$(mktemp)"
HANDSHAKE_TASK_READBACK_FILE="$(mktemp)"
HANDSHAKE_STATE_FILE="$(mktemp)"
SOURCE_TRANSFER_FILE="$(mktemp)"
SOURCE_TRANSFER_TASK_FILE="$(mktemp)"
SOURCE_TRANSFER_BLOCKED_STEP_FILE="$(mktemp)"
SOURCE_TRANSFER_APPROVED_FILE="$(mktemp)"
SOURCE_TRANSFER_STEP_FILE="$(mktemp)"
SOURCE_TRANSFER_TASK_READBACK_FILE="$(mktemp)"
SOURCE_TRANSFER_STATE_FILE="$(mktemp)"
SYMBOL_REQUEST_FILE="$(mktemp)"
SYMBOL_REQUEST_TASK_FILE="$(mktemp)"
SYMBOL_REQUEST_BLOCKED_STEP_FILE="$(mktemp)"
SYMBOL_REQUEST_APPROVED_FILE="$(mktemp)"
SYMBOL_REQUEST_STEP_FILE="$(mktemp)"
SYMBOL_REQUEST_TASK_READBACK_FILE="$(mktemp)"
SYMBOL_REQUEST_STATE_FILE="$(mktemp)"
SYMBOL_TARGET_BRIDGE_FILE="$(mktemp)"
SYMBOL_EDIT_SEED_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=check&language=typescript&limit=200" > "$CHECK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=definition&language=typescript&relativePath=src/app.ts&line=2&character=14&limit=200" > "$POSITION_FILE"
BAD_STATUS="$(curl --silent --output "$BAD_PATH_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=hover&language=typescript&relativePath=.cache/leak.ts")"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-draft?language=python&lifecycleAction=restart&limit=200" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/source-transfer-proposal?language=typescript&relativePath=src/app.ts&maxPreviewChars=1200" > "$SOURCE_TRANSFER_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"python","lifecycleAction":"restart","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"

read -r approval_id lifecycle_task_id < <(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || taskResponse.mode !== "approval-gated-lsp-lifecycle-binary-gate"
  || taskResponse.engineeringLspLifecycle?.language !== "python"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "restart"
  || taskResponse.engineeringLspLifecycle?.server?.serverBinary !== "pylsp"
  || taskResponse.engineeringLspLifecycle?.server?.processStarted !== false
  || taskResponse.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canExecuteWithoutApproval !== false
  || taskResponse.governance?.canStartProcessWithoutApproval !== false
  || taskResponse.governance?.canSendJsonRpcRequest !== false
) {
  throw new Error(`LSP lifecycle task creation mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blockedStep.ok
  || blockedStep.ran !== false
  || blockedStep.blocked !== true
  || blockedStep.reason !== "policy_requires_approval"
  || blockedStep.approval?.id !== taskResponse.approval?.id
  || blockedStep.task?.engineeringLspLifecycle?.server?.processStarted !== false
  || blockedStep.task?.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP lifecycle task should block before approval: ${JSON.stringify(blockedStep)}`);
}

process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle binary gate"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EXEC_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$lifecycle_task_id" > "$TASK_READBACK_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"start","confirm":true}' > "$PROCESS_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_BLOCKED_STEP_FILE"

read -r process_approval_id process_task_id < <(node - <<'EOF' "$PROCESS_TASK_FILE" "$PROCESS_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "start"
  || taskResponse.engineeringLspLifecycle?.server?.serverBinary !== "typescript-language-server"
  || taskResponse.engineeringLspLifecycle?.server?.processStarted !== false
  || taskResponse.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP lifecycle process task creation mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blockedStep.ok
  || blockedStep.ran !== false
  || blockedStep.blocked !== true
  || blockedStep.reason !== "policy_requires_approval"
  || blockedStep.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`LSP lifecycle process task should block before approval: ${JSON.stringify(blockedStep)}`);
}

process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$process_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle process supervision probe"}' > "$PROCESS_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$process_task_id" > "$PROCESS_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$LIFECYCLE_STATE_AFTER_PROCESS_FILE"

post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"stop","confirm":true}' > "$STOP_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STOP_BLOCKED_STEP_FILE"
read -r stop_approval_id stop_task_id < <(node - <<'EOF' "$STOP_TASK_FILE" "$STOP_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "stop"
  || blockedStep.reason !== "policy_requires_approval"
) {
  throw new Error(`LSP lifecycle stop task should be approval-gated: ${JSON.stringify({ taskResponse, blockedStep })}`);
}
process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)
post_json "$CORE_URL/approvals/$stop_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle stop state record"}' > "$STOP_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STOP_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$stop_task_id" > "$STOP_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$LIFECYCLE_STATE_AFTER_STOP_FILE"

post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"restart","confirm":true}' > "$RESTART_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RESTART_BLOCKED_STEP_FILE"
read -r restart_approval_id restart_task_id < <(node - <<'EOF' "$RESTART_TASK_FILE" "$RESTART_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "restart"
  || blockedStep.reason !== "policy_requires_approval"
) {
  throw new Error(`LSP lifecycle restart task should be approval-gated: ${JSON.stringify({ taskResponse, blockedStep })}`);
}
process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)
post_json "$CORE_URL/approvals/$restart_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle restart state record"}' > "$RESTART_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RESTART_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$restart_task_id" > "$RESTART_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$LIFECYCLE_STATE_FILE"

post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"handshake","confirm":true}' > "$HANDSHAKE_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$HANDSHAKE_BLOCKED_STEP_FILE"
read -r handshake_approval_id handshake_task_id < <(node - <<'EOF' "$HANDSHAKE_TASK_FILE" "$HANDSHAKE_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "handshake"
  || blockedStep.reason !== "policy_requires_approval"
) {
  throw new Error(`LSP lifecycle handshake task should be approval-gated: ${JSON.stringify({ taskResponse, blockedStep })}`);
}
process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)
post_json "$CORE_URL/approvals/$handshake_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP initialize shutdown handshake"}' > "$HANDSHAKE_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$HANDSHAKE_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$handshake_task_id" > "$HANDSHAKE_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$HANDSHAKE_STATE_FILE"

post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"source_transfer","relativePath":"src/app.ts","confirm":true}' > "$SOURCE_TRANSFER_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SOURCE_TRANSFER_BLOCKED_STEP_FILE"
read -r source_transfer_approval_id source_transfer_task_id < <(node - <<'EOF' "$SOURCE_TRANSFER_TASK_FILE" "$SOURCE_TRANSFER_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.mode !== "approval-gated-lsp-source-transfer-didopen"
  || taskResponse.sourceRegistry !== "openclaw-native-engineering-lsp-source-transfer-proposal-v0"
  || taskResponse.sourceTransferProposal?.proposedDidOpen?.sent !== false
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "source_transfer"
  || taskResponse.engineeringLspLifecycle?.sourceTransfer?.relativePath !== "src/app.ts"
  || taskResponse.engineeringLspLifecycle?.sourceTransfer?.didOpenSent !== false
  || blockedStep.reason !== "policy_requires_approval"
) {
  throw new Error(`LSP source-transfer task should be approval-gated: ${JSON.stringify({ taskResponse, blockedStep })}`);
}
process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)
post_json "$CORE_URL/approvals/$source_transfer_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP didOpen source transfer"}' > "$SOURCE_TRANSFER_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SOURCE_TRANSFER_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$source_transfer_task_id" > "$SOURCE_TRANSFER_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$SOURCE_TRANSFER_STATE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/symbol-request-proposal?language=typescript&action=definition&relativePath=src/app.ts&line=2&character=14" > "$SYMBOL_REQUEST_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"symbol_request","symbolAction":"definition","relativePath":"src/app.ts","line":2,"character":14,"confirm":true}' > "$SYMBOL_REQUEST_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SYMBOL_REQUEST_BLOCKED_STEP_FILE"
read -r symbol_request_approval_id symbol_request_task_id < <(node - <<'EOF' "$SYMBOL_REQUEST_TASK_FILE" "$SYMBOL_REQUEST_BLOCKED_STEP_FILE" "$source_transfer_task_id"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const sourceTransferTaskId = process.argv[4];
if (
  !taskResponse.ok
  || taskResponse.mode !== "approval-gated-lsp-symbol-request"
  || taskResponse.sourceRegistry !== "openclaw-native-engineering-lsp-symbol-request-proposal-v0"
  || taskResponse.symbolRequestProposal?.proposedJsonRpc?.method !== "textDocument/definition"
  || taskResponse.symbolRequestProposal?.proposedJsonRpc?.sent !== false
  || taskResponse.symbolRequestProposal?.prerequisite?.sourceTaskId !== sourceTransferTaskId
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "symbol_request"
  || taskResponse.engineeringLspLifecycle?.symbolRequest?.action !== "definition"
  || taskResponse.engineeringLspLifecycle?.symbolRequest?.method !== "textDocument/definition"
  || taskResponse.engineeringLspLifecycle?.symbolRequest?.sent !== false
  || taskResponse.engineeringLspLifecycle?.sourceTransfer?.relativePath !== "src/app.ts"
  || taskResponse.engineeringLspLifecycle?.server?.symbolRequestSent !== false
  || taskResponse.governance?.symbolRequestRequiresApproval !== true
  || taskResponse.governance?.canSendJsonRpcRequest !== "after_approval_symbol_request_only"
  || blockedStep.reason !== "policy_requires_approval"
) {
  throw new Error(`LSP symbol request task should be approval-gated: ${JSON.stringify({ taskResponse, blockedStep })}`);
}
process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)
post_json "$CORE_URL/approvals/$symbol_request_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP definition symbol request"}' > "$SYMBOL_REQUEST_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SYMBOL_REQUEST_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$symbol_request_task_id" > "$SYMBOL_REQUEST_TASK_READBACK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-state?language=typescript&limit=10" > "$SYMBOL_REQUEST_STATE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/selected-target-read-bridge?language=typescript&taskId=$symbol_request_task_id&contextLines=0&includeRead=true&maxOutputChars=800" > "$SYMBOL_TARGET_BRIDGE_FILE"
curl --silent --fail --get "$CORE_URL/plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed" \
  --data-urlencode "language=typescript" \
  --data-urlencode "taskId=$symbol_request_task_id" \
  --data-urlencode "contextLines=0" \
  --data-urlencode 'newString=export const needle = "OpenClawNeedleSelected";' \
  > "$SYMBOL_EDIT_SEED_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=120" > "$EVENTS_FILE"

node - <<'EOF' \
  "$CHECK_FILE" \
  "$POSITION_FILE" \
  "$BAD_PATH_FILE" \
  "$BAD_STATUS" \
  "$DRAFT_FILE" \
  "$ADAPTER_FILE" \
  "$TASK_FILE" \
  "$BLOCKED_STEP_FILE" \
  "$APPROVED_FILE" \
  "$EXEC_STEP_FILE" \
  "$TASK_READBACK_FILE" \
  "$PROCESS_TASK_FILE" \
  "$PROCESS_BLOCKED_STEP_FILE" \
  "$PROCESS_APPROVED_FILE" \
  "$PROCESS_STEP_FILE" \
  "$PROCESS_TASK_READBACK_FILE" \
  "$LIFECYCLE_STATE_AFTER_PROCESS_FILE" \
  "$STOP_TASK_FILE" \
  "$STOP_BLOCKED_STEP_FILE" \
  "$STOP_APPROVED_FILE" \
  "$STOP_STEP_FILE" \
  "$STOP_TASK_READBACK_FILE" \
  "$LIFECYCLE_STATE_AFTER_STOP_FILE" \
  "$RESTART_TASK_FILE" \
  "$RESTART_BLOCKED_STEP_FILE" \
  "$RESTART_APPROVED_FILE" \
  "$RESTART_STEP_FILE" \
  "$RESTART_TASK_READBACK_FILE" \
  "$LIFECYCLE_STATE_FILE" \
  "$HANDSHAKE_TASK_FILE" \
  "$HANDSHAKE_BLOCKED_STEP_FILE" \
  "$HANDSHAKE_APPROVED_FILE" \
  "$HANDSHAKE_STEP_FILE" \
  "$HANDSHAKE_TASK_READBACK_FILE" \
  "$HANDSHAKE_STATE_FILE" \
  "$EVENTS_FILE" \
  "$SOURCE_TRANSFER_FILE" \
  "$SOURCE_TRANSFER_TASK_FILE" \
  "$SOURCE_TRANSFER_BLOCKED_STEP_FILE" \
  "$SOURCE_TRANSFER_APPROVED_FILE" \
  "$SOURCE_TRANSFER_STEP_FILE" \
  "$SOURCE_TRANSFER_TASK_READBACK_FILE" \
  "$SOURCE_TRANSFER_STATE_FILE" \
  "$SYMBOL_REQUEST_FILE" \
  "$SYMBOL_REQUEST_TASK_FILE" \
  "$SYMBOL_REQUEST_BLOCKED_STEP_FILE" \
  "$SYMBOL_REQUEST_APPROVED_FILE" \
  "$SYMBOL_REQUEST_STEP_FILE" \
  "$SYMBOL_REQUEST_TASK_READBACK_FILE" \
  "$SYMBOL_REQUEST_STATE_FILE" \
  "$SYMBOL_TARGET_BRIDGE_FILE" \
  "$SYMBOL_EDIT_SEED_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const check = readJson(2);
const position = readJson(3);
const bad = readJson(4);
const badStatus = process.argv[5];
const draft = readJson(6);
const adapter = readJson(7);
const taskResponse = readJson(8);
const blockedStep = readJson(9);
const approved = readJson(10);
const execStep = readJson(11);
const taskReadback = readJson(12);
const processTaskResponse = readJson(13);
const processBlockedStep = readJson(14);
const processApproved = readJson(15);
const processStep = readJson(16);
const processTaskReadback = readJson(17);
const lifecycleStateAfterProcess = readJson(18);
const stopTaskResponse = readJson(19);
const stopBlockedStep = readJson(20);
const stopApproved = readJson(21);
const stopStep = readJson(22);
const stopTaskReadback = readJson(23);
const lifecycleStateAfterStop = readJson(24);
const restartTaskResponse = readJson(25);
const restartBlockedStep = readJson(26);
const restartApproved = readJson(27);
const restartStep = readJson(28);
const restartTaskReadback = readJson(29);
const lifecycleState = readJson(30);
const handshakeTaskResponse = readJson(31);
const handshakeBlockedStep = readJson(32);
const handshakeApproved = readJson(33);
const handshakeStep = readJson(34);
const handshakeTaskReadback = readJson(35);
const handshakeState = readJson(36);
const events = readJson(37);
const sourceTransfer = readJson(38);
const sourceTransferTaskResponse = readJson(39);
const sourceTransferBlockedStep = readJson(40);
const sourceTransferApproved = readJson(41);
const sourceTransferStep = readJson(42);
const sourceTransferTaskReadback = readJson(43);
const sourceTransferState = readJson(44);
const symbolRequest = readJson(45);
const symbolRequestTaskResponse = readJson(46);
const symbolRequestBlockedStep = readJson(47);
const symbolRequestApproved = readJson(48);
const symbolRequestStep = readJson(49);
const symbolRequestTaskReadback = readJson(50);
const symbolRequestState = readJson(51);
const symbolTargetBridge = readJson(52);
const symbolEditSeed = readJson(53);
const expectedTargetUri = process.env.OPENCLAW_FAKE_LSP_TARGET_URI;
const raw = JSON.stringify({ check, position, bad, draft, sourceTransfer, sourceTransferTaskResponse, sourceTransferBlockedStep, sourceTransferApproved, sourceTransferStep, sourceTransferTaskReadback, sourceTransferState, symbolRequest, symbolRequestTaskResponse, symbolRequestBlockedStep, symbolRequestApproved, symbolRequestStep, symbolRequestTaskReadback, symbolRequestState, symbolTargetBridge, symbolEditSeed, adapter, taskResponse, blockedStep, approved, execStep, taskReadback, processTaskResponse, processBlockedStep, processApproved, processStep, processTaskReadback, lifecycleStateAfterProcess, stopTaskResponse, stopBlockedStep, stopApproved, stopStep, stopTaskReadback, lifecycleStateAfterStop, restartTaskResponse, restartBlockedStep, restartApproved, restartStep, restartTaskReadback, lifecycleState, handshakeTaskResponse, handshakeBlockedStep, handshakeApproved, handshakeStep, handshakeTaskReadback, handshakeState, events });

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
  !draft.ok
  || draft.registry !== "openclaw-native-engineering-lsp-lifecycle-draft-v0"
  || draft.mode !== "lsp-lifecycle-readiness-draft-only"
  || draft.capability?.id !== "plan.openclaw.engineering_tool.lsp_lifecycle"
  || draft.summary?.selectedLanguage !== "python"
  || draft.summary?.lifecycleAction !== "restart"
  || !draft.summary?.detectedLanguages?.includes("python")
  || draft.summary?.executionReady !== false
  || draft.summary?.canCreateTaskNow !== false
  || draft.lifecycleDraft?.server?.serverBinary !== "pylsp"
  || draft.lifecycleDraft?.status !== "draft_only"
  || draft.lifecycleDraft?.workspaceScoped !== true
  || draft.lifecycleDraft?.createsTask !== false
  || draft.lifecycleDraft?.createsApproval !== false
  || draft.lifecycleDraft?.executesCommand !== false
  || draft.lifecycleDraft?.server?.binaryChecked !== false
  || draft.lifecycleDraft?.server?.processStarted !== false
  || draft.lifecycleDraft?.server?.jsonRpcHandshakeSent !== false
  || draft.governance?.canDraftLifecycleAction !== true
  || draft.governance?.canCheckServerBinary !== false
  || draft.governance?.canStartLspServer !== false
  || draft.governance?.canSendJsonRpcRequest !== false
  || draft.governance?.canCreateTask !== false
  || draft.governance?.canCreateApproval !== false
  || draft.bounds?.noTaskCreation !== true
  || draft.bounds?.noApprovalCreation !== true
  || draft.auditEvidence?.operation !== "lsp_lifecycle_readiness_draft"
  || !draft.readinessGates?.some((gate) => gate.id === "process_supervision" && gate.status === "deferred")
) {
  throw new Error(`LSP lifecycle draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !sourceTransfer.ok
  || sourceTransfer.registry !== "openclaw-native-engineering-lsp-source-transfer-proposal-v0"
  || sourceTransfer.mode !== "lsp-didopen-source-transfer-proposal-only"
  || sourceTransfer.capability?.id !== "plan.openclaw.engineering_tool.lsp_source_transfer"
  || sourceTransfer.file?.relativePath !== "src/app.ts"
  || sourceTransfer.file?.languageId !== "typescript"
  || sourceTransfer.file?.languageMatchesExtension !== true
  || !String(sourceTransfer.file?.uri ?? "").startsWith("file://")
  || !/^[a-f0-9]{64}$/.test(String(sourceTransfer.file?.textSha256 ?? ""))
  || sourceTransfer.proposedDidOpen?.method !== "textDocument/didOpen"
  || sourceTransfer.proposedDidOpen?.sent !== false
  || sourceTransfer.proposedDidOpen?.textDocument?.textSha256 !== sourceTransfer.file?.textSha256
  || sourceTransfer.sourcePreview?.truncated !== false
  || !String(sourceTransfer.sourcePreview?.text ?? "").includes("OpenClawNeedle")
  || sourceTransfer.serverContract?.binaryChecked !== false
  || sourceTransfer.serverContract?.processStarted !== false
  || sourceTransfer.serverContract?.jsonRpcSent !== false
  || sourceTransfer.serverContract?.didOpenSent !== false
  || sourceTransfer.governance?.canReadWorkspaceSourceForProposal !== true
  || sourceTransfer.governance?.canTransferSourceContentToLsp !== false
  || sourceTransfer.governance?.canSendDidOpen !== false
  || sourceTransfer.governance?.canSendSymbolRequests !== false
  || sourceTransfer.governance?.futureSourceTransferRequiresApproval !== true
  || sourceTransfer.bounds?.workspaceRootConstrained !== true
  || sourceTransfer.bounds?.binaryFileSkipped !== true
  || sourceTransfer.bounds?.noLspServerStart !== true
  || sourceTransfer.bounds?.noDidOpenSent !== true
  || sourceTransfer.bounds?.noSymbolRequestSent !== true
  || sourceTransfer.summary?.sourceContentTransferred !== false
  || sourceTransfer.auditEvidence?.operation !== "lsp_source_transfer_proposal"
) {
  throw new Error(`LSP source-transfer proposal mismatch: ${JSON.stringify(sourceTransfer)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.lsp_evidence")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.engineering_tool.lsp_lifecycle")
  || !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.lsp_lifecycle_task")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.lsp_lifecycle_state")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.engineering_tool.lsp_source_transfer")
  || !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.lsp_source_transfer_task")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.engineering_tool.lsp_symbol_request")
  || !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.lsp_symbol_request_task")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.lsp_selected_target_read_bridge")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.engineering_tool.lsp_selected_target_edit_proposal_seed")
  || adapter.summary?.canReadEngineeringLspEvidence !== true
  || adapter.summary?.canDraftEngineeringLspLifecycleAction !== true
  || adapter.summary?.canCreateApprovalGatedEngineeringLspLifecycleTasks !== true
  || adapter.summary?.canReadEngineeringLspLifecycleState !== true
  || adapter.summary?.canDraftEngineeringLspSourceTransferProposal !== true
  || adapter.summary?.canCreateApprovalGatedEngineeringLspSourceTransferTasks !== true
  || adapter.summary?.canDraftEngineeringLspSymbolRequestProposal !== true
  || adapter.summary?.canCreateApprovalGatedEngineeringLspSymbolRequestTasks !== true
  || adapter.summary?.canReadEngineeringLspSelectedTargetBridge !== true
  || adapter.summary?.canSeedEngineeringLspSelectedTargetEditProposals !== true
) {
  throw new Error(`native adapter missing LSP evidence/lifecycle capability: ${JSON.stringify(adapter)}`);
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP lifecycle approval should convert task to audited execution: ${JSON.stringify(approved)}`);
}
if (
  !execStep.ok
  || !(
    (execStep.ran === true && execStep.blocked === false)
    || (execStep.ran === false && execStep.blocked === true && execStep.reason === "lsp_server_binary_missing")
  )
) {
  throw new Error(`approved LSP lifecycle task should run its binary gate: ${JSON.stringify(execStep)}`);
}
const lifecycleTask = execStep.task;
const lifecycle = lifecycleTask?.engineeringLspLifecycle ?? {};
const execution = execStep.execution?.execution ?? lifecycle.execution ?? lifecycleTask?.outcome?.details?.lspLifecycleExecution;
if (
  lifecycleTask?.id !== taskResponse.task?.id
  || lifecycle.language !== "python"
  || lifecycle.lifecycleAction !== "restart"
  || lifecycle.server?.binaryChecked !== true
  || lifecycle.server?.processStarted !== false
  || lifecycle.server?.jsonRpcHandshakeSent !== false
  || execution?.registry !== "openclaw-native-engineering-lsp-lifecycle-execution-v0"
  || execution?.mode !== "approved-lsp-lifecycle-binary-gate"
  || execution?.governance?.approved !== true
  || execution?.governance?.canStartProcessWithoutApproval !== false
  || execution?.governance?.processStarted !== false
  || execution?.governance?.jsonRpcEnabled !== false
  || execution?.governance?.contentExposed !== false
  || execution?.server?.binaryChecked !== true
  || execution?.server?.processStarted !== false
  || execution?.server?.jsonRpcHandshakeSent !== false
  || execution?.server?.serverBinary !== "pylsp"
) {
  throw new Error(`LSP lifecycle binary gate readback mismatch: ${JSON.stringify({ lifecycleTask, execution })}`);
}
if (execution.result?.ok === true) {
  if (lifecycleTask.status !== "completed" || execution.result?.state !== "binary_gate_passed_process_supervision_deferred") {
    throw new Error(`LSP lifecycle binary-present path should complete without process start: ${JSON.stringify({ lifecycleTask, execution })}`);
  }
} else if (execution.result?.failureKind === "lsp_server_binary_missing") {
  if (
    lifecycleTask.status !== "failed"
    || lifecycleTask.outcome?.details?.recoveryEvidence?.kind !== "lsp_lifecycle_recovery"
    || lifecycleTask.outcome?.details?.recoveryEvidence?.recoverable !== true
    || !String(execution.recoveryRecommendation?.nextAction ?? "").includes("pylsp")
  ) {
    throw new Error(`LSP lifecycle missing-binary path should attach recovery evidence: ${JSON.stringify({ lifecycleTask, execution })}`);
  }
} else {
  throw new Error(`LSP lifecycle binary gate returned unexpected result: ${JSON.stringify(execution)}`);
}
if (taskReadback.task?.id !== lifecycleTask.id || taskReadback.task?.engineeringLspLifecycle?.server?.processStarted !== false) {
  throw new Error(`LSP lifecycle task endpoint should preserve execution readback: ${JSON.stringify(taskReadback)}`);
}
if (processApproved.approval?.status !== "approved" || processApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP process supervision approval should convert task to audited execution: ${JSON.stringify(processApproved)}`);
}
if (!processStep.ok || processStep.ran !== true || processStep.blocked !== false) {
  throw new Error(`approved LSP process supervision task should complete: ${JSON.stringify(processStep)}`);
}
const supervisedTask = processStep.task;
const supervisedExecution = supervisedTask?.outcome?.details?.lspLifecycleExecution ?? supervisedTask?.engineeringLspLifecycle?.execution;
if (
  processTaskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || processBlockedStep.reason !== "policy_requires_approval"
  || supervisedTask?.id !== processTaskResponse.task?.id
  || supervisedTask.status !== "completed"
  || supervisedExecution?.result?.state !== "process_supervision_probe_completed_json_rpc_deferred"
  || supervisedExecution?.server?.serverBinary !== "typescript-language-server"
  || supervisedExecution?.server?.binaryFound !== true
  || supervisedExecution?.server?.processStarted !== true
  || supervisedExecution?.server?.processAliveAtProbe !== true
  || supervisedExecution?.server?.processTerminated !== true
  || supervisedExecution?.server?.jsonRpcHandshakeSent !== false
  || supervisedExecution?.processSupervision?.attempted !== true
  || supervisedExecution?.processSupervision?.started !== true
  || supervisedExecution?.processSupervision?.terminationSent !== true
  || !String(supervisedExecution?.processSupervision?.stderr?.text ?? "").includes("openclaw-fixture-typescript-lsp-ready")
  || supervisedExecution?.governance?.approved !== true
  || supervisedExecution?.governance?.jsonRpcEnabled !== false
  || supervisedExecution?.governance?.contentExposed !== false
  || supervisedExecution?.lifecycleState?.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || supervisedExecution?.lifecycleState?.status !== "probe_completed_no_live_process"
  || supervisedExecution?.lifecycleState?.process?.longLivedProcessActive !== false
  || supervisedExecution?.lifecycleState?.boundaries?.jsonRpcEnabled !== false
) {
  throw new Error(`LSP process supervision readback mismatch: ${JSON.stringify({ supervisedTask, supervisedExecution })}`);
}
const processStateItem = lifecycleStateAfterProcess.items?.[0];
if (
  lifecycleStateAfterProcess.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || lifecycleStateAfterProcess.mode !== "read-only-lsp-lifecycle-state-readback"
  || lifecycleStateAfterProcess.governance?.readOnly !== true
  || lifecycleStateAfterProcess.governance?.canStartProcess !== false
  || lifecycleStateAfterProcess.governance?.jsonRpcEnabled !== false
  || processStateItem?.sourceTaskId !== supervisedTask.id
  || processStateItem?.status !== "probe_completed_no_live_process"
  || processStateItem?.process?.longLivedProcessActive !== false
  || processStateItem?.boundaries?.sourceContentTransferred !== false
  || !String(processStateItem?.output?.stderr?.preview ?? "").includes("openclaw-fixture-typescript-lsp-ready")
) {
  throw new Error(`LSP lifecycle state should record process probe readback: ${JSON.stringify(lifecycleStateAfterProcess)}`);
}
if (
  processTaskReadback.task?.id !== supervisedTask.id
  || processTaskReadback.task?.engineeringLspLifecycle?.server?.processStarted !== true
  || processTaskReadback.task?.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP process task endpoint should preserve supervision readback: ${JSON.stringify(processTaskReadback)}`);
}
if (stopApproved.approval?.status !== "approved" || stopApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP stop approval should convert task to audited execution: ${JSON.stringify(stopApproved)}`);
}
if (!stopStep.ok || stopStep.ran !== true || stopStep.blocked !== false) {
  throw new Error(`approved LSP stop task should complete: ${JSON.stringify(stopStep)}`);
}
const stopTask = stopStep.task;
const stopExecution = stopTask?.outcome?.details?.lspLifecycleExecution ?? stopTask?.engineeringLspLifecycle?.execution;
if (
  stopTaskResponse.engineeringLspLifecycle?.lifecycleAction !== "stop"
  || stopBlockedStep.reason !== "policy_requires_approval"
  || stopTask?.id !== stopTaskResponse.task?.id
  || stopTask.status !== "completed"
  || stopExecution?.result?.state !== "stop_recorded_no_live_process"
  || stopExecution?.server?.binaryChecked !== false
  || stopExecution?.server?.processStarted !== false
  || stopExecution?.server?.jsonRpcHandshakeSent !== false
  || stopExecution?.processSupervision?.reason !== "stop_recorded_no_live_process"
  || stopExecution?.lifecycleState?.status !== "stopped_no_live_process"
  || stopExecution?.lifecycleState?.process?.longLivedProcessActive !== false
) {
  throw new Error(`LSP stop lifecycle readback mismatch: ${JSON.stringify({ stopTask, stopExecution })}`);
}
const stopStateItem = lifecycleStateAfterStop.items?.[0];
if (
  stopTaskReadback.task?.id !== stopTask.id
  || stopTaskReadback.task?.engineeringLspLifecycle?.lifecycleState?.status !== "stopped_no_live_process"
  || lifecycleStateAfterStop.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || stopStateItem?.sourceTaskId !== stopTask.id
  || stopStateItem?.status !== "stopped_no_live_process"
  || stopStateItem?.process?.longLivedProcessActive !== false
  || stopStateItem?.boundaries?.jsonRpcEnabled !== false
) {
  throw new Error(`LSP lifecycle state should record stop readback: ${JSON.stringify({ stopTaskReadback, lifecycleStateAfterStop })}`);
}
if (restartApproved.approval?.status !== "approved" || restartApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP restart approval should convert task to audited execution: ${JSON.stringify(restartApproved)}`);
}
if (!restartStep.ok || restartStep.ran !== true || restartStep.blocked !== false) {
  throw new Error(`approved LSP restart task should complete: ${JSON.stringify(restartStep)}`);
}
const restartTask = restartStep.task;
const restartExecution = restartTask?.outcome?.details?.lspLifecycleExecution ?? restartTask?.engineeringLspLifecycle?.execution;
if (
  restartTaskResponse.engineeringLspLifecycle?.lifecycleAction !== "restart"
  || restartBlockedStep.reason !== "policy_requires_approval"
  || restartTask?.id !== restartTaskResponse.task?.id
  || restartTask.status !== "completed"
  || restartExecution?.result?.state !== "process_supervision_probe_completed_json_rpc_deferred"
  || restartExecution?.server?.processStarted !== true
  || restartExecution?.server?.processTerminated !== true
  || restartExecution?.server?.jsonRpcHandshakeSent !== false
  || restartExecution?.lifecycleState?.status !== "probe_completed_no_live_process"
  || restartExecution?.lifecycleState?.history?.length < 3
) {
  throw new Error(`LSP restart lifecycle readback mismatch: ${JSON.stringify({ restartTask, restartExecution })}`);
}
const finalStateItem = lifecycleState.items?.[0];
if (
  restartTaskReadback.task?.id !== restartTask.id
  || restartTaskReadback.task?.engineeringLspLifecycle?.lifecycleState?.status !== "probe_completed_no_live_process"
  || lifecycleState.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || lifecycleState.summary?.activeLongLivedProcesses !== 0
  || lifecycleState.summary?.jsonRpcEnabled !== false
  || lifecycleState.summary?.sourceContentTransferred !== false
  || finalStateItem?.sourceTaskId !== restartTask.id
  || finalStateItem?.lifecycleAction !== "restart"
  || finalStateItem?.status !== "probe_completed_no_live_process"
  || finalStateItem?.process?.longLivedProcessActive !== false
  || finalStateItem?.boundaries?.sourceContentTransferred !== false
  || finalStateItem?.boundaries?.providerEgress !== false
) {
  throw new Error(`LSP lifecycle state should record restart readback: ${JSON.stringify({ restartTaskReadback, lifecycleState })}`);
}
if (handshakeApproved.approval?.status !== "approved" || handshakeApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP handshake approval should convert task to audited execution: ${JSON.stringify(handshakeApproved)}`);
}
if (!handshakeStep.ok || handshakeStep.ran !== true || handshakeStep.blocked !== false) {
  throw new Error(`approved LSP handshake task should complete: ${JSON.stringify(handshakeStep)}`);
}
const handshakeTask = handshakeStep.task;
const handshakeExecution = handshakeTask?.outcome?.details?.lspLifecycleExecution ?? handshakeTask?.engineeringLspLifecycle?.execution;
if (
  handshakeTaskResponse.engineeringLspLifecycle?.lifecycleAction !== "handshake"
  || handshakeBlockedStep.reason !== "policy_requires_approval"
  || handshakeTask?.id !== handshakeTaskResponse.task?.id
  || handshakeTask.status !== "completed"
  || handshakeExecution?.result?.state !== "initialize_shutdown_handshake_completed_source_content_deferred"
  || handshakeExecution?.server?.processStarted !== true
  || handshakeExecution?.server?.jsonRpcHandshakeSent !== true
  || handshakeExecution?.processSupervision?.protocolHandshake?.ok !== true
  || !handshakeExecution?.processSupervision?.protocolHandshake?.messagesSent?.includes("initialize")
  || !handshakeExecution?.processSupervision?.protocolHandshake?.messagesSent?.includes("shutdown")
  || !handshakeExecution?.processSupervision?.protocolHandshake?.messagesSent?.includes("exit")
  || handshakeExecution?.processSupervision?.protocolHandshake?.didOpenSent !== false
  || handshakeExecution?.processSupervision?.protocolHandshake?.symbolRequestsSent !== false
  || handshakeExecution?.processSupervision?.protocolHandshake?.sourceContentTransferred !== false
  || handshakeExecution?.lifecycleState?.status !== "initialize_shutdown_handshake_completed"
  || handshakeExecution?.lifecycleState?.boundaries?.jsonRpcInitializeShutdownOnly !== true
  || handshakeExecution?.lifecycleState?.boundaries?.jsonRpcOperationalRequestsEnabled !== false
  || handshakeExecution?.lifecycleState?.boundaries?.sourceContentTransferred !== false
) {
  throw new Error(`LSP initialize/shutdown handshake readback mismatch: ${JSON.stringify({ handshakeTask, handshakeExecution })}`);
}
const handshakeStateItem = handshakeState.items?.[0];
if (
  handshakeTaskReadback.task?.id !== handshakeTask.id
  || handshakeTaskReadback.task?.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== true
  || handshakeTaskReadback.task?.engineeringLspLifecycle?.lifecycleState?.status !== "initialize_shutdown_handshake_completed"
  || handshakeState.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || handshakeState.summary?.jsonRpcEnabled !== true
  || handshakeState.summary?.jsonRpcOperationalRequestsEnabled !== false
  || handshakeState.summary?.sourceContentTransferred !== false
  || handshakeStateItem?.sourceTaskId !== handshakeTask.id
  || handshakeStateItem?.lifecycleAction !== "handshake"
  || handshakeStateItem?.status !== "initialize_shutdown_handshake_completed"
  || handshakeStateItem?.process?.protocolHandshake?.ok !== true
  || handshakeStateItem?.boundaries?.jsonRpcInitializeShutdownOnly !== true
  || handshakeStateItem?.boundaries?.jsonRpcOperationalRequestsEnabled !== false
  || handshakeStateItem?.boundaries?.sourceContentTransferred !== false
) {
  throw new Error(`LSP lifecycle state should record handshake readback: ${JSON.stringify({ handshakeTaskReadback, handshakeState })}`);
}
if (sourceTransferApproved.approval?.status !== "approved" || sourceTransferApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP source-transfer approval should convert task to audited execution: ${JSON.stringify(sourceTransferApproved)}`);
}
if (!sourceTransferStep.ok || sourceTransferStep.ran !== true || sourceTransferStep.blocked !== false) {
  throw new Error(`approved LSP source-transfer task should complete: ${JSON.stringify(sourceTransferStep)}`);
}
const sourceTransferTask = sourceTransferStep.task;
const sourceTransferExecution = sourceTransferTask?.outcome?.details?.lspLifecycleExecution ?? sourceTransferTask?.engineeringLspLifecycle?.execution;
if (
  sourceTransferTaskResponse.mode !== "approval-gated-lsp-source-transfer-didopen"
  || sourceTransferBlockedStep.reason !== "policy_requires_approval"
  || sourceTransferTask?.id !== sourceTransferTaskResponse.task?.id
  || sourceTransferTask.status !== "completed"
  || sourceTransferExecution?.result?.state !== "didopen_source_transfer_completed_symbol_requests_deferred"
  || sourceTransferExecution?.server?.processStarted !== true
  || sourceTransferExecution?.server?.jsonRpcHandshakeSent !== true
  || sourceTransferExecution?.server?.didOpenSent !== true
  || sourceTransferExecution?.server?.sourceContentTransferred !== true
  || sourceTransferExecution?.processSupervision?.protocolHandshake?.ok !== true
  || !sourceTransferExecution?.processSupervision?.protocolHandshake?.messagesSent?.includes("textDocument/didOpen")
  || sourceTransferExecution?.processSupervision?.protocolHandshake?.didOpenSent !== true
  || sourceTransferExecution?.processSupervision?.protocolHandshake?.symbolRequestsSent !== false
  || sourceTransferExecution?.processSupervision?.protocolHandshake?.sourceContentTransferred !== true
  || sourceTransferExecution?.processSupervision?.protocolHandshake?.sourceTransfer?.relativePath !== "src/app.ts"
  || sourceTransferExecution?.lifecycleState?.status !== "didopen_source_transfer_completed"
  || sourceTransferExecution?.lifecycleState?.boundaries?.sourceContentTransferred !== true
  || sourceTransferExecution?.lifecycleState?.boundaries?.jsonRpcOperationalRequestsEnabled !== false
  || !String(sourceTransferExecution?.processSupervision?.stderr?.text ?? "").includes("openclaw-fixture-didopen-observed")
) {
  throw new Error(`LSP didOpen source-transfer readback mismatch: ${JSON.stringify({ sourceTransferTask, sourceTransferExecution })}`);
}
const sourceTransferStateItem = sourceTransferState.items?.[0];
if (
  sourceTransferTaskReadback.task?.id !== sourceTransferTask.id
  || sourceTransferTaskReadback.task?.engineeringLspLifecycle?.sourceTransfer?.didOpenSent !== true
  || sourceTransferTaskReadback.task?.engineeringLspLifecycle?.sourceTransfer?.sourceContentTransferred !== true
  || sourceTransferState.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || sourceTransferState.summary?.jsonRpcEnabled !== true
  || sourceTransferState.summary?.jsonRpcOperationalRequestsEnabled !== false
  || sourceTransferState.summary?.sourceContentTransferred !== true
  || sourceTransferStateItem?.sourceTaskId !== sourceTransferTask.id
  || sourceTransferStateItem?.lifecycleAction !== "source_transfer"
  || sourceTransferStateItem?.status !== "didopen_source_transfer_completed"
  || sourceTransferStateItem?.process?.protocolHandshake?.didOpenSent !== true
  || sourceTransferStateItem?.boundaries?.sourceContentTransferred !== true
  || sourceTransferStateItem?.boundaries?.jsonRpcOperationalRequestsEnabled !== false
) {
  throw new Error(`LSP lifecycle state should record didOpen source transfer: ${JSON.stringify({ sourceTransferTaskReadback, sourceTransferState })}`);
}
if (
  !symbolRequest.ok
  || symbolRequest.registry !== "openclaw-native-engineering-lsp-symbol-request-proposal-v0"
  || symbolRequest.mode !== "lsp-symbol-request-proposal-only"
  || symbolRequest.prerequisite?.found !== true
  || symbolRequest.prerequisite?.sourceTaskId !== sourceTransferTask.id
  || symbolRequest.proposedJsonRpc?.method !== "textDocument/definition"
  || symbolRequest.proposedJsonRpc?.sent !== false
  || symbolRequest.proposedJsonRpc?.params?.textDocument?.uri !== sourceTransferExecution.processSupervision?.protocolHandshake?.sourceTransfer?.uri
  || symbolRequest.proposedJsonRpc?.params?.position?.line !== 1
  || symbolRequest.proposedJsonRpc?.params?.position?.character !== 14
  || symbolRequest.governance?.canSendSymbolRequest !== false
  || symbolRequest.governance?.futureSymbolRequestRequiresApproval !== true
  || symbolRequest.bounds?.noSymbolRequestSent !== true
  || symbolRequest.summary?.symbolRequestSent !== false
) {
  throw new Error(`LSP symbol request proposal mismatch: ${JSON.stringify(symbolRequest)}`);
}
if (symbolRequestApproved.approval?.status !== "approved" || symbolRequestApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP symbol request approval should convert task to audited execution: ${JSON.stringify(symbolRequestApproved)}`);
}
if (!symbolRequestStep.ok || symbolRequestStep.ran !== true || symbolRequestStep.blocked !== false) {
  throw new Error(`approved LSP symbol request task should complete: ${JSON.stringify(symbolRequestStep)}`);
}
const symbolRequestTask = symbolRequestStep.task;
const symbolRequestExecution = symbolRequestTask?.outcome?.details?.lspLifecycleExecution ?? symbolRequestTask?.engineeringLspLifecycle?.execution;
if (
  symbolRequestTaskResponse.mode !== "approval-gated-lsp-symbol-request"
  || symbolRequestBlockedStep.reason !== "policy_requires_approval"
  || symbolRequestTask?.id !== symbolRequestTaskResponse.task?.id
  || symbolRequestTask.status !== "completed"
  || symbolRequestExecution?.result?.state !== "symbol_request_completed_long_lived_pool_deferred"
  || symbolRequestExecution?.server?.processStarted !== true
  || symbolRequestExecution?.server?.jsonRpcHandshakeSent !== true
  || symbolRequestExecution?.server?.didOpenSent !== true
  || symbolRequestExecution?.server?.sourceContentTransferred !== true
  || symbolRequestExecution?.server?.symbolRequestSent !== true
  || symbolRequestExecution?.server?.symbolRequestMethod !== "textDocument/definition"
  || symbolRequestExecution?.server?.symbolResponseObserved !== true
  || symbolRequestExecution?.server?.symbolResponseSummary?.resultKind !== "array"
  || symbolRequestExecution?.server?.symbolResponseSummary?.resultCount !== 1
  || symbolRequestExecution?.server?.symbolResponseSummary?.uriCount !== 1
  || symbolRequestExecution?.server?.symbolResponseSummary?.rangeCount !== 1
  || symbolRequestExecution?.server?.symbolResponseSummary?.targetCount !== 1
  || symbolRequestExecution?.server?.symbolResponseSummary?.selectedTarget?.uri !== expectedTargetUri
  || symbolRequestExecution?.server?.symbolResponseSummary?.rawResultIncluded !== false
  || symbolRequestExecution?.server?.symbolResponseSummary?.rawTargetsIncluded !== false
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.ok !== true
  || !symbolRequestExecution?.processSupervision?.protocolHandshake?.messagesSent?.includes("textDocument/definition")
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.symbolResponseObserved !== true
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.symbolResponseSummary?.resultCount !== 1
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.symbolRequestsSent !== true
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.symbolRequestMethod !== "textDocument/definition"
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.symbolRequestId !== 3
  || symbolRequestExecution?.processSupervision?.protocolHandshake?.sourceTransfer?.relativePath !== "src/app.ts"
  || symbolRequestExecution?.lifecycleState?.status !== "symbol_request_completed"
  || symbolRequestExecution?.lifecycleState?.process?.longLivedProcessActive !== false
  || symbolRequestExecution?.lifecycleState?.boundaries?.jsonRpcOperationalRequestsEnabled !== true
  || symbolRequestExecution?.lifecycleState?.boundaries?.sourceContentTransferred !== true
  || !String(symbolRequestExecution?.processSupervision?.stderr?.text ?? "").includes("openclaw-fixture-symbol-request-observed")
) {
  throw new Error(`LSP symbol request execution readback mismatch: ${JSON.stringify({ symbolRequestTask, symbolRequestExecution })}`);
}
const symbolRequestStateItem = symbolRequestState.items?.[0];
if (
  symbolRequestTaskReadback.task?.id !== symbolRequestTask.id
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.symbolRequest?.sent !== true
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.symbolRequest?.method !== "textDocument/definition"
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.symbolRequest?.responseSummary?.resultCount !== 1
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.server?.symbolRequestSent !== true
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.server?.symbolRequestMethod !== "textDocument/definition"
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.server?.symbolResponseSummary?.rangeCount !== 1
  || symbolRequestTaskReadback.task?.engineeringLspLifecycle?.server?.symbolResponseSummary?.targetCount !== 1
  || symbolRequestState.registry !== "openclaw-native-engineering-lsp-lifecycle-state-v0"
  || symbolRequestState.summary?.jsonRpcEnabled !== true
  || symbolRequestState.summary?.jsonRpcOperationalRequestsEnabled !== true
  || symbolRequestState.summary?.sourceContentTransferred !== true
  || symbolRequestState.summary?.activeLongLivedProcesses !== 0
  || symbolRequestStateItem?.sourceTaskId !== symbolRequestTask.id
  || symbolRequestStateItem?.lifecycleAction !== "symbol_request"
  || symbolRequestStateItem?.status !== "symbol_request_completed"
  || symbolRequestStateItem?.server?.symbolRequestSent !== true
  || symbolRequestStateItem?.server?.symbolRequestMethod !== "textDocument/definition"
  || symbolRequestStateItem?.server?.symbolResponseSummary?.resultCount !== 1
  || symbolRequestStateItem?.server?.symbolResponseSummary?.selectedTarget?.uri !== expectedTargetUri
  || symbolRequestStateItem?.server?.symbolResponseSummary?.selectedTarget?.range?.start?.line !== 1
  || symbolRequestStateItem?.process?.protocolHandshake?.symbolRequestsSent !== true
  || symbolRequestStateItem?.boundaries?.jsonRpcOperationalRequestsEnabled !== true
  || symbolRequestStateItem?.boundaries?.sourceContentTransferred !== true
) {
  throw new Error(`LSP lifecycle state should record symbol request readback: ${JSON.stringify({ symbolRequestTaskReadback, symbolRequestState })}`);
}
const symbolExecutionRaw = JSON.stringify({ symbolRequestTaskResponse, symbolRequestBlockedStep, symbolRequestApproved, symbolRequestStep, symbolRequestTaskReadback, symbolRequestState });
if (symbolExecutionRaw.includes("OpenClawNeedle")) {
  throw new Error("LSP symbol request execution leaked source body instead of bounded metadata");
}
if (
  !symbolTargetBridge.ok
  || symbolTargetBridge.registry !== "openclaw-native-engineering-lsp-selected-target-read-bridge-v0"
  || symbolTargetBridge.mode !== "lsp-selected-target-to-native-read-bridge"
  || symbolTargetBridge.sourceRecord?.sourceTaskId !== symbolRequestTask.id
  || symbolTargetBridge.sourceRecord?.responseSummary?.rawResultIncluded !== false
  || symbolTargetBridge.sourceRecord?.responseSummary?.rawTargetsIncluded !== false
  || symbolTargetBridge.selectedTarget?.uri !== expectedTargetUri
  || symbolTargetBridge.target?.relativePath !== "src/app.ts"
  || symbolTargetBridge.target?.startLine !== 2
  || symbolTargetBridge.target?.endLine !== 2
  || symbolTargetBridge.readRequest?.operatorActionRequired !== false
  || symbolTargetBridge.readResult?.ok !== true
  || symbolTargetBridge.readResult?.operation !== "read"
  || symbolTargetBridge.readResult?.target?.relativePath !== "src/app.ts"
  || symbolTargetBridge.readResult?.summary?.lineCount !== 1
  || !String(symbolTargetBridge.readResult?.content ?? "").includes("OpenClawNeedle")
  || symbolTargetBridge.governance?.canStartLspServer !== false
  || symbolTargetBridge.governance?.canSendJsonRpcRequest !== false
  || symbolTargetBridge.governance?.canMutateWorkspace !== false
  || symbolTargetBridge.bounds?.workspaceRootConstrained !== true
  || symbolTargetBridge.bounds?.noRawLspPayload !== true
  || symbolTargetBridge.bounds?.noWorkspaceMutation !== true
) {
  throw new Error(`LSP selected-target read bridge mismatch: ${JSON.stringify(symbolTargetBridge)}`);
}
if (
  !symbolEditSeed.ok
  || symbolEditSeed.registry !== "openclaw-native-engineering-lsp-selected-target-edit-proposal-seed-v0"
  || symbolEditSeed.mode !== "lsp-selected-target-edit-proposal-seed"
  || symbolEditSeed.seed?.relativePath !== "src/app.ts"
  || symbolEditSeed.seed?.sourceTaskId !== symbolRequestTask.id
  || !String(symbolEditSeed.seed?.oldString ?? "").includes("OpenClawNeedle")
  || symbolEditSeed.seed?.newStringProvided !== true
  || symbolEditSeed.editProposal?.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || symbolEditSeed.editProposal?.target?.relativePath !== "src/app.ts"
  || symbolEditSeed.editProposal?.summary?.createsTask !== false
  || symbolEditSeed.editProposal?.summary?.createsApproval !== false
  || symbolEditSeed.editProposal?.summary?.canMutate !== false
  || symbolEditSeed.editProposal?.governance?.canApplyPatch !== false
  || symbolEditSeed.editProposal?.governance?.requiresApprovalBeforeApply !== true
  || !symbolEditSeed.editProposal?.diffPreview?.lines?.some((line) => line.type === "add" && String(line.text).includes("OpenClawNeedleSelected"))
  || symbolEditSeed.governance?.canBuildEditProposal !== true
  || symbolEditSeed.governance?.canCreateTask !== false
  || symbolEditSeed.governance?.canCreateApproval !== false
  || symbolEditSeed.governance?.canMutateWorkspace !== false
  || symbolEditSeed.bounds?.usesSelectedTargetReadBridge !== true
  || symbolEditSeed.bounds?.noAutomaticTaskCreation !== true
  || symbolEditSeed.bounds?.noWorkspaceMutation !== true
) {
  throw new Error(`LSP selected-target edit proposal seed mismatch: ${JSON.stringify(symbolEditSeed)}`);
}
const eventTypes = new Set((events.items ?? events.events ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.approved", "policy.evaluated"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`LSP lifecycle audit trail missing ${type}: ${JSON.stringify([...eventTypes])}`);
  }
}
if (!eventTypes.has("task.failed") && !eventTypes.has("task.completed")) {
  throw new Error(`LSP lifecycle audit trail should record terminal task event: ${JSON.stringify([...eventTypes])}`);
}
for (const token of [
  "no server binary version check",
  "no LSP server process start",
  "no lifecycle task creation",
  "lsp-didopen-source-transfer-proposal-only",
  "approval-gated-lsp-source-transfer-didopen",
  "didopen_source_transfer_completed_symbol_requests_deferred",
  "lsp-symbol-request-proposal-only",
  "approval-gated-lsp-symbol-request",
  "symbol_request_completed_long_lived_pool_deferred",
  "openclaw-native-engineering-lsp-selected-target-read-bridge-v0",
  "lsp-selected-target-to-native-read-bridge",
  "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
  "openclaw-native-engineering-lsp-selected-target-edit-proposal-seed-v0",
  "lsp-selected-target-edit-proposal-seed",
  "plan.openclaw.engineering_tool.lsp_selected_target_edit_proposal_seed",
  "no textDocument/didOpen notification sent",
  "approval-gated-lsp-lifecycle-binary-gate",
  "approved-lsp-lifecycle-binary-gate",
  "no file content read into LSP",
  "no definition/references/hover JSON-RPC request",
]) {
  if (!raw.includes(token)) {
    throw new Error(`LSP evidence missing boundary token: ${token}`);
  }
}
for (const token of [
  "ENGINEERING_LSP_EVIDENCE_NODE_MODULES_SECRET",
  "ENGINEERING_LSP_EVIDENCE_CACHE_SECRET",
  "ENGINEERING_LSP_EVIDENCE_GENERATED_SECRET",
]) {
  if (raw.includes(token)) {
    throw new Error(`LSP evidence leaked skipped fixture secret: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringLspEvidence: {
    registry: check.registry,
    lifecycleRegistry: draft.registry,
    sourceTransferRegistry: sourceTransfer.registry,
    symbolRequestTaskMode: symbolRequestTaskResponse.mode,
    lifecycleTaskRegistry: taskResponse.registry,
    lifecycleExecutionRegistry: execution.registry,
    lifecycleStateRegistry: lifecycleState.registry,
    lifecycleProcessState: supervisedExecution.result.state,
    lifecycleFinalState: sourceTransferStateItem.status,
    languages: check.summary.detectedLanguages,
    lifecycleAction: draft.summary.lifecycleAction,
    sourceTransferPath: sourceTransfer.file.relativePath,
    sourceTransferDidOpenSent: sourceTransfer.proposedDidOpen.sent,
    sourceTransferTaskStatus: sourceTransferTask.status,
    approvedSourceTransferDidOpenSent: sourceTransferExecution.server.didOpenSent,
    approvedSourceTransferState: sourceTransferExecution.result.state,
    symbolRequestRegistry: symbolRequest.registry,
    symbolRequestMethod: symbolRequest.proposedJsonRpc.method,
    approvedSymbolRequestSent: symbolRequestExecution.server.symbolRequestSent,
    approvedSymbolRequestState: symbolRequestExecution.result.state,
    approvedSymbolRequestMethod: symbolRequestExecution.server.symbolRequestMethod,
    approvedSymbolResponseResults: symbolRequestExecution.server.symbolResponseSummary.resultCount,
    approvedSymbolResponseTargets: symbolRequestExecution.server.symbolResponseSummary.targetCount,
    selectedTargetReadBridgeRegistry: symbolTargetBridge.registry,
    selectedTargetReadBridgePath: symbolTargetBridge.target.relativePath,
    selectedTargetReadBridgeLines: symbolTargetBridge.readResult.summary.lineCount,
    selectedTargetEditSeedRegistry: symbolEditSeed.registry,
    selectedTargetEditSeedProposal: symbolEditSeed.editProposal.registry,
    serverStatus: check.serverReadiness.status,
    lifecycleTaskStatus: lifecycleTask.status,
    binaryFound: execution.server.binaryFound,
    processStarted: execution.server.processStarted,
    jsonRpcSent: execution.server.jsonRpcHandshakeSent,
    supervisedProcessStarted: supervisedExecution.server.processStarted,
    supervisedProcessTerminated: supervisedExecution.server.processTerminated,
    supervisedJsonRpcSent: supervisedExecution.server.jsonRpcHandshakeSent,
    stopLifecycleState: stopExecution.result.state,
    restartLifecycleState: restartExecution.result.state,
    handshakeLifecycleState: handshakeExecution.result.state,
    handshakeJsonRpcSent: handshakeExecution.server.jsonRpcHandshakeSent,
    lifecycleStateRecords: symbolRequestState.summary.totalRecords,
    badPathStatus: badStatus,
    lspEvidenceJsonRpcSent: check.summary.jsonRpcSent,
  },
}, null, 2));
EOF
