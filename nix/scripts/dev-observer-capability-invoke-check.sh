#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-capability-invoke-fixture"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7000}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7001}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7002}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7003}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7004}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7005}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7006}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7007}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7070}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-capability-invoke-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-observer-capability-invoke-check-events.jsonl}"
export OPENCLAW_WORKSPACE_ROOTS="$FIXTURE_DIR"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR/src" "$FIXTURE_DIR/scratch" "$FIXTURE_DIR/.openclaw"
printf 'export const observerNeedle = "observer capability invoke";\n' > "$FIXTURE_DIR/src/app.ts"
printf '%s\n' \
  '# Observer prompt semantics fixture' \
  'Plan each edit with a diff and patch preview.' \
  'Require approval and safety before command execution.' \
  'Run typecheck, test, lint, and verify after changes.' \
  'The prompt is guidance only and is not product authority.' \
  > "$FIXTURE_DIR/AGENTS.md"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${SCREEN_FILE:-}" \
    "${VITALS_FILE:-}" \
    "${PROCESS_FILE:-}" \
    "${ENGINEERING_READ_FILE:-}" \
    "${ENGINEERING_GLOB_FILE:-}" \
    "${ENGINEERING_GREP_FILE:-}" \
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
    "${SYSTEM_HEAL_FILE:-}" \
    "${MAINTENANCE_FILE:-}" \
    "${CONTEXT_PACKET_FILE:-}" \
    "${PROVIDER_HANDOFF_FILE:-}" \
    "${ACPX_COMPATIBILITY_FILE:-}" \
    "${PROMPT_PACK_FILE:-}" \
    "${CAPABILITIES_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -rf "$FIXTURE_DIR"
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
SCREEN_FILE="$(mktemp)"
VITALS_FILE="$(mktemp)"
PROCESS_FILE="$(mktemp)"
ENGINEERING_READ_FILE="$(mktemp)"
ENGINEERING_GLOB_FILE="$(mktemp)"
ENGINEERING_GREP_FILE="$(mktemp)"
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
SYSTEM_HEAL_FILE="$(mktemp)"
MAINTENANCE_FILE="$(mktemp)"
CONTEXT_PACKET_FILE="$(mktemp)"
PROVIDER_HANDOFF_FILE="$(mktemp)"
ACPX_COMPATIBILITY_FILE="$(mktemp)"
PROMPT_PACK_FILE="$(mktemp)"
CAPABILITIES_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.screen.observe","intent":"screen.observe"}' > "$SCREEN_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.system.vitals","intent":"system.observe"}' > "$VITALS_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.process.list","intent":"process.list","params":{"limit":10}}' > "$PROCESS_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.read\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"startLine\":1,\"endLine\":1}}" > "$ENGINEERING_READ_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.glob\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"pattern\":\"src/**/*.ts\",\"limit\":4}}" > "$ENGINEERING_GLOB_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.grep\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"observerNeedle\",\"include\":\"src/**/*.ts\",\"literal\":true,\"limit\":4}}" > "$ENGINEERING_GREP_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_tool.verify_evidence","params":{"limit":4,"maxOutputChars":500}}' > "$ENGINEERING_VERIFY_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.edit_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"oldString\":\"observerNeedle\",\"newString\":\"governedObserverNeedle\",\"contextLines\":1}}" > "$ENGINEERING_EDIT_PROPOSAL_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.write_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/new-file.txt\",\"content\":\"transient observer write content\",\"overwrite\":false,\"contextLines\":1}}" > "$ENGINEERING_WRITE_PROPOSAL_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_text_write\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/common-write.txt\",\"content\":\"transient observer common write content\",\"overwrite\":false,\"confirm\":false}}" > "$WORKSPACE_TEXT_WRITE_UNCONFIRMED_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_text_write\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/common-write.txt\",\"content\":\"transient observer common write content\",\"overwrite\":false,\"confirm\":true}}" > "$WORKSPACE_TEXT_WRITE_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.workspace_patch_apply\",\"approved\":true,\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"search\":\"observerNeedle\",\"replacement\":\"transient observer common patch replacement\",\"occurrence\":1,\"contextLines\":1,\"confirm\":true}}" > "$WORKSPACE_PATCH_APPLY_FILE"
post_json "http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-capability-work-view"}' > /dev/null
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.work_view.control","operation":"work_view.reveal","params":{"entryUrl":"https://example.com/observer-capability-work-view"}}' > "$WORK_VIEW_CONTROL_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.browser.open","operation":"browser.new_tab","params":{"url":"https://example.com/observer-capability-browser-action"}}' > "$BROWSER_OPEN_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.screen.pointer_keyboard","operation":"keyboard.type","params":{"text":"transient observer capability input"}}' > "$SCREEN_KEYBOARD_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.screen.pointer_keyboard","operation":"mouse.click","params":{"x":640,"y":360,"button":"left"}}' > "$SCREEN_POINTER_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.heal","operation":"heal.restart-service","params":{"service":"openclaw-browser-runtime","mode":"simulated"}}' > "$SYSTEM_HEAL_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.heal","operation":"heal.maintenance.tick","params":{"force":true,"autofix":true,"mode":"simulated"}}' > "$MAINTENANCE_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.packet","params":{"limit":4,"thresholdChars":256,"protectRecentAssistantTurns":0}}' > "$CONTEXT_PACKET_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.work_view_observation"}' > "$WORK_VIEW_FILE"
curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.engineering_context.provider_handoff_task","approved":true,"params":{"confirm":false}}' > "$PROVIDER_HANDOFF_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.acpx_codex_bridge.compatibility"}' > "$ACPX_COMPATIBILITY_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.prompt_pack\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"edit\",\"limit\":8}}" > "$PROMPT_PACK_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$BLOCKED_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","approved":true,"params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$APPROVED_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?source=openclaw-core&limit=80" > "$EVENTS_FILE"

node - <<'EOF' \
  "$HTML_FILE" \
  "$CLIENT_FILE" \
  "$VITALS_FILE" \
  "$PROCESS_FILE" \
  "$ENGINEERING_READ_FILE" \
  "$ENGINEERING_GLOB_FILE" \
  "$ENGINEERING_GREP_FILE" \
  "$BLOCKED_FILE" \
  "$APPROVED_FILE" \
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
  "$SCREEN_FILE" \
  "$BROWSER_OPEN_FILE" \
  "$SCREEN_KEYBOARD_FILE" \
  "$SCREEN_POINTER_FILE" \
  "$SYSTEM_HEAL_FILE" \
  "$MAINTENANCE_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const vitals = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const processes = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const engineeringRead = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const engineeringGlob = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const engineeringGrep = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[9], "utf8"));
const approved = JSON.parse(fs.readFileSync(process.argv[10], "utf8"));
const events = JSON.parse(fs.readFileSync(process.argv[11], "utf8"));
const engineeringVerify = JSON.parse(fs.readFileSync(process.argv[12], "utf8"));
const engineeringEditProposal = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));
const engineeringWriteProposal = JSON.parse(fs.readFileSync(process.argv[14], "utf8"));
const workspaceTextWriteUnconfirmed = JSON.parse(fs.readFileSync(process.argv[15], "utf8"));
const workspaceTextWrite = JSON.parse(fs.readFileSync(process.argv[16], "utf8"));
const workspacePatchApply = JSON.parse(fs.readFileSync(process.argv[17], "utf8"));
const workView = JSON.parse(fs.readFileSync(process.argv[18], "utf8"));
const workViewControl = JSON.parse(fs.readFileSync(process.argv[19], "utf8"));
const contextPacket = JSON.parse(fs.readFileSync(process.argv[20], "utf8"));
const providerHandoff = JSON.parse(fs.readFileSync(process.argv[21], "utf8"));
const acpxCompatibility = JSON.parse(fs.readFileSync(process.argv[22], "utf8"));
const promptPack = JSON.parse(fs.readFileSync(process.argv[23], "utf8"));
const capabilities = JSON.parse(fs.readFileSync(process.argv[24], "utf8"));
const screen = JSON.parse(fs.readFileSync(process.argv[25], "utf8"));
const browserOpen = JSON.parse(fs.readFileSync(process.argv[26], "utf8"));
const screenKeyboard = JSON.parse(fs.readFileSync(process.argv[27], "utf8"));
const screenPointer = JSON.parse(fs.readFileSync(process.argv[28], "utf8"));
const systemHeal = JSON.parse(fs.readFileSync(process.argv[29], "utf8"));
const maintenance = JSON.parse(fs.readFileSync(process.argv[30], "utf8"));

for (const token of [
  "invoke-vitals-button",
  "invoke-process-button",
  "invoke-screen-observation-button",
  "invoke-command-dry-run-button",
  "invoke-approved-command-dry-run-button",
  "capability-invoke-json",
  "engineering-provider-handoff-prompt-input",
  "engineering-provider-handoff-create-button",
  "Create Pending DeepSeek Handoff",
  "engineering-provider-handoff-json",
  "workspace-text-write-task-button",
  "workspace-patch-apply-task-button",
  "new-tab-action-button",
  "type-action-button",
  "click-action-button",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}

for (const token of [
  "/capabilities/invoke",
  "invokeCapabilityFromUi",
  "invokeScreenObservationButton.addEventListener",
  "screenObservation",
  "sense.screen.observe",
  "GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS",
  "observe_current_screen",
  "invoke-screen-observation-button",
  "existingCapabilityId",
  "renderCapabilityInvocation",
  "capability.invoked",
  "capability.blocked",
  "act.openclaw.engineering_context.provider_handoff_task",
  "createEngineeringProviderHandoffTask",
  "renderEngineeringProviderHandoff",
  "openclaw://credential/deepseek-api-key",
  "act.openclaw.workspace_text_write",
  "act.openclaw.workspace_patch_apply",
  "runBrowserOpenCapability",
  "act.browser.open",
  "browser.new_tab",
  "runKeyboardTypeCapability",
  "act.screen.pointer_keyboard",
  "keyboard.type",
  "runMouseClickCapability",
  "mouse.click",
  "runHeal",
  "runMaintenanceTickFromUi",
  "act.system.heal",
  "heal.restart-service",
  "heal.maintenance.tick",
  "mode: \"simulated\"",
  "postWorkView",
  "act.work_view.control",
  "work_view.prepare",
  "work_view.reveal",
  "work_view.hide",
  "sense.openclaw.engineering_context.packet",
  "act.openclaw.engineering_context.work_view_bind",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}

if (!vitals.ok || vitals.invoked !== true || vitals.policy?.decision !== "audit_only") {
  throw new Error("Observer vitals invoke path should return an audited invocation");
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
  throw new Error("Observer screen observation invoke path should remain bounded and read-only");
}
if (!processes.ok || processes.invoked !== true || processes.result?.count < 1) {
  throw new Error("Observer process invoke path should return process summaries");
}
if (
  !engineeringRead.ok
  || engineeringRead.invoked !== true
  || engineeringRead.summary?.kind !== "engineering.read"
  || engineeringRead.result?.content?.includes("observerNeedle") !== true
  || engineeringGlob.summary?.kind !== "engineering.glob"
  || engineeringGlob.result?.summary?.matchedResults !== 1
  || engineeringGrep.summary?.kind !== "engineering.grep"
  || engineeringGrep.result?.summary?.matchedResults !== 1
) {
  throw new Error("Observer engineering read/search invoke path should return bounded results");
}
if (
  !engineeringVerify.ok
  || engineeringVerify.invoked !== true
  || engineeringVerify.capability?.id !== "sense.openclaw.engineering_tool.verify_evidence"
  || engineeringVerify.result?.summary?.total !== 0
  || engineeringVerify.summary?.kind !== "engineering.verification_evidence"
  || engineeringVerify.summary?.noCommandExecution !== true
  || engineeringVerify.result?.governance?.canExecuteCommand !== false
) {
  throw new Error("Observer verification evidence invoke path should remain read-only");
}
if (
  !engineeringEditProposal.ok
  || engineeringEditProposal.invoked !== true
  || engineeringEditProposal.capability?.id !== "act.openclaw.engineering_tool.edit_proposal"
  || engineeringEditProposal.result?.registry !== "openclaw-native-engineering-edit-proposal-v0"
  || engineeringEditProposal.result?.summary?.editCount !== 1
  || engineeringEditProposal.result?.governance?.canMutate !== false
  || engineeringEditProposal.summary?.kind !== "engineering.edit_proposal"
  || engineeringEditProposal.summary?.noMutation !== true
  || engineeringEditProposal.summary?.noTaskCreation !== true
  || engineeringEditProposal.summary?.noProviderEgress !== true
  || JSON.stringify(engineeringEditProposal).includes("governedObserverNeedle") === false
) {
  throw new Error("Observer engineering edit proposal invoke path should remain bounded and proposal-only");
}
if (JSON.stringify(events).includes("governedObserverNeedle")) {
  throw new Error("Observer engineering edit proposal content must not enter the audit event payload");
}
if (
  !engineeringWriteProposal.ok
  || engineeringWriteProposal.invoked !== true
  || engineeringWriteProposal.capability?.id !== "act.openclaw.engineering_tool.write_proposal"
  || engineeringWriteProposal.result?.registry !== "openclaw-native-engineering-write-proposal-v0"
  || engineeringWriteProposal.result?.summary?.proposalKind !== "create_file_proposal"
  || engineeringWriteProposal.result?.target?.contentExposed !== false
  || engineeringWriteProposal.summary?.kind !== "engineering.write_proposal"
  || engineeringWriteProposal.summary?.noMutation !== true
  || engineeringWriteProposal.summary?.noTaskCreation !== true
  || engineeringWriteProposal.summary?.noProviderEgress !== true
  || JSON.stringify(engineeringWriteProposal).includes("transient observer write content")
) {
  throw new Error("Observer engineering write proposal invoke path should remain redacted and proposal-only");
}
if (JSON.stringify(events).includes("transient observer write content")) {
  throw new Error("Observer engineering write proposal content must not enter the audit event payload");
}
if (!workspaceTextWriteUnconfirmed.ok
  || workspaceTextWriteUnconfirmed.invoked !== true
  || workspaceTextWriteUnconfirmed.result?.blocked !== true
  || workspaceTextWriteUnconfirmed.result?.reason !== "operator_confirmation_required"
  || workspaceTextWriteUnconfirmed.summary?.kind !== "workspace.text_write_task"
  || workspaceTextWriteUnconfirmed.summary?.createsTask !== false
  || workspaceTextWriteUnconfirmed.summary?.noContentInInvocation !== true
) {
  throw new Error("Observer workspace text write should preserve its explicit confirmation gate");
}
if (!workspaceTextWrite.ok
  || workspaceTextWrite.invoked !== true
  || workspaceTextWrite.capability?.id !== "act.openclaw.workspace_text_write"
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
  || JSON.stringify(workspaceTextWrite.invocation ?? {}).includes("transient observer common write content")
) {
  throw new Error("Observer workspace text write should use the existing approval owner with compact invocation evidence");
}
if (!workspacePatchApply.ok
  || workspacePatchApply.invoked !== true
  || workspacePatchApply.capability?.id !== "act.openclaw.workspace_patch_apply"
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
  || JSON.stringify(workspacePatchApply.invocation ?? {}).includes("transient observer common patch replacement")
) {
  throw new Error("Observer workspace patch should use the existing approval owner with a transient diff preview");
}
if (JSON.stringify(events).includes("transient observer common write content") || JSON.stringify(events).includes("transient observer common patch replacement")) {
  throw new Error("Observer workspace mutation content must not enter the audit event payload");
}
for (const capabilityId of ["act.openclaw.workspace_text_write", "act.openclaw.workspace_patch_apply"]) {
  if (!capabilities.capabilities?.some((capability) =>
    capability.id === capabilityId
    && capability.governance === "require_approval"
    && capability.requiresApproval === true
  )) {
    throw new Error(`Observer capability registry missing ${capabilityId}`);
  }
}
if (
  !workView.ok
  || workView.invoked !== true
  || workView.capability?.id !== "sense.openclaw.engineering_context.work_view_observation"
  || workView.result?.identityLevel !== "Level 2: trusted session/work-view component"
  || workView.result?.summary?.status !== "work_view_observed"
  || workView.summary?.kind !== "engineering.work_view_observation"
  || workView.summary?.noPayloadExposure !== true
  || JSON.stringify(workView).includes("observer-capability-work-view")
  || JSON.stringify(workView).includes("leaseId")
) {
  throw new Error("Observer trusted work-view observation invoke path should remain compact and read-only");
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
  || JSON.stringify(workViewControl).includes("observer-capability-work-view")
  || JSON.stringify(workViewControl).includes("leaseId")
) {
  throw new Error("Observer trusted work-view control invoke path should remain allowlisted and compact");
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
  || JSON.stringify(browserOpen).includes("observer-capability-browser-action")
) {
  throw new Error("Observer browser new-tab capability should use the existing screen-act owner with compact evidence");
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
  || JSON.stringify(screenKeyboard).includes("transient observer capability input")
) {
  throw new Error("Observer keyboard type capability should use the existing screen-act owner without input exposure");
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
  throw new Error("Observer mouse click capability should use a bounded left-click owner path without coordinate evidence");
}
if (
  !systemHeal.ok
  || systemHeal.invoked !== true
  || systemHeal.capability?.id !== "act.system.heal"
  || systemHeal.policy?.subject?.intent !== "heal.restart-service"
  || systemHeal.invocation?.request?.intent !== "heal.restart-service"
  || systemHeal.result?.entry?.mode !== "simulated"
  || systemHeal.result?.entry?.status !== "completed"
  || systemHeal.summary?.kind !== "system.heal"
  || systemHeal.summary?.noProviderEgress !== true
  || JSON.stringify(systemHeal.invocation ?? {}).includes("openclaw-browser-runtime")
) {
  throw new Error("Observer system-heal capability should use the common audited simulated restart owner");
}
if (
  !maintenance.ok
  || maintenance.invoked !== true
  || maintenance.capability?.id !== "act.system.heal"
  || maintenance.policy?.subject?.intent !== "heal.maintenance.tick"
  || maintenance.invocation?.request?.intent !== "heal.maintenance.tick"
  || maintenance.result?.tick?.status !== "ran"
  || maintenance.result?.run?.autonomy?.governance !== "audit_only"
  || maintenance.result?.run?.autonomy?.mode !== "conservative"
  || maintenance.result?.run?.diagnosis?.plan?.mode !== "simulated"
  || maintenance.summary?.kind !== "maintenance.run"
  || maintenance.summary?.noProviderEgress !== true
  || JSON.stringify(maintenance.invocation ?? {}).includes("openclaw-browser-runtime")
) {
  throw new Error("Observer maintenance capability should use the common audited simulated tick owner");
}
if (client.includes("observerConfig.systemHealUrl}/heal/restart-service")
  || client.includes("observerConfig.systemHealUrl}/maintenance/tick")) {
  throw new Error("Observer system-heal controls must not call the service directly");
}
if (client.includes("observerConfig.sessionManagerUrl}/work-view/prepare")
  || client.includes("observerConfig.sessionManagerUrl}/work-view/reveal")
  || client.includes("observerConfig.sessionManagerUrl}/work-view/hide")) {
  throw new Error("Observer work-view controls must not mutate session-manager directly");
}
if (client.includes("observerConfig.coreUrl}/plugins/native-adapter/engineering-context/packet")
  || client.includes("observerConfig.coreUrl}/plugins/native-adapter/engineering-context/work-view/bind")) {
  throw new Error("Observer engineering context controls must use the common capability runtime");
}
if (!capabilities.capabilities?.some((capability) =>
  capability.id === "act.system.heal"
  && capability.governance === "audit_only"
  && capability.intents?.includes("heal.restart-service")
  && capability.intents?.includes("heal.maintenance.tick")
)) {
  throw new Error("Observer capability registry should expose the audited simulated system-heal contract");
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
  throw new Error("Observer engineering context packet invoke path should remain local and summary-only");
}
if (!capabilities.ok || !capabilities.capabilities?.some((capability) =>
  capability.id === "act.openclaw.engineering_context.provider_handoff_task"
  && capability.governance === "require_approval"
  && capability.requiresApproval === true
  && capability.domains?.includes("cross_boundary")
)) {
  throw new Error("Observer capability registry should expose the governed provider handoff task boundary");
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
  throw new Error("Observer provider handoff capability should stop at explicit confirmation");
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
  throw new Error("Observer ACPX/Codex compatibility capability should remain bounded and read-only");
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
  throw new Error("Observer prompt pack capability should expose bounded standards metadata without prompt authority");
}
if (JSON.stringify(events).includes("Plan each edit")) {
  throw new Error("Observer prompt pack content must not enter the audit event payload");
}
if (!blocked.ok || blocked.invoked !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error("Observer blocked dry-run path should expose policy_requires_approval");
}
if (!approved.ok || approved.invoked !== true || approved.summary?.wouldExecute !== false) {
  throw new Error("Observer approved dry-run path should remain dry-run only");
}

const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["capability.invoked", "capability.blocked", "policy.evaluated"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}

console.log(JSON.stringify({
  observerCapabilityInvoke: {
    htmlControls: [
      "invoke-vitals-button",
      "invoke-process-button",
      "invoke-screen-observation-button",
      "invoke-command-dry-run-button",
      "invoke-approved-command-dry-run-button",
    ],
    clientApis: [
      "/capabilities/invoke",
      "renderCapabilityInvocation",
    ],
    engineeringReadSearch: {
      read: engineeringRead.summary.kind,
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
      systemHeal: {
        restart: systemHeal.summary.kind,
        restartMode: systemHeal.result.entry.mode,
        maintenance: maintenance.summary.kind,
        maintenanceMode: maintenance.result.run.diagnosis.plan.mode,
        noProviderEgress: maintenance.summary.noProviderEgress,
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
    },
    vitalsPolicy: vitals.policy.decision,
    processCount: processes.result.count,
    blockedReason: blocked.reason,
    approvedWouldExecute: approved.summary.wouldExecute,
  },
  auditEvents: [...eventTypes].filter((type) => type.startsWith("capability.") || type === "policy.evaluated"),
}, null, 2));
EOF
