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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-demo-status-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

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

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before observer ledger demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before observer ledger demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
status="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-demo-status")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$status"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const status = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger Demo Status",
  "body-evidence-ledger-demo-status-panel",
  "body-evidence-ledger-demo-status-ready",
  "body-evidence-ledger-demo-status-checks",
  "body-evidence-ledger-demo-status-record",
  "body-evidence-ledger-demo-status-mutation",
  "body-evidence-ledger-demo-status-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-demo-status",
  "refreshBodyEvidenceLedgerDemoStatus",
  "bodyEvidenceLedgerDemoStatusReady",
  "bodyEvidenceLedgerDemoStatusChecks",
  "bodyEvidenceLedgerDemoStatusRecord",
  "bodyEvidenceLedgerDemoStatusMutation",
  "bodyEvidenceLedgerDemoStatusJson",
  "No background ledger writer",
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
if (!status.ok || status.registry !== "openclaw-body-evidence-ledger-demo-status-v0") {
  throw new Error(`Observer source should expose ledger demo status registry: ${JSON.stringify(status)}`);
}
if (status.summary?.demoReady !== true
  || status.summary?.recordCount !== 1
  || typeof status.summary?.bootstrapRecordId !== "string"
  || typeof status.summary?.bootstrapRecordHash !== "string") {
  throw new Error(`Observer ledger demo status should be demo-ready with one record: ${JSON.stringify(status.summary)}`);
}
if (status.governance?.createsTask !== false
  || status.governance?.createsApproval !== false
  || status.governance?.executesCommand !== false
  || status.governance?.hostMutation !== false
  || status.governance?.schedulesFollowUp !== false
  || status.governance?.backgroundWriter !== false
  || status.governance?.bulkImport !== false) {
  throw new Error(`Observer ledger demo status must stay read-only: ${JSON.stringify(status.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerDemoStatus: {
    status: "passed",
    panel: "Body Evidence Ledger Demo Status",
    registry: status.registry,
    recordId: status.summary?.bootstrapRecordId,
    checks: `${status.summary?.passed}/${status.summary?.total}`,
  },
}, null, 2));
EOF
