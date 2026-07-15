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
mkdir -p "$FIXTURE_DIR/src" "$FIXTURE_DIR/.openclaw"
printf 'export const observerNeedle = "observer capability invoke";\n' > "$FIXTURE_DIR/src/app.ts"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${VITALS_FILE:-}" \
    "${PROCESS_FILE:-}" \
    "${ENGINEERING_READ_FILE:-}" \
    "${ENGINEERING_GLOB_FILE:-}" \
    "${ENGINEERING_GREP_FILE:-}" \
    "${ENGINEERING_VERIFY_FILE:-}" \
    "${WORK_VIEW_FILE:-}" \
    "${WORK_VIEW_CONTROL_FILE:-}" \
    "${CONTEXT_PACKET_FILE:-}" \
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
VITALS_FILE="$(mktemp)"
PROCESS_FILE="$(mktemp)"
ENGINEERING_READ_FILE="$(mktemp)"
ENGINEERING_GLOB_FILE="$(mktemp)"
ENGINEERING_GREP_FILE="$(mktemp)"
ENGINEERING_VERIFY_FILE="$(mktemp)"
WORK_VIEW_FILE="$(mktemp)"
WORK_VIEW_CONTROL_FILE="$(mktemp)"
CONTEXT_PACKET_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.system.vitals","intent":"system.observe"}' > "$VITALS_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.process.list","intent":"process.list","params":{"limit":10}}' > "$PROCESS_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.read\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"relativePath\":\"src/app.ts\",\"startLine\":1,\"endLine\":1}}" > "$ENGINEERING_READ_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.glob\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"pattern\":\"src/**/*.ts\",\"limit\":4}}" > "$ENGINEERING_GLOB_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.engineering_tool.grep\",\"params\":{\"workspacePath\":\"$FIXTURE_DIR\",\"query\":\"observerNeedle\",\"include\":\"src/**/*.ts\",\"literal\":true,\"limit\":4}}" > "$ENGINEERING_GREP_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_tool.verify_evidence","params":{"limit":4,"maxOutputChars":500}}' > "$ENGINEERING_VERIFY_FILE"
post_json "http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-capability-work-view"}' > /dev/null
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.work_view.control","operation":"work_view.reveal","params":{"entryUrl":"https://example.com/observer-capability-work-view"}}' > "$WORK_VIEW_CONTROL_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.packet","params":{"limit":4,"thresholdChars":256,"protectRecentAssistantTurns":0}}' > "$CONTEXT_PACKET_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.engineering_context.work_view_observation"}' > "$WORK_VIEW_FILE"
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
  "$WORK_VIEW_FILE" \
  "$WORK_VIEW_CONTROL_FILE" \
  "$CONTEXT_PACKET_FILE"
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
const workView = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));
const workViewControl = JSON.parse(fs.readFileSync(process.argv[14], "utf8"));
const contextPacket = JSON.parse(fs.readFileSync(process.argv[15], "utf8"));

for (const token of [
  "invoke-vitals-button",
  "invoke-process-button",
  "invoke-command-dry-run-button",
  "invoke-approved-command-dry-run-button",
  "capability-invoke-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}

for (const token of [
  "/capabilities/invoke",
  "invokeCapabilityFromUi",
  "renderCapabilityInvocation",
  "capability.invoked",
  "capability.blocked",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}

if (!vitals.ok || vitals.invoked !== true || vitals.policy?.decision !== "audit_only") {
  throw new Error("Observer vitals invoke path should return an audited invocation");
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
    },
    vitalsPolicy: vitals.policy.decision,
    processCount: processes.result.count,
    blockedReason: blocked.reason,
    approvedWouldExecute: approved.summary.wouldExecute,
  },
  auditEvents: [...eventTypes].filter((type) => type.startsWith("capability.") || type === "policy.evaluated"),
}, null, 2));
EOF
