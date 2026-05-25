#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${PHASE7_CHECK_KIND:?PHASE7_CHECK_KIND is required}"
OBSERVER_CHECK="${PHASE7_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE7_PORT_BASE:-7150}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_7_PLAN.md"
MEMORY_FILE="$REPO_ROOT/.artifacts/openclaw-long-term-memory/long-term-memory.jsonl"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-7-$CHECK_KIND-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-7-$CHECK_KIND-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

reset_memory_file() {
  rm -f "$MEMORY_FILE"
}

ensure_approved_write() {
  local readback
  readback="$(curl --silent --fail "$CORE_URL/long-term-memory/readback")"
  if node -e 'const data=JSON.parse(process.argv[1]); process.exit(data.summary?.ready === true ? 0 : 1)' "$readback"; then
    return
  fi

  local task_file approval_id
  task_file="$(mktemp)"
  post_json "$CORE_URL/long-term-memory/write-tasks" '{"confirm":true}' > "$task_file"
  approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$task_file")"
  rm -f "$task_file"
  post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-7-milestone-check","reason":"Approve one bounded OpenClaw long-term memory JSONL append."}' >/dev/null
  post_json "$CORE_URL/operator/step" '{}' >/dev/null
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"

case "$CHECK_KIND" in
  write-plan)
    ENDPOINT="/long-term-memory/write-plan"
    REGISTRY="openclaw-long-term-memory-write-plan-v0"
    HTML_TOKENS=("Long-term Memory Write Plan" "long-term-memory-write-plan-panel" "long-term-memory-plan-scope")
    CLIENT_TOKENS=("/long-term-memory/write-plan" "refreshLongTermMemoryWritePlan" "$REGISTRY")
    ;;
  schema)
    ENDPOINT="/long-term-memory/schema"
    REGISTRY="openclaw-long-term-memory-schema-v0"
    HTML_TOKENS=("Long-term Memory Schema" "long-term-memory-schema-panel" "long-term-memory-schema-fields")
    CLIENT_TOKENS=("/long-term-memory/schema" "refreshLongTermMemorySchema" "$REGISTRY")
    ;;
  proposal)
    ENDPOINT="/long-term-memory/proposal"
    REGISTRY="openclaw-long-term-memory-proposal-v0"
    HTML_TOKENS=("Long-term Memory Proposal" "long-term-memory-proposal-panel" "long-term-memory-proposal-type")
    CLIENT_TOKENS=("/long-term-memory/proposal" "refreshLongTermMemoryProposal" "$REGISTRY")
    ;;
  write-route-review)
    ENDPOINT="/long-term-memory/write-route-review"
    REGISTRY="openclaw-long-term-memory-write-route-review-v0"
    HTML_TOKENS=("Long-term Memory Write Route Review" "long-term-memory-write-route-review-panel" "long-term-memory-route-selected")
    CLIENT_TOKENS=("/long-term-memory/write-route-review" "refreshLongTermMemoryWriteRouteReview" "$REGISTRY")
    ;;
  write-task)
    ENDPOINT="/long-term-memory/write-route-review"
    REGISTRY="openclaw-long-term-memory-write-task-v0"
    HTML_TOKENS=("Long-term Memory Write Task" "long-term-memory-write-task-panel" "long-term-memory-task-approval")
    CLIENT_TOKENS=("/long-term-memory/write-route-review" "refreshLongTermMemoryWriteTask" "$REGISTRY")
    ;;
  approved-write)
    reset_memory_file
    ensure_approved_write
    ENDPOINT="/long-term-memory/readback"
    REGISTRY="openclaw-long-term-memory-approved-write-v0"
    HTML_TOKENS=("Long-term Memory Approved Write" "long-term-memory-approved-write-panel" "long-term-memory-approved-records")
    CLIENT_TOKENS=("openclaw-long-term-memory-approved-write-v0" "refreshLongTermMemoryApprovedWrite" "/long-term-memory/readback")
    ;;
  readback)
    ensure_approved_write
    ENDPOINT="/long-term-memory/readback"
    REGISTRY="openclaw-long-term-memory-readback-v0"
    HTML_TOKENS=("Long-term Memory Readback" "long-term-memory-readback-panel" "long-term-memory-readback-hash")
    CLIENT_TOKENS=("/long-term-memory/readback" "refreshLongTermMemoryReadback" "$REGISTRY")
    ;;
  exit)
    ensure_approved_write
    ENDPOINT="/long-term-memory/exit"
    REGISTRY="openclaw-long-term-memory-exit-v0"
    HTML_TOKENS=("Long-term Memory Exit" "long-term-memory-exit-panel" "long-term-memory-exit-next")
    CLIENT_TOKENS=("/long-term-memory/exit" "refreshLongTermMemoryExit" "$REGISTRY" "openclaw-cloud-consciousness-context-review")
    ;;
  *)
    echo "Unknown Phase 7 check kind: $CHECK_KIND" >&2
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
if (!data.ok) throw new Error(`Observer Phase 7 endpoint should be ok for ${kind}`);
if (kind !== "write-task" && kind !== "approved-write" && data.registry !== registry) {
  throw new Error(`Unexpected registry for ${kind}: ${data.registry}`);
}
if (kind === "approved-write" && data.summary?.recordCount < 1) {
  throw new Error(`Observer approved write should see at least one record: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawLongTermMemory: { status: "passed", kind, registry } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "write-task" ]]; then
  reset_memory_file
  TASK_FILE="$(mktemp)"
  post_json "$CORE_URL/long-term-memory/write-tasks" '{"confirm":true}' > "$TASK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$DATA_FILE" "$TASK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const route = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of ["openclaw-long-term-memory-write-task", "approval-gated task", "does not append"]) {
  if (!doc.includes(token)) throw new Error(`Phase 7 plan doc missing ${token}`);
}
if (!route.ok || route.registry !== "openclaw-long-term-memory-write-route-review-v0" || route.summary?.ready !== true) {
  throw new Error(`Write task route should be ready: ${JSON.stringify(route.summary)}`);
}
if (!task.ok || task.registry !== "openclaw-long-term-memory-write-task-v0" || task.task?.type !== "long_term_memory_write_task" || task.approval?.status !== "pending") {
  throw new Error(`Long-term memory write task should be approval-gated: ${JSON.stringify(task)}`);
}
if (task.task?.longTermMemoryWrite?.recordAppended !== false || task.governance?.writesMemory !== false) {
  throw new Error(`Write task shell must not append before approval: ${JSON.stringify(task.task?.longTermMemoryWrite)}`);
}
console.log(JSON.stringify({ openclawLongTermMemoryWriteTask: { status: "passed", taskId: task.task.id, approvalId: task.approval.id } }, null, 2));
EOF
  exit 0
fi

if [[ "$CHECK_KIND" == "approved-write" ]]; then
  STEP_FILE="$(mktemp)"
  READBACK_FILE="$DATA_FILE"
  curl --silent --fail "$CORE_URL/tasks?limit=3" >/dev/null
  curl --silent --fail "$CORE_URL/long-term-memory/readback" > "$READBACK_FILE"
  node - <<'EOF' "$PLAN_DOC" "$READBACK_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const readback = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-long-term-memory-approved-write", "appends exactly one JSONL record", "content hash"]) {
  if (!doc.includes(token)) throw new Error(`Phase 7 plan doc missing ${token}`);
}
if (!readback.ok || readback.summary?.ready !== true || readback.summary?.recordCount < 1 || !readback.summary?.latestContentHash) {
  throw new Error(`Approved write should produce readable memory record: ${JSON.stringify(readback.summary)}`);
}
console.log(JSON.stringify({ openclawLongTermMemoryApprovedWrite: { status: "passed", latestRecordId: readback.summary.latestRecordId, hash: readback.summary.latestContentHash } }, null, 2));
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
  "write-plan": ["openclaw-long-term-memory-write-plan", "Give the body its first governed long-term memory write", ".artifacts/openclaw-long-term-memory/long-term-memory.jsonl"],
  schema: ["openclaw-long-term-memory-schema", "openclaw.long_term_memory.v0", "content hash"],
  proposal: ["openclaw-long-term-memory-proposal", "operational lesson", "avoids bulk import"],
  "write-route-review": ["openclaw-long-term-memory-write-route-review", "Selects the approval-gated write task", "without appending yet"],
  readback: ["openclaw-long-term-memory-readback", "Verifies schema", "content hash"],
  exit: ["openclaw-long-term-memory-exit", "Phase 7 is complete", "openclaw-cloud-consciousness-context-review"],
};
for (const token of docTokensByKind[kind] ?? []) {
  if (!doc.includes(token)) throw new Error(`Phase 7 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 7 registry for ${kind}: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (kind === "write-plan" && (data.summary?.ready !== true || data.summary?.writesMemory !== false || data.next?.recommendedSlice !== "openclaw-long-term-memory-schema")) {
  throw new Error(`Write plan should be ready and non-writing: ${JSON.stringify(data.summary)}`);
}
if (kind === "schema" && (data.summary?.ready !== true || data.schema?.id !== "openclaw.long_term_memory.v0" || data.summary?.callsCloudModel !== false)) {
  throw new Error(`Schema should be ready and local: ${JSON.stringify(data.summary)}`);
}
if (kind === "proposal" && (data.summary?.ready !== true || data.summary?.memoryType !== "operational_lesson" || data.summary?.bulkImport !== false)) {
  throw new Error(`Proposal should be one operational lesson: ${JSON.stringify(data.summary)}`);
}
if (kind === "write-route-review" && (data.summary?.ready !== true || data.summary?.selectedSlice !== "openclaw-long-term-memory-write-task" || data.summary?.writesMemory !== false)) {
  throw new Error(`Route review should select write task without writing: ${JSON.stringify(data.summary)}`);
}
if (kind === "readback" && (data.summary?.ready !== true || data.summary?.recordCount < 1 || !data.summary?.latestContentHash)) {
  throw new Error(`Readback should verify a memory record: ${JSON.stringify(data.summary)}`);
}
if (kind === "exit" && (data.summary?.complete !== true || data.summary?.completionPercent !== 100 || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-context-review")) {
  throw new Error(`Phase 7 exit should be complete: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawLongTermMemory: { status: "passed", kind, registry } }, null, 2));
EOF
