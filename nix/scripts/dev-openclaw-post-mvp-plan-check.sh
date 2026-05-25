#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_POST_MVP_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7010}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7011}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7012}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7013}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7014}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7015}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7016}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7017}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7018}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-post-mvp-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-post-mvp-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${PLAN_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
PLAN_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/post-mvp/plan" > "$PLAN_FILE"

node - <<'EOF' "$PLAN_DOC" "$PLAN_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-post-mvp-plan",
  "Give the body a memory-bearing task mind",
  "openclaw-phase-6-consciousness-memory-plan",
  "No memory writes yet",
]) {
  if (!doc.includes(token)) throw new Error(`Post-MVP plan doc missing ${token}`);
}
if (!plan.ok
  || plan.registry !== "openclaw-post-mvp-plan-v0"
  || plan.status !== "post_mvp_route_selected"
  || plan.summary?.ready !== true
  || plan.summary?.mvpComplete !== true
  || plan.summary?.selectedTrunk !== "consciousness-memory-orchestration"
  || plan.governance?.writesMemory !== false
  || plan.governance?.callsCloudModel !== false
  || plan.next?.recommendedSlice !== "openclaw-phase-6-consciousness-memory-plan") {
  throw new Error(`Post-MVP plan should select consciousness/memory/task orchestration: ${JSON.stringify(plan.summary)}`);
}

console.log(JSON.stringify({
  openclawPostMvpPlan: {
    status: "passed",
    registry: plan.registry,
    selectedTrunk: plan.summary.selectedTrunk,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
