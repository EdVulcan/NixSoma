#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6190}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6191}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6192}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6193}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6194}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6195}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6196}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6197}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6260}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

created_next_repair="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
next_repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_next_repair")"
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before next capability route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
curl --silent --fail "$CORE_URL/phase-2/demo-readiness-exit" >/dev/null
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-next-capability-route-review",
  "Phase 2 next capability route review checkpoint",
  "openclaw-body-evidence-ledger-plan",
  "Select Track A",
  "After `openclaw-systemd-repair-candidate-demo-status` is complete, select Track C",
  "After `openclaw-body-evidence-timeline-readiness` is complete, select Track C",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing next capability route review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`next capability route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_next_capability_route_selection") {
  throw new Error(`next capability route review should be read-only route selection: ${JSON.stringify(review.mode)}`);
}
if (review.governance?.readOnly !== true
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.mutatesHost !== false
  || review.governance?.triggersRecovery !== false
  || review.governance?.schedulesWork !== false) {
  throw new Error(`next capability route review governance must remain non-executing: ${JSON.stringify(review.governance)}`);
}
if (review.source?.demoReadinessExitRegistry !== "openclaw-phase-2-demo-readiness-exit-v0") {
  throw new Error(`next capability route review should cite demo readiness exit: ${JSON.stringify(review.source)}`);
}
if (review.decision?.selectedTrack !== "Track C: Body Governance Enhancement"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-plan") {
  throw new Error(`next capability route review should select body evidence ledger plan after timeline readiness: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of ["repair candidate assessment loop", "body evidence timeline loop", "plugin/runtime adapter", "automatic repair", "broader host mutation", "durable storage implementation before a plan"]) {
  if (!review.decision?.notSelected?.some((item) => item.includes(forbidden))) {
    throw new Error(`next capability route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision)}`);
  }
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected || selected.track !== "Track C" || selected.firstSlice !== "openclaw-body-evidence-ledger-plan" || selected.mutation !== false) {
  throw new Error(`next capability route review should recommend non-mutating Track C body evidence ledger plan: ${JSON.stringify(review.candidates)}`);
}
if (review.evidence?.candidateDemoReady !== true
  || review.evidence?.candidateDemoSelectedUnit !== "openclaw-browser-runtime.service") {
  throw new Error(`next capability route review should cite completed candidate demo status: ${JSON.stringify(review.evidence)}`);
}
if (review.evidence?.bodyEvidenceTimelineReady !== true) {
  throw new Error(`next capability route review should cite completed body evidence timeline readiness: ${JSON.stringify(review.evidence)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-plan") {
  throw new Error(`next capability route review should point to body evidence ledger plan next: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedTrack: review.decision.selectedTrack,
    selectedSlice: review.decision.selectedSlice,
    createsTask: review.governance.createsTask,
    mutatesHost: review.governance.mutatesHost,
  },
}, null, 2));
EOF
