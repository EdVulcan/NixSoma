#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-acpx-codex-bridge-compatibility-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-acpx-codex-bridge-compatibility-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-acpx-codex-bridge-compatibility-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${FIRST_FILE:-}" \
    "${SECOND_FILE:-}" \
    "${BRIDGE_FILE:-}" \
    "${DRAFT_FILE:-}" \
    "${WRITE_PROPOSAL_FILE:-}" \
    "${APPROVALS_FILE:-}" \
    "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
FIRST_FILE="$(mktemp)"
SECOND_FILE="$(mktemp)"
BRIDGE_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
WRITE_PROPOSAL_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:observer-one","agentId":"codex","recordId":"observer-record-one","metadata":{"purpose":"observer","authToken":"OBSERVER_ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK"},"confirm":true}' > "$FIRST_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:observer-two","agentId":"codex","recordId":"observer-record-two","metadata":{"purpose":"observer-second","password":"OBSERVER_ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK"},"confirm":true}' > "$SECOND_FILE"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:observer-one" > "$BRIDGE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-draft?sessionKey=agent:codex:observer-one&command=npx.cmd&wrapperName=observer-codex-acp" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal?sessionKey=agent:codex:observer-one&command=npx.cmd&wrapperName=observer-codex-acp" > "$WRITE_PROPOSAL_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$FIRST_FILE" "$SECOND_FILE" "$BRIDGE_FILE" "$DRAFT_FILE" "$WRITE_PROPOSAL_FILE" "$APPROVALS_FILE" "$HISTORY_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const first = readJson(4);
const second = readJson(5);
const bridge = readJson(6);
const draft = readJson(7);
const writeProposal = readJson(8);
const approvals = readJson(9);
const history = readJson(10);
const raw = JSON.stringify({ html, client, first, second, bridge, draft, writeProposal, approvals, history });

for (const token of [
  "OpenClaw ACPX/Codex Bridge",
  "acpx-codex-bridge-registry",
  "acpx-codex-bridge-sessions",
  "acpx-codex-bridge-selected",
  "acpx-codex-bridge-draft",
  "acpx-codex-bridge-auth",
  "acpx-codex-bridge-runtime",
  "acpx-codex-bridge-mode",
  "acpx-codex-bridge-wrapper-task-button",
  "acpx-codex-bridge-wrapper-write-task-button",
  "acpx-codex-bridge-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ACPX/Codex bridge token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/acpx-codex-bridge-compatibility",
  "/plugins/native-adapter/acpx-codex-bridge-wrapper-draft",
  "/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal",
  "/plugins/native-adapter/acpx-codex-bridge-wrapper-tasks",
  "/plugins/native-adapter/acpx-codex-bridge-wrapper-write-tasks",
  "refreshAcpxCodexBridgeCompatibility",
  "renderAcpxCodexBridgeCompatibility",
  "createAcpxCodexBridgeWrapperApprovalTask",
  "createAcpxCodexBridgeWrapperWriteApprovalTask",
  "ACPX/Codex bridge compatibility",
  "Wrapper draft",
  "Wrapper write proposal",
  "sense.openclaw.acpx_codex_bridge.compatibility",
  "plan.openclaw.acpx_codex_bridge.wrapper_action",
  "plan.openclaw.acpx_codex_bridge.wrapper_write",
  "compatibility-and-persistence-evidence",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ACPX/Codex bridge token: ${token}`);
  }
}
if (!first.ok || first.summary?.created !== true || first.session?.metadata?.authToken !== "[redacted-key]") {
  throw new Error(`first observer ACPX/Codex session record mismatch: ${JSON.stringify(first)}`);
}
if (!second.ok || second.summary?.created !== true || second.session?.metadata?.password !== "[redacted-key]") {
  throw new Error(`second observer ACPX/Codex session record mismatch: ${JSON.stringify(second)}`);
}
if (
  !bridge.ok
  || bridge.registry !== "openclaw-native-acpx-codex-bridge-compatibility-v0"
  || bridge.persistence?.registry !== "openclaw-native-acpx-codex-session-persistence-v0"
  || bridge.persistence?.totalRecords !== 2
  || bridge.persistence?.selectedRecord?.sessionKey !== "agent:codex:observer-one"
  || bridge.authIsolation?.credentialValueRead !== false
  || bridge.governance?.canReadCredentialValue !== false
  || bridge.governance?.canCopyAuthMaterial !== false
  || bridge.governance?.canWriteWrapper !== false
  || bridge.governance?.canExecuteWrapper !== false
  || bridge.governance?.canSpawnCodexAcp !== false
  || bridge.governance?.canCallProvider !== false
  || bridge.governance?.canUseNetwork !== false
  || bridge.governance?.observerVisible !== true
  || bridge.governance?.observerVisibilityDeferred !== false
) {
  throw new Error(`Observer ACPX/Codex bridge read model mismatch: ${JSON.stringify(bridge)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-native-acpx-codex-bridge-wrapper-draft-v0"
  || draft.proposal?.status !== "ready_for_approval_bridge"
  || draft.summary?.readyForApprovalBridge !== true
  || draft.proposal?.wrapper?.relativePath !== ".openclaw/acpx/codex-bridge/observer-codex-acp.sh"
  || draft.proposal?.wrapper?.wrapperWritten !== false
  || draft.proposal?.command?.command !== "npx.cmd"
  || draft.proposal?.command?.commandExecuted !== false
  || draft.proposal?.command?.processSpawned !== false
  || draft.proposal?.authIsolation?.credentialValueRead !== false
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canReadCredentialValue !== false
  || draft.governance?.canCopyAuthMaterial !== false
  || draft.governance?.canWriteWrapper !== false
  || draft.governance?.canExecuteWrapper !== false
  || draft.governance?.canSpawnCodexAcp !== false
  || draft.governance?.canCallProvider !== false
  || draft.governance?.canUseNetwork !== false
) {
  throw new Error(`Observer ACPX/Codex wrapper draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !writeProposal.ok
  || writeProposal.registry !== "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0"
  || writeProposal.proposal?.status !== "ready_for_write_approval"
  || writeProposal.summary?.readyForWriteApproval !== true
  || writeProposal.proposal?.wrapper?.relativePath !== ".openclaw/acpx/codex-bridge/observer-codex-acp.sh"
  || !/^sha256:[a-f0-9]{64}$/.test(writeProposal.proposal?.wrapper?.contentHash ?? "")
  || !String(writeProposal.proposal?.wrapper?.contentPreview ?? "").includes("__OPENCLAW_APPROVED_CODEX_HOME__")
  || writeProposal.proposal?.authIsolation?.credentialValueRead !== false
  || writeProposal.proposal?.authIsolation?.authMaterialCopied !== false
  || writeProposal.proposal?.wrapper?.wrapperWritten !== false
  || writeProposal.proposal?.wrapper?.directoryCreated !== false
  || writeProposal.proposal?.wrapper?.chmodApplied !== false
  || writeProposal.proposal?.command?.commandExecuted !== false
  || writeProposal.proposal?.command?.processSpawned !== false
  || writeProposal.proposal?.writeBoundary?.futureWriteCapabilityId !== "act.openclaw.workspace_text_write"
  || writeProposal.governance?.createsTask !== false
  || writeProposal.governance?.createsApproval !== false
  || writeProposal.governance?.canReadCredentialValue !== false
  || writeProposal.governance?.canCopyAuthMaterial !== false
  || writeProposal.governance?.canWriteWrapper !== false
  || writeProposal.governance?.canExecuteWrapper !== false
  || writeProposal.governance?.canSpawnCodexAcp !== false
  || writeProposal.governance?.canCallProvider !== false
  || writeProposal.governance?.canUseNetwork !== false
) {
  throw new Error(`Observer ACPX/Codex wrapper write proposal mismatch: ${JSON.stringify(writeProposal)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer ACPX/Codex bridge visibility must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer ACPX/Codex bridge visibility must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
for (const secret of [
  "OBSERVER_ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK",
  "OBSERVER_ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer ACPX/Codex bridge leaked secret-like metadata: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeAcpxCodexBridgeCompatibility: {
    html: "visible",
    client: "visible",
    registry: bridge.registry,
    totalRecords: bridge.persistence.totalRecords,
    selectedSession: bridge.persistence.selectedRecord.sessionKey,
    observerVisible: bridge.governance.observerVisible,
    wrapperDraft: draft.proposal.status,
    wrapperWriteProposal: writeProposal.proposal.status,
    wrapperWriteContentHash: writeProposal.proposal.wrapper.contentHash,
    credentialValueRead: bridge.governance.canReadCredentialValue,
    wrapperWritten: bridge.governance.canWriteWrapper,
    processSpawned: bridge.governance.canSpawnCodexAcp,
    network: bridge.governance.canUseNetwork,
  },
}, null, 2));
EOF
