#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-edit-proposal-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_FILE="$WORKSPACE_DIR/package.json"

source "$SCRIPT_DIR/openclaw-engineering-edit-proposal-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10050}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10051}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10052}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10053}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10054}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10055}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10056}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10057}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10058}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-edit-proposal-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-edit-proposal-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
OLD_TEXT="OpenClaw%20on%20NixOS%20monorepo%20skeleton"
NEW_TEXT="OpenClaw%20on%20NixOS%20native%20agent%20body%20skeleton"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_edit_proposal_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_EDIT_PROPOSAL"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${PROPOSAL_FILE:-}" "${DUPLICATE_FILE:-}" "${CAPABILITY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
PROPOSAL_FILE="$(mktemp)"
DUPLICATE_FILE="$(mktemp)"
CAPABILITY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-edit-proposal/draft?relativePath=package.json&oldString=$OLD_TEXT&newString=$NEW_TEXT&contextLines=1&maxOutputChars=8000" > "$PROPOSAL_FILE"
DUPLICATE_STATUS="$(curl --silent --output "$DUPLICATE_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-edit-proposal/draft?relativePath=src/duplicate.ts&oldString=repeat&newString=once&contextLines=1")"
curl --silent --fail -X POST "$CORE_URL/capabilities/invoke" \
  -H 'content-type: application/json' \
  --data '{"capabilityId":"act.openclaw.engineering_tool.edit_proposal","intent":"engineering.edit_proposal","params":{"relativePath":"package.json","oldString":"OpenClaw on NixOS monorepo skeleton","newString":"OpenClaw on NixOS native agent body skeleton","contextLines":1,"maxOutputChars":8000}}' \
  > "$CAPABILITY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$PROPOSAL_FILE" "$DUPLICATE_FILE" "$DUPLICATE_STATUS" "$TARGET_FILE" "$CAPABILITY_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const proposal = readJson(4);
const duplicate = readJson(5);
const duplicateStatus = process.argv[6];
const targetFile = process.argv[7];
const capability = readJson(8);
const targetText = fs.readFileSync(targetFile, "utf8");
const raw = JSON.stringify({ html, client, proposal, duplicate, capability });

for (const token of [
  "OpenClaw Engineering Edit Proposal",
  "engineering-edit-proposal-registry",
  "engineering-edit-proposal-target",
  "engineering-edit-proposal-preview",
  "engineering-edit-proposal-apply",
  "engineering-edit-proposal-audit",
  "engineering-edit-proposal-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering edit proposal token: ${token}`);
  }
}
for (const token of [
  "/capabilities/invoke",
  "engineering.edit_proposal",
  "refreshEngineeringEditProposal",
  "renderEngineeringEditProposal",
  "Native governed edit proposal",
  "act.openclaw.engineering_tool.edit_proposal",
  "surgical-edit-proposal-diff-preview-only",
  "engineering-edit-proposal-task-button",
  "engineering-edit-proposal-tasks",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering edit proposal token: ${token}`);
  }
}
if (
  !capability.ok
  || capability.invoked !== true
  || capability.capability?.id !== "act.openclaw.engineering_tool.edit_proposal"
  || capability.result?.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || capability.result?.summary?.editCount !== 1
  || capability.summary?.kind !== "engineering.edit_proposal"
  || capability.summary?.noMutation !== true
  || capability.summary?.noTaskCreation !== true
  || capability.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer common edit proposal capability mismatch: ${JSON.stringify(capability)}`);
}
const refreshStart = client.indexOf("async function refreshEngineeringEditProposal");
const refreshEnd = client.indexOf("\nasync function ", refreshStart + 1);
const refreshBody = refreshStart >= 0
  ? client.slice(refreshStart, refreshEnd >= 0 ? refreshEnd : undefined)
  : "";
if (refreshBody.includes("engineering-edit-proposal-tasks") || refreshBody.includes("engineering-edit-proposal-task-button")) {
  throw new Error("Observer edit proposal refresh must not create or trigger an edit task");
}
if (
  !proposal.ok
  || proposal.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || proposal.mode !== "surgical-edit-proposal-diff-preview-only"
  || proposal.capability?.id !== "act.openclaw.engineering_tool.edit_proposal"
  || proposal.validation?.exactReplacement?.uniqueExactMatch !== true
  || proposal.summary?.createsTask !== false
  || proposal.summary?.createsApproval !== false
  || proposal.governance?.canApplyPatch !== false
  || proposal.target?.contentExposed !== false
  || proposal.target?.diffPreviewExposed !== true
  || proposal.auditEvidence?.operation !== "edit_proposal"
  || !proposal.diffPreview?.lines?.some((line) => line.type === "remove" && line.text.includes("OpenClaw on NixOS monorepo skeleton"))
  || !proposal.diffPreview?.lines?.some((line) => line.type === "add" && line.text.includes("OpenClaw on NixOS native agent body skeleton"))
) {
  throw new Error(`Observer edit proposal evidence mismatch: ${JSON.stringify(proposal)}`);
}
if (duplicateStatus !== "400" || duplicate.ok !== false || !String(duplicate.error ?? "").includes("exactly one match")) {
  throw new Error(`Observer duplicate match should be rejected with 400: status=${duplicateStatus} body=${JSON.stringify(duplicate)}`);
}
if (!targetText.includes("OpenClaw on NixOS monorepo skeleton") || targetText.includes("native agent body skeleton")) {
  throw new Error(`Observer edit proposal unexpectedly mutated target file: ${targetText}`);
}
for (const secret of [
  "OBSERVER_ENGINEERING_EDIT_PROPOSAL_NODE_MODULES_SECRET",
  "OBSERVER_ENGINEERING_EDIT_PROPOSAL_CACHE_SECRET",
  "OBSERVER_ENGINEERING_EDIT_PROPOSAL_GENERATED_SECRET",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer edit proposal leaked skipped directory secret: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringEditProposal: {
    html: "visible",
    client: "visible",
    registry: proposal.registry,
    previewLines: proposal.diffPreview.previewLineCount,
    duplicateStatus,
  },
}, null, 2));
EOF
