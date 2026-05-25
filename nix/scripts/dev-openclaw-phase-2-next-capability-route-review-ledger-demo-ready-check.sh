#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6550}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6551}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6552}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6553}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6554}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6555}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6556}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6557}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6620}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-ledger-demo-ready-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-ledger-demo-ready-check.json}"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before ledger-demo-ready route review."

curl --silent --fail "$CORE_URL/phase-2/demo-readiness-exit" >/dev/null
created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before ledger-demo-ready route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before ledger-demo-ready route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
ledger_demo_status="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-demo-status")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review?afterLedgerDemoStatus=true")"

node - <<'EOF' "$PLAN_FILE" "$ledger_demo_status" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const ledgerDemoStatus = JSON.parse(process.argv[3]);
const review = JSON.parse(process.argv[4]);

for (const token of [
  "After `openclaw-body-evidence-ledger-demo-status` passes",
  "openclaw-systemd-next-repair-scope-review",
  "avoid looping back into the completed ledger demo package",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing ledger-demo-ready route token: ${token}`);
  }
}

if (!ledgerDemoStatus.ok
  || ledgerDemoStatus.registry !== "openclaw-body-evidence-ledger-demo-status-v0"
  || ledgerDemoStatus.summary?.demoReady !== true) {
  throw new Error(`ledger demo status should be ready before route review: ${JSON.stringify(ledgerDemoStatus)}`);
}
if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`next capability route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedTrack !== "Track A: Real NixOS/systemd Repair Semantics"
  || review.decision?.selectedSlice !== "openclaw-systemd-next-repair-scope-review") {
  throw new Error(`ledger-demo-ready route review should select next repair scope review: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of [
  "no repair candidate assessment loop",
  "no body evidence timeline loop",
  "no body evidence ledger plan or append loop",
  "no body evidence ledger demo status loop",
  "no plugin/runtime adapter work",
  "no automatic repair",
  "no broader host mutation",
]) {
  if (!review.decision?.notSelected?.includes(forbidden)) {
    throw new Error(`ledger-demo-ready route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.evidence?.bodyEvidenceLedgerDemoReady !== true
  || review.evidence?.bodyEvidenceLedgerDemoStatusRegistry !== "openclaw-body-evidence-ledger-demo-status-v0"
  || review.evidence?.bodyEvidenceLedgerRecordCount !== 1) {
  throw new Error(`ledger-demo-ready route review should cite ledger demo evidence: ${JSON.stringify(review.evidence)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.track !== "Track A"
  || selected.firstSlice !== "openclaw-systemd-next-repair-scope-review"
  || selected.mutation !== false) {
  throw new Error(`ledger-demo-ready route review should recommend non-mutating next repair scope review: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-systemd-next-repair-scope-review"
  || !String(review.next?.boundary ?? "").includes("do not create repair tasks")) {
  throw new Error(`ledger-demo-ready route review should point to read-only scope review boundary: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReviewLedgerDemoReady: {
    status: "passed",
    registry: review.registry,
    selectedTrack: review.decision.selectedTrack,
    selectedSlice: review.decision.selectedSlice,
    next: review.next.recommendedSlice,
  },
}, null, 2));
EOF
