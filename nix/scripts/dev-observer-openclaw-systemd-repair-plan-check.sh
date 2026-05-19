#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5860}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5861}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5862}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5863}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5864}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5865}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5866}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5867}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5930}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-plan-check.json}"

SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-plan?unit=openclaw-browser-runtime.service")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const plan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Systemd Repair Plan",
  "systemd-repair-plan-panel",
  "systemd-repair-plan-target",
  "systemd-repair-plan-risk",
  "systemd-repair-plan-mode",
  "systemd-repair-plan-json",
];
const requiredClient = [
  "/system/systemd/repair-plan?unit=openclaw-browser-runtime.service",
  "refreshSystemdRepairPlan",
  "systemdRepairPlanTarget",
  "systemdRepairPlanRisk",
  "rollbackNote",
  "approvalRequiredForExecution",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!plan.ok || plan.registry !== "openclaw-systemd-repair-plan-v0" || plan.mode !== "plan_only") {
  throw new Error(`Observer repair-plan source should expose plan-only registry: ${JSON.stringify(plan)}`);
}
if (plan.canMutate !== false || plan.canRestart !== false || plan.proposal?.approvalRequiredForExecution !== true) {
  throw new Error(`Observer repair-plan source should remain non-mutating: ${JSON.stringify(plan)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairPlan: {
    status: "passed",
    panel: "Systemd Repair Plan",
    registry: plan.registry,
    mode: plan.mode,
    target: plan.target?.unit,
    risk: plan.proposal?.risk,
  },
}, null, 2));
EOF
