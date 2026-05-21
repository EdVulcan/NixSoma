#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6530}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6531}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6532}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6533}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6534}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6535}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6536}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6537}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6600}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-ledger-ready-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-ledger-ready-check.json}"

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

curl --silent --fail "$CORE_URL/phase-2/demo-readiness-exit" >/dev/null
created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before route review ledger-ready check."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before route review ledger-ready check."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-readiness")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

node - <<'EOF' "$PLAN_FILE" "$readiness" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);
const review = JSON.parse(process.argv[4]);

for (const token of [
  "After `openclaw-body-evidence-ledger-readiness` passes",
  "openclaw-body-evidence-ledger-demo-status",
  "avoid looping back into the already completed ledger plan or append path",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing ledger-ready route token: ${token}`);
  }
}

if (!readiness.ok || readiness.summary?.ready !== true || readiness.registry !== "openclaw-body-evidence-ledger-readiness-v0") {
  throw new Error(`ledger readiness should be ready before route review: ${JSON.stringify(readiness)}`);
}
if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`next capability route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedTrack !== "Track C: Body Governance Enhancement"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-demo-status") {
  throw new Error(`ledger-ready route review should select ledger demo status: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of [
  "no repair candidate assessment loop",
  "no body evidence timeline loop",
  "no body evidence ledger plan or append loop",
  "no plugin/runtime adapter work",
  "no automatic repair",
  "no broader host mutation",
]) {
  if (!review.decision?.notSelected?.includes(forbidden)) {
    throw new Error(`ledger-ready route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.evidence?.bodyEvidenceLedgerReady !== true
  || review.evidence?.bodyEvidenceLedgerReadinessRegistry !== "openclaw-body-evidence-ledger-readiness-v0"
  || review.evidence?.bodyEvidenceLedgerRecordCount !== 1) {
  throw new Error(`ledger-ready route review should cite ledger readiness evidence: ${JSON.stringify(review.evidence)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.track !== "Track C"
  || selected.firstSlice !== "openclaw-body-evidence-ledger-demo-status"
  || selected.mutation !== false) {
  throw new Error(`ledger-ready route review should recommend non-mutating ledger demo status: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-demo-status"
  || !String(review.next?.boundary ?? "").includes("do not add more ledger records")) {
  throw new Error(`ledger-ready route review should point to demo status with no-more-writes boundary: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReviewLedgerReady: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    ledgerRecordCount: review.evidence.bodyEvidenceLedgerRecordCount,
    next: review.next.recommendedSlice,
  },
}, null, 2));
EOF
