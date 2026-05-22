#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_3_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6730}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6731}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6732}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6733}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6734}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6735}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6736}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6737}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6738}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-exit-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${EXIT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail -X POST "$SESSION_MANAGER_URL/work-view/prepare" \
  -H 'content-type: application/json' \
  --data '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-exit"}' >/dev/null

EXIT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/exit" > "$EXIT_FILE"

node - <<'EOF' "$PLAN_FILE" "$EXIT_FILE"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-phase-3-exit",
  "Phase 3 is complete",
  "No hidden foreground stealing",
  "openclaw-phase-4-plan",
]) {
  if (token !== "No hidden foreground stealing" && !planDoc.includes(token)) {
    throw new Error(`Phase 3 plan doc missing ${token}`);
  }
}
if (!exitGate.ok
  || exitGate.registry !== "openclaw-phase-3-exit-v0"
  || exitGate.status !== "phase_3_complete"
  || exitGate.summary?.complete !== true
  || exitGate.summary?.completionPercent !== 100
  || exitGate.summary?.foregroundStealByDefault !== false
  || exitGate.completedPhase?.completionClaim !== "phase_3_complete") {
  throw new Error(`Phase 3 exit should mark completion: ${JSON.stringify(exitGate.summary)}`);
}
if (exitGate.governance?.createsTask !== false
  || exitGate.governance?.createsApproval !== false
  || exitGate.governance?.executesCommand !== false
  || exitGate.governance?.mutatesHost !== false
  || exitGate.governance?.schedulesWork !== false
  || exitGate.governance?.stealsForeground !== false) {
  throw new Error(`Phase 3 exit must remain read-only and non-intrusive: ${JSON.stringify(exitGate.governance)}`);
}
if (exitGate.next?.recommendedSlice !== "openclaw-phase-4-plan") {
  throw new Error(`Phase 3 exit should point to Phase 4 plan: ${JSON.stringify(exitGate.next)}`);
}

console.log(JSON.stringify({
  openclawPhase3Exit: {
    status: "passed",
    registry: exitGate.registry,
    completionPercent: exitGate.summary.completionPercent,
    next: exitGate.next.recommendedSlice,
  },
}, null, 2));
EOF
