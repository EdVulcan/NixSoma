#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-edit-proposal-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_FILE="$WORKSPACE_DIR/package.json"

source "$SCRIPT_DIR/openclaw-engineering-edit-proposal-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10030}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10031}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10032}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10033}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10034}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10035}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10036}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10037}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10038}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-edit-proposal-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-edit-proposal-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OLD_TEXT="OpenClaw%20on%20NixOS%20monorepo%20skeleton"
NEW_TEXT="OpenClaw%20on%20NixOS%20native%20agent%20body%20skeleton"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_edit_proposal_fixture "$WORKSPACE_DIR" "ENGINEERING_EDIT_PROPOSAL"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f "${PROPOSAL_FILE:-}" "${DUPLICATE_FILE:-}" "${LARGE_FILE:-}" "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PROPOSAL_FILE="$(mktemp)"
DUPLICATE_FILE="$(mktemp)"
LARGE_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-edit-proposal/draft?relativePath=package.json&oldString=$OLD_TEXT&newString=$NEW_TEXT&contextLines=1&maxOutputChars=8000" > "$PROPOSAL_FILE"
DUPLICATE_STATUS="$(curl --silent --output "$DUPLICATE_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-edit-proposal/draft?relativePath=src/duplicate.ts&oldString=repeat&newString=once&contextLines=1")"
LARGE_STATUS="$(curl --silent --output "$LARGE_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-edit-proposal/draft?relativePath=src/large.txt&oldString=x&newString=y&maxFileSizeBytes=256")"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$PROPOSAL_FILE" "$DUPLICATE_FILE" "$DUPLICATE_STATUS" "$LARGE_FILE" "$LARGE_STATUS" "$ADAPTER_FILE" "$TARGET_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const proposal = readJson(2);
const duplicate = readJson(3);
const duplicateStatus = process.argv[4];
const large = readJson(5);
const largeStatus = process.argv[6];
const adapter = readJson(7);
const targetFile = process.argv[8];
const targetText = fs.readFileSync(targetFile, "utf8");
const raw = JSON.stringify({ proposal, duplicate, large, adapter });

if (
  !proposal.ok
  || proposal.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || proposal.mode !== "surgical-edit-proposal-diff-preview-only"
  || proposal.capability?.id !== "act.openclaw.engineering_tool.edit_proposal"
  || proposal.sourceCapability?.sourceToolName !== "cc_edit"
  || proposal.validation?.exactReplacement?.uniqueExactMatch !== true
  || proposal.summary?.replacementsAvailable !== 1
  || proposal.summary?.createsTask !== false
  || proposal.summary?.createsApproval !== false
  || proposal.summary?.canMutate !== false
  || proposal.governance?.canApplyPatch !== false
  || proposal.governance?.requiresApprovalBeforeApply !== true
  || proposal.governance?.canMutate !== false
  || proposal.governance?.createsTask !== false
  || proposal.governance?.createsApproval !== false
  || proposal.governance?.canExecuteToolCode !== false
  || proposal.governance?.canRunVerification !== false
  || proposal.target?.contentExposed !== false
  || proposal.target?.diffPreviewExposed !== true
  || proposal.auditEvidence?.operation !== "edit_proposal"
  || proposal.auditEvidence?.evidenceKind !== "response_embedded_audit_evidence"
  || proposal.diffPreview?.format !== "bounded-line-diff-v0"
  || !proposal.diffPreview?.lines?.some((line) => line.type === "remove" && line.text.includes("OpenClaw on NixOS monorepo skeleton"))
  || !proposal.diffPreview?.lines?.some((line) => line.type === "add" && line.text.includes("OpenClaw on NixOS native agent body skeleton"))
) {
  throw new Error(`edit proposal mismatch: ${JSON.stringify(proposal)}`);
}
if (duplicateStatus !== "400" || duplicate.ok !== false || !String(duplicate.error ?? "").includes("exactly one match")) {
  throw new Error(`duplicate match should be rejected with 400: status=${duplicateStatus} body=${JSON.stringify(duplicate)}`);
}
if (largeStatus !== "400" || large.ok !== false || !String(large.error ?? "").includes("cannot read target")) {
  throw new Error(`large target should be rejected with 400: status=${largeStatus} body=${JSON.stringify(large)}`);
}
if (
  !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.edit_proposal")
  || adapter.summary?.canBuildSurgicalEngineeringEditProposals !== true
) {
  throw new Error(`native adapter missing edit proposal capability: ${JSON.stringify(adapter)}`);
}
if (!targetText.includes("OpenClaw on NixOS monorepo skeleton") || targetText.includes("native agent body skeleton")) {
  throw new Error(`edit proposal unexpectedly mutated target file: ${targetText}`);
}
for (const secret of [
  "ENGINEERING_EDIT_PROPOSAL_NODE_MODULES_SECRET",
  "ENGINEERING_EDIT_PROPOSAL_CACHE_SECRET",
  "ENGINEERING_EDIT_PROPOSAL_GENERATED_SECRET",
]) {
  if (raw.includes(secret)) {
    throw new Error(`edit proposal leaked skipped directory secret: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringEditProposal: {
    registry: proposal.registry,
    mode: proposal.mode,
    previewLines: proposal.diffPreview.previewLineCount,
    duplicateStatus,
    largeStatus,
    canApplyPatch: proposal.governance.canApplyPatch,
  },
}, null, 2));
EOF
