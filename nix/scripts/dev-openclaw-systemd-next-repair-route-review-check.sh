#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-route-review-check.json}"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before next repair route review."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
repair_plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-plan")"
route_review="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-route-review")"

node - <<'EOF' "$PLAN_FILE" "$repair_plan" "$route_review"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const repairPlan = JSON.parse(process.argv[3]);
const review = JSON.parse(process.argv[4]);

for (const token of [
  "Systemd next repair route review checkpoint",
  "openclaw-systemd-next-repair-route-review",
  "openclaw-systemd-next-repair-dry-run",
  "Must not implement the dry-run envelope in this checkpoint",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair route review token: ${token}`);
  }
}

if (!repairPlan.ok
  || repairPlan.registry !== "openclaw-systemd-next-repair-plan-v0"
  || repairPlan.plan?.targetUnit !== "openclaw-system-sense.service"
  || repairPlan.plan?.commandPreviewOnly !== true) {
  throw new Error(`next repair plan should be ready before route review: ${JSON.stringify(repairPlan)}`);
}
if (!review.ok || review.registry !== "openclaw-systemd-next-repair-route-review-v0") {
  throw new Error(`next repair route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_next_systemd_repair_route_selection") {
  throw new Error(`next repair route review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.selectedTrack !== "Track A: Real NixOS/systemd Repair Semantics"
  || review.decision?.selectedSlice !== "openclaw-systemd-next-repair-dry-run"
  || review.decision?.selectedUnit !== "openclaw-system-sense.service"
  || review.decision?.status !== "selected") {
  throw new Error(`next repair route review should select system-sense dry-run: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of [
  "no immediate repair task",
  "no approval creation",
  "no systemctl execution",
  "no host mutation",
  "no browser-runtime repair demo replay",
  "no automatic repair",
  "no persistence hardening",
  "no denial recovery or duplicate-click work",
  "no plugin/runtime adapter work",
]) {
  if (!review.decision?.notSelected?.includes(forbidden)) {
    throw new Error(`next repair route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.governance?.hostMutation !== false
  || review.governance?.canRestart !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`next repair route review governance should stay read-only: ${JSON.stringify(review.governance)}`);
}
if (review.evidence?.planReady !== true
  || review.evidence?.targetUnit !== "openclaw-system-sense.service"
  || review.evidence?.commandPreview !== "systemctl restart openclaw-system-sense.service"
  || review.evidence?.commandPreviewOnly !== true
  || review.evidence?.planRegistry !== "openclaw-systemd-next-repair-plan-v0") {
  throw new Error(`next repair route review should cite ready plan evidence: ${JSON.stringify(review.evidence)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.track !== "Track A"
  || selected.firstSlice !== "openclaw-systemd-next-repair-dry-run"
  || selected.mutation !== false) {
  throw new Error(`next repair route review should recommend non-mutating dry-run: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-systemd-next-repair-dry-run"
  || !String(review.next?.boundary ?? "").includes("dry-run envelope only")) {
  throw new Error(`next repair route review should point to dry-run boundary: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedUnit: review.decision.selectedUnit,
    selectedSlice: review.decision.selectedSlice,
    hostMutation: review.governance.hostMutation,
  },
}, null, 2));
EOF
