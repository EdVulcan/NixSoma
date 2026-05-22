#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6950}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6951}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6952}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6953}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6954}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6955}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6956}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6957}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6958}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-5-deployment-inventory-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-5-deployment-inventory-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${INVENTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
INVENTORY_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/phase-5/deployment-inventory" > "$INVENTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$INVENTORY_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const inventory = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of ["Phase 5 Deployment Inventory", "phase5-deployment-inventory-panel", "phase5-deployment-services", "phase5-deployment-modules"]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of ["/phase-5/deployment-inventory", "refreshPhase5DeploymentInventory", "openclaw-phase-5-deployment-inventory-v0"]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!inventory.ok || inventory.summary?.ready !== true || inventory.summary?.modulesObserved < 8) {
  throw new Error(`Observer Phase 5 deployment inventory should be ready: ${JSON.stringify(inventory.summary)}`);
}

console.log(JSON.stringify({ observerOpenClawPhase5DeploymentInventory: { status: "passed", panel: "Phase 5 Deployment Inventory", modules: inventory.summary.modulesObserved } }, null, 2));
EOF
