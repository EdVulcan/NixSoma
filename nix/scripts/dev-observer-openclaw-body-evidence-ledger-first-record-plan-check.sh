#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6520}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6521}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6522}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6523}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6524}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6525}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6526}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6527}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6590}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-first-record-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-first-record-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
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
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before observer body evidence ledger first record plan."

created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before observer first-record plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-first-record-plan")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const plan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger First Record Plan",
  "body-evidence-ledger-first-record-plan-panel",
  "body-evidence-ledger-first-record-plan-ready",
  "body-evidence-ledger-first-record-plan-type",
  "body-evidence-ledger-first-record-plan-directory",
  "body-evidence-ledger-first-record-plan-written",
  "body-evidence-ledger-first-record-plan-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-first-record-plan",
  "refreshBodyEvidenceLedgerFirstRecordPlan",
  "bodyEvidenceLedgerFirstRecordPlanReady",
  "bodyEvidenceLedgerFirstRecordPlanType",
  "bodyEvidenceLedgerFirstRecordPlanDirectory",
  "bodyEvidenceLedgerFirstRecordPlanWritten",
  "bodyEvidenceLedgerFirstRecordPlanJson",
  "openclaw-body-evidence-ledger-first-record-route-review",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-first-record-plan-v0") {
  throw new Error(`Observer source should expose first record plan registry: ${JSON.stringify(plan)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.directoryExists !== true
  || plan.summary?.plannedRecordType !== "body_evidence_ledger_bootstrap"
  || plan.summary?.durableStorageWritten !== false) {
  throw new Error(`Observer first record plan summary should be ready without writes: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.canAppendLedgerRecord !== false
  || plan.governance?.canWriteLedger !== false
  || plan.governance?.durableStorageWritten !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.schedulesFollowUp !== false) {
  throw new Error(`Observer first record plan must stay non-mutating: ${JSON.stringify(plan.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFirstRecordPlan: {
    status: "passed",
    panel: "Body Evidence Ledger First Record Plan",
    registry: plan.registry,
    recordType: plan.summary?.plannedRecordType,
    directoryExists: plan.summary?.directoryExists,
    durableStorageWritten: plan.summary?.durableStorageWritten,
  },
}, null, 2));
EOF
