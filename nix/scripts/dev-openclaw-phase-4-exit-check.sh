#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_4_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6830}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6831}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6832}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6833}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6834}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6835}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6836}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6837}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6838}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-4-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-4-exit-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${EXIT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
EXIT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-4/exit" > "$EXIT_FILE"

node - <<'EOF' "$PLAN_DOC" "$EXIT_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of ["openclaw-phase-4-exit", "Phase 4 is complete", "openclaw-phase-5-plan"]) {
  if (!doc.includes(token)) {
    throw new Error(`Phase 4 plan doc missing ${token}`);
  }
}
if (!exitGate.ok
  || exitGate.registry !== "openclaw-phase-4-exit-v0"
  || exitGate.status !== "phase_4_complete"
  || exitGate.summary?.complete !== true
  || exitGate.summary?.completionPercent !== 100
  || exitGate.summary?.realHostRepair !== false
  || exitGate.completedPhase?.completionClaim !== "phase_4_complete"
  || exitGate.next?.recommendedSlice !== "openclaw-phase-5-plan") {
  throw new Error(`Phase 4 exit should mark completion: ${JSON.stringify(exitGate.summary)}`);
}

console.log(JSON.stringify({
  openclawPhase4Exit: {
    status: "passed",
    registry: exitGate.registry,
    completionPercent: exitGate.summary.completionPercent,
    next: exitGate.next.recommendedSlice,
  },
}, null, 2));
EOF
