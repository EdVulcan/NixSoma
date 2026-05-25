#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE10_CHECK_KIND:?PHASE10_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE10_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE10_PORT_BASE:-7650}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_10_PLAN.md"
LONG_TERM_MEMORY_FILE="$REPO_ROOT/.artifacts/openclaw-long-term-memory/long-term-memory.jsonl"
CLOUD_HANDOFF_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/context-handoff.jsonl"
PROVIDER_DRY_RUN_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/provider-dry-run.jsonl"
PROVIDER_RESPONSE_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/provider-response-rehearsal.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-10-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-10-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

reset_provider_response_file() {
  rm -f "$PROVIDER_RESPONSE_FILE"
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-10-milestone-check","reason":"Prepare Phase 7 long-term memory prerequisite."}' >/dev/null
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-10-milestone-check","reason":"Approve local cloud-consciousness context handoff prerequisite."}' >/dev/null
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-10-milestone-check","reason":"Approve local provider adapter dry-run prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_provider_call_rehearsal() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/provider-response-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/real-provider-call-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-10-milestone-check","reason":"Approve one local provider-call response rehearsal."}' >/dev/null
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

case "$CHECK_KIND" in
  real-provider-call-plan)
    ENDPOINT="/cloud-consciousness/real-provider-call-plan"
    REGISTRY="openclaw-cloud-consciousness-real-provider-call-plan-v0"
    HTML_TOKENS=("Cloud Consciousness Real Provider Call Plan" "cloud-consciousness-real-provider-call-plan-panel" "cloud-real-provider-plan-call")
    CLIENT_TOKENS=("/cloud-consciousness/real-provider-call-plan" "refreshCloudConsciousnessRealProviderCallPlan" "$REGISTRY")
    ;;
  provider-egress-contract)
    ENDPOINT="/cloud-consciousness/provider-egress-contract"
    REGISTRY="openclaw-cloud-consciousness-provider-egress-contract-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Egress Contract" "cloud-consciousness-provider-egress-contract-panel" "cloud-egress-contract-preflights")
    CLIENT_TOKENS=("/cloud-consciousness/provider-egress-contract" "refreshCloudConsciousnessProviderEgressContract" "$REGISTRY")
    ;;
  provider-credential-preflight)
    ENDPOINT="/cloud-consciousness/provider-credential-preflight"
    REGISTRY="openclaw-cloud-consciousness-provider-credential-preflight-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Credential Preflight" "cloud-consciousness-provider-credential-preflight-panel" "cloud-credential-preflight-read")
    CLIENT_TOKENS=("/cloud-consciousness/provider-credential-preflight" "refreshCloudConsciousnessProviderCredentialPreflight" "$REGISTRY")
    ;;
  provider-request-redaction-review)
    ENDPOINT="/cloud-consciousness/provider-request-redaction-review"
    REGISTRY="openclaw-cloud-consciousness-provider-request-redaction-review-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Request Redaction Review" "cloud-consciousness-provider-request-redaction-review-panel" "cloud-request-redaction-rejected")
    CLIENT_TOKENS=("/cloud-consciousness/provider-request-redaction-review" "refreshCloudConsciousnessProviderRequestRedactionReview" "$REGISTRY")
    ;;
  real-provider-call-route-review)
    ENDPOINT="/cloud-consciousness/real-provider-call-route-review"
    REGISTRY="openclaw-cloud-consciousness-real-provider-call-route-review-v0"
    HTML_TOKENS=("Cloud Consciousness Real Provider Call Route" "cloud-consciousness-real-provider-call-route-review-panel" "cloud-real-provider-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/real-provider-call-route-review" "refreshCloudConsciousnessRealProviderCallRouteReview" "$REGISTRY")
    ;;
  real-provider-call-task)
    ENDPOINT="/cloud-consciousness/real-provider-call-route-review"
    REGISTRY="openclaw-cloud-consciousness-real-provider-call-task-v0"
    HTML_TOKENS=("Cloud Consciousness Real Provider Call Task" "cloud-consciousness-real-provider-call-task-panel" "cloud-real-provider-task-approval")
    CLIENT_TOKENS=("/cloud-consciousness/real-provider-call-route-review" "refreshCloudConsciousnessRealProviderCallTask" "$REGISTRY")
    ;;
  approved-provider-call-rehearsal)
    reset_provider_response_file
    ensure_provider_call_rehearsal
    ENDPOINT="/cloud-consciousness/provider-response-readback"
    REGISTRY="openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0"
    HTML_TOKENS=("Cloud Consciousness Approved Provider Call Rehearsal" "cloud-consciousness-approved-provider-call-rehearsal-panel" "cloud-call-rehearsal-records")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0" "refreshCloudConsciousnessApprovedProviderCallRehearsal" "/cloud-consciousness/provider-response-readback")
    ;;
  provider-response-readback)
    ensure_provider_call_rehearsal
    ENDPOINT="/cloud-consciousness/provider-response-readback"
    REGISTRY="openclaw-cloud-consciousness-provider-response-readback-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Response Readback" "cloud-consciousness-provider-response-readback-panel" "cloud-response-readback-hash")
    CLIENT_TOKENS=("/cloud-consciousness/provider-response-readback" "refreshCloudConsciousnessProviderResponseReadback" "$REGISTRY")
    ;;
  real-provider-call-exit)
    ensure_provider_call_rehearsal
    ENDPOINT="/cloud-consciousness/real-provider-call-exit"
    REGISTRY="openclaw-cloud-consciousness-real-provider-call-exit-v0"
    HTML_TOKENS=("Cloud Consciousness Real Provider Call Exit" "cloud-consciousness-real-provider-call-exit-panel" "cloud-real-provider-exit-next")
    CLIENT_TOKENS=("/cloud-consciousness/real-provider-call-exit" "refreshCloudConsciousnessRealProviderCallExit" "$REGISTRY" "openclaw-cloud-consciousness-live-provider-call-runbook")
    ;;
  *)
    echo "Unknown Phase 10 check kind: $CHECK_KIND" >&2
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
if (!data.ok) throw new Error(`Observer Phase 10 endpoint should be ok for ${kind}`);
if (!["real-provider-call-task", "approved-provider-call-rehearsal"].includes(kind) && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
if (kind === "approved-provider-call-rehearsal" && data.summary?.recordCount < 1) {
  throw new Error(`Observer approved provider-call rehearsal should see at least one record: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessRealProvider: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "real-provider-call-task" ]]; then
  reset_provider_response_file
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/real-provider-call-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-cloud-consciousness-real-provider-call-task", "approval-gated provider-call rehearsal task", "Does not write"]) {
  if (!doc.includes(token)) throw new Error(`Phase 10 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-cloud-consciousness-real-provider-call-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Real provider-call route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-real-provider-call-task-v0" || task.task?.type !== "cloud_consciousness_provider_call_rehearsal_task" || task.approval?.status !== "pending") {
  throw new Error(`Real provider-call rehearsal task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessProviderCallRehearsal?.artifactWritten !== false || task.governance?.writesResponseArtifact !== false) {
  throw new Error(`Real provider-call task shell must not write before approval: ${JSON.stringify(task.task?.cloudConsciousnessProviderCallRehearsal)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessRealProviderCallTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-provider-call-rehearsal" ]]; then
  READBACK_FILE="$DATA_FILE"
  curl --silent --fail "$CORE_URL/cloud-consciousness/provider-response-readback" > "$READBACK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-approved-provider-call-rehearsal", "appends exactly one local provider response rehearsal JSONL record", "Does not read credentials"]) {
  if (!doc.includes(token)) throw new Error(`Phase 10 plan doc missing ${token}`);
}
if (!readback.ok || readback.summary?.ready !== true || readback.summary?.recordCount < 1 || readback.summary?.transmitsExternally !== false || readback.summary?.callsCloudModel !== false || readback.summary?.providerCredentialRead !== false) {
  throw new Error(`Approved provider-call rehearsal should produce readable local non-transmitted record: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessApprovedProviderCallRehearsal: { status: "passed", latestRecordId: readback.summary.latestRecordId, hash: readback.summary.latestContentHash } }, null, 2));
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
  "real-provider-call-plan": ["openclaw-cloud-consciousness-real-provider-call-plan", "Prepare the real provider-call path with a local response rehearsal", "Credential value reads: none"],
  "provider-egress-contract": ["openclaw-cloud-consciousness-provider-egress-contract", "openclaw.cloud_consciousness.provider_egress_contract.v0", "Forbids network send"],
  "provider-credential-preflight": ["openclaw-cloud-consciousness-provider-credential-preflight", "without reading credential values", "live provider calls disabled"],
  "provider-request-redaction-review": ["openclaw-cloud-consciousness-provider-request-redaction-review", "provider credentials", "secrets"],
  "real-provider-call-route-review": ["openclaw-cloud-consciousness-real-provider-call-route-review", "Defers live provider egress", "openclaw-cloud-consciousness-live-provider-call-runbook"],
  "provider-response-readback": ["openclaw-cloud-consciousness-provider-response-readback", "Verifies schema", "non-transmission status"],
  "real-provider-call-exit": ["openclaw-cloud-consciousness-real-provider-call-exit", "Phase 10 is complete", "openclaw-cloud-consciousness-live-provider-call-runbook"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 10 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 10 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "real-provider-call-plan" && (data.summary?.ready !== true || data.summary?.callsCloudModel !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-provider-egress-contract")) {
  throw new Error(`Real provider-call plan should be ready and non-calling: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-egress-contract" && (data.summary?.ready !== true || data.contract?.id !== "openclaw.cloud_consciousness.provider_egress_contract.v0" || data.summary?.transmitsExternally !== false)) {
  throw new Error(`Provider egress contract should be ready and non-transmitting: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-credential-preflight" && (data.summary?.ready !== true || data.summary?.providerCredentialRead !== false || data.preflight?.liveCallPermitted !== false)) {
  throw new Error(`Provider credential preflight should avoid reading credentials: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-request-redaction-review" && (data.summary?.ready !== true || data.summary?.includesSecrets !== false || data.summary?.rejectedContentCount < 5)) {
  throw new Error(`Provider request redaction review should reject sensitive content: ${JSON.stringify(data.summary)}`);
}
if (kind === "real-provider-call-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-cloud-consciousness-real-provider-call-task" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Real provider-call route should select rehearsal task and defer live egress: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-response-readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.transmitsExternally !== false || data.summary?.providerCredentialRead !== false || !data.summary?.latestContentHash)) {
  throw new Error(`Provider response readback should verify a non-transmitted local record: ${JSON.stringify(data.summary)}`);
}
if (kind === "real-provider-call-exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-call-runbook")) {
  throw new Error(`Phase 10 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessRealProvider: { status: "passed", kind, registry } }, null, 2));
EOF
