#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_5_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6930}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6931}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6932}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6933}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6934}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6935}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6936}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6937}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6938}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-5-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-5-exit-check.json}"

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
curl --silent --fail "$CORE_URL/phase-5/exit" > "$EXIT_FILE"

node - <<'EOF' "$PLAN_DOC" "$EXIT_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of ["openclaw-phase-5-exit", "Phase 5 is complete", "openclaw-mvp-final-readiness"]) {
  if (!doc.includes(token)) throw new Error(`Phase 5 plan doc missing ${token}`);
}
if (!exitGate.ok
  || exitGate.registry !== "openclaw-phase-5-exit-v0"
  || exitGate.status !== "phase_5_complete"
  || exitGate.summary?.complete !== true
  || exitGate.summary?.completionPercent !== 100
  || exitGate.summary?.releaseAction !== false
  || exitGate.summary?.rollbackExecuted !== false
  || exitGate.summary?.mutatesHost !== false
  || exitGate.completedPhase?.completionClaim !== "phase_5_complete"
  || exitGate.next?.recommendedSlice !== "openclaw-mvp-final-readiness") {
  throw new Error(`Phase 5 exit should mark completion: ${JSON.stringify(exitGate.summary)}`);
}

console.log(JSON.stringify({
  openclawPhase5Exit: {
    status: "passed",
    registry: exitGate.registry,
    completionPercent: exitGate.summary.completionPercent,
    next: exitGate.next.recommendedSlice,
  },
}, null, 2));
EOF
