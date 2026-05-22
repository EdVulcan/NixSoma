#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6920}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6921}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6922}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6923}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6924}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6925}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6926}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6927}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6928}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-5-release-control-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-5-release-control-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${READINESS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
READINESS_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-5/release-control-readiness" > "$READINESS_FILE"

node - <<'EOF' "$READINESS_FILE"
const fs = require("node:fs");
const readiness = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!readiness.ok
  || readiness.registry !== "openclaw-phase-5-release-control-readiness-v0"
  || readiness.status !== "phase_5_ready_for_exit"
  || readiness.summary?.ready !== true
  || readiness.summary?.completionPercent !== 100
  || readiness.summary?.releaseAction !== false
  || readiness.summary?.mutatesHost !== false) {
  throw new Error(`Phase 5 release control readiness should be 100% and read-only: ${JSON.stringify(readiness.summary)}`);
}

console.log(JSON.stringify({
  openclawPhase5ReleaseControlReadiness: {
    status: "passed",
    registry: readiness.registry,
    completionPercent: readiness.summary.completionPercent,
    tracks: readiness.completedTracks.map((track) => track.id),
  },
}, null, 2));
EOF
