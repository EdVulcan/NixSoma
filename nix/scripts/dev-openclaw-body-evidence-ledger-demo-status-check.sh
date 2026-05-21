#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6510}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6511}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6512}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6513}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6514}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6515}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6516}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6517}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6580}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-demo-status-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before ledger demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before ledger demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
status="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-demo-status")"

node - <<'EOF' "$PLAN_FILE" "$status"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const status = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-demo-status",
  "Body evidence ledger demo status checkpoint",
  "Exposes checklist status, bootstrap record id",
  "Creates no task, no approval, no command execution",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing ledger demo status token: ${token}`);
  }
}

if (!status.ok || status.registry !== "openclaw-body-evidence-ledger-demo-status-v0") {
  throw new Error(`ledger demo status should expose expected registry: ${JSON.stringify(status)}`);
}
if (status.mode !== "read_only_body_evidence_ledger_demo_status") {
  throw new Error(`ledger demo status should remain read-only: ${JSON.stringify(status.mode)}`);
}
if (status.summary?.demoReady !== true
  || status.summary?.passed !== status.summary?.total
  || status.summary?.ledgerReady !== true
  || status.summary?.recordCount !== 1
  || typeof status.summary?.bootstrapRecordId !== "string"
  || typeof status.summary?.bootstrapRecordHash !== "string"
  || status.summary?.hiddenMutation !== false) {
  throw new Error(`ledger demo status should be ready with one bootstrap record: ${JSON.stringify(status.summary)}`);
}
if (status.governance?.createsTask !== false
  || status.governance?.createsApproval !== false
  || status.governance?.executesCommand !== false
  || status.governance?.hostMutation !== false
  || status.governance?.canAppendLedgerRecord !== false
  || status.governance?.canWriteLedger !== false
  || status.governance?.schedulesFollowUp !== false
  || status.governance?.backgroundWriter !== false
  || status.governance?.bulkImport !== false) {
  throw new Error(`ledger demo status must stay read-only: ${JSON.stringify(status.governance)}`);
}
if (!status.checklist?.every((item) => item.passed === true)) {
  throw new Error(`ledger demo status checklist should pass: ${JSON.stringify(status.checklist)}`);
}
if (!status.demoNarrative?.some((line) => line.includes("explicit task and approval"))
  || !status.demoNarrative?.some((line) => line.includes("No background ledger writer"))) {
  throw new Error(`ledger demo status should explain provenance and no-background boundary: ${JSON.stringify(status.demoNarrative)}`);
}
if (status.evidence?.record?.governance?.scheduler !== false
  || status.evidence?.record?.governance?.backgroundWriter !== false
  || status.evidence?.record?.governance?.bulkImport !== false) {
  throw new Error(`ledger demo status should expose record governance boundary: ${JSON.stringify(status.evidence?.record)}`);
}
if (status.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`ledger demo status should return to route review: ${JSON.stringify(status.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerDemoStatus: {
    status: "passed",
    registry: status.registry,
    checks: `${status.summary.passed}/${status.summary.total}`,
    recordId: status.summary.bootstrapRecordId,
    next: status.next.recommendedSlice,
  },
}, null, 2));
EOF
