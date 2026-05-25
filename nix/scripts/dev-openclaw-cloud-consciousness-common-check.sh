#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE8_CHECK_KIND:?PHASE8_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE8_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE8_PORT_BASE:-7310}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_8_PLAN.md"
LONG_TERM_MEMORY_FILE="$REPO_ROOT/.artifacts/openclaw-long-term-memory/long-term-memory.jsonl"
CLOUD_HANDOFF_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/context-handoff.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-8-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-8-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

reset_cloud_handoff_file() {
  rm -f "$CLOUD_HANDOFF_FILE"
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-8-milestone-check","reason":"Prepare Phase 7 long-term memory prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_cloud_handoff() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/handoff-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/handoff-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-8-milestone-check","reason":"Approve one local cloud-consciousness context handoff artifact."}' >/dev/null
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

case "$CHECK_KIND" in
  context-review)
    ENDPOINT="/cloud-consciousness/context-review"
    REGISTRY="openclaw-cloud-consciousness-context-review-v0"
    HTML_TOKENS=("Cloud Consciousness Context Review" "cloud-consciousness-context-review-panel" "cloud-context-review-call")
    CLIENT_TOKENS=("/cloud-consciousness/context-review" "refreshCloudConsciousnessContextReview" "$REGISTRY")
    ;;
  envelope-schema)
    ENDPOINT="/cloud-consciousness/envelope-schema"
    REGISTRY="openclaw-cloud-consciousness-envelope-schema-v0"
    HTML_TOKENS=("Cloud Consciousness Envelope Schema" "cloud-consciousness-envelope-schema-panel" "cloud-envelope-schema-fields")
    CLIENT_TOKENS=("/cloud-consciousness/envelope-schema" "refreshCloudConsciousnessEnvelopeSchema" "$REGISTRY")
    ;;
  context-package)
    ENDPOINT="/cloud-consciousness/context-package"
    REGISTRY="openclaw-cloud-consciousness-context-package-v0"
    HTML_TOKENS=("Cloud Consciousness Context Package" "cloud-consciousness-context-package-panel" "cloud-context-package-memory")
    CLIENT_TOKENS=("/cloud-consciousness/context-package" "refreshCloudConsciousnessContextPackage" "$REGISTRY")
    ;;
  redaction-review)
    ENDPOINT="/cloud-consciousness/redaction-review"
    REGISTRY="openclaw-cloud-consciousness-redaction-review-v0"
    HTML_TOKENS=("Cloud Consciousness Redaction Review" "cloud-consciousness-redaction-review-panel" "cloud-redaction-rejected")
    CLIENT_TOKENS=("/cloud-consciousness/redaction-review" "refreshCloudConsciousnessRedactionReview" "$REGISTRY")
    ;;
  transmission-route-review)
    ENDPOINT="/cloud-consciousness/transmission-route-review"
    REGISTRY="openclaw-cloud-consciousness-transmission-route-review-v0"
    HTML_TOKENS=("Cloud Consciousness Transmission Route Review" "cloud-consciousness-transmission-route-review-panel" "cloud-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/transmission-route-review" "refreshCloudConsciousnessTransmissionRouteReview" "$REGISTRY")
    ;;
  handoff-task)
    ENDPOINT="/cloud-consciousness/transmission-route-review"
    REGISTRY="openclaw-cloud-consciousness-handoff-task-v0"
    HTML_TOKENS=("Cloud Consciousness Handoff Task" "cloud-consciousness-handoff-task-panel" "cloud-handoff-task-approval")
    CLIENT_TOKENS=("/cloud-consciousness/transmission-route-review" "refreshCloudConsciousnessHandoffTask" "$REGISTRY")
    ;;
  approved-handoff)
    reset_cloud_handoff_file
    ensure_cloud_handoff
    ENDPOINT="/cloud-consciousness/handoff-readback"
    REGISTRY="openclaw-cloud-consciousness-approved-handoff-v0"
    HTML_TOKENS=("Cloud Consciousness Approved Handoff" "cloud-consciousness-approved-handoff-panel" "cloud-approved-handoff-records")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-approved-handoff-v0" "refreshCloudConsciousnessApprovedHandoff" "/cloud-consciousness/handoff-readback")
    ;;
  handoff-readback)
    ensure_cloud_handoff
    ENDPOINT="/cloud-consciousness/handoff-readback"
    REGISTRY="openclaw-cloud-consciousness-handoff-readback-v0"
    HTML_TOKENS=("Cloud Consciousness Handoff Readback" "cloud-consciousness-handoff-readback-panel" "cloud-handoff-readback-hash")
    CLIENT_TOKENS=("/cloud-consciousness/handoff-readback" "refreshCloudConsciousnessHandoffReadback" "$REGISTRY")
    ;;
  exit)
    ensure_cloud_handoff
    ENDPOINT="/cloud-consciousness/exit"
    REGISTRY="openclaw-cloud-consciousness-exit-v0"
    HTML_TOKENS=("Cloud Consciousness Exit" "cloud-consciousness-exit-panel" "cloud-exit-next")
    CLIENT_TOKENS=("/cloud-consciousness/exit" "refreshCloudConsciousnessExit" "$REGISTRY" "openclaw-cloud-consciousness-provider-adapter-plan")
    ;;
  *)
    echo "Unknown Phase 8 check kind: $CHECK_KIND" >&2
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
if (!data.ok) throw new Error(`Observer Phase 8 endpoint should be ok for ${kind}`);
if (!["handoff-task", "approved-handoff"].includes(kind) && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
if (kind === "approved-handoff" && data.summary?.recordCount < 1) {
  throw new Error(`Observer approved handoff should see at least one record: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousness: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "handoff-task" ]]; then
  reset_cloud_handoff_file
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/handoff-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-cloud-consciousness-handoff-task", "approval-gated task", "Does not write"]) {
  if (!doc.includes(token)) throw new Error(`Phase 8 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-cloud-consciousness-transmission-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Handoff route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-handoff-task-v0" || task.task?.type !== "cloud_consciousness_handoff_task" || task.approval?.status !== "pending") {
  throw new Error(`Cloud handoff task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessHandoff?.artifactWritten !== false || task.governance?.writesHandoffArtifact !== false) {
  throw new Error(`Handoff task shell must not write before approval: ${JSON.stringify(task.task?.cloudConsciousnessHandoff)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessHandoffTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-handoff" ]]; then
  READBACK_FILE="$DATA_FILE"
  curl --silent --fail "$CORE_URL/cloud-consciousness/handoff-readback" > "$READBACK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-approved-handoff", "appends exactly one local handoff JSONL record", "Does not call a cloud model"]) {
  if (!doc.includes(token)) throw new Error(`Phase 8 plan doc missing ${token}`);
}
if (!readback.ok || readback.summary?.ready !== true || readback.summary?.recordCount < 1 || readback.summary?.transmitsExternally !== false || readback.summary?.callsCloudModel !== false) {
  throw new Error(`Approved handoff should produce readable local non-transmitted record: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessApprovedHandoff: { status: "passed", latestRecordId: readback.summary.latestRecordId, hash: readback.summary.latestContentHash } }, null, 2));
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
  "context-review": ["openclaw-cloud-consciousness-context-review", "Prepare the first cloud-consciousness context without transmitting it", "Cloud calls: none"],
  "envelope-schema": ["openclaw-cloud-consciousness-envelope-schema", "openclaw.cloud_consciousness.context_handoff.v0", "content hash"],
  "context-package": ["openclaw-cloud-consciousness-context-package", "long-term memory readback", "Keeps the package untransmitted"],
  "redaction-review": ["openclaw-cloud-consciousness-redaction-review", "raw documents", "secrets"],
  "transmission-route-review": ["openclaw-cloud-consciousness-transmission-route-review", "Defers real provider calls", "openclaw-cloud-consciousness-provider-adapter-plan"],
  "handoff-readback": ["openclaw-cloud-consciousness-handoff-readback", "Verifies schema", "non-transmission status"],
  exit: ["openclaw-cloud-consciousness-exit", "Phase 8 is complete", "openclaw-cloud-consciousness-provider-adapter-plan"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 8 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 8 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "context-review" && (data.summary?.ready !== true || data.summary?.callsCloudModel !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-envelope-schema")) {
  throw new Error(`Context review should be ready and non-calling: ${JSON.stringify(data.summary)}`);
}
if (kind === "envelope-schema" && (data.summary?.ready !== true || data.schema?.id !== "openclaw.cloud_consciousness.context_handoff.v0" || data.summary?.transmitsExternally !== false)) {
  throw new Error(`Envelope schema should be ready and local: ${JSON.stringify(data.summary)}`);
}
if (kind === "context-package" && (data.summary?.ready !== true || data.summary?.memoryRecordCount < 1 || data.summary?.includesSecrets !== false)) {
  throw new Error(`Context package should be ready and redacted: ${JSON.stringify(data.summary)}`);
}
if (kind === "redaction-review" && (data.summary?.ready !== true || data.summary?.includesSecrets !== false || data.summary?.rejectedContentCount < 4)) {
  throw new Error(`Redaction review should reject sensitive content: ${JSON.stringify(data.summary)}`);
}
if (kind === "transmission-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-cloud-consciousness-handoff-task" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Route review should select local handoff and defer provider call: ${JSON.stringify(data.summary)}`);
}
if (kind === "handoff-readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.transmitsExternally !== false || !data.summary?.latestContentHash)) {
  throw new Error(`Handoff readback should verify a non-transmitted local record: ${JSON.stringify(data.summary)}`);
}
if (kind === "exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-provider-adapter-plan")) {
  throw new Error(`Phase 8 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousness: { status: "passed", kind, registry } }, null, 2));
EOF
