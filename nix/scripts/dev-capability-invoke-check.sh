#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/capability-invoke-fixture"
TOOL_SURFACE_FIXTURE_DIR="$REPO_ROOT/.artifacts/capability-invoke-tool-surface-fixture"
TOOL_SURFACE_WORKSPACE_DIR="$TOOL_SURFACE_FIXTURE_DIR/openclaw"

source "$SCRIPT_DIR/openclaw-engineering-tool-surface-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6900}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6901}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6902}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6903}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6904}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6905}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6906}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6907}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6970}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-capability-invoke-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-capability-invoke-check-events.jsonl}"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$FIXTURE_DIR"
export OPENCLAW_WORKSPACE_ROOTS="$FIXTURE_DIR:$TOOL_SURFACE_WORKSPACE_DIR"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$FIXTURE_DIR"
rm -rf "$TOOL_SURFACE_FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR/nested" "$FIXTURE_DIR/src" "$FIXTURE_DIR/scratch" "$FIXTURE_DIR/.openclaw"
mkdir -p "$TOOL_SURFACE_FIXTURE_DIR"
prepare_engineering_tool_surface_fixture "$TOOL_SURFACE_WORKSPACE_DIR" "CAPABILITY_INVOKE_TOOL_SURFACE"
printf 'OpenClaw capability invoke fixture\n' > "$FIXTURE_DIR/openclaw-capability-invoke.txt"
printf 'Nested invoke search fixture\n' > "$FIXTURE_DIR/nested/search-note.md"
printf 'export const capabilityNeedle = "OpenClaw capability invoke";\n' > "$FIXTURE_DIR/src/app.ts"
printf '%s\n' \
  '# Prompt semantics fixture' \
  'Plan each edit with a diff and patch preview.' \
  'Require approval and safety before command execution.' \
  'Run typecheck, test, lint, and verify after changes.' \
  'The prompt is guidance only and is not product authority.' \
  > "$FIXTURE_DIR/AGENTS.md"

cleanup() {
  rm -f \
    "${VITALS_FILE:-}" \
    "${SCREEN_FILE:-}" \
    "${FILES_FILE:-}" \
    "${SEARCH_FILE:-}" \
    "${ENGINEERING_READ_FILE:-}" \
    "${ENGINEERING_GLOB_FILE:-}" \
    "${ENGINEERING_GREP_FILE:-}" \
    "${ENGINEERING_TOOL_SURFACE_FILE:-}" \
    "${ENGINEERING_VERIFY_FILE:-}" \
    "${ENGINEERING_EDIT_PROPOSAL_FILE:-}" \
    "${ENGINEERING_WRITE_PROPOSAL_FILE:-}" \
    "${WORKSPACE_TEXT_WRITE_UNCONFIRMED_FILE:-}" \
    "${WORKSPACE_TEXT_WRITE_FILE:-}" \
    "${WORKSPACE_PATCH_APPLY_FILE:-}" \
    "${WORK_VIEW_FILE:-}" \
    "${WORK_VIEW_CONTROL_FILE:-}" \
    "${BROWSER_OPEN_FILE:-}" \
    "${SCREEN_KEYBOARD_FILE:-}" \
    "${SCREEN_POINTER_FILE:-}" \
    "${CONTEXT_PACKET_FILE:-}" \
    "${PROVIDER_HANDOFF_FILE:-}" \
    "${ACPX_COMPATIBILITY_FILE:-}" \
    "${PROMPT_PACK_FILE:-}" \
    "${DECLARATIVE_EVOLUTION_FILE:-}" \
    "${CAPABILITIES_FILE:-}" \
    "${PROCESS_FILE:-}" \
    "${BLOCKED_COMMAND_FILE:-}" \
    "${APPROVED_COMMAND_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -rf "$TOOL_SURFACE_FIXTURE_DIR"
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

VITALS_FILE="$(mktemp)"
SCREEN_FILE="$(mktemp)"
FILES_FILE="$(mktemp)"
SEARCH_FILE="$(mktemp)"
ENGINEERING_READ_FILE="$(mktemp)"
ENGINEERING_GLOB_FILE="$(mktemp)"
ENGINEERING_GREP_FILE="$(mktemp)"
ENGINEERING_TOOL_SURFACE_FILE="$(mktemp)"
ENGINEERING_VERIFY_FILE="$(mktemp)"
ENGINEERING_EDIT_PROPOSAL_FILE="$(mktemp)"
ENGINEERING_WRITE_PROPOSAL_FILE="$(mktemp)"
WORKSPACE_TEXT_WRITE_UNCONFIRMED_FILE="$(mktemp)"
WORKSPACE_TEXT_WRITE_FILE="$(mktemp)"
WORKSPACE_PATCH_APPLY_FILE="$(mktemp)"
WORK_VIEW_FILE="$(mktemp)"
WORK_VIEW_CONTROL_FILE="$(mktemp)"
BROWSER_OPEN_FILE="$(mktemp)"
SCREEN_KEYBOARD_FILE="$(mktemp)"
SCREEN_POINTER_FILE="$(mktemp)"
CONTEXT_PACKET_FILE="$(mktemp)"
PROVIDER_HANDOFF_FILE="$(mktemp)"
ACPX_COMPATIBILITY_FILE="$(mktemp)"
PROMPT_PACK_FILE="$(mktemp)"
DECLARATIVE_EVOLUTION_FILE="$(mktemp)"
CAPABILITIES_FILE="$(mktemp)"
PROCESS_FILE="$(mktemp)"
BLOCKED_COMMAND_FILE="$(mktemp)"
APPROVED_COMMAND_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.system.vitals","intent":"system.observe"}' > "$VITALS_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.screen.observe","intent":"screen.observe"}' > "$SCREEN_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.filesystem.read\",\"intent\":\"filesystem.list\",\"operation\":\"list\",\"params\":{\"path\":\"$FIXTURE_DIR\",\"limit\":10}}" > "$FILES_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.filesystem.read\",\"intent\":\"filesystem.search\",\"operation\":\"search\",\"params\":{\"path\":\"$FIXTURE_DIR\",\"query\":\"search-note\",\"limit\":10}}" > "$SEARCH_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.read\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"startLine\":1,\"endLine\":1}}" > "$ENGINEERING_READ_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.glob\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"pattern\":\"src/**/*.ts\",\"limit\":4}}" > "$ENGINEERING_GLOB_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.grep\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"capabilityNeedle\",\"include\":\"src/**/*.ts\",\"literal\":true,\"limit\":4}}" > "$ENGINEERING_GREP_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool_surface_inventory\",\"intent\":\"engineering.tool_surface_inventory\",\"params\":{\"workspacePath\":\"$TOOL_SURFACE_WORKSPACE_DIR\"}}" > "$ENGINEERING_TOOL_SURFACE_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_tool.verify_evidence","params":{"limit":4,"maxOutputChars":500}}' > "$ENGINEERING_VERIFY_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.edit_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"oldString\":\"capabilityNeedle\",\"newString\":\"governedNeedle\",\"contextLines\":1}}" > "$ENGINEERING_EDIT_PROPOSAL_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.write_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/new-file.txt\",\"content\":\"transient write content\",\"overwrite\":false,\"contextLines\":1}}" > "$ENGINEERING_WRITE_PROPOSAL_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_text_write\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/common-write.txt\",\"content\":\"transient common write content\",\"overwrite\":false,\"confirm\":false}}" > "$WORKSPACE_TEXT_WRITE_UNCONFIRMED_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_text_write\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/common-write.txt\",\"content\":\"transient common write content\",\"overwrite\":false,\"confirm\":true}}" > "$WORKSPACE_TEXT_WRITE_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_patch_apply\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"search\":\"capabilityNeedle\",\"replacement\":\"transient common patch replacement\",\"occurrence\":1,\"contextLines\":1,\"confirm\":true}}" > "$WORKSPACE_PATCH_APPLY_FILE"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/capability-work-view"}' > /dev/null
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.work_view.control","operation":"work_view.reveal","params":{"entryUrl":"https://example.com/capability-work-view"}}' > "$WORK_VIEW_CONTROL_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.browser.open","operation":"browser.new_tab","params":{"url":"https://example.com/capability-browser-action"}}' > "$BROWSER_OPEN_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.screen.pointer_keyboard","operation":"keyboard.type","params":{"text":"transient capability input"}}' > "$SCREEN_KEYBOARD_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.screen.pointer_keyboard","operation":"mouse.click","params":{"x":640,"y":360,"button":"left"}}' > "$SCREEN_POINTER_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.packet","params":{"limit":4,"thresholdChars":256,"protectRecentAssistantTurns":0}}' > "$CONTEXT_PACKET_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.work_view_observation"}' > "$WORK_VIEW_FILE"
curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.engineering_context.provider_handoff_task","approved":true,"params":{"confirm":false}}' > "$PROVIDER_HANDOFF_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.acpx_codex_bridge.compatibility"}' > "$ACPX_COMPATIBILITY_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.prompt_pack\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"edit\",\"limit\":8}}" > "$PROMPT_PACK_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"plan.openclaw.declarative_evolution.managed_config_candidate","params":{"changes":[{"operation":"enable_kernel_event_capture","durationMs":1000,"maxEvents":16}]}}' > "$DECLARATIVE_EVOLUTION_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.process.list","intent":"process.list","params":{"limit":20}}' > "$PROCESS_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$BLOCKED_COMMAND_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","approved":true,"params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$APPROVED_COMMAND_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?source=openclaw-core&limit=80" > "$EVENTS_FILE"

node - <<'EOF' \
  "$VITALS_FILE" \
  "$FILES_FILE" \
  "$SEARCH_FILE" \
  "$ENGINEERING_READ_FILE" \
  "$ENGINEERING_GLOB_FILE" \
  "$ENGINEERING_GREP_FILE" \
  "$PROCESS_FILE" \
  "$BLOCKED_COMMAND_FILE" \
  "$APPROVED_COMMAND_FILE" \
  "$EVENTS_FILE" \
  "$ENGINEERING_VERIFY_FILE" \
  "$ENGINEERING_EDIT_PROPOSAL_FILE" \
  "$ENGINEERING_WRITE_PROPOSAL_FILE" \
  "$WORKSPACE_TEXT_WRITE_UNCONFIRMED_FILE" \
  "$WORKSPACE_TEXT_WRITE_FILE" \
  "$WORKSPACE_PATCH_APPLY_FILE" \
  "$WORK_VIEW_FILE" \
  "$WORK_VIEW_CONTROL_FILE" \
  "$CONTEXT_PACKET_FILE" \
  "$PROVIDER_HANDOFF_FILE" \
  "$ACPX_COMPATIBILITY_FILE" \
  "$PROMPT_PACK_FILE" \
  "$CAPABILITIES_FILE" \
  "$FIXTURE_DIR" \
  "$SCREEN_FILE" \
  "$BROWSER_OPEN_FILE" \
  "$SCREEN_KEYBOARD_FILE" \
  "$SCREEN_POINTER_FILE" \
  "$ENGINEERING_TOOL_SURFACE_FILE" \
  "$DECLARATIVE_EVOLUTION_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const vitals = readJson(2);
const files = readJson(3);
const search = readJson(4);
const engineeringRead = readJson(5);
const engineeringGlob = readJson(6);
const engineeringGrep = readJson(7);
const processes = readJson(8);
const blockedCommand = readJson(9);
const approvedCommand = readJson(10);
const events = readJson(11);
const engineeringVerify = readJson(12);
const engineeringEditProposal = readJson(13);
const engineeringWriteProposal = readJson(14);
const workspaceTextWriteUnconfirmed = readJson(15);
const workspaceTextWrite = readJson(16);
const workspacePatchApply = readJson(17);
const workView = readJson(18);
const workViewControl = readJson(19);
const contextPacket = readJson(20);
const providerHandoff = readJson(21);
const acpxCompatibility = readJson(22);
const promptPack = readJson(23);
const capabilities = readJson(24);
const fixtureDir = process.argv[25];
const screen = readJson(26);
const browserOpen = readJson(27);
const screenKeyboard = readJson(28);
const screenPointer = readJson(29);
const engineeringToolSurface = readJson(30);
const declarativeEvolution = readJson(31);

if (!vitals.ok || vitals.invoked !== true || vitals.capability?.id !== "sense.system.vitals" || vitals.policy?.decision !== "audit_only") {
  throw new Error("system vitals capability should be invoked with audit-only governance");
}
if (
  !screen.ok
  || screen.invoked !== true
  || screen.capability?.id !== "sense.screen.observe"
  || screen.result?.registry !== "openclaw-screen-observation-v0"
  || screen.summary?.kind !== "screen.observe"
  || screen.summary?.noScreenPayload !== true
  || screen.summary?.noMutation !== true
  || screen.summary?.noProviderEgress !== true
  || JSON.stringify(screen).includes("snapshotText")
) {
  throw new Error(`screen observation capability should use the bounded screen-sense summary owner: ${JSON.stringify(screen)}`);
}
if (!files.ok || files.invoked !== true || files.result?.path !== fixtureDir || !files.result?.entries?.some((entry) => entry.name === "nested")) {
  throw new Error("filesystem list capability should route through core to allowed fixture root");
}
if (files.policy?.decision !== "audit_only" || files.summary?.kind !== "filesystem.read") {
  throw new Error("filesystem list invocation should remain audited and summarized");
}
if (!search.ok || search.result?.count < 1 || !search.result?.results?.some((entry) => entry.name === "search-note.md")) {
  throw new Error("filesystem search capability should find nested fixture");
}
if (
  !engineeringRead.ok
  || engineeringRead.invoked !== true
  || engineeringRead.capability?.id !== "sense.openclaw.engineering_tool.read"
  || engineeringRead.result?.summary?.lineCount !== 1
  || !engineeringRead.result?.content?.includes("capabilityNeedle")
  || engineeringRead.summary?.kind !== "engineering.read"
  || engineeringRead.policy?.decision !== "audit_only"
) {
  throw new Error(`engineering read capability should use the bounded governed builder: ${JSON.stringify(engineeringRead)}`);
}
if (
  !engineeringGlob.ok
  || engineeringGlob.invoked !== true
  || engineeringGlob.capability?.id !== "sense.openclaw.engineering_tool.glob"
  || engineeringGlob.result?.summary?.matchedResults !== 1
  || engineeringGlob.summary?.kind !== "engineering.glob"
  || engineeringGlob.policy?.decision !== "audit_only"
) {
  throw new Error(`engineering glob capability should use the bounded governed builder: ${JSON.stringify(engineeringGlob)}`);
}
if (
  !engineeringGrep.ok
  || engineeringGrep.invoked !== true
  || engineeringGrep.capability?.id !== "sense.openclaw.engineering_tool.grep"
  || engineeringGrep.result?.summary?.matchedResults !== 1
  || engineeringGrep.summary?.kind !== "engineering.grep"
  || engineeringGrep.policy?.decision !== "audit_only"
) {
  throw new Error(`engineering grep capability should use the bounded governed builder: ${JSON.stringify(engineeringGrep)}`);
}
if (
  !engineeringToolSurface.ok
  || engineeringToolSurface.invoked !== true
  || engineeringToolSurface.capability?.id !== "sense.openclaw.engineering_tool_surface_inventory"
  || engineeringToolSurface.result?.registry !== "openclaw-native-engineering-tool-surface-inventory-v0"
  || engineeringToolSurface.result?.summary?.totalTools !== 10
  || engineeringToolSurface.result?.summary?.coveredTools !== 10
  || engineeringToolSurface.summary?.kind !== "engineering.tool_surface_inventory"
  || engineeringToolSurface.summary?.noSourceContentExposure !== true
  || engineeringToolSurface.summary?.noToolExecution !== true
  || engineeringToolSurface.summary?.noLspStart !== true
  || engineeringToolSurface.summary?.noMutation !== true
  || engineeringToolSurface.summary?.noTaskCreation !== true
  || engineeringToolSurface.summary?.noApprovalCreation !== true
  || engineeringToolSurface.summary?.noProviderEgress !== true
  || engineeringToolSurface.result?.governance?.canExecuteToolCode !== false
  || engineeringToolSurface.result?.governance?.canCallProvider !== false
  || engineeringToolSurface.result?.governance?.canUseNetwork !== false
) {
  throw new Error(`engineering tool surface inventory capability should remain metadata-only: ${JSON.stringify(engineeringToolSurface)}`);
}
if (JSON.stringify(events).includes("CAPABILITY_INVOKE_TOOL_SURFACE_INDEX_SECRET_SOURCE")) {
  throw new Error("engineering tool surface inventory source metadata must not enter audit events");
}
if (
  !engineeringVerify.ok
  || engineeringVerify.invoked !== true
  || engineeringVerify.capability?.id !== "sense.openclaw.engineering_tool.verify_evidence"
  || engineeringVerify.result?.registry !== "openclaw-native-engineering-verification-evidence-v0"
  || engineeringVerify.result?.summary?.total !== 0
  || engineeringVerify.summary?.kind !== "engineering.verification_evidence"
  || engineeringVerify.summary?.noCommandExecution !== true
  || engineeringVerify.result?.governance?.canExecuteCommand !== false
) {
  throw new Error(`verification evidence capability should remain read-only through the governed builder: ${JSON.stringify(engineeringVerify)}`);
}
if (
  !engineeringEditProposal.ok
  || engineeringEditProposal.invoked !== true
  || engineeringEditProposal.capability?.id !== "act.openclaw.engineering_tool.edit_proposal"
  || engineeringEditProposal.result?.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || engineeringEditProposal.result?.summary?.editCount !== 1
  || engineeringEditProposal.result?.governance?.canMutate !== false
  || engineeringEditProposal.result?.governance?.createsTask !== false
  || engineeringEditProposal.summary?.kind !== "engineering.edit_proposal"
  || engineeringEditProposal.summary?.noMutation !== true
  || engineeringEditProposal.summary?.noTaskCreation !== true
  || engineeringEditProposal.summary?.noProviderEgress !== true
  || JSON.stringify(engineeringEditProposal).includes("governedNeedle") === false
) {
  throw new Error(`engineering edit proposal capability should expose only a transient bounded diff proposal: ${JSON.stringify(engineeringEditProposal)}`);
}
if (JSON.stringify(events).includes("governedNeedle")) {
  throw new Error("engineering edit proposal content must not enter the audit event payload");
}
if (
  !engineeringWriteProposal.ok
  || engineeringWriteProposal.invoked !== true
  || engineeringWriteProposal.capability?.id !== "act.openclaw.engineering_tool.write_proposal"
  || engineeringWriteProposal.result?.registry !== "openclaw-native-engineering-write-proposal-v0"
  || engineeringWriteProposal.result?.summary?.proposalKind !== "create_file_proposal"
  || engineeringWriteProposal.result?.target?.contentExposed !== false
  || engineeringWriteProposal.result?.governance?.canMutate !== false
  || engineeringWriteProposal.result?.governance?.createsTask !== false
  || engineeringWriteProposal.summary?.kind !== "engineering.write_proposal"
  || engineeringWriteProposal.summary?.noMutation !== true
  || engineeringWriteProposal.summary?.noTaskCreation !== true
  || engineeringWriteProposal.summary?.noProviderEgress !== true
  || JSON.stringify(engineeringWriteProposal).includes("transient write content")
) {
  throw new Error(`engineering write proposal capability should retain redacted metadata only: ${JSON.stringify(engineeringWriteProposal)}`);
}
if (JSON.stringify(events).includes("transient write content")) {
  throw new Error("engineering write proposal content must not enter the audit event payload");
}
if (!workspaceTextWriteUnconfirmed.ok
  || workspaceTextWriteUnconfirmed.invoked !== true
  || workspaceTextWriteUnconfirmed.result?.blocked !== true
  || workspaceTextWriteUnconfirmed.result?.reason !== "operator_confirmation_required"
  || workspaceTextWriteUnconfirmed.summary?.kind !== "workspace.text_write_task"
  || workspaceTextWriteUnconfirmed.summary?.createsTask !== false
  || workspaceTextWriteUnconfirmed.summary?.noContentInInvocation !== true
) {
  throw new Error(`workspace text write must keep its explicit confirmation gate after capability approval: ${JSON.stringify(workspaceTextWriteUnconfirmed)}`);
}
if (!workspaceTextWrite.ok
  || workspaceTextWrite.invoked !== true
  || workspaceTextWrite.capability?.id !== "act.openclaw.workspace_text_write"
  || workspaceTextWrite.policy?.decision !== "audit_only"
  || workspaceTextWrite.result?.registry !== "openclaw-native-workspace-text-write-task-v0"
  || workspaceTextWrite.result?.task?.status !== "queued"
  || workspaceTextWrite.result?.approval?.status !== "pending"
  || workspaceTextWrite.result?.target?.contentExposed !== false
  || workspaceTextWrite.summary?.kind !== "workspace.text_write_task"
  || workspaceTextWrite.summary?.createsTask !== true
  || workspaceTextWrite.summary?.createsApproval !== true
  || workspaceTextWrite.summary?.noMutationBeforeApproval !== true
  || workspaceTextWrite.summary?.noContentInInvocation !== true
  || workspaceTextWrite.summary?.noReplacementInInvocation !== true
  || workspaceTextWrite.summary?.noFullDiffInInvocation !== true
  || workspaceTextWrite.summary?.noProviderEgress !== true
  || JSON.stringify(workspaceTextWrite.invocation ?? {}).includes("transient common write content")
) {
  throw new Error(`workspace text write capability should delegate to the existing approval owner without persisting content: ${JSON.stringify(workspaceTextWrite)}`);
}
if (!workspacePatchApply.ok
  || workspacePatchApply.invoked !== true
  || workspacePatchApply.capability?.id !== "act.openclaw.workspace_patch_apply"
  || workspacePatchApply.policy?.decision !== "audit_only"
  || workspacePatchApply.result?.registry !== "openclaw-native-workspace-patch-apply-task-v0"
  || workspacePatchApply.result?.task?.status !== "queued"
  || workspacePatchApply.result?.approval?.status !== "pending"
  || workspacePatchApply.result?.target?.contentExposed !== false
  || workspacePatchApply.result?.target?.diffPreviewExposed !== true
  || workspacePatchApply.summary?.kind !== "workspace.patch_apply_task"
  || workspacePatchApply.summary?.createsTask !== true
  || workspacePatchApply.summary?.createsApproval !== true
  || workspacePatchApply.summary?.diffPreviewExposed !== true
  || workspacePatchApply.summary?.noMutationBeforeApproval !== true
  || workspacePatchApply.summary?.noReplacementInInvocation !== true
  || workspacePatchApply.summary?.noFullDiffInInvocation !== true
  || workspacePatchApply.summary?.noProviderEgress !== true
  || JSON.stringify(workspacePatchApply.invocation ?? {}).includes("transient common patch replacement")
) {
  throw new Error(`workspace patch capability should delegate to the existing approval owner with a transient diff preview: ${JSON.stringify(workspacePatchApply)}`);
}
if (JSON.stringify(events).includes("transient common write content") || JSON.stringify(events).includes("transient common patch replacement")) {
  throw new Error("workspace mutation content and replacements must not enter the audit event payload");
}
for (const capabilityId of ["act.openclaw.workspace_text_write", "act.openclaw.workspace_patch_apply"]) {
  if (!capabilities.capabilities?.some((capability) =>
    capability.id === capabilityId
    && capability.governance === "require_approval"
    && capability.requiresApproval === true
  )) {
    throw new Error(`capability registry should expose the approval-gated workspace mutation ${capabilityId}`);
  }
}
if (!capabilities.capabilities?.some((capability) =>
  capability.id === "sense.openclaw.engineering_tool_surface_inventory"
  && capability.governance === "audit_only"
  && capability.intents?.includes("engineering.tool_surface_inventory")
)) {
  throw new Error("capability registry should expose the engineering tool surface inventory contract");
}
if (
  !workView.ok
  || workView.invoked !== true
  || workView.capability?.id !== "sense.openclaw.engineering_context.work_view_observation"
  || workView.result?.identityLevel !== "Level 2: trusted session/work-view component"
  || workView.result?.summary?.status !== "work_view_observed"
  || workView.result?.governance?.readsTrustedWorkViewObservation !== true
  || workView.summary?.kind !== "engineering.work_view_observation"
  || workView.summary?.noPayloadExposure !== true
  || JSON.stringify(workView).includes("capability-work-view")
  || JSON.stringify(workView).includes("leaseId")
) {
  throw new Error(`trusted work-view observation capability should remain compact and read-only: ${JSON.stringify(workView)}`);
}
if (
  !workViewControl.ok
  || workViewControl.invoked !== true
  || workViewControl.capability?.id !== "act.work_view.control"
  || workViewControl.result?.registry !== "openclaw-native-work-view-control-v0"
  || workViewControl.result?.action !== "reveal_work_view"
  || workViewControl.result?.workView?.visibility !== "visible"
  || workViewControl.result?.governance?.browserNavigation !== true
  || workViewControl.result?.governance?.providerEgress !== false
  || workViewControl.policy?.subject?.intent !== "work_view.reveal"
  || workViewControl.invocation?.request?.intent !== "work_view.reveal"
  || workViewControl.summary?.kind !== "work_view.control"
  || workViewControl.summary?.browserNavigation !== true
  || workViewControl.summary?.noProviderEgress !== true
  || workViewControl.summary?.noPayloadExposure !== true
  || JSON.stringify(workViewControl).includes("capability-work-view")
  || JSON.stringify(workViewControl).includes("leaseId")
) {
  throw new Error(`trusted work-view control should use the fixed owner path and compact readback: ${JSON.stringify(workViewControl)}`);
}
if (
  !browserOpen.ok
  || browserOpen.invoked !== true
  || browserOpen.capability?.id !== "act.browser.open"
  || browserOpen.policy?.subject?.intent !== "browser.new_tab"
  || browserOpen.invocation?.request?.intent !== "browser.new_tab"
  || browserOpen.result?.registry !== "openclaw-browser-action-capability-v0"
  || browserOpen.result?.operation !== "browser.new_tab"
  || browserOpen.result?.action?.mediation?.accepted !== true
  || browserOpen.result?.governance?.dispatchesExistingScreenActOwner !== true
  || browserOpen.summary?.kind !== "browser.new_tab"
  || browserOpen.summary?.accepted !== true
  || browserOpen.summary?.noPayloadExposure !== true
  || browserOpen.summary?.noProviderEgress !== true
  || JSON.stringify(browserOpen).includes("capability-browser-action")
) {
  throw new Error(`browser new-tab capability should use the existing screen-act owner with compact evidence: ${JSON.stringify(browserOpen)}`);
}
if (
  !screenKeyboard.ok
  || screenKeyboard.invoked !== true
  || screenKeyboard.capability?.id !== "act.screen.pointer_keyboard"
  || screenKeyboard.policy?.subject?.intent !== "keyboard.type"
  || screenKeyboard.invocation?.request?.intent !== "keyboard.type"
  || screenKeyboard.result?.registry !== "openclaw-screen-keyboard-capability-v0"
  || screenKeyboard.result?.operation !== "keyboard.type"
  || screenKeyboard.result?.action?.mediation?.accepted !== true
  || screenKeyboard.result?.governance?.dispatchesExistingScreenActOwner !== true
  || screenKeyboard.result?.governance?.writesBrowserInput !== true
  || screenKeyboard.result?.governance?.exposesInputValue !== false
  || screenKeyboard.summary?.kind !== "keyboard.type"
  || screenKeyboard.summary?.accepted !== true
  || screenKeyboard.summary?.inputValueExposed !== false
  || screenKeyboard.summary?.noPayloadExposure !== true
  || screenKeyboard.summary?.noProviderEgress !== true
  || JSON.stringify(screenKeyboard).includes("transient capability input")
) {
  throw new Error(`keyboard type capability should use the existing screen-act owner without input exposure: ${JSON.stringify(screenKeyboard)}`);
}
if (
  !screenPointer.ok
  || screenPointer.invoked !== true
  || screenPointer.capability?.id !== "act.screen.pointer_keyboard"
  || screenPointer.policy?.subject?.intent !== "mouse.click"
  || screenPointer.invocation?.request?.intent !== "mouse.click"
  || screenPointer.result?.registry !== "openclaw-screen-pointer-capability-v0"
  || screenPointer.result?.operation !== "mouse.click"
  || screenPointer.result?.action?.mediation?.accepted !== true
  || screenPointer.result?.governance?.dispatchesExistingScreenActOwner !== true
  || screenPointer.result?.governance?.pointerAction !== true
  || screenPointer.result?.governance?.writesBrowserInput !== false
  || screenPointer.summary?.kind !== "mouse.click"
  || screenPointer.summary?.accepted !== true
  || screenPointer.summary?.pointerAction !== true
  || screenPointer.summary?.noPayloadExposure !== true
  || screenPointer.summary?.noProviderEgress !== true
  || JSON.stringify(screenPointer).includes("640")
) {
  throw new Error(`mouse click capability should use a bounded left-click owner path without coordinate evidence: ${JSON.stringify(screenPointer)}`);
}
if (
  !contextPacket.ok
  || contextPacket.invoked !== true
  || contextPacket.capability?.id !== "sense.openclaw.engineering_context.packet"
  || contextPacket.result?.registry !== "openclaw-native-engineering-context-packet-v0"
  || contextPacket.summary?.kind !== "engineering.context_packet"
  || contextPacket.summary?.noContentPersistence !== true
  || contextPacket.summary?.noProviderEgress !== true
) {
  throw new Error(`engineering context packet capability should remain local and summary-only in the ledger: ${JSON.stringify(contextPacket)}`);
}
if (!capabilities.ok || !capabilities.capabilities?.some((capability) =>
  capability.id === "act.openclaw.engineering_context.provider_handoff_task"
  && capability.governance === "require_approval"
  && capability.requiresApproval === true
  && capability.domains?.includes("cross_boundary")
)) {
  throw new Error("capability registry should expose the governed provider handoff task boundary");
}
if (
  !providerHandoff.ok
  || providerHandoff.invoked !== true
  || providerHandoff.result?.blocked !== true
  || providerHandoff.result?.reason !== "operator_confirmation_required"
  || providerHandoff.summary?.kind !== "engineering.provider_handoff_task"
  || providerHandoff.summary?.createsTask !== false
  || providerHandoff.summary?.createsApproval !== false
  || providerHandoff.summary?.noProviderCall !== true
) {
  throw new Error(`provider handoff capability should stop at its explicit confirmation boundary: ${JSON.stringify(providerHandoff)}`);
}
if (
  !acpxCompatibility.ok
  || acpxCompatibility.invoked !== true
  || acpxCompatibility.capability?.id !== "sense.openclaw.acpx_codex_bridge.compatibility"
  || acpxCompatibility.result?.registry !== "openclaw-native-acpx-codex-bridge-compatibility-v0"
  || acpxCompatibility.summary?.kind !== "acpx_codex_bridge.compatibility"
  || acpxCompatibility.summary?.storeReady !== true
  || acpxCompatibility.summary?.noCredentialAccess !== true
  || acpxCompatibility.summary?.noWrapperMutation !== true
  || acpxCompatibility.summary?.noProcessSpawn !== true
  || acpxCompatibility.summary?.noProviderEgress !== true
  || JSON.stringify(acpxCompatibility.invocation ?? {}).includes("sessionKey")
) {
  throw new Error(`ACPX/Codex compatibility capability should use the existing bounded read model without execution authority: ${JSON.stringify(acpxCompatibility)}`);
}
if (
  !promptPack.ok
  || promptPack.invoked !== true
  || promptPack.capability?.id !== "sense.openclaw.prompt_pack"
  || promptPack.result?.registry !== "openclaw-native-prompt-semantics-v0"
  || promptPack.result?.summary?.totalFiles !== 1
  || promptPack.result?.summary?.exposesPromptContent !== false
  || promptPack.result?.workStandards?.registry !== "openclaw-engineering-work-standards-v0"
  || promptPack.result?.workStandards?.status !== "ready_for_engineering_loop_guidance"
  || promptPack.summary?.kind !== "openclaw.prompt_pack"
  || promptPack.summary?.workStandardsStatus !== "ready_for_engineering_loop_guidance"
  || promptPack.summary?.noPromptContentExposure !== true
  || promptPack.summary?.noPromptExecution !== true
  || promptPack.summary?.noMutation !== true
  || promptPack.summary?.noTaskCreation !== true
  || promptPack.summary?.noApprovalCreation !== true
  || promptPack.summary?.noProviderEgress !== true
  || JSON.stringify(promptPack.invocation ?? {}).includes("Plan each edit")
) {
  throw new Error(`prompt pack capability should expose bounded standards metadata without prompt authority: ${JSON.stringify(promptPack)}`);
}
if (JSON.stringify(events).includes("Plan each edit")) {
  throw new Error("prompt pack content must not enter the audit event payload");
}
if (
  !declarativeEvolution.ok
  || declarativeEvolution.invoked !== true
  || declarativeEvolution.capability?.id !== "plan.openclaw.declarative_evolution.managed_config_candidate"
  || declarativeEvolution.result?.registry !== "openclaw-native-declarative-evolution-candidate-v0"
  || declarativeEvolution.result?.candidateStatus !== "validated"
  || declarativeEvolution.result?.validation?.status !== "passed"
  || declarativeEvolution.summary?.noManagedConfigWrite !== true
  || declarativeEvolution.summary?.noGenerationSwitch !== true
  || declarativeEvolution.summary?.noRollback !== true
  || declarativeEvolution.summary?.noTaskCreation !== true
  || declarativeEvolution.summary?.noApprovalCreation !== true
  || declarativeEvolution.summary?.noProviderEgress !== true
  || declarativeEvolution.summary?.candidateTextInSummary !== false
  || JSON.stringify(declarativeEvolution.invocation ?? {}).includes("Generated by OpenClaw")
) {
  throw new Error(`declarative evolution candidate should validate without host mutation or persisted candidate text: ${JSON.stringify(declarativeEvolution)}`);
}
if (!processes.ok || processes.invoked !== true || processes.result?.count < 1 || processes.summary?.kind !== "process.list") {
  throw new Error("process list capability should route through core");
}
if (!blockedCommand.ok || blockedCommand.invoked !== false || blockedCommand.blocked !== true || blockedCommand.reason !== "policy_requires_approval") {
  throw new Error("unapproved command dry-run capability should be blocked by policy");
}
if (blockedCommand.policy?.decision !== "require_approval") {
  throw new Error("blocked command dry-run should expose require_approval decision");
}
if (!approvedCommand.ok || approvedCommand.invoked !== true || approvedCommand.policy?.decision !== "audit_only") {
  throw new Error("approved command dry-run should invoke under audit-only governance");
}
if (approvedCommand.result?.plan?.wouldExecute !== false || approvedCommand.summary?.wouldExecute !== false) {
  throw new Error("approved command capability must still be dry-run only");
}

const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["policy.evaluated", "capability.invoked", "capability.blocked"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}

console.log(JSON.stringify({
  capabilityInvoke: {
    vitals: {
      invoked: vitals.invoked,
      policy: vitals.policy.decision,
      alerts: vitals.summary.alerts,
    },
    screenObservation: {
      readiness: screen.summary.readiness,
      focusedWindowAvailable: screen.summary.focusedWindowAvailable,
      visualFrameAvailable: screen.summary.visualFrameAvailable,
      noScreenPayload: screen.summary.noScreenPayload,
    },
    filesystem: {
      path: files.result.path,
      entries: files.result.count,
      searchResults: search.result.count,
      policy: files.policy.decision,
    },
    engineeringReadSearch: {
      readLines: engineeringRead.result.summary.lineCount,
      globMatches: engineeringGlob.result.summary.matchedResults,
      grepMatches: engineeringGrep.result.summary.matchedResults,
      verificationRecords: engineeringVerify.result.summary.total,
      editProposal: {
        edits: engineeringEditProposal.summary.editCount,
        path: engineeringEditProposal.summary.relativePath,
        noMutation: engineeringEditProposal.summary.noMutation,
      },
      writeProposal: {
        kind: engineeringWriteProposal.summary.proposalKind,
        path: engineeringWriteProposal.summary.relativePath,
        noMutation: engineeringWriteProposal.summary.noMutation,
      },
      workspaceMutations: {
        unconfirmed: workspaceTextWriteUnconfirmed.result.reason,
        textWriteTask: workspaceTextWrite.summary.taskId,
        patchApplyTask: workspacePatchApply.summary.taskId,
        contentInInvocation: workspaceTextWrite.summary.noContentInInvocation === false,
        diffInInvocation: workspacePatchApply.summary.noFullDiffInInvocation === false,
      },
      workViewObservation: {
        status: workView.summary.status,
        freshness: workView.summary.observationFreshness,
        payloadExposed: !workView.summary.noPayloadExposure,
      },
      workViewControl: {
        action: workViewControl.summary.action,
        visibility: workViewControl.summary.visibility,
        payloadExposed: !workViewControl.summary.noPayloadExposure,
      },
      contextPacket: {
        messages: contextPacket.summary.messageCount,
        redactions: contextPacket.summary.redactions,
        providerEgress: !contextPacket.summary.noProviderEgress,
      },
      providerHandoff: {
        blocked: providerHandoff.result.reason,
        createsTask: providerHandoff.summary.createsTask,
        noProviderCall: providerHandoff.summary.noProviderCall,
      },
      acpxCodexCompatibility: {
        records: acpxCompatibility.summary.totalRecords,
        storeReady: acpxCompatibility.summary.storeReady,
        noProcessSpawn: acpxCompatibility.summary.noProcessSpawn,
        noProviderEgress: acpxCompatibility.summary.noProviderEgress,
      },
      promptPack: {
        files: promptPack.summary.totalFiles,
        expectedChecks: promptPack.summary.expectedChecks,
        workStandards: promptPack.summary.workStandardsStatus,
        noPromptContentExposure: promptPack.summary.noPromptContentExposure,
        noProviderEgress: promptPack.summary.noProviderEgress,
      },
      declarativeEvolution: {
        status: declarativeEvolution.result.candidateStatus,
        validation: declarativeEvolution.result.validation.status,
        candidateHash: declarativeEvolution.summary.candidateHash,
        noManagedConfigWrite: declarativeEvolution.summary.noManagedConfigWrite,
        noGenerationSwitch: declarativeEvolution.summary.noGenerationSwitch,
      },
      toolSurfaceInventory: {
        tools: engineeringToolSurface.summary.totalTools,
        covered: engineeringToolSurface.summary.coveredTools,
        sourceContentExposed: engineeringToolSurface.summary.noSourceContentExposure === false,
        toolExecution: engineeringToolSurface.summary.noToolExecution === false,
        noProviderEgress: engineeringToolSurface.summary.noProviderEgress,
      },
      policies: [engineeringRead.policy.decision, engineeringGlob.policy.decision, engineeringGrep.policy.decision],
    },
    process: {
      count: processes.result.count,
      policy: processes.policy.decision,
    },
    commandDryRun: {
      blockedReason: blockedCommand.reason,
      approvedPolicy: approvedCommand.policy.decision,
      wouldExecute: approvedCommand.summary.wouldExecute,
    },
  },
  auditEvents: [...eventTypes].filter((type) => type.startsWith("capability.") || type === "policy.evaluated"),
}, null, 2));
EOF
