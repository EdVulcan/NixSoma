#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6290}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6291}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6292}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6293}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6294}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6295}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6296}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6297}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6360}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-readiness-check.json}"

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

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
readiness="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-readiness")"

node - <<'EOF' "$PLAN_FILE" "$readiness"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-readiness",
  "Systemd repair candidate readiness checkpoint",
  "Creates no task, no approval, no command execution",
  "the next route-review boundary",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing candidate readiness token: ${token}`);
  }
}

if (!readiness.ok || readiness.registry !== "openclaw-systemd-repair-candidate-readiness-v0") {
  throw new Error(`candidate readiness should expose expected registry: ${JSON.stringify(readiness)}`);
}
if (readiness.mode !== "read_only_candidate_repair_block_readiness") {
  throw new Error(`candidate readiness should be read-only: ${JSON.stringify(readiness.mode)}`);
}
if (readiness.summary?.ready !== true
  || readiness.summary?.selectedUnit !== "openclaw-browser-runtime.service"
  || readiness.summary?.existingRouteAvailable !== true) {
  throw new Error(`candidate readiness should close the browser-runtime candidate route: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.triggersRecovery !== false
  || readiness.governance?.schedulesFollowUp !== false) {
  throw new Error(`candidate readiness must not execute or schedule work: ${JSON.stringify(readiness.governance)}`);
}
if (!Array.isArray(readiness.completedBlock?.completedSlices)
  || !readiness.completedBlock.completedSlices.includes("openclaw-systemd-repair-candidate-task-shell")
  || !readiness.completedBlock.completedSlices.includes("observer-openclaw-systemd-repair-candidate-task-shell")) {
  throw new Error(`candidate readiness should list completed task shell slices: ${JSON.stringify(readiness.completedBlock)}`);
}
if (readiness.next?.recommendedSlice !== "openclaw-systemd-repair-candidate-route-review") {
  throw new Error(`candidate readiness should route to review before broadening: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateReadiness: {
    status: "passed",
    registry: readiness.registry,
    ready: readiness.summary.ready,
    selectedUnit: readiness.summary.selectedUnit,
    checks: `${readiness.summary.passedChecks}/${readiness.summary.totalChecks}`,
    next: readiness.next.recommendedSlice,
    hostMutation: readiness.governance.hostMutation,
  },
}, null, 2));
EOF
