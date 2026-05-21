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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-readiness-check.json}"

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
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before ledger readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before ledger readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-readiness")"

node - <<'EOF' "$PLAN_FILE" "$readiness"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-readiness",
  "Body evidence ledger readiness checkpoint",
  "Verifies exactly one `body_evidence_ledger_bootstrap` JSONL record",
  "Must return to whitepaper route review",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing ledger readiness token: ${token}`);
  }
}

if (!readiness.ok || readiness.registry !== "openclaw-body-evidence-ledger-readiness-v0") {
  throw new Error(`ledger readiness should expose expected registry: ${JSON.stringify(readiness)}`);
}
if (readiness.mode !== "read_only_body_evidence_ledger_readiness") {
  throw new Error(`ledger readiness should remain read-only: ${JSON.stringify(readiness.mode)}`);
}
if (readiness.summary?.ready !== true
  || readiness.summary?.passedChecks !== readiness.summary?.totalChecks
  || readiness.summary?.ledgerFileExists !== true
  || readiness.summary?.recordCount !== 1
  || readiness.summary?.bootstrapRecordCount !== 1
  || readiness.summary?.hiddenMutation !== false) {
  throw new Error(`ledger readiness should show one ready bootstrap record: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.canAppendLedgerRecord !== false
  || readiness.governance?.canWriteLedger !== false
  || readiness.governance?.schedulesFollowUp !== false
  || readiness.governance?.backgroundWriter !== false
  || readiness.governance?.bulkImport !== false) {
  throw new Error(`ledger readiness must not execute, write, or schedule work: ${JSON.stringify(readiness.governance)}`);
}
if (!readiness.checks?.every((check) => check.passed === true)) {
  throw new Error(`ledger readiness checks should all pass: ${JSON.stringify(readiness.checks)}`);
}
const record = readiness.evidence?.records?.[0];
if (record?.evidenceType !== "body_evidence_ledger_bootstrap"
  || record?.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || record?.hashValid !== true
  || record?.governance?.appendOnly !== true
  || record?.governance?.scheduler !== false
  || record?.governance?.backgroundWriter !== false
  || record?.governance?.bulkImport !== false
  || typeof record?.governance?.taskId !== "string"
  || typeof record?.governance?.approvalId !== "string") {
  throw new Error(`ledger readiness should expose bootstrap record governance: ${JSON.stringify(record)}`);
}
for (const slice of [
  "openclaw-body-evidence-ledger-first-record-task",
  "openclaw-body-evidence-ledger-first-record-append",
]) {
  if (!readiness.completedBlock?.completedSlices?.includes(slice)) {
    throw new Error(`ledger readiness missing completed slice ${slice}: ${JSON.stringify(readiness.completedBlock)}`);
  }
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`ledger readiness should return to route review: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerReadiness: {
    status: "passed",
    registry: readiness.registry,
    checks: `${readiness.summary.passedChecks}/${readiness.summary.totalChecks}`,
    recordCount: readiness.summary.recordCount,
    latestRecordId: readiness.summary.latestRecordId,
    next: readiness.next.recommendedSlice,
  },
}, null, 2));
EOF
