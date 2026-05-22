#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7050}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7051}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7052}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7053}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7054}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7055}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7056}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7057}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7058}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-context-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-context-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${CONTEXT_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
CONTEXT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/consciousness-context-envelope" > "$CONTEXT_FILE"
node - <<'EOF' "$CONTEXT_FILE"
const fs = require("node:fs");
const context = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!context.ok || context.registry !== "openclaw-phase-6-consciousness-context-envelope-v0" || context.summary?.ready !== true || context.summary?.memoryPointers < 5 || context.summary?.transmitted !== false || context.summary?.callsCloudModel !== false || context.envelope?.schema !== "openclaw.consciousness.context.v0") {
  throw new Error(`Phase 6 consciousness context envelope should be ready and untransmitted: ${JSON.stringify(context.summary)}`);
}
console.log(JSON.stringify({ openclawPhase6ConsciousnessContextEnvelope: { status: "passed", pointers: context.summary.memoryPointers } }, null, 2));
EOF
