#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6570}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6571}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6572}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6573}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6574}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6575}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6576}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6577}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6640}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-scope-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-scope-review-check.json}"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before next repair scope review."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair scope review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair scope review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-demo-status" >/dev/null
review="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-scope-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "Systemd next repair scope review checkpoint",
  "openclaw-systemd-next-repair-scope-review",
  "Selects `openclaw-system-sense.service`",
  "Creates no task, no approval, no command execution, no restart",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair scope token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-systemd-next-repair-scope-review-v0") {
  throw new Error(`next repair scope review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_next_systemd_repair_scope_review") {
  throw new Error(`next repair scope review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.selectedTrack !== "Track A: Real NixOS/systemd Repair Semantics"
  || review.decision?.selectedSlice !== "openclaw-systemd-next-repair-plan"
  || review.decision?.selectedUnit !== "openclaw-system-sense.service"
  || review.decision?.status !== "selected") {
  throw new Error(`next repair scope review should select system-sense plan scope: ${JSON.stringify(review.decision)}`);
}
if (review.summary?.ready !== true
  || review.summary?.ledgerDemoReady !== true
  || review.summary?.selectedUnit !== "openclaw-system-sense.service"
  || review.summary?.hiddenMutation !== false) {
  throw new Error(`next repair scope summary should be ready and non-mutating: ${JSON.stringify(review.summary)}`);
}
for (const forbidden of [
  "no browser-runtime repair demo loop",
  "no immediate repair task",
  "no systemctl execution",
  "no broader host mutation",
  "no automatic repair",
  "no plugin/runtime adapter work",
  "no additional ledger writes",
]) {
  if (!review.decision?.notSelected?.includes(forbidden)) {
    throw new Error(`next repair scope review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.governance?.hostMutation !== false
  || review.governance?.canRestart !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`next repair scope review governance should stay read-only: ${JSON.stringify(review.governance)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.unit !== "openclaw-system-sense.service"
  || selected.mutation !== false) {
  throw new Error(`next repair scope review should recommend system-sense without mutation: ${JSON.stringify(review.candidates)}`);
}
if (review.evidence?.ledgerDemo?.registry !== "openclaw-body-evidence-ledger-demo-status-v0"
  || review.evidence?.ledgerDemo?.demoReady !== true
  || review.evidence?.ledgerDemo?.recordCount !== 1) {
  throw new Error(`next repair scope review should cite ledger demo evidence: ${JSON.stringify(review.evidence?.ledgerDemo)}`);
}
if (review.next?.recommendedSlice !== "openclaw-systemd-next-repair-plan"
  || !String(review.next?.boundary ?? "").includes("do not create tasks")) {
  throw new Error(`next repair scope review should point to plan-only next boundary: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairScopeReview: {
    status: "passed",
    registry: review.registry,
    selectedUnit: review.decision.selectedUnit,
    selectedSlice: review.decision.selectedSlice,
    candidateCount: review.summary.candidateCount,
  },
}, null, 2));
EOF
