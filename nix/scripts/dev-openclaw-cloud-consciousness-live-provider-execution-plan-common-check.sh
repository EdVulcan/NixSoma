#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE12_CHECK_KIND:?PHASE12_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE12_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE12_PORT_BASE:-8010}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_12_PLAN.md"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-12-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-12-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

seed_phase11_runbook() {
  mkdir -p "$CLOUD_DIR"
  node - <<'EOF' "$RUNBOOK_FILE"
const fs = require("node:fs");
const file = process.argv[2];
const recordBase = {
  id: "phase12-prereq-live-provider-runbook",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.live_provider_call_runbook.v0",
  reviewedResponseRecordId: "phase12-prereq-provider-response",
  reviewedResponseHash: "phase12-prereq-provider-response-hash",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    liveProviderCallEnabled: false,
    externalTransmissionAllowed: false
  },
  runbook: {
    liveCallEnabled: false,
    steps: ["phase12 prerequisite runbook fixture"],
    rollback: "fixture only"
  }
};
const contentHash = require("node:crypto").createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
fs.writeFileSync(file, JSON.stringify({ ...recordBase, contentHash }) + "\n");
EOF
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp" "$EXECUTION_PLAN_FILE"
seed_phase11_runbook
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${READBACK_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

case "$CHECK_KIND" in
  live-provider-call-execution-plan)
    ENDPOINT="/cloud-consciousness/live-provider-call-execution-plan"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-execution-plan-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Call Execution Plan" "cloud-consciousness-live-provider-call-execution-plan-panel" "cloud-live-exec-plan-ready")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-call-execution-plan" "refreshCloudConsciousnessLiveProviderCallExecutionPlan" "$REGISTRY")
    ;;
  live-provider-endpoint-credential-binding)
    ENDPOINT="/cloud-consciousness/live-provider-endpoint-credential-binding"
    REGISTRY="openclaw-cloud-consciousness-live-provider-endpoint-credential-binding-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Call Execution Plan" "cloud-live-exec-plan-enabled" "cloud-live-exec-route-ready")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-endpoint-credential-binding" "$REGISTRY")
    ;;
  live-provider-execution-transcript-schema)
    ENDPOINT="/cloud-consciousness/live-provider-execution-transcript-schema"
    REGISTRY="openclaw-cloud-consciousness-live-provider-execution-transcript-schema-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Execution Route" "cloud-live-exec-route-json")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-execution-transcript-schema" "$REGISTRY")
    ;;
  live-provider-execution-route-review)
    ENDPOINT="/cloud-consciousness/live-provider-execution-route-review"
    REGISTRY="openclaw-cloud-consciousness-live-provider-execution-route-review-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Execution Route" "cloud-consciousness-live-provider-execution-route-review-panel" "cloud-live-exec-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-execution-route-review" "refreshCloudConsciousnessLiveProviderExecutionRouteReview" "$REGISTRY")
    ;;
  live-provider-execution-plan-task)
    ENDPOINT="/cloud-consciousness/live-provider-execution-route-review"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-execution-plan-task-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Execution Route" "cloud-live-exec-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-execution-plan-tasks" "$REGISTRY")
    ;;
  approved-live-provider-execution-plan)
    ENDPOINT="/cloud-consciousness/live-provider-execution-plan-readback"
    REGISTRY="openclaw-cloud-consciousness-approved-live-provider-execution-plan-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Execution Plan Readback" "cloud-live-exec-readback-records")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-approved-live-provider-execution-plan-v0" "refreshCloudConsciousnessLiveProviderExecutionPlanReadback")
    ;;
  live-provider-execution-plan-readback)
    ENDPOINT="/cloud-consciousness/live-provider-execution-plan-readback"
    REGISTRY="openclaw-cloud-consciousness-live-provider-execution-plan-readback-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Execution Plan Readback" "cloud-consciousness-live-provider-execution-plan-readback-panel" "cloud-live-exec-readback-hash")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-execution-plan-readback" "refreshCloudConsciousnessLiveProviderExecutionPlanReadback" "$REGISTRY")
    ;;
  live-provider-call-execution-plan-exit)
    ENDPOINT="/cloud-consciousness/live-provider-call-execution-plan-exit"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-execution-plan-exit-v0"
    HTML_TOKENS=("Cloud Consciousness Live Provider Call Execution Plan Exit" "cloud-consciousness-live-provider-call-execution-plan-exit-panel" "cloud-live-exec-exit-next")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-call-execution-plan-exit" "refreshCloudConsciousnessLiveProviderCallExecutionPlanExit" "$REGISTRY" "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan")
    ;;
  *)
    echo "Unknown Phase 12 check kind: $CHECK_KIND" >&2
    exit 1
    ;;
esac

ensure_execution_plan_record() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-execution-plan-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-execution-plan-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-12-milestone-check","reason":"Approve one local live provider-call execution plan artifact."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

case "$CHECK_KIND" in
  approved-live-provider-execution-plan|live-provider-execution-plan-readback|live-provider-call-execution-plan-exit)
    ensure_execution_plan_record
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
if (!data.ok) throw new Error(`Observer Phase 12 endpoint should be ok for ${kind}`);
if (!["live-provider-execution-plan-task", "approved-live-provider-execution-plan"].includes(kind) && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessLiveProviderExecutionPlan: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "live-provider-execution-plan-task" ]]; then
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-execution-plan-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-cloud-consciousness-live-provider-execution-plan-task", "approval-gated local execution-plan task", "Does not write the JSONL artifact before approval"]) {
  if (!doc.includes(token)) throw new Error(`Phase 12 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-cloud-consciousness-live-provider-execution-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Live provider execution route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-live-provider-call-execution-plan-task-v0" || task.task?.type !== "cloud_consciousness_live_provider_execution_plan_task" || task.approval?.status !== "pending") {
  throw new Error(`Live provider execution-plan task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessLiveProviderExecutionPlan?.artifactWritten !== false || task.governance?.writesExecutionPlanArtifact !== false) {
  throw new Error(`Execution-plan task shell must not write before approval: ${JSON.stringify(task.task?.cloudConsciousnessLiveProviderExecutionPlan)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProviderExecutionPlanTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
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
  "live-provider-call-execution-plan": ["openclaw-cloud-consciousness-live-provider-call-execution-plan", "Create the live provider-call execution plan without executing the live provider call", "Live provider call enabled: false"],
  "live-provider-endpoint-credential-binding": ["openclaw-cloud-consciousness-live-provider-endpoint-credential-binding", "Keeps endpoint host values and credential values unread", "Keeps endpoint contact disabled"],
  "live-provider-execution-transcript-schema": ["openclaw-cloud-consciousness-live-provider-execution-transcript-schema", "openclaw.cloud_consciousness.live_provider.execution_plan_transcript.v0", "execution_plan_recorded"],
  "live-provider-execution-route-review": ["openclaw-cloud-consciousness-live-provider-execution-route-review", "Defers actual provider egress", "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan"],
  "approved-live-provider-execution-plan": ["openclaw-cloud-consciousness-approved-live-provider-execution-plan", "appends exactly one local live provider-call execution-plan JSONL record", "Does not call a cloud provider"],
  "live-provider-execution-plan-readback": ["openclaw-cloud-consciousness-live-provider-execution-plan-readback", "Verifies schema", "non-transmission status"],
  "live-provider-call-execution-plan-exit": ["openclaw-cloud-consciousness-live-provider-call-execution-plan-exit", "Closes Phase 12 at 100%", "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 12 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 12 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "live-provider-call-execution-plan" && (data.summary?.ready !== true || data.summary?.liveProviderCallEnabled !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding")) {
  throw new Error(`Live provider execution plan should be ready and non-live: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-endpoint-credential-binding" && (data.summary?.ready !== true || data.summary?.endpointContacted !== false || data.summary?.credentialValueRead !== false)) {
  throw new Error(`Endpoint credential binding should be metadata-only: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-execution-transcript-schema" && (data.summary?.ready !== true || data.schema?.id !== "openclaw.cloud_consciousness.live_provider.execution_plan_transcript.v0" || data.schema?.phase12AllowedStatus !== "execution_plan_recorded")) {
  throw new Error(`Execution transcript schema should be ready and plan-recorded: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-execution-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-execution-plan-task" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Execution route should select execution-plan task and defer live egress: ${JSON.stringify(data.summary)}`);
}
if (kind === "approved-live-provider-execution-plan" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.callsCloudModel !== false || data.summary?.liveProviderCallEnabled !== false)) {
  throw new Error(`Approved execution plan should produce readable local non-live record: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-execution-plan-readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.providerCredentialRead !== false || !data.summary?.latestContentHash)) {
  throw new Error(`Execution plan readback should verify a non-live local record: ${JSON.stringify(data.summary)}`);
}
if (kind === "live-provider-call-execution-plan-exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan")) {
  throw new Error(`Phase 12 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProviderExecutionPlan: { status: "passed", kind, registry } }, null, 2));
EOF
