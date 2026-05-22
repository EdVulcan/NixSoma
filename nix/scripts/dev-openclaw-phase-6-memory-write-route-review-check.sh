#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7070}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7071}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7072}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7073}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7074}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7075}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7076}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7077}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7078}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-route-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${ROUTE_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
ROUTE_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/memory-write-route-review" > "$ROUTE_FILE"
node - <<'EOF' "$ROUTE_FILE"
const fs = require("node:fs");
const route = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!route.ok || route.registry !== "openclaw-phase-6-memory-write-route-review-v0" || route.summary?.ready !== true || route.summary?.writesMemory !== false || route.summary?.callsCloudModel !== false || route.summary?.selectedSlice !== "openclaw-phase-6-exit") {
  throw new Error(`Phase 6 memory write route review should defer writes: ${JSON.stringify(route.summary)}`);
}
console.log(JSON.stringify({ openclawPhase6MemoryWriteRouteReview: { status: "passed", selected: route.summary.selectedSlice } }, null, 2));
EOF
