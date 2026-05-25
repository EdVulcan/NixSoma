#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_3_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6690}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6691}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6692}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6693}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6694}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6695}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6696}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6697}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6698}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${PLAN_JSON_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PLAN_JSON_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/plan" > "$PLAN_JSON_FILE"

node - <<'EOF' "$PLAN_FILE" "$PLAN_JSON_FILE"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-phase-3-plan",
  "openclaw-phase-3-background-work-view",
  "openclaw-phase-3-operator-interrupt-controls",
  "openclaw-phase-3-exit",
  "Let it work without stealing the foreground",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 3 plan doc missing ${token}`);
  }
}
if (!plan.ok
  || plan.registry !== "openclaw-phase-3-plan-v0"
  || plan.status !== "phase_3_route_selected"
  || plan.summary?.ready !== true
  || plan.governance?.stealsForeground !== false
  || plan.next?.recommendedSlice !== "openclaw-phase-3-background-work-view") {
  throw new Error(`Phase 3 plan should select the background work-view route: ${JSON.stringify(plan.summary)}`);
}

console.log(JSON.stringify({
  openclawPhase3Plan: {
    status: "passed",
    registry: plan.registry,
    ready: plan.summary.ready,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
