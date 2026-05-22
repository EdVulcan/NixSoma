#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7040}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7041}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7042}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7043}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7044}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7045}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7046}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7047}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7048}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-memory-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-memory-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${MEMORY_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
MEMORY_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/memory-substrate-inventory" > "$MEMORY_FILE"
node - <<'EOF' "$MEMORY_FILE"
const fs = require("node:fs");
const memory = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!memory.ok || memory.registry !== "openclaw-phase-6-memory-substrate-inventory-v0" || memory.summary?.ready !== true || memory.summary?.sourceCount < 6 || memory.summary?.writableSources !== 0 || memory.summary?.writesMemory !== false) {
  throw new Error(`Phase 6 memory substrate inventory should be read-only and ready: ${JSON.stringify(memory.summary)}`);
}
for (const token of ["task-history", "event-audit", "body-evidence-ledger", "heal-history", "observer-evidence"]) {
  if (!JSON.stringify(memory.memorySources).includes(token)) throw new Error(`Memory substrate missing ${token}`);
}
console.log(JSON.stringify({ openclawPhase6MemorySubstrateInventory: { status: "passed", sources: memory.summary.sourceCount } }, null, 2));
EOF
