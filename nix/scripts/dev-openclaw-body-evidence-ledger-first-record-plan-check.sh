#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6510}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6511}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6512}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6513}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6514}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6515}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6516}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6517}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6580}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-first-record-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-first-record-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger first record plan."

created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before planning first record."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-first-record-plan")"

node - <<'EOF' "$PLAN_FILE" "$plan"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-first-record-plan",
  "Body evidence ledger first record plan checkpoint",
  "planned bootstrap record type",
  "Creates no task, no approval, no command execution",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing first record plan token: ${token}`);
  }
}

if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-first-record-plan-v0") {
  throw new Error(`first record plan should expose expected registry: ${JSON.stringify(plan)}`);
}
if (plan.mode !== "plan_only_body_evidence_ledger_first_record") {
  throw new Error(`first record plan should remain plan-only: ${JSON.stringify(plan.mode)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.ledgerPlanReady !== true
  || plan.summary?.timelineReady !== true
  || plan.summary?.directoryExists !== true
  || plan.summary?.plannedRecordType !== "body_evidence_ledger_bootstrap"
  || plan.summary?.durableStorageWritten !== false
  || plan.summary?.hiddenMutation !== false) {
  throw new Error(`first record plan summary should be ready without writes: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.canAppendLedgerRecord !== false
  || plan.governance?.canWriteLedger !== false
  || plan.governance?.durableStorageWritten !== false
  || plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.executesCommand !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.schedulesFollowUp !== false) {
  throw new Error(`first record plan must not write or execute: ${JSON.stringify(plan.governance)}`);
}
if (plan.plan?.ledgerRoot?.displayPath !== ".artifacts/openclaw-body-evidence-ledger"
  || plan.plan?.ledgerRoot?.exists !== true) {
  throw new Error(`first record plan should cite existing ledger root: ${JSON.stringify(plan.plan?.ledgerRoot)}`);
}
if (plan.plan?.plannedRecord?.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || plan.plan?.plannedRecord?.sourceEndpoint !== "/system/route/body-evidence-timeline-readiness"
  || !String(plan.plan?.plannedRecord?.contentHashStrategy ?? "").includes("sha256")) {
  throw new Error(`first record plan should define source and hash strategy: ${JSON.stringify(plan.plan?.plannedRecord)}`);
}
for (const field of ["id", "recordedAt", "sourceRegistry", "sourceEndpoint", "phase", "evidenceType", "summary", "contentHash", "governance"]) {
  if (!plan.plan?.requiredFields?.includes(field)) {
    throw new Error(`first record plan required fields missing ${field}: ${JSON.stringify(plan.plan?.requiredFields)}`);
  }
}
if (plan.next?.recommendedSlice !== "openclaw-body-evidence-ledger-first-record-route-review") {
  throw new Error(`first record plan should route to first record route review: ${JSON.stringify(plan.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFirstRecordPlan: {
    status: "passed",
    registry: plan.registry,
    recordType: plan.summary.plannedRecordType,
    directoryExists: plan.summary.directoryExists,
    durableStorageWritten: plan.summary.durableStorageWritten,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
