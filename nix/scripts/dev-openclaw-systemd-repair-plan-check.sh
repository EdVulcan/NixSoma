#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5850}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5851}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5852}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5853}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5854}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5855}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5856}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5857}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5920}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-plan-check.json}"

SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-plan?unit=openclaw-browser-runtime.service")"

node - <<'EOF' "$plan"
const plan = JSON.parse(process.argv[2]);

if (!plan.ok || plan.registry !== "openclaw-systemd-repair-plan-v0") {
  throw new Error(`systemd repair plan should expose the expected registry: ${JSON.stringify(plan)}`);
}
if (plan.mode !== "plan_only" || plan.canMutate !== false || plan.canRestart !== false || plan.wouldExecute !== false) {
  throw new Error(`systemd repair plan must not mutate or restart: ${JSON.stringify({
    mode: plan.mode,
    canMutate: plan.canMutate,
    canRestart: plan.canRestart,
    wouldExecute: plan.wouldExecute,
  })}`);
}
if (plan.source?.inventoryRegistry !== "openclaw-systemd-unit-inventory-v0") {
  throw new Error(`systemd repair plan should cite unit inventory evidence: ${JSON.stringify(plan.source)}`);
}
if (plan.target?.unit !== "openclaw-browser-runtime.service" || plan.target?.component !== "body") {
  throw new Error(`systemd repair plan should target the selected OpenClaw body unit: ${JSON.stringify(plan.target)}`);
}
const proposal = plan.proposal ?? {};
if (proposal.action !== "restart-service" || proposal.command?.command !== "systemctl") {
  throw new Error(`systemd repair plan should propose an operator-visible systemctl restart: ${JSON.stringify(proposal)}`);
}
if (!proposal.command?.args?.includes("restart") || !proposal.command?.args?.includes("openclaw-browser-runtime.service")) {
  throw new Error(`systemd repair plan should include restart command args: ${JSON.stringify(proposal.command)}`);
}
if (proposal.approvalRequiredForExecution !== true || proposal.dryRunRequiredBeforeExecution !== true) {
  throw new Error(`systemd repair plan should require approval and dry-run before future execution: ${JSON.stringify(proposal)}`);
}
if (typeof proposal.rollbackNote !== "string" || !proposal.rollbackNote.includes("No automatic rollback")) {
  throw new Error(`systemd repair plan should expose rollback note: ${JSON.stringify(proposal.rollbackNote)}`);
}
if (plan.governance?.hostMutation !== false || plan.governance?.executesCommand !== false || plan.governance?.approvalFlowCreated !== false) {
  throw new Error(`systemd repair plan governance should remain plan-only: ${JSON.stringify(plan.governance)}`);
}
if (plan.next?.recommendedSlice !== "openclaw-systemd-repair-dry-run") {
  throw new Error(`systemd repair plan should point to the dry-run slice next: ${JSON.stringify(plan.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairPlan: {
    status: "passed",
    registry: plan.registry,
    target: plan.target.unit,
    action: proposal.action,
    risk: proposal.risk,
    mode: plan.mode,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
