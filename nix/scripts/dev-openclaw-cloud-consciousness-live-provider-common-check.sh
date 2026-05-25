#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE11_CHECK_KIND:?PHASE11_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE11_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE11_PORT_BASE:-7830}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_11_PLAN.md"
LONG_TERM_MEMORY_FILE="$REPO_ROOT/.artifacts/openclaw-long-term-memory/long-term-memory.jsonl"
CLOUD_HANDOFF_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/context-handoff.jsonl"
PROVIDER_DRY_RUN_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/provider-dry-run.jsonl"
PROVIDER_RESPONSE_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/live-provider-call-runbook.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-11-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-11-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

reset_runbook_file() {
  rm -f "$RUNBOOK_FILE"
}

ensure_phase7_memory() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/long-term-memory/readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  rm -f "$LONG_TERM_MEMORY_FILE"
  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/long-term-memory/write-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-11-milestone-check","reason":"Prepare Phase 7 long-term memory prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_cloud_handoff() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/handoff-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  rm -f "$CLOUD_HANDOFF_FILE"
  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/handoff-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-11-milestone-check","reason":"Approve local cloud-consciousness context handoff prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_provider_dry_run() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/provider-dry-run-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  rm -f "$PROVIDER_DRY_RUN_FILE"
  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/provider-dry-run-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-11-milestone-check","reason":"Approve local provider adapter dry-run prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_provider_call_rehearsal() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/provider-response-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  rm -f "$PROVIDER_RESPONSE_FILE"
  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/real-provider-call-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-11-milestone-check","reason":"Approve local provider-call response rehearsal prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_live_provider_runbook() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-runbook-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-runbook-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-11-milestone-check","reason":"Approve one local live provider-call runbook artifact."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${READBACK_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
ensure_phase7_memory
ensure_cloud_handoff
ensure_provider_dry_run
ensure_provider_call_rehearsal

case "$CHECK_KIND" in
  live-provider-call-runbook)
    ENDPOINT="/cloud-consciousness/live-provider-call-runbook"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-runbook-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Call Runbook" "cloud-consciousness-live-provider-call-runbook-panel" "cloud-live-runbook-enabled")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-call-runbook" "refreshCloudConsciousnessLiveProviderCallRunbook" "$REGISTRY")
    ;;
  live-provider-operator-checklist)
    ENDPOINT="/cloud-consciousness/live-provider-operator-checklist"
    REGISTRY="openclaw-cloud-consciousness-live-provider-operator-checklist-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Operator Checklist" "cloud-consciousness-live-provider-operator-checklist-panel" "cloud-live-checklist-items")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-operator-checklist" "refreshCloudConsciousnessLiveProviderOperatorChecklist" "$REGISTRY")
    ;;
  live-provider-egress-transcript-schema)
    ENDPOINT="/cloud-consciousness/live-provider-egress-transcript-schema"
    REGISTRY="openclaw-cloud-consciousness-live-provider-egress-transcript-schema-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Egress Transcript Schema" "cloud-consciousness-live-provider-egress-transcript-schema-panel" "cloud-live-transcript-fields")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-egress-transcript-schema" "refreshCloudConsciousnessLiveProviderEgressTranscriptSchema" "$REGISTRY")
    ;;
  live-provider-final-authorization-review)
    ENDPOINT="/cloud-consciousness/live-provider-final-authorization-review"
    REGISTRY="openclaw-cloud-consciousness-live-provider-final-authorization-review-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Final Authorization Review" "cloud-consciousness-live-provider-final-authorization-review-panel" "cloud-live-auth-enabled")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-final-authorization-review" "refreshCloudConsciousnessLiveProviderFinalAuthorizationReview" "$REGISTRY")
    ;;
  live-provider-runbook-route-review)
    ENDPOINT="/cloud-consciousness/live-provider-runbook-route-review"
    REGISTRY="openclaw-cloud-consciousness-live-provider-runbook-route-review-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runbook Route" "cloud-consciousness-live-provider-runbook-route-review-panel" "cloud-live-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-runbook-route-review" "refreshCloudConsciousnessLiveProviderRunbookRouteReview" "$REGISTRY")
    ;;
  live-provider-runbook-task)
    ENDPOINT="/cloud-consciousness/live-provider-runbook-route-review"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-runbook-task-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runbook Task" "cloud-consciousness-live-provider-runbook-task-panel" "cloud-live-task-approval")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-runbook-route-review" "refreshCloudConsciousnessLiveProviderRunbookTask" "$REGISTRY")
    ;;
  approved-live-provider-runbook)
    reset_runbook_file
    ensure_live_provider_runbook
    ENDPOINT="/cloud-consciousness/live-provider-runbook-readback"
    REGISTRY="openclaw-cloud-consciousness-approved-live-provider-runbook-v0"
    HTML_TOKENS=("Cloud Consciousness Approved Live Provider Runbook" "cloud-consciousness-approved-live-provider-runbook-panel" "cloud-live-approved-records")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-approved-live-provider-runbook-v0" "refreshCloudConsciousnessApprovedLiveProviderRunbook" "/cloud-consciousness/live-provider-runbook-readback")
    ;;
  live-provider-runbook-readback)
    ensure_live_provider_runbook
    ENDPOINT="/cloud-consciousness/live-provider-runbook-readback"
    REGISTRY="openclaw-cloud-consciousness-live-provider-runbook-readback-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runbook Readback" "cloud-consciousness-live-provider-runbook-readback-panel" "cloud-live-readback-hash")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-runbook-readback" "refreshCloudConsciousnessLiveProviderRunbookReadback" "$REGISTRY")
    ;;
  live-provider-call-runbook-exit)
    ensure_live_provider_runbook
    ENDPOINT="/cloud-consciousness/live-provider-call-runbook-exit"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-runbook-exit-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Call Runbook Exit" "cloud-consciousness-live-provider-call-runbook-exit-panel" "cloud-live-exit-next")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-call-runbook-exit" "refreshCloudConsciousnessLiveProviderCallRunbookExit" "$REGISTRY" "openclaw-cloud-consciousness-live-provider-call-execution-plan")
    ;;
  *)
    echo "Unknown Phase 11 check kind: $CHECK_KIND" >&2
    exit 1
    ;;
esac

DATA_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL$ENDPOINT" > "$DATA_FILE"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$CHECK_KIND" "$REGISTRY" "$DATA_FILE" "$HTML_FILE" "$CLIENT_FILE" "${HTML_TOKENS[@]}" -- "${CLIENT_TOKENS[@]}"
const fs = require("node:fs");
const kind = process.argv[2];
const registry = process.argv[3];
const data = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const html = fs.readFileSync(process.argv[5], "utf8");
const client = fs.readFileSync(process.argv[6], "utf8");
const separator = process.argv.indexOf("--");
const htmlTokens = process.argv.slice(7, separator);
const clientTokens = process.argv.slice(separator + 1);
for (const token of htmlTokens) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of clientTokens) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!data.ok) throw new Error(`Observer Phase 11 endpoint should be ok for ${kind}`);
if (!["live-provider-runbook-task", "approved-live-provider-runbook"].includes(kind) && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
if (kind === "approved-live-provider-runbook" && data.summary?.recordCount < 1) {
  throw new Error(`Observer approved live provider runbook should see at least one record: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessLiveProvider: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "live-provider-runbook-task" ]]; then
  reset_runbook_file
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-runbook-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-cloud-consciousness-live-provider-runbook-task", "approval-gated runbook task", "Does not write"]) {
  if (!doc.includes(token)) throw new Error(`Phase 11 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-cloud-consciousness-live-provider-runbook-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Live provider runbook route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-live-provider-call-runbook-task-v0" || task.task?.type !== "cloud_consciousness_live_provider_runbook_task" || task.approval?.status !== "pending") {
  throw new Error(`Live provider runbook task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessLiveProviderRunbook?.artifactWritten !== false || task.governance?.writesRunbookArtifact !== false) {
  throw new Error(`Live provider runbook task shell must not write before approval: ${JSON.stringify(task.task?.cloudConsciousnessLiveProviderRunbook)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProviderRunbookTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-live-provider-runbook" ]]; then
  READBACK_FILE="$DATA_FILE"
  curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-runbook-readback" > "$READBACK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-approved-live-provider-runbook", "appends exactly one local live provider-call runbook JSONL record", "Does not enable live calls"]) {
  if (!doc.includes(token)) throw new Error(`Phase 11 plan doc missing ${token}`);
}
if (!readback.ok || readback.summary?.ready !== true || readback.summary?.recordCount < 1 || readback.summary?.transmitsExternally !== false || readback.summary?.callsCloudModel !== false || readback.summary?.liveProviderCallEnabled !== false) {
  throw new Error(`Approved live provider runbook should produce readable local non-live record: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessApprovedLiveProviderRunbook: { status: "passed", latestRecordId: readback.summary.latestRecordId, hash: readback.summary.latestContentHash } }, null, 2));
EOF
  exit 0
fi

node - <<'EOF' "$CHECK_KIND" "$REGISTRY" "$PLAN_DOC" "$DATA_FILE"
const fs = require("node:fs");
const kind = process.argv[2];
const registry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const data = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const docTokensByKind = {
  "live-provider-call-runbook": ["openclaw-cloud-consciousness-live-provider-call-runbook", "Prepare the live provider-call runbook without enabling external transmission", "Live provider call enabled: false"],
  "live-provider-operator-checklist": ["openclaw-cloud-consciousness-live-provider-operator-checklist", "endpoint, credential source, request hash", "Keeps live provider calls disabled"],
  "live-provider-egress-transcript-schema": ["openclaw-cloud-consciousness-live-provider-egress-transcript-schema", "openclaw.cloud_consciousness.live_provider_egress_transcript.v0", "not_enabled"],
  "live-provider-final-authorization-review": ["openclaw-cloud-consciousness-live-provider-final-authorization-review", "live egress is not authorized", "Phase 10 response rehearsal"],
  "live-provider-runbook-route-review": ["openclaw-cloud-consciousness-live-provider-runbook-route-review", "Defers actual live provider egress", "openclaw-cloud-consciousness-live-provider-call-execution-plan"],
  "live-provider-runbook-readback": ["openclaw-cloud-consciousness-live-provider-runbook-readback", "Verifies schema", "non-transmission status"],
  "live-provider-call-runbook-exit": ["openclaw-cloud-consciousness-live-provider-call-runbook-exit", "Phase 11 is complete", "openclaw-cloud-consciousness-live-provider-call-execution-plan"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 11 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 11 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "live-provider-call-runbook" && (data.summary?.ready !== true || data.summary?.liveProviderCallEnabled !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-operator-checklist")) {
  throw new Error(`Live provider call runbook should be ready and non-live: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-operator-checklist" && (data.summary?.ready !== true || data.summary?.checklistItemCount < 6 || data.summary?.transmitsExternally !== false)) {
  throw new Error(`Live provider operator checklist should be ready and non-transmitting: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-egress-transcript-schema" && (data.summary?.ready !== true || data.schema?.id !== "openclaw.cloud_consciousness.live_provider_egress_transcript.v0" || data.schema?.phase11AllowedStatus !== "not_enabled")) {
  throw new Error(`Live provider egress transcript schema should be ready and not-enabled: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-final-authorization-review" && (data.summary?.ready !== true || data.summary?.liveProviderCallEnabled !== false || data.summary?.providerCredentialRead !== false)) {
  throw new Error(`Live provider final authorization should keep live egress disabled: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-runbook-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-runbook-task" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Live provider runbook route should select runbook task and defer live egress: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-runbook-readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.liveProviderCallEnabled !== false || data.summary?.providerCredentialRead !== false || !data.summary?.latestContentHash)) {
  throw new Error(`Live provider runbook readback should verify a non-live local record: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-call-runbook-exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-call-execution-plan")) {
  throw new Error(`Phase 11 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProvider: { status: "passed", kind, registry } }, null, 2));
EOF
