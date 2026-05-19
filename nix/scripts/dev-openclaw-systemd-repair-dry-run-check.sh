#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5870}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5871}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5872}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5873}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5874}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5875}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5876}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5877}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5940}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-dry-run-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-dry-run-check.json}"

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

envelope="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service")"

node - <<'EOF' "$envelope"
const envelope = JSON.parse(process.argv[2]);

if (!envelope.ok || envelope.registry !== "openclaw-systemd-repair-dry-run-v0") {
  throw new Error(`systemd repair dry-run should expose the expected registry: ${JSON.stringify(envelope)}`);
}
if (envelope.mode !== "operator_visible_dry_run" || envelope.canMutate !== false || envelope.canRestart !== false || envelope.wouldExecute !== false) {
  throw new Error(`systemd repair dry-run must not mutate or restart: ${JSON.stringify({
    mode: envelope.mode,
    canMutate: envelope.canMutate,
    canRestart: envelope.canRestart,
    wouldExecute: envelope.wouldExecute,
  })}`);
}
if (envelope.source?.planRegistry !== "openclaw-systemd-repair-plan-v0") {
  throw new Error(`systemd repair dry-run should cite repair-plan evidence: ${JSON.stringify(envelope.source)}`);
}
if (envelope.target?.unit !== "openclaw-browser-runtime.service") {
  throw new Error(`systemd repair dry-run should target the selected unit: ${JSON.stringify(envelope.target)}`);
}
if (envelope.plan?.proposal?.action !== "restart-service" || envelope.plan?.canMutate !== false) {
  throw new Error(`systemd repair dry-run should embed the non-mutating repair plan: ${JSON.stringify(envelope.plan)}`);
}
const dryRun = envelope.dryRun ?? {};
if (dryRun.mode !== "dry_run" || dryRun.command !== "systemctl" || dryRun.wouldExecute !== false) {
  throw new Error(`systemd repair dry-run should embed a dry-run command envelope: ${JSON.stringify(dryRun)}`);
}
if (!dryRun.args?.includes("restart") || !dryRun.args?.includes("openclaw-browser-runtime.service")) {
  throw new Error(`systemd repair dry-run should show restart args: ${JSON.stringify(dryRun.args)}`);
}
if (dryRun.risk !== "high" || dryRun.requiresApproval !== true) {
  throw new Error(`systemd repair dry-run should mark future restart as high-risk and approval-gated: ${JSON.stringify(dryRun)}`);
}
const checkNames = new Set((dryRun.checks ?? []).map((check) => check.name));
for (const expected of ["no_execution", "operator_visible_before_mutation", "no_restart_executed"]) {
  if (!checkNames.has(expected)) {
    throw new Error(`systemd repair dry-run missing check ${expected}: ${JSON.stringify(dryRun.checks)}`);
  }
}
if (envelope.governance?.hostMutation !== false || envelope.governance?.executesCommand !== false || envelope.governance?.futureExecutionRequiresSeparateMilestone !== true) {
  throw new Error(`systemd repair dry-run governance should require a separate future execution milestone: ${JSON.stringify(envelope.governance)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairDryRun: {
    status: "passed",
    registry: envelope.registry,
    target: envelope.target.unit,
    command: `${dryRun.command} ${dryRun.args.join(" ")}`,
    mode: envelope.mode,
    next: envelope.next?.recommendedSlice,
  },
}, null, 2));
EOF
