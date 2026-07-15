#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/capability-invoke-fixture"

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
export OPENCLAW_WORKSPACE_ROOTS="$FIXTURE_DIR"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR/nested" "$FIXTURE_DIR/src" "$FIXTURE_DIR/scratch" "$FIXTURE_DIR/.openclaw"
printf 'OpenClaw capability invoke fixture\n' > "$FIXTURE_DIR/openclaw-capability-invoke.txt"
printf 'Nested invoke search fixture\n' > "$FIXTURE_DIR/nested/search-note.md"
printf 'export const capabilityNeedle = "OpenClaw capability invoke";\n' > "$FIXTURE_DIR/src/app.ts"

cleanup() {
  rm -f \
    "${VITALS_FILE:-}" \
    "${FILES_FILE:-}" \
    "${SEARCH_FILE:-}" \
    "${ENGINEERING_READ_FILE:-}" \
    "${ENGINEERING_GLOB_FILE:-}" \
    "${ENGINEERING_GREP_FILE:-}" \
    "${ENGINEERING_VERIFY_FILE:-}" \
    "${ENGINEERING_EDIT_PROPOSAL_FILE:-}" \
    "${ENGINEERING_WRITE_PROPOSAL_FILE:-}" \
    "${WORK_VIEW_FILE:-}" \
    "${WORK_VIEW_CONTROL_FILE:-}" \
    "${CONTEXT_PACKET_FILE:-}" \
    "${PROVIDER_HANDOFF_FILE:-}" \
    "${ACPX_COMPATIBILITY_FILE:-}" \
    "${CAPABILITIES_FILE:-}" \
    "${PROCESS_FILE:-}" \
    "${BLOCKED_COMMAND_FILE:-}" \
    "${APPROVED_COMMAND_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

VITALS_FILE="$(mktemp)"
FILES_FILE="$(mktemp)"
SEARCH_FILE="$(mktemp)"
ENGINEERING_READ_FILE="$(mktemp)"
ENGINEERING_GLOB_FILE="$(mktemp)"
ENGINEERING_GREP_FILE="$(mktemp)"
ENGINEERING_VERIFY_FILE="$(mktemp)"
ENGINEERING_EDIT_PROPOSAL_FILE="$(mktemp)"
ENGINEERING_WRITE_PROPOSAL_FILE="$(mktemp)"
WORK_VIEW_FILE="$(mktemp)"
WORK_VIEW_CONTROL_FILE="$(mktemp)"
CONTEXT_PACKET_FILE="$(mktemp)"
PROVIDER_HANDOFF_FILE="$(mktemp)"
ACPX_COMPATIBILITY_FILE="$(mktemp)"
CAPABILITIES_FILE="$(mktemp)"
PROCESS_FILE="$(mktemp)"
BLOCKED_COMMAND_FILE="$(mktemp)"
APPROVED_COMMAND_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.system.vitals","intent":"system.observe"}' > "$VITALS_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.filesystem.read\",\"intent\":\"filesystem.list\",\"operation\":\"list\",\"params\":{\"path\":\"$FIXTURE_DIR\",\"limit\":10}}" > "$FILES_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.filesystem.read\",\"intent\":\"filesystem.search\",\"operation\":\"search\",\"params\":{\"path\":\"$FIXTURE_DIR\",\"query\":\"search-note\",\"limit\":10}}" > "$SEARCH_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.read\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"startLine\":1,\"endLine\":1}}" > "$ENGINEERING_READ_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.glob\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"pattern\":\"src/**/*.ts\",\"limit\":4}}" > "$ENGINEERING_GLOB_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.grep\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"capabilityNeedle\",\"include\":\"src/**/*.ts\",\"literal\":true,\"limit\":4}}" > "$ENGINEERING_GREP_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_tool.verify_evidence","params":{"limit":4,"maxOutputChars":500}}' > "$ENGINEERING_VERIFY_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.edit_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"oldString\":\"capabilityNeedle\",\"newString\":\"governedNeedle\",\"contextLines\":1}}" > "$ENGINEERING_EDIT_PROPOSAL_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"act.openclaw.engineering_tool.write_proposal\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"scratch/new-file.txt\",\"content\":\"transient write content\",\"overwrite\":false,\"contextLines\":1}}" > "$ENGINEERING_WRITE_PROPOSAL_FILE"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/capability-work-view"}' > /dev/null
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.work_view.control","operation":"work_view.reveal","params":{"entryUrl":"https://example.com/capability-work-view"}}' > "$WORK_VIEW_CONTROL_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.packet","params":{"limit":4,"thresholdChars":256,"protectRecentAssistantTurns":0}}' > "$CONTEXT_PACKET_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.work_view_observation"}' > "$WORK_VIEW_FILE"
curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.engineering_context.provider_handoff_task","approved":true,"params":{"confirm":false}}' > "$PROVIDER_HANDOFF_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.acpx_codex_bridge.compatibility"}' > "$ACPX_COMPATIBILITY_FILE"
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
  "$WORK_VIEW_FILE" \
  "$WORK_VIEW_CONTROL_FILE" \
  "$CONTEXT_PACKET_FILE" \
  "$PROVIDER_HANDOFF_FILE" \
  "$ACPX_COMPATIBILITY_FILE" \
  "$CAPABILITIES_FILE" \
  "$FIXTURE_DIR"
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
const workView = readJson(15);
const workViewControl = readJson(16);
const contextPacket = readJson(17);
const providerHandoff = readJson(18);
const acpxCompatibility = readJson(19);
const capabilities = readJson(20);
const fixtureDir = process.argv[21];

if (!vitals.ok || vitals.invoked !== true || vitals.capability?.id !== "sense.system.vitals" || vitals.policy?.decision !== "audit_only") {
  throw new Error("system vitals capability should be invoked with audit-only governance");
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
