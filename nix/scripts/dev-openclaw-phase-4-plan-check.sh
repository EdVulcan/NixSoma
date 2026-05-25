#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_4_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6790}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6791}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6792}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6793}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6794}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6795}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6796}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6797}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6798}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-4-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-4-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${PLAN_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
PLAN_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-4/plan" > "$PLAN_FILE"

node - <<'EOF' "$PLAN_DOC" "$PLAN_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-phase-4-plan",
  "openclaw-phase-4-self-heal-loop",
  "openclaw-phase-4-heal-history-evidence",
  "Let it care for its body",
]) {
  if (!doc.includes(token)) {
    throw new Error(`Phase 4 plan doc missing ${token}`);
  }
}
if (!plan.ok
  || plan.registry !== "openclaw-phase-4-plan-v0"
  || plan.status !== "phase_4_route_selected"
  || plan.summary?.ready !== true
  || plan.governance?.realHostRepair !== false
  || plan.next?.recommendedSlice !== "openclaw-phase-4-self-heal-loop") {
  throw new Error(`Phase 4 plan should select conservative self-heal route: ${JSON.stringify(plan.summary)}`);
}

console.log(JSON.stringify({
  openclawPhase4Plan: {
    status: "passed",
    registry: plan.registry,
    ready: plan.summary.ready,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
