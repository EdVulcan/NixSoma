#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6900}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6901}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6902}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6903}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6904}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6905}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6906}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6907}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6908}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-5-deployment-inventory-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-5-deployment-inventory-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${INVENTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
INVENTORY_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-5/deployment-inventory" > "$INVENTORY_FILE"

node - <<'EOF' "$INVENTORY_FILE"
const fs = require("node:fs");
const inventory = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!inventory.ok
  || inventory.registry !== "openclaw-phase-5-deployment-inventory-v0"
  || inventory.status !== "deployment_inventory_ready"
  || inventory.summary?.ready !== true
  || inventory.summary?.servicesObserved < 7
  || inventory.summary?.modulesObserved < 8
  || inventory.summary?.mutatesHost !== false) {
  throw new Error(`Phase 5 deployment inventory should be ready and read-only: ${JSON.stringify(inventory.summary)}`);
}
for (const token of ["nix/modules/openclaw-core.nix", "nix/modules/observer-ui.nix", "nix/scripts/rebuild.sh"]) {
  if (!JSON.stringify(inventory.deployment).includes(token)) throw new Error(`Deployment inventory missing ${token}`);
}

console.log(JSON.stringify({
  openclawPhase5DeploymentInventory: {
    status: "passed",
    registry: inventory.registry,
    servicesObserved: inventory.summary.servicesObserved,
    modulesObserved: inventory.summary.modulesObserved,
  },
}, null, 2));
EOF
