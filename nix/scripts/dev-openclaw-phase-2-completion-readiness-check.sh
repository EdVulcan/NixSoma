#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6654}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6655}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6656}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6657}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6658}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6659}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6660}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6661}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6666}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-completion-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-completion-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

created_repair="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_repair")"
post_json "$CORE_URL/approvals/$repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Prepare first Track A repair demo evidence before Phase 2 completion readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence before Phase 2 completion readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve follow-up append before Phase 2 completion readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$CORE_URL/phase-2/completion-readiness")"

node - <<'EOF' "$PLAN_FILE" "$readiness"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-completion-readiness",
  "Phase 2 completion readiness checkpoint",
  "Verifies real repair evidence",
  "Must not add more body-memory records",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing completion readiness token: ${token}`);
  }
}
if (!readiness.ok
  || readiness.registry !== "openclaw-phase-2-completion-readiness-v0"
  || readiness.status !== "ready_for_phase_2_exit"
  || readiness.summary?.ready !== true
  || readiness.summary?.completionPercent !== 100
  || readiness.summary?.durableBodyMemoryRecords !== 2) {
  throw new Error(`Phase 2 completion readiness should be 100% ready: ${JSON.stringify(readiness.summary)}`);
}
for (const id of [
  "track-a-first-repair-demo",
  "track-a-next-repair-demo",
  "track-a-candidate-demo",
  "track-b-demo-exit",
  "track-c-body-governance",
  "track-c-durable-body-memory",
  "no-hidden-autonomy",
]) {
  const check = readiness.checks?.find((item) => item.id === id);
  if (!check || check.passed !== true) {
    throw new Error(`Phase 2 completion readiness missing passed check ${id}: ${JSON.stringify(readiness.checks)}`);
  }
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.mutatesHost !== false
  || readiness.governance?.schedulesWork !== false
  || readiness.governance?.backgroundWriter !== false
  || readiness.governance?.writesLedger !== false) {
  throw new Error(`Phase 2 completion readiness must remain read-only: ${JSON.stringify(readiness.governance)}`);
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-exit") {
  throw new Error(`Phase 2 completion readiness should point to exit: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2CompletionReadiness: {
    status: "passed",
    registry: readiness.registry,
    completionPercent: readiness.summary.completionPercent,
    durableBodyMemoryRecords: readiness.summary.durableBodyMemoryRecords,
    next: readiness.next.recommendedSlice,
  },
}, null, 2));
EOF
