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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-first-record-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-first-record-route-review-check.json}"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before observer body evidence ledger first record route review."

created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before observer first-record route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-first-record-route-review")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$review"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const review = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger First Record Route Review",
  "body-evidence-ledger-first-record-route-review-panel",
  "body-evidence-ledger-first-record-route-review-status",
  "body-evidence-ledger-first-record-route-review-next",
  "body-evidence-ledger-first-record-route-review-write",
  "body-evidence-ledger-first-record-route-review-written",
  "body-evidence-ledger-first-record-route-review-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-first-record-route-review",
  "refreshBodyEvidenceLedgerFirstRecordRouteReview",
  "bodyEvidenceLedgerFirstRecordRouteReviewStatus",
  "bodyEvidenceLedgerFirstRecordRouteReviewNext",
  "bodyEvidenceLedgerFirstRecordRouteReviewWrite",
  "bodyEvidenceLedgerFirstRecordRouteReviewWritten",
  "bodyEvidenceLedgerFirstRecordRouteReviewJson",
  "openclaw-body-evidence-ledger-first-record-task",
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
if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-first-record-route-review-v0") {
  throw new Error(`Observer source should expose first record route review registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-first-record-task"
  || review.evidence?.firstRecordPlanReady !== true
  || review.evidence?.directoryExists !== true
  || review.evidence?.plannedRecordType !== "body_evidence_ledger_bootstrap") {
  throw new Error(`Observer first record route review should select task shell from ready evidence: ${JSON.stringify(review)}`);
}
if (!review.decision?.notSelected?.includes("no background ledger writer")) {
  throw new Error(`Observer first record route review should show background writer deferral: ${JSON.stringify(review.decision?.notSelected)}`);
}
if (review.governance?.canAppendLedgerRecord !== false
  || review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.createsTask !== false
  || review.governance?.hostMutation !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`Observer first record route review must stay non-mutating: ${JSON.stringify(review.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFirstRecordRouteReview: {
    status: "passed",
    panel: "Body Evidence Ledger First Record Route Review",
    registry: review.registry,
    selectedSlice: review.decision?.selectedSlice,
    recordType: review.evidence?.plannedRecordType,
    durableStorageWritten: review.evidence?.durableStorageWritten,
  },
}, null, 2));
EOF
