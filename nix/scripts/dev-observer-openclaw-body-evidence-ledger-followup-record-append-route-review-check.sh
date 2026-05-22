#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6606}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6607}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6608}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6609}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6610}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6611}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6612}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6613}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6654}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-append-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-append-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare observer follow-up append route review."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
route_review="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-append-route-review")"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created_record_task" "$route_review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const routeReview = JSON.parse(process.argv[5]);
const ledgerLines = fs.readFileSync(process.argv[6], "utf8").trim().split("\n").filter(Boolean);

const requiredHtml = [
  "Body Evidence Ledger Follow-up Append Route Review",
  "body-evidence-ledger-followup-record-append-route-review-panel",
  "body-evidence-ledger-followup-record-append-route-review-status",
  "body-evidence-ledger-followup-record-append-route-review-next",
  "body-evidence-ledger-followup-record-append-route-review-approves",
  "body-evidence-ledger-followup-record-append-route-review-appended",
  "body-evidence-ledger-followup-record-append-route-review-json",
];
const requiredClient = [
  "/phase-2/body-evidence-ledger-followup-record-append-route-review",
  "refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview",
  "bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus",
  "bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext",
  "bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves",
  "bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended",
  "openclaw-body-evidence-ledger-followup-record-append-route-review-v0",
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
if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`Observer setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!routeReview.ok
  || routeReview.registry !== "openclaw-body-evidence-ledger-followup-record-append-route-review-v0"
  || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append"
  || routeReview.summary?.taskId !== created.task?.id
  || routeReview.summary?.approvalStatus !== "pending"
  || routeReview.governance?.approvesTask !== false
  || routeReview.governance?.recordAppended !== false) {
  throw new Error(`Observer-facing append route review should stay review-only: ${JSON.stringify(routeReview)}`);
}
if (ledgerLines.length !== 1 || routeReview.evidence?.noSecondRecord !== true) {
  throw new Error(`Observer-facing append route review must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordAppendRouteReview: {
    status: "passed",
    panel: "Body Evidence Ledger Follow-up Append Route Review",
    registry: routeReview.registry,
    selectedSlice: routeReview.decision?.selectedSlice,
    taskId: routeReview.summary?.taskId,
    approvesTask: routeReview.governance?.approvesTask,
    recordAppended: routeReview.governance?.recordAppended,
  },
}, null, 2));
EOF
