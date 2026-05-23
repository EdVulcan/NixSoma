#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE9_CHECK_KIND:?PHASE9_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE9_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE9_PORT_BASE:-7490}"
PLAN_DOC="$REPO_ROOT/docs/OPENCLAW_PHASE_9_PLAN.md"
LONG_TERM_MEMORY_FILE="$REPO_ROOT/.artifacts/openclaw-long-term-memory/long-term-memory.jsonl"
CLOUD_HANDOFF_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/context-handoff.jsonl"
PROVIDER_DRY_RUN_FILE="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness/provider-dry-run.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-9-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-9-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

reset_provider_dry_run_file() {
  rm -f "$PROVIDER_DRY_RUN_FILE"
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-9-milestone-check","reason":"Prepare Phase 7 long-term memory prerequisite."}' >/dev/null
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
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-9-milestone-check","reason":"Approve local cloud-consciousness context handoff prerequisite."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

ensure_provider_dry_run() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/cloud-consciousness/provider-dry-run-readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/provider-dry-run-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-9-milestone-check","reason":"Approve one local cloud-consciousness provider adapter dry-run transcript."}' >/dev/null
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

case "$CHECK_KIND" in
  provider-adapter-plan)
    ENDPOINT="/cloud-consciousness/provider-adapter-plan"
    REGISTRY="openclaw-cloud-consciousness-provider-adapter-plan-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Adapter Plan" "cloud-consciousness-provider-adapter-plan-panel" "cloud-provider-plan-call")
    CLIENT_TOKENS=("/cloud-consciousness/provider-adapter-plan" "refreshCloudConsciousnessProviderAdapterPlan" "$REGISTRY")
    ;;
  provider-contract)
    ENDPOINT="/cloud-consciousness/provider-contract"
    REGISTRY="openclaw-cloud-consciousness-provider-contract-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Contract" "cloud-consciousness-provider-contract-panel" "cloud-provider-contract-methods")
    CLIENT_TOKENS=("/cloud-consciousness/provider-contract" "refreshCloudConsciousnessProviderContract" "$REGISTRY")
    ;;
  provider-request-envelope)
    ENDPOINT="/cloud-consciousness/provider-request-envelope"
    REGISTRY="openclaw-cloud-consciousness-provider-request-envelope-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Request Envelope" "cloud-consciousness-provider-request-envelope-panel" "cloud-provider-envelope-source")
    CLIENT_TOKENS=("/cloud-consciousness/provider-request-envelope" "refreshCloudConsciousnessProviderRequestEnvelope" "$REGISTRY")
    ;;
  provider-dry-run-route-review)
    ENDPOINT="/cloud-consciousness/provider-dry-run-route-review"
    REGISTRY="openclaw-cloud-consciousness-provider-dry-run-route-review-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Dry Run Route" "cloud-consciousness-provider-dry-run-route-review-panel" "cloud-provider-route-selected")
    CLIENT_TOKENS=("/cloud-consciousness/provider-dry-run-route-review" "refreshCloudConsciousnessProviderDryRunRouteReview" "$REGISTRY")
    ;;
  provider-dry-run-task)
    ENDPOINT="/cloud-consciousness/provider-dry-run-route-review"
    REGISTRY="openclaw-cloud-consciousness-provider-dry-run-task-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Dry Run Task" "cloud-consciousness-provider-dry-run-task-panel" "cloud-provider-task-approval")
    CLIENT_TOKENS=("/cloud-consciousness/provider-dry-run-route-review" "refreshCloudConsciousnessProviderDryRunTask" "$REGISTRY")
    ;;
  approved-provider-dry-run)
    reset_provider_dry_run_file
    ensure_provider_dry_run
    ENDPOINT="/cloud-consciousness/provider-dry-run-readback"
    REGISTRY="openclaw-cloud-consciousness-approved-provider-dry-run-v0"
    HTML_TOKENS=("Cloud Consciousness Approved Provider Dry Run" "cloud-consciousness-approved-provider-dry-run-panel" "cloud-provider-approved-records")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-approved-provider-dry-run-v0" "refreshCloudConsciousnessApprovedProviderDryRun" "/cloud-consciousness/provider-dry-run-readback")
    ;;
  provider-dry-run-readback)
    ensure_provider_dry_run
    ENDPOINT="/cloud-consciousness/provider-dry-run-readback"
    REGISTRY="openclaw-cloud-consciousness-provider-dry-run-readback-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Dry Run Readback" "cloud-consciousness-provider-dry-run-readback-panel" "cloud-provider-readback-hash")
    CLIENT_TOKENS=("/cloud-consciousness/provider-dry-run-readback" "refreshCloudConsciousnessProviderDryRunReadback" "$REGISTRY")
    ;;
  provider-adapter-exit)
    ensure_provider_dry_run
    ENDPOINT="/cloud-consciousness/provider-adapter-exit"
    REGISTRY="openclaw-cloud-consciousness-provider-adapter-exit-v0"
    HTML_TOKENS=("Cloud Consciousness Provider Adapter Exit" "cloud-consciousness-provider-adapter-exit-panel" "cloud-provider-exit-next")
    CLIENT_TOKENS=("/cloud-consciousness/provider-adapter-exit" "refreshCloudConsciousnessProviderAdapterExit" "$REGISTRY" "openclaw-cloud-consciousness-real-provider-call-plan")
    ;;
  *)
    echo "Unknown Phase 9 check kind: $CHECK_KIND" >&2
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
if (!data.ok) throw new Error(`Observer Phase 9 endpoint should be ok for ${kind}`);
if (!["provider-dry-run-task", "approved-provider-dry-run"].includes(kind) && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
if (kind === "approved-provider-dry-run" && data.summary?.recordCount < 1) {
  throw new Error(`Observer approved provider dry-run should see at least one record: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessProvider: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "provider-dry-run-task" ]]; then
  reset_provider_dry_run_file
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/provider-dry-run-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-cloud-consciousness-provider-dry-run-task", "approval-gated provider adapter dry-run task", "Does not write"]) {
  if (!doc.includes(token)) throw new Error(`Phase 9 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-cloud-consciousness-provider-dry-run-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Provider dry-run route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-provider-dry-run-task-v0" || task.task?.type !== "cloud_consciousness_provider_dry_run_task" || task.approval?.status !== "pending") {
  throw new Error(`Provider dry-run task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessProviderDryRun?.artifactWritten !== false || task.governance?.writesDryRunArtifact !== false) {
  throw new Error(`Provider dry-run task shell must not write before approval: ${JSON.stringify(task.task?.cloudConsciousnessProviderDryRun)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessProviderDryRunTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-provider-dry-run" ]]; then
  READBACK_FILE="$DATA_FILE"
  curl --silent --fail "$CORE_URL/cloud-consciousness/provider-dry-run-readback" > "$READBACK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-approved-provider-dry-run", "appends exactly one local provider dry-run JSONL record", "Does not load a provider SDK"]) {
  if (!doc.includes(token)) throw new Error(`Phase 9 plan doc missing ${token}`);
}
if (!readback.ok || readback.summary?.ready !== true || readback.summary?.recordCount < 1 || readback.summary?.transmitsExternally !== false || readback.summary?.callsCloudModel !== false || readback.summary?.providerSdkLoaded !== false) {
  throw new Error(`Approved provider dry-run should produce readable local non-transmitted record: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessApprovedProviderDryRun: { status: "passed", latestRecordId: readback.summary.latestRecordId, hash: readback.summary.latestContentHash } }, null, 2));
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
  "provider-adapter-plan": ["openclaw-cloud-consciousness-provider-adapter-plan", "Define and dry-run a cloud-consciousness provider adapter without external transmission", "Provider SDK loading: none"],
  "provider-contract": ["openclaw-cloud-consciousness-provider-contract", "openclaw.cloud_consciousness.provider_adapter.contract.v0", "Forbids provider SDK loading"],
  "provider-request-envelope": ["openclaw-cloud-consciousness-provider-request-envelope", "openclaw.cloud_consciousness.provider_request.v0", "credential-free"],
  "provider-dry-run-route-review": ["openclaw-cloud-consciousness-provider-dry-run-route-review", "Defers real provider calls", "openclaw-cloud-consciousness-real-provider-call-plan"],
  "provider-dry-run-readback": ["openclaw-cloud-consciousness-provider-dry-run-readback", "Verifies schema", "non-transmission status"],
  "provider-adapter-exit": ["openclaw-cloud-consciousness-provider-adapter-exit", "Phase 9 is complete", "openclaw-cloud-consciousness-real-provider-call-plan"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 9 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 9 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "provider-adapter-plan" && (data.summary?.ready !== true || data.summary?.callsCloudModel !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-provider-contract")) {
  throw new Error(`Provider adapter plan should be ready and non-calling: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-contract" && (data.summary?.ready !== true || data.contract?.id !== "openclaw.cloud_consciousness.provider_adapter.contract.v0" || data.summary?.providerSdkLoaded !== false)) {
  throw new Error(`Provider contract should be ready and SDK-free: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-request-envelope" && (data.summary?.ready !== true || !data.summary?.sourceHandoffRecordId || data.summary?.providerCredentialIncluded !== false)) {
  throw new Error(`Provider request envelope should be ready and credential-free: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-dry-run-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-cloud-consciousness-provider-dry-run-task" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Provider dry-run route should select local task and defer real provider call: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-dry-run-readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || data.summary?.transmitsExternally !== false || data.summary?.providerSdkLoaded !== false || !data.summary?.latestContentHash)) {
  throw new Error(`Provider dry-run readback should verify a non-transmitted local record: ${JSON.stringify(data.summary)}`);
}
if (kind === "provider-adapter-exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-real-provider-call-plan")) {
  throw new Error(`Phase 9 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessProvider: { status: "passed", kind, registry } }, null, 2));
EOF
