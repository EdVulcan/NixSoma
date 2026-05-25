#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_6_PLAN.md"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7080}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7081}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7082}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7083}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7084}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7085}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7086}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7087}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7088}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-exit-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${EXIT_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
EXIT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/exit" > "$EXIT_FILE"
node - <<'EOF' "$PLAN_DOC" "$EXIT_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-phase-6-exit", "Phase 6 is complete", "openclaw-long-term-memory-write-plan"]) {
  if (!doc.includes(token)) throw new Error(`Phase 6 plan doc missing ${token}`);
}
if (!exitGate.ok || exitGate.registry !== "openclaw-phase-6-exit-v0" || exitGate.status !== "phase_6_complete" || exitGate.summary?.complete !== true || exitGate.summary?.completionPercent !== 100 || exitGate.summary?.writesMemory !== false || exitGate.summary?.callsCloudModel !== false || exitGate.summary?.createsTask !== false || exitGate.next?.recommendedSlice !== "openclaw-long-term-memory-write-plan") {
  throw new Error(`Phase 6 exit should mark completion: ${JSON.stringify(exitGate.summary)}`);
}
console.log(JSON.stringify({ openclawPhase6Exit: { status: "passed", percent: exitGate.summary.completionPercent, next: exitGate.next.recommendedSlice } }, null, 2));
EOF
