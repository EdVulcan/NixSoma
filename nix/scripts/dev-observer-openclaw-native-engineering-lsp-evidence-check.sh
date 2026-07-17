#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-lsp-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"
# Protected Core mutations/read models require the same operator identity as Observer.
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10260}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10261}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10262}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10263}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10264}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10265}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10266}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10267}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10268}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-lsp-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-lsp-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_LSP_EVIDENCE"
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
export const observerLspScriptMarker = "OpenClaw Observer LSP evidence javascript";
JS
cat > "$WORKSPACE_DIR/pyproject.toml" <<'TOML'
[project]
name = "observer-openclaw-lsp-evidence-fixture"
TOML
cat > "$WORKSPACE_DIR/python/agent.py" <<'PY'
def observer_lsp_agent_marker():
    return "OpenClaw Observer LSP evidence python"
PY
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${EVIDENCE_FILE:-}" \
    "${DRAFT_FILE:-}" \
    "${SOURCE_TRANSFER_FILE:-}" \
    "${SYMBOL_REQUEST_FILE:-}" \
    "${CAPABILITY_EVIDENCE_FILE:-}" \
    "${CAPABILITY_LIFECYCLE_FILE:-}" \
    "${CAPABILITY_SOURCE_TRANSFER_FILE:-}" \
    "${CAPABILITY_SYMBOL_REQUEST_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
SOURCE_TRANSFER_FILE="$(mktemp)"
SYMBOL_REQUEST_FILE="$(mktemp)"
CAPABILITY_EVIDENCE_FILE="$(mktemp)"
CAPABILITY_LIFECYCLE_FILE="$(mktemp)"
CAPABILITY_SOURCE_TRANSFER_FILE="$(mktemp)"
CAPABILITY_SYMBOL_REQUEST_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=check&language=typescript&limit=200" > "$EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-draft?language=typescript&lifecycleAction=start&limit=200" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/source-transfer-proposal?language=typescript&relativePath=src/app.ts&maxPreviewChars=1200" > "$SOURCE_TRANSFER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/symbol-request-proposal?language=typescript&action=definition&relativePath=src/app.ts&line=2&character=14" > "$SYMBOL_REQUEST_FILE"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.openclaw.engineering_tool.lsp_evidence","intent":"engineering.lsp.evidence","params":{"action":"check","language":"typescript","limit":200}}' \
  > "$CAPABILITY_EVIDENCE_FILE"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"plan.openclaw.engineering_tool.lsp_lifecycle","intent":"engineering.lsp.lifecycle","params":{"language":"typescript","lifecycleAction":"start","limit":200}}' \
  > "$CAPABILITY_LIFECYCLE_FILE"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"plan.openclaw.engineering_tool.lsp_source_transfer","intent":"engineering.lsp.source_transfer","params":{"language":"typescript","relativePath":"src/app.ts","maxPreviewChars":1200}}' \
  > "$CAPABILITY_SOURCE_TRANSFER_FILE"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"plan.openclaw.engineering_tool.lsp_symbol_request","intent":"engineering.lsp.symbol_request","params":{"language":"typescript","action":"definition","relativePath":"src/app.ts","line":2,"character":14}}' \
  > "$CAPABILITY_SYMBOL_REQUEST_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$EVIDENCE_FILE" "$DRAFT_FILE" "$SOURCE_TRANSFER_FILE" "$SYMBOL_REQUEST_FILE" "$CAPABILITY_EVIDENCE_FILE" "$CAPABILITY_LIFECYCLE_FILE" "$CAPABILITY_SOURCE_TRANSFER_FILE" "$CAPABILITY_SYMBOL_REQUEST_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const evidence = readJson(4);
const draft = readJson(5);
const sourceTransfer = readJson(6);
const symbolRequest = readJson(7);
const capabilityEvidence = readJson(8);
const capabilityLifecycle = readJson(9);
const capabilitySourceTransfer = readJson(10);
const capabilitySymbolRequest = readJson(11);
const raw = JSON.stringify({ evidence, draft, sourceTransfer, symbolRequest });

for (const token of [
  "OpenClaw Engineering LSP Evidence / Lifecycle / Source / Symbol",
  "engineering-lsp-registry",
  "engineering-lsp-languages",
  "engineering-lsp-server",
  "engineering-lsp-runtime",
  "engineering-lsp-mode",
  "engineering-lsp-lifecycle-task-button",
  "engineering-lsp-source-transfer-task-button",
  "engineering-lsp-symbol-request-task-button",
  "engineering-lsp-references-task-button",
  "engineering-lsp-hover-task-button",
  "engineering-loop-selected-target-read-button",
  "engineering-loop-selected-target-edit-seed-button",
  "engineering-lsp-target-selection-panel",
  "engineering-lsp-target-select",
  "engineering-lsp-target-selection-status",
  "Create Definition Task",
  "Create Source Transfer Task",
  "Create References Task",
  "Create Hover Task",
  "Read Selected Target",
  "Seed Edit Proposal",
  "engineering-lsp-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering LSP token: ${token}`);
  }
}
for (const token of [
  "/capabilities/invoke",
  "sense.openclaw.engineering_tool.lsp_evidence",
  "plan.openclaw.engineering_tool.lsp_lifecycle",
  "plan.openclaw.engineering_tool.lsp_source_transfer",
  "plan.openclaw.engineering_tool.lsp_symbol_request",
  "engineering.lsp.evidence",
  "engineering.lsp.lifecycle",
  "engineering.lsp.source_transfer",
  "engineering.lsp.symbol_request",
  "/plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed",
  "/plugins/native-adapter/engineering-lsp/lifecycle-tasks",
  "/tasks/",
  "refreshEngineeringLspEvidence",
  "renderEngineeringLspEvidence",
  "createEngineeringLspLifecycleLoopTask",
  "createEngineeringLspSourceTransferLoopTask",
  "createEngineeringLspSymbolRequestLoopTask",
  "readEngineeringLoopSelectedTarget",
  "renderEngineeringLspTargetSelection",
  "engineeringLspSelectedTargetIndex",
  "engineeringLspSelectedTargetReadCapabilityRequest",
  "seedEngineeringLoopSelectedTargetEditProposal",
  "engineeringLspSelectedTargetEditProposalSeedRoute",
  "renderEngineeringLspLifecycleLoopTaskState",
  "engineeringLspLifecycle",
  "lsp-lifecycle",
  "source_transfer",
  "symbol_request",
  "references",
  "hover",
  "approval-gated lifecycle process only",
  "approved execution may send initialize plus didOpen only",
  "approved execution may send didOpen plus one symbol request only",
  "symbol=${Boolean",
  "aliveAtProbe",
  "processTerminated",
  "Lifecycle State",
  "Symbol Response",
  "Selected Target",
  "Selected Target Read Bridge",
  "Target Selection",
  "targetIndex=",
  "explicitly selected LSP target",
  "lsp-selected-target-read",
  "lsp-selected-target-edit-seed",
  "edit replacement text, then create edit task",
  "review selected target read preview",
  "rawTargets",
  "Missing server binaries become recoverable task evidence",
  "Native engineering LSP evidence",
  "sense.openclaw.engineering_tool.lsp_evidence",
  "lsp-contract-and-availability-evidence-only",
  "lsp-lifecycle-readiness-draft-only",
  "Lifecycle draft",
  "Source transfer proposal",
  "Symbol request proposal",
  "lsp-symbol-request-proposal-only",
  "definition/references/hover request through a short-lived LSP process",
  "send didOpen",
  "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering LSP token: ${token}`);
  }
}
if (client.includes("observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/selected-target-read-bridge")) {
  throw new Error("Observer LSP selected-target reads must use the common capability runtime");
}
for (const directRoute of [
  "/plugins/native-adapter/engineering-lsp/evidence",
  "/plugins/native-adapter/engineering-lsp/lifecycle-draft",
  "/plugins/native-adapter/engineering-lsp/source-transfer-proposal",
  "/plugins/native-adapter/engineering-lsp/symbol-request-proposal",
]) {
  if (client.includes(`observerConfig.coreUrl}${directRoute}`)) {
    throw new Error(`Observer LSP refresh must use the common capability runtime: ${directRoute}`);
  }
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-lsp-evidence-v0"
  || evidence.summary?.selectedAction !== "check"
  || !evidence.summary?.detectedLanguages?.includes("typescript")
  || !evidence.summary?.detectedLanguages?.includes("javascript")
  || !evidence.summary?.detectedLanguages?.includes("python")
  || evidence.serverReadiness?.status !== "not_checked"
  || evidence.governance?.canCheckServerBinary !== false
  || evidence.governance?.canStartLspServer !== false
  || evidence.governance?.canSendJsonRpcRequest !== false
  || evidence.governance?.canExecuteCommand !== false
  || evidence.governance?.canCallProvider !== false
  || evidence.bounds?.noSourceFileContentRead !== true
  || evidence.bounds?.noLspServerStart !== true
  || evidence.bounds?.noJsonRpcRequest !== true
) {
  throw new Error(`Observer LSP evidence mismatch: ${JSON.stringify(evidence)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-native-engineering-lsp-lifecycle-draft-v0"
  || draft.mode !== "lsp-lifecycle-readiness-draft-only"
  || draft.summary?.selectedLanguage !== "typescript"
  || draft.summary?.lifecycleAction !== "start"
  || draft.summary?.executionReady !== false
  || draft.summary?.canCreateTaskNow !== false
  || draft.lifecycleDraft?.status !== "draft_only"
  || draft.lifecycleDraft?.server?.binaryChecked !== false
  || draft.lifecycleDraft?.server?.processStarted !== false
  || draft.lifecycleDraft?.server?.jsonRpcHandshakeSent !== false
  || draft.governance?.canDraftLifecycleAction !== true
  || draft.governance?.canStartLspServer !== false
  || draft.governance?.canCreateTask !== false
  || draft.governance?.canCreateApproval !== false
  || draft.bounds?.noTaskCreation !== true
  || draft.bounds?.noApprovalCreation !== true
) {
  throw new Error(`Observer LSP lifecycle draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !sourceTransfer.ok
  || sourceTransfer.registry !== "openclaw-native-engineering-lsp-source-transfer-proposal-v0"
  || sourceTransfer.mode !== "lsp-didopen-source-transfer-proposal-only"
  || sourceTransfer.summary?.language !== "typescript"
  || sourceTransfer.file?.relativePath !== "src/app.ts"
  || sourceTransfer.file?.languageId !== "typescript"
  || sourceTransfer.proposedDidOpen?.method !== "textDocument/didOpen"
  || sourceTransfer.proposedDidOpen?.sent !== false
  || sourceTransfer.governance?.canReadWorkspaceSourceForProposal !== true
  || sourceTransfer.governance?.canTransferSourceContentToLsp !== false
  || sourceTransfer.governance?.canSendDidOpen !== false
  || sourceTransfer.governance?.futureSourceTransferRequiresApproval !== true
  || sourceTransfer.bounds?.noLspServerStart !== true
  || sourceTransfer.bounds?.noDidOpenSent !== true
  || sourceTransfer.summary?.sourceContentTransferred !== false
) {
  throw new Error(`Observer LSP source-transfer proposal mismatch: ${JSON.stringify(sourceTransfer)}`);
}
if (
  !symbolRequest.ok
  || symbolRequest.registry !== "openclaw-native-engineering-lsp-symbol-request-proposal-v0"
  || symbolRequest.mode !== "lsp-symbol-request-proposal-only"
  || symbolRequest.summary?.action !== "definition"
  || symbolRequest.prerequisite?.found !== false
  || symbolRequest.proposedJsonRpc?.method !== "textDocument/definition"
  || symbolRequest.proposedJsonRpc?.sent !== false
  || symbolRequest.proposedJsonRpc?.params !== null
  || symbolRequest.governance?.canDraftSymbolRequest !== true
  || symbolRequest.governance?.canSendSymbolRequest !== false
  || symbolRequest.governance?.futureSymbolRequestRequiresApproval !== true
  || symbolRequest.governance?.readyForApprovalTask !== false
  || symbolRequest.bounds?.noSymbolRequestSent !== true
) {
  throw new Error(`Observer LSP symbol request proposal mismatch: ${JSON.stringify(symbolRequest)}`);
}
if (
  !capabilityEvidence.ok
  || capabilityEvidence.invoked !== true
  || capabilityEvidence.capability?.id !== "sense.openclaw.engineering_tool.lsp_evidence"
  || capabilityEvidence.result?.registry !== "openclaw-native-engineering-lsp-evidence-v0"
  || capabilityEvidence.summary?.kind !== "engineering.lsp_evidence"
  || capabilityEvidence.summary?.noSourceContentRead !== true
  || capabilityEvidence.summary?.noServerStart !== true
  || capabilityEvidence.summary?.noJsonRpcRequest !== true
  || capabilityEvidence.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer LSP evidence capability mismatch: ${JSON.stringify(capabilityEvidence)}`);
}
if (
  !capabilityLifecycle.ok
  || capabilityLifecycle.invoked !== true
  || capabilityLifecycle.capability?.id !== "plan.openclaw.engineering_tool.lsp_lifecycle"
  || capabilityLifecycle.result?.registry !== "openclaw-native-engineering-lsp-lifecycle-draft-v0"
  || capabilityLifecycle.summary?.kind !== "engineering.lsp_lifecycle"
  || capabilityLifecycle.summary?.noServerStart !== true
  || capabilityLifecycle.summary?.noTaskCreation !== true
  || capabilityLifecycle.summary?.noApprovalCreation !== true
  || capabilityLifecycle.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer LSP lifecycle capability mismatch: ${JSON.stringify(capabilityLifecycle)}`);
}
if (
  !capabilitySourceTransfer.ok
  || capabilitySourceTransfer.invoked !== true
  || capabilitySourceTransfer.capability?.id !== "plan.openclaw.engineering_tool.lsp_source_transfer"
  || capabilitySourceTransfer.result?.registry !== "openclaw-native-engineering-lsp-source-transfer-proposal-v0"
  || capabilitySourceTransfer.summary?.kind !== "engineering.lsp_source_transfer_proposal"
  || capabilitySourceTransfer.summary?.noSourceTransfer !== true
  || capabilitySourceTransfer.summary?.noServerStart !== true
  || capabilitySourceTransfer.summary?.noTaskCreation !== true
  || capabilitySourceTransfer.summary?.noMutation !== true
  || capabilitySourceTransfer.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer LSP source-transfer capability mismatch: ${JSON.stringify(capabilitySourceTransfer)}`);
}
if (
  !capabilitySymbolRequest.ok
  || capabilitySymbolRequest.invoked !== true
  || capabilitySymbolRequest.capability?.id !== "plan.openclaw.engineering_tool.lsp_symbol_request"
  || capabilitySymbolRequest.result?.registry !== "openclaw-native-engineering-lsp-symbol-request-proposal-v0"
  || capabilitySymbolRequest.summary?.kind !== "engineering.lsp_symbol_request_proposal"
  || capabilitySymbolRequest.summary?.noJsonRpcRequest !== true
  || capabilitySymbolRequest.summary?.noServerStart !== true
  || capabilitySymbolRequest.summary?.noTaskCreation !== true
  || capabilitySymbolRequest.summary?.noMutation !== true
  || capabilitySymbolRequest.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer LSP symbol-request capability mismatch: ${JSON.stringify(capabilitySymbolRequest)}`);
}
if (JSON.stringify([
  capabilityEvidence.invocation,
  capabilityLifecycle.invocation,
  capabilitySourceTransfer.invocation,
  capabilitySymbolRequest.invocation,
]).includes("OpenClawNeedle")) {
  throw new Error("Observer LSP capability invocation evidence must not persist source preview content");
}
for (const secret of [
  "OBSERVER_ENGINEERING_LSP_EVIDENCE_NODE_MODULES_SECRET",
  "OBSERVER_ENGINEERING_LSP_EVIDENCE_CACHE_SECRET",
  "OBSERVER_ENGINEERING_LSP_EVIDENCE_GENERATED_SECRET",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer LSP evidence leaked skipped fixture secret: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringLspEvidence: {
    html: "visible",
    client: "visible",
    registry: evidence.registry,
    lifecycleRegistry: draft.registry,
    sourceTransferRegistry: sourceTransfer.registry,
    symbolRequestRegistry: symbolRequest.registry,
    languages: evidence.summary.detectedLanguages,
    lifecycleAction: draft.summary.lifecycleAction,
    sourceTransferPath: sourceTransfer.file.relativePath,
    sourceTransferDidOpenSent: sourceTransfer.proposedDidOpen.sent,
    capabilityRefresh: [
      capabilityEvidence.capability.id,
      capabilityLifecycle.capability.id,
      capabilitySourceTransfer.capability.id,
      capabilitySymbolRequest.capability.id,
    ],
    selectedTargetReadControl: "visible",
    selectedTargetEditSeedControl: "visible",
    serverStatus: evidence.serverReadiness.status,
  },
}, null, 2));
EOF
