#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE13_14_CHECK_KIND:?PHASE13_14_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE13_14_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE13_14_PORT_BASE:-8300}"
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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-13-14-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-13-14-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

seed_phase12_execution_plan() {
  mkdir -p "$CLOUD_DIR"
  node - <<'EOF' "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE"
const fs = require("node:fs");
const crypto = require("node:crypto");
const [runbookFile, executionPlanFile] = process.argv.slice(2);
const runbook = {
  id: "phase13-prereq-live-provider-runbook",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.live_provider_call_runbook.v0",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    liveProviderCallEnabled: false,
    externalTransmissionAllowed: false
  }
};
runbook.contentHash = crypto.createHash("sha256").update(JSON.stringify(runbook)).digest("hex");
fs.writeFileSync(runbookFile, JSON.stringify(runbook) + "\n");
const record = {
  id: "phase13-prereq-live-provider-execution-plan",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.live_provider_call_execution_plan.v0",
  runbookRecordId: runbook.id,
  runbookContentHash: runbook.contentHash,
  endpointFingerprint: "phase13-endpoint-fingerprint",
  credentialReference: "openclaw://credential/provider/live-provider-fixture",
  requestEnvelopeHash: "phase13-request-envelope-hash",
  status: "execution_plan_recorded",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    liveProviderCallEnabled: false,
    externalTransmissionAllowed: false
  }
};
record.contentHash = crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
fs.writeFileSync(executionPlanFile, JSON.stringify(record) + "\n");
EOF
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_phase12_execution_plan
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

case "$CHECK_KIND" in
  runtime-adapter-plan)
    ENDPOINT="/cloud-consciousness/live-provider-call-runtime-adapter-plan"
    REGISTRY="openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan-v0"
    PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_13_PLAN.md"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runtime Adapter Plan" "cloud-consciousness-live-provider-call-runtime-adapter-plan-panel" "cloud-live-runtime-adapter-plan-ready")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-call-runtime-adapter-plan" "refreshCloudConsciousnessLiveProviderCallRuntimeAdapterPlan" "$REGISTRY")
    ;;
  runtime-adapter-task)
    ENDPOINT="/cloud-consciousness/live-provider-call-runtime-adapter-plan"
    REGISTRY="openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0"
    PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_14_PLAN.md"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runtime Adapter Plan" "cloud-live-runtime-adapter-plan-next")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-runtime-adapter-tasks" "$REGISTRY")
    ;;
  approved-runtime-adapter-deferred)
    ENDPOINT="/cloud-consciousness/live-provider-runtime-adapter-exit"
    REGISTRY="openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0"
    PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_14_PLAN.md"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runtime Adapter Exit" "cloud-consciousness-live-provider-runtime-adapter-exit-panel")
    CLIENT_TOKENS=("openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0" "refreshCloudConsciousnessLiveProviderRuntimeAdapterExit")
    ;;
  runtime-adapter-exit)
    ENDPOINT="/cloud-consciousness/live-provider-runtime-adapter-exit"
    REGISTRY="openclaw-cloud-consciousness-live-provider-runtime-adapter-exit-v0"
    PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_14_PLAN.md"
    HTML_TOKENS=("Cloud Consciousness Live Provider Runtime Adapter Exit" "cloud-live-runtime-adapter-exit-complete")
    CLIENT_TOKENS=("/cloud-consciousness/live-provider-runtime-adapter-exit" "$REGISTRY" "openclaw-cloud-consciousness-live-provider-call-final-authorization")
    ;;
  *)
    echo "Unknown Phase 13/14 check kind: $CHECK_KIND" >&2
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
  node - <<'EOF' "$REGISTRY" "$DATA_FILE" "$HTML_FILE" "$CLIENT_FILE" "${HTML_TOKENS[@]}" -- "${CLIENT_TOKENS[@]}"
const fs = require("node:fs");
const registry = process.argv[2];
const data = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
const separator = process.argv.indexOf("--");
const htmlTokens = process.argv.slice(6, separator);
const clientTokens = process.argv.slice(separator + 1);
for (const token of htmlTokens) if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
for (const token of clientTokens) if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
if (!data.ok) throw new Error(`Observer Phase 13/14 endpoint should be ok`);
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessRuntimeAdapter: { status: "passed", registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "runtime-adapter-task" ]]; then
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-runtime-adapter-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const task = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-live-provider-runtime-adapter-task", "approval-gated runtime adapter task shell", "Keeps live provider egress disabled"]) {
  if (!doc.includes(token)) throw new Error(`Phase 14 plan doc missing ${token}`);
}
if (!task.ok || task.registry !== "openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0" || task.task?.type !== "cloud_consciousness_live_provider_runtime_adapter_task" || task.approval?.status !== "pending") {
  throw new Error(`Runtime adapter task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.cloudConsciousnessLiveProviderRuntimeAdapter?.liveProviderCallEnabled !== false || task.governance?.transmitsExternally !== false) {
  throw new Error(`Runtime adapter task must keep live egress disabled: ${JSON.stringify(task.task?.cloudConsciousnessLiveProviderRuntimeAdapter)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessLiveProviderRuntimeAdapterTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-runtime-adapter-deferred" ]]; then
  TASK_FILE="$(mktemp)"
  APPROVED_FILE="$(mktemp)"
  STEP_FILE="$(mktemp)"
  post_json "$CORE_URL/cloud-consciousness/live-provider-runtime-adapter-tasks" '{"confirm":true}' > "$TASK_FILE"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(data.approval.id)' "$TASK_FILE")"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-14-check","reason":"Approve deferred runtime adapter shell."}' > "$APPROVED_FILE"
  post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
  node - <<'EOF' "$PLAN_DOC" "$STEP_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const step = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-cloud-consciousness-approved-live-provider-runtime-adapter-deferred", "records the runtime adapter shell as deferred", "Does not call a provider"]) {
  if (!doc.includes(token)) throw new Error(`Phase 14 plan doc missing ${token}`);
}
if (!step.ok || step.task?.cloudConsciousnessLiveProviderRuntimeAdapter?.implementationStatus !== "deferred_after_approval") {
  throw new Error(`Approved runtime adapter should defer after approval: ${JSON.stringify(step.execution)}`);
}
const adapter = step.task.cloudConsciousnessLiveProviderRuntimeAdapter;
if (adapter?.transmitsExternally !== false || adapter?.providerSdkLoaded !== false || adapter?.liveProviderCallEnabled !== false) {
  throw new Error(`Approved runtime adapter must not enable live egress: ${JSON.stringify(adapter)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessApprovedLiveProviderRuntimeAdapterDeferred: { status: "passed", taskId: step.task.id } }, null, 2));
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
  "runtime-adapter-plan": ["openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan", "Plan the live provider-call runtime adapter without implementing it", "Selects `openclaw-cloud-consciousness-live-provider-runtime-adapter-task`"],
  "runtime-adapter-exit": ["openclaw-cloud-consciousness-live-provider-runtime-adapter-exit", "Closes Phase 14 at 100%", "openclaw-cloud-consciousness-live-provider-call-final-authorization"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 13/14 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 13/14 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "runtime-adapter-plan" && (data.summary?.ready !== true || data.summary?.completionPercent !== 100 || data.summary?.providerSdkLoaded !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-runtime-adapter-task")) {
  throw new Error(`Runtime adapter plan should be ready and non-live: ${JSON.stringify(data.summary)}`);
}
if (kind === "runtime-adapter-exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.summary?.transmitsExternally !== false || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-call-final-authorization")) {
  throw new Error(`Runtime adapter exit should be complete and deferred: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessRuntimeAdapter: { status: "passed", kind, registry } }, null, 2));
EOF
