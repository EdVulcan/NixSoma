#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6672}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6673}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6674}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6675}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6676}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6677}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6678}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6679}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6680}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-exit-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${EXIT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

created_repair="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_repair")"
post_json "$CORE_URL/approvals/$repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Prepare first Track A repair demo evidence before Phase 2 exit."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence before Phase 2 exit."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve follow-up append before Phase 2 exit."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
EXIT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-2/exit" > "$EXIT_FILE"

node - <<'EOF' "$PLAN_FILE" "$EXIT_FILE"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-phase-2-exit",
  "Phase 2 exit checkpoint",
  "Declares Phase 2 complete",
  "Phase 3 plan",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing exit token: ${token}`);
  }
}
if (!exitGate.ok
  || exitGate.registry !== "openclaw-phase-2-exit-v0"
  || exitGate.status !== "phase_2_complete"
  || exitGate.summary?.complete !== true
  || exitGate.summary?.completionPercent !== 100
  || exitGate.summary?.durableBodyMemoryRecords !== 2) {
  throw new Error(`Phase 2 exit should mark completion: ${JSON.stringify(exitGate.summary)}`);
}
if (exitGate.completedPhase?.completionClaim !== "phase_2_complete"
  || (exitGate.completedPhase?.completedTracks ?? []).length < 3) {
  throw new Error(`Phase 2 exit should summarize completed tracks: ${JSON.stringify(exitGate.completedPhase)}`);
}
if (exitGate.governance?.createsTask !== false
  || exitGate.governance?.createsApproval !== false
  || exitGate.governance?.executesCommand !== false
  || exitGate.governance?.mutatesHost !== false
  || exitGate.governance?.schedulesWork !== false
  || exitGate.governance?.backgroundWriter !== false
  || exitGate.governance?.writesLedger !== false) {
  throw new Error(`Phase 2 exit must remain read-only: ${JSON.stringify(exitGate.governance)}`);
}
if (exitGate.next?.recommendedSlice !== "openclaw-phase-3-plan") {
  throw new Error(`Phase 2 exit should point to Phase 3 plan: ${JSON.stringify(exitGate.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2Exit: {
    status: "passed",
    registry: exitGate.registry,
    completionPercent: exitGate.summary.completionPercent,
    completionClaim: exitGate.completedPhase.completionClaim,
    next: exitGate.next.recommendedSlice,
  },
}, null, 2));
EOF
