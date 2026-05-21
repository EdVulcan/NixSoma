#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6420}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6421}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6422}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6423}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6424}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6425}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6426}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6427}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6490}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-route-review-check.json}"

SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-route-review")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$review"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const review = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger Route Review",
  "body-evidence-ledger-route-review-panel",
  "body-evidence-ledger-route-review-status",
  "body-evidence-ledger-route-review-next",
  "body-evidence-ledger-route-review-write",
  "body-evidence-ledger-route-review-mutation",
  "body-evidence-ledger-route-review-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-route-review",
  "refreshBodyEvidenceLedgerRouteReview",
  "bodyEvidenceLedgerRouteReviewStatus",
  "bodyEvidenceLedgerRouteReviewNext",
  "bodyEvidenceLedgerRouteReviewWrite",
  "bodyEvidenceLedgerRouteReviewMutation",
  "bodyEvidenceLedgerRouteReviewJson",
  "openclaw-body-evidence-ledger-storage-root-plan",
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
if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-route-review-v0") {
  throw new Error(`Observer source should expose ledger route review registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-storage-root-plan") {
  throw new Error(`Observer ledger route review should select storage-root planning: ${JSON.stringify(review.decision)}`);
}
if (!review.decision?.notSelected?.includes("no direct durable ledger append")
  || !review.decision?.notSelected?.includes("no background ledger scheduler")) {
  throw new Error(`Observer ledger route review should reject direct writes and schedulers: ${JSON.stringify(review.decision?.notSelected)}`);
}
if (review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.hostMutation !== false
  || review.governance?.executesCommand !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`Observer ledger route review must stay non-mutating: ${JSON.stringify(review.governance)}`);
}
if (review.evidence?.ledgerPlanReady !== true || review.evidence?.durableStorageWritten !== false) {
  throw new Error(`Observer ledger route review should cite ready non-written plan: ${JSON.stringify(review.evidence)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerRouteReview: {
    status: "passed",
    panel: "Body Evidence Ledger Route Review",
    registry: review.registry,
    selectedSlice: review.decision?.selectedSlice,
    canWriteLedger: review.governance?.canWriteLedger,
    durableStorageWritten: review.governance?.durableStorageWritten,
  },
}, null, 2));
EOF
