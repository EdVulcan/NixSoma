#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6720}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6721}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6722}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6723}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6724}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6725}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6726}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6727}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6728}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-completion-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-completion-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${READINESS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail -X POST "$SESSION_MANAGER_URL/work-view/prepare" \
  -H 'content-type: application/json' \
  --data '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-readiness"}' >/dev/null

READINESS_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/completion-readiness" > "$READINESS_FILE"

node - <<'EOF' "$READINESS_FILE"
const fs = require("node:fs");
const readiness = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!readiness.ok
  || readiness.registry !== "openclaw-phase-3-completion-readiness-v0"
  || readiness.status !== "phase_3_ready_for_exit"
  || readiness.summary?.ready !== true
  || readiness.summary?.completionPercent !== 100
  || readiness.summary?.foregroundStealByDefault !== false
  || readiness.summary?.takeoverSupported !== true) {
  throw new Error(`Phase 3 readiness should be 100%: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.mutatesHost !== false
  || readiness.governance?.schedulesWork !== false
  || readiness.governance?.backgroundWriter !== false) {
  throw new Error(`Phase 3 readiness must remain non-mutating: ${JSON.stringify(readiness.governance)}`);
}

console.log(JSON.stringify({
  openclawPhase3CompletionReadiness: {
    status: "passed",
    registry: readiness.registry,
    completionPercent: readiness.summary.completionPercent,
    tracks: readiness.completedTracks.map((track) => track.id),
  },
}, null, 2));
EOF
